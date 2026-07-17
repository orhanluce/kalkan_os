// Rapor PDF üretimi — rapor ve paket rotalarının ORTAK yardımcısı (M9/M11).
//
// NEDEN AYRI DOSYA: hem `/rapor` (tek PDF) hem `/paket` (ZIP içinde PDF) aynı
// PDF'i üretmeli. İki yerde ayrı üretmek, birinin diğerinden sessizce
// ayrışacağı bir yer yaratırdı — ve o an paketteki PDF'in hash'i, denetçinin
// ayrı indirdiği PDF'le tutmazdı.
//
// SUNUCU-YALNIZ: Playwright/Chromium Node API'si gerektirir; bu dosya yalnız
// runtime="nodejs" rotalarından çağrılmalı.

import QRCode from "qrcode";
import { renderSimulasyonRaporuHtml } from "./simulasyon-raporu";
import type { ReportData } from "./simulation-manifest";

export interface RaporPdfGirdisi {
  veri: ReportData;
  coreManifestHash: string;
  reportDataHash: string;
  /** QR'ın işaret edeceği doğrulama adresi (çağıran origin'den türetir). */
  dogrulamaUrl: string;
  muhurDurumu: string;
  anchorSaglayici: string | null;
  imzaKid: string | null;
  imzalayici: string | null;
}

/** Mühürlenmiş veriden rapor PDF'i üretir. Baytlar hem `/rapor` hem `/paket` için aynıdır. */
export async function raporPdfUret(girdi: RaporPdfGirdisi): Promise<Uint8Array> {
  const qrDataUrl = await QRCode.toDataURL(girdi.dogrulamaUrl, { margin: 1, width: 232 });

  const html = renderSimulasyonRaporuHtml({
    veri: girdi.veri,
    coreManifestHash: girdi.coreManifestHash,
    reportDataHash: girdi.reportDataHash,
    qrDataUrl,
    dogrulamaUrl: girdi.dogrulamaUrl,
    muhurDurumu: girdi.muhurDurumu,
    anchorSaglayici: girdi.anchorSaglayici,
    imzaKid: girdi.imzaKid,
    imzalayici: girdi.imzalayici,
  });

  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    const pdf = await page.pdf({ format: "A4", printBackground: true });
    return new Uint8Array(pdf);
  } finally {
    await browser.close();
  }
}
