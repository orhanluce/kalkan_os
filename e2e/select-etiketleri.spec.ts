import { expect, test } from "@playwright/test";
import { girisYap, kontrolAc } from "./helpers";

// Regresyon koruması: base-ui'de <SelectValue />, Select.Root'a `items`
// (value→label haritası) verilmezse seçili değerin HAM halini gösterir —
// kullanıcı "Açık" yerine "acik", "Ayşe Yılmaz" yerine bir UUID görür.
// Bu, CLAUDE.md kural 6'yı ("Türkçe UI") ihlal eder ve gözle bakarken
// kolayca kaçırılır. Aşağıdaki testler her Select'in etiket gösterdiğini
// doğrular.

test("kontrol detayındaki Select'ler ham değer değil Türkçe etiket gösterir", async ({ page }) => {
  await girisYap(page);
  // Bu spec'e özel bir kontrol kodu: diğer spec dosyaları farklı kodlar
  // kullanır, böylece testler workers:1 altında sırayla koşsa bile
  // birbirinin durum/sorumlu değişikliğinden etkilenmez.
  await kontrolAc(page, "TODO-DOGRULA-01");

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

  // Bir çerçeve seçilince kodu görünmeli, ham UUID değil.
  await filtre.click();
  await page.getByRole("option", { name: "VII-128.10" }).click();
  await expect(filtre).toContainText("VII-128.10");
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

  // Hangi çerçevenin varsayılan seçili geldiği (kodun alfabetik sırasına
  // göre "7545" mi "VII-128.10" mu önce gelir) bu testin konusu değil —
  // asıl regresyon, seçilince ham UUID değil ÇERÇEVE KODU görünmesi. Bu
  // yüzden açıkça VII-128.10'u seçip onu doğruluyoruz.
  const cerceve = page.getByLabel("Çerçeve");
  await expect(cerceve).not.toHaveText("");
  await cerceve.click();
  await page.getByRole("option", { name: "VII-128.10" }).click();
  await expect(cerceve).toContainText("VII-128.10");
});
