// Yetkinlik saf yardımcıları (M18, G8; kural 11).

/** Sınav geçme (deterministik): skor >= eşik. */
export function sinavGecti(skor: number, esik: number): boolean {
  return skor >= esik;
}

export interface AtamaDurumu {
  kullaniciAd: string;
  gereksinimAd: string;
  durum: string;
  sonTarih: string | null;
  gecti: boolean | null;
}

export interface YetkinlikBoslugu {
  /** Süresi geçmiş, tamamlanmamış veya kalınmış atamalar (boşluk). */
  bosluklar: AtamaDurumu[];
  /** Tamamlanma oranı (0..1). */
  tamamlanmaOrani: number;
}

/**
 * Yetkinlik boşluğu: atanmış ama tamamlanmamış/kalınmış (özellikle süresi
 * geçmiş) eğitimler. Deterministik; `simdi` parametre.
 */
export function yetkinlikBoslugu(atamalar: AtamaDurumu[], simdi: string | Date): YetkinlikBoslugu {
  const gun = (typeof simdi === "string" ? new Date(simdi) : simdi).toISOString().slice(0, 10);
  const bosluklar = atamalar.filter((a) => {
    const gecikti = a.sonTarih !== null && a.sonTarih < gun;
    const tamamlanmadi = a.durum !== "TAMAMLANDI" || a.gecti === false;
    return tamamlanmadi && (gecikti || a.gecti === false);
  });
  const tamam = atamalar.filter((a) => a.durum === "TAMAMLANDI" && a.gecti !== false).length;
  return {
    bosluklar: [...bosluklar].sort((a, b) => `${a.kullaniciAd}|${a.gereksinimAd}`.localeCompare(`${b.kullaniciAd}|${b.gereksinimAd}`)),
    tamamlanmaOrani: atamalar.length === 0 ? 1 : tamam / atamalar.length,
  };
}
