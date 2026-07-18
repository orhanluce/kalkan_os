// Kurum segmenti — saf yardımcılar (docs/ROADMAP.md V2 PR-2, ADR-V2-1).
//
// SAF ve DETERMİNİSTİK (kural 11): organization_type → ürün hattı / varsayılan
// navigasyon / dashboard türü eşlemesi TEK yerde. UI bu eşlemeyi kullanır;
// karar dağıtılmaz. Bu bir YETKİ katmanı DEĞİLDİR (yalnız sunum) — gerçek
// sınır RLS + entitlement (PR-2c).

export type OrganizationType =
  | "REGULATED_FINANCIAL_INSTITUTION"
  | "CORPORATE_FINANCE"
  | "MIXED_GROUP";

export type UrunHatti = "REGULATED" | "CFO" | "KARMA";

export const ORGANIZATION_TYPE_LABEL: Record<OrganizationType, string> = {
  REGULATED_FINANCIAL_INSTITUTION: "Düzenlemeye tabi finans kuruluşu",
  CORPORATE_FINANCE: "Kurum finans / hazine departmanı",
  MIXED_GROUP: "Karma şirketler grubu",
};

/** Onboarding "hangi amaçla?" sorusunun üç seçeneği (V2 §6.1). */
export const ONBOARDING_SECENEKLERI: { tur: OrganizationType; baslik: string; aciklama: string }[] = [
  {
    tur: "REGULATED_FINANCIAL_INSTITUTION",
    baslik: "Düzenlemeye tabi finans kuruluşu",
    aciklama: "Banka, aracı kurum, portföy yönetimi, ödeme/e-para, KVHS, sigorta — resmî düzenleme takibi ve otorite raporlaması.",
  },
  {
    tur: "CORPORATE_FINANCE",
    baslik: "Kurum finans / hazine departmanı",
    aciklama: "Doğrudan finansal düzenlemeye tabi olmayan kurumun finans, hazine, muhasebe, bordro operasyonları — ödeme kontrolleri, SoD, BEC/deepfake tatbikatı.",
  },
  {
    tur: "MIXED_GROUP",
    baslik: "Karma şirketler grubu",
    aciklama: "Regulated iştirak + finans dışı şirketler. MVP'de tek tüzel kişi bağlamı; çoklu-entity konsolidasyonu ayrı taş.",
  },
];

/** Ürün hattı: navigasyon ve dashboard hangi eksene göre kurulur. */
export function urunHatti(tur: OrganizationType): UrunHatti {
  switch (tur) {
    case "REGULATED_FINANCIAL_INSTITUTION":
      return "REGULATED";
    case "CORPORATE_FINANCE":
      return "CFO";
    case "MIXED_GROUP":
      return "KARMA";
  }
}

/**
 * CFO odaklı sade navigasyon mu gösterilsin (V2 §6.2)? CFO ve KARMA'da CFO
 * hattı öne çıkar; REGULATED'da regülasyon corpus'u ana eksendir. Bu YALNIZ
 * sunum tercihidir — yetkisiz modül gizleme ile karıştırılmaz (kural: salt UI
 * gizleme authorization değildir; entitlement PR-2c'de).
 */
export function cfoOdakliMi(tur: OrganizationType): boolean {
  return tur === "CORPORATE_FINANCE" || tur === "MIXED_GROUP";
}

/** Finans departmanı yetenekleri varsayılan açık mı (profil ipucu). */
export function financeVarsayilanAcik(tur: OrganizationType): boolean {
  return tur === "CORPORATE_FINANCE" || tur === "MIXED_GROUP";
}
