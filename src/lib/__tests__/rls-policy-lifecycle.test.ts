// G2 (M34): Policy Lifecycle — tenant izolasyonu, durum makinesi, dört-göz,
// madde donukluğu, attestation guard, AI taslak sınırı, clause→hedef bağı.
// Gerçek migration'lara karşı PGlite.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, seedTwoTenants, type TestDb } from "./helpers/pg";

let db: TestDb;
let seed: Awaited<ReturnType<typeof seedTwoTenants>>;
// Aynı kiracıda ikinci kullanıcı (dört-göz onayı) ve misafir (yazamaz).
const A_IKINCI = "a0000000-0000-0000-0000-000000000002";
const A_MISAFIR = "a0000000-0000-0000-0000-000000000009";

async function belgeVeSurum(tenantId: string) {
  const { rows: d } = await db.sql(
    `insert into public.policy_documents (tenant_id, kod, baslik) values ($1, 'POL-1', 'Bilgi Güvenliği Politikası') returning id`,
    [tenantId],
  );
  const { rows: v } = await db.sql(
    `insert into public.policy_versions (tenant_id, policy_document_id, surum) values ($1, $2, 1) returning id`,
    [tenantId, d[0].id],
  );
  return { documentId: d[0].id as string, versionId: v[0].id as string };
}

/** Sürümü DRAFT→REVIEW→APPROVED→EFFECTIVE yürütür (dört-göz uyarınca). */
async function yururlugeAl(versionId: string) {
  await db.sql(
    `update public.policy_versions set durum = 'REVIEW', hazirlayan = $2, hazirlama_zamani = now() where id = $1`,
    [versionId, seed.A.userId],
  );
  await db.sql(
    `update public.policy_versions set durum = 'APPROVED', onaylayan = $2, onay_zamani = now() where id = $1`,
    [versionId, A_IKINCI],
  );
  await db.sql(
    `update public.policy_versions set durum = 'EFFECTIVE', effective_from = current_date where id = $1`,
    [versionId],
  );
}

beforeEach(async () => {
  db = await createTestDb();
  seed = await seedTwoTenants(db);
  for (const [id, rol, ad] of [
    [A_IKINCI, "uyum", "İkinci"],
    [A_MISAFIR, "denetci_misafir", "Misafir"],
  ] as const) {
    await db.sql(`insert into auth.users (id, email) values ($1, $2)`, [id, `${ad}@demo.com`]);
    await db.sql(`insert into public.profiles (id, tenant_id, role, full_name) values ($1, $2, $3, $4)`, [
      id,
      seed.A.tenantId,
      rol,
      ad,
    ]);
  }
});

afterEach(async () => {
  await db.close();
});

describe("policy lifecycle — RLS + durum makinesi + dört göz (M34)", () => {
  it("kiracı izolasyonu: A'nın belgesini/sürümünü B GÖREMEZ; misafir yazamaz", async () => {
    const { documentId, versionId } = await belgeVeSurum(seed.A.tenantId);
    const { rows: baska } = await db.asUser(seed.B.userId, `select id from public.policy_documents where id = $1`, [documentId]);
    expect(baska).toHaveLength(0);
    const { rows: baskaV } = await db.asUser(seed.B.userId, `select id from public.policy_versions where id = $1`, [versionId]);
    expect(baskaV).toHaveLength(0);
    await expect(
      db.asUser(A_MISAFIR, `insert into public.policy_documents (tenant_id, kod, baslik) values ($1, 'X', 'x')`, [seed.A.tenantId]),
    ).rejects.toThrow();
  });

  it("geçersiz durum geçişi reddedilir (DRAFT→APPROVED atlanamaz)", async () => {
    const { versionId } = await belgeVeSurum(seed.A.tenantId);
    await expect(
      db.sql(`update public.policy_versions set durum = 'APPROVED', onaylayan = $2, onay_zamani = now() where id = $1`, [versionId, A_IKINCI]),
    ).rejects.toThrow(/Gecersiz policy durum gecisi/);
  });

  it("REVIEW hazirlayan olmadan reddedilir; DÖRT GÖZ: hazirlayan kendi sürümünü onaylayamaz", async () => {
    const { versionId } = await belgeVeSurum(seed.A.tenantId);
    await expect(
      db.sql(`update public.policy_versions set durum = 'REVIEW' where id = $1`, [versionId]),
    ).rejects.toThrow(/hazirlayan/);
    await db.sql(
      `update public.policy_versions set durum = 'REVIEW', hazirlayan = $2, hazirlama_zamani = now() where id = $1`,
      [versionId, seed.A.userId],
    );
    // Hazırlayan == onaylayan → dört göz reddi.
    await expect(
      db.sql(`update public.policy_versions set durum = 'APPROVED', onaylayan = $2, onay_zamani = now() where id = $1`, [versionId, seed.A.userId]),
    ).rejects.toThrow(/dort goz/);
  });

  it("tam yaşam döngüsü DRAFT→REVIEW→APPROVED→EFFECTIVE geçer (farklı onaylayan)", async () => {
    const { versionId } = await belgeVeSurum(seed.A.tenantId);
    await yururlugeAl(versionId);
    const { rows } = await db.sql(`select durum from public.policy_versions where id = $1`, [versionId]);
    expect(rows[0].durum).toBe("EFFECTIVE");
  });

  it("EFFECTIVE geçişi effective_from olmadan reddedilir", async () => {
    const { versionId } = await belgeVeSurum(seed.A.tenantId);
    await db.sql(`update public.policy_versions set durum = 'REVIEW', hazirlayan = $2, hazirlama_zamani = now() where id = $1`, [versionId, seed.A.userId]);
    await db.sql(`update public.policy_versions set durum = 'APPROVED', onaylayan = $2, onay_zamani = now() where id = $1`, [versionId, A_IKINCI]);
    await expect(
      db.sql(`update public.policy_versions set durum = 'EFFECTIVE' where id = $1`, [versionId]),
    ).rejects.toThrow(/effective_from/);
  });

  it("bir belgenin İKİ EFFECTIVE sürümü olamaz (partial unique)", async () => {
    const { documentId, versionId } = await belgeVeSurum(seed.A.tenantId);
    await yururlugeAl(versionId);
    const { rows: v2 } = await db.sql(
      `insert into public.policy_versions (tenant_id, policy_document_id, surum) values ($1, $2, 2) returning id`,
      [seed.A.tenantId, documentId],
    );
    await db.sql(`update public.policy_versions set durum = 'REVIEW', hazirlayan = $2, hazirlama_zamani = now() where id = $1`, [v2[0].id, seed.A.userId]);
    await db.sql(`update public.policy_versions set durum = 'APPROVED', onaylayan = $2, onay_zamani = now() where id = $1`, [v2[0].id, A_IKINCI]);
    await expect(
      db.sql(`update public.policy_versions set durum = 'EFFECTIVE', effective_from = current_date where id = $1`, [v2[0].id]),
    ).rejects.toThrow();
  });

  it("madde donukluğu: EFFECTIVE sürümün maddesi değiştirilemez", async () => {
    const { versionId } = await belgeVeSurum(seed.A.tenantId);
    // DRAFT'ta madde eklenir.
    const { rows: c } = await db.sql(
      `insert into public.policy_clauses (tenant_id, policy_version_id, madde_ref, metin) values ($1, $2, 'md.1', 'Metin') returning id`,
      [seed.A.tenantId, versionId],
    );
    await yururlugeAl(versionId);
    // EFFECTIVE'de değişiklik reddi.
    await expect(
      db.sql(`update public.policy_clauses set metin = 'Değişti' where id = $1`, [c[0].id]),
    ).rejects.toThrow(/degistirilemez/);
    await expect(
      db.sql(`insert into public.policy_clauses (tenant_id, policy_version_id, madde_ref, metin) values ($1, $2, 'md.2', 'Yeni')`, [seed.A.tenantId, versionId]),
    ).rejects.toThrow(/degistirilemez/);
  });

  it("AI taslağı doğrudan APPROVED/EFFECTIVE DOĞAMAZ (insan incelemesi)", async () => {
    const { documentId } = await belgeVeSurum(seed.A.tenantId);
    await expect(
      db.sql(
        `insert into public.policy_versions (tenant_id, policy_document_id, surum, durum, eklenme_kaynagi) values ($1, $2, 2, 'APPROVED', 'ai_taslak')`,
        [seed.A.tenantId, documentId],
      ),
    ).rejects.toThrow(/AI taslagi/);
  });

  it("attestation yalnız EFFECTIVE sürüme; kimlik atfı oturum sahibine sabit", async () => {
    const { versionId } = await belgeVeSurum(seed.A.tenantId);
    // DRAFT'a attestation reddi.
    await expect(
      db.asUser(A_IKINCI, `insert into public.policy_attestations (tenant_id, policy_version_id, attesting_user) values ($1, $2, $3)`, [seed.A.tenantId, versionId, A_IKINCI]),
    ).rejects.toThrow(/EFFECTIVE/);
    await yururlugeAl(versionId);
    // Başkası adına attestation reddi (kimlik atfı).
    await expect(
      db.asUser(A_IKINCI, `insert into public.policy_attestations (tenant_id, policy_version_id, attesting_user) values ($1, $2, $3)`, [seed.A.tenantId, versionId, seed.A.userId]),
    ).rejects.toThrow();
    // Kendi adına geçer.
    await db.asUser(A_IKINCI, `insert into public.policy_attestations (tenant_id, policy_version_id, attesting_user) values ($1, $2, $3)`, [seed.A.tenantId, versionId, A_IKINCI]);
    const { rows } = await db.sql(`select count(*)::int as n from public.policy_attestations where policy_version_id = $1`, [versionId]);
    expect(rows[0].n).toBe(1);
  });

  it("madde bağı: tam olarak BİR hedef (hüküm/yükümlülük/kontrol) zorunlu", async () => {
    const { versionId } = await belgeVeSurum(seed.A.tenantId);
    const { rows: c } = await db.sql(
      `insert into public.policy_clauses (tenant_id, policy_version_id, madde_ref, metin) values ($1, $2, 'md.1', 'Metin') returning id`,
      [seed.A.tenantId, versionId],
    );
    // Hedefsiz bağ reddi.
    await expect(
      db.sql(`insert into public.policy_clause_links (tenant_id, policy_clause_id) values ($1, $2)`, [seed.A.tenantId, c[0].id]),
    ).rejects.toThrow();
    // Kontrole bağ geçer (seed.controlId).
    await db.sql(
      `insert into public.policy_clause_links (tenant_id, policy_clause_id, control_id) values ($1, $2, $3)`,
      [seed.A.tenantId, c[0].id, seed.controlId],
    );
    // İki hedefli bağ reddi.
    await expect(
      db.sql(`insert into public.policy_clause_links (tenant_id, policy_clause_id, control_id, provision_id) values ($1, $2, $3, $4)`, [
        seed.A.tenantId, c[0].id, seed.controlId, seed.controlId,
      ]),
    ).rejects.toThrow();
  });

  it("audit izi: sürüm oluşturma ve durum değişimi audit_log'a düşer", async () => {
    const { versionId } = await belgeVeSurum(seed.A.tenantId);
    await db.sql(`update public.policy_versions set durum = 'REVIEW', hazirlayan = $2, hazirlama_zamani = now() where id = $1`, [versionId, seed.A.userId]);
    const { rows } = await db.sql(
      `select eylem from public.audit_log where hedef_tablo = 'policy_versions' and hedef_id = $1 order by created_at`,
      [versionId],
    );
    expect(rows.map((r) => r.eylem)).toEqual(["policy_surum_olusturuldu", "policy_surum_durum_degisti"]);
  });
});
