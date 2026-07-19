// M35 sonraki dilim: doğrulanmış anket şablonu — RLS + audit + soft-disable.
// PGlite gerçek migration'lara karşı.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, seedTwoTenants, type TestDb } from "./helpers/pg";

let db: TestDb;
let seed: Awaited<ReturnType<typeof seedTwoTenants>>;
const A_MISAFIR = "a0000000-0000-0000-0000-000000000009";

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

describe("anket şablonu — RLS + audit (M35 sonraki dilim, §8.0 sonu öncelik #3)", () => {
  it("şablon eklenir + audit'e düşer", async () => {
    const { rows } = await db.sql(
      `insert into public.assessment_question_templates (tenant_id, tur, soru, sira) values ($1, 'DORA', 'Alt yüklenici var mı?', 1) returning id`,
      [seed.A.tenantId],
    );
    expect(rows[0].id).toBeTruthy();
    const audit = await db.sql(
      `select count(*)::int as n from public.audit_log where hedef_tablo = 'assessment_question_templates' and hedef_id = $1`,
      [rows[0].id],
    );
    expect(audit.rows[0].n).toBe(1);
  });

  it("cross-tenant: A'nın şablonu B'ye görünmez; misafir yazamaz", async () => {
    const { rows } = await db.sql(
      `insert into public.assessment_question_templates (tenant_id, tur, soru) values ($1, 'DORA', 'S') returning id`,
      [seed.A.tenantId],
    );
    const { rows: b } = await db.asUser(
      seed.B.userId,
      `select id from public.assessment_question_templates where id = $1`,
      [rows[0].id],
    );
    expect(b).toHaveLength(0);
    await expect(
      db.asUser(
        A_MISAFIR,
        `insert into public.assessment_question_templates (tenant_id, tur, soru) values ($1, 'DORA', 'S')`,
        [seed.A.tenantId],
      ),
    ).rejects.toThrow();
  });

  it("soft-disable: aktif=false geçmiş kullanımı silmez, yeni kopyalamalarda önerilmez", async () => {
    const t = await db.sql(
      `insert into public.assessment_question_templates (tenant_id, tur, soru) values ($1, 'DORA', 'S') returning id`,
      [seed.A.tenantId],
    );
    await db.sql(`update public.assessment_question_templates set aktif = false where id = $1`, [t.rows[0].id]);
    const { rows } = await db.sql(`select aktif from public.assessment_question_templates where id = $1`, [t.rows[0].id]);
    expect(rows[0].aktif).toBe(false); // silinmedi, yalnız pasif

    // Şablondan kopyalama: yalnız aktif=true satırlar seçilir (uygulama katmanı sorgusu).
    const aktifOlanlar = await db.sql(
      `select soru from public.assessment_question_templates where tenant_id = $1 and tur = 'DORA' and aktif = true`,
      [seed.A.tenantId],
    );
    expect(aktifOlanlar.rows).toHaveLength(0);
  });

  it("şablondan assessment_questions'a kopyalama (düz INSERT ... SELECT), şablon değişse geçmiş kopya etkilenmez", async () => {
    const tp = await db.sql(`insert into public.third_parties (tenant_id, ad) values ($1, 'V') returning id`, [seed.A.tenantId]);
    const a = await db.sql(
      `insert into public.third_party_assessments (tenant_id, third_party_id, tur) values ($1, $2, 'DORA') returning id`,
      [seed.A.tenantId, tp.rows[0].id],
    );
    await db.sql(
      `insert into public.assessment_question_templates (tenant_id, tur, soru, sira) values ($1, 'DORA', 'Alt yüklenici var mı?', 1)`,
      [seed.A.tenantId],
    );
    await db.sql(
      `insert into public.assessment_questions (tenant_id, assessment_id, soru, sira)
       select $1, $2, soru, sira from public.assessment_question_templates
       where tenant_id = $1 and tur = 'DORA' and aktif = true`,
      [seed.A.tenantId, a.rows[0].id],
    );
    const { rows: kopya } = await db.sql(`select soru from public.assessment_questions where assessment_id = $1`, [a.rows[0].id]);
    expect(kopya).toHaveLength(1);
    expect(kopya[0].soru).toBe("Alt yüklenici var mı?");

    // Şablonu SONRADAN değiştir — geçmiş kopya ETKİLENMEZ (bağımsız kayıt).
    await db.sql(`update public.assessment_question_templates set soru = 'DEĞİŞTİ' where tenant_id = $1`, [seed.A.tenantId]);
    const { rows: kopyaSonra } = await db.sql(`select soru from public.assessment_questions where assessment_id = $1`, [a.rows[0].id]);
    expect(kopyaSonra[0].soru).toBe("Alt yüklenici var mı?");
  });
});
