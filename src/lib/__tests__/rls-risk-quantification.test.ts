// M40 (G8): risk appetite/KRI/senaryo — cross-tenant, iştah yönetim onayı,
// senaryo VARSAYIM zorunlu + dağılım tutarlı (min≤olası≤max). PGlite.
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

describe("risk quantification — RLS + CRQ invariant (M40)", () => {
  it("cross-tenant: A'nın risk iştahını B GÖREMEZ; misafir YAZAMAZ", async () => {
    const { rows } = await db.sql(`insert into public.risk_appetites (tenant_id, kategori, esik) values ($1, 'SIBER', 5) returning id`, [seed.A.tenantId]);
    const { rows: b } = await db.asUser(seed.B.userId, `select id from public.risk_appetites where id = $1`, [rows[0].id]);
    expect(b).toHaveLength(0);
    await expect(
      db.asUser(A_MISAFIR, `insert into public.risk_appetites (tenant_id, kategori, esik) values ($1, 'SIBER', 5)`, [seed.A.tenantId]),
    ).rejects.toThrow();
  });

  it("risk iştahı YÜRÜRLÜĞE ancak yönetim onayıyla + audit", async () => {
    const { rows } = await db.sql(`insert into public.risk_appetites (tenant_id, kategori, esik) values ($1, 'OPERASYONEL', 3) returning id`, [seed.A.tenantId]);
    await expect(
      db.sql(`update public.risk_appetites set durum = 'YURURLUKTE' where id = $1`, [rows[0].id]),
    ).rejects.toThrow(/yonetim onayi/);
    await db.sql(`update public.risk_appetites set durum = 'YURURLUKTE', yonetim_onayi = true, onaylayan = $2, onay_zamani = now() where id = $1`, [rows[0].id, seed.A.userId]);
    const { rows: a } = await db.sql(`select count(*)::int as n from public.audit_log where hedef_tablo = 'risk_appetites' and hedef_id = $1`, [rows[0].id]);
    expect(a[0].n).toBe(1);
  });

  it("SENARYO: varsayım ZORUNLU; kayıp dağılımı tutarlı (min≤olası≤max)", async () => {
    // Varsayımsız → NOT NULL reddi.
    await expect(
      db.sql(`insert into public.risk_scenarios (tenant_id, ad, kayip_min, kayip_olasi, kayip_max) values ($1, 'Fidye', 100, 300, 1000)`, [seed.A.tenantId]),
    ).rejects.toThrow();
    // Tutarsız dağılım (olası > max) → check reddi.
    await expect(
      db.sql(`insert into public.risk_scenarios (tenant_id, ad, kayip_min, kayip_olasi, kayip_max, varsayimlar) values ($1, 'Fidye', 100, 2000, 1000, 'v')`, [seed.A.tenantId]),
    ).rejects.toThrow();
    // Geçerli: varsayım + tutarlı dağılım.
    await db.sql(
      `insert into public.risk_scenarios (tenant_id, ad, kayip_min, kayip_olasi, kayip_max, varsayimlar, kontrol_maliyeti, risk_azaltma) values ($1, 'Fidye', 100, 300, 1000, 'Yıllık 1 olay varsayımı', 5000, 20000)`,
      [seed.A.tenantId],
    );
    const { rows } = await db.sql(`select varsayimlar from public.risk_scenarios where tenant_id = $1`, [seed.A.tenantId]);
    expect(rows[0].varsayimlar).toContain("varsayımı");
  });

  it("KRI + okuma trendi kaydedilir", async () => {
    const { rows: k } = await db.sql(`insert into public.key_risk_indicators (tenant_id, ad, esik, yon) values ($1, 'Açık kritik bulgu', 5, 'UST') returning id`, [seed.A.tenantId]);
    await db.sql(`insert into public.kri_readings (tenant_id, kri_id, deger, olcum_tarihi) values ($1, $2, 8, current_date)`, [seed.A.tenantId, k[0].id]);
    await db.sql(`insert into public.kri_readings (tenant_id, kri_id, deger, olcum_tarihi) values ($1, $2, 4, current_date - 30)`, [seed.A.tenantId, k[0].id]);
    const { rows } = await db.sql(`select count(*)::int as n from public.kri_readings where kri_id = $1`, [k[0].id]);
    expect(rows[0].n).toBe(2);
  });
});
