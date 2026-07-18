import { test, expect } from "@playwright/test";

test("home page boots and renders the app shell", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("body")).toBeVisible();
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
