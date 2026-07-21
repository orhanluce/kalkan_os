import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { girisYap } from "./helpers";

// Dikey F, F2: kritik hizmet → bağlı test tanımı (gerçek kritik hizmet
// seçiciyle) → geçmiş FAILED koşu → güncel PASSED koşu (retest) → açık
// bulgu/kapanış zinciri → paket önizleme → mühürlü paket → tarihsel özet →
// Proof Room oturumsuz görünüm. Gerçek Chromium + gerçek Supabase; kendi test
// tanımını kurar, mevcut fixture'a dokunmaz.
function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env eksik (.env.local).");
  return createClient(url, key, { auth: { persistSession: false } });
}

test("F2: kritik hizmet test paketi — önizleme → mühürleme → tarihsel özet → anonim Proof Room görünümü", async ({ page }) => {
  test.setTimeout(90_000);
  await girisYap(page);

  const db = admin();
  const { data: kurum } = await db.from("tenants").select("id").eq("name", "E2E Test Kurumu A.Ş.").single();
  const { data: hizmet } = await db.from("critical_business_services").select("id").eq("tenant_id", kurum!.id).eq("ad", "E2E Kritik Hizmet").single();
  const hizmetId = hizmet!.id as string;

  await page.goto("/controls");
  await page.getByRole("link", { name: "TODO-DOGRULA-01" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  // 1) Yeni test tanımı — E2E Kritik Hizmet'e GERÇEK referansla bağlı.
  await page.getByRole("button", { name: "+ Yeni test tanımı" }).click();
  const testAdi = `F2-e2e: erişim incelemesi ${Date.now()}`;
  await page.getByLabel("Test adı").fill(testAdi);
  await page.getByRole("combobox", { name: "Kritik hizmete bağlı (opsiyonel)" }).click();
  await page.getByRole("option", { name: "E2E Kritik Hizmet" }).click();
  await page.getByRole("button", { name: "Ekle", exact: true }).click();
  const testSatiri = page.locator("li").filter({ hasText: testAdi });
  await expect(testSatiri).toBeVisible({ timeout: 10_000 });

  // 2) Geçmiş FAILED koşu → öneri → kabul.
  await testSatiri.getByRole("combobox", { name: "Gözlem" }).click();
  await page.getByRole("option", { name: "İddia karşılanmadı" }).click();
  await testSatiri.getByRole("button", { name: "Çalıştır" }).click();
  await expect(testSatiri.getByText("Kaldı", { exact: true })).toBeVisible({ timeout: 10_000 });
  const oneriKarti = testSatiri.locator("div").filter({ hasText: "Bulgu önerisi:" }).first();
  await expect(oneriKarti).toBeVisible();
  await oneriKarti.getByRole("button", { name: "Kabul Et (bulgu oluştur)" }).click();
  await expect(testSatiri.getByText("Bulgu önerisi:")).not.toBeVisible({ timeout: 10_000 });

  // 3) Güncel PASSED koşu.
  await testSatiri.getByRole("combobox", { name: "Gözlem" }).click();
  await page.getByRole("option", { name: "İddia karşılandı" }).click();
  await testSatiri.getByRole("button", { name: "Çalıştır" }).click();
  await expect(testSatiri.getByText("Geçti", { exact: true }).first()).toBeVisible({ timeout: 10_000 });

  const { data: tanim } = await db.from("control_test_definitions").select("id").eq("tenant_id", kurum!.id).eq("ad", testAdi).single();
  const tanimId = tanim!.id as string;

  // 4) Kritik hizmet sayfasına git — Test Paketi Önizle. "E2E Kritik Hizmet"
  //    kiracı fixture'ının paylaşılan hizmeti — geçmiş e2e koşularından BAŞKA
  //    test tanımları BİRİKMİŞ olabilir (kirli DB'ye dayanıklı desen), bu
  //    yüzden tüm iddialar YALNIZ bu koşunun kendi satırına (data-testid) scope'lanır.
  await page.goto(`/kritik-hizmetler/${hizmetId}`);
  await expect(page.getByRole("heading", { name: "E2E Kritik Hizmet" })).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "Test Paketi Önizle" }).click();
  const paketSatiri = page.locator(`[data-testid="test-paketi-satir-${tanimId}"]`);
  await expect(paketSatiri).toBeVisible({ timeout: 10_000 });
  await expect(paketSatiri.getByText(testAdi)).toBeVisible();
  await expect(paketSatiri.getByText("Doğrudan bağlı")).toBeVisible();
  await expect(paketSatiri.getByText(/Tarihsel sonuç özeti/)).toBeVisible();
  await expect(paketSatiri.getByText("Açık bulgu mevcut", { exact: false })).toBeVisible();

  // 5) Mühürlü Paket Oluştur → geçmiş listesinde görünür. "Mühürlenmiş paket
  //    geçmişi" metni BİRİKMİŞ önceki koşulardan zaten görünür olabilir — bu
  //    yüzden gerçek POST yanıtını (ve paket hash'ini) bekliyoruz (Faz B
  //    dersi), metin görünürlüğüne körü körüne güvenmiyoruz.
  const [muhurlemeYaniti] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/test-paketi") && r.request().method() === "POST" && r.ok()),
    page.getByRole("button", { name: "Mühürlü Paket Oluştur" }).click(),
  ]);
  const muhurlemeGovde = (await muhurlemeYaniti.json()) as { id: string };

  // 6) Bu koşunun mühürlediği snapshot satırı — kendi kimliğiyle (data-testid)
  //    BİRİKMİŞ eski satırlardan ayırt edilir; "Proof Room Linki Oluştur" bu
  //    satırdan tıklanır (yalnız .first() değil).
  const snapshotSatiri = page.locator(`[data-testid="test-paketi-snapshot-${muhurlemeGovde.id}"]`);
  await expect(snapshotSatiri).toBeVisible({ timeout: 10_000 });
  await snapshotSatiri.getByRole("button", { name: "Proof Room Linki Oluştur" }).click();
  const proofLink = page.getByText(/Proof Room linki: /);
  await expect(proofLink).toBeVisible({ timeout: 10_000 });
  const proofHref = (await proofLink.textContent())!.replace("Proof Room linki: ", "").trim();

  // 7) Anonim (oturumsuz) görünüm — ayrı browser context.
  const anonContext = await page.context().browser()!.newContext();
  const anonPage = await anonContext.newPage();
  await anonPage.goto(proofHref);
  await expect(anonPage.getByRole("heading", { name: /Proof Room/ })).toBeVisible({ timeout: 10_000 });
  await expect(anonPage.getByText(testAdi)).toBeVisible();
  await expect(anonPage.getByText(/Tarihsel sonuç özeti/).first()).toBeVisible();
  const anonMetin = await anonPage.locator("main").innerText();
  expect(anonMetin).not.toContain("Ayşe Yılmaz");
  expect(anonMetin).not.toContain("Mehmet Kaya");
  await anonContext.close();
});
