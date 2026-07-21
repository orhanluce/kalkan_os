// Dikey F, F5 (docs/adr/PR0-dikeyF-f5-kurtarma-karsilastirmasi-2026-07-21.md):
// test_run_recovery_comparisons — immutable, supersede zinciri, cross-tenant
// + kritik-hizmet-bağlantısı guard'ları, merkezi "güncel karşılaştırma"
// sözleşmesi (test_run_kurtarma_karsilastirmasi_guncel).
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, seedTwoTenants, type TestDb } from "./helpers/pg";

let db: TestDb;
let seed: Awaited<ReturnType<typeof seedTwoTenants>>;

const OLCUM = JSON.stringify({ schema: "WARDPROOF_TEST_RUN_RECOVERY_MEASUREMENT_V1", comparisonPerformed: false });
const HASH = "a".repeat(64);
const KARSILASTIRMA = JSON.stringify({ schema: "WARDPROOF_TEST_RUN_RECOVERY_COMPARISON_V1" });
const CMP_HASH = "b".repeat(64);

async function hizmetEkle(tenantId: string, ad = "Ödeme Sistemi"): Promise<string> {
  const { rows } = await db.sql(`insert into public.critical_business_services (tenant_id, ad) values ($1, $2) returning id`, [tenantId, ad]);
  return rows[0].id as string;
}

/** DIRECT bağlı test tanımı + PASSED koşu döner. */
async function kosuKur(tenantId: string, controlId: string, serviceId: string): Promise<string> {
  const { rows: d } = await db.sql(
    `insert into public.control_test_definitions (tenant_id, control_id, tur, ad, critical_service_id) values ($1, $2, 'RESTORE_TEST', 'Yedekten geri yükleme', $3) returning id`,
    [tenantId, controlId, serviceId],
  );
  const { rows: r } = await db.sql(
    `insert into public.test_runs (tenant_id, test_definition_id, control_id, sonuc, gerekce, tanim_surumu) values ($1, $2, $3, 'PASSED', 'ok', 1) returning id`,
    [tenantId, d[0].id, controlId],
  );
  return r[0].id as string;
}

async function olcumEkle(tenantId: string, runId: string, userId: string): Promise<string> {
  const { rows } = await db.asUser(
    userId,
    `insert into public.test_run_recovery_measurements
      (tenant_id, test_run_id, olcum_kaynagi, girdi_modu, kesinti_baslangic_at, hizmet_geri_geldi_at, olcum, olcum_hash, measured_at)
     values ($1,$2,'MANUEL_BEYAN','EVENT_TIMESTAMPS','2026-07-10T08:00:00Z','2026-07-10T12:00:00Z',$3::jsonb,$4,'2026-07-10T12:00:00Z') returning id`,
    [tenantId, runId, OLCUM, HASH],
  );
  return rows[0].id as string;
}

async function toleransYururlukte(tenantId: string, serviceId: string, userId: string, surum = 1): Promise<string> {
  const { rows } = await db.sql(
    `insert into public.impact_tolerances (tenant_id, critical_service_id, surum, max_kesinti_saat, max_veri_kaybi_saat, durum, yonetim_onayi, onaylayan, onay_zamani)
     values ($1, $2, $3, 4, 2, 'YURURLUKTE', true, $4, '2026-01-01T00:00:00Z') returning id`,
    [tenantId, serviceId, surum, userId],
  );
  return rows[0].id as string;
}

async function karsilastirmaEkle(
  tenantId: string,
  runId: string,
  measurementId: string,
  toleranceId: string,
  serviceId: string,
  userId: string,
  extra: Record<string, unknown> = {},
) {
  const cols = {
    tenant_id: tenantId,
    test_run_id: runId,
    recovery_measurement_id: measurementId,
    impact_tolerance_id: toleranceId,
    critical_service_id: serviceId,
    tolerans_max_kesinti_saat: 4,
    tolerans_max_veri_kaybi_saat: 2,
    tolerans_surumu: 1,
    rto_sonucu: "KARSILADI",
    rpo_sonucu: "KARSILADI",
    olcum_kaynagi: "MANUEL_BEYAN",
    karsilastirma: KARSILASTIRMA,
    karsilastirma_hash: CMP_HASH,
    ...extra,
  } as Record<string, unknown>;
  const jsonbKeys = new Set(["karsilastirma"]);
  const keys = Object.keys(cols);
  const colList = keys.join(", ");
  const valList = keys.map((k, i) => (jsonbKeys.has(k) ? `$${i + 1}::jsonb` : `$${i + 1}`)).join(", ");
  return db.asUser(userId, `insert into public.test_run_recovery_comparisons (${colList}) values (${valList}) returning id`, keys.map((k) => cols[k]));
}

beforeEach(async () => {
  db = await createTestDb();
  seed = await seedTwoTenants(db);
});
afterEach(async () => {
  await db.close();
});

describe("test_run_recovery_comparisons — cross-tenant + kritik-hizmet bağlantısı guard'ı", () => {
  it("mutlu yol: DIRECT bağlı koşu + eşleşen tolerans ile INSERT geçer + audit + outbox", async () => {
    const sid = await hizmetEkle(seed.A.tenantId);
    const run = await kosuKur(seed.A.tenantId, seed.controlId, sid);
    const mid = await olcumEkle(seed.A.tenantId, run, seed.A.userId);
    const tid = await toleransYururlukte(seed.A.tenantId, sid, seed.A.userId);
    const { rows } = await karsilastirmaEkle(seed.A.tenantId, run, mid, tid, sid, seed.A.userId);
    expect(rows[0].id).toBeTruthy();

    const { rows: audit } = await db.sql(`select count(*)::int as n from public.audit_log where eylem = 'kurtarma_karsilastirmasi_olusturuldu' and hedef_id = $1`, [rows[0].id]);
    expect(audit[0].n).toBe(1);
    const { rows: outbox } = await db.sql(`select statement_kind from public.ledger_outbox where artifact_table = 'test_run_recovery_comparisons' and artifact_id = $1`, [rows[0].id]);
    expect(outbox[0].statement_kind).toBe("RECOVERY_COMPARISON");
  });

  it("cross-tenant test_run reddedilir", async () => {
    const sidB = await hizmetEkle(seed.B.tenantId);
    const runB = await kosuKur(seed.B.tenantId, seed.controlId, sidB);
    const midB = await olcumEkle(seed.B.tenantId, runB, seed.B.userId);
    const tidB = await toleransYururlukte(seed.B.tenantId, sidB, seed.B.userId);
    await expect(karsilastirmaEkle(seed.A.tenantId, runB, midB, tidB, sidB, seed.A.userId)).rejects.toThrow(/cross-tenant/i);
  });

  it("recovery_measurement_id BAŞKA bir test_run'a aitse reddedilir", async () => {
    const sid = await hizmetEkle(seed.A.tenantId);
    const run1 = await kosuKur(seed.A.tenantId, seed.controlId, sid);
    const run2 = await kosuKur(seed.A.tenantId, seed.controlId, sid);
    const mid1 = await olcumEkle(seed.A.tenantId, run1, seed.A.userId);
    const tid = await toleransYururlukte(seed.A.tenantId, sid, seed.A.userId);
    await expect(karsilastirmaEkle(seed.A.tenantId, run2, mid1, tid, sid, seed.A.userId)).rejects.toThrow(/eslesmiyor/i);
  });

  it("impact_tolerance_id BAŞKA bir critical_service'e aitse reddedilir", async () => {
    const sid1 = await hizmetEkle(seed.A.tenantId, "Hizmet 1");
    const sid2 = await hizmetEkle(seed.A.tenantId, "Hizmet 2");
    const run = await kosuKur(seed.A.tenantId, seed.controlId, sid1);
    const mid = await olcumEkle(seed.A.tenantId, run, seed.A.userId);
    const tidYanlisHizmet = await toleransYururlukte(seed.A.tenantId, sid2, seed.A.userId);
    await expect(karsilastirmaEkle(seed.A.tenantId, run, mid, tidYanlisHizmet, sid1, seed.A.userId)).rejects.toThrow(/eslesmiyor/i);
  });

  it("test koşusu belirtilen kritik hizmete (DIRECT/VIA) BAĞLI DEĞİLSE reddedilir", async () => {
    const sidBagli = await hizmetEkle(seed.A.tenantId, "Bağlı Hizmet");
    const sidBagsiz = await hizmetEkle(seed.A.tenantId, "Bağsız Hizmet");
    // Koşu sidBagli'ye DIRECT bağlı — ama karşılaştırmada sidBagsiz kullanılacak.
    const run = await kosuKur(seed.A.tenantId, seed.controlId, sidBagli);
    const mid = await olcumEkle(seed.A.tenantId, run, seed.A.userId);
    const tid = await toleransYururlukte(seed.A.tenantId, sidBagsiz, seed.A.userId);
    await expect(karsilastirmaEkle(seed.A.tenantId, run, mid, tid, sidBagsiz, seed.A.userId)).rejects.toThrow(/bagli degil/i);
  });

  it("VIA_CRITICAL_SERVICE_CONTROL (dolaylı bağ) da GEÇERLİ kabul edilir", async () => {
    const sid = await hizmetEkle(seed.A.tenantId);
    // Yeni, kritik hizmete DIRECT bağlı OLMAYAN ayrı bir kontrol + tanım.
    const { rows: baskaKontrol } = await db.sql(
      `insert into public.controls (tenant_id, framework_id, madde_ref, baslik, periyot, kritiklik) values (null, $1, 'TODO-DOGRULA-VIA-01', 'Via kontrolü', 'yillik', 3) returning id`,
      [seed.frameworkId],
    ).catch(async () => db.sql(`insert into public.controls (framework_id, madde_ref, baslik, periyot, kritiklik) values ($1, 'TODO-DOGRULA-VIA-01', 'Via kontrolü', 'yillik', 3) returning id`, [seed.frameworkId]));
    const controlId = baskaKontrol[0].id as string;
    await db.sql(`insert into public.critical_service_controls (tenant_id, critical_service_id, control_id) values ($1, $2, $3)`, [seed.A.tenantId, sid, controlId]);
    const { rows: d } = await db.sql(
      `insert into public.control_test_definitions (tenant_id, control_id, tur, ad) values ($1, $2, 'RESTORE_TEST', 'Via testi') returning id`,
      [seed.A.tenantId, controlId],
    );
    const { rows: r } = await db.sql(
      `insert into public.test_runs (tenant_id, test_definition_id, control_id, sonuc, gerekce, tanim_surumu) values ($1, $2, $3, 'PASSED', 'ok', 1) returning id`,
      [seed.A.tenantId, d[0].id, controlId],
    );
    const run = r[0].id as string;
    const mid = await olcumEkle(seed.A.tenantId, run, seed.A.userId);
    const tid = await toleransYururlukte(seed.A.tenantId, sid, seed.A.userId);
    const { rows } = await karsilastirmaEkle(seed.A.tenantId, run, mid, tid, sid, seed.A.userId);
    expect(rows[0].id).toBeTruthy();
  });
});

describe("test_run_recovery_comparisons — immutability + supersede", () => {
  it("UPDATE service_role dahil reddedilir", async () => {
    const sid = await hizmetEkle(seed.A.tenantId);
    const run = await kosuKur(seed.A.tenantId, seed.controlId, sid);
    const mid = await olcumEkle(seed.A.tenantId, run, seed.A.userId);
    const tid = await toleransYururlukte(seed.A.tenantId, sid, seed.A.userId);
    const { rows } = await karsilastirmaEkle(seed.A.tenantId, run, mid, tid, sid, seed.A.userId);
    await expect(db.sql(`update public.test_run_recovery_comparisons set rto_sonucu = 'ASTI' where id = $1`, [rows[0].id])).rejects.toThrow(/degistirilemez/i);
  });

  it("kendini supersede eden kayıt reddedilir", async () => {
    const sid = await hizmetEkle(seed.A.tenantId);
    const run = await kosuKur(seed.A.tenantId, seed.controlId, sid);
    const mid = await olcumEkle(seed.A.tenantId, run, seed.A.userId);
    const tid = await toleransYururlukte(seed.A.tenantId, sid, seed.A.userId);
    const sabitId = "d1111111-1111-1111-1111-111111111111";
    await expect(karsilastirmaEkle(seed.A.tenantId, run, mid, tid, sid, seed.A.userId, { id: sabitId, supersedes_comparison_id: sabitId })).rejects.toThrow();
  });

  it("aynı kayıt iki kez supersede edilemez (lineer zincir)", async () => {
    const sid = await hizmetEkle(seed.A.tenantId);
    const run = await kosuKur(seed.A.tenantId, seed.controlId, sid);
    const mid = await olcumEkle(seed.A.tenantId, run, seed.A.userId);
    const tid = await toleransYururlukte(seed.A.tenantId, sid, seed.A.userId);
    const { rows: ilk } = await karsilastirmaEkle(seed.A.tenantId, run, mid, tid, sid, seed.A.userId);
    await karsilastirmaEkle(seed.A.tenantId, run, mid, tid, sid, seed.A.userId, { supersedes_comparison_id: ilk[0].id });
    await expect(karsilastirmaEkle(seed.A.tenantId, run, mid, tid, sid, seed.A.userId, { supersedes_comparison_id: ilk[0].id })).rejects.toThrow();
  });

  it("supersede edilen kayıt FARKLI test_run'a aitse reddedilir", async () => {
    const sid = await hizmetEkle(seed.A.tenantId);
    const run1 = await kosuKur(seed.A.tenantId, seed.controlId, sid);
    const run2 = await kosuKur(seed.A.tenantId, seed.controlId, sid);
    const mid1 = await olcumEkle(seed.A.tenantId, run1, seed.A.userId);
    const mid2 = await olcumEkle(seed.A.tenantId, run2, seed.A.userId);
    const tid = await toleransYururlukte(seed.A.tenantId, sid, seed.A.userId);
    const { rows: ilk } = await karsilastirmaEkle(seed.A.tenantId, run1, mid1, tid, sid, seed.A.userId);
    await expect(karsilastirmaEkle(seed.A.tenantId, run2, mid2, tid, sid, seed.A.userId, { supersedes_comparison_id: ilk[0].id })).rejects.toThrow(/ayni test kosusuna/i);
  });

  it("B kiracısı A'nın karşılaştırmasını GÖREMEZ", async () => {
    const sid = await hizmetEkle(seed.A.tenantId);
    const run = await kosuKur(seed.A.tenantId, seed.controlId, sid);
    const mid = await olcumEkle(seed.A.tenantId, run, seed.A.userId);
    const tid = await toleransYururlukte(seed.A.tenantId, sid, seed.A.userId);
    await karsilastirmaEkle(seed.A.tenantId, run, mid, tid, sid, seed.A.userId);
    const { rows } = await db.asUser(seed.B.userId, `select id from public.test_run_recovery_comparisons`);
    expect(rows).toHaveLength(0);
  });
});

describe("test_run_kurtarma_karsilastirmasi_guncel — merkezi sözleşme", () => {
  async function guncelOku(runId: string, tenantId: string) {
    const { rows } = await db.sql(`select * from public.test_run_kurtarma_karsilastirmasi_guncel($1, $2)`, [runId, tenantId]);
    return rows[0] as Record<string, unknown>;
  }

  it("GUNCEL_KAYIT_VAR: tek kayıt doğru döner", async () => {
    const sid = await hizmetEkle(seed.A.tenantId);
    const run = await kosuKur(seed.A.tenantId, seed.controlId, sid);
    const mid = await olcumEkle(seed.A.tenantId, run, seed.A.userId);
    const tid = await toleransYururlukte(seed.A.tenantId, sid, seed.A.userId);
    const { rows } = await karsilastirmaEkle(seed.A.tenantId, run, mid, tid, sid, seed.A.userId);
    const sonuc = await guncelOku(run, seed.A.tenantId);
    expect(sonuc.durum).toBe("GUNCEL_KAYIT_VAR");
    expect(sonuc.id).toBe(rows[0].id);
  });

  it("KAYIT_YOK: hiç karşılaştırma yoksa", async () => {
    const sid = await hizmetEkle(seed.A.tenantId);
    const run = await kosuKur(seed.A.tenantId, seed.controlId, sid);
    const sonuc = await guncelOku(run, seed.A.tenantId);
    expect(sonuc.durum).toBe("KAYIT_YOK");
  });

  it("supersede edilen kayıt güncel SAYILMAZ", async () => {
    const sid = await hizmetEkle(seed.A.tenantId);
    const run = await kosuKur(seed.A.tenantId, seed.controlId, sid);
    const mid = await olcumEkle(seed.A.tenantId, run, seed.A.userId);
    const tid = await toleransYururlukte(seed.A.tenantId, sid, seed.A.userId);
    const { rows: ilk } = await karsilastirmaEkle(seed.A.tenantId, run, mid, tid, sid, seed.A.userId);
    const { rows: ikinci } = await karsilastirmaEkle(seed.A.tenantId, run, mid, tid, sid, seed.A.userId, { supersedes_comparison_id: ilk[0].id });
    const sonuc = await guncelOku(run, seed.A.tenantId);
    expect(sonuc.id).toBe(ikinci[0].id);
  });

  it("BIRDEN_FAZLA_GUNCEL_KAYIT: iki bağımsız kök — rastgele seçilmez", async () => {
    const sid = await hizmetEkle(seed.A.tenantId);
    const run = await kosuKur(seed.A.tenantId, seed.controlId, sid);
    const mid = await olcumEkle(seed.A.tenantId, run, seed.A.userId);
    const tid = await toleransYururlukte(seed.A.tenantId, sid, seed.A.userId);
    await karsilastirmaEkle(seed.A.tenantId, run, mid, tid, sid, seed.A.userId);
    await karsilastirmaEkle(seed.A.tenantId, run, mid, tid, sid, seed.A.userId);
    const sonuc = await guncelOku(run, seed.A.tenantId);
    expect(sonuc.durum).toBe("BIRDEN_FAZLA_GUNCEL_KAYIT");
    expect(sonuc.id).toBeNull();
  });
});

describe("Proof Room — kurtarma karşılaştırması (Dikey F, F5)", () => {
  async function linkOlustur(userId: string, tenantId: string, runId: string): Promise<string> {
    const { rows } = await db.asUser(
      userId,
      `insert into public.proof_room_links (tenant_id, test_run_id, son_gecerlilik) values ($1, $2, now() + interval '1 day') returning token`,
      [tenantId, runId],
    );
    return rows[0].token as string;
  }

  it("güncel karşılaştırma minimize özet olarak döner (ham FK'ler YOK, 'karşılandı' YOK)", async () => {
    const sid = await hizmetEkle(seed.A.tenantId);
    const run = await kosuKur(seed.A.tenantId, seed.controlId, sid);
    const mid = await olcumEkle(seed.A.tenantId, run, seed.A.userId);
    const tid = await toleransYururlukte(seed.A.tenantId, sid, seed.A.userId);
    await karsilastirmaEkle(seed.A.tenantId, run, mid, tid, sid, seed.A.userId, {
      karsilastirma: JSON.stringify({ rto: { aciklama: "Beyan edilen değer hedefin içinde (3 saat / hedef 4 saat)." }, rpo: { aciklama: "Beyan edilen değer hedefin içinde (1 saat / hedef 2 saat)." } }),
    });
    const token = await linkOlustur(seed.A.userId, seed.A.tenantId, run);
    const { rows } = await db.asAnon(`select public.proof_room_goruntule($1) as v`, [token]);
    const v = rows[0].v as Record<string, unknown>;
    const k = v.kurtarmaKarsilastirmasi as Record<string, unknown>;
    expect(k.rtoSonucu).toBe("KARSILADI");
    expect(k.rpoSonucu).toBe("KARSILADI");
    expect(k.rtoAciklama).toContain("Beyan edilen değer");
    expect(Number(k.toleransMaxKesintiSaat)).toBe(4);
    const json = JSON.stringify(v);
    expect(json).not.toContain(mid); // recovery_measurement_id ham FK dönmez
    expect(json).not.toContain(tid); // impact_tolerance_id ham FK dönmez
    expect(json).not.toContain("RTO karşılandı");
    expect(json).not.toContain("RPO karşılandı");
  });

  it("karşılaştırma yoksa (KAYIT_YOK) kurtarmaKarsilastirmasi null döner", async () => {
    const sid = await hizmetEkle(seed.A.tenantId);
    const run = await kosuKur(seed.A.tenantId, seed.controlId, sid);
    const token = await linkOlustur(seed.A.userId, seed.A.tenantId, run);
    const { rows } = await db.asAnon(`select public.proof_room_goruntule($1) as v`, [token]);
    const v = rows[0].v as Record<string, unknown>;
    expect(v.kurtarmaKarsilastirmasi).toBeNull();
  });

  it("BIRDEN_FAZLA_GUNCEL_KAYIT durumunda kurtarmaKarsilastirmasi null döner (rastgele kayıt gösterilmez)", async () => {
    const sid = await hizmetEkle(seed.A.tenantId);
    const run = await kosuKur(seed.A.tenantId, seed.controlId, sid);
    const mid = await olcumEkle(seed.A.tenantId, run, seed.A.userId);
    const tid = await toleransYururlukte(seed.A.tenantId, sid, seed.A.userId);
    await karsilastirmaEkle(seed.A.tenantId, run, mid, tid, sid, seed.A.userId);
    await karsilastirmaEkle(seed.A.tenantId, run, mid, tid, sid, seed.A.userId);
    const token = await linkOlustur(seed.A.userId, seed.A.tenantId, run);
    const { rows } = await db.asAnon(`select public.proof_room_goruntule($1) as v`, [token]);
    const v = rows[0].v as Record<string, unknown>;
    expect(v.kurtarmaKarsilastirmasi).toBeNull();
  });

  it("mevcut 5 hedef + F4 kurtarmaOlcumu regresyonu bozulmadı (test_run dalı hâlâ çalışıyor)", async () => {
    const sid = await hizmetEkle(seed.A.tenantId);
    const run = await kosuKur(seed.A.tenantId, seed.controlId, sid);
    await olcumEkle(seed.A.tenantId, run, seed.A.userId);
    const token = await linkOlustur(seed.A.userId, seed.A.tenantId, run);
    const { rows } = await db.asAnon(`select public.proof_room_goruntule($1) as v`, [token]);
    const v = rows[0].v as Record<string, unknown>;
    expect(v.kosu).toBeTruthy();
    expect(v.kurtarmaOlcumu).toBeTruthy();
  });
});
