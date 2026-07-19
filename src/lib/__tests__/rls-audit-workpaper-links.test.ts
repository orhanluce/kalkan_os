// M17 "sonraki dilim" borcu: workpaper→bulgu/kontrol bağı (ROADMAP §1.29,
// 20260719050000'de kaydedilmişti). Dikey 5'teki critical_service_controls
// deseninin aynısı; ONAYLANDI kağıdın bağları da DONUK. PGlite.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, seedTwoTenants, type TestDb } from "./helpers/pg";

let db: TestDb;
let seed: Awaited<ReturnType<typeof seedTwoTenants>>;

async function isEkle(tenantId: string): Promise<string> {
  const { rows } = await db.sql(`insert into public.audit_engagements (tenant_id, ad, risk_seviyesi) values ($1, 'BS Denetimi', 'YUKSEK') returning id`, [tenantId]);
  return rows[0].id as string;
}
async function wpEkle(tenantId: string, engagementId: string): Promise<string> {
  const { rows } = await db.sql(
    `insert into public.audit_workpapers (tenant_id, engagement_id, baslik, icerik, hazirlayan, hazirlama_zamani) values ($1, $2, 'WP-1', 'bulgular', $3, now()) returning id`,
    [tenantId, engagementId, seed.A.userId],
  );
  return rows[0].id as string;
}
async function findingEkle(tenantId: string): Promise<string> {
  const { rows } = await db.sql(
    `insert into public.findings (tenant_id, kaynak, onem, baslik) values ($1, 'denetim', 'yuksek', 'Bulgu-1') returning id`,
    [tenantId],
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

describe("audit_workpaper_controls / audit_workpaper_findings — RLS + donukluk (M17 sonraki dilim)", () => {
  it("cross-tenant: A'nın bağı B GÖREMEZ", async () => {
    const eid = await isEkle(seed.A.tenantId);
    const wid = await wpEkle(seed.A.tenantId, eid);
    const { rows } = await db.sql(
      `insert into public.audit_workpaper_controls (tenant_id, workpaper_id, control_id) values ($1, $2, $3) returning id`,
      [seed.A.tenantId, wid, seed.controlId],
    );
    const { rows: b } = await db.asUser(seed.B.userId, `select id from public.audit_workpaper_controls where id = $1`, [rows[0].id]);
    expect(b).toHaveLength(0);
  });

  it("aynı workpaper→kontrol çifti İKİNCİ kez bağlanamaz (unique)", async () => {
    const eid = await isEkle(seed.A.tenantId);
    const wid = await wpEkle(seed.A.tenantId, eid);
    await db.sql(`insert into public.audit_workpaper_controls (tenant_id, workpaper_id, control_id) values ($1, $2, $3)`, [seed.A.tenantId, wid, seed.controlId]);
    await expect(
      db.sql(`insert into public.audit_workpaper_controls (tenant_id, workpaper_id, control_id) values ($1, $2, $3)`, [seed.A.tenantId, wid, seed.controlId]),
    ).rejects.toThrow();
  });

  it("bulgu bağı kurulabilir + görünür", async () => {
    const eid = await isEkle(seed.A.tenantId);
    const wid = await wpEkle(seed.A.tenantId, eid);
    const fid = await findingEkle(seed.A.tenantId);
    const { rows } = await db.sql(
      `insert into public.audit_workpaper_findings (tenant_id, workpaper_id, finding_id) values ($1, $2, $3) returning id`,
      [seed.A.tenantId, wid, fid],
    );
    expect(rows).toHaveLength(1);
  });

  it("ONAYLANDI çalışma kağıdına YENİ bağ eklenemez (sign-off sonrası donuk)", async () => {
    const eid = await isEkle(seed.A.tenantId);
    const wid = await wpEkle(seed.A.tenantId, eid);
    await db.sql(`update public.audit_workpapers set durum = 'ONAYLANDI', reviewer = $2, review_zamani = now() where id = $1`, [wid, seed.B.userId]);
    await expect(
      db.sql(`insert into public.audit_workpaper_controls (tenant_id, workpaper_id, control_id) values ($1, $2, $3)`, [seed.A.tenantId, wid, seed.controlId]),
    ).rejects.toThrow(/donuk/);
  });

  it("ONAYLANDI çalışma kağıdının mevcut bağı SİLİNEMEZ", async () => {
    const eid = await isEkle(seed.A.tenantId);
    const wid = await wpEkle(seed.A.tenantId, eid);
    const { rows } = await db.sql(`insert into public.audit_workpaper_controls (tenant_id, workpaper_id, control_id) values ($1, $2, $3) returning id`, [seed.A.tenantId, wid, seed.controlId]);
    await db.sql(`update public.audit_workpapers set durum = 'ONAYLANDI', reviewer = $2, review_zamani = now() where id = $1`, [wid, seed.B.userId]);
    await expect(db.sql(`delete from public.audit_workpaper_controls where id = $1`, [rows[0].id])).rejects.toThrow(/donuk/);
  });

  it("TASLAK/İNCELEME kağıda bağ eklenebilir/silinebilir (donuk değil)", async () => {
    const eid = await isEkle(seed.A.tenantId);
    const wid = await wpEkle(seed.A.tenantId, eid);
    const { rows } = await db.sql(`insert into public.audit_workpaper_controls (tenant_id, workpaper_id, control_id) values ($1, $2, $3) returning id`, [seed.A.tenantId, wid, seed.controlId]);
    await db.sql(`delete from public.audit_workpaper_controls where id = $1`, [rows[0].id]);
    const { rows: after } = await db.sql(`select id from public.audit_workpaper_controls where workpaper_id = $1`, [wid]);
    expect(after).toHaveLength(0);
  });

  it("misafir (denetci_misafir) YAZAMAZ", async () => {
    const misafirId = "a0000000-0000-0000-0000-000000000009";
    await db.sql(`insert into auth.users (id, email) values ($1, 'misafir@demo.com')`, [misafirId]);
    await db.sql(`insert into public.profiles (id, tenant_id, role, full_name) values ($1, $2, 'denetci_misafir', 'Misafir')`, [misafirId, seed.A.tenantId]);
    const eid = await isEkle(seed.A.tenantId);
    const wid = await wpEkle(seed.A.tenantId, eid);
    await expect(
      db.asUser(misafirId, `insert into public.audit_workpaper_controls (tenant_id, workpaper_id, control_id) values ($1, $2, $3)`, [seed.A.tenantId, wid, seed.controlId]),
    ).rejects.toThrow();
  });
});
