// G1 Proof Room: token'lı oturumsuz erişim — kapsam/expiry/iptal/cross-tenant
// güvenlik testleri (nihai talimat §12: "Proof Room token scope/expiry").
// Gerçek migration'lara karşı PGlite.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, seedTwoTenants, type TestDb } from "./helpers/pg";

let db: TestDb;
let seed: Awaited<ReturnType<typeof seedTwoTenants>>;
const H = (c: string) => c.repeat(64);
const MISAFIR = "a0000000-0000-0000-0000-000000000009";

/** Kiracıda tanım + koşu; globalde kaynak zinciri + eşleme kurar. */
async function kosuVeZincir(tenantId: string) {
  const { rows: d } = await db.sql(
    `insert into public.control_test_definitions (tenant_id, control_id, tur, ad)
     values ($1, $2, 'MANUAL_PROCEDURE', 'Proof tanımı') returning id`,
    [tenantId, seed.controlId],
  );
  const { rows: r } = await db.sql(
    `insert into public.test_runs (tenant_id, test_definition_id, control_id, sonuc, gerekce, tanim_surumu)
     values ($1, $2, $3, 'PASSED', 'test', 1) returning id`,
    [tenantId, d[0].id, seed.controlId],
  );
  const { rows: s } = await db.sql(
    `insert into public.regulatory_sources (authority, jurisdiction, kaynak_seviyesi, ad, erisim_politikasi_durumu)
     values ('SPK', 'TR', 'A', 'Proof Kaynak', 'manuel') returning id`,
  );
  const { rows: a } = await db.sql(
    `insert into public.source_artifacts (source_id, baslik, sha256) values ($1, 'Artifact', $2) returning id`,
    [s[0].id, H("a")],
  );
  const { rows: p } = await db.sql(
    `insert into public.provisions (source_artifact_id, provision_ref, metin, effective_from)
     values ($1, 'md. 9', 'Hüküm metni', '2020-01-01') returning id`,
    [a[0].id],
  );
  const { rows: o } = await db.sql(
    `insert into public.obligations (provision_id, kod, baslik, amac) values ($1, 'PR-YUK-1', 'Y', 'a') returning id`,
    [p[0].id],
  );
  await db.sql(
    `insert into public.obligation_control_mappings (obligation_id, control_id) values ($1, $2)`,
    [o[0].id, seed.controlId],
  );
  return { runId: r[0].id as string };
}

async function linkOlustur(userId: string, tenantId: string, runId: string, gunSonra = 7): Promise<string> {
  const { rows } = await db.asUser(
    userId,
    `insert into public.proof_room_links (tenant_id, test_run_id, son_gecerlilik)
     values ($1, $2, now() + ($3 || ' days')::interval) returning token`,
    [tenantId, runId, String(gunSonra)],
  );
  return rows[0].token as string;
}

/** roi_export_run oluşturur, dört-göz ile YAYINLANDI'ya taşır (37 Tez Dikey B, Faz 3). */
async function yayinlanmisExportEkle(tenantId: string, talepEden: string, onaylayan: string): Promise<string> {
  const { rows } = await db.sql(
    `insert into public.roi_export_runs (tenant_id, talep_eden, paket, paket_hash, on_kontrol_raporu, engelleyici_sorun_sayisi)
     values ($1, $2, $3::jsonb, $4, '{"sorunlar":[],"engelleyiciSayisi":0}'::jsonb, 0) returning id`,
    [tenantId, talepEden, JSON.stringify({ schema: "KALKAN_ROI_EXPORT_V1" }), "d".repeat(64)],
  );
  const id = rows[0].id as string;
  await db.sql(`update public.roi_export_runs set durum = 'ONAY_TALEP_EDILDI' where id = $1`, [id]);
  await db.sql(`update public.roi_export_runs set durum = 'YAYINLANDI', onaylayan = $2, onay_zamani = now() where id = $1`, [id, onaylayan]);
  return id;
}

async function roiLinkOlustur(userId: string, tenantId: string, exportRunId: string, gunSonra = 7): Promise<string> {
  const { rows } = await db.asUser(
    userId,
    `insert into public.proof_room_links (tenant_id, roi_export_run_id, son_gecerlilik)
     values ($1, $2, now() + ($3 || ' days')::interval) returning token`,
    [tenantId, exportRunId, String(gunSonra)],
  );
  return rows[0].token as string;
}

/** Dikey F, F2 — kritik_hizmet_test_paketi_snapshots ekler. */
async function paketEkle(tenantId: string, userId: string): Promise<string> {
  const { rows: hizmet } = await db.sql(`insert into public.critical_business_services (tenant_id, ad) values ($1, 'Ödeme') returning id`, [tenantId]);
  const { rows } = await db.asUser(
    userId,
    `insert into public.kritik_hizmet_test_paketi_snapshots (tenant_id, critical_service_id, paket, paket_hash, hesaplama_yontemi)
     values ($1, $2, $3::jsonb, $4, '{"surum":"v1"}'::jsonb) returning id`,
    [tenantId, hizmet[0].id, JSON.stringify({ schema: "KALKAN_CRITICAL_SERVICE_TEST_PACKAGE_V1", genelDurum: "DOGRULANMIS" }), "c".repeat(64)],
  );
  return rows[0].id as string;
}

async function paketLinkOlustur(userId: string, tenantId: string, paketId: string, gunSonra = 7): Promise<string> {
  const { rows } = await db.asUser(
    userId,
    `insert into public.proof_room_links (tenant_id, kritik_hizmet_test_paketi_snapshot_id, son_gecerlilik)
     values ($1, $2, now() + ($3 || ' days')::interval) returning token`,
    [tenantId, paketId, String(gunSonra)],
  );
  return rows[0].token as string;
}

const A_IKINCI = "a0000000-0000-0000-0000-000000000002";

beforeEach(async () => {
  db = await createTestDb();
  seed = await seedTwoTenants(db);
  await db.sql(`insert into auth.users (id, email) values ($1, 'misafir@demo.com')`, [MISAFIR]);
  await db.sql(
    `insert into public.profiles (id, tenant_id, role, full_name) values ($1, $2, 'denetci_misafir', 'Misafir')`,
    [MISAFIR, seed.A.tenantId],
  );
  await db.sql(`insert into auth.users (id, email) values ($1, 'a-ikinci@demo.com')`, [A_IKINCI]);
  await db.sql(`insert into public.profiles (id, tenant_id, role, full_name) values ($1, $2, 'uyum', 'A İkinci')`, [A_IKINCI, seed.A.tenantId]);
});

afterEach(async () => {
  await db.close();
});

describe("proof_room — token'lı salt-okur erişim (G1)", () => {
  it("admin link oluşturur; B kiracısı A'nın linkini GÖREMEZ; misafir OLUŞTURAMAZ", async () => {
    const { runId } = await kosuVeZincir(seed.A.tenantId);
    await linkOlustur(seed.A.userId, seed.A.tenantId, runId);
    const { rows: baska } = await db.asUser(seed.B.userId, `select id from public.proof_room_links`);
    expect(baska).toHaveLength(0);
    await expect(
      db.asUser(
        MISAFIR,
        `insert into public.proof_room_links (tenant_id, test_run_id, son_gecerlilik) values ($1, $2, now() + interval '1 day')`,
        [seed.A.tenantId, runId],
      ),
    ).rejects.toThrow();
  });

  it("geçerli token: koşu + zincir + kurum döner ve görüntüleme AUDIT'e düşer", async () => {
    const { runId } = await kosuVeZincir(seed.A.tenantId);
    const token = await linkOlustur(seed.A.userId, seed.A.tenantId, runId);
    const { rows } = await db.asAnon(`select public.proof_room_goruntule($1) as v`, [token]);
    const v = rows[0].v as Record<string, unknown>;
    expect((v.kosu as Record<string, unknown>).id).toBe(runId);
    expect((v.kosu as Record<string, unknown>).sonuc).toBe("PASSED");
    expect((v.kaynakZinciri as unknown[]).length).toBe(1);
    const zincir = (v.kaynakZinciri as Record<string, unknown>[])[0];
    expect(zincir.artifactSha256).toBe(H("a"));
    expect(zincir.snippet).toBe("Hüküm metni");
    const { rows: audit } = await db.sql(
      `select count(*)::int as n from public.audit_log where eylem = 'proof_room_goruntulendi' and tenant_id = $1`,
      [seed.A.tenantId],
    );
    expect(audit[0].n).toBe(1);
  });

  it("geçersiz, süresi dolmuş ve iptal edilmiş token AYNI yanıtı (null) verir", async () => {
    const { runId } = await kosuVeZincir(seed.A.tenantId);
    const { rows: gecersiz } = await db.asAnon(`select public.proof_room_goruntule('yok-boyle-token') as v`);
    expect(gecersiz[0].v).toBeNull();

    const dolmus = await linkOlustur(seed.A.userId, seed.A.tenantId, runId);
    await db.sql(`update public.proof_room_links set son_gecerlilik = now() - interval '1 hour' where token = $1`, [dolmus]);
    const { rows: d } = await db.asAnon(`select public.proof_room_goruntule($1) as v`, [dolmus]);
    expect(d[0].v).toBeNull();

    const iptal = await linkOlustur(seed.A.userId, seed.A.tenantId, runId);
    await db.asUser(seed.A.userId, `update public.proof_room_links set iptal_edildi = true where token = $1`, [iptal]);
    const { rows: i } = await db.asAnon(`select public.proof_room_goruntule($1) as v`, [iptal]);
    expect(i[0].v).toBeNull();
  });

  it("cross-tenant: A'nın linki B'nin koşusuna işaret edemez — artık INSERT anında reddedilir (Dikey E2 Kapı 1, proof_room_link_target_guard)", async () => {
    const { runId: bRun } = await kosuVeZincir(seed.B.tenantId);
    // A kendi kiracısında ama B'nin koşusuna link kurmayı denesin — merkezi
    // cross-tenant guard (20260720280000) INSERT'i doğrudan reddeder;
    // artık dangling bir link hiç oluşmuyor, read-time null'a bel bağlanmıyor.
    await expect(linkOlustur(seed.A.userId, seed.A.tenantId, bRun)).rejects.toThrow(/cross-tenant/i);
  });
});

describe("proof_room — test_run_id dalı V2/V3 manifest özeti (Dikey F, F1)", () => {
  it("manifestOzeti kritik hizmet/senaryo bilgisiyle döner; hazırlayan RAW UUID olarak DÖNMEZ", async () => {
    const { rows: d } = await db.sql(
      `insert into public.control_test_definitions (tenant_id, control_id, tur, ad, amac, kapsam, kritik_hizmet_adi, senaryo_kimligi)
       values ($1, $2, 'MANUAL_PROCEDURE', 'F1 tanımı', 'amac', 'kapsam', 'Ödeme Sistemi', 'TAT-01') returning id`,
      [seed.A.tenantId, seed.controlId],
    );
    const { rows: r } = await db.sql(
      `insert into public.test_runs (tenant_id, test_definition_id, control_id, sonuc, gerekce, tanim_surumu, hazirlayan)
       values ($1, $2, $3, 'PASSED', 'test', 1, $4) returning id`,
      [seed.A.tenantId, d[0].id, seed.controlId, seed.A.userId],
    );
    const token = await linkOlustur(seed.A.userId, seed.A.tenantId, r[0].id as string);
    const { rows } = await db.asAnon(`select public.proof_room_goruntule($1) as v`, [token]);
    const v = rows[0].v as Record<string, unknown>;
    const manifest = v.manifestOzeti as Record<string, unknown>;
    expect(manifest.semaSurumu).toBe("KALKAN_CONTROL_TEST_RUN_MANIFEST_V3");
    expect(manifest.amac).toBe("amac");
    expect(manifest.kritikHizmetAdi).toBe("Ödeme Sistemi");
    expect(manifest.kritikHizmetIdDogrulanmis).toBe(false);
    expect(manifest.hazirlayanBelirtildi).toBe(true);
    expect(JSON.stringify(v)).not.toContain(seed.A.userId); // kullanıcı kimliği raw dönmez
  });

  it("Dikey F, F4: güncel kurtarma ölçümü minimize döner (ham beyan_eden YOK, karşılaştırma YOK); ölçüm yoksa null", async () => {
    const { runId } = await kosuVeZincir(seed.A.tenantId);
    // Ölçüm yokken kurtarmaOlcumu null.
    const tokenBos = await linkOlustur(seed.A.userId, seed.A.tenantId, runId);
    const { rows: bos } = await db.asAnon(`select public.proof_room_goruntule($1) as v`, [tokenBos]);
    expect((bos[0].v as Record<string, unknown>).kurtarmaOlcumu).toBeNull();

    // Bir ölçüm ekle (beyan_eden = A.userId, ham dönmemeli).
    await db.asUser(
      seed.A.userId,
      `insert into public.test_run_recovery_measurements
        (tenant_id, test_run_id, olcum_kaynagi, girdi_modu, kesinti_baslangic_at, hizmet_geri_geldi_at, olcum, olcum_hash, measured_at)
       values ($1,$2,'MANUEL_BEYAN','EVENT_TIMESTAMPS','2026-07-10T08:00:00Z','2026-07-10T12:00:00Z',$3::jsonb,$4,'2026-07-10T12:00:00Z')`,
      [seed.A.tenantId, runId, JSON.stringify({ schema: "WARDPROOF_TEST_RUN_RECOVERY_MEASUREMENT_V1" }), "a".repeat(64)],
    );
    const token = await linkOlustur(seed.A.userId, seed.A.tenantId, runId);
    const { rows } = await db.asAnon(`select public.proof_room_goruntule($1) as v`, [token]);
    const v = rows[0].v as Record<string, unknown>;
    const olcum = v.kurtarmaOlcumu as Record<string, unknown>;
    expect(olcum).not.toBeNull();
    expect(olcum.olcumKaynagi).toBe("MANUEL_BEYAN");
    expect(Number(olcum.olculenKesintiSaat)).toBe(4);
    expect(olcum.karsilastirmaYapildi).toBe(false);
    expect(olcum.birim).toBe("SAAT");
    // Minimizasyon: ham beyan_eden UUID'si ve "karşılandı" ifadesi YOK.
    const json = JSON.stringify(v);
    expect(json).not.toContain(seed.A.userId);
    expect(json).not.toContain("karşılandı");
  });

  it("critical_service_id FK doluysa kritikHizmetIdDogrulanmis true olur", async () => {
    const { rows: hizmet } = await db.sql(
      `insert into public.critical_business_services (tenant_id, ad) values ($1, 'Ödeme') returning id`,
      [seed.A.tenantId],
    );
    const { rows: d } = await db.sql(
      `insert into public.control_test_definitions (tenant_id, control_id, tur, ad, critical_service_id)
       values ($1, $2, 'MANUAL_PROCEDURE', 'F1 tanımı', $3) returning id`,
      [seed.A.tenantId, seed.controlId, hizmet[0].id],
    );
    const { rows: r } = await db.sql(
      `insert into public.test_runs (tenant_id, test_definition_id, control_id, sonuc, gerekce, tanim_surumu)
       values ($1, $2, $3, 'PASSED', 'test', 1) returning id`,
      [seed.A.tenantId, d[0].id, seed.controlId],
    );
    const token = await linkOlustur(seed.A.userId, seed.A.tenantId, r[0].id as string);
    const { rows } = await db.asAnon(`select public.proof_room_goruntule($1) as v`, [token]);
    const v = rows[0].v as Record<string, unknown>;
    expect((v.manifestOzeti as Record<string, unknown>).kritikHizmetIdDogrulanmis).toBe(true);
  });

  it("bu koşunun ürettiği KABUL edilmiş bulgu ilişkisel bağlantıda görünür (manifestin PARÇASI değil)", async () => {
    const { rows: d } = await db.sql(
      `insert into public.control_test_definitions (tenant_id, control_id, tur, ad) values ($1, $2, 'MANUAL_PROCEDURE', 'F1') returning id`,
      [seed.A.tenantId, seed.controlId],
    );
    const { rows: r } = await db.sql(
      `insert into public.test_runs (tenant_id, test_definition_id, control_id, sonuc, gerekce, tanim_surumu)
       values ($1, $2, $3, 'FAILED', 'basarisiz', 1) returning id`,
      [seed.A.tenantId, d[0].id, seed.controlId],
    );
    const { rows: f } = await db.sql(
      `insert into public.findings (tenant_id, kaynak, onem, baslik, durum, retest_gerekli, kaynak_test_definition_id)
       values ($1, 'kontrol_testi', 'kritik', 'X', 'acik', true, $2) returning id`,
      [seed.A.tenantId, d[0].id],
    );
    await db.sql(
      `insert into public.control_test_finding_proposals (test_run_id, test_definition_id, tenant_id, control_id, baslik, gerekce, onem, durum, finding_id, karar_veren, karar_at)
       values ($1, $2, $3, $4, 'X', 'g', 'kritik', 'KABUL', $5, $6, now())`,
      [r[0].id, d[0].id, seed.A.tenantId, seed.controlId, f[0].id, seed.A.userId],
    );
    const token = await linkOlustur(seed.A.userId, seed.A.tenantId, r[0].id as string);
    const { rows } = await db.asAnon(`select public.proof_room_goruntule($1) as v`, [token]);
    const v = rows[0].v as Record<string, unknown>;
    const baglanti = (v.iliskiselBaglantilar as Record<string, unknown>).kabulEdilmisBulgu as Record<string, unknown>;
    expect(baglanti.findingId).toBe(f[0].id);
    expect((v.manifestOzeti as Record<string, unknown>)["findingId"]).toBeUndefined();
  });

  it("bu koşuyla GERÇEKTEN kapanan bulgu tarihsel kapanış bağlantısında görünür", async () => {
    const { rows: d } = await db.sql(
      `insert into public.control_test_definitions (tenant_id, control_id, tur, ad) values ($1, $2, 'MANUAL_PROCEDURE', 'F1') returning id`,
      [seed.A.tenantId, seed.controlId],
    );
    const { rows: f } = await db.sql(
      `insert into public.findings (tenant_id, kaynak, onem, baslik, durum, retest_gerekli, kaynak_test_definition_id)
       values ($1, 'kontrol_testi', 'kritik', 'X', 'acik', true, $2) returning id`,
      [seed.A.tenantId, d[0].id],
    );
    await db.sql(`select pg_sleep(0.01)`);
    const { rows: retest } = await db.sql(
      `insert into public.test_runs (tenant_id, test_definition_id, control_id, sonuc, gerekce, tanim_surumu)
       values ($1, $2, $3, 'PASSED', 'retest', 1) returning id`,
      [seed.A.tenantId, d[0].id, seed.controlId],
    );
    await db.sql(
      `update public.findings set durum = 'kapali', kapatma_retest_run_id = $1, kapatan = $2 where id = $3`,
      [retest[0].id, A_IKINCI, f[0].id],
    );
    const token = await linkOlustur(seed.A.userId, seed.A.tenantId, retest[0].id as string);
    const { rows } = await db.asAnon(`select public.proof_room_goruntule($1) as v`, [token]);
    const v = rows[0].v as Record<string, unknown>;
    const kapanan = (v.kapanisBaglantisi as Record<string, unknown>).kapananBulgular as Record<string, unknown>[];
    expect(kapanan).toHaveLength(1);
    expect(kapanan[0].findingId).toBe(f[0].id);
  });

  it("retest niyeti (test_runs.retest_of_finding_id) belirtilmişse görünür", async () => {
    const { rows: d } = await db.sql(
      `insert into public.control_test_definitions (tenant_id, control_id, tur, ad) values ($1, $2, 'MANUAL_PROCEDURE', 'F1') returning id`,
      [seed.A.tenantId, seed.controlId],
    );
    const { rows: f } = await db.sql(
      `insert into public.findings (tenant_id, kaynak, onem, baslik, durum, retest_gerekli)
       values ($1, 'kontrol_testi', 'kritik', 'X', 'acik', true) returning id`,
      [seed.A.tenantId],
    );
    const { rows: r } = await db.sql(
      `insert into public.test_runs (tenant_id, test_definition_id, control_id, sonuc, gerekce, tanim_surumu, retest_of_finding_id)
       values ($1, $2, $3, 'PASSED', 'retest', 1, $4) returning id`,
      [seed.A.tenantId, d[0].id, seed.controlId, f[0].id],
    );
    const token = await linkOlustur(seed.A.userId, seed.A.tenantId, r[0].id as string);
    const { rows } = await db.asAnon(`select public.proof_room_goruntule($1) as v`, [token]);
    const v = rows[0].v as Record<string, unknown>;
    expect((v.retestNiyeti as Record<string, unknown>).findingId).toBe(f[0].id);
  });

  it("retest niyeti yoksa null döner (uydurulmaz)", async () => {
    const { runId } = await kosuVeZincir(seed.A.tenantId);
    const token = await linkOlustur(seed.A.userId, seed.A.tenantId, runId);
    const { rows } = await db.asAnon(`select public.proof_room_goruntule($1) as v`, [token]);
    const v = rows[0].v as Record<string, unknown>;
    expect(v.retestNiyeti).toBeNull();
  });
});

describe("proof_room — roi_export_run_id dalı (37 Tez Dikey B, Faz 3 kalan dilimi)", () => {
  it("YAYINLANDI export'a link kurulur; token paket/paketHash/onKontrolRaporu döner ve audit'e düşer", async () => {
    const exportId = await yayinlanmisExportEkle(seed.A.tenantId, seed.A.userId, A_IKINCI);
    const token = await roiLinkOlustur(seed.A.userId, seed.A.tenantId, exportId);
    const { rows } = await db.asAnon(`select public.proof_room_goruntule($1) as v`, [token]);
    const v = rows[0].v as Record<string, unknown>;
    const roiExport = v.roiExport as Record<string, unknown>;
    expect(roiExport.id).toBe(exportId);
    expect(roiExport.paketHash).toBe("d".repeat(64));
    expect((roiExport.paket as Record<string, unknown>).schema).toBe("KALKAN_ROI_EXPORT_V1");
    expect(v.kosu).toBeUndefined();
    const { rows: audit } = await db.sql(
      `select count(*)::int as n from public.audit_log where eylem = 'proof_room_goruntulendi' and tenant_id = $1`,
      [seed.A.tenantId],
    );
    expect(audit[0].n).toBe(1);
  });

  it("TASLAK export'a (henüz YAYINLANDI değil) işaret eden link null döner — savunma derinliği", async () => {
    const { rows } = await db.sql(
      `insert into public.roi_export_runs (tenant_id, talep_eden, paket, paket_hash, on_kontrol_raporu, engelleyici_sorun_sayisi)
       values ($1, $2, '{}'::jsonb, $3, '{"sorunlar":[],"engelleyiciSayisi":0}'::jsonb, 0) returning id`,
      [seed.A.tenantId, seed.A.userId, "e".repeat(64)],
    );
    const taslakId = rows[0].id as string;
    const token = await roiLinkOlustur(seed.A.userId, seed.A.tenantId, taslakId);
    const { rows: v } = await db.asAnon(`select public.proof_room_goruntule($1) as v`, [token]);
    expect(v[0].v).toBeNull();
  });

  it("test_run_id ve roi_export_run_id İKİSİ FARKLI DALLAR — biri diğerini etkilemez", async () => {
    const { runId } = await kosuVeZincir(seed.A.tenantId);
    const testToken = await linkOlustur(seed.A.userId, seed.A.tenantId, runId);
    const exportId = await yayinlanmisExportEkle(seed.A.tenantId, seed.A.userId, A_IKINCI);
    const roiToken = await roiLinkOlustur(seed.A.userId, seed.A.tenantId, exportId);

    const { rows: t } = await db.asAnon(`select public.proof_room_goruntule($1) as v`, [testToken]);
    expect((t[0].v as Record<string, unknown>).roiExport).toBeUndefined();
    const { rows: r } = await db.asAnon(`select public.proof_room_goruntule($1) as v`, [roiToken]);
    expect((r[0].v as Record<string, unknown>).kosu).toBeUndefined();
  });
});

describe("proof_room — kritik_hizmet_test_paketi_snapshot_id dalı (Dikey F, F2, BEŞİNCİ hedef)", () => {
  it("aynı-tenant snapshot'a link kurulur; anonim (oturumsuz) görüntülemede paket/paketHash/hesaplamaYontemi döner ve audit'e düşer", async () => {
    const paketId = await paketEkle(seed.A.tenantId, seed.A.userId);
    const token = await paketLinkOlustur(seed.A.userId, seed.A.tenantId, paketId);
    const { rows } = await db.asAnon(`select public.proof_room_goruntule($1) as v`, [token]);
    const v = rows[0].v as Record<string, unknown>;
    const paket = v.kritikHizmetTestPaketi as Record<string, unknown>;
    expect(paket.id).toBe(paketId);
    expect(paket.paketHash).toBe("c".repeat(64));
    expect((paket.paket as Record<string, unknown>).genelDurum).toBe("DOGRULANMIS");
    expect((paket.hesaplamaYontemi as Record<string, unknown>).surum).toBe("v1");
    const { rows: audit } = await db.sql(
      `select count(*)::int as n from public.audit_log where eylem = 'proof_room_goruntulendi' and tenant_id = $1`,
      [seed.A.tenantId],
    );
    expect(audit[0].n).toBe(1);
  });

  it("cross-tenant: A'nın linki B'nin snapshot'ına işaret edemez (INSERT anında reddedilir)", async () => {
    const paketIdB = await paketEkle(seed.B.tenantId, seed.B.userId);
    await expect(paketLinkOlustur(seed.A.userId, seed.A.tenantId, paketIdB)).rejects.toThrow(/cross-tenant/i);
  });

  it("çoklu hedef (aynı anda iki alan dolu) CHECK ile reddedilir", async () => {
    const { runId } = await kosuVeZincir(seed.A.tenantId);
    const paketId = await paketEkle(seed.A.tenantId, seed.A.userId);
    await expect(
      db.asUser(
        seed.A.userId,
        `insert into public.proof_room_links (tenant_id, test_run_id, kritik_hizmet_test_paketi_snapshot_id, son_gecerlilik)
         values ($1, $2, $3, now() + interval '7 days')`,
        [seed.A.tenantId, runId, paketId],
      ),
    ).rejects.toThrow();
  });

  it("sıfır hedef CHECK ile reddedilir", async () => {
    await expect(
      db.asUser(seed.A.userId, `insert into public.proof_room_links (tenant_id, son_gecerlilik) values ($1, now() + interval '7 days')`, [seed.A.tenantId]),
    ).rejects.toThrow();
  });

  it("diğer dört dal (test_run/roi_export/graph_snapshot/cloud_assurance) beşinci hedef eklenmesinden ETKİLENMEZ — regresyon", async () => {
    const { runId } = await kosuVeZincir(seed.A.tenantId);
    const testToken = await linkOlustur(seed.A.userId, seed.A.tenantId, runId);
    const { rows: t } = await db.asAnon(`select public.proof_room_goruntule($1) as v`, [testToken]);
    expect((t[0].v as Record<string, unknown>).kosu).toBeDefined();
    expect((t[0].v as Record<string, unknown>).kritikHizmetTestPaketi).toBeUndefined();
  });
});

describe("proof_room — Dikey F, F3: V2 tolerans özeti mühürlü paketle döner, V1'de yok", () => {
  async function paketEkleVersiyonlu(tenantId: string, userId: string, paket: object, hash: string): Promise<string> {
    const { rows: hizmet } = await db.sql(`insert into public.critical_business_services (tenant_id, ad) values ($1, 'Ödeme') returning id`, [tenantId]);
    const { rows } = await db.asUser(
      userId,
      `insert into public.kritik_hizmet_test_paketi_snapshots (tenant_id, critical_service_id, paket, paket_hash, hesaplama_yontemi)
       values ($1, $2, $3::jsonb, $4, '{"surum":"kritik-hizmet-test-paketi-v2"}'::jsonb) returning id`,
      [tenantId, hizmet[0].id, JSON.stringify(paket), hash],
    );
    return rows[0].id as string;
  }

  it("V2 snapshot: anonim görüntülemede mühürlü etkiToleransiOzeti (minimize) döner; ham onaylayan kimliği YOK, 'RTO karşılandı' YOK", async () => {
    const v2Paket = {
      schema: "KALKAN_CRITICAL_SERVICE_TEST_PACKAGE_V2",
      genelDurum: "INCELEME_GEREKLI",
      etkiToleransiOzeti: {
        durum: "TOLERANS_TANIMLI_VE_ONAYLI",
        toleranceId: "tol-xyz",
        version: 2,
        maxKesintiSaat: 4,
        maxVeriKaybiSaat: 1,
        onayDurumu: "YURURLUKTE",
        onaylayanBelirtildi: true,
        birim: "SAAT",
        karsilastirmaYapildi: false,
      },
    };
    const paketId = await paketEkleVersiyonlu(seed.A.tenantId, seed.A.userId, v2Paket, "d".repeat(64));
    const token = await paketLinkOlustur(seed.A.userId, seed.A.tenantId, paketId);
    const { rows } = await db.asAnon(`select public.proof_room_goruntule($1) as v`, [token]);
    const v = rows[0].v as Record<string, unknown>;
    const paket = (v.kritikHizmetTestPaketi as Record<string, unknown>).paket as Record<string, unknown>;
    const tol = paket.etkiToleransiOzeti as Record<string, unknown>;
    expect(tol.durum).toBe("TOLERANS_TANIMLI_VE_ONAYLI");
    expect(tol.maxKesintiSaat).toBe(4);
    expect(tol.karsilastirmaYapildi).toBe(false);
    // Kimlik minimizasyonu: yalnız boolean, ham UUID yok.
    expect(tol.onaylayanBelirtildi).toBe(true);
    expect(tol.onaylayan).toBeUndefined();
    // Nicel uygunluk hükmü ASLA sızmaz.
    const json = JSON.stringify(v);
    expect(json).not.toContain("RTO karşılandı");
    expect(json).not.toContain("RPO karşılandı");
    expect(json).not.toContain(seed.A.userId);
  });

  it("V1 snapshot: mühürlü payload'da etkiToleransiOzeti YOK — savunmacı okunur, güncel DB'den zenginleştirilmez", async () => {
    const v1Paket = { schema: "KALKAN_CRITICAL_SERVICE_TEST_PACKAGE_V1", genelDurum: "DOGRULANMIS" };
    const paketId = await paketEkleVersiyonlu(seed.A.tenantId, seed.A.userId, v1Paket, "e".repeat(64));
    const token = await paketLinkOlustur(seed.A.userId, seed.A.tenantId, paketId);
    const { rows } = await db.asAnon(`select public.proof_room_goruntule($1) as v`, [token]);
    const v = rows[0].v as Record<string, unknown>;
    const paket = (v.kritikHizmetTestPaketi as Record<string, unknown>).paket as Record<string, unknown>;
    expect(paket.etkiToleransiOzeti).toBeUndefined();
  });
});
