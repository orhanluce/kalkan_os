import { test, expect } from "@playwright/test";

// Regresyon koruması: base-ui'de <SelectValue />, Select.Root'a `items`
// (value→label haritası) verilmezse seçili değerin HAM halini gösterir —
// kullanıcı "Açık" yerine "acik", "Ayşe Yılmaz" yerine "u-admin" görür.
// Bu, CLAUDE.md kural 6'yı ("Türkçe UI") ihlal eder ve gözle bakarken
// kolayca kaçırılır. Aşağıdaki testler her Select'in etiket gösterdiğini
// doğrular.

async function girisYap(page: import("@playwright/test").Page) {
  await page.goto("/giris");
  await page.getByLabel("E-posta").fill("ayse@demo.com");
  await page.getByRole("button", { name: "Giriş Yap" }).click();
  await expect(page.getByRole("heading", { name: "Demo Aracı Kurum A.Ş." })).toBeVisible();
}

test("kontrol detayındaki Select'ler ham değer değil Türkçe etiket gösterir", async ({ page }) => {
  await girisYap(page);
  await page.goto("/controls/c-06");

  // c-06 mock'ta "acik" durumunda — "Açık" yazmalı, "acik" değil.
  const durumTrigger = page.getByRole("combobox").first();
  await expect(durumTrigger).toContainText("Açık");
  await expect(durumTrigger).not.toContainText("acik");

  await expect(page.getByLabel("Sorumlu")).toContainText("Atanmadı");
  await expect(page.getByLabel("Sorumlu")).not.toContainText("atanmadi");

  await expect(page.getByLabel("Tip")).toContainText("Dosya");
  await expect(page.getByLabel("Tip")).not.toContainText("dosya");
});

test("kontrol kütüphanesi çerçeve filtresi etiket gösterir", async ({ page }) => {
  await girisYap(page);
  await page.goto("/controls");

  const filtre = page.getByLabel("Çerçeve:");
  await expect(filtre).toContainText("Tümü");
  await expect(filtre).not.toContainText("tumu");

  // Bir çerçeve seçilince kodu görünmeli, ham id ("f-vii128") değil.
  await filtre.click();
  await page.getByRole("option", { name: "VII-128.10" }).click();
  await expect(filtre).toContainText("VII-128.10");
  await expect(filtre).not.toContainText("f-vii128");
});

test("bulgular formundaki Select'ler etiket gösterir", async ({ page }) => {
  await girisYap(page);
  await page.goto("/findings");

  await expect(page.getByLabel("Kaynak")).toContainText("İç Tespit");
  await expect(page.getByLabel("Kaynak")).not.toContainText("ic_tespit");

  await expect(page.getByLabel("Önem")).toContainText("Orta");
  await expect(page.getByLabel("Önem")).not.toContainText("orta");
});

test("paylaşım formundaki çerçeve Select'i etiket gösterir", async ({ page }) => {
  await girisYap(page);
  await page.goto("/paylasim");

  const cerceve = page.getByLabel("Çerçeve");
  await expect(cerceve).toContainText("VII-128.10");
  await expect(cerceve).not.toContainText("f-vii128");
});
