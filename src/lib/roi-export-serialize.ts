// DORA RoI export serileştirme — CSV + XLSX (37 Tez Dikey B, Faz 3 kalan
// dilimi, docs/adr/PR0-37-tez-dikeyB-faz3-kalan-2026-07-20.md §3).
//
// YALNIZ `RoiSablonPaketi`'nin (roi-export.ts) İÇİNDEKİ VERİYİ YAZAR —
// yeni alan uydurmaz, kapsamDisiAlanlar'ı olduğu gibi taşır. Kolon sırası
// SABİT (nesne anahtarı sırasına güvenilmez) — aynı paket her zaman aynı
// baytı üretir (roi-export-serialize.test.ts'te kanıtlı).
import type { RoiSablonPaketi } from "./roi-export";
import { xlsxOlustur, type XlsxHucre, type XlsxSayfa } from "./xlsx-writer";

/**
 * İndirilen her dosyanın taşıdığı açık uyarı (ADR §4): bu içerik resmi
 * şemaya TAM UYGUNLUK İDDİASI TAŞIMAZ — YAYINLANDI durumu yalnız "export
 * öncesi engelleyici sorun kalmadı" demektir (kural 3), nihai sorumluluk
 * kurumun hukuk/uyum fonksiyonundadır.
 */
export const ROI_EXPORT_UYARI_METNI =
  "Bu dosyadaki tüm alanlar YAYINLANDI anındaki doğrulama durumunu yansıtır. " +
  "KALKAN_OS bu içeriğin resmi DORA RoI şemasına TAM UYGUNLUĞUNU İDDİA ETMEZ " +
  "— nihai sorumluluk kurumun hukuk/uyum fonksiyonundadır.";

interface SablonTanimi {
  anahtar: keyof RoiSablonPaketi;
  baslik: string;
  kolonlar: string[];
  satiriDiz: (satir: Record<string, unknown>) => XlsxHucre[];
}

const SABLONLAR: SablonTanimi[] = [
  {
    anahtar: "B_01_01",
    baslik: "B_01.01 — Kaydı tutan kuruluş",
    kolonlar: ["B_01_01_0010_lei", "B_01_01_0030_ulke", "B_01_01_0040_kurulusTuru", "kayitTutanKurulusLei"],
    satiriDiz: (s) => [s.B_01_01_0010_lei as string | null, s.B_01_01_0030_ulke as string | null, s.B_01_01_0040_kurulusTuru as string | null, s.kayitTutanKurulusLei as string | null],
  },
  {
    anahtar: "B_02_01",
    baslik: "B_02.01 — Sözleşme (genel)",
    kolonlar: ["B_02_01_0010_sozlesmeReferansNo"],
    satiriDiz: (s) => [s.B_02_01_0010_sozlesmeReferansNo as string],
  },
  {
    anahtar: "B_02_02",
    baslik: "B_02.02 — Sözleşme (özel)",
    kolonlar: [
      "B_02_02_0010_sozlesmeReferansNo",
      "B_02_02_0030_tedarikciKimlikKodu",
      "B_02_02_0040_kodTuru",
      "B_02_02_0060_hizmetTuru",
      "B_02_02_0070_baslangic",
      "B_02_02_0080_bitis",
      "B_02_02_0090_sonaErmeNedeni",
      "B_02_02_0100_bildirimSuresiKurumGun",
      "B_02_02_0110_bildirimSuresiSaglayiciGun",
      "B_02_02_0140_veriSaklaniyorMu",
      "B_02_02_0150_veriSaklamaUlkesi",
      "B_02_02_0160_veriIslemeUlkesi",
      "fonksiyonKimlikleri",
    ],
    satiriDiz: (s) => [
      s.B_02_02_0010_sozlesmeReferansNo as string,
      s.B_02_02_0030_tedarikciKimlikKodu as string | null,
      s.B_02_02_0040_kodTuru as string | null,
      s.B_02_02_0060_hizmetTuru as string | null,
      s.B_02_02_0070_baslangic as string,
      s.B_02_02_0080_bitis as string,
      s.B_02_02_0090_sonaErmeNedeni as string | null,
      s.B_02_02_0100_bildirimSuresiKurumGun as number | null,
      s.B_02_02_0110_bildirimSuresiSaglayiciGun as number | null,
      s.B_02_02_0140_veriSaklaniyorMu as boolean | null,
      s.B_02_02_0150_veriSaklamaUlkesi as string | null,
      s.B_02_02_0160_veriIslemeUlkesi as string | null,
      ((s.fonksiyonKimlikleri as string[]) ?? []).join(";"),
    ],
  },
  {
    anahtar: "B_05_01",
    baslik: "B_05.01 — Üçüncü taraf kimliği",
    kolonlar: ["id", "B_05_01_0050_yasalAd", "B_05_01_0080_merkezUlkesi"],
    satiriDiz: (s) => [s.id as string, s.B_05_01_0050_yasalAd as string, s.B_05_01_0080_merkezUlkesi as string | null],
  },
  {
    anahtar: "B_05_02",
    baslik: "B_05.02 — Alt yüklenici zinciri",
    kolonlar: ["ad", "B_05_02_0010_sozlesmeReferansNo", "B_05_02_0020_hizmetTuru", "B_05_02_0050_sira", "bilinmiyor"],
    satiriDiz: (s) => [s.ad as string | null, s.B_05_02_0010_sozlesmeReferansNo as string | null, s.B_05_02_0020_hizmetTuru as string | null, s.B_05_02_0050_sira as number | null, s.bilinmiyor as boolean],
  },
  {
    anahtar: "B_06_01",
    baslik: "B_06.01 — Kritik/önemli fonksiyon",
    kolonlar: ["id", "B_06_01_0030_fonksiyonAdi", "kapsamDisiAlanlar"],
    satiriDiz: (s) => [s.id as string, s.B_06_01_0030_fonksiyonAdi as string, ((s.kapsamDisiAlanlar as string[]) ?? []).join(";")],
  },
];

function csvAlan(deger: XlsxHucre): string {
  if (deger === null || deger === undefined) return "";
  const metin = typeof deger === "boolean" ? (deger ? "true" : "false") : String(deger);
  if (/[",\n\r]/.test(metin)) {
    return `"${metin.replace(/"/g, '""')}"`;
  }
  return metin;
}

/**
 * CSV üretir — RFC 4180. Şablon başına ayrı bir bölüm (## başlık + kolon
 * satırı + veri satırları); tek dosyada, deterministik sırayla. Aynı
 * `paket` her zaman aynı metni üretir.
 */
export function roiSablonCsvYap(paket: RoiSablonPaketi): string {
  const satirlar: string[] = [`# KALKAN_ROI_EXPORT_V1 — ${paket.olusturulmaTarihi}`, `# ${ROI_EXPORT_UYARI_METNI}`, ""];
  for (const sablon of SABLONLAR) {
    const veriler = paket[sablon.anahtar] as unknown as Record<string, unknown>[];
    satirlar.push(`## ${sablon.baslik}`);
    satirlar.push(sablon.kolonlar.map(csvAlan).join(","));
    for (const satir of veriler) {
      satirlar.push(sablon.satiriDiz(satir).map(csvAlan).join(","));
    }
    satirlar.push("");
  }
  return satirlar.join("\r\n");
}

/** XLSX üretir — her RoI şablonu ayrı sayfa, ilk sayfa uyarı metnini taşır. */
export function roiSablonXlsxYap(paket: RoiSablonPaketi): Promise<Uint8Array> {
  const sayfalar: XlsxSayfa[] = [
    { ad: "Bilgi", kolonlar: ["alan", "deger"], satirlar: [["schema", paket.schema], ["olusturulmaTarihi", paket.olusturulmaTarihi], ["uyari", ROI_EXPORT_UYARI_METNI]] },
    ...SABLONLAR.map((sablon) => {
      const veriler = paket[sablon.anahtar] as unknown as Record<string, unknown>[];
      return { ad: sablon.anahtar, kolonlar: sablon.kolonlar, satirlar: veriler.map((s) => sablon.satiriDiz(s)) };
    }),
  ];
  return xlsxOlustur(sayfalar);
}
