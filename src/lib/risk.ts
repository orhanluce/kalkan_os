// Risk nicelendirme saf yardımcıları (M40, G8; kural 11).
// CRQ İLKESİ: SAHTE KESİNLİK YOK — kayıp bir DAĞILIM, tek puan değil; her özet
// bir model tahminidir (belirsizlik notu taşır).

/** KRI okuması eşiği aşıyor mu (yön: UST = üstü ihlal, ALT = altı ihlal). */
export function kriIhlali(deger: number, esik: number, yon: "UST" | "ALT"): boolean {
  return yon === "UST" ? deger > esik : deger < esik;
}

export interface DagilimOzeti {
  /** Beklenen değer (üçgensel ortalama = (min+olası+max)/3). */
  beklenen: number;
  /** Yaklaşık P90 (üçgenselde üst kuyruk — model tahmini). */
  yaklasikP90: number;
  aralik: [number, number];
  uyari: string;
}

/**
 * Üçgensel kayıp dağılımı özeti (min/olası/max). TEK PUAN vermez — beklenen
 * değer + üst kuyruk + tam aralık + belirsizlik uyarısı döndürür. Deterministik.
 */
export function ucgenselOzet(min: number, olasi: number, max: number): DagilimOzeti {
  const beklenen = (min + olasi + max) / 3;
  // Üçgensel dağılımda F(x)=0.9 için üst kol çözümü (olası..max aralığında):
  // x = max - sqrt((1-p)*(max-min)*(max-olası)), p=0.9.
  const p = 0.9;
  const ustKol = max - Math.sqrt((1 - p) * (max - min) * (max - olasi));
  const yaklasikP90 = max === min ? max : ustKol;
  return {
    beklenen,
    yaklasikP90,
    aralik: [min, max],
    uyari: "Model tahmini — tek kesin sayı değil; varsayımlara bağlı belirsizlik taşır.",
  };
}

/**
 * Kontrol fayda oranı: birim maliyet başına risk azaltımı. Maliyet 0/negatif
 * ya da azaltım yoksa null (bölme uydurulmaz).
 */
export function kontrolFaydaOrani(maliyet: number | null, azaltma: number | null): number | null {
  if (maliyet === null || azaltma === null || maliyet <= 0) return null;
  return azaltma / maliyet;
}
