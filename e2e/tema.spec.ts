import { expect, test, type Page } from "@playwright/test";
import { girisYap } from "./helpers";

// Tema e2e (master talimat §6 senaryosu, ADR-T2): system→dark geçişi,
// yenilemede kalıcılık, route değişimi, çıkış/giriş sonrası profil tercihi.
// Gerçek Chromium + gerçek Supabase.

function koyuMu(page: Page) {
  return page.evaluate(() => document.documentElement.classList.contains("dark"));
}

/** Tema butonu döngüseldir (light→dark→system); hedefe gelene dek basar. */
async function temayaGetir(page: Page, hedefEtiket: string) {
  for (let i = 0; i < 3; i++) {
    const buton = page.getByRole("button", { name: /tema/i });
    if ((await buton.getAttribute("aria-label")) === hedefEtiket) return;
    await buton.click();
  }
  await expect(page.getByRole("button", { name: hedefEtiket })).toBeVisible();
}

/**
 * Hedef temaya getirir VE profil PATCH'inin tamamlanmasını bekler.
 * Switcher profil yazımını fire-and-forget yapar (UI bloklanmaz — bilinçli);
 * ama test hemen reload/çıkış yaparsa PATCH iptal olur ve profildeki ESKİ
 * tercih girişte cookie'yi ezer. Gerçek kullanıcı için sorun değil (sonraki
 * tıklama düzeltir), test için yarıştır — burada beklenir.
 */
async function temayaGetirVeYazilsin(page: Page, hedefEtiket: string, hedefDeger: string) {
  const patchYaniti = page.waitForResponse(
    (r) =>
      r.url().includes("/rest/v1/profiles") &&
      r.request().method() === "PATCH" &&
      (r.request().postData() ?? "").includes(`"tema_tercihi":"${hedefDeger}"`),
    { timeout: 15_000 },
  );
  await temayaGetir(page, hedefEtiket);
  await patchYaniti;
}

test("tema: geçiş → yenileme → route → çıkış/giriş kalıcılığı", async ({ page }) => {
  test.setTimeout(120_000);
  await girisYap(page);

  // 1) Koyu temaya geç. Buton döngüsü: mevcut etiket ne olursa olsun,
  //    "Koyu tema" etiketine ulaşana dek ilerle; profil yazımını BEKLE
  //    (aksi halde reload PATCH'i iptal eder — aşağıdaki helper yorumu).
  await temayaGetirVeYazilsin(page, "Koyu tema", "dark");
  expect(await koyuMu(page)).toBe(true);

  // 2) Yenile: tercih korunur ve İLK paint'te uygulanır (inline script).
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible({ timeout: 15_000 });
  expect(await koyuMu(page)).toBe(true);

  // 3) Yeni route'a geç: tema düşmez.
  await page.goto("/controls");
  await page.waitForLoadState("networkidle");
  expect(await koyuMu(page)).toBe(true);

  // 4) Cookie'yi sil ve yeniden giriş yap: PROFİL tercihi (dark) cookie'siz
  //    de geri gelmeli — "oturum sonrası kullanıcı tercihi üstün gelir".
  await page.context().clearCookies({ name: "kalkan-tema" });
  await page.getByRole("button", { name: "Çıkış" }).click();
  await page.waitForURL("**/giris");
  await girisYap(page);
  await expect
    .poll(() => koyuMu(page), { timeout: 10_000, message: "profil tema tercihi girişte uygulanmalı" })
    .toBe(true);

  // 5) Temizlik: system'a dön (sonraki testler nötr başlasın), yazım beklenir.
  await temayaGetirVeYazilsin(page, "Sistem teması", "system");
});
