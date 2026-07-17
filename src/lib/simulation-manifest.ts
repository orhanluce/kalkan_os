// Simülasyon sonuç manifesti — İKİ KATMANLI (docs/ROADMAP.md M9, belge §11.3).
//
// NE İŞE YARAR: bir tatbikat bittiğinde "şu şablon sürümüyle, şu kararlar
// verilerek, şu kanıtlara dayanarak, şu kurallarla, şu puan çıktı" iddiasını
// hash'lere bağlar. Mühürlenince sonradan hiçbir alanı sessizce değiştirilemez.
//
// DETERMİNİSTİK (kural 11): Date.now, rastgelelik veya dış çağrı YOK. Aynı
// tatbikat verisi her zaman aynı hash'leri verir — denetçi kendi elindeki
// veriyle yeniden hesaplayıp karşılaştırabilsin diye.
//
// ---------------------------------------------------------------------------
// DÖRT HASH — ADLARINA DİKKAT, HEPSİ FARKLI ŞEYİ DOĞRULAR:
//
//   reportDataHash      Raporun dayandığı deterministik SONUÇ VERİSİNİ
//   coreManifestHash    Rapor verisi + kanıt zarflarının BÜTÜNÜNÜ
//   pdfFileHash         Üretilmiş PDF DOSYASININ BAYTLARINI
//   packageManifestHash Dışa aktarılan ZIP PAKETİNİN içeriğini
//
// Eskiden tek bir `reportHash` vardı ve bu ad yanlıştı: PDF hash'i sanılmasına
// yol açıyordu. Ayrıştırıldı.
//
// DÖNGÜ SORUNU VE ÇÖZÜMÜ — burayı okumadan sırayı değiştirme:
// Bir belge kendi hash'ini içeremez. PDF'e kendi hash'ini basmak baytlarını
// değiştirir, bu da hash'i değiştirir. Bu yüzden ÜRETİM SIRASI tek yönlüdür:
//
//   1. ReportData kurulur (manifest/PDF hash'i İÇERMEZ)
//   2. reportDataHash = H(JCS(ReportData))
//   3. Core manifest = { reportDataHash, kanıt zarf hash'leri, ... }
//   4. coreManifestHash = H(JCS(coreManifest))
//   5. PDF üretilir — İÇİNDE reportDataHash + coreManifestHash + QR taşır
//   6. pdfFileHash = H(PDF baytları)          <-- PDF'ten SONRA
//   7. Paket manifesti = { coreManifestHash, pdfFileHash, dosyalar }
//   8. packageManifestHash = H(JCS(paketManifesti)) -> anchor/audit zinciri
//
// PDF'in İÇİNE pdfFileHash veya packageManifestHash BASILMAZ: ikisi de PDF
// üretildikten sonra doğar. PDF'te reportDataHash ve coreManifestHash yeter.
// ---------------------------------------------------------------------------

import { batchRootFromHashes } from "./anchor";
import {
  CORE_MANIFEST_SCHEMA,
  PACKAGE_MANIFEST_SCHEMA,
  REPORT_DATA_SCHEMA,
  bytesHash,
  canonicalHash,
  kanonikSayi,
  kanonikZaman,
  type CanonicalDeger,
} from "./canonical";
import { sha256Hex } from "./evidence";

/**
 * Puanlama MOTORUNUN sürümü — şablonun değil.
 *
 * Şablon sürümü "hangi kurallar" sorusuna cevap verir; bu ise "o kurallar
 * hangi kodla yorumlandı" sorusuna. `puanla()`'nın davranışı değişirse aynı
 * şablon + aynı veri farklı puan verebilir. O zaman burayı artır, yoksa eski
 * bir manifesti yeniden hesaplayan denetçi farkı kurcalama sanır.
 */
export const PUANLAMA_MOTOR_SURUMU = 1;

/** Karar kaydı. Cevabın METNİ değil hash'i girer — bkz. cevapHash gerekçesi. */
export interface ManifestKarar {
  kod: string;
  senaryoDakika: number | null;
  /**
   * Cevabın METNİ DEĞİL, hash'i.
   *
   * Manifest QR ile herkese açık bir doğrulama yüzeyine bağlanıyor ve rapora
   * basılıyor. Katılımcının serbest metin cevabı hassas veridir; manifestin
   * işi onu saklamak değil, DEĞİŞMEDİĞİNİ kanıtlamak. Hash ikisini ayırır:
   * içeriği bilen doğrulayabilir, bilmeyen öğrenemez.
   */
  cevapHash: string;
  kanitVar: boolean;
}

export interface ManifestAksiyon {
  kod: string;
  tamamlandi: boolean;
  dakika: number | null;
}

export interface ManifestPuanSatiri {
  kod: string;
  sonuc: string;
  puan: number;
  agirlik: number;
}

/**
 * Kanıt bütünlük durumu.
 *
 * LEGACY_FILE_HASH_ONLY: zarf alanları olmayan eski kayıt. Bu kanıt "dosya
 * bütünlüğü doğrulandı" diyebilir; "kanıt kökeni ve zarf zinciri doğrulandı"
 * DİYEMEZ. Eksik alanları uydurmaktansa farkı taşımak doğru — uydurulmuş bir
 * zarfın hash'i, kanıt değeri olmayan bir sayıdır.
 */
export type KanitButunlukDurumu = "FULL_ENVELOPE" | "LEGACY_FILE_HASH_ONLY";

/** Manifeste giren kanıt kaydı: dosya VE zarf hash'i ayrı ayrı. */
export interface ManifestKanit {
  evidenceVersionId: string;
  /** Dosyanın değişmediğini gösterir. */
  fileHash: string;
  /** Kaynağın, sürümün, saklama sınıfının ve geçmiş ilişkisinin değişmediğini gösterir. */
  envelopeHash: string | null;
  envelopeSchemaVersion: string | null;
  durum: KanitButunlukDurumu;
}

/**
 * Raporun dayandığı deterministik sonuç verisi.
 *
 * BURAYA MANİFEST VEYA PDF HASH'İ GİRMEZ (döngü). Rapora GÖRÜNEN her
 * deterministik olgu ise girmeli: girmeyen bir şey mühürlenmemiş demektir ve
 * raporda sessizce değiştirilebilir.
 */
export interface ReportData {
  sema: string;
  /** Raporun üstünde YAZAN kurum adı — mühürün içinde, çünkü raporun en görünür iddiası. */
  kurumAdi: string;
  senaryoKodu: string;
  senaryoAdi: string;
  sablonSurum: number;
  tatbikatAdi: string;
  mod: string;
  basladiAt: string | null;
  bittiAt: string | null;
  puan: number;
  durum: string;
  satirlar: ManifestPuanSatiri[];
  kritikBasarisizliklar: string[];
  aksiyonlar: ManifestAksiyon[];
  oneriSayisi: number;
}

/** Çekirdek manifest: rapor verisi + kanıt zarflarının bütünü. */
export interface CoreManifest {
  sema: string;
  runId: string;
  tenantId: string;
  senaryoKodu: string;
  sablonSurum: number;
  mod: string;
  zamanOlcegi: number;
  basladiAt: string | null;
  bittiAt: string | null;
  kararlar: ManifestKarar[];
  aksiyonlar: ManifestAksiyon[];
  kanitlar: ManifestKanit[];
  puanlamaKurallariHash: string;
  puanlamaMotorSurumu: number;
  puan: number;
  durum: string;
  /** Bkz. dosya başındaki döngü açıklaması. */
  reportDataHash: string;
}

/** Dış paket manifesti: PDF ve çekirdek manifest dahil, dışa aktarılan her dosya. */
export interface PackageManifest {
  sema: string;
  coreManifestHash: string;
  dosyalar: { ad: string; hash: string; bayt: number }[];
}

/** Serbest metin cevabın hash'i. */
export function cevapHash(cevap: string): Promise<string> {
  return sha256Hex(new TextEncoder().encode(cevap).buffer as ArrayBuffer);
}

/** PDF/ZIP gibi üretilmiş dosyaların bayt hash'i. PDF üretildikten SONRA çağrılır. */
export function pdfFileHash(pdf: Uint8Array): Promise<string> {
  return bytesHash(pdf);
}

/**
 * Puanlama kural setinin hash'i.
 *
 * Kurallar DB'den hangi sırayla gelirse gelsin aynı hash çıkmalı — sıra,
 * kuralların kimliğinin parçası değil. Sıralama koda göre yapılır ve kodlar
 * şablon içinde tekildir, yani bilgi kaybetmez.
 */
export function puanlamaKurallariHash(
  kurallar: { kod: string; tip: string; agirlik: number | string; parametreler: Record<string, unknown> }[],
): Promise<string> {
  const sirali = [...kurallar]
    .sort((a, b) => (a.kod < b.kod ? -1 : a.kod > b.kod ? 1 : 0))
    .map((k) => ({
      kod: k.kod,
      tip: k.tip,
      agirlik: kanonikSayi(k.agirlik),
      parametreler: (k.parametreler ?? {}) as CanonicalDeger,
    }));
  return canonicalHash(sirali as unknown as CanonicalDeger);
}

export function reportDataHash(veri: ReportData): Promise<string> {
  return canonicalHash(veri as unknown as CanonicalDeger);
}

export function coreManifestHash(manifest: CoreManifest): Promise<string> {
  return canonicalHash(manifest as unknown as CanonicalDeger);
}

export function packageManifestHash(paket: PackageManifest): Promise<string> {
  return canonicalHash(paket as unknown as CanonicalDeger);
}

/** coreManifestOlustur'un girdisi: tatbikatta fiilen olan her şey. */
export interface ManifestGirdisi {
  runId: string;
  tenantId: string;
  kurumAdi: string;
  senaryoKodu: string;
  senaryoAdi: string;
  sablonSurum: number;
  tatbikatAdi: string;
  mod: string;
  zamanOlcegi: number | string;
  basladiAt: string | null;
  bittiAt: string | null;
  /** Cevabın METNİ gelir; manifeste hash'i girer. */
  kararlar: { kod: string; senaryoDakika: number | null; cevap: string; kanitVar: boolean }[];
  aksiyonlar: ManifestAksiyon[];
  kanitlar: ManifestKanit[];
  kurallar: { kod: string; tip: string; agirlik: number | string; parametreler: Record<string, unknown> }[];
  puan: number;
  durum: string;
  satirlar: ManifestPuanSatiri[];
  kritikBasarisizliklar: string[];
  oneriSayisi: number;
}

export interface MuhurlenmisSonuc {
  reportData: ReportData;
  reportDataHash: string;
  coreManifest: CoreManifest;
  coreManifestHash: string;
  /** coreManifestHash üzerine RFC 6962 Merkle kökü (tek yaprak). */
  merkleRoot: string;
}

/**
 * Sırasız koleksiyonları KARARLI kimliklerle sıralar.
 *
 * NEDEN HEPSİ: DB'den geliş sırası hiçbir hash'i etkilememeli. Bu bir kez
 * gerçek bir hataya yol açtı — manifest dizileri sıralanıyordu ama ReportData
 * sıralanmıyordu ve reportDataHash manifestin içine girdiği için satır sırası
 * mühre sızıyordu. Aynı tatbikat farklı hash veriyordu; denetçi bunu
 * kurcalama sanardı. Sıralama TEK yerde, kurulumdan önce yapılır.
 */
function kodaGore<T extends { kod: string }>(a: T, b: T): number {
  return a.kod < b.kod ? -1 : a.kod > b.kod ? 1 : 0;
}

/**
 * Tatbikat verisinden çekirdek manifesti kurar.
 *
 * SIRA ÖNEMLİ (dosya başındaki döngü açıklaması): önce ReportData ve hash'i,
 * sonra o hash'i İÇEREN çekirdek manifest, sonra onun hash'i. Tersine
 * çevirirsen rapor manifeste bağlı olmaz ve raporu değiştirmek mührü bozmaz —
 * yani mühür hiçbir şey ölçmez.
 */
export async function coreManifestOlustur(girdi: ManifestGirdisi): Promise<MuhurlenmisSonuc> {
  const aksiyonlar = [...girdi.aksiyonlar].sort(kodaGore);
  const satirlar = [...girdi.satirlar].sort(kodaGore);
  const kritikBasarisizliklar = [...girdi.kritikBasarisizliklar].sort();
  const kanitlar = [...girdi.kanitlar].sort((a, b) =>
    a.evidenceVersionId < b.evidenceVersionId ? -1 : a.evidenceVersionId > b.evidenceVersionId ? 1 : 0,
  );

  const veri: ReportData = {
    sema: REPORT_DATA_SCHEMA,
    kurumAdi: girdi.kurumAdi,
    senaryoKodu: girdi.senaryoKodu,
    senaryoAdi: girdi.senaryoAdi,
    sablonSurum: girdi.sablonSurum,
    tatbikatAdi: girdi.tatbikatAdi,
    mod: girdi.mod,
    basladiAt: kanonikZaman(girdi.basladiAt),
    bittiAt: kanonikZaman(girdi.bittiAt),
    puan: girdi.puan,
    durum: girdi.durum,
    satirlar: satirlar.map((s) => ({ ...s, puan: kanonikSayi(s.puan), agirlik: kanonikSayi(s.agirlik) })),
    kritikBasarisizliklar,
    aksiyonlar,
    oneriSayisi: girdi.oneriSayisi,
  };
  const rdHash = await reportDataHash(veri);

  const kararlar: ManifestKarar[] = (
    await Promise.all(
      girdi.kararlar.map(async (k) => ({
        kod: k.kod,
        senaryoDakika: k.senaryoDakika,
        cevapHash: await cevapHash(k.cevap),
        kanitVar: k.kanitVar,
      })),
    )
  ).sort(kodaGore);

  const coreManifest: CoreManifest = {
    sema: CORE_MANIFEST_SCHEMA,
    runId: girdi.runId,
    tenantId: girdi.tenantId,
    senaryoKodu: girdi.senaryoKodu,
    sablonSurum: girdi.sablonSurum,
    mod: girdi.mod,
    zamanOlcegi: kanonikSayi(girdi.zamanOlcegi),
    basladiAt: kanonikZaman(girdi.basladiAt),
    bittiAt: kanonikZaman(girdi.bittiAt),
    kararlar,
    aksiyonlar,
    kanitlar,
    puanlamaKurallariHash: await puanlamaKurallariHash(girdi.kurallar),
    puanlamaMotorSurumu: PUANLAMA_MOTOR_SURUMU,
    puan: girdi.puan,
    durum: girdi.durum,
    reportDataHash: rdHash,
  };

  const cmHash = await coreManifestHash(coreManifest);

  return {
    reportData: veri,
    reportDataHash: rdHash,
    coreManifest,
    coreManifestHash: cmHash,
    // Tek yapraklı ağaç: bugün her manifest kendi başına mühürleniyor.
    // batchRootFromHashes yine de kullanılıyor — ileride birden çok manifest
    // tek partide mühürlenirse iki ayrı kök üretme yolu doğmasın.
    merkleRoot: await batchRootFromHashes([cmHash]),
  };
}

/**
 * Dış paket manifestini kurar (ZIP dışa aktarımı).
 *
 * PDF ÜRETİLDİKTEN SONRA çağrılır: pdfFileHash burada girdi, çünkü PDF'in
 * baytları ancak PDF varken bilinir.
 */
export async function packageManifestOlustur(girdi: {
  coreManifestHash: string;
  dosyalar: { ad: string; hash: string; bayt: number }[];
}): Promise<{ packageManifest: PackageManifest; hash: string }> {
  const paket: PackageManifest = {
    sema: PACKAGE_MANIFEST_SCHEMA,
    coreManifestHash: girdi.coreManifestHash,
    // Dosya sırası paketin kimliği değil: ada göre sabitle.
    dosyalar: [...girdi.dosyalar].sort((a, b) => (a.ad < b.ad ? -1 : a.ad > b.ad ? 1 : 0)),
  };
  return { packageManifest: paket, hash: await packageManifestHash(paket) };
}
