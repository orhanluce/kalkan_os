// 37 Tez Dikey C (20260720000000): Model/Compliance Claim Guard. Dört-göz
// (20260718210000'in GERÇEK — incelemeye_alan ≠ dogrulayan — sürümünün
// aynısı) + Dikey C'ye özgü iki ek kural: VERIFIED yalnız kaynak VERIFIED'ken
// + kanıt varken; süre-dolumu/kaynak-değişimi yeniden inceleme kuyruğu;
// kimlik atfı; RLS.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, seedTwoTenants, type TestDb } from "./helpers/pg";

let db: TestDb;
let seed: Awaited<ReturnType<typeof seedTwoTenants>>;
/** A kiracısında ikinci kullanıcı — dört-göz "farklı kişi" testleri için. */
const A_IKINCI = "a0000000-0000-0000-0000-000000000002";

/** Kaynak + artifact + hüküm + yükümlülük kurar, obligation id'sini döndürür.
 * dogrulamaDurumu='VERIFIED' istenirse GERÇEK dört-göz zinciriyle (iki farklı
 * kişi) oraya taşınır — obligations'ın kendi guard'ı VERIFIED'i doğrudan
 * INSERT ile YASAKLAR (kural 3), tek-adımlı kısayol yoktur. */
async function yukumluluk(dogrulamaDurumu: "TODO_DOGRULA" | "LEGAL_REVIEW" | "VERIFIED" = "TODO_DOGRULA", kod = `YUK-${Math.random().toString(36).slice(2)}`) {
  const { rows: s } = await db.sql(
    `insert into public.regulatory_sources (authority, jurisdiction, kaynak_seviyesi, ad, erisim_politikasi_durumu)
     values ('SPK', 'TR', 'A', 'SPK Mevzuat Sistemi', 'manuel') returning id`,
  );
  const { rows: a } = await db.sql(
    `insert into public.source_artifacts (source_id, baslik, sha256) values ($1, 'Tebliğ v1', $2) returning id`,
    [s[0].id, "a".repeat(64)],
  );
  const { rows: p } = await db.sql(
    `insert into public.provisions (source_artifact_id, provision_ref, metin, effective_from) values ($1, 'md. 26', 'Hüküm metni', '2020-01-01') returning id`,
    [a[0].id],
  );
  const { rows: o } = await db.sql(
    `insert into public.obligations (provision_id, kod, baslik, amac, dogrulama_durumu) values ($1, $2, 'Test yükümlülüğü', 'Amaç', 'TODO_DOGRULA') returning id`,
    [p[0].id, kod],
  );
  const oid = o[0].id as string;
  if (dogrulamaDurumu === "TODO_DOGRULA") return oid;
  await db.sql(`update public.obligations set dogrulama_durumu = 'LEGAL_REVIEW', incelemeye_alan = $2, incelemeye_alinma_zamani = now() where id = $1`, [oid, seed.A.userId]);
  if (dogrulamaDurumu === "LEGAL_REVIEW") return oid;
  await db.sql(`update public.obligations set dogrulama_durumu = 'VERIFIED', dogrulayan = $2, dogrulama_zamani = now() where id = $1`, [oid, A_IKINCI]);
  return oid;
}

async function claimEkle(tenantId: string, extra: Record<string, unknown> = {}) {
  const { rows } = await db.sql(
    `insert into public.assurance_claims
       (tenant_id, iddia_turu, iddia_metni, sonuc, guven_gerekcesi, kaynak_obligation_id, kanit_referanslari, dogrulama_durumu)
     values ($1, $2, $3, $4, $5, $6, $7::jsonb, coalesce($8, 'DRAFT_RESEARCH'))
     returning id`,
    [
      tenantId,
      extra.iddia_turu ?? "UYUM",
      extra.iddia_metni ?? "Kontrol X yükümlülük Y'yi karşılıyor",
      extra.sonuc ?? "OLUMLU",
      extra.guven_gerekcesi ?? "Kontrol test sonucu + kanıt taraması",
      extra.kaynak_obligation_id ?? null,
      JSON.stringify(extra.kanit_referanslari ?? []),
      extra.dogrulama_durumu ?? null,
    ],
  );
  return rows[0].id as string;
}

/** Bir claim'i LEGAL_REVIEW'e taşır (incelemeye_alan atıflı). */
async function incelemeyeAl(claimId: string, incelemeyeAlan = seed.A.userId) {
  await db.sql(`update public.assurance_claims set dogrulama_durumu = 'LEGAL_REVIEW', incelemeye_alan = $2, incelemeye_alinma_zamani = now() where id = $1`, [claimId, incelemeyeAlan]);
}

beforeEach(async () => {
  db = await createTestDb();
  seed = await seedTwoTenants(db);
  await db.sql(`insert into auth.users (id, email) values ($1, 'a-ikinci@demo.com')`, [A_IKINCI]);
  await db.sql(`insert into public.profiles (id, tenant_id, role, full_name) values ($1, $2, 'uyum', 'A İkinci')`, [A_IKINCI, seed.A.tenantId]);
});
afterEach(async () => {
  await db.close();
});

describe("assurance_claims — dört-göz (20260718210000'in gerçek sürümü, incelemeye_alan ≠ dogrulayan)", () => {
  it("VERIFIED doğrudan doğamaz", async () => {
    await expect(claimEkle(seed.A.tenantId, { dogrulama_durumu: "VERIFIED" })).rejects.toThrow(/dogamaz/i);
  });

  it("VERIFIED'e geçiş yalnız LEGAL_REVIEW'den olabilir", async () => {
    const oid = await yukumluluk("VERIFIED");
    const id = await claimEkle(seed.A.tenantId, { dogrulama_durumu: "TODO_DOGRULA", kaynak_obligation_id: oid, kanit_referanslari: [{ tablo: "evidences", id: "e1" }] });
    await expect(
      db.sql(`update public.assurance_claims set dogrulama_durumu = 'VERIFIED', dogrulayan = $2, dogrulama_zamani = now() where id = $1`, [id, A_IKINCI]),
    ).rejects.toThrow(/LEGAL_REVIEW/);
  });

  it("LEGAL_REVIEW'e geçiş incelemeye_alan/zaman olmadan yapılamaz", async () => {
    const id = await claimEkle(seed.A.tenantId);
    await expect(db.sql(`update public.assurance_claims set dogrulama_durumu = 'LEGAL_REVIEW' where id = $1`, [id])).rejects.toThrow(/incelemeye_alan/i);
  });

  it("incelemeye alan kişi KENDİ sunumunu doğrulayamaz (dört göz)", async () => {
    const oid = await yukumluluk("VERIFIED");
    const id = await claimEkle(seed.A.tenantId, { kaynak_obligation_id: oid, kanit_referanslari: [{ tablo: "evidences", id: "e1" }] });
    await incelemeyeAl(id, seed.A.userId);
    await expect(
      db.sql(`update public.assurance_claims set dogrulama_durumu = 'VERIFIED', dogrulayan = $2, dogrulama_zamani = now() where id = $1`, [id, seed.A.userId]),
    ).rejects.toThrow(/kendi sunumunu dogrulayamaz/i);
  });

  it("farklı kişi doğrularsa geçer", async () => {
    const oid = await yukumluluk("VERIFIED");
    const id = await claimEkle(seed.A.tenantId, { kaynak_obligation_id: oid, kanit_referanslari: [{ tablo: "evidences", id: "e1" }] });
    await incelemeyeAl(id, seed.A.userId);
    await db.sql(`update public.assurance_claims set dogrulama_durumu = 'VERIFIED', dogrulayan = $2, dogrulama_zamani = now() where id = $1`, [id, A_IKINCI]);
    const { rows } = await db.sql(`select dogrulama_durumu from public.assurance_claims where id = $1`, [id]);
    expect(rows[0].dogrulama_durumu).toBe("VERIFIED");
  });

  it("VERIFIED içerik (iddia_metni/sonuc) donuk", async () => {
    const oid = await yukumluluk("VERIFIED");
    const id = await claimEkle(seed.A.tenantId, { kaynak_obligation_id: oid, kanit_referanslari: [{ tablo: "evidences", id: "e1" }] });
    await incelemeyeAl(id);
    await db.sql(`update public.assurance_claims set dogrulama_durumu = 'VERIFIED', dogrulayan = $2, dogrulama_zamani = now() where id = $1`, [id, A_IKINCI]);
    await expect(db.sql(`update public.assurance_claims set sonuc = 'OLUMSUZ' where id = $1`, [id])).rejects.toThrow(/degistirilemez/i);
  });
});

describe("assurance_claims — Dikey C'ye özgü VERIFIED ön koşulları (kural 3/4/6)", () => {
  it("kaynaksız iddia (kaynak_obligation_id null) VERIFIED olamaz", async () => {
    const id = await claimEkle(seed.A.tenantId, { kanit_referanslari: [{ tablo: "evidences", id: "e1" }] });
    await incelemeyeAl(id);
    await expect(
      db.sql(`update public.assurance_claims set dogrulama_durumu = 'VERIFIED', dogrulayan = $2, dogrulama_zamani = now() where id = $1`, [id, A_IKINCI]),
    ).rejects.toThrow(/kaynaksiz/i);
  });

  it("kaynağı VERIFIED olmayan (ör. TODO_DOGRULA) yükümlülüğe dayanan iddia VERIFIED olamaz", async () => {
    const oid = await yukumluluk("TODO_DOGRULA");
    const id = await claimEkle(seed.A.tenantId, { kaynak_obligation_id: oid, kanit_referanslari: [{ tablo: "evidences", id: "e1" }] });
    await incelemeyeAl(id);
    await expect(
      db.sql(`update public.assurance_claims set dogrulama_durumu = 'VERIFIED', dogrulayan = $2, dogrulama_zamani = now() where id = $1`, [id, A_IKINCI]),
    ).rejects.toThrow(/kaynak yukumluluk/i);
  });

  it("kanıtsız iddia (boş kanit_referanslari) kaynak VERIFIED olsa bile VERIFIED olamaz", async () => {
    const oid = await yukumluluk("VERIFIED");
    const id = await claimEkle(seed.A.tenantId, { kaynak_obligation_id: oid, kanit_referanslari: [] });
    await incelemeyeAl(id);
    await expect(
      db.sql(`update public.assurance_claims set dogrulama_durumu = 'VERIFIED', dogrulayan = $2, dogrulama_zamani = now() where id = $1`, [id, A_IKINCI]),
    ).rejects.toThrow(/kanitsiz/i);
  });

  it("kaynak VERIFIED + kanıt var + LEGAL_REVIEW'den geliyorsa VERIFIED'e geçer", async () => {
    const oid = await yukumluluk("VERIFIED");
    const id = await claimEkle(seed.A.tenantId, { kaynak_obligation_id: oid, kanit_referanslari: [{ tablo: "evidences", id: "e1" }] });
    await incelemeyeAl(id);
    await db.sql(`update public.assurance_claims set dogrulama_durumu = 'VERIFIED', dogrulayan = $2, dogrulama_zamani = now() where id = $1`, [id, A_IKINCI]);
    const { rows } = await db.sql(`select dogrulama_durumu from public.assurance_claims where id = $1`, [id]);
    expect(rows[0].dogrulama_durumu).toBe("VERIFIED");
  });
});

describe("assurance_claims — kaynak fotoğrafı (execution_legal_snapshots deseni)", () => {
  it("kaynak_obligation_id set edilince kaynak_durumu_anlik o anki durumu yakalar", async () => {
    const oid = await yukumluluk("TODO_DOGRULA");
    const id = await claimEkle(seed.A.tenantId, { kaynak_obligation_id: oid });
    const { rows } = await db.sql(`select kaynak_durumu_anlik from public.assurance_claims where id = $1`, [id]);
    expect(rows[0].kaynak_durumu_anlik).toBe("TODO_DOGRULA");
  });

  it("obligation SONRADAN LEGAL_REVIEW'e geçse bile eski claim'in fotoğrafı DEĞİŞMEZ (yeni UPDATE olmadan)", async () => {
    const oid = await yukumluluk("TODO_DOGRULA");
    const id = await claimEkle(seed.A.tenantId, { kaynak_obligation_id: oid });
    await db.sql(`update public.obligations set dogrulama_durumu = 'LEGAL_REVIEW', incelemeye_alan = $2, incelemeye_alinma_zamani = now() where id = $1`, [oid, seed.A.userId]);
    const { rows } = await db.sql(`select kaynak_durumu_anlik from public.assurance_claims where id = $1`, [id]);
    expect(rows[0].kaynak_durumu_anlik).toBe("TODO_DOGRULA");
  });
});

describe("assurance_claims — kimlik atfı + audit", () => {
  it("olusturan oturum sahibine sabitlenir", async () => {
    const { rows } = await db.asUser(
      seed.A.userId,
      `insert into public.assurance_claims (tenant_id, iddia_turu, iddia_metni, sonuc, guven_gerekcesi) values ($1, 'RISK', 'Test', 'OLUMLU', 'gerekçe') returning olusturan`,
      [seed.A.tenantId],
    );
    expect(rows[0].olusturan).toBe(seed.A.userId);
  });

  it("insert audit_log'a düşer", async () => {
    await claimEkle(seed.A.tenantId);
    const { rows } = await db.sql(`select count(*)::int as n from public.audit_log where eylem = 'iddia_olusturuldu' and tenant_id = $1`, [seed.A.tenantId]);
    expect(rows[0].n).toBe(1);
  });

  it("durum değişimi audit_log'a düşer", async () => {
    const id = await claimEkle(seed.A.tenantId);
    await incelemeyeAl(id);
    const { rows } = await db.sql(`select count(*)::int as n from public.audit_log where eylem = 'iddia_durum_degisti' and tenant_id = $1`, [seed.A.tenantId]);
    expect(rows[0].n).toBe(1);
  });
});

describe("assurance_claims — RLS", () => {
  it("cross-tenant: B, A'nın iddiasını göremez", async () => {
    await claimEkle(seed.A.tenantId);
    const { rows: a } = await db.asUser(seed.A.userId, `select id from public.assurance_claims`);
    const { rows: b } = await db.asUser(seed.B.userId, `select id from public.assurance_claims`);
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(0);
  });
});

describe("assurance_claims_yeniden_inceleme_isle (kural 9: süre-dolumu/kaynak-değişimi kuyruğu)", () => {
  async function verifiedClaim(oid: string) {
    const id = await claimEkle(seed.A.tenantId, { kaynak_obligation_id: oid, kanit_referanslari: [{ tablo: "evidences", id: "e1" }] });
    await incelemeyeAl(id);
    await db.sql(`update public.assurance_claims set dogrulama_durumu = 'VERIFIED', dogrulayan = $2, dogrulama_zamani = now() where id = $1`, [id, A_IKINCI]);
    return id;
  }

  it("yururluk_tarihi geçmiş VERIFIED iddia yeniden_inceleme_gerekli olur + audit", async () => {
    const oid = await yukumluluk("VERIFIED");
    const id = await verifiedClaim(oid);
    await db.sql(`update public.assurance_claims set yururluk_tarihi = '2020-01-01' where id = $1`, [id]);
    await db.sql(`select public.assurance_claims_yeniden_inceleme_isle()`);
    const { rows } = await db.sql(`select yeniden_inceleme_gerekli from public.assurance_claims where id = $1`, [id]);
    expect(rows[0].yeniden_inceleme_gerekli).toBe(true);
    const { rows: audit } = await db.sql(`select count(*)::int as n from public.audit_log where eylem = 'iddia_yeniden_inceleme_kuyruguna_alindi' and tenant_id = $1`, [seed.A.tenantId]);
    expect(audit[0].n).toBe(1);
  });

  it("kaynak yükümlülük SUPERSEDED olunca fotoğraftan farklıysa yeniden inceleme kuyruğuna girer", async () => {
    const oid = await yukumluluk("VERIFIED");
    const id = await verifiedClaim(oid);
    await db.sql(`update public.obligations set dogrulama_durumu = 'SUPERSEDED' where id = $1`, [oid]);
    await db.sql(`select public.assurance_claims_yeniden_inceleme_isle()`);
    const { rows } = await db.sql(`select yeniden_inceleme_gerekli from public.assurance_claims where id = $1`, [id]);
    expect(rows[0].yeniden_inceleme_gerekli).toBe(true);
  });

  it("süresi dolmamış ve kaynağı sağlam iddiaya dokunmaz", async () => {
    const oid = await yukumluluk("VERIFIED");
    const id = await verifiedClaim(oid);
    await db.sql(`update public.assurance_claims set yururluk_tarihi = '2099-01-01' where id = $1`, [id]);
    await db.sql(`select public.assurance_claims_yeniden_inceleme_isle()`);
    const { rows } = await db.sql(`select yeniden_inceleme_gerekli from public.assurance_claims where id = $1`, [id]);
    expect(rows[0].yeniden_inceleme_gerekli).toBe(false);
  });

  it("idempotent: ikinci koşu tekrar audit yazmaz", async () => {
    const id = await claimEkle(seed.A.tenantId);
    await db.sql(`update public.assurance_claims set yururluk_tarihi = '2020-01-01' where id = $1`, [id]);
    await db.sql(`select public.assurance_claims_yeniden_inceleme_isle()`);
    await db.sql(`select public.assurance_claims_yeniden_inceleme_isle()`);
    const { rows } = await db.sql(`select count(*)::int as n from public.audit_log where eylem = 'iddia_yeniden_inceleme_kuyruguna_alindi' and tenant_id = $1`, [seed.A.tenantId]);
    expect(rows[0].n).toBe(1);
  });
});
