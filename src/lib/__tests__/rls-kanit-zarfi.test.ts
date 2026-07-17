// M9 adım 2: kanıt zarfı şema göçü — guard gerçekten tutuyor mu?
//
// Bu dosyanın derdi tek cümle: "yarım zarf" diye bir şey olmamalı. Zarf
// alanları eksik ama zarflı görünen bir kayıt, doğrulama ekranında "köken
// doğrulandı" der ve aslında doğrulamaz. Bir bütünlük ürününde en kötü
// sonuç yanlış güvence vermektir — hiç güvence vermemekten kötüdür.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, seedTwoTenants, type TestDb } from "./helpers/pg";

let db: TestDb;
let seed: Awaited<ReturnType<typeof seedTwoTenants>>;

const HASH = "ab".repeat(32);

beforeEach(async () => {
  db = await createTestDb();
  seed = await seedTwoTenants(db);
});

afterEach(async () => {
  await db.close();
});

/** Tam zarflı bir kanıt ekler. */
function tamKanit(patch: Record<string, unknown> = {}) {
  const alanlar: Record<string, unknown> = {
    tenant_id: seed.A.tenantId,
    control_id: seed.controlId,
    tip: "dosya",
    hash_sha256: HASH,
    mime_type: "application/pdf",
    file_size: 1024,
    classification: "gizli",
    retention_class: "10y",
    envelope_schema_version: "KALKAN_EVIDENCE_ENVELOPE_V1",
    ...patch,
  };
  const kolonlar = Object.keys(alanlar);
  const yerTutucular = kolonlar.map((_, i) => `$${i + 1}`);
  return db.sql(
    `insert into public.evidences (${kolonlar.join(", ")}) values (${yerTutucular.join(", ")}) returning id`,
    Object.values(alanlar),
  );
}

describe("evidence_envelope_guard", () => {
  it("tam zarflı kanıt yazılabilir", async () => {
    const { rows } = await tamKanit();
    expect(rows).toHaveLength(1);
  });

  it("zarfsız YENİ kanıt reddedilir — legacy yalnızca GEÇMİŞ için bir durum", async () => {
    await expect(tamKanit({ envelope_schema_version: null })).rejects.toThrow(/zarfsiz yazilamaz/i);
  });

  it("classification eksikse reddedilir", async () => {
    await expect(tamKanit({ classification: null })).rejects.toThrow(/classification/i);
  });

  it("retention_class eksikse reddedilir", async () => {
    await expect(tamKanit({ retention_class: null })).rejects.toThrow(/retention_class/i);
  });

  it("dosya kanıtında mime_type eksikse reddedilir", async () => {
    await expect(tamKanit({ mime_type: null })).rejects.toThrow(/mime_type/i);
  });

  it("dosya kanıtında file_size eksikse reddedilir", async () => {
    await expect(tamKanit({ file_size: null })).rejects.toThrow(/file_size/i);
  });

  it("link kanıtında dosya alanları zorunlu DEĞİL — orada dosya yok", async () => {
    // Zorunlu tutmak, olmayan bir dosyaya boyut/mime uydurmaya iterdi.
    const { rows } = await tamKanit({
      tip: "link",
      hash_sha256: null,
      mime_type: null,
      file_size: null,
      storage_path: "https://ornek.test/rapor",
    });
    expect(rows).toHaveLength(1);
  });

  it("önceki sürüm gösteriliyorsa zarf hash'i zorunlu — 'vardı ama neydi bilinmiyor' olmaz", async () => {
    const { rows } = await tamKanit();
    await expect(
      tamKanit({ previous_evidence_id: rows[0].id, previous_envelope_hash: null }),
    ).rejects.toThrow(/previous_envelope_hash/i);
  });

  it("zincirli yeni sürüm yazılabilir", async () => {
    const { rows } = await tamKanit();
    const { rows: v2 } = await tamKanit({
      version_no: 2,
      previous_evidence_id: rows[0].id,
      previous_envelope_hash: "cd".repeat(32),
      previous_file_hash: HASH,
    });
    expect(v2).toHaveLength(1);
  });
});

describe("evidence_butunluk_durumu", () => {
  it("zarflı kanıt FULL_ENVELOPE", async () => {
    const { rows } = await tamKanit();
    const { rows: d } = await db.sql(`select public.evidence_butunluk_durumu($1) as durum`, [
      rows[0].id,
    ]);
    expect(d[0].durum).toBe("FULL_ENVELOPE");
  });

  it("guard'dan ÖNCE yazılmış kayıt LEGACY_FILE_HASH_ONLY kalır", async () => {
    // Eski satırları taklit etmek için guard'ı geçici kaldırıyoruz: gerçek
    // canlıda bu satırlar migration'dan ÖNCE yazılmıştı ve guard onlara hiç
    // bakmadı. Onlara geriye dönük zarf uydurmuyoruz.
    await db.sql(`alter table public.evidences disable trigger evidence_envelope_guard_before_insert`);
    const { rows } = await db.sql(
      `insert into public.evidences (tenant_id, control_id, tip, hash_sha256)
       values ($1, $2, 'dosya', $3) returning id`,
      [seed.A.tenantId, seed.controlId, HASH],
    );
    await db.sql(`alter table public.evidences enable trigger evidence_envelope_guard_before_insert`);

    const { rows: d } = await db.sql(`select public.evidence_butunluk_durumu($1) as durum`, [
      rows[0].id,
    ]);
    expect(d[0].durum).toBe("LEGACY_FILE_HASH_ONLY");
  });
});

describe("append-only korunuyor (kural 2)", () => {
  it("zarf alanları eklendi ama UPDATE yolu açılmadı", async () => {
    const { rows } = await tamKanit();
    await expect(
      db.asUser(seed.A.userId, `update public.evidences set classification = 'genel' where id = $1`, [
        rows[0].id,
      ]),
    ).rejects.toThrow();
  });
});
