// Tedarikçi değerlendirme sign-off + kritik bulgu kapanış manifestleri (nihai
// talimat v3.3 §8.0 Dikey 1, madde 1). Mevcut transactional-outbox/SCITT
// mekanizması (ledger-outbox.ts) BU manifestleri kullanarak mühürler —
// outbox/defter altyapısı YENİDEN KURULMADI.

import { canonicalHash, type CanonicalDeger } from "./canonical";

export const TPR_ASSESSMENT_SIGNOFF_SCHEMA = "KALKAN_TPR_ASSESSMENT_SIGNOFF_MANIFEST_V1" as const;
export const TPR_ASSESSMENT_SIGNOFF_KIND = "TPR_ASSESSMENT_SIGNOFF" as const;

export interface TprAssessmentSignoffManifest {
  schema: typeof TPR_ASSESSMENT_SIGNOFF_SCHEMA;
  assessmentId: string;
  thirdPartyId: string;
  tur: string;
  degerlendiren: string;
  tamamlandiAt: string;
}

export function tprAssessmentSignoffManifestKur(args: {
  assessmentId: string;
  thirdPartyId: string;
  tur: string;
  degerlendiren: string;
  tamamlandiAt: string;
}): TprAssessmentSignoffManifest {
  return { schema: TPR_ASSESSMENT_SIGNOFF_SCHEMA, ...args };
}

export function tprAssessmentSignoffManifestHash(m: TprAssessmentSignoffManifest): Promise<string> {
  return canonicalHash(m as unknown as CanonicalDeger);
}

export const TPR_CRITICAL_FINDING_CLOSURE_SCHEMA = "KALKAN_TPR_CRITICAL_FINDING_CLOSURE_MANIFEST_V1" as const;
export const TPR_CRITICAL_FINDING_CLOSURE_KIND = "TPR_CRITICAL_FINDING_CLOSURE" as const;

export interface TprCriticalFindingClosureManifest {
  schema: typeof TPR_CRITICAL_FINDING_CLOSURE_SCHEMA;
  findingId: string;
  assessmentId: string;
  thirdPartyId: string;
  baslik: string;
  kapanisKanit: string;
  kapatan: string;
  kapanisZamani: string;
}

export function tprCriticalFindingClosureManifestKur(args: {
  findingId: string;
  assessmentId: string;
  thirdPartyId: string;
  baslik: string;
  kapanisKanit: string;
  kapatan: string;
  kapanisZamani: string;
}): TprCriticalFindingClosureManifest {
  return { schema: TPR_CRITICAL_FINDING_CLOSURE_SCHEMA, ...args };
}

export function tprCriticalFindingClosureManifestHash(m: TprCriticalFindingClosureManifest): Promise<string> {
  return canonicalHash(m as unknown as CanonicalDeger);
}
