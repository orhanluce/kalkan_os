// M38 sonraki dilim: regülatör toplantı kaydı — RLS + kimlik atfı + audit.
// PGlite gerçek migration'lara karşı.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, seedTwoTenants, type TestDb } from "./helpers/pg";

let db: TestDb;
let seed: Awaited<ReturnType<typeof seedTwoTenants>>;
const A_MISAFIR = "a0000000-0000-0000-0000-000000000009";

async function matterKur(tenantId: string) {
  const { rows } = await db.sql(
    `insert into public.regulatory_matters (tenant_id, otorite, konu) values ($1, 'SPK', 'M') returning id`,
    [tenantId],
  );
  return rows[0].id as string;
}

beforeEach(async () => {
  db = await createTestDb();
  seed = await seedTwoTenants(db);
  await db.sql(`insert into auth.users (id, email) values ($1, 'misafir@demo.com')`, [A_MISAFIR]);
  await db.sql(
    `insert into public.profiles (id, tenant_id, role, full_name) values ($1, $2, 'denetci_misafir', 'Misafir')`,
    [A_MISAFIR, seed.A.tenantId],
  );
});
afterEach(async () => {
  await db.close();
});

describe("regülatör toplantı kaydı — RLS + kimlik atfı + audit (M38 sonraki dilim)", () => {
  it("toplantı kaydedilir + audit'e düşer", async () => {
    const matterId = await matterKur(seed.A.tenantId);
    const { rows } = await db.asUser(
      seed.A.userId,
      `insert into public.regulatory_meetings (tenant_id, matter_id, konu, katilimcilar, kayit_eden)
       values ($1, $2, 'Saha ziyareti', array['A. Yılmaz (SPK)', 'B. Demir (Uyum)'], $3) returning id`,
      [seed.A.tenantId, matterId, seed.A.userId],
    );
    expect(rows[0].id).toBeTruthy();
    const audit = await db.sql(
      `select count(*)::int as n from public.audit_log where hedef_tablo = 'regulatory_meetings' and hedef_id = $1 and eylem = 'regulator_toplantisi_kaydedildi'`,
      [rows[0].id],
    );
    expect(audit.rows[0].n).toBe(1);
  });

  it("kimlik atfı: kayıt eden ancak oturum sahibi adına girilebilir", async () => {
    const matterId = await matterKur(seed.A.tenantId);
    await expect(
      db.asUser(
        seed.A.userId,
        `insert into public.regulatory_meetings (tenant_id, matter_id, konu, kayit_eden) values ($1, $2, 'K', $3)`,
        [seed.A.tenantId, matterId, "00000000-0000-0000-0000-000000000099"],
      ),
    ).rejects.toThrow(/kimlik atfi/);
  });

  it("cross-tenant: A'nın toplantısı B'ye görünmez; misafir yazamaz", async () => {
    const matterId = await matterKur(seed.A.tenantId);
    const { rows } = await db.sql(
      `insert into public.regulatory_meetings (tenant_id, matter_id, konu) values ($1, $2, 'K') returning id`,
      [seed.A.tenantId, matterId],
    );
    const { rows: b } = await db.asUser(seed.B.userId, `select id from public.regulatory_meetings where id = $1`, [rows[0].id]);
    expect(b).toHaveLength(0);
    await expect(
      db.asUser(
        A_MISAFIR,
        `insert into public.regulatory_meetings (tenant_id, matter_id, konu) values ($1, $2, 'K')`,
        [seed.A.tenantId, matterId],
      ),
    ).rejects.toThrow();
  });
});
