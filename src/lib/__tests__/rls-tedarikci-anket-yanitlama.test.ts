// 37 Tez Nihai Uygulama Talimatı — Dikey A (20260719300000): tedarikçi
// portalında anket yanıtlama. Adversarial: cross-tenant/cross-vendor/
// cross-questionnaire, geçersiz/dolmuş/iptal/yanlış-kapsam token, taslak/
// yayımlanmış anket, durum geçiş guard'ı, revizyon donması, çift-submit
// idempotency, süre-dolumu cron.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, seedTwoTenants, type TestDb } from "./helpers/pg";

let db: TestDb;
let seed: Awaited<ReturnType<typeof seedTwoTenants>>;

async function tedarikci(tenantId: string, ad: string) {
  const { rows } = await db.sql(`insert into public.third_parties (tenant_id, ad, tier) values ($1, $2, 'KRITIK') returning id`, [tenantId, ad]);
  return rows[0].id as string;
}

async function tokenHash(token: string): Promise<string> {
  const { rows } = await db.sql(`select encode(digest($1, 'sha256'), 'hex') as h`, [token]);
  return rows[0].h as string;
}

async function grant(tenantId: string, thirdPartyId: string, sonGecerlilik = YARIN, iptal = false) {
  const token = `tok-${Math.random().toString(36).slice(2)}-${Date.now()}`;
  const hash = await tokenHash(token);
  await db.sql(
    `insert into public.third_party_access_grants (tenant_id, third_party_id, external_email, token_hash, son_gecerlilik, iptal_edildi)
     values ($1, $2, 'vendor@example.com', $3, $4, $5)`,
    [tenantId, thirdPartyId, hash, sonGecerlilik, iptal],
  );
  return token;
}

/** Her zaman TASLAK doğar — yayın kapısı guard'ı sorusuz DEVAM'a izin vermiyor. */
async function assessment(tenantId: string, thirdPartyId: string) {
  const { rows } = await db.sql(
    `insert into public.third_party_assessments (tenant_id, third_party_id, tur, durum) values ($1, $2, 'DORA', 'TASLAK') returning id`,
    [tenantId, thirdPartyId],
  );
  return rows[0].id as string;
}

async function soru(tenantId: string, assessmentId: string, metin = "Şifreleme kullanıyor musunuz?") {
  const { rows } = await db.sql(
    `insert into public.assessment_questions (tenant_id, assessment_id, soru, sira) values ($1, $2, $3, 1) returning id`,
    [tenantId, assessmentId, metin],
  );
  return rows[0].id as string;
}

/** Sorular eklendikten SONRA çağrılmalı (yayın kapısı guard'ı). */
async function yayinla(assessmentId: string) {
  await db.sql(`update public.third_party_assessments set durum = 'DEVAM' where id = $1`, [assessmentId]);
}

/** Sık kullanılan kısayol: tedarikçi + TASLAK anket + 1 soru + yayınla + grant. */
async function yayimliAnket(tenantId: string, ad: string, soruMetni?: string) {
  const tp = await tedarikci(tenantId, ad);
  const a = await assessment(tenantId, tp);
  const q = await soru(tenantId, a, soruMetni);
  await yayinla(a);
  const token = await grant(tenantId, tp);
  return { thirdPartyId: tp, assessmentId: a, questionId: q, token };
}

async function getir(token: string, assessmentId: string) {
  const { rows } = await db.sql(`select public.tedarikci_anket_getir($1, $2) as sonuc`, [token, assessmentId]);
  return rows[0].sonuc as Record<string, unknown> | null;
}
async function taslakKaydet(token: string, assessmentId: string, cevaplar: unknown[]) {
  const { rows } = await db.sql(`select public.tedarikci_anket_taslak_kaydet($1, $2, $3) as sonuc`, [token, assessmentId, JSON.stringify(cevaplar)]);
  return rows[0].sonuc as Record<string, unknown> | null;
}
async function gonder(token: string, assessmentId: string) {
  const { rows } = await db.sql(`select public.tedarikci_anket_gonder($1, $2) as sonuc`, [token, assessmentId]);
  return rows[0].sonuc as Record<string, unknown> | null;
}

const YARIN = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
const DUN = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

beforeEach(async () => {
  db = await createTestDb();
  seed = await seedTwoTenants(db);
});
afterEach(async () => {
  await db.close();
});

describe("assessment_yayinla_guard (anket yayın kapısı)", () => {
  it("sorusuz anket DEVAM'a geçemez", async () => {
    const tp = await tedarikci(seed.A.tenantId, "V1");
    const a = await assessment(seed.A.tenantId, tp);
    await expect(db.sql(`update public.third_party_assessments set durum = 'DEVAM' where id = $1`, [a])).rejects.toThrow(/en az bir soru/i);
  });

  it("en az bir soru varsa DEVAM'a geçer", async () => {
    const tp = await tedarikci(seed.A.tenantId, "V2");
    const a = await assessment(seed.A.tenantId, tp);
    await soru(seed.A.tenantId, a);
    await yayinla(a);
    const { rows } = await db.sql(`select durum from public.third_party_assessments where id = $1`, [a]);
    expect(rows[0].durum).toBe("DEVAM");
  });
});

describe("tedarikci_anket_getir", () => {
  it("TASLAK (yayınlanmamış) anket, geçerli token olsa bile null döner", async () => {
    const tp = await tedarikci(seed.A.tenantId, "V3");
    const a = await assessment(seed.A.tenantId, tp);
    await soru(seed.A.tenantId, a);
    const token = await grant(seed.A.tenantId, tp);
    expect(await getir(token, a)).toBeNull();
  });

  it("yayımlanmış anket: sorular döner, revizyon henüz yok (null)", async () => {
    const { assessmentId, token } = await yayimliAnket(seed.A.tenantId, "V4", "Soru 1");
    const sonuc = await getir(token, assessmentId);
    expect((sonuc?.sorular as unknown[]).length).toBe(1);
    expect(sonuc?.revizyon).toBeNull();
  });

  it("yanlış kapsam: token third_party A, assessment_id third_party B'ye ait → null", async () => {
    const tpA = await tedarikci(seed.A.tenantId, "V5-A");
    const { assessmentId: aB } = await yayimliAnket(seed.A.tenantId, "V5-B");
    const tokenForA = await grant(seed.A.tenantId, tpA);
    expect(await getir(tokenForA, aB)).toBeNull();
  });

  it("cross-tenant: B'nin anketi A'nın token'ıyla görülemez", async () => {
    const tpA = await tedarikci(seed.A.tenantId, "V6-A");
    const { assessmentId: aB } = await yayimliAnket(seed.B.tenantId, "V6-B");
    const tokenForA = await grant(seed.A.tenantId, tpA);
    expect(await getir(tokenForA, aB)).toBeNull();
  });

  it("süresi dolmuş/iptal/geçersiz token aynı null davranışı verir", async () => {
    const tp = await tedarikci(seed.A.tenantId, "V7");
    const a = await assessment(seed.A.tenantId, tp);
    await soru(seed.A.tenantId, a);
    await yayinla(a);
    const dolmus = await grant(seed.A.tenantId, tp, DUN);
    const iptalT = await grant(seed.A.tenantId, tp, YARIN, true);
    expect(await getir(dolmus, a)).toBeNull();
    expect(await getir(iptalT, a)).toBeNull();
    expect(await getir("hic-var-olmamis-token", a)).toBeNull();
  });

  it("her görüntüleme audit'e düşer (aktörsüz)", async () => {
    const { assessmentId, token } = await yayimliAnket(seed.A.tenantId, "V8");
    await getir(token, assessmentId);
    const { rows } = await db.sql(`select actor_id from public.audit_log where eylem = 'tedarikci_anket_goruntulendi' and tenant_id = $1`, [seed.A.tenantId]);
    expect(rows).toHaveLength(1);
    expect(rows[0].actor_id).toBeNull();
  });
});

describe("tedarikci_anket_taslak_kaydet", () => {
  it("ilk kayıt revizyon 1 TASLAK açar ve cevapları yazar", async () => {
    const { assessmentId, questionId, token } = await yayimliAnket(seed.A.tenantId, "V9");
    const sonuc = await taslakKaydet(token, assessmentId, [{ questionId, cevap: "Evet, AES-256", kanitMetni: "https://ornek.com/politika" }]);
    expect(sonuc?.revizyon).toBe(1);
    expect(sonuc?.durum).toBe("TASLAK");
    const { rows } = await db.sql(`select cevap, kanit_metni from public.assessment_response_answers`);
    expect(rows[0].cevap).toBe("Evet, AES-256");
  });

  it("tekrar kaydetme AYNI revizyonu günceller (upsert, yeni satır açmaz)", async () => {
    const { assessmentId, questionId, token } = await yayimliAnket(seed.A.tenantId, "V10");
    await taslakKaydet(token, assessmentId, [{ questionId, cevap: "İlk taslak" }]);
    await taslakKaydet(token, assessmentId, [{ questionId, cevap: "Düzeltilmiş taslak" }]);
    const { rows: revs } = await db.sql(`select count(*)::int as n from public.assessment_response_revisions where assessment_id = $1`, [assessmentId]);
    expect(revs[0].n).toBe(1);
    const { rows: ans } = await db.sql(`select cevap from public.assessment_response_answers`);
    expect(ans).toHaveLength(1);
    expect(ans[0].cevap).toBe("Düzeltilmiş taslak");
  });

  it("başka anketin sorusu sessizce yok sayılır (kapsam dışına yazılamaz)", async () => {
    const tp = await tedarikci(seed.A.tenantId, "V11");
    const a1 = await assessment(seed.A.tenantId, tp);
    await soru(seed.A.tenantId, a1);
    await yayinla(a1);
    const a2 = await assessment(seed.A.tenantId, tp);
    const yabanciSoru = await soru(seed.A.tenantId, a2);
    await yayinla(a2);
    const token = await grant(seed.A.tenantId, tp);
    await taslakKaydet(token, a1, [{ questionId: yabanciSoru, cevap: "Sızmamalı" }]);
    const { rows } = await db.sql(`select count(*)::int as n from public.assessment_response_answers`);
    expect(rows[0].n).toBe(0);
  });

  it("GONDERILDI revizyonda taslak kaydedilemez", async () => {
    const { assessmentId, questionId, token } = await yayimliAnket(seed.A.tenantId, "V12");
    await taslakKaydet(token, assessmentId, [{ questionId, cevap: "Cevap" }]);
    await gonder(token, assessmentId);
    const sonuc = await taslakKaydet(token, assessmentId, [{ questionId, cevap: "Değişiklik" }]);
    expect(sonuc?.hata).toBe("BU_ASAMADA_DUZENLENEMEZ");
    expect(sonuc?.durum).toBe("GONDERILDI");
  });

  it("DEGISIKLIK_ISTENDI sonrası taslak kaydetmek YENİ revizyon açar (eskisi donuk kalır)", async () => {
    const { assessmentId, questionId, token } = await yayimliAnket(seed.A.tenantId, "V13");
    await taslakKaydet(token, assessmentId, [{ questionId, cevap: "v1 cevap" }]);
    await gonder(token, assessmentId);
    await db.sql(
      `update public.assessment_response_revisions set durum = 'DEGISIKLIK_ISTENDI', inceleyen = $2, inceleme_gerekcesi = 'Daha fazla detay gerekli', inceleme_zamani = now() where assessment_id = $1 and surum = 1`,
      [assessmentId, seed.A.userId],
    );
    const sonuc = await taslakKaydet(token, assessmentId, [{ questionId, cevap: "v2 cevap (revize)" }]);
    expect(sonuc?.revizyon).toBe(2);
    // v1'in cevabı DONUK kalmalı.
    const { rows: v1 } = await db.sql(
      `select a.cevap from public.assessment_response_answers a
       join public.assessment_response_revisions r on r.id = a.revizyon_id
       where r.assessment_id = $1 and r.surum = 1`,
      [assessmentId],
    );
    expect(v1[0].cevap).toBe("v1 cevap");
    const { rows: v2 } = await db.sql(
      `select a.cevap from public.assessment_response_answers a
       join public.assessment_response_revisions r on r.id = a.revizyon_id
       where r.assessment_id = $1 and r.surum = 2`,
      [assessmentId],
    );
    expect(v2[0].cevap).toBe("v2 cevap (revize)");
  });
});

describe("assessment_response_answer_guard (revizyon donması)", () => {
  it("TASLAK dışı revizyona doğrudan INSERT reddedilir (RPC dışı yol)", async () => {
    const { assessmentId, questionId, token } = await yayimliAnket(seed.A.tenantId, "V14");
    await taslakKaydet(token, assessmentId, [{ questionId, cevap: "x" }]);
    await gonder(token, assessmentId);
    const { rows: rev } = await db.sql(`select id from public.assessment_response_revisions where assessment_id = $1 and surum = 1`, [assessmentId]);
    await expect(
      db.sql(`insert into public.assessment_response_answers (tenant_id, revizyon_id, question_id, cevap) values ($1, $2, $3, 'kaçak')`, [
        seed.A.tenantId,
        rev[0].id,
        questionId,
      ]),
    ).rejects.toThrow(/yalniz taslak/i);
  });
});

describe("tedarikci_anket_gonder", () => {
  it("boş anket gönderilemez", async () => {
    const { assessmentId, questionId, token } = await yayimliAnket(seed.A.tenantId, "V15");
    await taslakKaydet(token, assessmentId, [{ questionId, cevap: "" }]);
    const sonuc = await gonder(token, assessmentId);
    expect(sonuc?.hata).toBe("BOS_ANKET_GONDERILEMEZ");
  });

  it("taslak hiç yoksa TASLAK_YOK döner", async () => {
    const { assessmentId, token } = await yayimliAnket(seed.A.tenantId, "V16");
    expect((await gonder(token, assessmentId))?.hata).toBe("TASLAK_YOK");
  });

  it("çift submit idempotent: ikinci çağrı hata vermez, aynı durumu döner, ikinci audit YAZMAZ", async () => {
    const { assessmentId, questionId, token } = await yayimliAnket(seed.A.tenantId, "V17");
    await taslakKaydet(token, assessmentId, [{ questionId, cevap: "cevap" }]);
    const ilk = await gonder(token, assessmentId);
    const ikinci = await gonder(token, assessmentId);
    expect(ilk?.durum).toBe("GONDERILDI");
    expect(ikinci?.durum).toBe("GONDERILDI");
    expect(ikinci?.revizyon).toBe(1);
    const { rows } = await db.sql(`select count(*)::int as n from public.audit_log where eylem = 'tedarikci_anket_gonderildi' and tenant_id = $1`, [seed.A.tenantId]);
    expect(rows[0].n).toBe(1);
    const { rows: revCount } = await db.sql(`select count(*)::int as n from public.assessment_response_revisions where assessment_id = $1`, [assessmentId]);
    expect(revCount[0].n).toBe(1);
  });
});

describe("assessment_response_revision_guard (kurum incelemesi — durum geçişleri)", () => {
  async function gonderilmisRevizyon(tenantId: string, ad: string) {
    const { assessmentId, questionId, token } = await yayimliAnket(tenantId, ad);
    await taslakKaydet(token, assessmentId, [{ questionId, cevap: "cevap" }]);
    await gonder(token, assessmentId);
    const { rows } = await db.sql(`select id from public.assessment_response_revisions where assessment_id = $1 and surum = 1`, [assessmentId]);
    return { assessmentId, revizyonId: rows[0].id as string };
  }

  it("kurum TASLAK revizyona ASLA dokunamaz (RLS: durum='GONDERILDI' değilse hiçbir satır eşleşmez)", async () => {
    const { assessmentId, questionId, token } = await yayimliAnket(seed.A.tenantId, "V18");
    await taslakKaydet(token, assessmentId, [{ questionId, cevap: "cevap" }]);
    const { rows } = await db.sql(`select id from public.assessment_response_revisions where assessment_id = $1`, [assessmentId]);
    await db.asUser(
      seed.A.userId,
      `update public.assessment_response_revisions set durum = 'KABUL_EDILDI', inceleyen = $2, inceleme_zamani = now() where id = $1`,
      [rows[0].id, seed.A.userId],
    );
    // RLS USING satırı eşleşmediği için UPDATE sessizce 0 satır etkiler — durum TASLAK kalmalı.
    const { rows: sonra } = await db.sql(`select durum from public.assessment_response_revisions where id = $1`, [rows[0].id]);
    expect(sonra[0].durum).toBe("TASLAK");
  });

  it("GONDERILDI → DEGISIKLIK_ISTENDI gerekçesiz reddedilir", async () => {
    const { revizyonId } = await gonderilmisRevizyon(seed.A.tenantId, "V18b");
    await expect(
      db.asUser(seed.A.userId, `update public.assessment_response_revisions set durum = 'DEGISIKLIK_ISTENDI', inceleyen = $2, inceleme_zamani = now() where id = $1`, [
        revizyonId,
        seed.A.userId,
      ]),
    ).rejects.toThrow(/gerekce/i);
  });

  it("GONDERILDI → DEGISIKLIK_ISTENDI gerekçeyle geçer, kimlik atfı zorunlu", async () => {
    const { revizyonId } = await gonderilmisRevizyon(seed.A.tenantId, "V18c");
    // Başkası adına inceleme yapılamaz.
    await expect(
      db.asUser(
        seed.A.userId,
        `update public.assessment_response_revisions set durum = 'DEGISIKLIK_ISTENDI', inceleyen = $2, inceleme_gerekcesi = 'detay eksik', inceleme_zamani = now() where id = $1`,
        [revizyonId, "a0000000-0000-0000-0000-000000000099"],
      ),
    ).rejects.toThrow(/oturum sahibi/i);
    // Kendi adına geçer.
    await db.asUser(
      seed.A.userId,
      `update public.assessment_response_revisions set durum = 'DEGISIKLIK_ISTENDI', inceleyen = $2, inceleme_gerekcesi = 'detay eksik', inceleme_zamani = now() where id = $1`,
      [revizyonId, seed.A.userId],
    );
    const { rows } = await db.sql(`select durum from public.assessment_response_revisions where id = $1`, [revizyonId]);
    expect(rows[0].durum).toBe("DEGISIKLIK_ISTENDI");
  });

  it("GONDERILDI → KABUL_EDILDI gerekçesiz geçer (kabul için gerekçe zorunlu değil)", async () => {
    const { revizyonId } = await gonderilmisRevizyon(seed.A.tenantId, "V18d");
    await db.asUser(seed.A.userId, `update public.assessment_response_revisions set durum = 'KABUL_EDILDI', inceleyen = $2, inceleme_zamani = now() where id = $1`, [
      revizyonId,
      seed.A.userId,
    ]);
    const { rows } = await db.sql(`select durum from public.assessment_response_revisions where id = $1`, [revizyonId]);
    expect(rows[0].durum).toBe("KABUL_EDILDI");
  });

  it("terminal durumdan (KABUL_EDILDI) geçiş yapılamaz", async () => {
    const { revizyonId } = await gonderilmisRevizyon(seed.A.tenantId, "V18e");
    await db.sql(`update public.assessment_response_revisions set durum = 'KABUL_EDILDI', inceleyen = $2, inceleme_zamani = now() where id = $1`, [revizyonId, seed.A.userId]);
    await expect(
      db.sql(`update public.assessment_response_revisions set durum = 'REDDEDILDI', inceleyen = $2, inceleme_gerekcesi = 'x', inceleme_zamani = now() where id = $1`, [
        revizyonId,
        seed.A.userId,
      ]),
    ).rejects.toThrow(/terminal/i);
  });

  it("cross-tenant: B, A'nın revizyonunu inceleyemez (RLS)", async () => {
    const { revizyonId } = await gonderilmisRevizyon(seed.A.tenantId, "V18f");
    await db.asUser(
      seed.B.userId,
      `update public.assessment_response_revisions set durum = 'KABUL_EDILDI', inceleyen = $2, inceleme_zamani = now() where id = $1`,
      [revizyonId, seed.B.userId],
    );
    const { rows } = await db.sql(`select durum from public.assessment_response_revisions where id = $1`, [revizyonId]);
    expect(rows[0].durum).toBe("GONDERILDI");
  });
});

describe("tedarikci_anket_suresi_dolanlari_isle (37 Tez süre-dolumu cron)", () => {
  it("aktif grant'ı olmayan tedarikçinin açık revizyonu SURESI_DOLDU olur + audit", async () => {
    const tp = await tedarikci(seed.A.tenantId, "V19");
    const a = await assessment(seed.A.tenantId, tp);
    await soru(seed.A.tenantId, a);
    await yayinla(a);
    await grant(seed.A.tenantId, tp, DUN); // ZATEN dolmuş grant.
    // Süresi dolmuş token'la kaydetmek zaten null döner; DB'ye doğrudan
    // TASLAK revizyon açarak cron'un ölçtüğü gerçek senaryoyu kuruyoruz.
    await db.sql(`insert into public.assessment_response_revisions (tenant_id, assessment_id, surum, durum) values ($1, $2, 1, 'TASLAK')`, [seed.A.tenantId, a]);
    await db.sql(`select public.tedarikci_anket_suresi_dolanlari_isle()`);
    const { rows } = await db.sql(`select durum from public.assessment_response_revisions where assessment_id = $1`, [a]);
    expect(rows[0].durum).toBe("SURESI_DOLDU");
    const { rows: audit } = await db.sql(`select count(*)::int as n from public.audit_log where eylem = 'tedarikci_anket_suresi_doldu' and tenant_id = $1`, [seed.A.tenantId]);
    expect(audit[0].n).toBe(1);
  });

  it("hâlâ aktif grant'ı olan tedarikçinin revizyonuna dokunmaz", async () => {
    const tp = await tedarikci(seed.A.tenantId, "V20");
    const a = await assessment(seed.A.tenantId, tp);
    await soru(seed.A.tenantId, a);
    await yayinla(a);
    await grant(seed.A.tenantId, tp, YARIN); // hâlâ geçerli.
    await db.sql(`insert into public.assessment_response_revisions (tenant_id, assessment_id, surum, durum) values ($1, $2, 1, 'TASLAK')`, [seed.A.tenantId, a]);
    await db.sql(`select public.tedarikci_anket_suresi_dolanlari_isle()`);
    const { rows } = await db.sql(`select durum from public.assessment_response_revisions where assessment_id = $1`, [a]);
    expect(rows[0].durum).toBe("TASLAK");
  });

  it("idempotent: ikinci koşu tekrar SURESI_DOLDU işlemez / hata vermez", async () => {
    const tp = await tedarikci(seed.A.tenantId, "V21");
    const a = await assessment(seed.A.tenantId, tp);
    await soru(seed.A.tenantId, a);
    await yayinla(a);
    await db.sql(`insert into public.assessment_response_revisions (tenant_id, assessment_id, surum, durum) values ($1, $2, 1, 'TASLAK')`, [seed.A.tenantId, a]);
    await db.sql(`select public.tedarikci_anket_suresi_dolanlari_isle()`);
    await db.sql(`select public.tedarikci_anket_suresi_dolanlari_isle()`);
    const { rows: audit } = await db.sql(`select count(*)::int as n from public.audit_log where eylem = 'tedarikci_anket_suresi_doldu' and tenant_id = $1`, [seed.A.tenantId]);
    expect(audit[0].n).toBe(1);
  });
});

describe("cascade zinciri (canlı e2e'nin yakaladığı bug: 20260719301000)", () => {
  it("third_parties silinince cevapları olan bir anket de TAM temizlenir (FK RESTRICT çakışması yok)", async () => {
    const { assessmentId, questionId, thirdPartyId, token } = await yayimliAnket(seed.A.tenantId, "V23");
    await taslakKaydet(token, assessmentId, [{ questionId, cevap: "cevap" }]);
    await gonder(token, assessmentId);
    // Önceki şemada (question_id ON DELETE RESTRICT) bu silme FK ihlaliyle
    // reddedilirdi çünkü assessment_response_answers hâlâ soruyu referans
    // alıyordu — cascade zincirinin ortasında çatışma.
    await expect(db.sql(`delete from public.third_parties where id = $1`, [thirdPartyId])).resolves.toBeDefined();
    const { rows } = await db.sql(`select id from public.assessment_response_answers`);
    expect(rows).toHaveLength(0);
  });
});

describe("assessment_response_answers/revisions RLS temel görünürlük", () => {
  it("yalnız aynı tenant SELECT edebilir", async () => {
    const { assessmentId, questionId, token } = await yayimliAnket(seed.A.tenantId, "V22");
    await taslakKaydet(token, assessmentId, [{ questionId, cevap: "x" }]);
    const { rows: aRows } = await db.asUser(seed.A.userId, `select id from public.assessment_response_revisions`);
    expect(aRows).toHaveLength(1);
    const { rows: bRows } = await db.asUser(seed.B.userId, `select id from public.assessment_response_revisions`);
    expect(bRows).toHaveLength(0);
  });
});
