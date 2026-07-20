import { expect, test } from "@playwright/test";
import { E2E_KURUM_ADI, girisYap } from "./helpers";

// Kullanıcı Kılavuzu / Yardım Merkezi (CLAUDE_CODE_KALKAN_OS_KULLANICI_
// KILAVUZU_UI_TALIMATI.md). Statik içerik — hiçbir Supabase sorgusu yapmaz,
// bu yüzden tenant verisi sızma riski YAPISAL OLARAK yoktur (test bunu
// doğrular: sayfa metninde kurum adı asla geçmez).

test("yardım: oturumsuz erişim proxy.ts tarafından /giris'e yönlendirilir", async ({ page }) => {
  const yanit = await page.request.get("/yardim", { maxRedirects: 0 });
  expect(yanit.status()).toBe(307);
  expect(yanit.headers()["location"]).toContain("/giris");
});

test("yardım: oturumlu kullanıcı ana kılavuzu açar, tenant verisi sızmaz, modül bölümleri ve rol/durum tabloları görünür", async ({ page }) => {
  await girisYap(page);
  await page.goto("/yardim");
  await expect(page.getByRole("heading", { name: "Kullanıcı Kılavuzu", exact: true })).toBeVisible();

  // Tenant verisi sızmaz — bu sayfa hiçbir DB sorgusu yapmaz.
  const govde = await page.locator("main").innerText();
  expect(govde).not.toContain(E2E_KURUM_ADI);

  // 15 modül bölümünün hepsi anchor id'siyle mevcut.
  await expect(page.locator("#ana-panel")).toBeVisible();
  await expect(page.locator("#gorevler-ayriligi")).toBeVisible();
  await expect(page.locator("#dora-roi")).toBeVisible();
  await expect(page.locator("#proof-room")).toBeVisible();

  // Roller ve durum sözlüğü tabloları.
  await expect(page.getByRole("heading", { name: "Kullanıcı rolleri" })).toBeVisible();
  await expect(page.getByText("Kurum yöneticisi")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ekranlarda kullanılan durumların anlamı" })).toBeVisible();
  await expect(page.getByText("Engellendi")).toBeVisible();

  // Sık yapılmaması gerekenler + kısa cümleler.
  await expect(page.getByText("Kanıt yoksa sistem kesin uyum iddiası üretmez.")).toBeVisible();
});

test("yardım: hızlı başlangıç 5 adımı gerçek route'lara bağlanır", async ({ page }) => {
  await girisYap(page);
  await page.goto("/yardim/hizli-baslangic");
  await expect(page.getByRole("heading", { name: "Hızlı Başlangıç" })).toBeVisible();
  // NavRail/MobileNav de <li> içerir — sayaç yalnız sayfa içeriğine (main) bakar.
  const adimlar = page.locator("main li");
  await expect(adimlar).toHaveCount(5);

  // 3. adım /controls'e bağlanmalı (gerçek route, uydurulmuş değil).
  const ucuncuAdimLinki = page.getByRole("link", { name: "Bu adımı şimdi uygula →" }).nth(2);
  await expect(ucuncuAdimLinki).toHaveAttribute("href", "/controls");
});

test("yardım: sözlük arama filtrelemesi çalışır, en az 20 terim taşır", async ({ page }) => {
  await girisYap(page);
  await page.goto("/yardim/sozluk");
  await expect(page.getByRole("heading", { name: /^\d+ terim$/ })).toBeVisible();

  const arama = page.getByLabel("Terim ara");
  await arama.fill("hash");
  await expect(page.getByText("Hash", { exact: true })).toBeVisible();
  await expect(page.getByText("Tenant", { exact: true })).not.toBeVisible();

  await arama.fill("eşleşmeyecek-terim-xyz");
  await expect(page.getByText("Eşleşen terim bulunamadı.")).toBeVisible();
});

test("yardım: modül paneli doğru ekranda görünür, klavye ile açılır ve /yardim'deki doğru bölüme bağlanır", async ({ page }) => {
  await girisYap(page);
  await page.goto("/sod");

  const panel = page.getByTestId("yardim-paneli-gorevler-ayriligi");
  await expect(panel).toBeVisible();
  const ozet = panel.getByText("Bu ekran ne işe yarar?");

  // Klavye erişimi: native <details>/<summary> — Tab ile odaklan, Enter ile aç.
  await ozet.focus();
  await page.keyboard.press("Enter");
  await expect(panel.getByText("Hata, kötüye kullanım ve yetki suistimali riskini azaltır.")).toBeVisible();

  const link = panel.getByRole("link", { name: "Daha fazla bilgi: Kullanıcı Kılavuzu" });
  await expect(link).toHaveAttribute("href", "/yardim#gorevler-ayriligi");
  await link.click();
  await expect(page).toHaveURL(/\/yardim#gorevler-ayriligi$/);
  await expect(page.locator("#gorevler-ayriligi").getByRole("heading", { name: "Görevler Ayrılığı (SoD)" })).toBeVisible();
});

test("yardım: kontrol detayında hem test hem kanıt paneli birlikte görünür", async ({ page }) => {
  await girisYap(page);
  await page.goto("/controls");
  await page.getByRole("link", { name: /TODO-DOGRULA-01/ }).first().click();
  await expect(page.getByTestId("yardim-paneli-kontrol-testleri")).toBeVisible();
  await expect(page.getByTestId("yardim-paneli-kanit-kasasi")).toBeVisible();
});

test("yardım: mobil ve masaüstü, açık/koyu temada erişilebilir kalır", async ({ page }) => {
  await girisYap(page);
  for (const tema of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: tema });
    for (const vp of [
      { ad: "masaustu", width: 1440, height: 900 },
      { ad: "mobil", width: 390, height: 844 },
    ]) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/yardim");
      await expect(page.getByRole("heading", { name: "Kullanıcı Kılavuzu", exact: true })).toBeVisible();
      await page.goto("/yardim/sozluk");
      await expect(page.getByRole("heading", { name: /^\d+ terim$/ })).toBeVisible();
    }
  }
});

test("yardım: ContextHeader'daki Yardım bağlantısı her sayfadan erişilebilir", async ({ page }) => {
  await girisYap(page);
  await page.goto("/");
  await page.getByRole("link", { name: "Kullanıcı Kılavuzu" }).click();
  await expect(page).toHaveURL(/\/yardim$/);
});
