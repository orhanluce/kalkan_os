// M10 kabul kriteri: "sunulmuş beyan ve cevapları değiştirilemez"
// (docs/ROADMAP.md M10).
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, seedTwoTenants, type TestDb } from "./helpers/pg";

let db: TestDb;
let seed: Awaited<ReturnType<typeof seedTwoTenants>>;
let questionId: string;
let declarationId: string;

/** A kiracısında denetçi misafir rolünde bir kullanıcı: yazamamalı. */
const A_DENETCI = "a0000000-0000-0000-0000-000000000009";

beforeEach(async () => {
  db = await createTestDb();
  seed = await seedTwoTenants(db);

  await db.sql(`insert into auth.users (id, email) values ($1, 'denetci@demo.com')`, [A_DENETCI]);
  await db.sql(
    `insert into public.profiles (id, tenant_id, role, full_name)
     values ($1, $2, 'denetci_misafir', 'A Denetci')`,
    [A_DENETCI, seed.A.tenantId],
  );

  const { rows: q } = await db.sql(
    `insert into public.board_declaration_questions (kod, soru, beklenen_kanit, sira)
     values ('YKB-01', 'Test sorusu?', 'Test kaniti', 1) returning id`,
  );
  questionId = q[0].id as string;

  const { rows: d } = await db.asUser(
    seed.A.userId,
    `insert into public.board_declarations (tenant_id, donem_etiketi) values ($1, '2026-Q3') returning id`,
    [seed.A.tenantId],
  );
  declarationId = d[0].id as string;
});

afterEach(async () => {
  await db.close();
});

async function cevapEkle(beyan = "evet") {
  await db.asUser(
    seed.A.userId,
    `insert into public.board_declaration_answers (declaration_id, tenant_id, question_id, beyan)
     values ($1, $2, $3, $4)`,
    [declarationId, seed.A.tenantId, questionId, beyan],
  );
}

async function sun() {
  await db.asUser(
    seed.A.userId,
    `update public.board_declarations set durum = 'sunuldu', sunuldu_at = now(), sunan = $2 where id = $1`,
    [declarationId, seed.A.userId],
  );
}

describe("YK Beyanı: sunulduktan sonra immutable", () => {
  it("taslak beyan serbestçe düzenlenebilir", async () => {
    await cevapEkle("hayir");
    await db.asUser(
      seed.A.userId,
      `update public.board_declaration_answers set beyan = 'evet' where declaration_id = $1`,
      [declarationId],
    );

    const { rows } = await db.sql(
      `select beyan from public.board_declaration_answers where declaration_id = $1`,
      [declarationId],
    );
    expect(rows[0].beyan).toBe("evet");
  });

  it("sunulmuş beyan DEĞİŞTİRİLEMEZ", async () => {
    await sun();

    await expect(
      db.asUser(
        seed.A.userId,
        `update public.board_declarations set donem_etiketi = 'degistirildi' where id = $1`,
        [declarationId],
      ),
    ).rejects.toThrow(/degistirilemez|yeni donem/i);
  });

  it("sunulmuş beyan SİLİNEMEZ", async () => {
    await sun();
    await expect(
      db.asUser(seed.A.userId, `delete from public.board_declarations where id = $1`, [declarationId]),
    ).rejects.toThrow(/silinemez/i);
  });

  it("sunulmuş beyanın CEVABI da donar", async () => {
    await cevapEkle();
    await sun();

    // Immutability yalnızca dönem satırında olsaydı, cevabı sonradan
    // değiştirerek "YK böyle beyan etti" iddiası geriye dönük değişebilirdi.
    await expect(
      db.asUser(
        seed.A.userId,
        `update public.board_declaration_answers set beyan = 'hayir' where declaration_id = $1`,
        [declarationId],
      ),
    ).rejects.toThrow(/degistirilemez/i);
  });

  it("sunulmuş beyanın kanıt bağı da donar", async () => {
    await cevapEkle();
    const { rows: a } = await db.sql(
      `select id from public.board_declaration_answers where declaration_id = $1`,
      [declarationId],
    );
    const { rows: ev } = await db.sql(
      `insert into public.evidences (tenant_id, control_id, tip) values ($1, $2, 'beyan') returning id`,
      [seed.A.tenantId, seed.controlId],
    );
    await db.asUser(
      seed.A.userId,
      `insert into public.board_declaration_evidence_links (answer_id, evidence_id, tenant_id)
       values ($1, $2, $3)`,
      [a[0].id, ev[0].id, seed.A.tenantId],
    );
    await sun();

    await expect(
      db.asUser(
        seed.A.userId,
        `delete from public.board_declaration_evidence_links where answer_id = $1`,
        [a[0].id],
      ),
    ).rejects.toThrow(/degistirilemez/i);
  });

  it("sunulmuş beyan arşive alınabilir", async () => {
    await sun();
    await db.asUser(
      seed.A.userId,
      `update public.board_declarations set durum = 'arsiv' where id = $1`,
      [declarationId],
    );
    const { rows } = await db.sql(`select durum from public.board_declarations where id = $1`, [
      declarationId,
    ]);
    expect(rows[0].durum).toBe("arsiv");
  });

  it("yeni dönem oluşturulabilir; eski dönem korunur", async () => {
    await sun();
    const { rows } = await db.asUser(
      seed.A.userId,
      `insert into public.board_declarations (tenant_id, donem_etiketi) values ($1, '2026-Q4') returning id`,
      [seed.A.tenantId],
    );
    expect(rows[0].id).toBeTruthy();

    const { rows: hepsi } = await db.sql(
      `select donem_etiketi, durum from public.board_declarations where tenant_id = $1 order by created_at`,
      [seed.A.tenantId],
    );
    expect(hepsi).toHaveLength(2);
    expect(hepsi[0]).toMatchObject({ donem_etiketi: "2026-Q3", durum: "sunuldu" });
    expect(hepsi[1]).toMatchObject({ donem_etiketi: "2026-Q4", durum: "taslak" });
  });
});

describe("YK Beyanı: rol kısıtlaması", () => {
  it("denetçi misafir beyan OLUŞTURAMAZ", async () => {
    await expect(
      db.asUser(
        A_DENETCI,
        `insert into public.board_declarations (tenant_id, donem_etiketi) values ($1, 'Sahte')`,
        [seed.A.tenantId],
      ),
    ).rejects.toThrow();
  });

  it("denetçi misafir cevap YAZAMAZ", async () => {
    await expect(
      db.asUser(
        A_DENETCI,
        `insert into public.board_declaration_answers (declaration_id, tenant_id, question_id, beyan)
         values ($1, $2, $3, 'evet')`,
        [declarationId, seed.A.tenantId, questionId],
      ),
    ).rejects.toThrow();
  });

  it("denetçi misafir beyanı OKUYABİLİR (paylaşım kapsamına girebilir)", async () => {
    await cevapEkle();
    const { rows } = await db.asUser(
      A_DENETCI,
      `select beyan from public.board_declaration_answers where declaration_id = $1`,
      [declarationId],
    );
    expect(rows).toHaveLength(1);
  });

  it("uyum rolü beyan oluşturabilir", async () => {
    const UYUM = "a0000000-0000-0000-0000-000000000008";
    await db.sql(`insert into auth.users (id, email) values ($1, 'uyum@demo.com')`, [UYUM]);
    await db.sql(
      `insert into public.profiles (id, tenant_id, role, full_name) values ($1, $2, 'uyum', 'A Uyum')`,
      [UYUM, seed.A.tenantId],
    );

    const { rows } = await db.asUser(
      UYUM,
      `insert into public.board_declarations (tenant_id, donem_etiketi) values ($1, '2027-Q1') returning id`,
      [seed.A.tenantId],
    );
    expect(rows).toHaveLength(1);
  });
});

describe("YK Beyanı: kiracı izolasyonu", () => {
  it("başka kiracı beyanı göremez", async () => {
    const { rows } = await db.asUser(seed.B.userId, `select * from public.board_declarations`);
    expect(rows).toHaveLength(0);
  });

  it("kütüphane (sorular) her kiracıya açık okunur", async () => {
    const { rows } = await db.asUser(seed.B.userId, `select kod from public.board_declaration_questions`);
    expect(rows.map((r) => r.kod)).toContain("YKB-01");
  });

  it("kullanıcı beyan sorusu YAZAMAZ (yalnızca seed)", async () => {
    await expect(
      db.asUser(
        seed.A.userId,
        `insert into public.board_declaration_questions (kod, soru, beklenen_kanit, sira)
         values ('SAHTE', 'x', 'y', 99)`,
      ),
    ).rejects.toThrow();
  });
});

describe("YK Beyanı: aynı soruya iki cevap olamaz", () => {
  it("aynı dönemde aynı soru tekrar cevaplanamaz", async () => {
    await cevapEkle();
    await expect(cevapEkle("hayir")).rejects.toThrow();
  });
});
