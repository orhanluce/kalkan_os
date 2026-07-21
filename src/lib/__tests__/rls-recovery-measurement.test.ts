// Dikey F, F4: test_run_recovery_measurements — immutable, supersede zinciri,
// güvenilirlik katmanı (OTOMATIK sahte yükseltme reddi), cross-tenant guard'lar,
// generated süreler, mod/negatif/sıra CHECK'leri, ledger enqueue.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, seedTwoTenants, type TestDb } from "./helpers/pg";

let db: TestDb;
let seed: Awaited<ReturnType<typeof seedTwoTenants>>;

const HASH = "a".repeat(64);
const OLCUM = JSON.stringify({ schema: "WARDPROOF_TEST_RUN_RECOVERY_MEASUREMENT_V1", comparisonPerformed: false });

/** Bir tenant için control_test_definition + test_run kurar, run id döner. */
async function kosuKur(tenantId: string): Promise<string> {
  const { rows: d } = await db.sql(
    `insert into public.control_test_definitions (tenant_id, control_id, tur, ad)
     values ($1, $2, 'RESTORE_TEST', 'Yedekten geri yükleme') returning id`,
    [tenantId, seed.controlId],
  );
  const { rows: r } = await db.sql(
    `insert into public.test_runs (tenant_id, test_definition_id, control_id, sonuc, gerekce, tanim_surumu)
     values ($1, $2, $3, 'PASSED', 'ok', 1) returning id`,
    [tenantId, d[0].id, seed.controlId],
  );
  return r[0].id as string;
}

/** Bir olay-zamanlı MANUEL_BEYAN ekler (varsayılan alanlarla). */
async function manuelEkle(tenantId: string, runId: string, userId: string, extra: Record<string, unknown> = {}) {
  const cols = {
    tenant_id: tenantId,
    test_run_id: runId,
    olcum_kaynagi: "MANUEL_BEYAN",
    girdi_modu: "EVENT_TIMESTAMPS",
    kesinti_baslangic_at: "2026-07-10T08:00:00.000Z",
    hizmet_geri_geldi_at: "2026-07-10T12:00:00.000Z",
    olcum: OLCUM,
    olcum_hash: HASH,
    // Dikey F, F5 Karar D: kesinti olay zamanı doluyken measured_at ona EŞİT
    // olmalı (trrm_measured_at_olay_tutarli, 20260721060000).
    measured_at: "2026-07-10T12:00:00.000Z",
    ...extra,
  } as Record<string, unknown>;
  const keys = Object.keys(cols);
  const ph = keys.map((_, i) => `$${i + 1}`).join(", ");
  const jsonbKeys = new Set(["olcum"]);
  const cast = keys.map((k) => (jsonbKeys.has(k) ? `${k}` : k));
  void cast;
  const colList = keys.map((k) => k).join(", ");
  const valList = keys.map((k, i) => (jsonbKeys.has(k) ? `$${i + 1}::jsonb` : `$${i + 1}`)).join(", ");
  void ph;
  return db.asUser(userId, `insert into public.test_run_recovery_measurements (${colList}) values (${valList}) returning id, beyan_eden`, keys.map((k) => cols[k]));
}

beforeEach(async () => {
  db = await createTestDb();
  seed = await seedTwoTenants(db);
});
afterEach(async () => {
  await db.close();
});

describe("test_run_recovery_measurements — kaynak + kimlik", () => {
  it("MANUEL_BEYAN: beyan_eden sunucu tarafında oturum sahibine sabitlenir", async () => {
    const run = await kosuKur(seed.A.tenantId);
    const { rows } = await manuelEkle(seed.A.tenantId, run, seed.A.userId, { beyan_eden: seed.B.userId /* sahte — guard ezmeli */ });
    expect(rows[0].beyan_eden).toBe(seed.A.userId);
  });

  it("OTOMATIK_OLCUM authenticated kullanıcıdan REDDEDİLİR (sahte yükseltme)", async () => {
    const run = await kosuKur(seed.A.tenantId);
    await expect(
      manuelEkle(seed.A.tenantId, run, seed.A.userId, {
        olcum_kaynagi: "OTOMATIK_OLCUM",
        source_system: "mon",
        source_event_id: "e1",
      }),
    ).rejects.toThrow(/service_role/i);
  });

  it("OTOMATIK_OLCUM service_role + tam provenance ile GEÇER", async () => {
    const run = await kosuKur(seed.A.tenantId);
    const { rows: ev } = await db.sql(
      `insert into public.evidences (tenant_id, control_id, tip, envelope_schema_version, classification, retention_class)
       values ($1, $2, 'beyan', 'KALKAN_EVIDENCE_ENVELOPE_V1', 'internal', 'standart') returning id`,
      [seed.A.tenantId, seed.controlId],
    );
    await db.sql(`select set_config('request.jwt.claim.role','service_role',false)`);
    const ins = await db.sql(
      `insert into public.test_run_recovery_measurements
        (tenant_id, test_run_id, olcum_kaynagi, girdi_modu, kesinti_baslangic_at, hizmet_geri_geldi_at, evidence_id, source_system, source_event_id, olcum, olcum_hash, measured_at)
       values ($1,$2,'OTOMATIK_OLCUM','EVENT_TIMESTAMPS','2026-07-10T08:00:00Z','2026-07-10T12:00:00Z',$3,'mon','evt-9',$4::jsonb,$5,'2026-07-10T12:00:00Z') returning id`,
      [seed.A.tenantId, run, ev[0].id, OLCUM, HASH],
    );
    await db.sql(`select set_config('request.jwt.claim.role','',false)`);
    expect(ins.rows[0].id).toBeTruthy();
  });

  it("OTOMATIK_OLCUM eksik provenance CHECK ile reddedilir (service_role bile)", async () => {
    const run = await kosuKur(seed.A.tenantId);
    await db.sql(`select set_config('request.jwt.claim.role','service_role',false)`);
    await expect(
      db.sql(
        `insert into public.test_run_recovery_measurements
          (tenant_id, test_run_id, olcum_kaynagi, girdi_modu, kesinti_baslangic_at, hizmet_geri_geldi_at, olcum, olcum_hash, measured_at)
         values ($1,$2,'OTOMATIK_OLCUM','EVENT_TIMESTAMPS','2026-07-10T08:00:00Z','2026-07-10T12:00:00Z',$3::jsonb,$4,'2026-07-10T13:00:00Z')`,
        [seed.A.tenantId, run, OLCUM, HASH],
      ),
    ).rejects.toThrow();
    await db.sql(`select set_config('request.jwt.claim.role','',false)`);
  });
});

describe("test_run_recovery_measurements — generated süreler + CHECK'ler", () => {
  it("türetilmiş süreler ham zamanlardan hesaplanır (generated stored)", async () => {
    const run = await kosuKur(seed.A.tenantId);
    const { rows } = await manuelEkle(seed.A.tenantId, run, seed.A.userId);
    const { rows: sel } = await db.sql(`select olculen_kesinti_saat, olculen_veri_kaybi_saat from public.test_run_recovery_measurements where id = $1`, [rows[0].id]);
    expect(Number(sel[0].olculen_kesinti_saat)).toBe(4);
    expect(sel[0].olculen_veri_kaybi_saat).toBeNull(); // veri kaybı zamanları verilmedi → NULL (0 değil)
  });

  it("başlangıç bitişten sonra ise CHECK reddeder", async () => {
    const run = await kosuKur(seed.A.tenantId);
    await expect(
      manuelEkle(seed.A.tenantId, run, seed.A.userId, { kesinti_baslangic_at: "2026-07-10T12:00:00Z", hizmet_geri_geldi_at: "2026-07-10T08:00:00Z" }),
    ).rejects.toThrow();
  });

  it("negatif beyan süresi CHECK reddeder", async () => {
    const run = await kosuKur(seed.A.tenantId);
    await expect(
      manuelEkle(seed.A.tenantId, run, seed.A.userId, { girdi_modu: "DURATION_DECLARATION", kesinti_baslangic_at: null, hizmet_geri_geldi_at: null, beyan_kesinti_saat: -1 }),
    ).rejects.toThrow();
  });

  it("EVENT modunda süre-beyan CHECK reddeder (mod tutarlılığı)", async () => {
    const run = await kosuKur(seed.A.tenantId);
    await expect(manuelEkle(seed.A.tenantId, run, seed.A.userId, { beyan_kesinti_saat: 4 })).rejects.toThrow();
  });

  it("tamamen boş ölçüm CHECK reddeder", async () => {
    const run = await kosuKur(seed.A.tenantId);
    await expect(
      manuelEkle(seed.A.tenantId, run, seed.A.userId, { girdi_modu: "DURATION_DECLARATION", kesinti_baslangic_at: null, hizmet_geri_geldi_at: null }),
    ).rejects.toThrow();
  });

  // Dikey F, F5 hazırlık — Karar D: measured_at yaşam döngüsü (20260721060000).
  it("hizmet_geri_geldi_at doluyken measured_at ondan FARKLI olamaz (trrm_measured_at_olay_tutarli)", async () => {
    const run = await kosuKur(seed.A.tenantId);
    await expect(manuelEkle(seed.A.tenantId, run, seed.A.userId, { measured_at: "2026-07-10T13:00:00.000Z" })).rejects.toThrow();
  });

  it("measured_at, recorded_at'ten makul olmayan ölçüde ileri olamaz (trrm_measured_at_gelecek_degil)", async () => {
    const run = await kosuKur(seed.A.tenantId);
    await expect(
      manuelEkle(seed.A.tenantId, run, seed.A.userId, {
        kesinti_baslangic_at: null,
        hizmet_geri_geldi_at: null,
        son_tutarli_veri_at: "2026-07-10T07:00:00.000Z",
        kurtarma_noktasi_at: "2026-07-10T08:00:00.000Z",
        measured_at: "2099-01-01T00:00:00.000Z",
      }),
    ).rejects.toThrow();
  });

  it("hizmet_geri_geldi_at boşsa (yalnız veri-kaybı) measured_at SERBEST — pencereyle birebir eşleşmesi gerekmez", async () => {
    const run = await kosuKur(seed.A.tenantId);
    const { rows } = await manuelEkle(seed.A.tenantId, run, seed.A.userId, {
      kesinti_baslangic_at: null,
      hizmet_geri_geldi_at: null,
      son_tutarli_veri_at: "2026-07-10T07:00:00.000Z",
      kurtarma_noktasi_at: "2026-07-10T08:00:00.000Z",
      measured_at: "2026-07-10T09:00:00.000Z",
    });
    expect(rows[0].id).toBeTruthy();
  });
});

// Dikey F, F5 hazırlık — Karar B: merkezi "güncel TRRM" fonksiyonu
// (test_run_kurtarma_olcumu_guncel, 20260721070000). "ORDER BY ... LIMIT 1"
// kabul edilmedi — anomali (KAYIT_YOK/BIRDEN_FAZLA_GUNCEL_KAYIT) GÖRÜNÜR olmalı.
describe("test_run_kurtarma_olcumu_guncel — merkezi sözleşme (Dikey F, F5 Karar B)", () => {
  async function guncelOku(runId: string, tenantId: string) {
    const { rows } = await db.sql(`select * from public.test_run_kurtarma_olcumu_guncel($1, $2)`, [runId, tenantId]);
    return rows[0] as Record<string, unknown>;
  }

  it("GUNCEL_KAYIT_VAR: tek yaprak (supersede edilmemiş kayıt) doğru döner", async () => {
    const run = await kosuKur(seed.A.tenantId);
    const { rows } = await manuelEkle(seed.A.tenantId, run, seed.A.userId);
    const sonuc = await guncelOku(run, seed.A.tenantId);
    expect(sonuc.durum).toBe("GUNCEL_KAYIT_VAR");
    expect(sonuc.id).toBe(rows[0].id);
    expect(Number(sonuc.olculen_kesinti_saat)).toBe(4);
  });

  it("KAYIT_YOK: bu koşuya hiç ölçüm bağlı değilse", async () => {
    const run = await kosuKur(seed.A.tenantId);
    const sonuc = await guncelOku(run, seed.A.tenantId);
    expect(sonuc.durum).toBe("KAYIT_YOK");
    expect(sonuc.id).toBeNull();
  });

  it("supersede edilen kayıt güncel SAYILMAZ; yeni kayıt (supersedes ile) güncel olur", async () => {
    const run = await kosuKur(seed.A.tenantId);
    const { rows: ilk } = await manuelEkle(seed.A.tenantId, run, seed.A.userId);
    const { rows: ikinci } = await manuelEkle(seed.A.tenantId, run, seed.A.userId, { supersedes_measurement_id: ilk[0].id });
    const sonuc = await guncelOku(run, seed.A.tenantId);
    expect(sonuc.durum).toBe("GUNCEL_KAYIT_VAR");
    expect(sonuc.id).toBe(ikinci[0].id);
  });

  it("BIRDEN_FAZLA_GUNCEL_KAYIT: aynı koşuya birbirini supersede ETMEYEN iki bağımsız ölçüm — RASTGELE SEÇİLMEZ", async () => {
    const run = await kosuKur(seed.A.tenantId);
    await manuelEkle(seed.A.tenantId, run, seed.A.userId);
    await manuelEkle(seed.A.tenantId, run, seed.A.userId); // ikinci, BAĞIMSIZ kök (supersedes yok)
    const sonuc = await guncelOku(run, seed.A.tenantId);
    expect(sonuc.durum).toBe("BIRDEN_FAZLA_GUNCEL_KAYIT");
    expect(sonuc.id).toBeNull(); // belirsizlikte rastgele bir kayıt DÖNMEZ
  });

  it("cross-tenant: B'nin test_run'ı + A'nın tenant_id'siyle sorgulanırsa KAYIT_YOK (sızıntı yok)", async () => {
    const runB = await kosuKur(seed.B.tenantId);
    await manuelEkle(seed.B.tenantId, runB, seed.B.userId);
    // A'nın tenant_id'siyle B'nin koşusunu sorgula — hiçbir satır eşleşmemeli.
    const sonuc = await guncelOku(runB, seed.A.tenantId);
    expect(sonuc.durum).toBe("KAYIT_YOK");
    expect(sonuc.id).toBeNull();
  });

  it("Proof Room: BIRDEN_FAZLA_GUNCEL_KAYIT durumunda kurtarmaOlcumu null döner (rastgele kayıt gösterilmez)", async () => {
    const run = await kosuKur(seed.A.tenantId);
    await manuelEkle(seed.A.tenantId, run, seed.A.userId);
    await manuelEkle(seed.A.tenantId, run, seed.A.userId);
    const { rows: link } = await db.asUser(
      seed.A.userId,
      `insert into public.proof_room_links (tenant_id, test_run_id, son_gecerlilik) values ($1, $2, now() + interval '1 day') returning token`,
      [seed.A.tenantId, run],
    );
    const { rows } = await db.asAnon(`select public.proof_room_goruntule($1) as v`, [link[0].token]);
    const v = rows[0].v as Record<string, unknown>;
    expect(v.kurtarmaOlcumu).toBeNull();
  });
});

describe("test_run_recovery_measurements — cross-tenant + supersede", () => {
  it("cross-tenant test_run reddedilir", async () => {
    const runB = await kosuKur(seed.B.tenantId);
    await expect(manuelEkle(seed.A.tenantId, runB, seed.A.userId)).rejects.toThrow(/cross-tenant/i);
  });

  it("kendini supersede eden kayıt CHECK ile reddedilir", async () => {
    const run = await kosuKur(seed.A.tenantId);
    // Aynı id ile self-supersede: açık id vererek dene.
    const id = "d1111111-1111-1111-1111-111111111111";
    await expect(
      manuelEkle(seed.A.tenantId, run, seed.A.userId, { id, supersedes_measurement_id: id }),
    ).rejects.toThrow();
  });

  it("supersede zinciri lineer: aynı kayıt iki kez supersede edilemez", async () => {
    const run = await kosuKur(seed.A.tenantId);
    const { rows: ilk } = await manuelEkle(seed.A.tenantId, run, seed.A.userId);
    await manuelEkle(seed.A.tenantId, run, seed.A.userId, { supersedes_measurement_id: ilk[0].id });
    await expect(manuelEkle(seed.A.tenantId, run, seed.A.userId, { supersedes_measurement_id: ilk[0].id })).rejects.toThrow();
  });

  it("supersede edilen kayıt FARKLI koşuya aitse reddedilir", async () => {
    const run1 = await kosuKur(seed.A.tenantId);
    const run2 = await kosuKur(seed.A.tenantId);
    const { rows: ilk } = await manuelEkle(seed.A.tenantId, run1, seed.A.userId);
    await expect(manuelEkle(seed.A.tenantId, run2, seed.A.userId, { supersedes_measurement_id: ilk[0].id })).rejects.toThrow(/ayni test kosusuna/i);
  });
});

describe("test_run_recovery_measurements — immutability + RLS + ledger", () => {
  it("UPDATE service_role dahil reddedilir", async () => {
    const run = await kosuKur(seed.A.tenantId);
    const { rows } = await manuelEkle(seed.A.tenantId, run, seed.A.userId);
    await expect(db.sql(`update public.test_run_recovery_measurements set olcum_hash = $1 where id = $2`, ["b".repeat(64), rows[0].id])).rejects.toThrow(/degistirilemez/i);
  });

  it("B kiracısı A'nın ölçümünü GÖREMEZ", async () => {
    const run = await kosuKur(seed.A.tenantId);
    await manuelEkle(seed.A.tenantId, run, seed.A.userId);
    const { rows } = await db.asUser(seed.B.userId, `select id from public.test_run_recovery_measurements`);
    expect(rows).toHaveLength(0);
  });

  it("INSERT şeffaflık defteri outbox'ına RECOVERY_MEASUREMENT olayı düşürür", async () => {
    const run = await kosuKur(seed.A.tenantId);
    const { rows } = await manuelEkle(seed.A.tenantId, run, seed.A.userId);
    const { rows: ob } = await db.sql(
      `select statement_kind from public.ledger_outbox where artifact_table = 'test_run_recovery_measurements' and artifact_id = $1`,
      [rows[0].id],
    );
    expect(ob).toHaveLength(1);
    expect(ob[0].statement_kind).toBe("RECOVERY_MEASUREMENT");
  });

  it("INSERT audit_log'a düşer", async () => {
    const run = await kosuKur(seed.A.tenantId);
    await manuelEkle(seed.A.tenantId, run, seed.A.userId);
    const { rows } = await db.sql(`select count(*)::int as n from public.audit_log where eylem = 'kurtarma_olcumu_kaydedildi' and tenant_id = $1`, [seed.A.tenantId]);
    expect(rows[0].n).toBe(1);
  });
});
