// AI olay (incident) + değerlendirme (eval) saf yardımcıları (M37 sonraki dilim;
// kural 11). EU AI Act Art. 73 ciddi-olay bildirimi + eval sonuç DÜRÜSTLÜĞÜ.
//
// KURAL 13: eval sonucu birleştirilmez — PASSED ≠ FAILED ≠ UNKNOWN. Ölçüm
// yapılmadıysa UNKNOWN (başarısız DEĞİL); connector/ölçüm arızası FAILED üretmez.

import { canonicalHash, type CanonicalDeger } from "./canonical";

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

// --- AI olay kapanış manifesti (nihai v3.3 §8.0 Dikey 1, madde 2) ---
// Mevcut outbox/defter mekanizması (ledger-outbox.ts) BU manifesti kullanarak
// mühürler; yeni bir defter/outbox altyapısı KURULMAZ.

export const AI_INCIDENT_CLOSURE_SCHEMA = "KALKAN_AI_INCIDENT_CLOSURE_MANIFEST_V1" as const;
export const AI_INCIDENT_CLOSURE_KIND = "AI_INCIDENT_CLOSURE" as const;

export interface AiIncidentClosureManifest {
  schema: typeof AI_INCIDENT_CLOSURE_SCHEMA;
  incidentId: string;
  aiSystemId: string;
  ciddiyet: OlayCiddiyet;
  kapanisKanit: string;
  kapatan: string;
  kapanisZamani: string;
}

export function aiIncidentClosureManifestKur(args: {
  incidentId: string;
  aiSystemId: string;
  ciddiyet: OlayCiddiyet;
  kapanisKanit: string;
  kapatan: string;
  kapanisZamani: string;
}): AiIncidentClosureManifest {
  return { schema: AI_INCIDENT_CLOSURE_SCHEMA, ...args };
}

export function aiIncidentClosureManifestHash(m: AiIncidentClosureManifest): Promise<string> {
  return canonicalHash(m as unknown as CanonicalDeger);
}

// --- Drift değerlendirme (nihai v3.3 §8.0 Dikey 4; kural 11) ---
// Eşik KOD SABİTİ DEĞİLDİR — çağıran (kurumun sürümlü politikası) sağlar.
// Sonuç: eşik yoksa DEGERLENDIRILEMEDI (UNKNOWN ruhu — eşiksiz "aşıldı" denmez).

export type DriftDurumu = "TOLERANS_ICINDE" | "ESIK_ASILDI" | "DEGERLENDIRILEMEDI";

export interface DriftDegerlendirme {
  durum: DriftDurumu;
  /** Baseline'a göre mutlak sapma (baseline verildiyse). */
  sapma: number | null;
  mesaj: string;
}

/**
 * Bir drift okumasını (metrik değeri) eşiğe göre değerlendirir. Eşik YOKSA
 * "değerlendirilemedi" döner — koda gömülü bir varsayılan eşik UYDURULMAZ
 * (nihai §8.0 Dikey 4: eşik sürümlü politika/uzman kararı taşır).
 */
export function driftDegerlendir(deger: number, esik: number | null, baseline: number | null): DriftDegerlendirme {
  const sapma = baseline !== null ? Math.abs(deger - baseline) : null;
  if (esik === null) {
    return { durum: "DEGERLENDIRILEMEDI", sapma, mesaj: "Eşik belirlenmedi — drift tolerans kararı verilemez." };
  }
  const kiyas = sapma ?? Math.abs(deger);
  if (kiyas > esik) {
    return { durum: "ESIK_ASILDI", sapma, mesaj: `Drift eşiği aşıldı (${kiyas} > ${esik}).` };
  }
  return { durum: "TOLERANS_ICINDE", sapma, mesaj: `Tolerans içinde (${kiyas} ≤ ${esik}).` };
}
