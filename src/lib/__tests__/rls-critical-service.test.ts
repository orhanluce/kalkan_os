// M13 (G8): kritik hizmet + etki toleransı — cross-tenant, YÖNETİM ONAYI şartı,
// yürürlükteki eşik donukluğu, tek-yürürlükte, M35 tedarikçi bağı. PGlite.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, seedTwoTenants, type TestDb } from "./helpers/pg";

let db: TestDb;
let seed: Awaited<ReturnType<typeof seedTwoTenants>>;
const A_MISAFIR = "a0000000-0000-0000-0000-000000000009";

beforeEach(async () => {
  db = await createTestDb();
  seed = await seedTwoTenants(db);
  await db.sql(`insert into auth.users (id, email) values ($1, 'misafir@demo.com')`, [A_MISAFIR]);
  await db.sql(`insert into public.profiles (id, tenant_id, role, full_name) values ($1, $2, 'denetci_misafir', 'Misafir')`, [A_MISAFIR, seed.A.tenantId]);
});

afterEach(async () => {
  await db.close();
});

async function hizmetEkle(tenantId: string, ad = "Müşteri ödemesi"): Promise<string> {
  const { rows } = await db.sql(`insert into public.critical_business_services (tenant_id, ad) values ($1, $2) returning id`, [tenantId, ad]);
  return rows[0].id as string;
}
async function toleransEkle(tenantId: string, serviceId: string, surum = 1): Promise<string> {
  const { rows } = await db.sql(
    `insert into public.impact_tolerances (tenant_id, critical_service_id, surum, max_kesinti_saat) values ($1, $2, $3, 4) returning id`,
    [tenantId, serviceId, surum],
  );
  return rows[0].id as string;
}

describe("critical service & impact tolerance — RLS + invariant (M13)", () => {
  it("cross-tenant: A'nın hizmetini B GÖREMEZ; misafir YAZAMAZ", async () => {
    const id = await hizmetEkle(seed.A.tenantId);
    const { rows: b } = await db.asUser(seed.B.userId, `select id from public.critical_business_services where id = $1`, [id]);
    expect(b).toHaveLength(0);
    await expect(
      db.asUser(A_MISAFIR, `insert into public.critical_business_services (tenant_id, ad) values ($1, 'X')`, [seed.A.tenantId]),
    ).rejects.toThrow();
  });

  it("YÖNETİM ONAYI: tolerans onaysız YÜRÜRLÜĞE giremez; onaylı geçer + audit", async () => {
    const sid = await hizmetEkle(seed.A.tenantId);
    const tid = await toleransEkle(seed.A.tenantId, sid);
    await expect(
      db.sql(`update public.impact_tolerances set durum = 'YURURLUKTE' where id = $1`, [tid]),
    ).rejects.toThrow(/yonetim onayi/);
    await db.sql(`update public.impact_tolerances set durum = 'YURURLUKTE', yonetim_onayi = true, onaylayan = $2, onay_zamani = now() where id = $1`, [tid, seed.A.userId]);
    const { rows } = await db.sql(`select durum from public.impact_tolerances where id = $1`, [tid]);
    expect(rows[0].durum).toBe("YURURLUKTE");
    const { rows: audit } = await db.sql(`select count(*)::int as n from public.audit_log where hedef_tablo = 'impact_tolerances' and hedef_id = $1`, [tid]);
    expect(audit[0].n).toBe(1);
  });

  it("yürürlükteki toleransın eşikleri DONUK (değişiklik yeni sürüm ister)", async () => {
    const sid = await hizmetEkle(seed.A.tenantId);
    const tid = await toleransEkle(seed.A.tenantId, sid);
    await db.sql(`update public.impact_tolerances set durum = 'YURURLUKTE', yonetim_onayi = true, onaylayan = $2, onay_zamani = now() where id = $1`, [tid, seed.A.userId]);
    await expect(
      db.sql(`update public.impact_tolerances set max_kesinti_saat = 2 where id = $1`, [tid]),
    ).rejects.toThrow(/degistirilemez/);
  });

  it("bir hizmetin İKİ yürürlükteki toleransı olamaz (partial unique)", async () => {
    const sid = await hizmetEkle(seed.A.tenantId);
    const t1 = await toleransEkle(seed.A.tenantId, sid, 1);
    await db.sql(`update public.impact_tolerances set durum = 'YURURLUKTE', yonetim_onayi = true, onaylayan = $2, onay_zamani = now() where id = $1`, [t1, seed.A.userId]);
    const t2 = await toleransEkle(seed.A.tenantId, sid, 2);
    await expect(
      db.sql(`update public.impact_tolerances set durum = 'YURURLUKTE', yonetim_onayi = true, onaylayan = $2, onay_zamani = now() where id = $1`, [t2, seed.A.userId]),
    ).rejects.toThrow();
  });

  it("bağımlılık M35 tedarikçisine bağlanabilir + tekil nokta işareti", async () => {
    const sid = await hizmetEkle(seed.A.tenantId);
    const { rows: tp } = await db.sql(`insert into public.third_parties (tenant_id, ad, tier) values ($1, 'Bulut A.Ş.', 'KRITIK') returning id`, [seed.A.tenantId]);
    await db.sql(
      `insert into public.service_dependencies (tenant_id, critical_service_id, bagimlilik_turu, ad, third_party_id, tekil_nokta) values ($1, $2, 'TEDARIKCI', 'Bulut A.Ş.', $3, true)`,
      [seed.A.tenantId, sid, tp[0].id],
    );
    const { rows } = await db.sql(`select tekil_nokta, third_party_id from public.service_dependencies where critical_service_id = $1`, [sid]);
    expect(rows[0].tekil_nokta).toBe(true);
    expect(rows[0].third_party_id).toBe(tp[0].id);
  });
});

// Dikey F, F5 hazırlık — Karar A: impact_tolerances.superseded_at forward-fix
// (20260721050000). Emsal: applicability_decisions bitemporal deseni.
describe("impact_tolerances — superseded_at (Dikey F, F5 Karar A)", () => {
  async function yururluge(id: string, onayZamani: string) {
    return db.sql(
      `update public.impact_tolerances set durum = 'YURURLUKTE', yonetim_onayi = true, onaylayan = $2, onay_zamani = $3 where id = $1`,
      [id, seed.A.userId, onayZamani],
    );
  }
  async function supprese(id: string) {
    return db.sql(`update public.impact_tolerances set durum = 'SUPERSEDED' where id = $1`, [id]);
  }

  it("yeni sürüm YURURLUKTE olunca, süprese edilmiş+damgasız sürümün superseded_at'i SUNUCU tarafında dolar", async () => {
    const sid = await hizmetEkle(seed.A.tenantId);
    const t1 = await toleransEkle(seed.A.tenantId, sid, 1);
    await yururluge(t1, "2026-01-01T00:00:00Z");
    await supprese(t1); // istemcinin mevcut iki-adımlı akışı: önce eskiyi kapat
    const t2 = await toleransEkle(seed.A.tenantId, sid, 2);
    await yururluge(t2, "2026-06-01T00:00:00Z");
    const { rows } = await db.sql(`select superseded_at from public.impact_tolerances where id = $1`, [t1]);
    expect(new Date(rows[0].superseded_at as string).toISOString()).toBe("2026-06-01T00:00:00.000Z");
  });

  it("superseded_at bir kez yazıldıktan sonra DEĞİŞTİRİLEMEZ (geri alınamaz)", async () => {
    const sid = await hizmetEkle(seed.A.tenantId);
    const t1 = await toleransEkle(seed.A.tenantId, sid, 1);
    await yururluge(t1, "2026-01-01T00:00:00Z");
    await supprese(t1);
    const t2 = await toleransEkle(seed.A.tenantId, sid, 2);
    await yururluge(t2, "2026-06-01T00:00:00Z"); // t1.superseded_at otomatik dolar
    await expect(db.sql(`update public.impact_tolerances set superseded_at = null where id = $1`, [t1])).rejects.toThrow(/degistirilemez/);
    await expect(
      db.sql(`update public.impact_tolerances set superseded_at = '2027-01-01T00:00:00Z' where id = $1`, [t1]),
    ).rejects.toThrow(/degistirilemez/);
  });

  it("superseded_at, kaydın KENDİ onay_zamanindan ÖNCE olamaz", async () => {
    const sid = await hizmetEkle(seed.A.tenantId);
    const t1 = await toleransEkle(seed.A.tenantId, sid, 1);
    await yururluge(t1, "2026-06-01T00:00:00Z");
    await supprese(t1);
    await expect(
      db.sql(`update public.impact_tolerances set superseded_at = '2026-01-01T00:00:00Z' where id = $1`, [t1]),
    ).rejects.toThrow(/once olamaz/);
  });

  it("yeni sürümün onay_zamani, kapatılacak önceki sürümün onay_zamanindan ÖNCE ise reddedilir (kronoloji ihlali)", async () => {
    const sid = await hizmetEkle(seed.A.tenantId);
    const t1 = await toleransEkle(seed.A.tenantId, sid, 1);
    await yururluge(t1, "2026-06-01T00:00:00Z");
    await supprese(t1);
    const t2 = await toleransEkle(seed.A.tenantId, sid, 2);
    await expect(yururluge(t2, "2026-01-01T00:00:00Z")).rejects.toThrow(/once olamaz/);
  });

  it("SUPERSEDED kayıtta superseded_at DIŞINDA hiçbir alan değişemez", async () => {
    const sid = await hizmetEkle(seed.A.tenantId);
    const t1 = await toleransEkle(seed.A.tenantId, sid, 1);
    await yururluge(t1, "2026-01-01T00:00:00Z");
    await supprese(t1);
    await expect(db.sql(`update public.impact_tolerances set max_kesinti_saat = 99 where id = $1`, [t1])).rejects.toThrow(/duzenlenemez/);
  });

  it("impact_tolerance_asof: onay_zamani DAHİL, superseded_at HARİÇ sınır semantiği", async () => {
    const sid = await hizmetEkle(seed.A.tenantId);
    const t1 = await toleransEkle(seed.A.tenantId, sid, 1);
    await yururluge(t1, "2026-01-01T00:00:00Z");
    await supprese(t1);
    const t2 = await toleransEkle(seed.A.tenantId, sid, 2);
    await yururluge(t2, "2026-06-01T00:00:00Z");

    // Tam onay_zamani anı -> o sürüm DAHİL (t1).
    const { rows: tamOnayAni } = await db.sql(`select id from public.impact_tolerance_asof($1, '2026-01-01T00:00:00Z') as t`, [sid]);
    expect(tamOnayAni[0]?.id).toBe(t1);

    // t1 ve t2 arası -> hâlâ t1 (t2 henüz yürürlüğe girmedi).
    const { rows: arada } = await db.sql(`select id from public.impact_tolerance_asof($1, '2026-03-01T00:00:00Z') as t`, [sid]);
    expect(arada[0]?.id).toBe(t1);

    // Tam t2'nin onay_zamani anı (=t1'in superseded_at'i) -> t1 ARTIK GEÇERSİZ, t2 DAHİL.
    const { rows: gecisAni } = await db.sql(`select id from public.impact_tolerance_asof($1, '2026-06-01T00:00:00Z') as t`, [sid]);
    expect(gecisAni[0]?.id).toBe(t2);

    // t1'in onay_zamanindan ÖNCE -> hiç yürürlükte sürüm yok (null).
    const { rows: oncesi } = await db.sql(`select id from public.impact_tolerance_asof($1, '2025-01-01T00:00:00Z') as t`, [sid]);
    expect(oncesi[0]?.id).toBeNull();
  });
});
