import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { girisYap, kontrolAc } from "./helpers";

// WCAG 2.2 AA otomatik taraması (M16 üretim kapanışı; master talimat §11/§32).
//
// KAPSAM DÜRÜSTLÜĞÜ: axe otomatik tarama AA'nın TAMAMINI kanıtlamaz (klavye
// akışı, odak sırası, bilişsel kriterler elle test ister) — ama kontrast,
// etiket, ARIA ve yapı ihlallerinin regresyon kilididir. Kritik ekranlar
// light + dark taranır; ihlal = test kırmızı (istisna yok; istisna gerekirse
// buraya gerekçesiyle yazılır).
//
// wcag2a/wcag2aa/wcag21a/wcag21aa + wcag22aa etiketleri: axe'in AA kapsamı.

const EKRANLAR: { ad: string; yol: string }[] = [
  { ad: "pano", yol: "/" },
  { ad: "kontroller", yol: "/controls" },
  { ad: "bulgular", yol: "/findings" },
  { ad: "sod", yol: "/sod" },
  { ad: "sod-import", yol: "/sod/import" },
  { ad: "sod-atamalar", yol: "/sod/atamalar" },
];

async function tara(page: Page, etiket: string) {
  const sonuc = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  const ozet = sonuc.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    nodes: v.nodes.length,
    ornek: v.nodes[0]?.target?.join(" "),
  }));
  expect(ozet, `${etiket} AA ihlalleri: ${JSON.stringify(ozet, null, 2)}`).toEqual([]);
}

for (const tema of ["light", "dark"] as const) {
  test(`AA taraması (${tema}): kritik ekranlar ihlalsiz`, async ({ page }) => {
    test.setTimeout(240_000);
    await page.emulateMedia({ colorScheme: tema });
    await girisYap(page);
    for (const ekran of EKRANLAR) {
      await page.goto(ekran.yol);
      await page.waitForLoadState("networkidle");
      await tara(page, `${ekran.ad} (${tema})`);
    }
    // Kontrol detayı (ana ürün ekranı + kanıt izi rayı).
    await kontrolAc(page, "TODO-DOGRULA-01");
    await page.waitForLoadState("networkidle");
    await tara(page, `kontrol-detay (${tema})`);
  });
}

test("AA taraması: giriş ekranı (oturumsuz)", async ({ page }) => {
  await page.goto("/giris");
  await page.waitForLoadState("networkidle");
  await tara(page, "giris");
});
