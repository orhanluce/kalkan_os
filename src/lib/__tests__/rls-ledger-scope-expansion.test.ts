// G3 defter kapsamı genişlemesi (nihai talimat v3.3 §8.0 Dikey 1): beş yeni
// artefakt türü için AFTER UPDATE trigger'ların DOĞRU geçiş anında (ve YALNIZ
// o anda) ledger_outbox'a olay yazdığını doğrular. PGlite gerçek migration'lara
// karşı.
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

async function outboxSayisi(artifactTable: string, artifactId: unknown): Promise<number> {
  const { rows } = await db.sql(
    `select count(*)::int as n from public.ledger_outbox where artifact_table = $1 and artifact_id = $2`,
    [artifactTable, artifactId],
  );
  return rows[0].n as number;
}

describe("G3 defter kapsamı genişlemesi — beş yeni artefakt türü (§8.0 Dikey 1)", () => {
  it("1) third_party_assessments: yalnız TAMAMLANDI geçişinde enqueue", async () => {
    const tp = await db.sql(`insert into public.third_parties (tenant_id, ad) values ($1, 'V') returning id`, [seed.A.tenantId]);
    const a = await db.sql(
      `insert into public.third_party_assessments (tenant_id, third_party_id, tur) values ($1, $2, 'DORA') returning id`,
      [seed.A.tenantId, tp.rows[0].id],
    );
    const id = a.rows[0].id as string;
    expect(await outboxSayisi("third_party_assessments", id)).toBe(0); // DRAFT doğuşu tetiklemez

    await db.sql(`update public.third_party_assessments set ozet = 'x' where id = $1`, [id]); // alakasız update
    expect(await outboxSayisi("third_party_assessments", id)).toBe(0);

    await db.sql(`update public.third_party_assessments set durum = 'TAMAMLANDI', degerlendiren = $2 where id = $1`, [id, seed.A.userId]);
    expect(await outboxSayisi("third_party_assessments", id)).toBe(1);

    const { rows } = await db.sql(`select statement_kind from public.ledger_outbox where artifact_table = 'third_party_assessments' and artifact_id = $1`, [id]);
    expect(rows[0].statement_kind).toBe("TPR_ASSESSMENT_SIGNOFF");
  });

  it("2) assessment_findings: yalnız KRİTİK+KAPANDI geçişinde enqueue (YÜKSEK kapanışı tetiklemez)", async () => {
    const tp = await db.sql(`insert into public.third_parties (tenant_id, ad) values ($1, 'V') returning id`, [seed.A.tenantId]);
    const a = await db.sql(`insert into public.third_party_assessments (tenant_id, third_party_id, tur) values ($1, $2, 'DORA') returning id`, [seed.A.tenantId, tp.rows[0].id]);
    const fYuksek = await db.sql(
      `insert into public.assessment_findings (tenant_id, assessment_id, third_party_id, baslik, ciddiyet) values ($1, $2, $3, 'B', 'YUKSEK') returning id`,
      [seed.A.tenantId, a.rows[0].id as string, tp.rows[0].id as string],
    );
    await db.sql(
      `update public.assessment_findings set durum = 'KAPANDI', kapanis_kanit = 'x', kapatan = $2, kapanis_zamani = now() where id = $1`,
      [fYuksek.rows[0].id, seed.A.userId],
    );
    expect(await outboxSayisi("assessment_findings", fYuksek.rows[0].id)).toBe(0); // YÜKSEK, KRİTİK değil

    const fKritik = await db.sql(
      `insert into public.assessment_findings (tenant_id, assessment_id, third_party_id, baslik, ciddiyet) values ($1, $2, $3, 'B', 'KRITIK') returning id`,
      [seed.A.tenantId, a.rows[0].id as string, tp.rows[0].id as string],
    );
    await db.sql(
      `update public.assessment_findings set durum = 'KAPANDI', kapanis_kanit = 'x', kapatan = $2, kapanis_zamani = now() where id = $1`,
      [fKritik.rows[0].id, seed.A.userId],
    );
    expect(await outboxSayisi("assessment_findings", fKritik.rows[0].id)).toBe(1);
  });

  it("3) ai_incidents: KAPANDI geçişinde enqueue", async () => {
    const s = await db.sql(`insert into public.ai_systems (tenant_id, ad) values ($1, 'S') returning id`, [seed.A.tenantId]);
    const o = await db.sql(`insert into public.ai_incidents (tenant_id, ai_system_id, ozet) values ($1, $2, 'olay') returning id`, [seed.A.tenantId, s.rows[0].id]);
    expect(await outboxSayisi("ai_incidents", o.rows[0].id)).toBe(0);
    await db.sql(
      `update public.ai_incidents set durum = 'KAPANDI', kapanis_kanit = 'x', kapatan = $2, kapanis_zamani = now() where id = $1`,
      [o.rows[0].id, seed.A.userId],
    );
    expect(await outboxSayisi("ai_incidents", o.rows[0].id)).toBe(1);
  });

  it("4) ai_execution_receipts: SUGGESTED->ACCEPTED/REJECTED geçişinde enqueue", async () => {
    const s = await db.sql(`insert into public.ai_systems (tenant_id, ad) values ($1, 'S') returning id`, [seed.A.tenantId]);
    const r = await db.sql(
      `insert into public.ai_execution_receipts (tenant_id, ai_system_id, amac) values ($1, $2, 'amac') returning id`,
      [seed.A.tenantId, s.rows[0].id],
    );
    expect(await outboxSayisi("ai_execution_receipts", r.rows[0].id)).toBe(0);
    // Karar İNSAN reviewer + oturum sahibi ile (ai_receipt_guard); asUser şart.
    await db.asUser(
      seed.A.userId,
      `update public.ai_execution_receipts set karar = 'ACCEPTED', reviewer = $2, reviewer_karar_zamani = now() where id = $1`,
      [r.rows[0].id, seed.A.userId],
    );
    expect(await outboxSayisi("ai_execution_receipts", r.rows[0].id)).toBe(1);
  });

  it("5) board_declarations: taslak->sunuldu geçişinde enqueue", async () => {
    const d = await db.sql(`insert into public.board_declarations (tenant_id, donem_etiketi) values ($1, '2026-Q3') returning id`, [seed.A.tenantId]);
    expect(await outboxSayisi("board_declarations", d.rows[0].id)).toBe(0);
    await db.sql(`update public.board_declarations set durum = 'sunuldu', sunan = $2, sunuldu_at = now() where id = $1`, [d.rows[0].id, seed.A.userId]);
    expect(await outboxSayisi("board_declarations", d.rows[0].id)).toBe(1);
  });

  it("idempotency: aynı satırın ikinci alakasız update'i ikinci enqueue üretmez (unique backstop)", async () => {
    const s = await db.sql(`insert into public.ai_systems (tenant_id, ad) values ($1, 'S') returning id`, [seed.A.tenantId]);
    const o = await db.sql(`insert into public.ai_incidents (tenant_id, ai_system_id, ozet) values ($1, $2, 'olay') returning id`, [seed.A.tenantId, s.rows[0].id]);
    await db.sql(`update public.ai_incidents set durum = 'KAPANDI', kapanis_kanit = 'x', kapatan = $2, kapanis_zamani = now() where id = $1`, [o.rows[0].id, seed.A.userId]);
    // Kapalı satıra dokunan ama durumu 'KAPANDI' -> 'KAPANDI' olan (değişmeyen) bir update WHEN koşulunu tetiklemez zaten.
    await db.sql(`update public.ai_incidents set kapanis_kanit = 'y' where id = $1`, [o.rows[0].id]);
    expect(await outboxSayisi("ai_incidents", o.rows[0].id)).toBe(1);
  });
});
