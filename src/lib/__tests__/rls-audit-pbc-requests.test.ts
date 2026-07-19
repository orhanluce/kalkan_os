// M17 "sonraki dilim" borcunun ikinci maddesi: PBC/request (ROADMAP §1.29,
// regulatory_requests deseninin sadeleştirilmiş yeniden kullanımı). PGlite.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, seedTwoTenants, type TestDb } from "./helpers/pg";

let db: TestDb;
let seed: Awaited<ReturnType<typeof seedTwoTenants>>;

async function isEkle(tenantId: string): Promise<string> {
  const { rows } = await db.sql(`insert into public.audit_engagements (tenant_id, ad, risk_seviyesi) values ($1, 'BS Denetimi', 'YUKSEK') returning id`, [tenantId]);
  return rows[0].id as string;
}
async function pbcEkle(tenantId: string, engagementId: string): Promise<string> {
  const { rows } = await db.sql(
    `insert into public.audit_pbc_requests (tenant_id, engagement_id, talep_metni) values ($1, $2, 'IAM erişim listesi') returning id`,
    [tenantId, engagementId],
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

describe("audit_pbc_requests — RLS + kural 14 disiplini (M17 sonraki dilim)", () => {
  it("cross-tenant: A'nın talebini B GÖREMEZ; misafir YAZAMAZ", async () => {
    const eid = await isEkle(seed.A.tenantId);
    const rid = await pbcEkle(seed.A.tenantId, eid);
    const { rows: b } = await db.asUser(seed.B.userId, `select id from public.audit_pbc_requests where id = $1`, [rid]);
    expect(b).toHaveLength(0);
  });

  it("kayıt yalnız ACIK doğar", async () => {
    const eid = await isEkle(seed.A.tenantId);
    await expect(
      db.sql(`insert into public.audit_pbc_requests (tenant_id, engagement_id, talep_metni, durum) values ($1, $2, 'x', 'ALINDI')`, [seed.A.tenantId, eid]),
    ).rejects.toThrow(/yalniz ACIK/);
  });

  it("ALINDI kanıtsız REDDEDİLİR", async () => {
    const eid = await isEkle(seed.A.tenantId);
    const rid = await pbcEkle(seed.A.tenantId, eid);
    await expect(
      db.sql(`update public.audit_pbc_requests set durum = 'ALINDI' where id = $1`, [rid]),
    ).rejects.toThrow(/kanit \+ tarih zorunlu/);
  });

  it("ALINDI kanıt+tarihle GEÇER + audit", async () => {
    const eid = await isEkle(seed.A.tenantId);
    const rid = await pbcEkle(seed.A.tenantId, eid);
    await db.sql(`update public.audit_pbc_requests set durum = 'ALINDI', alinan_kanit = 'export.csv', alindi_tarihi = current_date where id = $1`, [rid]);
    const { rows } = await db.sql(`select durum from public.audit_pbc_requests where id = $1`, [rid]);
    expect(rows[0].durum).toBe("ALINDI");
    const audit = await db.sql(`select count(*)::int as n from public.audit_log where hedef_tablo = 'audit_pbc_requests' and hedef_id = $1`, [rid]);
    expect(audit.rows[0].n).toBe(1);
  });

  it("KAPANDI yalnız ALINDI'dan yapılabilir (ACIK'tan doğrudan kapanamaz — kural 14 ruhu)", async () => {
    const eid = await isEkle(seed.A.tenantId);
    const rid = await pbcEkle(seed.A.tenantId, eid);
    await expect(
      db.sql(`update public.audit_pbc_requests set durum = 'KAPANDI' where id = $1`, [rid]),
    ).rejects.toThrow(/yalniz ALINDI/);
    await db.sql(`update public.audit_pbc_requests set durum = 'ALINDI', alinan_kanit = 'export.csv', alindi_tarihi = current_date where id = $1`, [rid]);
    await db.sql(`update public.audit_pbc_requests set durum = 'KAPANDI' where id = $1`, [rid]);
    const { rows } = await db.sql(`select durum from public.audit_pbc_requests where id = $1`, [rid]);
    expect(rows[0].durum).toBe("KAPANDI");
  });

  it("ALINDI sonrası kanıt alanları DONUK", async () => {
    const eid = await isEkle(seed.A.tenantId);
    const rid = await pbcEkle(seed.A.tenantId, eid);
    await db.sql(`update public.audit_pbc_requests set durum = 'ALINDI', alinan_kanit = 'export.csv', alindi_tarihi = current_date where id = $1`, [rid]);
    await expect(
      db.sql(`update public.audit_pbc_requests set alinan_kanit = 'değişti' where id = $1`, [rid]),
    ).rejects.toThrow(/donuk/);
  });
});
