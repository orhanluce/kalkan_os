// AI olay (incident) + değerlendirme (eval) saf yardımcıları (M37 sonraki dilim;
// kural 11). EU AI Act Art. 73 ciddi-olay bildirimi + eval sonuç DÜRÜSTLÜĞÜ.
//
// KURAL 13: eval sonucu birleştirilmez — PASSED ≠ FAILED ≠ UNKNOWN. Ölçüm
// yapılmadıysa UNKNOWN (başarısız DEĞİL); connector/ölçüm arızası FAILED üretmez.

export type EvalSonuc = "PASSED" | "FAILED" | "UNKNOWN";
export type OlayCiddiyet = "DUSUK" | "ORTA" | "YUKSEK" | "KRITIK";
export type OlayDurum = "ACIK" | "INCELENIYOR" | "KAPANDI";

export interface EvalKayit {
  tur: string;
  sonuc: EvalSonuc;
  degerlendirme_at: string;
}

export interface EvalOzeti {
  /** Tür başına EN SON sonuç (tarihe göre). */
  turSonuc: Record<string, EvalSonuc>;
  failedVar: boolean;
  /** ÖLÇÜLMEMİŞ (UNKNOWN) tür var mı — kural 13: "başarısız" ile karıştırılmaz. */
  unknownVar: boolean;
}

/**
 * Tür başına en son eval sonucunu türetir. BİRLEŞTİRMEZ (kural 13): FAILED ve
 * UNKNOWN ayrı raporlanır — tek bir "güvence puanı" verilmez.
 */
export function evalOzeti(evals: EvalKayit[]): EvalOzeti {
  const enSon = new Map<string, EvalKayit>();
  for (const e of evals) {
    const mevcut = enSon.get(e.tur);
    if (!mevcut || e.degerlendirme_at > mevcut.degerlendirme_at) enSon.set(e.tur, e);
  }
  const turSonuc: Record<string, EvalSonuc> = {};
  let failedVar = false;
  let unknownVar = false;
  for (const [tur, e] of enSon) {
    turSonuc[tur] = e.sonuc;
    if (e.sonuc === "FAILED") failedVar = true;
    if (e.sonuc === "UNKNOWN") unknownVar = true;
  }
  return { turSonuc, failedVar, unknownVar };
}

export interface OlayKayit {
  ciddiyet: OlayCiddiyet;
  durum: OlayDurum;
}

export interface OlayOzeti {
  acikSayisi: number;
  /** Açık (KAPANDI olmayan) YÜKSEK/KRİTİK olay var mı — ciddi olay sinyali. */
  acikCiddiVar: boolean;
  ciddiyetSayisi: Record<OlayCiddiyet, number>;
}

/** Açık AI olaylarının özeti (ciddi = YÜKSEK/KRİTİK). Deterministik. */
export function aiOlayOzeti(olaylar: OlayKayit[]): OlayOzeti {
  const ciddiyetSayisi: Record<OlayCiddiyet, number> = { DUSUK: 0, ORTA: 0, YUKSEK: 0, KRITIK: 0 };
  let acikSayisi = 0;
  let acikCiddiVar = false;
  for (const o of olaylar) {
    ciddiyetSayisi[o.ciddiyet] += 1;
    if (o.durum !== "KAPANDI") {
      acikSayisi += 1;
      if (o.ciddiyet === "YUKSEK" || o.ciddiyet === "KRITIK") acikCiddiVar = true;
    }
  }
  return { acikSayisi, acikCiddiVar, ciddiyetSayisi };
}
