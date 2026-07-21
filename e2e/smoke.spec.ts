import { test, expect } from "@playwright/test";

test("home page boots and renders the app shell", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("body")).toBeVisible();
});

test("tanıtım sayfası doğrudan adresinde erişilebilir (oturumsuz)", async ({ page }) => {
  // "/" için tanıtıma REWRITE canlıda (Hostinger) yeniden başlama döngüsüne
  // yol açtı ve geri alındı (bkz. proxy.ts notu, 21 Temmuz 2026 gece) — kök
  // artık eskisi gibi /giris'e yönleniyor, /tanitim doğrudan adresinde durur.
  await page.goto("/tanitim");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("sürekli uyum");
  await expect(page.getByRole("link", { name: "Demo Talep Et" }).first()).toBeVisible();
});

test("oturumsuz kök adres /giris'e yönlenir", async ({ page }) => {
  await page.goto("/");
  await page.waitForURL("**/giris");
  expect(new URL(page.url()).pathname).toBe("/giris");
});

test("health endpoint'leri OTURUMSUZ 200 döner (izleme oturum açamaz)", async ({ request }) => {
  // Canlı deploy doğrulaması bunu bir kez yakaladı: /health proxy'nin açık
  // yollarında değildi ve 307 → /giris dönüyordu. Regresyon kilidi.
  const live = await request.get("/health/live");
  expect(live.status()).toBe(200);
  const ready = await request.get("/health/ready");
  expect([200, 503]).toContain(ready.status()); // 503 = DB erişilemiyor (dürüst sinyal)
  expect((await ready.json()).durum).toBeDefined();
});
