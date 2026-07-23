import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { E2E_KULLANICI_ADI, E2E_KURUM_ADI, girisYap, ikinciKullaniciGirisYap } from "./helpers";

// Dikey E, E2, Kapı 2: telafi edici kontrol — uçtan uca gerçek Chromium akışı.
// E1 spec'inin notu ("Telafi edici kontrol E2'ye ertelendi") burada kapanıyor.
// Kapsam: öner→incelemeye gönder→bağımsız onay→AKTIF (bulgu AÇIK kalır, genel
// durum KRITIK_BULGU_TELAFI_ALTINDA), + reddetme/iptal downgrade (gerçek
// zamanla OYNAMADAN — kurucunun kendi seçimiyle, süre-dolumu (SURESI_DOLDU)
// geçişi yalnız PGlite'ta test edilir, canlı bir trigger'ı geçici devre dışı
// bırakmak gerektirdiği için buraya taşınmadı, bkz. Dikey E2 §15 raporu).

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env eksik (.env.local).");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function fixtureKur(db: ReturnType<typeof admin>, tenantId: string, vendorAd: string, testDefAd: string) {
  await db.from("third_parties").delete().eq("tenant_id", tenantId).eq("ad", vendorAd);

  const { data: vendor } = await db.from("third_parties").insert({ tenant_id: tenantId, ad: vendorAd, tier: "KRITIK" }).select("id").single();
  const vendorId = vendor!.id as string;

  const { data: kontrol } = await db.from("controls").select("id, madde_ref").limit(1).single();
  const controlId = kontrol!.id as string;

  const { data: testDef } = await db
    .from("control_test_definitions")
    .insert({ tenant_id: tenantId, control_id: controlId, tur: "MANUAL_PROCEDURE", ad: testDefAd })
    .select("id")
    .single();
  const { data: run } = await db
    .from("test_runs")
    .insert({ tenant_id: tenantId, test_definition_id: testDef!.id, control_id: controlId, sonuc: "PASSED", gerekce: "e2e", tanim_surumu: 1 })
    .select("id")
    .single();

  return { vendorId, controlId, testRunId: run!.id as string, testDefId: testDef!.id as string };
}

/**
 * UI'da görünür olan bir satırın admin client sorgusuna da yansımasını
 * bekler — Supabase'de bazen istemci tarafında commit görünür olduktan
 * (React state güncellemesi) hemen sonraki bağımsız bir sorgu birkaç
 * milisaniye erken gelebiliyor (gerçek bir ürün hatası DEĞİL, salt test
 * senkronizasyonu). Gerçek zaman BEKLEMİYOR — yalnız kısa aralıklarla
 * yeniden dener.
 */
async function tekAsmtBekle(db: ReturnType<typeof admin>, thirdPartyId: string): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const { data } = await db.from("third_party_assessments").select("id").eq("third_party_id", thirdPartyId).maybeSingle();
    if (data) return data.id as string;
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error("tekAsmtBekle: değerlendirme bulunamadı (zaman aşımı)");
}
async function tekBulguBekle(db: ReturnType<typeof admin>, assessmentId: string): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const { data } = await db.from("assessment_findings").select("id").eq("assessment_id", assessmentId).maybeSingle();
    if (data) return data.id as string;
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error("tekBulguBekle: bulgu bulunamadı (zaman aşımı)");
}

async function temizle(db: ReturnType<typeof admin>, tenantId: string, vendorAd: string, vendorId: string, testDefId: string) {
  await db.from("third_parties").delete().eq("id", vendorId);
  await db.from("control_test_definitions").delete().eq("id", testDefId);
  await db.from("third_parties").delete().eq("tenant_id", tenantId).eq("ad", vendorAd);
}

test("Dikey E2: öner → incelemeye gönder → bağımsız onay → AKTIF (bulgu AÇIK kalır)", async ({ page }) => {
  test.setTimeout(180_000);
  const db = admin();
  const { data: kurum } = await db.from("tenants").select("id").eq("name", E2E_KURUM_ADI).single();
  const tenantId = kurum!.id as string;

  const VENDOR = "E2E Dikey E2 Vendor A.Ş.";
  const fx = await fixtureKur(db, tenantId, VENDOR, "E2E Dikey E2 Test — Onay Akışı");

  try {
    await girisYap(page);
    await page.goto(`/tedarikciler/${fx.vendorId}`);

    await page.getByRole("button", { name: "Yeni Değerlendirme (DORA)" }).click();
    await expect(page.getByText("TASLAK")).toBeVisible({ timeout: 10_000 });
    const aId = await tekAsmtBekle(db, fx.vendorId);

    await page.getByLabel(`${aId} bulgu başlık`).fill("E2E: Şifreleme eksikliği E2");
    await page.getByLabel(`${aId} ciddiyet`).selectOption("KRITIK");
    await page.getByLabel(`${aId} bulgu sahibi`).selectOption({ label: E2E_KULLANICI_ADI });
    await page.getByRole("button", { name: "Bulgu Ekle" }).click();
    await expect(page.getByText("Açık KRİTİK bulgu")).toBeVisible();

    const fId = await tekBulguBekle(db, aId);

    await page.getByRole("button", { name: "Yeniden Önizle" }).click();
    await expect(page.getByText("Kritik bulgu nedeniyle engellendi")).toBeVisible({ timeout: 10_000 });

    const telafiBlok = page.getByTestId(`telafi-blok-${fId}`);
    await expect(telafiBlok).toBeVisible();
    await telafiBlok.getByLabel(`${fId} telafi kontrol seç`).selectOption({ value: fx.controlId });
    await telafiBlok.getByLabel(`${fId} telafi test koşusu seç`).selectOption({ value: fx.testRunId });
    await telafiBlok.getByLabel(`${fId} telafi gerekçesi`).fill("E2E: sıkılaştırılmış erişim kontrolü telafi edici önlem");
    const bugun = new Date().toISOString().slice(0, 10);
    await telafiBlok.getByLabel(`${fId} telafi geçerlilik başlangıcı`).fill(bugun);
    await telafiBlok.getByLabel(`${fId} telafi geçerlilik bitişi`).fill("2030-01-01");
    await telafiBlok.getByRole("button", { name: "Öner ve İncelemeye Gönder" }).click();

    await expect(telafiBlok.getByText("İncelemede")).toBeVisible({ timeout: 10_000 });
    await expect(telafiBlok.getByText("Bu öneriyi siz hazırladınız")).toBeVisible();

    // Bağımsız onay olmadan güvence hâlâ ENGELLENDI.
    await page.getByRole("button", { name: "Yeniden Önizle" }).click();
    await expect(page.getByText("Kritik bulgu nedeniyle engellendi")).toBeVisible({ timeout: 10_000 });

    // Farklı yetkili (Mehmet) onaylar.
    // `waitForURL` şart — bkz. dikey-e1-cloud-assurance.spec.ts'teki
    // 2026-07-23 root-cause notu: signOut() asenkron, hemen ikinci girişe
    // geçmek eski oturum cookie'siyle yarışıp /tanitim'de tıkanabiliyordu.
    await page.getByRole("button", { name: "Çıkış", exact: true }).click();
    await page.waitForURL("**/giris");
    await ikinciKullaniciGirisYap(page);
    await page.goto(`/tedarikciler/${fx.vendorId}`);
    const telafiBlokMehmet = page.getByTestId(`telafi-blok-${fId}`);
    await telafiBlokMehmet.getByRole("button", { name: "Onayla (Aktive Et)" }).click();

    await expect(telafiBlokMehmet.getByText("Telafi ile yönetiliyor (bulgu AÇIK)")).toBeVisible({ timeout: 10_000 });
    await expect(
      telafiBlokMehmet.getByText(
        "Bulgu açık kalmaktadır; doğrulanmış telafi edici kontrol nedeniyle belirli süreyle yönetilmektedir.",
      ),
    ).toBeVisible();

    // Bulgu HÂLÂ açık listede görünür — kapanmadı.
    await expect(page.getByText("E2E: Şifreleme eksikliği E2", { exact: true })).toBeVisible();

    // Güvence profili artık ENGELLENDI değil, KRITIK_BULGU_TELAFI_ALTINDA.
    await page.getByRole("button", { name: "Yeniden Önizle" }).click();
    await expect(page.getByText("Kritik bulgu açık — telafi edici kontrol altında")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Kritik bulgu nedeniyle engellendi")).toHaveCount(0);

    // Sign-off davranışı bozulmadı: bulgu AÇIK olduğu için tamamlama hâlâ kapalı.
    await expect(page.getByRole("button", { name: "Değerlendirmeyi Tamamla" })).toBeDisabled();
  } finally {
    await temizle(db, tenantId, VENDOR, fx.vendorId, fx.testDefId);
  }
});

test("Dikey E2: reddetme ve iptal — downgrade gerçek zamanla OYNAMADAN kanıtlanır", async ({ page }) => {
  test.setTimeout(180_000);
  const db = admin();
  const { data: kurum } = await db.from("tenants").select("id").eq("name", E2E_KURUM_ADI).single();
  const tenantId = kurum!.id as string;

  const VENDOR = "E2E Dikey E2 Vendor B A.Ş.";
  const fx = await fixtureKur(db, tenantId, VENDOR, "E2E Dikey E2 Test — Downgrade Akışı");

  try {
    await girisYap(page);
    await page.goto(`/tedarikciler/${fx.vendorId}`);
    await page.getByRole("button", { name: "Yeni Değerlendirme (DORA)" }).click();
    await expect(page.getByText("TASLAK")).toBeVisible({ timeout: 10_000 });
    const aId = await tekAsmtBekle(db, fx.vendorId);

    await page.getByLabel(`${aId} bulgu başlık`).fill("E2E: Downgrade bulgusu");
    await page.getByLabel(`${aId} ciddiyet`).selectOption("KRITIK");
    await page.getByLabel(`${aId} bulgu sahibi`).selectOption({ label: E2E_KULLANICI_ADI });
    await page.getByRole("button", { name: "Bulgu Ekle" }).click();
    await expect(page.getByText("Açık KRİTİK bulgu")).toBeVisible();
    const fId = await tekBulguBekle(db, aId);
    const telafiBlok = page.getByTestId(`telafi-blok-${fId}`);
    const bugun = new Date().toISOString().slice(0, 10);

    // 1) Öner → incelemeye gönder.
    await telafiBlok.getByLabel(`${fId} telafi kontrol seç`).selectOption({ value: fx.controlId });
    await telafiBlok.getByLabel(`${fId} telafi test koşusu seç`).selectOption({ value: fx.testRunId });
    await telafiBlok.getByLabel(`${fId} telafi gerekçesi`).fill("E2E: red senaryosu");
    await telafiBlok.getByLabel(`${fId} telafi geçerlilik başlangıcı`).fill(bugun);
    await telafiBlok.getByLabel(`${fId} telafi geçerlilik bitişi`).fill("2030-01-01");
    await telafiBlok.getByRole("button", { name: "Öner ve İncelemeye Gönder" }).click();
    await expect(telafiBlok.getByText("İncelemede")).toBeVisible({ timeout: 10_000 });

    // 2) Farklı yetkili REDDEDER (gerçek zamanla oynamadan bir "olumsuz karar" downgrade'i).
    // `waitForURL` şart — bkz. dikey-e1-cloud-assurance.spec.ts'teki
    // 2026-07-23 root-cause notu: signOut() asenkron, hemen ikinci girişe
    // geçmek eski oturum cookie'siyle yarışıp /tanitim'de tıkanabiliyordu.
    await page.getByRole("button", { name: "Çıkış", exact: true }).click();
    await page.waitForURL("**/giris");
    await ikinciKullaniciGirisYap(page);
    await page.goto(`/tedarikciler/${fx.vendorId}`);
    const telafiBlokMehmet = page.getByTestId(`telafi-blok-${fId}`);
    await telafiBlokMehmet.getByLabel(/red gerekçesi/).fill("E2E: kanıt yetersiz");
    await telafiBlokMehmet.getByRole("button", { name: "Reddet" }).click();
    await expect(telafiBlokMehmet.getByText("Reddedildi")).toBeVisible({ timeout: 10_000 });

    await page.getByRole("button", { name: "Yeniden Önizle" }).click();
    await expect(page.getByText("Kritik bulgu nedeniyle engellendi")).toBeVisible({ timeout: 10_000 });

    // 3) Reddedilen kayıt donuk — yeni bir teklif formu tekrar görünür. Yeni
    // teklif aç, onayla, sonra AKTİF kaydı İPTAL ET — güvence yeniden düşer.
    await telafiBlokMehmet.getByLabel(`${fId} telafi kontrol seç`).selectOption({ value: fx.controlId });
    await telafiBlokMehmet.getByLabel(`${fId} telafi test koşusu seç`).selectOption({ value: fx.testRunId });
    await telafiBlokMehmet.getByLabel(`${fId} telafi gerekçesi`).fill("E2E: iptal senaryosu");
    await telafiBlokMehmet.getByLabel(`${fId} telafi geçerlilik başlangıcı`).fill(bugun);
    await telafiBlokMehmet.getByLabel(`${fId} telafi geçerlilik bitişi`).fill("2030-01-01");
    await telafiBlokMehmet.getByRole("button", { name: "Öner ve İncelemeye Gönder" }).click();
    await expect(telafiBlokMehmet.getByText("İncelemede")).toBeVisible({ timeout: 10_000 });

    await page.getByRole("button", { name: "Çıkış", exact: true }).click();
    await page.waitForURL("**/giris");
    await girisYap(page);
    await page.goto(`/tedarikciler/${fx.vendorId}`);
    const telafiBlokAyse = page.getByTestId(`telafi-blok-${fId}`);
    await telafiBlokAyse.getByRole("button", { name: "Onayla (Aktive Et)" }).click();
    await expect(telafiBlokAyse.getByText("Telafi ile yönetiliyor (bulgu AÇIK)")).toBeVisible({ timeout: 10_000 });

    await page.getByRole("button", { name: "Yeniden Önizle" }).click();
    await expect(page.getByText("Kritik bulgu açık — telafi edici kontrol altında")).toBeVisible({ timeout: 10_000 });

    // AKTIF kaydı sahibi (Mehmet — reddedilen ilk kayıttan sonra yeniden
    // önerdiği ikinci kayıt) iptal edebilir; burada Ayşe onayladığı için
    // Ayşe iptal edebilir (submitted_by = Mehmet, revoked_by istediği kişi
    // olabilir — guard yalnız oturum sahibine sabitler, kendine özgü bir
    // kısıt taşımaz).
    await telafiBlokAyse.getByLabel(/iptal nedeni/).fill("E2E: geri çekildi");
    await telafiBlokAyse.getByRole("button", { name: "İptal Et" }).click();
    await expect(telafiBlokAyse.getByText("İptal edildi")).toBeVisible({ timeout: 10_000 });

    await page.getByRole("button", { name: "Yeniden Önizle" }).click();
    await expect(page.getByText("Kritik bulgu nedeniyle engellendi")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Kritik bulgu açık — telafi edici kontrol altında")).toHaveCount(0);
  } finally {
    await temizle(db, tenantId, VENDOR, fx.vendorId, fx.testDefId);
  }
});
