// IBAN maskeleme + hash (V2 PR-3a, ADR-V2-4). VERİ MİNİMİZASYONU: tam IBAN
// hiçbir zaman saklanmaz — bu modül gösterim için MASKE ve eşleştirme için
// referans HASH üretir. Tam IBAN yalnız kullanıcının tarayıcısında (yazdığı
// an) bulunur; sunucuya/DB'ye yalnız maske + hash gider.
//
// SAF ve DETERMİNİSTİK (kural 11): aynı IBAN her zaman aynı normalize/maske/
// hash. Hash sha256(normalize) — geri döndürülemez, ama aynı IBAN'ı tanır
// (tedarikçi tekrar aynı hesaba dönerse eşleşir).

import { canonicalHash } from "./canonical";

/** Boşluk/tire temizler, büyük harfe indirir — hash ve karşılaştırma için. */
export function ibanNormalize(iban: string): string {
  return iban.replace(/[\s-]/g, "").toUpperCase();
}

/** Geçerli biçim mi (ülke kodu + 2 kontrol + 10-30 alfanümerik). Ağ/mod-97
 * doğrulaması KAPSAM DIŞI (KALKAN_OS ödeme yapmaz) — yalnız kaba biçim. */
export function ibanBicimGecerliMi(iban: string): boolean {
  return /^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(ibanNormalize(iban));
}

/**
 * Maskeli gösterim: ülke kodu + ilk 2 kontrol hanesi görünür, orta '*',
 * SON 4 karakter görünür. Ör. TR33 0006 ... 1234 → "TR33 **** **** **34".
 * Son 4, doğru hesabın teyidi için yeterli ipucudur; gerisi gizli.
 */
export function ibanMaskele(iban: string): string {
  const n = ibanNormalize(iban);
  if (n.length < 8) return "****";
  const bas = n.slice(0, 4);
  const son = n.slice(-4);
  const yildizSayisi = Math.max(1, n.length - 8);
  return `${bas} ${"*".repeat(yildizSayisi)} ${son}`;
}

/** Referans hash'i: sha256(normalize(iban)). Tam değeri VERMEZ; aynı IBAN'ı tanır. */
export function ibanHash(iban: string): Promise<string> {
  return canonicalHash(ibanNormalize(iban));
}
