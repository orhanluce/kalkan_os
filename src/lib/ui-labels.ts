import type { Durum, Finding, FindingDurum, Onem } from "./types";

export const DURUM_LABEL: Record<Durum, string> = {
  karsilaniyor: "Karşılanıyor",
  kismi: "Kısmi",
  acik: "Açık",
  kapsam_disi: "Kapsam Dışı",
};

export const DURUM_BADGE_VARIANT: Record<Durum, "default" | "secondary" | "destructive" | "outline"> = {
  karsilaniyor: "default",
  kismi: "secondary",
  acik: "destructive",
  kapsam_disi: "outline",
};

export const ONEM_LABEL: Record<Onem, string> = {
  acil: "Acil",
  kritik: "Kritik",
  yuksek: "Yüksek",
  orta: "Orta",
  dusuk: "Düşük",
};

export const ONEM_BADGE_VARIANT: Record<Onem, "default" | "secondary" | "destructive" | "outline"> = {
  acil: "destructive",
  kritik: "destructive",
  yuksek: "secondary",
  orta: "outline",
  dusuk: "outline",
};

export const FINDING_DURUM_LABEL: Record<FindingDurum, string> = {
  acik: "Açık",
  kapali: "Kapalı",
};

export const KAYNAK_LABEL: Record<Finding["kaynak"], string> = {
  sizma_testi: "Sızma Testi",
  denetim: "Denetim",
  ic_tespit: "İç Tespit",
};
