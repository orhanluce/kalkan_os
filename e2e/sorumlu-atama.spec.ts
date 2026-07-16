import { test, expect } from "@playwright/test";

// Bu akış daha önce yalnızca elle doğrulanmaya çalışılmıştı; base-ui'nin
// portal'lı Select'i tarayıcı otomasyon araçlarıyla zor sürüldüğü için
// kalıcı bir test olarak buraya alındı — artık her `pnpm e2e` koşusunda
// gerçek bir tıklamayla doğrulanıyor.
test("sorumlu atama: seçim yapılır, kalıcı olur ve listeye yansır", async ({ page }) => {
  await page.goto("/giris");
  await page.getByLabel("E-posta").fill("ayse@demo.com");
  await page.getByRole("button", { name: "Giriş Yap" }).click();

  await expect(page.getByRole("heading", { name: "Demo Aracı Kurum A.Ş." })).toBeVisible();

  await page.goto("/controls/c-06");

  // Başlangıçta atanmamış olmalı.
  const sorumluTrigger = page.getByLabel("Sorumlu");
  await expect(sorumluTrigger).toContainText("Atanmadı");

  // Gerçek tıklama: trigger'ı aç, portal'daki seçeneği seç.
  await sorumluTrigger.click();
  await page.getByRole("option", { name: "Ayşe Yılmaz" }).click();

  await expect(sorumluTrigger).toContainText("Ayşe Yılmaz");

  // Sayfa yenilendikten sonra da kalıcı olmalı (localStorage'a yazıldı).
  await page.reload();
  await expect(page.getByLabel("Sorumlu")).toContainText("Ayşe Yılmaz");

  // Kontrol kütüphanesi listesindeki Sorumlu kolonuna da yansımalı.
  await page.goto("/controls");
  const row = page.getByRole("row", { name: /TODO-DOGRULA-06/ });
  await expect(row).toContainText("Ayşe Yılmaz");
});

test("sorumlu ataması geri alınabilir (Atanmadı'ya dönüş)", async ({ page }) => {
  await page.goto("/giris");
  await page.getByLabel("E-posta").fill("ayse@demo.com");
  await page.getByRole("button", { name: "Giriş Yap" }).click();
  await expect(page.getByRole("heading", { name: "Demo Aracı Kurum A.Ş." })).toBeVisible();

  await page.goto("/controls/c-07");
  const sorumluTrigger = page.getByLabel("Sorumlu");

  await sorumluTrigger.click();
  await page.getByRole("option", { name: "Mehmet Kaya" }).click();
  await expect(sorumluTrigger).toContainText("Mehmet Kaya");

  await sorumluTrigger.click();
  await page.getByRole("option", { name: "Atanmadı" }).click();
  await expect(sorumluTrigger).toContainText("Atanmadı");
});
