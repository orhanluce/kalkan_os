import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { E2E_KULLANICI_ADI, E2E_KURUM_ADI, girisYap, ikinciKullaniciGirisYap } from "./helpers";

// M35 sonraki dilim: tedarikçi değerlendirme + bulgu. Açık KRİTİK bulgu varken
// TAMAMLA engellenir (kural: çözülmemiş kritik riskle sign-off yok); bulgu
// kanıtla kapanınca (kural 14) değerlendirme tamamlanır. Gerçek Chromium.
//
// Dikey E kurucu kararı #1 (bağımsız kapanış): bulgunun sahibi kendi
// bulgusunu KAPATAMAZ. Bu akış artık İKİ farklı gerçek kullanıcı gerektirir —
// sahip Ayşe (girisYap) bulguyu KAPATAMADIĞINI, farklı yetkili Mehmet
// (ikinciKullaniciGirisYap) kanıtla kapattığını doğrular.

const VENDOR = "E2E Değerlendirme Vendor A.Ş.";

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env eksik (.env.local).");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function temizle(db: ReturnType<typeof admin>, tenantId: string) {
  await db.from("assessment_findings").delete().eq("tenant_id", tenantId);
  await db.from("third_party_assessments").delete().eq("tenant_id", tenantId);
  await db.from("third_parties").delete().eq("tenant_id", tenantId).eq("ad", VENDOR);
}

test("tedarikçi: değerlendirme + KRİTİK bulgu tamamlamayı engeller, kapanınca tamamlanır", async ({ page }) => {
  test.setTimeout(120_000);
  const db = admin();
  const { data: kurum } = await db.from("tenants").select("id").eq("name", E2E_KURUM_ADI).single();
  await temizle(db, kurum!.id);
  const { data: vendor } = await db
    .from("third_parties")
    .insert({ tenant_id: kurum!.id, ad: VENDOR, tier: "KRITIK" })
    .select("id")
    .single();
  const vendorId = vendor!.id as string;

  try {
    await girisYap(page);
    await page.goto(`/tedarikciler/${vendorId}`);

    // Değerlendirme aç.
    await page.getByRole("button", { name: "Yeni Değerlendirme (DORA)" }).click();
    await expect(page.getByText("TASLAK")).toBeVisible();

    // Assessment id'yi al (dinamik aria-label için).
    const { data: asmt } = await db
      .from("third_party_assessments")
      .select("id")
      .eq("third_party_id", vendorId)
      .single();
    const aId = asmt!.id as string;

    // KRİTİK bulgu ekle, sahibi = birincil kullanıcı (Ayşe) — bağımsız kapanış
    // testinin ön koşulu.
    await page.getByLabel(`${aId} bulgu başlık`).fill("Şifreleme eksikliği");
    await page.getByLabel(`${aId} ciddiyet`).selectOption("KRITIK");
    await page.getByLabel(`${aId} bulgu sahibi`).selectOption({ label: E2E_KULLANICI_ADI });
    await page.getByRole("button", { name: "Bulgu Ekle" }).click();
    await expect(page.getByText("Açık KRİTİK bulgu")).toBeVisible();

    // Açık KRİTİK varken Tamamla DISABLED.
    await expect(page.getByRole("button", { name: "Değerlendirmeyi Tamamla" })).toBeDisabled();

    const { data: finding } = await db
      .from("assessment_findings")
      .select("id")
      .eq("assessment_id", aId)
      .single();
    const fId = finding!.id as string;

    // Sahibi (Ayşe) KENDİ bulgusunu kapatamaz — Kapat düğmesi hiç görünmez,
    // yerine bağımsız kapanış açıklaması gösterilir (bağımsız kapanış, Dikey E).
    await expect(page.getByText("bağımsız kapanış gereği")).toBeVisible();
    await expect(page.getByLabel(`${fId} kapanış kanıtı`)).toHaveCount(0);

    // Farklı yetkili (Mehmet) kanıtla kapatır (kural 14). Önce çıkış yapılmalı
    // — oturumu açık kullanıcı /giris'e giderse proxy onu doğrudan "/"e geri
    // yollar (src/proxy.ts), form hiç görünmez (sod-import.spec.ts'in AYNI dersi).
    // `waitForURL` şart (2026-07-23 root-cause: bkz. dikey-e1-cloud-assurance.
    // spec.ts) — signOut() asenkron, beklemeden ikinci girişe geçmek eski
    // oturum cookie'siyle yarışıp /tanitim'de tıkanabiliyordu.
    await page.getByRole("button", { name: "Çıkış", exact: true }).click();
    await page.waitForURL("**/giris");
    await ikinciKullaniciGirisYap(page);
    await page.goto(`/tedarikciler/${vendorId}`);
    await page.getByLabel(`${fId} kapanış kanıtı`).fill("HSM devreye alındı, kanıt #123");
    await page.getByRole("button", { name: "Kapat" }).click();
    await expect(page.getByText("KAPANDI")).toBeVisible();

    // Artık tamamlanabilir. `degerlendirmeTamamla` PATCH sonrası ayrıca
    // /api/seffaflik/outbox/isle'yi (mühür/imza) TETİKLER — bu ekstra ağ
    // turu, uzun tam-suite koşularında (86 test derinlik, tek worker) 5sn'lik
    // varsayılan expect penceresini bazen aşabiliyordu (2026-07-23'te
    // yakalandı). Keyfi bir süre uzatmak yerine GERÇEK PATCH yanıtını
    // bekliyoruz — UI o yanıt üzerine yeniden okuyup "TAMAMLANDI" basıyor.
    await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes("/rest/v1/third_party_assessments") && r.request().method() === "PATCH" && r.ok(),
      ),
      page.getByRole("button", { name: "Değerlendirmeyi Tamamla" }).click(),
    ]);
    await expect(page.getByText("TAMAMLANDI")).toBeVisible({ timeout: 15_000 });

    // DB: TAMAMLANDI + degerlendiren + tamamlandi_at.
    const { data: son } = await db
      .from("third_party_assessments")
      .select("durum, degerlendiren, tamamlandi_at")
      .eq("id", aId)
      .single();
    expect(son!.durum).toBe("TAMAMLANDI");
    expect(son!.degerlendiren).not.toBeNull();
    expect(son!.tamamlandi_at).not.toBeNull();
  } finally {
    await temizle(db, kurum!.id);
  }
});
