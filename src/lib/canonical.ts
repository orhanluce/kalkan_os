// Kanonik JSON ve hash şema sürümleri (docs/ROADMAP.md M9).
//
// NEDEN RFC 8785 (JCS): bütünlük iddiasının tamamı "aynı veri her yerde aynı
// bayt dizisine serileşir" varsayımına dayanır. Buradaki eski uygulama (önce
// evidence-envelope.ts'teydi) anahtarları sıralıyordu ve bizim veri tiplerimiz
// için pratikte doğru çıktı veriyordu — ama YAZILI BİR STANDARDA değil,
// JSON.stringify'ın davranışına yaslanıyordu. Bağımsız bir denetçi hash'i
// Python/Java/Go ile yeniden hesaplayacaksa, dayanacağı şey "JS böyle yapıyor"
// olamaz. RFC 8785 o yazılı spesifikasyon; aşağısı onun uygulamasıdır.
//
// NEDEN KÜTÜPHANE DEĞİL: `canonicalize` (RFC 8785 referans implementasyonu)
// önce runtime bağımlılığı olarak eklendi, sonra çıkarıldı. Sebep somut: o
// paket yalnızca `import` koşulu tanımlıyor, bu repo ise CJS (package.json'da
// `type` yok) — tsx ile koşan script'ler onu ÇÖZEMİYOR
// (ERR_PACKAGE_PATH_NOT_EXPORTED). Bu ürünün tüm iddiası bağımsız doğrulama;
// denetçinin koşturacağı bir script'in hash'i hesaplayamaması, iddianın
// kendisini boşa çıkarırdı. Runtime bağımlılığı olmaması kural 4'e de uygun.
//
// PEKİ "KENDİ UYGULAMAMIZ" NEDEN ESKİSİNDEN FARKLI: eskisi bir standart iddia
// etmiyordu ve uygunluğu hiç sınanmamıştı. Bu, RFC 8785'i açıkça uyguluyor VE
// referans implementasyon devDependency olarak testte HAKEM duruyor:
// canonical.test.ts, çıktımızın referansla birebir aynı olduğunu bir külliyat
// üzerinde (kayan nokta, unicode, emoji, kontrol karakteri, anahtar sırası)
// doğruluyor. Uygunluk iddiası "bize güvenin"e değil, çalışan bir
// karşılaştırmaya dayanıyor.

import { sha256Hex } from "./evidence";

/**
 * Hash ŞEMA SÜRÜMLERİ.
 *
 * NEDEN HASH'LENEN VERİNİN İÇİNDE: bir hash'i doğrulayan taraf, onu HANGİ
 * kurallarla yeniden hesaplayacağını bilmek zorunda. Sürümü dışarıda tutsaydık
 * (ör. yalnızca DB kolonunda), hash'i elinde olan ama bağlamı olmayan bir
 * denetçi yanlış kuralla hesaplayıp "eşleşmiyor" derdi — ve bu, kurcalama ile
 * sürüm farkını ayırt edilemez hale getirirdi.
 *
 * Alan yapısı veya kanonikleştirme kuralı değişirse sürümü ARTIR; eski
 * kayıtlar eski sürümle doğrulanmaya devam etsin.
 */
export const REPORT_DATA_SCHEMA = "KALKAN_REPORT_DATA_V1";
export const CORE_MANIFEST_SCHEMA = "KALKAN_CORE_MANIFEST_V1";
export const PACKAGE_MANIFEST_SCHEMA = "KALKAN_PACKAGE_MANIFEST_V1";
export const EVIDENCE_ENVELOPE_SCHEMA = "KALKAN_EVIDENCE_ENVELOPE_V1";

export type CanonicalDeger =
  | string
  | number
  | boolean
  | null
  | CanonicalDeger[]
  | { [anahtar: string]: CanonicalDeger };

/**
 * RFC 8785 (JSON Canonicalization Scheme) temsili.
 *
 * KURALLAR ve nereden geldikleri:
 *   - Nesne anahtarları UTF-16 kod birimine göre sıralanır (JCS §3.2.3).
 *     JS'in varsayılan string sıralaması zaten UTF-16 kod birimidir.
 *   - Dizi SIRASI korunur: sıra çağıranın verisidir, sıralamak veriyi
 *     değiştirmek olurdu.
 *   - Sayılar ECMAScript Number::toString ile yazılır (JCS §3.2.2.3) —
 *     JSON.stringify tam olarak bunu yapar, yani 10.0 -> "10".
 *   - String'ler JSON escape kurallarıyla yazılır (JCS §3.2.2.2): JSON.
 *     stringify'ın kaçışlaması bununla örtüşür (kontrol karakterleri \uXXXX,
 *     geri kalanı ham).
 *   - Boşluk yok.
 *
 * NaN/Infinity REDDEDİLİR: JCS bunları yasaklar (JSON'da karşılıkları yok).
 * Sessizce `null`a çevirmek (JSON.stringify'ın yaptığı) bir sayıyı yokluğa
 * dönüştürüp hash'e sokardı.
 *
 * `undefined` REDDEDİLİR: JSON'da düşer, yani `{a: undefined}` ile `{}` aynı
 * hash'i verirdi. Hash'lenemeyen bir şeyi hash'lemiş gibi yapmak, bütünlük
 * iddiasını sahteleştirir. Manifest tiplerinde "değer yok" her zaman `null`.
 */
export function canonicalJson(value: CanonicalDeger): string {
  if (value === undefined) {
    throw new Error("canonicalJson: undefined serileştirilemez (null kullan)");
  }
  if (value === null) return "null";

  const tip = typeof value;

  if (tip === "boolean") return value ? "true" : "false";

  if (tip === "number") {
    if (!Number.isFinite(value as number)) {
      throw new Error(`canonicalJson: sayi JCS'te gecersiz: ${String(value)}`);
    }
    return JSON.stringify(value);
  }

  if (tip === "string") return JSON.stringify(value);

  if (Array.isArray(value)) {
    return `[${value.map((v) => canonicalJson(v)).join(",")}]`;
  }

  if (tip === "object") {
    const nesne = value as { [k: string]: CanonicalDeger };
    const anahtarlar = Object.keys(nesne).sort();
    const parcalar = anahtarlar.map((k) => {
      const v = nesne[k];
      if (v === undefined) {
        // Sessizce atlamak, alanı hiç yokmuş gibi gösterirdi.
        throw new Error(`canonicalJson: '${k}' alani undefined (null kullan)`);
      }
      return `${JSON.stringify(k)}:${canonicalJson(v)}`;
    });
    return `{${parcalar.join(",")}}`;
  }

  throw new Error(`canonicalJson: serilestirilemeyen tip: ${tip}`);
}

/** Kanonik temsilin SHA-256'sı (hex). Bütün manifest hash'lerinin tek kapısı. */
export function canonicalHash(value: CanonicalDeger): Promise<string> {
  return sha256Hex(new TextEncoder().encode(canonicalJson(value)).buffer as ArrayBuffer);
}

/** Ham baytların SHA-256'sı — PDF/ZIP gibi dosyalar için. */
export function bytesHash(data: Uint8Array): Promise<string> {
  return sha256Hex(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer);
}

/**
 * Tarihleri tek biçime sabitler: UTC, RFC 3339, milisaniyeli.
 *
 * NEDEN: Postgres timestamptz'yi "+00:00" ile, JS toISOString "Z" ile yazar;
 * ikisi aynı ANI gösterir ama farklı STRING'dir, dolayısıyla farklı hash.
 * Aynı tatbikatın hash'i, veriyi hangi katmandan okuduğumuza göre değişirdi.
 */
export function kanonikZaman(iso: string | null): string | null {
  if (iso === null) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) throw new Error(`kanonikZaman: geçersiz tarih: ${iso}`);
  return d.toISOString(); // her zaman UTC + "Z" + milisaniye
}

/**
 * Sayıları kanonik hale getirir: tam sayıya yuvarlanabilenler tam sayı olur.
 *
 * NEDEN: Postgres `numeric` JS'e string ya da float olarak gelebilir
 * (`agirlik: "10"` vs `10` vs `10.0`). RFC 8785 sayıları ECMAScript kuralıyla
 * yazar, yani 10.0 → "10"; ama "10" (string) → "\"10\"" olur ve hash değişir.
 * Tip dönüşümünü hash'e bırakmak yerine burada sabitliyoruz.
 */
export function kanonikSayi(deger: number | string): number {
  const n = typeof deger === "number" ? deger : Number(deger);
  if (!Number.isFinite(n)) throw new Error(`kanonikSayi: sayıya çevrilemedi: ${deger}`);
  return n;
}
