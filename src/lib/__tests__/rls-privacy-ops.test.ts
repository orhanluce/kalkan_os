// M36 (G6): PrivacyOps — cross-tenant, DSAR kimlik-doğrulama şartı, DPIA
// dört-göz, ROPA hukuki dayanak, veri minimizasyonu (maskeli+hash). PGlite.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, seedTwoTenants, type TestDb } from "./helpers/pg";

let db: TestDb;
let seed: Awaited<ReturnType<typeof seedTwoTenants>>;
const A_IKINCI = "a0000000-0000-0000-0000-000000000002";
const A_MISAFIR = "a0000000-0000-0000-0000-000000000009";

beforeEach(async () => {
  db = await createTestDb();
  seed = await seedTwoTenants(db);
  for (const [id, rol, ad] of [
    [A_IKINCI, "uyum", "İkinci"],
    [A_MISAFIR, "denetci_misafir", "Misafir"],
  ] as const) {
    await db.sql(`insert into auth.users (id, email) values ($1, $2)`, [id, `${ad}@demo.com`]);
    await db.sql(`insert into public.profiles (id, tenant_id, role, full_name) values ($1, $2, $3, $4)`, [id, seed.A.tenantId, rol, ad]);
  }
});

afterEach(async () => {
  await db.close();
});

async function ropaEkle(tenantId: string): Promise<string> {
  const { rows } = await db.sql(
    `insert into public.processing_activities (tenant_id, ad, amac, hukuki_dayanak) values ($1, 'Bordro', 'Maaş ödemesi', 'HUKUKI_YUKUMLULUK') returning id`,
    [tenantId],
  );
  return rows[0].id as string;
}

describe("PrivacyOps — RLS + invariant'lar (M36)", () => {
  it("cross-tenant: A'nın ROPA/DSAR'ını B GÖREMEZ; misafir YAZAMAZ", async () => {
    const id = await ropaEkle(seed.A.tenantId);
    const { rows: b } = await db.asUser(seed.B.userId, `select id from public.processing_activities where id = $1`, [id]);
    expect(b).toHaveLength(0);
    await expect(
      db.asUser(A_MISAFIR, `insert into public.processing_activities (tenant_id, ad, amac, hukuki_dayanak) values ($1, 'X', 'x', 'RIZA')`, [seed.A.tenantId]),
    ).rejects.toThrow();
  });

  it("ROPA geçersiz hukuki dayanak reddedilir (check)", async () => {
    await expect(
      db.sql(`insert into public.processing_activities (tenant_id, ad, amac, hukuki_dayanak) values ($1, 'X', 'x', 'UYDURMA')`, [seed.A.tenantId]),
    ).rejects.toThrow();
  });

  it("DSAR: kimlik doğrulanmadan TAMAMLANDI YASAK; doğrulanınca geçer + tamamlandi_at otomatik", async () => {
    const { rows: d } = await db.sql(
      `insert into public.data_subject_requests (tenant_id, tur, veri_sahibi_maskeli) values ($1, 'ERISIM', 'a***@x.com') returning id`,
      [seed.A.tenantId],
    );
    await expect(
      db.sql(`update public.data_subject_requests set durum = 'TAMAMLANDI' where id = $1`, [d[0].id]),
    ).rejects.toThrow(/kimlik dogrulama sart/);
    await db.sql(`update public.data_subject_requests set kimlik_dogrulandi = true where id = $1`, [d[0].id]);
    await db.sql(`update public.data_subject_requests set durum = 'TAMAMLANDI' where id = $1`, [d[0].id]);
    const { rows } = await db.sql(`select durum, tamamlandi_at from public.data_subject_requests where id = $1`, [d[0].id]);
    expect(rows[0].durum).toBe("TAMAMLANDI");
    expect(rows[0].tamamlandi_at).not.toBeNull();
  });

  it("DSAR hash biçimi zorlanır (64-hex ya da null — veri minimizasyonu)", async () => {
    await expect(
      db.sql(`insert into public.data_subject_requests (tenant_id, tur, veri_sahibi_maskeli, veri_sahibi_hash) values ($1, 'SILME', 'a***', 'kisa')`, [seed.A.tenantId]),
    ).rejects.toThrow();
  });

  it("DPIA dört-göz: hazırlayan kendi değerlendirmesini TAMAMLAYAMAZ", async () => {
    const paId = await ropaEkle(seed.A.tenantId);
    const { rows: as } = await db.sql(
      `insert into public.privacy_assessments (tenant_id, processing_activity_id, tur, hazirlayan) values ($1, $2, 'DPIA', $3) returning id`,
      [seed.A.tenantId, paId, seed.A.userId],
    );
    // Aynı kişi onaylayan → dört göz reddi.
    await expect(
      db.sql(`update public.privacy_assessments set durum = 'TAMAMLANDI', sonuc = 'ok', onaylayan = $2, onay_zamani = now() where id = $1`, [as[0].id, seed.A.userId]),
    ).rejects.toThrow(/dort goz/);
    // Farklı onaylayan geçer.
    await db.sql(`update public.privacy_assessments set durum = 'TAMAMLANDI', sonuc = 'ok', onaylayan = $2, onay_zamani = now() where id = $1`, [as[0].id, A_IKINCI]);
    const { rows } = await db.sql(`select durum from public.privacy_assessments where id = $1`, [as[0].id]);
    expect(rows[0].durum).toBe("TAMAMLANDI");
  });

  it("ihlal: tespit zamanı zorunlu; durum değişimi audit'e düşer", async () => {
    const { rows: inc } = await db.sql(
      `insert into public.privacy_incidents (tenant_id, ozet, tespit_at, siniflandirma) values ($1, 'sızıntı', now(), 'YUKSEK') returning id`,
      [seed.A.tenantId],
    );
    await db.sql(`update public.privacy_incidents set durum = 'DEGERLENDIRILIYOR' where id = $1`, [inc[0].id]);
    const { rows } = await db.sql(`select eylem from public.audit_log where hedef_tablo = 'privacy_incidents' and hedef_id = $1 order by created_at`, [inc[0].id]);
    expect(rows.map((r) => r.eylem)).toEqual(["ihlal_olusturuldu", "ihlal_durum_degisti"]);
  });

  it("ROPA kaynak soyu: doğrulanmamış hükme bağlanabilir, hükmü doğrulamaz", async () => {
    const { rows: s } = await db.sql(
      `insert into public.regulatory_sources (authority, jurisdiction, kaynak_seviyesi, ad, erisim_politikasi_durumu) values ('KVKK', 'TR', 'A', 'KVKK', 'manuel') returning id`,
    );
    const { rows: a } = await db.sql(`insert into public.source_artifacts (source_id, baslik, sha256) values ($1, 'Kanun', $2) returning id`, [s[0].id, "a".repeat(64)]);
    const { rows: p } = await db.sql(`insert into public.provisions (source_artifact_id, provision_ref, metin, effective_from) values ($1, 'md.6', 'x', '2016-04-07') returning id`, [a[0].id]);
    await db.sql(
      `insert into public.processing_activities (tenant_id, ad, amac, hukuki_dayanak, dayanak_provision_id) values ($1, 'X', 'x', 'HUKUKI_YUKUMLULUK', $2)`,
      [seed.A.tenantId, p[0].id],
    );
    const { rows } = await db.sql(`select dogrulama_durumu from public.provisions where id = $1`, [p[0].id]);
    expect(rows[0].dogrulama_durumu).toBe("TODO_DOGRULA");
  });
});
