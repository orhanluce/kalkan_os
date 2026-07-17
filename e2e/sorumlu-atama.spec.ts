import { expect, test } from "@playwright/test";
import { E2E_IKINCI_KULLANICI_ADI, E2E_KULLANICI_ADI, girisYap, kontrolAc } from "./helpers";

// Bu akış daha önce yalnızca elle doğrulanmaya çalışılmıştı; base-ui'nin
// portal'lı Select'i tarayıcı otomasyon araçlarıyla zor sürüldüğü için
// kalıcı bir test olarak buraya alındı — artık her `pnpm e2e` koşusunda
// gerçek bir tıklamayla doğrulanıyor.
//
// Her test farklı bir kontrol kodu kullanır (bkz. select-etiketleri.spec.ts
// notu) — testler arası durum sızıntısını önlemek için.

test("sorumlu atama: seçim yapılır, kalıcı olur ve listeye yansır", async ({ page }) => {
  await girisYap(page);
  await kontrolAc(page, "TODO-DOGRULA-02");

  // Başlangıçta atanmamış olmalı (setup-e2e-fixtures her koşuda sıfırlar).
  const sorumluTrigger = page.getByLabel("Sorumlu");
  await expect(sorumluTrigger).toContainText("Atanmadı");

  // Gerçek tıklama: trigger'ı aç, portal'daki seçeneği seç.
  await sorumluTrigger.click();
  await page.getByRole("option", { name: E2E_KULLANICI_ADI }).click();

  await expect(sorumluTrigger).toContainText(E2E_KULLANICI_ADI);

  // Sayfa yenilendikten sonra da kalıcı olmalı (gerçek DB yazması — artık
  // localStorage değil).
  await page.reload();
  await expect(page.getByLabel("Sorumlu")).toContainText(E2E_KULLANICI_ADI);

  // Kontrol kütüphanesi listesindeki Sorumlu kolonuna da yansımalı.
  await page.goto("/controls");
  const row = page.getByRole("row", { name: /TODO-DOGRULA-02/ });
  await expect(row).toContainText(E2E_KULLANICI_ADI);
});

test("sorumlu ataması geri alınabilir (Atanmadı'ya dönüş)", async ({ page }) => {
  await girisYap(page);
  await kontrolAc(page, "TODO-DOGRULA-03");

  const sorumluTrigger = page.getByLabel("Sorumlu");

  await sorumluTrigger.click();
  await page.getByRole("option", { name: E2E_IKINCI_KULLANICI_ADI }).click();
  await expect(sorumluTrigger).toContainText(E2E_IKINCI_KULLANICI_ADI);

  await sorumluTrigger.click();
  await page.getByRole("option", { name: "Atanmadı" }).click();
  await expect(sorumluTrigger).toContainText("Atanmadı");
});
