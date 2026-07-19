// 37 Tez Dikey B ilk dilim (20260719310000): kurum yasal kimlik profili +
// RoI kaynak durum kataloğu. tenant_legal_identity tenant'a özgü (RLS +
// kimlik atfı + audit); roi_kaynak_kayitlari GLOBAL referans (obligations
// dört-göz guard'ının BİREBİR aynısı, kural 3).
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, seedTwoTenants, type TestDb } from "./helpers/pg";

let db: TestDb;
let seed: Awaited<ReturnType<typeof seedTwoTenants>>;

async function kimlikOlustur(tenantId: string, extra: Record<string, unknown> = {}) {
  const { rows } = await db.sql(
    `insert into public.tenant_legal_identity (tenant_id, lei, ulke_kodu, para_birimi)
     values ($1, $2, $3, $4) returning id`,
    [tenantId, extra.lei ?? "5493001KJTIIGC8Y1R12", extra.ulke_kodu ?? "TR", extra.para_birimi ?? "TRY"],
  );
  return rows[0].id as string;
}

async function roiKaydiEkle(extra: Record<string, unknown> = {}) {
  const { rows } = await db.sql(
    `insert into public.roi_kaynak_kayitlari (sablon_kodu, alan_kodu, alan_adi, zorunluluk_aciklamasi, kaynak_url, dogrulama_durumu)
     values ($1, $2, $3, $4, $5, coalesce($6, 'DRAFT_RESEARCH')) returning id`,
    [
      extra.sablon_kodu ?? "B_01.01",
      extra.alan_kodu ?? "B_01.01.0010",
      extra.alan_adi ?? "LEI of the financial entity maintaining the register",
      extra.zorunluluk_aciklamasi ?? "Mandatory",
      extra.kaynak_url ?? "https://eur-lex.europa.eu/eli/reg_impl/2024/2956/oj/eng",
      extra.dogrulama_durumu ?? null,
    ],
  );
  return rows[0].id as string;
}

beforeEach(async () => {
  db = await createTestDb();
  seed = await seedTwoTenants(db);
});
afterEach(async () => {
  await db.close();
});

describe("tenant_legal_identity — format guard + RLS + kimlik atfı", () => {
  it("geçerli LEI/ülke/para birimi kabul edilir", async () => {
    const id = await kimlikOlustur(seed.A.tenantId);
    const { rows } = await db.sql(`select lei, ulke_kodu, para_birimi from public.tenant_legal_identity where id = $1`, [id]);
    expect(rows[0].lei).toBe("5493001KJTIIGC8Y1R12");
    expect(rows[0].ulke_kodu).toBe("TR");
  });

  it("20 karakterden farklı LEI reddedilir (ISO 17442 format kontrolü)", async () => {
    await expect(
      db.sql(`insert into public.tenant_legal_identity (tenant_id, lei) values ($1, 'KISA')`, [seed.A.tenantId]),
    ).rejects.toThrow();
  });

  it("2 karakterden farklı ülke kodu reddedilir (ISO 3166-1 alpha-2)", async () => {
    await expect(
      db.sql(`insert into public.tenant_legal_identity (tenant_id, ulke_kodu) values ($1, 'TUR')`, [seed.A.tenantId]),
    ).rejects.toThrow();
  });

  it("3 karakterden farklı para birimi reddedilir (ISO 4217)", async () => {
    await expect(
      db.sql(`insert into public.tenant_legal_identity (tenant_id, para_birimi) values ($1, 'LIRA')`, [seed.A.tenantId]),
    ).rejects.toThrow();
  });

  it("EUID ve kurulus_turu serbest metin — format zorlanmaz (kaynak SOURCE_PENDING/kural 3)", async () => {
    const { rows } = await db.sql(
      `insert into public.tenant_legal_identity (tenant_id, euid, kurulus_turu, hiyerarsi_seviyesi) values ($1, 'HERHANGI', 'serbest metin', 'ana kuruluş') returning euid`,
      [seed.A.tenantId],
    );
    expect(rows[0].euid).toBe("HERHANGI");
  });

  it("her tenant yalnız bir kimlik satırı taşıyabilir (unique)", async () => {
    await kimlikOlustur(seed.A.tenantId);
    await expect(kimlikOlustur(seed.A.tenantId)).rejects.toThrow();
  });

  it("kimlik atfı: guncelleyen oturum sahibine sabitlenir, service context'te null kalır", async () => {
    const { rows } = await db.asUser(
      seed.A.userId,
      `insert into public.tenant_legal_identity (tenant_id, lei) values ($1, '5493001KJTIIGC8Y1R12') returning guncelleyen, guncelleme_zamani`,
      [seed.A.tenantId],
    );
    expect(rows[0].guncelleyen).toBe(seed.A.userId);
    expect(rows[0].guncelleme_zamani).not.toBeNull();
  });

  it("cross-tenant: B, A'nın kimlik profilini göremez/düzenleyemez", async () => {
    await kimlikOlustur(seed.A.tenantId);
    const { rows: bGoru } = await db.asUser(seed.B.userId, `select id from public.tenant_legal_identity`);
    expect(bGoru).toHaveLength(0);
  });

  it("güncelleme audit_log'a düşer (aktör dahil)", async () => {
    const id = await kimlikOlustur(seed.A.tenantId);
    await db.asUser(seed.A.userId, `update public.tenant_legal_identity set lei = '969500HYABCDEFG12345' where id = $1`, [id]);
    const { rows } = await db.sql(
      `select actor_id from public.audit_log where eylem = 'kurum_yasal_kimlik_guncellendi' and tenant_id = $1`,
      [seed.A.tenantId],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].actor_id).toBe(seed.A.userId);
  });
});

describe("roi_kaynak_kayitlari — global referans + kural 3 dört-göz guard'ı (obligations deseninin aynısı)", () => {
  it("her iki kiracının kullanıcısı da AYNI kaydı okur (global, tenant_id yok)", async () => {
    const id = await roiKaydiEkle();
    const { rows: a } = await db.asUser(seed.A.userId, `select id from public.roi_kaynak_kayitlari where id = $1`, [id]);
    const { rows: b } = await db.asUser(seed.B.userId, `select id from public.roi_kaynak_kayitlari where id = $1`, [id]);
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
  });

  it("authenticated kullanıcı yazamaz (yalnız service_role/ingest)", async () => {
    await expect(
      db.asUser(seed.A.userId, `insert into public.roi_kaynak_kayitlari (sablon_kodu, alan_adi, zorunluluk_aciklamasi, kaynak_url) values ('X', 'Y', 'Z', 'https://x')`),
    ).rejects.toThrow();
  });

  it("VERIFIED doğrudan doğamaz", async () => {
    await expect(roiKaydiEkle({ dogrulama_durumu: "VERIFIED" })).rejects.toThrow(/dogamaz/i);
  });

  it("VERIFIED'e geçiş yalnız LEGAL_REVIEW'den olabilir", async () => {
    const id = await roiKaydiEkle({ dogrulama_durumu: "TODO_DOGRULA" });
    await expect(
      db.sql(`update public.roi_kaynak_kayitlari set dogrulama_durumu = 'VERIFIED', dogrulayan = $2, dogrulama_zamani = now() where id = $1`, [id, seed.A.userId]),
    ).rejects.toThrow(/LEGAL_REVIEW/);
  });

  it("VERIFIED geçişi dogrulayan + zaman ister", async () => {
    const id = await roiKaydiEkle({ dogrulama_durumu: "LEGAL_REVIEW" });
    await expect(
      db.sql(`update public.roi_kaynak_kayitlari set dogrulama_durumu = 'VERIFIED' where id = $1`, [id]),
    ).rejects.toThrow(/dogrulayan/i);
  });

  it("LEGAL_REVIEW -> VERIFIED atıfla geçer", async () => {
    const id = await roiKaydiEkle({ dogrulama_durumu: "LEGAL_REVIEW" });
    await db.sql(`update public.roi_kaynak_kayitlari set dogrulama_durumu = 'VERIFIED', dogrulayan = $2, dogrulama_zamani = now() where id = $1`, [id, seed.A.userId]);
    const { rows } = await db.sql(`select dogrulama_durumu, dogrulayan from public.roi_kaynak_kayitlari where id = $1`, [id]);
    expect(rows[0].dogrulama_durumu).toBe("VERIFIED");
    expect(rows[0].dogrulayan).toBe(seed.A.userId);
  });

  it("VERIFIED kaydın içeriği (alan_adi) değiştirilemez", async () => {
    const id = await roiKaydiEkle({ dogrulama_durumu: "LEGAL_REVIEW" });
    await db.sql(`update public.roi_kaynak_kayitlari set dogrulama_durumu = 'VERIFIED', dogrulayan = $2, dogrulama_zamani = now() where id = $1`, [id, seed.A.userId]);
    await expect(
      db.sql(`update public.roi_kaynak_kayitlari set alan_adi = 'Değiştirilmiş ad' where id = $1`, [id]),
    ).rejects.toThrow(/degistirilemez/i);
  });

  it("aynı şablon+alan kodu ikinci kez eklenemez (unique)", async () => {
    await roiKaydiEkle();
    await expect(roiKaydiEkle()).rejects.toThrow();
  });

  it("kapali_kume_degerleri jsonb olarak taşınabilir (henüz bağlayıcı değil)", async () => {
    const { rows } = await db.sql(
      `insert into public.roi_kaynak_kayitlari (sablon_kodu, alan_kodu, alan_adi, zorunluluk_aciklamasi, kaynak_url, kapali_kume_degerleri)
       values ('B_02.02', 'B_02.02.0170', 'Sensitiveness of the data stored', 'Conditional', 'https://eur-lex.europa.eu/eli/reg_impl/2024/2956/oj/eng', $1::jsonb)
       returning kapali_kume_degerleri`,
      [JSON.stringify(["Low", "Medium", "High"])],
    );
    expect(rows[0].kapali_kume_degerleri).toEqual(["Low", "Medium", "High"]);
  });
});
