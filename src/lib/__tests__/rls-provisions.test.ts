// V2 PR-4b (M20): hükümler (provisions) — global referans (tenant'sız,
// ADR-T3), authenticated okur/istemci yazamaz; bitemporal (valid-time +
// system-time) ve kural 3 (parser/seed VERIFIED doğuramaz).
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, seedTwoTenants, type TestDb } from "./helpers/pg";

let db: TestDb;
let seed: Awaited<ReturnType<typeof seedTwoTenants>>;
const H = (c: string) => c.repeat(64);

/** Bir kaynak + artifact kurar, artifact id'sini döndürür. */
async function artifactEkle(hash = "a"): Promise<string> {
  const { rows: s } = await db.sql(
    `insert into public.regulatory_sources (authority, jurisdiction, kaynak_seviyesi, ad, erisim_politikasi_durumu)
     values ('SPK', 'TR', 'A', 'SPK Mevzuat Sistemi', 'manuel') returning id`,
  );
  const { rows: a } = await db.sql(
    `insert into public.source_artifacts (source_id, baslik, sha256) values ($1, 'Tebliğ v1', $2) returning id`,
    [s[0].id, H(hash)],
  );
  return a[0].id as string;
}

async function hukumEkle(
  artifactId: string,
  ref: string,
  effectiveFrom: string,
  extra: Record<string, unknown> = {},
): Promise<string> {
  const { rows } = await db.sql(
    `insert into public.provisions
       (source_artifact_id, provision_ref, metin, effective_from, effective_to, dogrulama_durumu)
     values ($1, $2, $3, $4, $5, coalesce($6, 'TODO_DOGRULA'))
     returning id`,
    [artifactId, ref, "Hüküm metni", effectiveFrom, extra.effective_to ?? null, extra.dogrulama_durumu ?? null],
  );
  return rows[0].id as string;
}

beforeEach(async () => {
  db = await createTestDb();
  seed = await seedTwoTenants(db);
});

afterEach(async () => {
  await db.close();
});

describe("provisions — global referans + bitemporal (M20)", () => {
  it("her iki kiracının kullanıcısı da AYNI hükmü okur (tenant'sız global)", async () => {
    const art = await artifactEkle();
    const pid = await hukumEkle(art, "md. 26", "2020-01-01");
    const { rows: a } = await db.asUser(seed.A.userId, `select id from public.provisions where id = $1`, [pid]);
    const { rows: b } = await db.asUser(seed.B.userId, `select id from public.provisions where id = $1`, [pid]);
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1); // global — B de görür (ortak hukuk verisi)
  });

  it("istemci global hüküm YAZAMAZ (politika yok — seed/service)", async () => {
    const art = await artifactEkle();
    await expect(
      db.asUser(
        seed.A.userId,
        `insert into public.provisions (source_artifact_id, provision_ref, metin, effective_from)
         values ($1, 'md. 1', 'x', '2020-01-01')`,
        [art],
      ),
    ).rejects.toThrow();
  });

  it("kural 3: hüküm dogrulama_durumu TODO_DOGRULA doğar", async () => {
    const art = await artifactEkle();
    const pid = await hukumEkle(art, "md. 26", "2020-01-01");
    const { rows } = await db.sql(`select dogrulama_durumu from public.provisions where id = $1`, [pid]);
    expect(rows[0].dogrulama_durumu).toBe("TODO_DOGRULA");
  });

  it("geçersiz dogrulama_durumu reddedilir (check constraint)", async () => {
    const art = await artifactEkle();
    await expect(hukumEkle(art, "md. 26", "2020-01-01", { dogrulama_durumu: "UYDURMA" })).rejects.toThrow();
  });

  it("valid-time tutarsızlığı reddedilir (effective_to < effective_from)", async () => {
    const art = await artifactEkle();
    await expect(
      hukumEkle(art, "md. 26", "2020-01-01", { effective_to: "2019-01-01" }),
    ).rejects.toThrow();
  });

  it("aynı mantıksal hükmün aynı yürürlük diliminden İKİ güncel kayıt olamaz", async () => {
    const art = await artifactEkle();
    await hukumEkle(art, "md. 26", "2020-01-01");
    await expect(hukumEkle(art, "md. 26", "2020-01-01")).rejects.toThrow();
  });

  it("farklı yürürlük dilimleri (farklı effective_from) güncelde bir arada durur", async () => {
    const art = await artifactEkle();
    await hukumEkle(art, "md. 26", "2020-01-01", { effective_to: "2021-12-31" });
    await hukumEkle(art, "md. 26", "2022-01-01"); // ikinci dilim
    const { rows } = await db.sql(
      `select count(*)::int as n from public.provisions where source_artifact_id = $1 and provision_ref = 'md. 26' and system_to is null`,
      [art],
    );
    expect(rows[0].n).toBe(2);
  });

  it("system-time düzeltmesi: eski kaydı kapat → yeni kayıt aç; geçmiş silinmez", async () => {
    const art = await artifactEkle();
    const eski = await hukumEkle(art, "md. 26", "2020-01-01"); // yanlış yürürlük başlangıcı
    // Düzeltme: eski kaydın system_to'sunu kapat (fiziksel silme YOK).
    await db.sql(`update public.provisions set system_to = now() where id = $1`, [eski]);
    // Kapatıldığı için aynı dilimden yeni bir güncel kayıt artık açılabilir.
    const yeni = await hukumEkle(art, "md. 26", "2020-01-01");

    const { rows: guncel } = await db.sql(
      `select id from public.provisions where source_artifact_id = $1 and provision_ref = 'md. 26' and system_to is null`,
      [art],
    );
    expect(guncel).toHaveLength(1);
    expect(guncel[0].id).toBe(yeni);

    // Eski kayıt DURUYOR (geçmiş silinmedi), yalnızca kapalı.
    const { rows: hepsi } = await db.sql(
      `select count(*)::int as n from public.provisions where source_artifact_id = $1 and provision_ref = 'md. 26'`,
      [art],
    );
    expect(hepsi[0].n).toBe(2);
  });
});
