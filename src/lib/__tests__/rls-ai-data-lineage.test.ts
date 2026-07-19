// AI eval veri-soyağacı (nihai talimat v3.2 §8.0 sonu, öncelik #2): RLS +
// eval/tenant tutarlılık guard'ı + audit. PGlite gerçek migration'lara karşı.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, seedTwoTenants, type TestDb } from "./helpers/pg";

let db: TestDb;
let seed: Awaited<ReturnType<typeof seedTwoTenants>>;
const A_MISAFIR = "a0000000-0000-0000-0000-000000000009";

async function aiSistemVeEval(tenantId: string) {
  const s = await db.sql(`insert into public.ai_systems (tenant_id, ad) values ($1, 'S') returning id`, [tenantId]);
  const e = await db.sql(
    `insert into public.ai_evaluations (tenant_id, ai_system_id, tur) values ($1, $2, 'BIAS') returning id`,
    [tenantId, s.rows[0].id],
  );
  return e.rows[0].id as string;
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

describe("AI eval veri-soyağacı — RLS + tutarlılık (§8.0 sonu öncelik #2)", () => {
  it("soyağacı eklenir + audit'e düşer", async () => {
    const evalId = await aiSistemVeEval(seed.A.tenantId);
    const { rows } = await db.sql(
      `insert into public.ai_data_lineage (tenant_id, ai_evaluation_id, tur, ad) values ($1, $2, 'DEGERLENDIRME_VERISI', 'Q2 seti') returning id`,
      [seed.A.tenantId, evalId],
    );
    expect(rows[0].id).toBeTruthy();
    const audit = await db.sql(
      `select count(*)::int as n from public.audit_log where hedef_tablo = 'ai_data_lineage' and hedef_id = $1`,
      [rows[0].id],
    );
    expect(audit.rows[0].n).toBe(1);
  });

  it("başka kiracının eval'ına soyağacı eklenmesi reddedilir (tutarlılık guard'ı)", async () => {
    const evalB = await aiSistemVeEval(seed.B.tenantId);
    await expect(
      db.sql(
        `insert into public.ai_data_lineage (tenant_id, ai_evaluation_id, tur, ad) values ($1, $2, 'MODEL_SURUMU', 'x')`,
        [seed.A.tenantId, evalB],
      ),
    ).rejects.toThrow(/ayni kiraciya/);
  });

  it("veri_hash biçimi zorlanır (64-hex veya null)", async () => {
    const evalId = await aiSistemVeEval(seed.A.tenantId);
    await expect(
      db.sql(
        `insert into public.ai_data_lineage (tenant_id, ai_evaluation_id, tur, ad, veri_hash) values ($1, $2, 'EGITIM_VERISI', 'x', 'kisa')`,
        [seed.A.tenantId, evalId],
      ),
    ).rejects.toThrow();
    await db.sql(
      `insert into public.ai_data_lineage (tenant_id, ai_evaluation_id, tur, ad, veri_hash) values ($1, $2, 'EGITIM_VERISI', 'x', $3)`,
      [seed.A.tenantId, evalId, "a".repeat(64)],
    );
  });

  it("cross-tenant: A'nın soyağacı B'ye görünmez; misafir yazamaz", async () => {
    const evalId = await aiSistemVeEval(seed.A.tenantId);
    const { rows } = await db.sql(
      `insert into public.ai_data_lineage (tenant_id, ai_evaluation_id, tur, ad) values ($1, $2, 'REFERANS_KIYAS', 'r') returning id`,
      [seed.A.tenantId, evalId],
    );
    const { rows: b } = await db.asUser(seed.B.userId, `select id from public.ai_data_lineage where id = $1`, [rows[0].id]);
    expect(b).toHaveLength(0);
    await expect(
      db.asUser(
        A_MISAFIR,
        `insert into public.ai_data_lineage (tenant_id, ai_evaluation_id, tur, ad) values ($1, $2, 'MODEL_SURUMU', 'x')`,
        [seed.A.tenantId, evalId],
      ),
    ).rejects.toThrow();
  });
});
