// M17 "sonraki dilim" borcunun üçüncü maddesi: mevcut G7 tablosunun
// (independence_declarations) audit_engagements'e genelleştirilmesi
// (ROADMAP §1.29). Bağlam invaryantı: TAM OLARAK bir bağlam (matter YA DA
// engagement). PGlite.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, seedTwoTenants, type TestDb } from "./helpers/pg";

let db: TestDb;
let seed: Awaited<ReturnType<typeof seedTwoTenants>>;

async function isEkle(tenantId: string): Promise<string> {
  const { rows } = await db.sql(`insert into public.audit_engagements (tenant_id, ad, risk_seviyesi) values ($1, 'BS Denetimi', 'YUKSEK') returning id`, [tenantId]);
  return rows[0].id as string;
}
async function matterEkle(tenantId: string): Promise<string> {
  const { rows } = await db.sql(`insert into public.regulatory_matters (tenant_id, otorite, konu) values ($1, 'SPK', 'İnceleme') returning id`, [tenantId]);
  return rows[0].id as string;
}

beforeEach(async () => {
  db = await createTestDb();
  seed = await seedTwoTenants(db);
});
afterEach(async () => {
  await db.close();
});

describe("independence_declarations — engagement genellemesi (M17 sonraki dilim)", () => {
  it("engagement_id ile beyan eklenebilir (matter_id NULL)", async () => {
    const eid = await isEkle(seed.A.tenantId);
    const { rows } = await db.sql(
      `insert into public.independence_declarations (tenant_id, engagement_id, external_email, beyan_eden_ad, cikar_catismasi_yok) values ($1, $2, 'denetci@ornek.com', 'Denetçi A', true) returning id`,
      [seed.A.tenantId, eid],
    );
    expect(rows).toHaveLength(1);
  });

  it("matter_id ile beyan HÂLÂ eklenebilir (regresyon — mevcut M38 akışı bozulmadı)", async () => {
    const mid = await matterEkle(seed.A.tenantId);
    const { rows } = await db.sql(
      `insert into public.independence_declarations (tenant_id, matter_id, external_email, beyan_eden_ad, cikar_catismasi_yok) values ($1, $2, 'd@x.com', 'D', true) returning id`,
      [seed.A.tenantId, mid],
    );
    expect(rows).toHaveLength(1);
  });

  it("İKİSİ BİRDEN (matter_id + engagement_id) REDDEDİLİR", async () => {
    const eid = await isEkle(seed.A.tenantId);
    const mid = await matterEkle(seed.A.tenantId);
    await expect(
      db.sql(
        `insert into public.independence_declarations (tenant_id, matter_id, engagement_id, external_email, beyan_eden_ad, cikar_catismasi_yok) values ($1, $2, $3, 'x@x.com', 'X', true)`,
        [seed.A.tenantId, mid, eid],
      ),
    ).rejects.toThrow();
  });

  it("HİÇBİRİ (ikisi de NULL) REDDEDİLİR", async () => {
    await expect(
      db.sql(
        `insert into public.independence_declarations (tenant_id, external_email, beyan_eden_ad, cikar_catismasi_yok) values ($1, 'x@x.com', 'X', true)`,
        [seed.A.tenantId],
      ),
    ).rejects.toThrow();
  });

  it("cross-tenant: A'nın engagement beyanını B GÖREMEZ", async () => {
    const eid = await isEkle(seed.A.tenantId);
    const { rows } = await db.sql(
      `insert into public.independence_declarations (tenant_id, engagement_id, external_email, beyan_eden_ad, cikar_catismasi_yok) values ($1, $2, 'd@x.com', 'D', true) returning id`,
      [seed.A.tenantId, eid],
    );
    const { rows: b } = await db.asUser(seed.B.userId, `select id from public.independence_declarations where id = $1`, [rows[0].id]);
    expect(b).toHaveLength(0);
  });

  it("misafir (denetci_misafir) YAZAMAZ", async () => {
    const misafirId = "a0000000-0000-0000-0000-000000000009";
    await db.sql(`insert into auth.users (id, email) values ($1, 'misafir@demo.com')`, [misafirId]);
    await db.sql(`insert into public.profiles (id, tenant_id, role, full_name) values ($1, $2, 'denetci_misafir', 'Misafir')`, [misafirId, seed.A.tenantId]);
    const eid = await isEkle(seed.A.tenantId);
    await expect(
      db.asUser(
        misafirId,
        `insert into public.independence_declarations (tenant_id, engagement_id, external_email, beyan_eden_ad, cikar_catismasi_yok) values ($1, $2, 'x@x.com', 'X', true)`,
        [seed.A.tenantId, eid],
      ),
    ).rejects.toThrow();
  });
});
