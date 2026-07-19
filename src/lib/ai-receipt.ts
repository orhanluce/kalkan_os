// AI Decision Receipt parmak izi (M37, G5; PRQ0 ADR-2 + AI raporu §4.4).
//
// Her AI önerisinin makbuzu deterministik bir fingerprint taşır (kendi RFC 8785
// uygulamamız, kural 11 + 15). Ham prompt / kişisel veri / bağlam YAZILMAZ —
// yalnız hash/kimlik alanları (kural 7). AI karar VEREMEZ; bu yalnız kaydın
// bütünlüğü.

import { canonicalHash, type CanonicalDeger } from "./canonical";

export const AI_RECEIPT_SCHEMA = "KALKAN_AI_DECISION_RECEIPT_V1";

export interface AiReceiptGirdisi {
  aiSystemId: string;
  aiAgentId: string | null;
  amac: string;
  modelSaglayici: string | null;
  modelId: string | null;
  modelSurum: string | null;
  promptHash: string | null;
  kaynakHash: string[];
  confidence: number | null;
}

/**
 * Receipt'in kimlik alanlarından deterministik fingerprint. Kaynak hash'leri
 * sıralanır (sıra-bağımsızlık, kural 11). Aynı öneri → aynı fingerprint.
 */
export function aiReceiptFingerprint(g: AiReceiptGirdisi): Promise<string> {
  const kanonik = {
    schema: AI_RECEIPT_SCHEMA,
    aiSystemId: g.aiSystemId,
    aiAgentId: g.aiAgentId,
    amac: g.amac,
    modelSaglayici: g.modelSaglayici,
    modelId: g.modelId,
    modelSurum: g.modelSurum,
    promptHash: g.promptHash,
    kaynakHash: [...g.kaynakHash].sort(),
    confidence: g.confidence,
  };
  return canonicalHash(kanonik as unknown as CanonicalDeger);
}

// --- AI eval/karar manifesti (nihai v3.3 §8.0 Dikey 1, madde 2) ---
// "AI eval karar paketi": bir AI önerisinin İNSAN kararı (ACCEPTED/REJECTED).
// Mevcut outbox/defter mekanizması (ledger-outbox.ts) BU manifesti kullanarak
// mühürler. receiptFingerprint (yukarıdaki fonksiyon, YENİDEN KULLANILIR)
// "hangi öneri" sorusunu, bu manifest "ne karar verildi, kim, ne zaman"
// sorusunu yanıtlar — ikisi AYRI (kural 5: AI kendi önerisini kabul edemez;
// karar burada İNSAN reviewer'a bağlı kalır).

export const AI_RECEIPT_DECISION_SCHEMA = "KALKAN_AI_RECEIPT_DECISION_MANIFEST_V1";

export interface AiReceiptDecisionManifest {
  schema: typeof AI_RECEIPT_DECISION_SCHEMA;
  receiptId: string;
  receiptFingerprint: string;
  karar: "ACCEPTED" | "REJECTED";
  reviewer: string;
  reviewerKararZamani: string;
}

export function aiReceiptDecisionManifestKur(args: {
  receiptId: string;
  receiptFingerprint: string;
  karar: "ACCEPTED" | "REJECTED";
  reviewer: string;
  reviewerKararZamani: string;
}): AiReceiptDecisionManifest {
  return { schema: AI_RECEIPT_DECISION_SCHEMA, ...args };
}

export function aiReceiptDecisionManifestHash(m: AiReceiptDecisionManifest): Promise<string> {
  return canonicalHash(m as unknown as CanonicalDeger);
}
