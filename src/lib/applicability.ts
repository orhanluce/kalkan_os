// Uygulanabilirlik (V2 PR-4b adım 3, M22) — saf, deterministik yardımcılar.
//
// NE YAPAR: kurum profilinden kararın dayanacağı OLGU KOPYASINI (fact snapshot)
// üretir ve RFC 8785 kanonik parmak izini hesaplar. Aynı olgular — dizi sırası
// farklı bile olsa — HER ZAMAN aynı fingerprint'i verir (kural 11).
//
// NE YAPMAZ: hangi yükümlülüğün hangi profile "uygulanır" olduğuna KARAR VERMEZ.
// Yükümlülük-bazlı kapsam kuralları resmî kaynaktan doğrulanmadan bir kural
// motoru uydurmak kural 3'ün kapsam versiyonu olurdu. Bu MVP'de motorun dürüst
// söyleyebileceği tek şey: kritik profil olgusu EKSİKSE karar UNKNOWN'dur
// (UNKNOWN != NOT_APPLICABLE — DB guard'ı da bunu zorlar); olgular tamsa karar
// İNSANA aittir (manuel, gerekçe + onayla).

import { canonicalHash, type CanonicalDeger } from "./canonical";
import type { OrganizationType } from "./organizasyon";

export type ApplicabilityDurum = "APPLICABLE" | "NOT_APPLICABLE" | "CONDITIONAL" | "UNKNOWN";

export const APPLICABILITY_DURUM_LABEL: Record<ApplicabilityDurum, string> = {
  APPLICABLE: "Uygulanır",
  NOT_APPLICABLE: "Uygulanmaz",
  CONDITIONAL: "Şartlı uygulanır",
  UNKNOWN: "Değerlendirilemiyor",
};

/** Kararın dayandığı profil olguları — karar anında kopyalanır. */
export interface ApplicabilityFactSnapshot {
  schema: "KALKAN_APPLICABILITY_FACTS_V2";
  organizationType: OrganizationType | null;
  regulatedEntityTypes: string[];
  regulatedStatus: string | null;
  regulatorTypes: string[];
  jurisdictions: string[];
  operatingSectors: string[];
  financeDepartmentEnabled: boolean;
  employeeBand: string | null;
  legalEntityCount: number | null;
}

/** Snapshot'a giren profil alt kümesi (DB satırından seçilir). */
export interface ProfilOlgulari {
  organization_type: string | null;
  regulated_entity_types: string[] | null;
  regulated_status: string | null;
  regulator_types: string[] | null;
  jurisdictions: string[] | null;
  operating_sectors: string[] | null;
  finance_department_enabled: boolean | null;
  employee_band: string | null;
  legal_entity_count: number | null;
}

/** Diziyi sıra-bağımsız (sıralı, tekilleştirilmiş) hale getirir. */
function normalizeDizi(v: string[] | null): string[] {
  return [...new Set(v ?? [])].sort();
}

/**
 * Profilden olgu kopyası üretir. Dizi alanları sıralanır/tekilleştirilir —
 * aynı olgular farklı girdi sırasıyla gelse de snapshot (ve fingerprint) aynı.
 */
export function applicabilityFactSnapshot(profil: ProfilOlgulari): ApplicabilityFactSnapshot {
  return {
    schema: "KALKAN_APPLICABILITY_FACTS_V2",
    organizationType: (profil.organization_type as OrganizationType | null) ?? null,
    regulatedEntityTypes: normalizeDizi(profil.regulated_entity_types),
    regulatedStatus: profil.regulated_status ?? null,
    regulatorTypes: normalizeDizi(profil.regulator_types),
    jurisdictions: normalizeDizi(profil.jurisdictions),
    operatingSectors: normalizeDizi(profil.operating_sectors),
    financeDepartmentEnabled: profil.finance_department_enabled ?? false,
    employeeBand: profil.employee_band ?? null,
    legalEntityCount: profil.legal_entity_count ?? null,
  };
}

/**
 * Snapshot'ın RFC 8785 kanonik sha256'sı (factSnapshotFingerprint — adı neyi
 * doğruladığını söyler, kural 15). DB kolonu bunu saklar; adım 4'ün legal-basis
 * guard'ı "karar hâlâ bu profille mi verilmiş" sorusunu bununla yanıtlar.
 */
export function factSnapshotFingerprint(snapshot: ApplicabilityFactSnapshot): Promise<string> {
  return canonicalHash(snapshot as unknown as CanonicalDeger);
}

/**
 * Kapsam kararı için KRİTİK olguların eksik listesi. Boş değilse dürüst karar
 * UNKNOWN'dur ("değerlendiremiyoruz") — NOT_APPLICABLE DEĞİL. Hangi alanların
 * kritik olduğu SPK notu §2.1'deki profil girdilerinin MVP alt kümesidir:
 * kurum türü, düzenleme durumu ve yargı alanı olmadan kapsam konuşulamaz.
 */
export function eksikProfilAlanlari(snapshot: ApplicabilityFactSnapshot): string[] {
  const eksik: string[] = [];
  if (snapshot.organizationType === null) eksik.push("organizationType");
  if (
    (snapshot.organizationType === "REGULATED_FINANCIAL_INSTITUTION" ||
      snapshot.organizationType === "MIXED_GROUP") &&
    snapshot.regulatedEntityTypes.length === 0
  ) {
    eksik.push("regulatedEntityTypes");
  }
  if (snapshot.regulatedStatus === null || snapshot.regulatedStatus === "UNKNOWN") {
    eksik.push("regulatedStatus");
  }
  if (snapshot.jurisdictions.length === 0) eksik.push("jurisdictions");
  return eksik;
}
