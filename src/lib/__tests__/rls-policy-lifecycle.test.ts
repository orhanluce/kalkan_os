// G2 (M34) Policy Lifecycle v2 — kurucunun tam kapsam kabul testleri:
// IN_REVIEW yaşam döngüsü, çoklu bağımsız onay + dört-göz, geriye-tarih yasağı,
// APPROVED/EFFECTIVE mutasyon donukluğu, PolicyException (dört-göz + süre-dolumu
// → yeniden değerlendirme + telafi kontrolü), PolicyImpact (PROPOSED doğar, AI
// APPLIED yapamaz), cross-tenant, eşzamanlı geçiş determinizmi, doğrulanmamış
// hukuk otomatik doğrulanamaz, RETIRED silinmez. Gerçek migration'lara PGlite.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, seedTwoTenants, type TestDb } from "./helpers/pg";

let db: TestDb;
let seed: Awaited<ReturnType<typeof seedTwoTenants>>;
const A_IKINCI = "a0000000-0000-0000-0000-000000000002";
const A_MISAFIR = "a0000000-0000-0000-0000-000000000009";
const H = (c: string) => c.repeat(64);

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

/** DRAFT→IN_REVIEW→(bağımsız onay)→APPROVED→EFFECTIVE. */
async function yururlugeAl(versionId: string, effectiveFrom = "current_date") {
  await db.sql(
    `update public.policy_versions set durum = 'IN_REVIEW', hazirlayan = $2, hazirlama_zamani = now() where id = $1`,
    [versionId, seed.A.userId],
  );
  await db.sql(
    `insert into public.policy_approvals (tenant_id, policy_version_id, approver, karar) values ($1, $2, $3, 'APPROVE')`,
    [seed.A.tenantId, versionId, A_IKINCI],
  );
  await db.sql(`update public.policy_versions set durum = 'APPROVED' where id = $1`, [versionId]);
  await db.sql(
    `update public.policy_versions set durum = 'EFFECTIVE', effective_from = ${effectiveFrom} where id = $1`,
    [versionId],
  );
}

/** Global zincir: kaynak→artifact→hüküm, hüküm id'sini döndürür. */
async function hukumEkle(): Promise<string> {
  const { rows: s } = await db.sql(
    `insert into public.regulatory_sources (authority, jurisdiction, kaynak_seviyesi, ad, erisim_politikasi_durumu)
     values ('SPK', 'TR', 'A', 'SPK', 'manuel') returning id`,
  );
  const { rows: a } = await db.sql(
    `insert into public.source_artifacts (source_id, baslik, sha256) values ($1, 'Tebliğ', $2) returning id`,
    [s[0].id, H("a")],
  );
  const { rows: p } = await db.sql(
    `insert into public.provisions (source_artifact_id, provision_ref, metin, effective_from) values ($1, 'md.1', 'x', '2020-01-01') returning id`,
    [a[0].id],
  );
  return p[0].id as string;
}

beforeEach(async () => {
  db = await createTestDb();
  seed = await seedTwoTenants(db);
  for (const [id, rol, ad] of [
    [A_IKINCI, "uyum", "İkinci"],
    [A_MISAFIR, "denetci_misafir", "Misafir"],
  ] as const) {
    await db.sql(`insert into auth.users (id, email) values ($1, $2)`, [id, `${ad}@demo.com`]);
    await db.sql(`insert into public.profiles (id, tenant_id, role, full_name) values ($1, $2, $3, $4)`, [id, seed.A.tenantId, rol, ad]);
  }
});

afterEach(async () => {
  await db.close();
});

describe("policy lifecycle v2 — tam kapsam (M34)", () => {
  it("cross-tenant: A'nın belge/sürümünü B GÖREMEZ; misafir YAZAMAZ", async () => {
    const { documentId, versionId } = await belgeVeSurum(seed.A.tenantId);
    const { rows: b } = await db.asUser(seed.B.userId, `select id from public.policy_documents where id = $1`, [documentId]);
    expect(b).toHaveLength(0);
    const { rows: bv } = await db.asUser(seed.B.userId, `select id from public.policy_versions where id = $1`, [versionId]);
    expect(bv).toHaveLength(0);
    await expect(
      db.asUser(A_MISAFIR, `insert into public.policy_documents (tenant_id, kod, baslik) values ($1, 'X', 'x')`, [seed.A.tenantId]),
    ).rejects.toThrow();
  });

  it("yetkisiz durum atlama reddedilir (DRAFT→APPROVED)", async () => {
    const { versionId } = await belgeVeSurum(seed.A.tenantId);
    await expect(
      db.sql(`update public.policy_versions set durum = 'APPROVED' where id = $1`, [versionId]),
    ).rejects.toThrow(/Gecersiz policy durum gecisi/);
  });

  it("DÖRT GÖZ: hazırlayan kendi sürümüne onay KAYDEDEMEZ (approval guard)", async () => {
    const { versionId } = await belgeVeSurum(seed.A.tenantId);
    await db.sql(`update public.policy_versions set durum = 'IN_REVIEW', hazirlayan = $2, hazirlama_zamani = now() where id = $1`, [versionId, seed.A.userId]);
    await expect(
      db.sql(`insert into public.policy_approvals (tenant_id, policy_version_id, approver, karar) values ($1, $2, $3, 'APPROVE')`, [seed.A.tenantId, versionId, seed.A.userId]),
    ).rejects.toThrow(/dort goz/);
  });

  it("onaysız APPROVED reddedilir; bağımsız onayla geçer (tam döngü EFFECTIVE)", async () => {
    const { versionId } = await belgeVeSurum(seed.A.tenantId);
    await db.sql(`update public.policy_versions set durum = 'IN_REVIEW', hazirlayan = $2, hazirlama_zamani = now() where id = $1`, [versionId, seed.A.userId]);
    // Onay yokken APPROVED reddi.
    await expect(
      db.sql(`update public.policy_versions set durum = 'APPROVED' where id = $1`, [versionId]),
    ).rejects.toThrow(/yeterli bagimsiz onay yok/);
    await yururlugeAl(versionId);
    const { rows } = await db.sql(`select durum from public.policy_versions where id = $1`, [versionId]);
    expect(rows[0].durum).toBe("EFFECTIVE");
  });

  it("GERİYE-TARİH YASAĞI: effective_from geçmişse EFFECTIVE reddedilir", async () => {
    const { versionId } = await belgeVeSurum(seed.A.tenantId);
    await db.sql(`update public.policy_versions set durum = 'IN_REVIEW', hazirlayan = $2, hazirlama_zamani = now() where id = $1`, [versionId, seed.A.userId]);
    await db.sql(`insert into public.policy_approvals (tenant_id, policy_version_id, approver, karar) values ($1, $2, $3, 'APPROVE')`, [seed.A.tenantId, versionId, A_IKINCI]);
    await db.sql(`update public.policy_versions set durum = 'APPROVED' where id = $1`, [versionId]);
    await expect(
      db.sql(`update public.policy_versions set durum = 'EFFECTIVE', effective_from = current_date - 1 where id = $1`, [versionId]),
    ).rejects.toThrow(/Geriye-tarihli/);
  });

  it("EFFECTIVE/APPROVED sürüm mutasyonu reddedilir (madde + bağ donuk)", async () => {
    const pid = await hukumEkle();
    const { versionId } = await belgeVeSurum(seed.A.tenantId);
    const { rows: c } = await db.sql(
      `insert into public.policy_clauses (tenant_id, policy_version_id, madde_ref, metin) values ($1, $2, 'md.1', 'Metin') returning id`,
      [seed.A.tenantId, versionId],
    );
    // DRAFT'ta bağ kurulur.
    await db.sql(`insert into public.policy_clause_links (tenant_id, policy_clause_id, provision_id) values ($1, $2, $3)`, [seed.A.tenantId, c[0].id, pid]);
    await yururlugeAl(versionId);
    await expect(db.sql(`update public.policy_clauses set metin = 'X' where id = $1`, [c[0].id])).rejects.toThrow(/degistirilemez/);
    await expect(
      db.sql(`insert into public.policy_clause_links (tenant_id, policy_clause_id, control_id) values ($1, $2, $3)`, [seed.A.tenantId, c[0].id, seed.controlId]),
    ).rejects.toThrow(/degistirilemez/);
  });

  it("madde doğrulanmamış hükme bağlanabilir ama hükmü OTOMATİK doğrulamaz", async () => {
    const pid = await hukumEkle();
    const { versionId } = await belgeVeSurum(seed.A.tenantId);
    const { rows: c } = await db.sql(
      `insert into public.policy_clauses (tenant_id, policy_version_id, madde_ref, metin) values ($1, $2, 'md.1', 'Metin') returning id`,
      [seed.A.tenantId, versionId],
    );
    await db.sql(`insert into public.policy_clause_links (tenant_id, policy_clause_id, provision_id) values ($1, $2, $3)`, [seed.A.tenantId, c[0].id, pid]);
    // Hüküm hâlâ TODO_DOGRULA — bağ onu VERIFIED yapmadı (kural 3).
    const { rows } = await db.sql(`select dogrulama_durumu from public.provisions where id = $1`, [pid]);
    expect(rows[0].dogrulama_durumu).toBe("TODO_DOGRULA");
  });

  it("EŞZAMANLI durum geçişi DETERMİNİSTİK: iki APPROVED denemesinden biri boş döner", async () => {
    const { versionId } = await belgeVeSurum(seed.A.tenantId);
    await db.sql(`update public.policy_versions set durum = 'IN_REVIEW', hazirlayan = $2, hazirlama_zamani = now() where id = $1`, [versionId, seed.A.userId]);
    await db.sql(`insert into public.policy_approvals (tenant_id, policy_version_id, approver, karar) values ($1, $2, $3, 'APPROVE')`, [seed.A.tenantId, versionId, A_IKINCI]);
    // Optimistic guard (route deseni): where durum='IN_REVIEW'. İlk kazanır.
    const { rows: ilk } = await db.sql(`update public.policy_versions set durum = 'APPROVED' where id = $1 and durum = 'IN_REVIEW' returning id`, [versionId]);
    const { rows: ikinci } = await db.sql(`update public.policy_versions set durum = 'APPROVED' where id = $1 and durum = 'IN_REVIEW' returning id`, [versionId]);
    expect(ilk).toHaveLength(1);
    expect(ikinci).toHaveLength(0); // ikinci: artık IN_REVIEW değil
  });

  it("emekliye ayrılan sürüm GEÇMİŞTEN SİLİNMEZ (RETIRED kayıt durur)", async () => {
    const { versionId } = await belgeVeSurum(seed.A.tenantId);
    await yururlugeAl(versionId);
    await db.sql(`update public.policy_versions set durum = 'RETIRED' where id = $1`, [versionId]);
    const { rows } = await db.sql(`select durum from public.policy_versions where id = $1`, [versionId]);
    expect(rows).toHaveLength(1);
    expect(rows[0].durum).toBe("RETIRED");
  });

  it("AI taslağı doğrudan APPROVED DOĞAMAZ (insan incelemesi)", async () => {
    const { documentId } = await belgeVeSurum(seed.A.tenantId);
    await expect(
      db.sql(`insert into public.policy_versions (tenant_id, policy_document_id, surum, durum, eklenme_kaynagi) values ($1, $2, 2, 'APPROVED', 'ai_taslak')`, [seed.A.tenantId, documentId]),
    ).rejects.toThrow(/AI taslagi/);
  });

  // --- PolicyException ---
  it("istisna: sahip ≠ onaylayan (dört göz); süresiz yasak; telafi kontrolü bağlanır", async () => {
    const { versionId } = await belgeVeSurum(seed.A.tenantId);
    // Süresiz (bitis <= baslangic) reddi.
    await expect(
      db.sql(`insert into public.policy_exceptions (tenant_id, policy_version_id, gerekce, sahip, baslangic, bitis) values ($1, $2, 'g', $3, current_date, current_date)`, [seed.A.tenantId, versionId, seed.A.userId]),
    ).rejects.toThrow();
    // Telafi kontrolüyle talep (M12 test tanımına bağ).
    const { rows: td } = await db.sql(
      `insert into public.control_test_definitions (tenant_id, control_id, tur, ad) values ($1, $2, 'MANUAL_PROCEDURE', 'Telafi') returning id`,
      [seed.A.tenantId, seed.controlId],
    );
    const { rows: ex } = await db.sql(
      `insert into public.policy_exceptions (tenant_id, policy_version_id, gerekce, sahip, bitis, telafi_test_definition_id) values ($1, $2, 'geçici muafiyet', $3, current_date + 30, $4) returning id`,
      [seed.A.tenantId, versionId, seed.A.userId, td[0].id],
    );
    // Sahip kendi istisnasını onaylayamaz.
    await expect(
      db.sql(`update public.policy_exceptions set durum = 'ONAYLANDI', onaylayan = $2, onay_zamani = now() where id = $1`, [ex[0].id, seed.A.userId]),
    ).rejects.toThrow(/dort goz/);
    // Farklı onaylayan geçer.
    await db.sql(`update public.policy_exceptions set durum = 'ONAYLANDI', onaylayan = $2, onay_zamani = now() where id = $1`, [ex[0].id, A_IKINCI]);
    const { rows } = await db.sql(`select durum from public.policy_exceptions where id = $1`, [ex[0].id]);
    expect(rows[0].durum).toBe("ONAYLANDI");
  });

  it("süresi dolan istisna otomatik YENİDEN_DEGERLENDIR kuyruğuna girer (cron fonksiyonu)", async () => {
    const { versionId } = await belgeVeSurum(seed.A.tenantId);
    const { rows: ex } = await db.sql(
      `insert into public.policy_exceptions (tenant_id, policy_version_id, gerekce, sahip, baslangic, bitis, durum, onaylayan, onay_zamani)
       values ($1, $2, 'g', $3, current_date - 10, current_date - 1, 'ONAYLANDI', $4, now()) returning id`,
      [seed.A.tenantId, versionId, seed.A.userId, A_IKINCI],
    );
    await db.sql(`select public.policy_istisna_suresi_dolanlari_isle()`);
    const { rows } = await db.sql(`select durum from public.policy_exceptions where id = $1`, [ex[0].id]);
    expect(rows[0].durum).toBe("YENIDEN_DEGERLENDIR");
    // İdempotent: ikinci koşu ONAYLANDI bulamaz, değiştirmez.
    await db.sql(`select public.policy_istisna_suresi_dolanlari_isle()`);
    const { rows: r2 } = await db.sql(`select durum from public.policy_exceptions where id = $1`, [ex[0].id]);
    expect(r2[0].durum).toBe("YENIDEN_DEGERLENDIR");
  });

  // --- PolicyImpact ---
  it("PolicyImpact PROPOSED doğar; AI önerisi APPLIED yapılamaz (insan incelemesi)", async () => {
    const pid = await hukumEkle();
    const { versionId } = await belgeVeSurum(seed.A.tenantId);
    const { rows: c } = await db.sql(
      `insert into public.policy_clauses (tenant_id, policy_version_id, madde_ref, metin) values ($1, $2, 'md.1', 'M') returning id`,
      [seed.A.tenantId, versionId],
    );
    // Doğuşta APPLIED reddi.
    await expect(
      db.sql(`insert into public.policy_impacts (tenant_id, policy_clause_id, provision_id, durum) values ($1, $2, $3, 'APPLIED')`, [seed.A.tenantId, c[0].id, pid]),
    ).rejects.toThrow(/yalniz PROPOSED/);
    // AI taslağı PROPOSED doğar ama APPLIED yapılamaz.
    const { rows: imp } = await db.sql(
      `insert into public.policy_impacts (tenant_id, policy_clause_id, provision_id, oneren_kaynak) values ($1, $2, $3, 'ai_taslak') returning id`,
      [seed.A.tenantId, c[0].id, pid],
    );
    await expect(
      db.sql(`update public.policy_impacts set durum = 'APPLIED' where id = $1`, [imp[0].id]),
    ).rejects.toThrow(/AI onerisi APPLIED yapilamaz/);
    // İnsan (manuel) önerisi APPLIED olabilir.
    const { rows: imp2 } = await db.sql(
      `insert into public.policy_impacts (tenant_id, policy_clause_id, provision_id) values ($1, $2, $3) returning id`,
      [seed.A.tenantId, c[0].id, pid],
    );
    await db.sql(`update public.policy_impacts set durum = 'APPLIED' where id = $1`, [imp2[0].id]);
  });

  it("audit izi: sürüm oluşturma + durum değişimi + onay kaydı düşer", async () => {
    const { versionId } = await belgeVeSurum(seed.A.tenantId);
    await db.sql(`update public.policy_versions set durum = 'IN_REVIEW', hazirlayan = $2, hazirlama_zamani = now() where id = $1`, [versionId, seed.A.userId]);
    await db.sql(`insert into public.policy_approvals (tenant_id, policy_version_id, approver, karar) values ($1, $2, $3, 'APPROVE')`, [seed.A.tenantId, versionId, A_IKINCI]);
    const { rows: v } = await db.sql(`select eylem from public.audit_log where hedef_tablo = 'policy_versions' and hedef_id = $1 order by created_at`, [versionId]);
    expect(v.map((r) => r.eylem)).toEqual(["policy_surum_olusturuldu", "policy_surum_durum_degisti"]);
    const { rows: a } = await db.sql(`select eylem from public.audit_log where hedef_tablo = 'policy_approvals'`);
    expect(a).toHaveLength(1);
  });
});
