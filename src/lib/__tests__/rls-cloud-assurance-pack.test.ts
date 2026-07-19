// M35 Cloud Assurance Pack (nihai v3.3 §8.0 Dikey 3): kategori + kaynak künyesi
// + VERIFIED disiplini (kural 6: auto-VERIFIED yok) + kopyaya künye/UNKNOWN
// taşınması. PGlite gerçek migration'lara karşı.
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

describe("bulut pak — kategori + VERIFIED disiplini (§8.0 Dikey 3)", () => {
  it("pak maddesi TODO_DOGRULA doğar; VERIFIED doğrudan DOĞAMAZ (kural 6)", async () => {
    const { rows } = await db.sql(
      `insert into public.assessment_question_templates (tenant_id, tur, soru, kategori, kaynak_citation, kaynak_surumu)
       values ($1, 'DORA', 'Veri lokasyonu AB içinde mi?', 'VERI_LOKASYON', 'DORA md.28', 'RTS-2024') returning dogrulama_durumu`,
      [seed.A.tenantId],
    );
    expect(rows[0].dogrulama_durumu).toBe("TODO_DOGRULA");
    await expect(
      db.sql(
        `insert into public.assessment_question_templates (tenant_id, tur, soru, kategori, dogrulama_durumu)
         values ($1, 'DORA', 'x', 'DDOS_KAPASITE', 'VERIFIED')`,
        [seed.A.tenantId],
      ),
    ).rejects.toThrow(/VERIFIED DOGAMAZ/);
  });

  it("VERIFIED'a geçiş dogrulayan + zaman ister + audit'e düşer", async () => {
    const t = await db.sql(
      `insert into public.assessment_question_templates (tenant_id, tur, soru, kategori) values ($1, 'DORA', 's', 'IAM_LOG') returning id`,
      [seed.A.tenantId],
    );
    await expect(
      db.sql(`update public.assessment_question_templates set dogrulama_durumu = 'VERIFIED' where id = $1`, [t.rows[0].id]),
    ).rejects.toThrow(/dogrulayan/);
    await db.sql(
      `update public.assessment_question_templates set dogrulama_durumu = 'VERIFIED', dogrulayan = $2, dogrulama_zamani = now() where id = $1`,
      [t.rows[0].id, seed.A.userId],
    );
    const { rows } = await db.sql(`select dogrulama_durumu from public.assessment_question_templates where id = $1`, [t.rows[0].id]);
    expect(rows[0].dogrulama_durumu).toBe("VERIFIED");
    const audit = await db.sql(
      `select count(*)::int as n from public.audit_log where hedef_tablo = 'assessment_question_templates' and hedef_id = $1 and eylem = 'bulut_pak_dogrulama_degisti'`,
      [t.rows[0].id],
    );
    expect(audit.rows[0].n).toBe(1);
  });

  it("geçersiz kategori reddedilir (check)", async () => {
    await expect(
      db.sql(
        `insert into public.assessment_question_templates (tenant_id, tur, soru, kategori) values ($1, 'DORA', 's', 'OLMAYAN')`,
        [seed.A.tenantId],
      ),
    ).rejects.toThrow();
  });

  it("kopyalanan soru kaynak künyesini taşır + uygulanabilirlik UNKNOWN doğar (kural 7)", async () => {
    const tp = await db.sql(`insert into public.third_parties (tenant_id, ad) values ($1, 'V') returning id`, [seed.A.tenantId]);
    const a = await db.sql(
      `insert into public.third_party_assessments (tenant_id, third_party_id, tur) values ($1, $2, 'DORA') returning id`,
      [seed.A.tenantId, tp.rows[0].id],
    );
    await db.sql(
      `insert into public.assessment_questions (tenant_id, assessment_id, soru, kaynak_citation) values ($1, $2, 'Yedekleme testi periyodik mi?', 'DORA md.12')`,
      [seed.A.tenantId, a.rows[0].id],
    );
    const { rows } = await db.sql(
      `select kaynak_citation, uygulanabilirlik from public.assessment_questions where assessment_id = $1`,
      [a.rows[0].id],
    );
    expect(rows[0].kaynak_citation).toBe("DORA md.12");
    expect(rows[0].uygulanabilirlik).toBe("UNKNOWN"); // NOT_APPLICABLE değil
  });

  it("misafir pak maddesi doğrulayamaz (RLS: 0 satır, madde TODO_DOGRULA kalır)", async () => {
    const t = await db.sql(`insert into public.assessment_question_templates (tenant_id, tur, soru, kategori) values ($1, 'DORA', 's', 'SLA_GUVENLIK') returning id`, [seed.A.tenantId]);
    // RLS write politikası admin/uyum ister; misafir UPDATE'i 0 satır etkiler
    // (throw etmez) — madde değişmeden kalır.
    await db.asUser(A_MISAFIR, `update public.assessment_question_templates set dogrulama_durumu = 'VERIFIED', dogrulayan = $2, dogrulama_zamani = now() where id = $1`, [t.rows[0].id, A_MISAFIR]);
    const { rows } = await db.sql(`select dogrulama_durumu from public.assessment_question_templates where id = $1`, [t.rows[0].id]);
    expect(rows[0].dogrulama_durumu).toBe("TODO_DOGRULA");
  });
});
