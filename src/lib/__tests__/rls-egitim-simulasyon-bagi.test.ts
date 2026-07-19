// M18 sonraki dilim: tatbikat → eğitim bağı şema testi (20260719280000).
// Bağlama mantığı saf fonksiyonda test edilir (egitim-simulasyon-bagi.test.ts);
// burada yalnızca yeni kolonların kısıtları PGlite'a karşı doğrulanır.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, seedTwoTenants, type TestDb } from "./helpers/pg";

let db: TestDb;
let seed: Awaited<ReturnType<typeof seedTwoTenants>>;

beforeEach(async () => {
  db = await createTestDb();
  seed = await seedTwoTenants(db);
});
afterEach(async () => {
  await db.close();
});

describe("scenario_templates.egitim_konusu (M18 sonraki dilim)", () => {
  it("NULL olarak eklenebilir (bağsız şablon — varsayılan)", async () => {
    const { rows } = await db.sql(
      `insert into public.scenario_templates (kod, ad, tehdit_kategorisi) values ('T1', 'Test', 'test') returning egitim_konusu`,
    );
    expect(rows[0].egitim_konusu).toBeNull();
  });

  it("geçerli konu sözlüğünden bir değer kabul eder", async () => {
    const { rows } = await db.sql(
      `insert into public.scenario_templates (kod, ad, tehdit_kategorisi, egitim_konusu) values ('T2', 'Test', 'test', 'GUVENLIK') returning egitim_konusu`,
    );
    expect(rows[0].egitim_konusu).toBe("GUVENLIK");
  });

  it("sözlük dışı değeri reddeder", async () => {
    await expect(
      db.sql(
        `insert into public.scenario_templates (kod, ad, tehdit_kategorisi, egitim_konusu) values ('T3', 'Test', 'test', 'UYDURMA_KONU')`,
      ),
    ).rejects.toThrow();
  });
});

describe("training_completions.kaynak (M18 sonraki dilim)", () => {
  async function atama(tenantId: string, kullanici: string) {
    const { rows: r } = await db.sql(
      `insert into public.training_requirements (tenant_id, ad, konu) values ($1, 'Güvenlik Farkındalık', 'GUVENLIK') returning id`,
      [tenantId],
    );
    const { rows: a } = await db.sql(
      `insert into public.training_assignments (tenant_id, requirement_id, kullanici) values ($1, $2, $3) returning id`,
      [tenantId, r[0].id, kullanici],
    );
    return a[0].id as string;
  }

  it("varsayılan MANUEL'dir, kaynak_simulasyon_run_id NULL", async () => {
    const assignmentId = await atama(seed.A.tenantId, seed.A.userId);
    const { rows } = await db.sql(
      `insert into public.training_completions (tenant_id, assignment_id, skor, attestation) values ($1, $2, 90, true) returning kaynak, kaynak_simulasyon_run_id`,
      [seed.A.tenantId, assignmentId],
    );
    expect(rows[0].kaynak).toBe("MANUEL");
    expect(rows[0].kaynak_simulasyon_run_id).toBeNull();
  });

  it("SIMULASYON kaynaklı + gerçek run_id ile eklenebilir", async () => {
    const assignmentId = await atama(seed.A.tenantId, seed.A.userId);
    const { rows: t } = await db.sql(
      `insert into public.scenario_templates (kod, ad, tehdit_kategorisi, egitim_konusu) values ('T4', 'Test', 'test', 'GUVENLIK') returning id`,
    );
    const { rows: v } = await db.sql(
      `insert into public.scenario_template_versions (template_id, surum, tahmini_dakika) values ($1, 1, 30) returning id`,
      [t[0].id],
    );
    const { rows: run } = await db.sql(
      `insert into public.simulation_runs (tenant_id, version_id, ad, mod) values ($1, $2, 'Test Tatbikat', 'canli') returning id`,
      [seed.A.tenantId, v[0].id],
    );
    const { rows } = await db.sql(
      `insert into public.training_completions (tenant_id, assignment_id, skor, attestation, kaynak, kaynak_simulasyon_run_id)
       values ($1, $2, 82, true, 'SIMULASYON', $3) returning kaynak, kaynak_simulasyon_run_id`,
      [seed.A.tenantId, assignmentId, run[0].id],
    );
    expect(rows[0].kaynak).toBe("SIMULASYON");
    expect(rows[0].kaynak_simulasyon_run_id).toBe(run[0].id);
  });

  it("sözlük dışı kaynak değerini reddeder", async () => {
    const assignmentId = await atama(seed.A.tenantId, seed.A.userId);
    await expect(
      db.sql(
        `insert into public.training_completions (tenant_id, assignment_id, skor, attestation, kaynak) values ($1, $2, 90, true, 'UYDURMA')`,
        [seed.A.tenantId, assignmentId],
      ),
    ).rejects.toThrow();
  });
});
