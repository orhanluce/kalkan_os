// Dikey G1 (docs/adr/PR0-dikeyG-g1-pilot-provisioning-onboarding-2026-07-22.md):
// pilot kurumun kritik hizmet/kontrol/tedarikçi verisini İÇE AKTARMASI için
// güvenli CSV ayrıştırma + normalize. sod-import.ts'in AYNI güvenlik
// disiplinini (RFC4180, BOM, null-byte, boyut sınırları) tekrarlar — ama
// üç FARKLI domain şeması (SoD'nin kendi zorunlu kolonlarına kilitli) için
// parametrik bir versiyon; üçüncü bir "atama" motoru DEĞİL, üç farklı basit
// varlık listesi (kural: her domain kendi şemasını taşır, aynı disiplinle).
//
// SALT OKUR: bu modül HİÇBİR kaydı yazmaz — yalnız ayrıştırır + doğrular +
// hash'ler. Gerçek yazım `onboarding_import_uygula` RPC'sinin işi (tek
// transaction, maker-checker guard'lı).

export const ONBOARDING_IMPORT_LIMITLERI = {
  maxBayt: 2 * 1024 * 1024, // 2 MB — pilot ölçeğinde CSV'ler küçüktür
  maxSatir: 5_000,
  maxKolon: 20,
  maxHucreUzunluk: 1_000,
} as const;

export type OnboardingEntityTuru = "KRITIK_HIZMET" | "KONTROL" | "TEDARIKCI";

const ZORUNLU_KOLONLAR: Record<OnboardingEntityTuru, readonly string[]> = {
  KRITIK_HIZMET: ["ad"],
  KONTROL: ["madde_ref"],
  TEDARIKCI: ["ad"],
};

interface DosyaHatasi {
  kod:
    | "COK_BUYUK"
    | "NULL_BYTE"
    | "BOS_DOSYA"
    | "COK_FAZLA_KOLON"
    | "YINELENEN_BASLIK"
    | "EKSIK_ZORUNLU_KOLON"
    | "COK_FAZLA_SATIR"
    | "FORMULA_INJECTION";
  neden: string;
}

export interface SatirHatasi {
  satir: number; // 1-tabanlı veri satırı (başlık hariç)
  neden: string;
}

export interface OnboardingImportKaydi {
  ad?: string;
  madde_ref?: string;
  durum?: string;
  hizmet_ozeti?: string;
}

export interface OnboardingImportAyristirmaSonucu {
  kayitlar: OnboardingImportKaydi[];
  satirHatalari: SatirHatasi[];
  dosyaHatasi: DosyaHatasi | null;
}

function bomTemizle(metin: string): string {
  return metin.charCodeAt(0) === 0xfeff ? metin.slice(1) : metin;
}

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

// Excel/Sheets formula-injection reddi (SoD'nin AYNI kuralı): bir hücre
// =/+/-/@ ile başlıyorsa dosya bütünüyle reddedilir (tek satır değil —
// saldırı niyeti dosya çapında değerlendirilir).
function formulaEnjeksiyonuVarMi(satirlar: string[][]): boolean {
  return satirlar.some((satir) => satir.some((hucre) => /^[=+\-@]/.test(hucre.trim())));
}

/** Ham dosya (bayt/metin) güvenlik + yapısal doğrulama, sonra ayrıştırma. */
function csvAyristir(
  entityTuru: OnboardingEntityTuru,
  metin: string,
  byteUzunluk: number,
): { basliklar: string[]; satirlar: string[][]; dosyaHatasi: DosyaHatasi | null } {
  const bos = { basliklar: [], satirlar: [] };

  if (byteUzunluk > ONBOARDING_IMPORT_LIMITLERI.maxBayt) {
    return { ...bos, dosyaHatasi: { kod: "COK_BUYUK", neden: "Dosya boyut sınırını aşıyor." } };
  }
  if (metin.includes("\0")) {
    return { ...bos, dosyaHatasi: { kod: "NULL_BYTE", neden: "Dosya null byte içeriyor." } };
  }

  const temiz = bomTemizle(metin);
  const tumSatirlar = temiz.split(/\r\n|\n|\r/).filter((s, i, arr) => !(s === "" && i === arr.length - 1));
  if (tumSatirlar.length === 0 || (tumSatirlar.length === 1 && tumSatirlar[0].trim() === "")) {
    return { ...bos, dosyaHatasi: { kod: "BOS_DOSYA", neden: "Dosya boş." } };
  }

  const basliklar = csvSatirAyristir(tumSatirlar[0]).map((h) => h.trim().toLowerCase());
  if (basliklar.length > ONBOARDING_IMPORT_LIMITLERI.maxKolon) {
    return { ...bos, dosyaHatasi: { kod: "COK_FAZLA_KOLON", neden: "Kolon sayısı sınırı aşıldı." } };
  }
  if (new Set(basliklar).size !== basliklar.length) {
    return { ...bos, dosyaHatasi: { kod: "YINELENEN_BASLIK", neden: "Yinelenen başlık var." } };
  }
  const eksik = ZORUNLU_KOLONLAR[entityTuru].filter((k) => !basliklar.includes(k));
  if (eksik.length > 0) {
    return { ...bos, dosyaHatasi: { kod: "EKSIK_ZORUNLU_KOLON", neden: `Eksik zorunlu kolon: ${eksik.join(", ")}` } };
  }

  const veriSatirlari = tumSatirlar.slice(1).filter((s) => s.trim() !== "");
  if (veriSatirlari.length > ONBOARDING_IMPORT_LIMITLERI.maxSatir) {
    return { ...bos, dosyaHatasi: { kod: "COK_FAZLA_SATIR", neden: "Satır sayısı sınırı aşıldı." } };
  }

  const satirlar = veriSatirlari.map(csvSatirAyristir);
  if (formulaEnjeksiyonuVarMi(satirlar)) {
    return { ...bos, dosyaHatasi: { kod: "FORMULA_INJECTION", neden: "Dosyada formül enjeksiyonu şüphesi (=/+/-/@ ile başlayan hücre)." } };
  }

  return { basliklar, satirlar, dosyaHatasi: null };
}

function alan(basliklar: string[], satir: string[], kolon: string): string {
  const i = basliklar.indexOf(kolon);
  return i >= 0 && i < satir.length ? satir[i].trim() : "";
}

/**
 * CSV metnini ayrıştırır + doğrular. DETERMİNİSTİK: çıktı satır sırasına
 * göredir (giriş sırası korunur — bu domain'de "doğal anahtar" yok, tekilleşme
 * apply anında DB unique constraint'iyle sağlanır, burada değil).
 */
export function onboardingImportAyristir(
  entityTuru: OnboardingEntityTuru,
  metin: string,
  byteUzunluk: number,
): OnboardingImportAyristirmaSonucu {
  const { basliklar, satirlar, dosyaHatasi } = csvAyristir(entityTuru, metin, byteUzunluk);
  if (dosyaHatasi) return { kayitlar: [], satirHatalari: [], dosyaHatasi };

  const kayitlar: OnboardingImportKaydi[] = [];
  const satirHatalari: SatirHatasi[] = [];

  satirlar.forEach((satir, idx) => {
    const satirNo = idx + 1;
    if (satir.some((h) => h.length > ONBOARDING_IMPORT_LIMITLERI.maxHucreUzunluk)) {
      satirHatalari.push({ satir: satirNo, neden: "Hücre uzunluk sınırını aşıyor." });
      return;
    }

    if (entityTuru === "KRITIK_HIZMET" || entityTuru === "TEDARIKCI") {
      const ad = alan(basliklar, satir, "ad");
      if (!ad) {
        satirHatalari.push({ satir: satirNo, neden: "'ad' alanı boş olamaz." });
        return;
      }
      kayitlar.push({
        ad,
        ...(entityTuru === "KRITIK_HIZMET" ? { durum: alan(basliklar, satir, "durum") || undefined } : {}),
        ...(entityTuru === "TEDARIKCI" ? { hizmet_ozeti: alan(basliklar, satir, "hizmet_ozeti") || undefined } : {}),
      });
    } else {
      const maddeRef = alan(basliklar, satir, "madde_ref");
      if (!maddeRef) {
        satirHatalari.push({ satir: satirNo, neden: "'madde_ref' alanı boş olamaz." });
        return;
      }
      kayitlar.push({ madde_ref: maddeRef });
    }
  });

  return { kayitlar, satirHatalari, dosyaHatasi: null };
}
