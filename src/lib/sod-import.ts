// SoD atama içe aktarma — sağlayıcıdan bağımsız sözleşme + güvenli CSV parser
// + deterministik dry-run (docs/ROADMAP.md M16 PR-3A).
//
// SALT OKUR: bu modül HİÇBİR atamayı değiştirmez. CSV'yi ayrıştırır,
// normalleştirir, güvenlik kontrolü yapar, mevcut atamalarla FARKINI hesaplar
// ve hash'ler üretir. Uygulama (apply) PR-3B'nin işidir.
//
// SAĞLAYICIDAN BAĞIMSIZ: gelecekteki IAM/PAM connector'ları yalnızca ilk adımı
// (kaynağı `SodAssignmentImportRecord[]`e çevirmeyi) değiştirir; normalize →
// validate → diff hattı ortak kalır (kurucu talimatı §4).
//
// DETERMİNİSTİK (kural 11): satır SIRASI sonucu etkilemez. Normalize edilmiş
// kayıtlar doğal anahtara (`source|sourceRecordId`) göre sıralanır; aynı dosya
// her zaman aynı `normalizedRecordsHash` ve aynı diff'i verir.

import { canonicalHash, bytesHash, type CanonicalDeger } from "./canonical";

// Bileşik anahtar ayırıcısı: U+001F (unit separator) normal veride görülmez,
// yani "ab"+"c" ile "a"+"bc" karışmaz.
const AYIRICI = String.fromCharCode(31);
function anahtarKur(source: string, sourceRecordId: string): string {
  return `${source}${AYIRICI}${sourceRecordId}`;
}

export type ImportMode = "DELTA" | "AUTHORITATIVE_SNAPSHOT";
export type SubjectType = "USER" | "SERVICE_ACCOUNT" | "GROUP";

/** Sağlayıcıdan bağımsız iç model (kurucu §4). */
export interface SodAssignmentImportRecord {
  externalSubjectId: string;
  subjectType: SubjectType;
  displayName: string | null;
  email: string | null;
  roleCode: string | null;
  activityCode: string;
  systemCode: string;
  validFrom: string; // ISO tarih (YYYY-MM-DD)
  validTo: string | null;
  source: string;
  sourceRecordId: string;
}

// --- Güvenlik sınırları (kurucu §8) ---
export const IMPORT_LIMITLERI = {
  maxBayt: 5 * 1024 * 1024, // 5 MB
  maxSatir: 50_000,
  maxKolon: 40,
  maxHucreUzunluk: 2_000,
} as const;

// CSV başlıkları (snake_case) indeksle çözülür — sıra önemsiz. Tam kolon
// kümesi: external_subject_id, subject_type, display_name, email, role_code,
// activity_code, system_code, valid_from, valid_to, source, source_record_id.
// Zorunlular aşağıda; opsiyoneller (display_name/email/role_code/valid_to) boş
// olabilir.
const ZORUNLU_KOLONLAR = [
  "external_subject_id",
  "subject_type",
  "activity_code",
  "system_code",
  "valid_from",
  "source",
  "source_record_id",
] as const;

export interface SatirHatasi {
  satir: number; // 1-tabanlı veri satırı (başlık hariç)
  neden: string;
  kod:
    | "FORMULA_INJECTION"
    | "ZORUNLU_ALAN_BOS"
    | "GECERSIZ_SUBJECT_TYPE"
    | "GECERSIZ_TARIH"
    | "HUCRE_COK_UZUN"
    | "KOLON_SAYISI";
}

export interface DosyaHatasi {
  neden: string;
  kod:
    | "BOS_DOSYA"
    | "COK_BUYUK"
    | "COK_FAZLA_SATIR"
    | "COK_FAZLA_KOLON"
    | "NULL_BYTE"
    | "BASLIK_YOK"
    | "YINELENEN_BASLIK"
    | "EKSIK_ZORUNLU_KOLON";
}

/** Formula injection: bu karakterlerle başlayan hücre export/gösterimde formül olabilir. */
const FORMULA_ONEKLERI = ["=", "+", "-", "@", "\t", "\r"];

function formulaRiski(hucre: string): boolean {
  return hucre.length > 0 && FORMULA_ONEKLERI.includes(hucre[0]);
}

/** BOM'u temizler. */
function bomTemizle(metin: string): string {
  return metin.charCodeAt(0) === 0xfeff ? metin.slice(1) : metin;
}

/**
 * RFC 4180 tarzı tek satır CSV ayrıştırma: tırnaklı alanlar, kaçışlı tırnak
 * (""), tırnak içi virgül. Tırnak içi SATIR SONU DESTEKLENMEZ (atama verisinde
 * beklenmez; satır bölme basit tutulur).
 */
function csvSatirAyristir(satir: string): string[] {
  const alanlar: string[] = [];
  let mevcut = "";
  let tirnakIcinde = false;
  for (let i = 0; i < satir.length; i++) {
    const c = satir[i];
    if (tirnakIcinde) {
      if (c === '"') {
        if (satir[i + 1] === '"') {
          mevcut += '"';
          i++;
        } else {
          tirnakIcinde = false;
        }
      } else {
        mevcut += c;
      }
    } else if (c === '"') {
      tirnakIcinde = true;
    } else if (c === ",") {
      alanlar.push(mevcut);
      mevcut = "";
    } else {
      mevcut += c;
    }
  }
  alanlar.push(mevcut);
  return alanlar;
}

export interface CsvAyristirmaSonucu {
  basliklar: string[];
  satirlar: string[][]; // yalnızca veri satırları
  dosyaHatasi: DosyaHatasi | null;
}

/** Ham dosya (bayt/metin) güvenlik + yapısal doğrulama, sonra ayrıştırma. */
export function csvAyristir(metin: string, byteUzunluk: number): CsvAyristirmaSonucu {
  const bos = { basliklar: [], satirlar: [] };

  if (byteUzunluk > IMPORT_LIMITLERI.maxBayt) {
    return { ...bos, dosyaHatasi: { kod: "COK_BUYUK", neden: "Dosya boyut sınırını aşıyor." } };
  }
  if (metin.includes("\0")) {
    return { ...bos, dosyaHatasi: { kod: "NULL_BYTE", neden: "Dosya null byte içeriyor." } };
  }

  const temiz = bomTemizle(metin);
  // \r\n ve \n normalize; sondaki boş satırlar atılır.
  const tumSatirlar = temiz.split(/\r\n|\n|\r/).filter((s, i, arr) => !(s === "" && i === arr.length - 1));
  if (tumSatirlar.length === 0 || (tumSatirlar.length === 1 && tumSatirlar[0].trim() === "")) {
    return { ...bos, dosyaHatasi: { kod: "BOS_DOSYA", neden: "Dosya boş." } };
  }

  const basliklar = csvSatirAyristir(tumSatirlar[0]).map((h) => h.trim().toLowerCase());
  if (basliklar.length > IMPORT_LIMITLERI.maxKolon) {
    return { ...bos, dosyaHatasi: { kod: "COK_FAZLA_KOLON", neden: "Kolon sayısı sınırı aşıldı." } };
  }
  if (new Set(basliklar).size !== basliklar.length) {
    return { ...bos, dosyaHatasi: { kod: "YINELENEN_BASLIK", neden: "Yinelenen başlık var." } };
  }
  const eksik = ZORUNLU_KOLONLAR.filter((k) => !basliklar.includes(k));
  if (eksik.length > 0) {
    return { ...bos, dosyaHatasi: { kod: "EKSIK_ZORUNLU_KOLON", neden: `Eksik zorunlu kolon: ${eksik.join(", ")}` } };
  }

  const veriSatirlari = tumSatirlar.slice(1).filter((s) => s.trim() !== "");
  if (veriSatirlari.length > IMPORT_LIMITLERI.maxSatir) {
    return { ...bos, dosyaHatasi: { kod: "COK_FAZLA_SATIR", neden: "Satır sayısı sınırı aşıldı." } };
  }

  return { basliklar, satirlar: veriSatirlari.map(csvSatirAyristir), dosyaHatasi: null };
}

function alan(basliklar: string[], satir: string[], kolon: string): string {
  const i = basliklar.indexOf(kolon);
  return i >= 0 && i < satir.length ? satir[i] : "";
}

export interface NormalizasyonSonucu {
  kayitlar: SodAssignmentImportRecord[];
  satirHatalari: SatirHatasi[];
  /** Aynı (source, sourceRecordId) birden fazla satırda: hangi satırlar. */
  duplicateler: { source: string; sourceRecordId: string; satirlar: number[] }[];
}

/**
 * Ham satırları normalleştirir + doğrular. DETERMİNİSTİK: çıktı kayıtları
 * doğal anahtara göre sıralı döner, giriş sırası önemsiz.
 */
export function normalize(basliklar: string[], satirlar: string[][]): NormalizasyonSonucu {
  const kayitlar: SodAssignmentImportRecord[] = [];
  const satirHatalari: SatirHatasi[] = [];
  const anahtarSatirlari = new Map<string, number[]>();

  satirlar.forEach((satir, idx) => {
    const satirNo = idx + 1;

    // Formula injection: HERHANGİ bir hücre risk taşıyorsa satırı reddet.
    for (const hucre of satir) {
      if (hucre.length > IMPORT_LIMITLERI.maxHucreUzunluk) {
        satirHatalari.push({ satir: satirNo, kod: "HUCRE_COK_UZUN", neden: "Hücre uzunluk sınırını aşıyor." });
        return;
      }
      if (formulaRiski(hucre)) {
        satirHatalari.push({
          satir: satirNo,
          kod: "FORMULA_INJECTION",
          neden: `Hücre formül olarak yorumlanabilecek bir karakterle başlıyor: ${JSON.stringify(hucre.slice(0, 8))}`,
        });
        return;
      }
    }

    const oku = (k: string) => alan(basliklar, satir, k).trim();
    const externalSubjectId = oku("external_subject_id");
    const subjectTypeRaw = oku("subject_type").toUpperCase();
    const activityCode = oku("activity_code");
    const systemCode = oku("system_code");
    const validFrom = oku("valid_from");
    const source = oku("source");
    const sourceRecordId = oku("source_record_id");

    for (const [ad, deger] of [
      ["external_subject_id", externalSubjectId],
      ["activity_code", activityCode],
      ["system_code", systemCode],
      ["valid_from", validFrom],
      ["source", source],
      ["source_record_id", sourceRecordId],
    ] as const) {
      if (deger === "") {
        satirHatalari.push({ satir: satirNo, kod: "ZORUNLU_ALAN_BOS", neden: `Zorunlu alan boş: ${ad}` });
        return;
      }
    }

    if (subjectTypeRaw !== "USER" && subjectTypeRaw !== "SERVICE_ACCOUNT" && subjectTypeRaw !== "GROUP") {
      satirHatalari.push({ satir: satirNo, kod: "GECERSIZ_SUBJECT_TYPE", neden: `Geçersiz subject_type: ${subjectTypeRaw}` });
      return;
    }

    const validTo = oku("valid_to") || null;
    if (!gecerliTarih(validFrom) || (validTo !== null && !gecerliTarih(validTo))) {
      satirHatalari.push({ satir: satirNo, kod: "GECERSIZ_TARIH", neden: "valid_from/valid_to geçerli bir tarih değil (YYYY-MM-DD)." });
      return;
    }

    const emailRaw = oku("email");
    kayitlar.push({
      externalSubjectId,
      subjectType: subjectTypeRaw,
      displayName: oku("display_name") || null,
      // E-posta değişmez kimlik DEĞİL (kurucu §9): yalnız gösterim/ipucu; küçük harfe indirilir.
      email: emailRaw ? emailRaw.toLowerCase() : null,
      roleCode: oku("role_code") || null,
      activityCode,
      systemCode,
      validFrom,
      validTo,
      source,
      sourceRecordId,
    });

    const anahtar = anahtarKur(source, sourceRecordId);
    anahtarSatirlari.set(anahtar, [...(anahtarSatirlari.get(anahtar) ?? []), satirNo]);
  });
  const kayitByAnahtar = new Map<string, SodAssignmentImportRecord>();
  for (const r of kayitlar) kayitByAnahtar.set(anahtarKur(r.source, r.sourceRecordId), r);
  const duplicateler = [...anahtarSatirlari.entries()]
    .filter(([, satirlar]) => satirlar.length > 1)
    .map(([anahtar, satirlar]) => {
      const r = kayitByAnahtar.get(anahtar);
      return { source: r?.source ?? "", sourceRecordId: r?.sourceRecordId ?? "", satirlar };
    });

  // DETERMİNİZM: doğal anahtara göre sırala — giriş sırası çıktıyı etkilemesin.
  kayitlar.sort((a, b) => {
    const ka = anahtarKur(a.source, a.sourceRecordId);
    const kb = anahtarKur(b.source, b.sourceRecordId);
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });

  return { kayitlar, satirHatalari, duplicateler };
}

function gecerliTarih(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  return !Number.isNaN(d.getTime());
}

/** Ham dosya baytlarının hash'i (fileHash). */
export function dosyaHash(bytes: Uint8Array): Promise<string> {
  return bytesHash(bytes);
}

/** Normalize edilmiş kayıtların kanonik hash'i (normalizedRecordsHash). */
export function kayitlarHash(kayitlar: SodAssignmentImportRecord[]): Promise<string> {
  return canonicalHash(kayitlar as unknown as CanonicalDeger);
}

// --- Diff (mevcut atamalarla) ---

/** Mevcut bir atamanın diff için gereken alanları. */
export interface MevcutAtama {
  source_record_id: string | null;
  kaynak_sistem: string; // = source
  aktivite_kodu: string;
  rol_kodu: string | null;
  sistem_kapsami: string;
  gecerlilik_baslangic: string;
  gecerlilik_bitis: string | null;
}

export interface DiffKalemi {
  record: SodAssignmentImportRecord;
  onceki?: MevcutAtama;
}

export interface ImportDiff {
  eklenecek: SodAssignmentImportRecord[];
  guncellenecek: DiffKalemi[];
  degismeyecek: SodAssignmentImportRecord[];
  /** Yalnız AUTHORITATIVE_SNAPSHOT modunda dolu. */
  sonaErdirilecek: MevcutAtama[];
}

/**
 * Gelen kayıtlarla mevcut atamaların farkını hesaplar. Fiziksel silme YOK:
 * SNAPSHOT modunda kaynakta artık olmayan atamalar "sona erdirilecek"
 * kümesine düşer (validTo atanır) — apply PR-3B'de.
 *
 * ANAHTAR: (source, sourceRecordId). Mevcut atamalar bu anahtarla eşlenir;
 * source_record_id'si olmayan (import öncesi elle/eski) atamalar EŞLEŞMEZ ve
 * SNAPSHOT sona-erdirmesine dahil EDİLMEZ — yalnızca AYNI kaynağın kayıtları
 * bir başka kaynağın snapshot'ından etkilenmez (kurucu §11).
 *
 * `snapshotKaynak`: AUTHORITATIVE_SNAPSHOT modunun otoriter olduğu kaynak.
 * Import-SEVİYESİ bir parametredir (kayıtlardan türetilmez) — çünkü BOŞ bir
 * snapshot "bu kaynağın artık ataması yok" demektir ve o kaynağın tüm
 * atamalarını sona erdirmelidir; kaynak boş kayıtlardan okunamaz. DELTA
 * modunda kullanılmaz.
 */
export function diffHesapla(
  kayitlar: SodAssignmentImportRecord[],
  mevcutAtamalar: MevcutAtama[],
  mode: ImportMode,
  snapshotKaynak?: string,
): ImportDiff {
  const mevcutByKey = new Map<string, MevcutAtama>();
  for (const a of mevcutAtamalar) {
    if (a.source_record_id !== null) {
      mevcutByKey.set(anahtarKur(a.kaynak_sistem, a.source_record_id), a);
    }
  }

  const eklenecek: SodAssignmentImportRecord[] = [];
  const guncellenecek: DiffKalemi[] = [];
  const degismeyecek: SodAssignmentImportRecord[] = [];
  const gelenAnahtarlar = new Set<string>();

  for (const r of kayitlar) {
    const anahtar = anahtarKur(r.source, r.sourceRecordId);
    gelenAnahtarlar.add(anahtar);
    const onceki = mevcutByKey.get(anahtar);
    if (!onceki) {
      eklenecek.push(r);
    } else if (atamaAyni(r, onceki)) {
      degismeyecek.push(r);
    } else {
      guncellenecek.push({ record: r, onceki });
    }
  }

  const sonaErdirilecek: MevcutAtama[] = [];
  if (mode === "AUTHORITATIVE_SNAPSHOT" && snapshotKaynak) {
    // Otoriter kaynağa ait, gelende OLMAYAN, hâlâ AKTİF atamalar. Kaynak
    // import-seviyesi parametredir (boş dosya = o kaynağı boşalt).
    for (const a of mevcutAtamalar) {
      if (a.source_record_id === null) continue;
      if (a.kaynak_sistem !== snapshotKaynak) continue; // başka kaynağa dokunma
      const anahtar = anahtarKur(a.kaynak_sistem, a.source_record_id);
      if (!gelenAnahtarlar.has(anahtar) && a.gecerlilik_bitis === null) {
        sonaErdirilecek.push(a);
      }
    }
  }

  return { eklenecek, guncellenecek, degismeyecek, sonaErdirilecek };
}

function atamaAyni(r: SodAssignmentImportRecord, a: MevcutAtama): boolean {
  return (
    r.activityCode === a.aktivite_kodu &&
    (r.roleCode ?? null) === a.rol_kodu &&
    r.systemCode === a.sistem_kapsami &&
    r.validFrom === a.gecerlilik_baslangic &&
    (r.validTo ?? null) === a.gecerlilik_bitis
  );
}

/**
 * Önizleme BAYAT mı: apply anındaki atama snapshot hash'i, önizleme
 * anındakinden farklıysa eski önizleme uygulanamaz (kurucu §7, 409
 * IMPORT_PREVIEW_STALE). Mantık burada saf; route/apply bunu zorlar (PR-3B).
 */
export function onizlemeBayatMi(
  onizlemeSnapshotHash: string,
  guncelSnapshotHash: string,
  onizlemeRuleSetVersion: string,
  guncelRuleSetVersion: string,
): boolean {
  return (
    onizlemeSnapshotHash !== guncelSnapshotHash ||
    onizlemeRuleSetVersion !== guncelRuleSetVersion
  );
}
