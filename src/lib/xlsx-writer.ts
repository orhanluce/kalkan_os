// Minimal XLSX (OOXML) yazıcı — 37 Tez Dikey B, Faz 3 kalan dilimi.
//
// NEDEN KÜTÜPHANE DEĞİL (canonical.ts'in "neden kütüphane değil"
// gerekçesinin AYNISI): XLSX zaten bir ZIP arşividir; repo ZATEN
// `jszip`'e sahip (M11 ZIP paketleri, src/app/api/simulasyon/[id]/paket/
// route.ts). Üçüncü bir "xlsx"/"exceljs" bağımlılığı eklemek yerine,
// ECMA-376'nın minimal geçerli alt kümesini (tek stilsiz sayfa, inline-
// string hücreler — paylaşılan string tablosu YOK, basitlik için) elle
// üretiyoruz. Excel/LibreOffice/Google Sheets bu minimal alt kümeyi açar;
// stil/format YOK (kapsam dışı, ADR PR0-37-tez-dikeyB-faz3-kalan §3).
import JSZip from "jszip";

export type XlsxHucre = string | number | boolean | null;

export interface XlsxSayfa {
  /** Sayfa adı — Excel 31 karakterle sınırlar, kod bunu KESMEZ (çağıran kısaltır). */
  ad: string;
  kolonlar: string[];
  satirlar: XlsxHucre[][];
}

function xmlKac(deger: string): string {
  return deger
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** 0-tabanlı sütun index'ini Excel harfine çevirir (0->A, 25->Z, 26->AA). */
function sutunHarfi(index: number): string {
  let n = index + 1;
  let harf = "";
  while (n > 0) {
    const kalan = (n - 1) % 26;
    harf = String.fromCharCode(65 + kalan) + harf;
    n = Math.floor((n - 1) / 26);
  }
  return harf;
}

function hucreXml(deger: XlsxHucre, r: string): string {
  if (deger === null) return `<c r="${r}"/>`;
  if (typeof deger === "number") {
    if (!Number.isFinite(deger)) return `<c r="${r}"/>`;
    return `<c r="${r}"><v>${deger}</v></c>`;
  }
  if (typeof deger === "boolean") {
    return `<c r="${r}" t="b"><v>${deger ? 1 : 0}</v></c>`;
  }
  return `<c r="${r}" t="inlineStr"><is><t xml:space="preserve">${xmlKac(deger)}</t></is></c>`;
}

function sayfaXml(sayfa: XlsxSayfa): string {
  const satirXmls: string[] = [];
  const basliklar = sayfa.kolonlar.map((k, i) => hucreXml(k, `${sutunHarfi(i)}1`)).join("");
  satirXmls.push(`<row r="1">${basliklar}</row>`);
  sayfa.satirlar.forEach((satir, rIdx) => {
    const rowNo = rIdx + 2;
    const hucreler = satir.map((h, cIdx) => hucreXml(h, `${sutunHarfi(cIdx)}${rowNo}`)).join("");
    satirXmls.push(`<row r="${rowNo}">${hucreler}</row>`);
  });
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${satirXmls.join("")}</sheetData></worksheet>`;
}

/** Excel sayfa adı kısıtları: 31 karakter, `[]:*?/\` yasak. */
function sayfaAdiTemizle(ad: string): string {
  return ad.replace(/[[\]:*?/\\]/g, "_").slice(0, 31) || "Sayfa";
}

/**
 * Sayfaları geçerli, minimal bir .xlsx dosyasına derler. DETERMİNİSTİK:
 * aynı girdi HER ZAMAN aynı bayt dizisini üretir (jszip'in DEFAULT
 * sıkıştırma ayarları + sabit dosya sırası ile — test bunu kanıtlar).
 */
export async function xlsxOlustur(sayfalar: XlsxSayfa[]): Promise<Uint8Array> {
  const zip = new JSZip();
  // Deterministik çıktı: sabit tarih HER dosyaya (jszip varsayılanı dosya
  // sistemi saatini gömer — bağımsız doğrulayıcı aynı girdiden aynı bayt
  // bekleyecekse bu SABİT olmalı, Date.now() burada da YOK kural 11).
  const sabitTarih = { date: new Date(0) };
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
${sayfalar.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("\n")}
</Types>`,
    sabitTarih,
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
    sabitTarih,
  );
  zip.file(
    "xl/workbook.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>
${sayfalar.map((s, i) => `<sheet name="${xmlKac(sayfaAdiTemizle(s.ad))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("\n")}
</sheets>
</workbook>`,
    sabitTarih,
  );
  zip.file(
    "xl/_rels/workbook.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${sayfalar.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("\n")}
</Relationships>`,
    sabitTarih,
  );
  sayfalar.forEach((s, i) => {
    zip.file(`xl/worksheets/sheet${i + 1}.xml`, sayfaXml(s), sabitTarih);
  });

  return zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
  });
}
