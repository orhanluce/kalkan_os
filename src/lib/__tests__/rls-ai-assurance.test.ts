// M37 (G5): AI governance — cross-tenant, PROHIBITED-aktif-yasağı, yazma-yetkisi
// insan-onay şartı, AI Decision Receipt karar sınırı (AI kendi önerisini kabul
// edemez; karar insan reviewer'a sabit; karara bağlı receipt donuk). PGlite.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, seedTwoTenants, type TestDb } from "./helpers/pg";

let db: TestDb;
let seed: Awaited<ReturnType<typeof seedTwoTenants>>;
const A_MISAFIR = "a0000000-0000-0000-0000-000000000009";

async function sistemEkle(tenantId: string, risk = "HIGH"): Promise<string> {
  const { rows } = await db.sql(
    `insert into public.ai_systems (tenant_id, ad, rol, risk_sinifi) values ($1, 'RAG Copilot', 'DEPLOYER', $2) returning id`,
    [tenantId, risk],
  );
  return rows[0].id as string;
}

beforeEach(async () => {
  db = await createTestDb();
  seed = await seedTwoTenants(db);
  await db.sql(`insert into auth.users (id, email) values ($1, 'misafir@demo.com')`, [A_MISAFIR]);
  await db.sql(`insert into public.profiles (id, tenant_id, role, full_name) values ($1, $2, 'denetci_misafir', 'Misafir')`, [A_MISAFIR, seed.A.tenantId]);
});

afterEach(async () => {
  await db.close();
});

describe("AI governance — RLS + karar sınırı (M37)", () => {
  it("cross-tenant: A'nın sistemini B GÖREMEZ; misafir YAZAMAZ", async () => {
    const id = await sistemEkle(seed.A.tenantId);
    const { rows: b } = await db.asUser(seed.B.userId, `select id from public.ai_systems where id = $1`, [id]);
    expect(b).toHaveLength(0);
    await expect(
      db.asUser(A_MISAFIR, `insert into public.ai_systems (tenant_id, ad) values ($1, 'X')`, [seed.A.tenantId]),
    ).rejects.toThrow();
  });

  it("YASAK UYGULAMA: PROHIBITED risk sınıflı sistem AKTIF EDİLEMEZ", async () => {
    const id = await sistemEkle(seed.A.tenantId, "PROHIBITED");
    await expect(
      db.sql(`update public.ai_systems set durum = 'AKTIF' where id = $1`, [id]),
    ).rejects.toThrow(/yasak uygulama/i);
    // Doğuşta da AKTIF olamaz.
    await expect(
      db.sql(`insert into public.ai_systems (tenant_id, ad, risk_sinifi, durum) values ($1, 'Y', 'PROHIBITED', 'AKTIF')`, [seed.A.tenantId]),
    ).rejects.toThrow(/yasak uygulama/i);
  });

  it("yazma yetkisi olan ajan İNSAN ONAYI gerektirir (otonom yazan ajan yasak)", async () => {
    const sid = await sistemEkle(seed.A.tenantId);
    await expect(
      db.sql(`insert into public.ai_agents (tenant_id, ai_system_id, ad, yazma_yetkisi, insan_onay_gerekli) values ($1, $2, 'Ajan', true, false)`, [seed.A.tenantId, sid]),
    ).rejects.toThrow(/insan onayi gerektirir/);
    // Onay şartıyla geçer.
    await db.sql(`insert into public.ai_agents (tenant_id, ai_system_id, ad, yazma_yetkisi, insan_onay_gerekli) values ($1, $2, 'Ajan', true, true)`, [seed.A.tenantId, sid]);
  });

  it("kill/disable: DEVRE_DISI'ye geçince devre_disi_at otomatik damgalanır", async () => {
    const sid = await sistemEkle(seed.A.tenantId);
    const { rows: a } = await db.sql(`insert into public.ai_agents (tenant_id, ai_system_id, ad) values ($1, $2, 'Ajan') returning id`, [seed.A.tenantId, sid]);
    await db.sql(`update public.ai_agents set durum = 'DEVRE_DISI' where id = $1`, [a[0].id]);
    const { rows } = await db.sql(`select devre_disi_at from public.ai_agents where id = $1`, [a[0].id]);
    expect(rows[0].devre_disi_at).not.toBeNull();
  });

  it("AI KARAR SINIRI: receipt SUGGESTED doğar; AI (service) kabul EDEMEZ; içerik donuk", async () => {
    const sid = await sistemEkle(seed.A.tenantId);
    // ACCEPTED doğum reddi.
    await expect(
      db.sql(`insert into public.ai_execution_receipts (tenant_id, ai_system_id, amac, karar) values ($1, $2, 'öneri', 'ACCEPTED')`, [seed.A.tenantId, sid]),
    ).rejects.toThrow(/SUGGESTED dogmali/);
    const { rows: r } = await db.sql(
      `insert into public.ai_execution_receipts (tenant_id, ai_system_id, amac) values ($1, $2, 'öneri') returning id`,
      [seed.A.tenantId, sid],
    );
    // Service bağlamı (auth.uid null) kabul edemez.
    await expect(
      db.sql(`update public.ai_execution_receipts set karar = 'ACCEPTED', reviewer = $2, reviewer_karar_zamani = now() where id = $1`, [r[0].id, seed.A.userId]),
    ).rejects.toThrow(/oturum sahibi \(insan\)/);
    // İnsan (asUser) reviewer'sız kabul reddi.
    await expect(
      db.asUser(seed.A.userId, `update public.ai_execution_receipts set karar = 'ACCEPTED' where id = $1`, [r[0].id]),
    ).rejects.toThrow(/INSAN reviewer/);
    // İnsan kendi adına kabul eder.
    await db.asUser(seed.A.userId, `update public.ai_execution_receipts set karar = 'ACCEPTED', reviewer = $2, reviewer_karar_zamani = now() where id = $1`, [r[0].id, seed.A.userId]);
    // Karara bağlı receipt artık donuk.
    await expect(
      db.asUser(seed.A.userId, `update public.ai_execution_receipts set amac = 'değişti' where id = $1`, [r[0].id]),
    ).rejects.toThrow(/degistirilemez/);
  });

  it("başka reviewer adına karar verilemez (kimlik atfı)", async () => {
    const sid = await sistemEkle(seed.A.tenantId);
    const { rows: r } = await db.sql(`insert into public.ai_execution_receipts (tenant_id, ai_system_id, amac) values ($1, $2, 'öneri') returning id`, [seed.A.tenantId, sid]);
    await expect(
      db.asUser(seed.A.userId, `update public.ai_execution_receipts set karar = 'REJECTED', reviewer = $2, reviewer_karar_zamani = now() where id = $1`, [r[0].id, seed.B.userId]),
    ).rejects.toThrow(/oturum sahibi/);
  });

  it("audit: receipt kararı audit_log'a düşer", async () => {
    const sid = await sistemEkle(seed.A.tenantId);
    const { rows: r } = await db.sql(`insert into public.ai_execution_receipts (tenant_id, ai_system_id, amac) values ($1, $2, 'öneri') returning id`, [seed.A.tenantId, sid]);
    await db.asUser(seed.A.userId, `update public.ai_execution_receipts set karar = 'ACCEPTED', reviewer = $2, reviewer_karar_zamani = now() where id = $1`, [r[0].id, seed.A.userId]);
    const { rows } = await db.sql(`select eylem from public.audit_log where hedef_tablo = 'ai_execution_receipts' and hedef_id = $1`, [r[0].id]);
    expect(rows.map((x) => x.eylem)).toContain("ai_receipt_karar");
  });
});
