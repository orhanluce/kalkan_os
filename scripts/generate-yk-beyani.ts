// Mock veriyle bir YK Beyanı PDF örneği üretir. M4 kabul kriterinin
// ("PDF üretilir ve alanları doludur") mock veri üzerinde şimdiden
// gösterilebilmesi için — gerçek Supabase verisine bağlanınca bu script'in
// veri kaynağı mock-data yerine tenant sorgusuna çevrilecek.
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { renderYkBeyaniHtml } from "../src/lib/yk-beyani";
import { calculateMaturityScore } from "../src/lib/maturity";
import { mockControls, mockFindings, mockTenant, mockTenantControls } from "../src/lib/mock-data";

async function main() {
  const outDir = join(__dirname, "..", ".local-output");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "yk-beyani-demo.pdf");

  const html = renderYkBeyaniHtml({
    tenantName: mockTenant.name,
    donemEtiketi: "2026 Q3 (mock)",
    hazirlanmaTarihi: "2026-07-16",
    olgunlukSkoru: calculateMaturityScore(mockTenantControls, mockControls),
    acikBulgularSayisi: mockFindings.filter((f) => f.durum === "acik").length,
    kritikBulgularSayisi: mockFindings.filter((f) => f.onem === "kritik" && f.durum === "acik")
      .length,
    sonSizmaTestiTarihi: null, // TODO: gerçek veri bağlanınca en son sızma testi kanıtından doldurulacak
    toplamKanitSayisi: 0, // TODO: gerçek veri bağlanınca evidences sayısından doldurulacak
    rtoSaat: 4,
    rpoSaat: 1,
  });

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    await page.pdf({ path: outPath, format: "A4", printBackground: true });
  } finally {
    await browser.close();
  }

  console.log(`YK Beyanı PDF üretildi: ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
