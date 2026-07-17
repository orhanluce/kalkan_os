import type { AuditEylem, Durum, Finding, FindingDurum, Onem, Role } from "./types";

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
  simulasyon: "Simülasyon",
};

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Admin",
  uyum: "Uyum",
  denetci_misafir: "Denetçi (Misafir)",
};

export const SIMULASYON_DURUM_LABEL: Record<string, string> = {
  taslak: "Taslak",
  planlandi: "Planlandı",
  hazir: "Hazır",
  calisiyor: "Çalışıyor",
  duraklatildi: "Duraklatıldı",
  tamamlandi: "Tamamlandı",
  puanlaniyor: "Puanlanıyor",
  incelendi: "İncelendi",
  kapandi: "Kapandı",
  iptal: "İptal",
};

export const KATILIM_TIPI_LABEL: Record<string, string> = {
  yonetici: "Tatbikat Yöneticisi",
  katilimci: "Katılımcı",
  gozlemci: "Gözlemci",
};

export const PUANLAMA_DURUM_LABEL: Record<string, string> = {
  BASARILI: "Başarılı",
  KISMI: "Kısmi",
  BASARISIZ: "Başarısız",
  CRITICAL_FAILURE: "Kritik Başarısızlık",
};

export const AUDIT_EYLEM_LABEL: Record<AuditEylem, string> = {
  durum_degisti: "Durum değişti",
  kanit_eklendi: "Kanıt eklendi",
  sorumlu_atandi: "Sorumlu atandı",
  not_guncellendi: "Not güncellendi",
  kanit_suresi_doldu: "Kanıt süresi doldu",
  bulgu_eklendi: "Bulgu eklendi",
  bulgu_durumu_degisti: "Bulgu güncellendi",
  paylasim_linki_olusturuldu: "Paylaşım linki oluşturuldu",
};

/** Kanıt zarfı (M9): gizlilik sınıfı ve saklama süresi etiketleri. */
export const KANIT_SINIFI_LABEL: Record<string, string> = {
  genel: "Genel",
  ic_kullanim: "İç kullanım",
  gizli: "Gizli",
  cok_gizli: "Çok gizli",
};

export const SAKLAMA_SINIFI_LABEL: Record<string, string> = {
  "1y": "1 yıl",
  "5y": "5 yıl",
  "10y": "10 yıl",
  surekli: "Süresiz",
};
