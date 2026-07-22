export const REGULATED_ENTITY_TYPES = [
  "BANKA",
  "ARACI_KURUM",
  "PORTFOY_YONETIM_SIRKETI",
  "ODEME_E_PARA_KURULUSU",
  "KRIPTO_VARLIK_HIZMET_SAGLAYICI",
  "FINANSAL_KIRALAMA_FAKTORING_FINANSMAN",
  "BILGI_ALISVERISI_KURULUSU",
  "SIGORTA_EMEKLILIK",
  "DIGER_DUZENLENEN",
] as const;

export type RegulatedEntityType = (typeof REGULATED_ENTITY_TYPES)[number];

export const REGULATED_ENTITY_LABEL: Record<RegulatedEntityType, string> = {
  BANKA: "Banka",
  ARACI_KURUM: "Aracı kurum",
  PORTFOY_YONETIM_SIRKETI: "Portföy yönetim şirketi",
  ODEME_E_PARA_KURULUSU: "Ödeme / elektronik para kuruluşu",
  KRIPTO_VARLIK_HIZMET_SAGLAYICI: "Kripto varlık hizmet sağlayıcı",
  FINANSAL_KIRALAMA_FAKTORING_FINANSMAN: "Finansal kiralama / faktoring / finansman",
  BILGI_ALISVERISI_KURULUSU: "Bilgi alışverişi kuruluşu / risk merkezi",
  SIGORTA_EMEKLILIK: "Sigorta / emeklilik kuruluşu",
  DIGER_DUZENLENEN: "Diğer düzenlemeye tabi kuruluş",
};

const ENTITY_REGULATORS: Partial<Record<RegulatedEntityType, string[]>> = {
  BANKA: ["BDDK"],
  ARACI_KURUM: ["SPK"],
  PORTFOY_YONETIM_SIRKETI: ["SPK"],
  ODEME_E_PARA_KURULUSU: ["TCMB"],
  KRIPTO_VARLIK_HIZMET_SAGLAYICI: ["SPK"],
  FINANSAL_KIRALAMA_FAKTORING_FINANSMAN: ["BDDK"],
  BILGI_ALISVERISI_KURULUSU: ["BDDK"],
  SIGORTA_EMEKLILIK: ["SEDDK"],
};

export function regulatorTypesForEntities(types: RegulatedEntityType[]): string[] {
  return [...new Set(types.flatMap((type) => ENTITY_REGULATORS[type] ?? []))].sort();
}

export function regulatedEntitySelectionRequired(organizationType: string | null): boolean {
  return (
    organizationType === "REGULATED_FINANCIAL_INSTITUTION" || organizationType === "MIXED_GROUP"
  );
}
