import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "@playwright/test";
import { girisYap, kontrolAc } from "./helpers";

// Görsel baseline yakalama (PR-0/PR-1, master talimat §3.8 + §30).
//
// NE İŞE YARAR: kritik ekranların ekran görüntüsünü docs/gorsel-baseline/
// altına tarihli klasörle yazar. PR-1 öncesi "önce" durumu belgelemek ve
// PR-2 taşımaları sırasında elle karşılaştırmak için. `toHaveScreenshot`
// ASSERTION'ı bilinçli olarak kullanılmıyor: PR-1/PR-2 görünümü KASITLI
// değiştirecek; her değişimde snapshot güncellemek gürültü üretir. Piksel
// assertion'ları görünüm stabilize olunca (PR-2 sonu) eklenir.
//
// Koşum: pnpm exec playwright test e2e/gorsel-baseline.spec.ts
// (fixtures gerekir: pnpm e2e:fixtures)

const ETIKET = process.env.BASELINE_ETIKET ?? "guncel";
const KLASOR = join(process.cwd(), "docs", "gorsel-baseline", ETIKET);

const VIEWPORTLAR = [
  { ad: "masaustu", width: 1440, height: 900 },
  { ad: "mobil", width: 390, height: 844 },
] as const;

const EKRANLAR = [
  { ad: "pano", yol: "/" },
  { ad: "kontroller", yol: "/controls" },
  { ad: "bulgular", yol: "/findings" },
  { ad: "sod", yol: "/sod" },
  { ad: "denetim-izi", yol: "/denetim-izi" },
] as const;

test("kontrol detayı (kanıt izi rayı) baseline'ı", async ({ page }) => {
  test.setTimeout(120_000);
  mkdirSync(KLASOR, { recursive: true });
  await girisYap(page);
  for (const tema of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: tema });
    await kontrolAc(page, "TODO-DOGRULA-01");
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: join(KLASOR, `kontrol-detay-masaustu-${tema}.png`), fullPage: true });
  }
});

test("kritik ekranların görsel baseline'ını yakala", async ({ page }) => {
  test.setTimeout(300_000);
  mkdirSync(KLASOR, { recursive: true });

  await girisYap(page);

  // Light + dark (belge §30: kritik ekranlar iki temada). Dark, OS emülasyonu
  // ile: tema tercihi "system" iken prefers-color-scheme'i çeviririz — tema
  // mekanizmasının kendisi de böylece gerçekten sınanır.
  for (const tema of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: tema });
    for (const vp of VIEWPORTLAR) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      for (const ekran of EKRANLAR) {
        await page.goto(ekran.yol);
        // Ağ ve render otursun — skeleton/loading yakalamayalım.
        await page.waitForLoadState("networkidle");
        await page.screenshot({
          path: join(KLASOR, `${ekran.ad}-${vp.ad}-${tema}.png`),
          fullPage: true,
        });
      }
    }
  }
});
