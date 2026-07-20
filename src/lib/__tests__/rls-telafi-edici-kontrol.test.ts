// Dikey E, E2, Kapı 2 (20260720290000): assessment_finding_compensating_
// controls — durum makinesi, maker-checker, immutable alanlar, cron.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, seedTwoTenants, type TestDb } from "./helpers/pg";

let db: TestDb;
let seed: Awaited<ReturnType<typeof seedTwoTenants>>;
const A_HAZIRLAYAN = "a0000000-0000-0000-0000-000000000050";
const A_INCELEYEN = "a0000000-0000-0000-0000-000000000051";

async function tedarikci(tenantId: string, ad: string) {
  const { rows } = await db.sql(`insert into public.third_parties (tenant_id, ad) values ($1, $2) returning id`, [tenantId, ad]);
  return rows[0].id as string;
}
async function bulguAc(tenantId: string, ciddiyet = "KRITIK", sahibi: string | null = null) {
  const tp = await tedarikci(tenantId, "V");
  const { rows: a } = await db.sql(
    `insert into public.third_party_assessments (tenant_id, third_party_id) values ($1, $2) returning id`,
    [tenantId, tp],
  );
  const { rows: f } = await db.sql(
    `insert into public.assessment_findings (tenant_id, assessment_id, third_party_id, baslik, ciddiyet, sahibi) values ($1, $2, $3, 'B', $4, $5) returning id`,
    [tenantId, a[0].id, tp, ciddiyet, sahibi],
  );
  return f[0].id as string;
}
async function testRunEkle(tenantId: string, controlId: string, sonuc = "PASSED", gecerlilikBitis: string | null = null) {
  // Kanıt zarfı zorunlu (M9/M11 guard) — minimal geçerli zarf.
  const { rows: ev } = gecerlilikBitis
    ? await db.sql(
        `insert into public.evidences
           (tenant_id, control_id, tip, hash_sha256, mime_type, file_size, classification, retention_class, envelope_schema_version, gecerlilik_bitis)
         values ($1, $2, 'dosya', $3, 'application/pdf', 1024, 'gizli', '10y', 'KALKAN_EVIDENCE_ENVELOPE_V1', $4) returning id`,
        [tenantId, controlId, "ab".repeat(32), gecerlilikBitis],
      )
    : { rows: [{ id: null }] };
  const { rows: tr } = await db.sql(
    `insert into public.control_test_definitions (tenant_id, control_id, tur, ad) values ($1, $2, 'MANUAL_PROCEDURE', 'Test') returning id`,
    [tenantId, controlId],
  );
  const { rows: run } = await db.sql(
    `insert into public.test_runs (tenant_id, test_definition_id, control_id, sonuc, gerekce, tanim_surumu, evidence_id)
     values ($1, $2, $3, $4, 'test', 1, $5) returning id`,
    [tenantId, tr[0].id, controlId, sonuc, ev[0].id],
  );
  return run[0].id as string;
}
async function ccOlustur(
  tenantId: string,
  findingId: string,
  controlId: string,
  testRunId: string,
  submittedBy: string,
  extra: Record<string, unknown> = {},
) {
  const { rows } = await db.asUser(
    submittedBy,
    `insert into public.assessment_finding_compensating_controls
       (tenant_id, assessment_finding_id, control_id, test_run_id, gerekce, valid_from, valid_until, submitted_by)
     values ($1, $2, $3, $4, $5, $6, $7, $8) returning id, submitted_by`,
    [
      tenantId,
      findingId,
      controlId,
      testRunId,
      (extra.gerekce as string) ?? "gerekce",
      (extra.valid_from as string) ?? "2026-01-01",
      (extra.valid_until as string) ?? "2027-01-01",
      (extra.submitted_by_override as string) ?? submittedBy,
    ],
  );
  return rows[0] as { id: string; submitted_by: string };
}

beforeEach(async () => {
  db = await createTestDb();
  seed = await seedTwoTenants(db);
  for (const [id, email, role] of [
    [A_HAZIRLAYAN, "hazirlayan@demo.com", "uyum"],
    [A_INCELEYEN, "inceleyen@demo.com", "uyum"],
  ] as const) {
    await db.sql(`insert into auth.users (id, email) values ($1, $2)`, [id, email]);
    await db.sql(`insert into public.profiles (id, tenant_id, role, full_name) values ($1, $2, $3, 'T')`, [id, seed.A.tenantId, role]);
  }
});
afterEach(async () => {
  await db.close();
});

describe("assessment_finding_compensating_controls — INSERT guard", () => {
  it("kimlik atfı: submitted_by istemciden GÜVENİLMEZ, oturum sahibine sabitlenir", async () => {
    const f = await bulguAc(seed.A.tenantId);
    const run = await testRunEkle(seed.A.tenantId, seed.controlId);
    // A_HAZIRLAYAN oturumuyla, submitted_by A_INCELEYEN gibi göndermeye çalış.
    const cc = await ccOlustur(seed.A.tenantId, f, seed.controlId, run, A_HAZIRLAYAN, { submitted_by_override: A_INCELEYEN });
    expect(cc.submitted_by).toBe(A_HAZIRLAYAN);
  });

  it("submitted_by NULL ise (oturumsuz) reddedilir", async () => {
    const f = await bulguAc(seed.A.tenantId);
    const run = await testRunEkle(seed.A.tenantId, seed.controlId);
    await expect(
      db.sql(
        `insert into public.assessment_finding_compensating_controls
           (tenant_id, assessment_finding_id, control_id, test_run_id, gerekce, valid_from, valid_until)
         values ($1, $2, $3, $4, 'g', '2026-01-01', '2027-01-01')`,
        [seed.A.tenantId, f, seed.controlId, run],
      ),
    ).rejects.toThrow(/submitted_by zorunlu/);
  });

  it("doğrudan AKTIF insert reddedilir", async () => {
    const f = await bulguAc(seed.A.tenantId);
    const run = await testRunEkle(seed.A.tenantId, seed.controlId);
    await expect(
      db.sql(
        `insert into public.assessment_finding_compensating_controls
           (tenant_id, assessment_finding_id, control_id, test_run_id, gerekce, valid_from, valid_until, durum, submitted_by)
         values ($1, $2, $3, $4, 'g', '2026-01-01', '2027-01-01', 'AKTIF', $5)`,
        [seed.A.tenantId, f, seed.controlId, run, A_HAZIRLAYAN],
      ),
    ).rejects.toThrow(/yalnizca TASLAK olarak/);
  });

  it("cross-tenant assessment_finding_id reddedilir", async () => {
    const fB = await bulguAc(seed.B.tenantId);
    const runA = await testRunEkle(seed.A.tenantId, seed.controlId);
    await expect(ccOlustur(seed.A.tenantId, fB, seed.controlId, runA, A_HAZIRLAYAN)).rejects.toThrow(/cross-tenant/i);
  });

  it("cross-tenant test_run_id reddedilir", async () => {
    const fA = await bulguAc(seed.A.tenantId);
    const runB = await testRunEkle(seed.B.tenantId, seed.controlId);
    await expect(ccOlustur(seed.A.tenantId, fA, seed.controlId, runB, A_HAZIRLAYAN)).rejects.toThrow(/cross-tenant/i);
  });

  it("test koşusu seçilen kontrole ait değilse reddedilir (uyumsuzluk)", async () => {
    const fA = await bulguAc(seed.A.tenantId);
    const { rows: baskaKontrol } = await db.sql(
      `insert into public.controls (framework_id, madde_ref, baslik, periyot, kritiklik) values ($1, 'BASKA-01', 'Başka', 'yillik', 3) returning id`,
      [seed.frameworkId],
    );
    const run = await testRunEkle(seed.A.tenantId, seed.controlId); // run kendi kontrolüne bağlı
    await expect(ccOlustur(seed.A.tenantId, fA, baskaKontrol[0].id as string, run, A_HAZIRLAYAN)).rejects.toThrow(/uyumsuzlugu/);
  });

  it("service_role (RLS-bypass) kimlik atfını atlayamaz — submitted_by yine de zorunlu", async () => {
    const f = await bulguAc(seed.A.tenantId);
    const run = await testRunEkle(seed.A.tenantId, seed.controlId);
    await expect(
      db.sql(
        `insert into public.assessment_finding_compensating_controls
           (tenant_id, assessment_finding_id, control_id, test_run_id, gerekce, valid_from, valid_until, submitted_by)
         values ($1, $2, $3, $4, 'g', '2026-01-01', '2027-01-01', null)`,
        [seed.A.tenantId, f, seed.controlId, run],
      ),
    ).rejects.toThrow(/submitted_by zorunlu/);
  });
});

describe("assessment_finding_compensating_controls — durum makinesi", () => {
  it("TASLAK → AKTIF atlayarak geçiş reddedilir", async () => {
    const f = await bulguAc(seed.A.tenantId);
    const run = await testRunEkle(seed.A.tenantId, seed.controlId);
    const cc = await ccOlustur(seed.A.tenantId, f, seed.controlId, run, A_HAZIRLAYAN);
    await expect(
      db.sql(`update public.assessment_finding_compensating_controls set durum = 'AKTIF', reviewed_by = $2 where id = $1`, [cc.id, A_INCELEYEN]),
    ).rejects.toThrow(/yalnizca INCELEMEDE/);
  });

  it("hazırlayan kendi telafi edici kontrolünü aktive edemez (submitter = reviewer)", async () => {
    const f = await bulguAc(seed.A.tenantId);
    const run = await testRunEkle(seed.A.tenantId, seed.controlId);
    const cc = await ccOlustur(seed.A.tenantId, f, seed.controlId, run, A_HAZIRLAYAN);
    await db.sql(`update public.assessment_finding_compensating_controls set durum = 'INCELEMEDE' where id = $1`, [cc.id]);
    await expect(
      db.sql(`update public.assessment_finding_compensating_controls set durum = 'AKTIF', reviewed_by = $2 where id = $1`, [cc.id, A_HAZIRLAYAN]),
    ).rejects.toThrow(/kendi telafi edici kontrolunu aktive edemez/);
  });

  it("reviewed_by NULL ise AKTIF reddedilir", async () => {
    const f = await bulguAc(seed.A.tenantId);
    const run = await testRunEkle(seed.A.tenantId, seed.controlId);
    const cc = await ccOlustur(seed.A.tenantId, f, seed.controlId, run, A_HAZIRLAYAN);
    await db.sql(`update public.assessment_finding_compensating_controls set durum = 'INCELEMEDE' where id = $1`, [cc.id]);
    await expect(
      db.sql(`update public.assessment_finding_compensating_controls set durum = 'AKTIF' where id = $1`, [cc.id]),
    ).rejects.toThrow(/reviewed_by.*zorunlu/);
  });

  it("test sonucu FAILED ise AKTIF reddedilir", async () => {
    const f = await bulguAc(seed.A.tenantId);
    const run = await testRunEkle(seed.A.tenantId, seed.controlId, "FAILED");
    const cc = await ccOlustur(seed.A.tenantId, f, seed.controlId, run, A_HAZIRLAYAN);
    await db.sql(`update public.assessment_finding_compensating_controls set durum = 'INCELEMEDE' where id = $1`, [cc.id]);
    await expect(
      db.asUser(A_INCELEYEN, `update public.assessment_finding_compensating_controls set durum = 'AKTIF', reviewed_by = $2 where id = $1`, [cc.id, A_INCELEYEN]),
    ).rejects.toThrow(/PASSED degil/);
  });

  it("test sonucu UNKNOWN ise AKTIF reddedilir (olumlu kabul edilmez)", async () => {
    const f = await bulguAc(seed.A.tenantId);
    const run = await testRunEkle(seed.A.tenantId, seed.controlId, "UNKNOWN");
    const cc = await ccOlustur(seed.A.tenantId, f, seed.controlId, run, A_HAZIRLAYAN);
    await db.sql(`update public.assessment_finding_compensating_controls set durum = 'INCELEMEDE' where id = $1`, [cc.id]);
    await expect(
      db.asUser(A_INCELEYEN, `update public.assessment_finding_compensating_controls set durum = 'AKTIF', reviewed_by = $2 where id = $1`, [cc.id, A_INCELEYEN]),
    ).rejects.toThrow(/PASSED degil/);
  });

  it("kanıt süresi geçmişse AKTIF reddedilir", async () => {
    const f = await bulguAc(seed.A.tenantId);
    const run = await testRunEkle(seed.A.tenantId, seed.controlId, "PASSED", "2020-01-01");
    const cc = await ccOlustur(seed.A.tenantId, f, seed.controlId, run, A_HAZIRLAYAN);
    await db.sql(`update public.assessment_finding_compensating_controls set durum = 'INCELEMEDE' where id = $1`, [cc.id]);
    await expect(
      db.asUser(A_INCELEYEN, `update public.assessment_finding_compensating_controls set durum = 'AKTIF', reviewed_by = $2 where id = $1`, [cc.id, A_INCELEYEN]),
    ).rejects.toThrow(/kanitin suresi gecmis/);
  });

  it("valid_until geçmişse AKTIF reddedilir", async () => {
    const f = await bulguAc(seed.A.tenantId);
    const run = await testRunEkle(seed.A.tenantId, seed.controlId);
    const cc = await ccOlustur(seed.A.tenantId, f, seed.controlId, run, A_HAZIRLAYAN, { valid_from: "2020-01-01", valid_until: "2020-06-01" });
    await db.sql(`update public.assessment_finding_compensating_controls set durum = 'INCELEMEDE' where id = $1`, [cc.id]);
    await expect(
      db.asUser(A_INCELEYEN, `update public.assessment_finding_compensating_controls set durum = 'AKTIF', reviewed_by = $2 where id = $1`, [cc.id, A_INCELEYEN]),
    ).rejects.toThrow(/gecerlilik bitis tarihi gecmis/);
  });

  it("bağlı bulgu zaten KAPANDI ise AKTIF reddedilir", async () => {
    const f = await bulguAc(seed.A.tenantId, "KRITIK", A_HAZIRLAYAN);
    await db.asUser(
      A_INCELEYEN,
      `update public.assessment_findings set durum = 'KAPANDI', kapanis_kanit = 'x', kapatan = $2, kapanis_zamani = now() where id = $1`,
      [f, A_INCELEYEN],
    );
    const run = await testRunEkle(seed.A.tenantId, seed.controlId);
    const cc = await ccOlustur(seed.A.tenantId, f, seed.controlId, run, A_HAZIRLAYAN);
    await db.sql(`update public.assessment_finding_compensating_controls set durum = 'INCELEMEDE' where id = $1`, [cc.id]);
    await expect(
      db.asUser(A_INCELEYEN, `update public.assessment_finding_compensating_controls set durum = 'AKTIF', reviewed_by = $2 where id = $1`, [cc.id, A_INCELEYEN]),
    ).rejects.toThrow(/zaten KAPANDI/);
  });

  it("farklı yetkili geçerli koşullarla AKTIF yapabilir", async () => {
    const f = await bulguAc(seed.A.tenantId);
    const run = await testRunEkle(seed.A.tenantId, seed.controlId);
    const cc = await ccOlustur(seed.A.tenantId, f, seed.controlId, run, A_HAZIRLAYAN);
    await db.sql(`update public.assessment_finding_compensating_controls set durum = 'INCELEMEDE' where id = $1`, [cc.id]);
    await db.asUser(A_INCELEYEN, `update public.assessment_finding_compensating_controls set durum = 'AKTIF', reviewed_by = $2 where id = $1`, [cc.id, A_INCELEYEN]);
    const { rows } = await db.sql(`select durum, reviewed_at from public.assessment_finding_compensating_controls where id = $1`, [cc.id]);
    expect(rows[0].durum).toBe("AKTIF");
    expect(rows[0].reviewed_at).not.toBeNull();
  });

  it("AKTIF olmuş kaydın control_id/test_run_id/valid_until/gerekce'si bir daha değiştirilemez", async () => {
    const f = await bulguAc(seed.A.tenantId);
    const run = await testRunEkle(seed.A.tenantId, seed.controlId);
    const run2 = await testRunEkle(seed.A.tenantId, seed.controlId);
    const cc = await ccOlustur(seed.A.tenantId, f, seed.controlId, run, A_HAZIRLAYAN);
    await db.sql(`update public.assessment_finding_compensating_controls set durum = 'INCELEMEDE' where id = $1`, [cc.id]);
    await db.asUser(A_INCELEYEN, `update public.assessment_finding_compensating_controls set durum = 'AKTIF', reviewed_by = $2 where id = $1`, [cc.id, A_INCELEYEN]);
    await expect(
      db.sql(`update public.assessment_finding_compensating_controls set test_run_id = $2 where id = $1`, [cc.id, run2]),
    ).rejects.toThrow(/cekirdek alanlari degistirilemez/);
    await expect(
      db.sql(`update public.assessment_finding_compensating_controls set valid_until = '2030-01-01' where id = $1`, [cc.id]),
    ).rejects.toThrow(/cekirdek alanlari degistirilemez/);
  });

  it("reddedilmiş kayıt sessizce tekrar aktif hale getirilemez (terminal donuk)", async () => {
    const f = await bulguAc(seed.A.tenantId);
    const run = await testRunEkle(seed.A.tenantId, seed.controlId);
    const cc = await ccOlustur(seed.A.tenantId, f, seed.controlId, run, A_HAZIRLAYAN);
    await db.sql(`update public.assessment_finding_compensating_controls set durum = 'INCELEMEDE' where id = $1`, [cc.id]);
    await db.asUser(
      A_INCELEYEN,
      `update public.assessment_finding_compensating_controls set durum = 'REDDEDILDI', reviewed_by = $2, red_gerekcesi = 'yetersiz' where id = $1`,
      [cc.id, A_INCELEYEN],
    );
    await expect(
      db.asUser(A_INCELEYEN, `update public.assessment_finding_compensating_controls set durum = 'AKTIF', reviewed_by = $2 where id = $1`, [cc.id, A_INCELEYEN]),
    ).rejects.toThrow(/donusturulemez|donuk kayit/i);
  });

  it("iptal edilmiş kayıt yeniden AKTIF yapılamaz — yeni telafi kaydı gerekir", async () => {
    const f = await bulguAc(seed.A.tenantId);
    const run = await testRunEkle(seed.A.tenantId, seed.controlId);
    const cc = await ccOlustur(seed.A.tenantId, f, seed.controlId, run, A_HAZIRLAYAN);
    await db.asUser(
      A_HAZIRLAYAN,
      `update public.assessment_finding_compensating_controls set durum = 'IPTAL_EDILDI', revoked_by = $2, revocation_reason = 'vazgecildi' where id = $1`,
      [cc.id, A_HAZIRLAYAN],
    );
    await expect(
      db.sql(`update public.assessment_finding_compensating_controls set durum = 'INCELEMEDE' where id = $1`, [cc.id]),
    ).rejects.toThrow(/donuk kayit/);

    // Yeni kayıt, öncekine zincirlenir.
    const { rows: yeni } = await db.sql(
      `insert into public.assessment_finding_compensating_controls
         (tenant_id, assessment_finding_id, control_id, test_run_id, gerekce, valid_from, valid_until, submitted_by, onceki_id)
       values ($1, $2, $3, $4, 'yeni', '2026-01-01', '2027-01-01', $5, $6) returning id`,
      [seed.A.tenantId, f, seed.controlId, run, A_HAZIRLAYAN, cc.id],
    );
    expect(yeni).toHaveLength(1);
  });

  it("REDDEDILDI: hazırlayan kendi kendini reddedemez, gerekçesiz reddedilemez", async () => {
    const f = await bulguAc(seed.A.tenantId);
    const run = await testRunEkle(seed.A.tenantId, seed.controlId);
    const cc = await ccOlustur(seed.A.tenantId, f, seed.controlId, run, A_HAZIRLAYAN);
    await db.sql(`update public.assessment_finding_compensating_controls set durum = 'INCELEMEDE' where id = $1`, [cc.id]);
    await expect(
      db.asUser(
        A_HAZIRLAYAN,
        `update public.assessment_finding_compensating_controls set durum = 'REDDEDILDI', reviewed_by = $2, red_gerekcesi = 'x' where id = $1`,
        [cc.id, A_HAZIRLAYAN],
      ),
    ).rejects.toThrow(/kendi telafi edici kontrolunu reddedemez/);
    await expect(
      db.asUser(A_INCELEYEN, `update public.assessment_finding_compensating_controls set durum = 'REDDEDILDI', reviewed_by = $2 where id = $1`, [cc.id, A_INCELEYEN]),
    ).rejects.toThrow(/red gerekcesi zorunlu/);
  });

  it("IPTAL_EDILDI: gerekçesiz iptal edilemez", async () => {
    const f = await bulguAc(seed.A.tenantId);
    const run = await testRunEkle(seed.A.tenantId, seed.controlId);
    const cc = await ccOlustur(seed.A.tenantId, f, seed.controlId, run, A_HAZIRLAYAN);
    await expect(
      db.sql(`update public.assessment_finding_compensating_controls set durum = 'IPTAL_EDILDI', revoked_by = $2 where id = $1`, [cc.id, A_HAZIRLAYAN]),
    ).rejects.toThrow(/iptal nedeni zorunlu/);
  });

  it("tenant_id ve submitted_by hiçbir zaman değiştirilemez", async () => {
    const f = await bulguAc(seed.A.tenantId);
    const run = await testRunEkle(seed.A.tenantId, seed.controlId);
    const cc = await ccOlustur(seed.A.tenantId, f, seed.controlId, run, A_HAZIRLAYAN);
    await expect(
      db.sql(`update public.assessment_finding_compensating_controls set submitted_by = $2 where id = $1`, [cc.id, A_INCELEYEN]),
    ).rejects.toThrow(/submitted_by degistirilemez/);
    await expect(
      db.sql(`update public.assessment_finding_compensating_controls set tenant_id = $2 where id = $1`, [cc.id, seed.B.tenantId]),
    ).rejects.toThrow(/tenant_id degistirilemez/);
  });
});

describe("assessment_finding_compensating_controls — RLS + audit", () => {
  it("cross-tenant: B, A'nın telafi kaydını göremez", async () => {
    const f = await bulguAc(seed.A.tenantId);
    const run = await testRunEkle(seed.A.tenantId, seed.controlId);
    const cc = await ccOlustur(seed.A.tenantId, f, seed.controlId, run, A_HAZIRLAYAN);
    const { rows } = await db.asUser(seed.B.userId, `select id from public.assessment_finding_compensating_controls where id = $1`, [cc.id]);
    expect(rows).toHaveLength(0);
  });

  it("oluşturma ve durum değişimi audit_log'a düşer", async () => {
    const f = await bulguAc(seed.A.tenantId);
    const run = await testRunEkle(seed.A.tenantId, seed.controlId);
    const cc = await ccOlustur(seed.A.tenantId, f, seed.controlId, run, A_HAZIRLAYAN);
    await db.sql(`update public.assessment_finding_compensating_controls set durum = 'INCELEMEDE' where id = $1`, [cc.id]);
    const { rows } = await db.sql(
      `select eylem from public.audit_log where hedef_id = $1 order by created_at`,
      [cc.id],
    );
    expect(rows.map((r) => r.eylem)).toEqual(["telafi_edici_kontrol_olusturuldu", "telafi_edici_kontrol_durum_degisti"]);
  });
});

describe("assessment_finding_cc_suresi_dolanlari_isle — idempotent süre dolumu", () => {
  it("süresi dolmuş AKTIF kayıt SURESI_DOLDU'ya düşer, tekrar çalıştırma ek etki üretmez", async () => {
    // Guard, valid_until <= current_date iken AKTIF'e geçişi ZATEN reddeder
    // (yukarıdaki "valid_until geçmişse AKTIF reddedilir" testi) — yani
    // GERÇEKTEN süresi dolmuş bir AKTIF kayıt yalnızca ZAMANIN GEÇMESİYLE
    // oluşabilir. Gerçek zaman beklemek yerine (kurucunun kendi ilkesi,
    // e2e için de geçerli), kaydı guard'ı GEÇİCİ devre dışı bırakarak zaten-
    // süresi-dolmuş bir AKTIF durumla tohumluyoruz — burada guard'ın kendisi
    // DEĞİL, cron fonksiyonunun kendi mantığı test ediliyor (guard ayrı
    // testlerde zaten kanıtlı).
    const f = await bulguAc(seed.A.tenantId);
    const run = await testRunEkle(seed.A.tenantId, seed.controlId);
    await db.sql(`alter table public.assessment_finding_compensating_controls disable trigger afcc_insert_guard_trg`);
    await db.sql(`alter table public.assessment_finding_compensating_controls disable trigger afcc_durum_guard_trg`);
    const { rows: cc } = await db.sql(
      `insert into public.assessment_finding_compensating_controls
         (tenant_id, assessment_finding_id, control_id, test_run_id, gerekce, valid_from, valid_until, durum, submitted_by, reviewed_by, reviewed_at)
       values ($1, $2, $3, $4, 'g', '2020-01-01', '2020-06-01', 'AKTIF', $5, $6, now()) returning id`,
      [seed.A.tenantId, f, seed.controlId, run, A_HAZIRLAYAN, A_INCELEYEN],
    );
    await db.sql(`alter table public.assessment_finding_compensating_controls enable trigger afcc_insert_guard_trg`);
    await db.sql(`alter table public.assessment_finding_compensating_controls enable trigger afcc_durum_guard_trg`);

    const { rows: n1 } = await db.sql(`select public.assessment_finding_cc_suresi_dolanlari_isle() as n`);
    expect(n1[0].n).toBe(1);
    const { rows } = await db.sql(`select durum from public.assessment_finding_compensating_controls where id = $1`, [cc[0].id]);
    expect(rows[0].durum).toBe("SURESI_DOLDU");

    const { rows: n2 } = await db.sql(`select public.assessment_finding_cc_suresi_dolanlari_isle() as n`);
    expect(n2[0].n).toBe(0); // idempotent — ikinci koşu ek etki üretmez
  });
});
