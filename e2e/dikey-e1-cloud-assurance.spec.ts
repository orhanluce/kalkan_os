import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { E2E_KULLANICI_ADI, E2E_KURUM_ADI, girisYap, ikinciKullaniciGirisYap } from "./helpers";

// Dikey E, E1: bulut/kritik tedarikçi güvence profili — uçtan uca gerçek
// Chromium akışı. Kapsam: kritik tedarikçi + alt yüklenici, Cloud Pack sorusu
// (kategori + kaynak_turu), açık KRİTİK bulgu → sign-off engeli, bağımsız
// kapanış (sahibi kendi bulgusunu kapatamaz → farklı yetkili kanıtla kapatır),
// güvence profili mühürleme (sealed snapshot), Proof Room bağlantısı +
// oturumsuz görünüm. Telafi edici kontrol E2'ye ertelendi — BU akışta YOK.

const VENDOR = "E2E Dikey E1 Vendor A.Ş.";
const SORU = "E2E: Şifreleme anahtarları HSM'de mi tutuluyor?";

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env eksik (.env.local).");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function temizle(db: ReturnType<typeof admin>, tenantId: string) {
  await db.from("assessment_question_templates").delete().eq("tenant_id", tenantId).eq("soru", SORU);
  await db.from("third_parties").delete().eq("tenant_id", tenantId).eq("ad", VENDOR);
}

test("Dikey E1: kritik tedarikçi güvence profili — bağımsız kapanış + mühürleme + Proof Room", async ({ page }) => {
  test.setTimeout(180_000);
  const db = admin();
  const { data: kurum } = await db.from("tenants").select("id").eq("name", E2E_KURUM_ADI).single();
  const tenantId = kurum!.id as string;
  await temizle(db, tenantId);

  const { data: vendor } = await db
    .from("third_parties")
    .insert({ tenant_id: tenantId, ad: VENDOR, tier: "KRITIK" })
    .select("id")
    .single();
  const vendorId = vendor!.id as string;
  await db.from("fourth_parties").insert({ tenant_id: tenantId, third_party_id: vendorId, ad: "E2E Alt Yüklenici", bilinmiyor: false });

  // Cloud Pack şablonu: kategori + kaynak_turu (kaynak_turu default UNKNOWN,
  // kurucu kararı — SEED ETMEDEN önce burada AÇIKÇA bir değer seçiyoruz).
  await db.from("assessment_question_templates").insert({
    tenant_id: tenantId,
    tur: "DORA",
    soru: SORU,
    kategori: "IAM_LOG",
    kaynak_turu: "CONTRACTUAL_REQUIREMENT",
    aktif: true,
  });

  let snapshotId: string | undefined;
  try {
    await girisYap(page);
    await page.goto(`/tedarikciler/${vendorId}`);

    // Değerlendirme aç + Cloud Pack şablonundan kopyala.
    await page.getByRole("button", { name: "Yeni Değerlendirme (DORA)" }).click();
    await expect(page.getByText("TASLAK")).toBeVisible();
    const { data: asmt } = await db.from("third_party_assessments").select("id").eq("third_party_id", vendorId).single();
    const aId = asmt!.id as string;

    await page.getByRole("button", { name: "Şablondan Soru Kopyala" }).click();
    const bulutKarti = page.getByTestId("cloud-pack-karti");
    await expect(bulutKarti.getByText(SORU)).toBeVisible({ timeout: 10_000 });

    // Cloud Pack: kategori görünür, kaynak_turu şablondan kopyalandı (kural: kaynak_turu),
    // cevap doldur, uygulanabilirlik APPLICABLE yap.
    await expect(bulutKarti.getByText("IAM / merkezi log")).toBeVisible();
    const { data: soru } = await db.from("assessment_questions").select("id, template_id, kaynak_turu").eq("assessment_id", aId).eq("soru", SORU).single();
    expect(soru!.template_id).not.toBeNull();
    expect(soru!.kaynak_turu).toBe("CONTRACTUAL_REQUIREMENT"); // kaynak_turu şablondan kopyalandı (ADR §1).
    const soruId = soru!.id as string;
    const cevapInput = page.getByLabel(`${soruId} cevap`);
    await cevapInput.fill("Evet, AWS KMS HSM destekli.");
    await cevapInput.locator("..").getByRole("button", { name: "Kaydet" }).click();
    await page.getByLabel(`${soruId} uygulanabilirlik`).selectOption("APPLICABLE");
    await expect(page.getByText("Sağlayıcı beyanı — bağımsız doğrulama değil.")).toHaveCount(0);

    // Güvence profili önizleme: şablon henüz TODO_DOGRULA (VERIFIED değil) →
    // INCELEME_GEREKLI beklenir (asla sahte "Doğrulanmış profil").
    await page.getByRole("button", { name: "Yeniden Önizle" }).click();
    await expect(page.getByText("İnceleme gerekli")).toBeVisible({ timeout: 10_000 });

    // KRİTİK bulgu ekle — sahibi Ayşe (bağımsız kapanış testinin ön koşulu).
    await page.getByLabel(`${aId} bulgu başlık`).fill("E2E: Şifreleme eksikliği");
    await page.getByLabel(`${aId} ciddiyet`).selectOption("KRITIK");
    await page.getByLabel(`${aId} bulgu sahibi`).selectOption({ label: E2E_KULLANICI_ADI });
    await page.getByRole("button", { name: "Bulgu Ekle" }).click();
    await expect(page.getByText("Açık KRİTİK bulgu")).toBeVisible();
    await expect(page.getByRole("button", { name: "Değerlendirmeyi Tamamla" })).toBeDisabled();

    const { data: finding } = await db.from("assessment_findings").select("id").eq("assessment_id", aId).single();
    const fId = finding!.id as string;

    // Sahibi (Ayşe) KENDİ bulgusunu kapatamaz.
    await expect(page.getByText("bağımsız kapanış gereği")).toBeVisible();
    await expect(page.getByLabel(`${fId} kapanış kanıtı`)).toHaveCount(0);

    // Güvence profili hâlâ ENGELLENDI olmalı (açık KRİTİK bulgu, mutlak blok).
    await page.getByRole("button", { name: "Yeniden Önizle" }).click();
    await expect(page.getByText("Kritik bulgu nedeniyle engellendi")).toBeVisible({ timeout: 10_000 });

    // Farklı yetkili (Mehmet) kanıtla kapatır. Önce çıkış yapılmalı — oturumu
    // açık kullanıcı /giris'e giderse proxy onu doğrudan "/"e geri yollar
    // (src/proxy.ts), form hiç görünmez. `waitForURL` ŞART: signOut() asenkron
    // ve tıklama sonrası hemen /giris'e gidilirse eski oturum cookie'si HÂLÂ
    // geçerli görünebilir — proxy o anda /giris'i /'e, / de (henüz tam
    // temizlenmemiş oturumla) tekrar bir yere yönlendirebilir. AppLayout'un
    // kendi `router.replace("/giris")`'i (src/app/(app)/layout.tsx) tetiklenip
    // GERÇEKTEN /giris'e ULAŞILDIĞINI beklemeden ikinci girişe geçmek, bu
    // yarışın tam suite koşusunda ara sıra /tanitim'de (kök→landing
    // yönlendirmesi) TIKANMASINA yol açıyordu (root-cause bulundu 2026-07-23).
    await page.getByRole("button", { name: "Çıkış", exact: true }).click();
    await page.waitForURL("**/giris");
    await ikinciKullaniciGirisYap(page);
    await page.goto(`/tedarikciler/${vendorId}`);
    await page.getByLabel(`${fId} kapanış kanıtı`).fill("HSM doğrulandı, kanıt #E2E");
    await page.getByRole("button", { name: "Kapat" }).click();
    await expect(page.getByText("KAPANDI")).toBeVisible();

    // Bulgu kapandı → güvence profili artık ENGELLENDI değil (hâlâ İnceleme
    // gerekli, çünkü şablon TODO_DOGRULA — asla sahte Doğrulanmış).
    await page.getByRole("button", { name: "Yeniden Önizle" }).click();
    await expect(page.getByText("İnceleme gerekli")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Kritik bulgu nedeniyle engellendi")).toHaveCount(0);

    // Profili mühürle (sealed snapshot) + Proof Room bağlantısı.
    await page.getByRole("button", { name: "Profili Mühürle (sealed snapshot)" }).click();
    await expect(page.getByText(/Son mühürlü profil:/)).toBeVisible({ timeout: 15_000 });

    const { data: snap } = await db
      .from("cloud_assurance_profile_snapshots")
      .select("id, profil_hash")
      .eq("third_party_id", vendorId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    snapshotId = snap!.id as string;
    expect(snap!.profil_hash).toMatch(/^[0-9a-f]{64}$/);

    await page.getByRole("button", { name: "Proof Room Bağlantısı Oluştur" }).click();
    const linkEl = page.locator('a[href^="/proof/"]');
    await expect(linkEl).toBeVisible({ timeout: 10_000 });
    const proofUrl = await linkEl.getAttribute("href");
    expect(proofUrl).toBeTruthy();

    // Oturumsuz görünüm (yeni bağlamda — oturum sıfır).
    await page.context().clearCookies();
    await page.goto(proofUrl!);
    await expect(page.getByText("Profil özeti")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Profil hash'i \(SHA-256\)/)).toBeVisible();
    await expect(page.getByText("Kritik bulgu nedeniyle engellendi")).toHaveCount(0);
    await expect(page.getByText(/kesin uyum kararı değildir/)).toBeVisible();
    await expect(page.getByText("IAM / merkezi log: INCELEME_GEREKLI")).toBeVisible();
  } finally {
    if (snapshotId) {
      await db.from("proof_room_links").delete().eq("cloud_assurance_profile_id", snapshotId);
      await db.from("cloud_assurance_profile_snapshots").delete().eq("id", snapshotId);
    }
    await temizle(db, tenantId);
  }
});
