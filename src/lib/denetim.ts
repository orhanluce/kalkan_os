// Denetim örnekleme saf motoru (M17, G8; kural 11: deterministik, seed'li).
//
// TEKRARLANABİLİRLİK: aynı (popülasyon, boyut, seed) HER ZAMAN aynı seçimi
// verir — denetçi seed'i alıp seçimi bağımsız yeniden üretebilir (Math.random
// YOK). Seçim, her indeksin `${seed}:${i}` FNV-1a hash'ine göre sıralanıp ilk
// k'nın alınmasıyla yapılır (uniform-benzeri, deterministik).

/** FNV-1a 32-bit (senkron, deterministik). */
function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Popülasyondan (0..n-1) `boyut` kadar deterministik örnek indeksi seçer.
 * Sonuç ARTAN sırada döner (istikrarlı gösterim). Aynı seed → aynı seçim.
 */
export function ornekIndeksleriSec(populasyon: number, boyut: number, seed: string): number[] {
  const k = Math.max(0, Math.min(boyut, populasyon));
  if (k === 0 || populasyon === 0) return [];
  const indeksler = Array.from({ length: populasyon }, (_, i) => i);
  // Her indeksi hash'ine göre sırala; eşitlikte indeksle stabilize et.
  indeksler.sort((a, b) => {
    const ha = fnv1a(`${seed}:${a}`);
    const hb = fnv1a(`${seed}:${b}`);
    return ha === hb ? a - b : ha - hb;
  });
  return indeksler.slice(0, k).sort((a, b) => a - b);
}

/**
 * Denetçi yeniden üretim doğrulaması: kayıtlı seçim, aynı girdiyle yeniden
 * hesaplanan seçimle birebir aynı mı?
 */
export function ornekYenidenUretilebilir(
  populasyon: number,
  boyut: number,
  seed: string,
  kayitliSecim: number[],
): boolean {
  const yeniden = ornekIndeksleriSec(populasyon, boyut, seed);
  return yeniden.length === kayitliSecim.length && yeniden.every((v, i) => v === [...kayitliSecim].sort((a, b) => a - b)[i]);
}
