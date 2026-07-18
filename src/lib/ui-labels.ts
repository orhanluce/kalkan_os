import type { SemantikDurum } from "@/components/durum/status-badge";
import type { AuditEylem, Durum, Finding, FindingDurum, Onem, Role } from "./types";

// PR-2 (master talimat §5.3): her iş durumu TEK yerde semantik duruma eşlenir;
// ekranlar StatusBadge'e bu eşlemeyle gider. Eski *_BADGE_VARIANT sabitleri
// kaldırıldı — iki paralel görsel dil yaşatılmaz. Eşleme ilkeleri:
//   - kural 13: UNKNOWN ayrı 'unknown' (nötr gri DEĞİL), STALE 'warning',
//     EXCEPTION 'legal-review' — beş durum görsel olarak da birleşmez.
//   - "ölçemedik" (UNKNOWN) ile "ihlal" (FAILED/danger) asla aynı renk değil.

export const DURUM_LABEL: Record<Durum, string> = {
  karsilaniyor: "Karşılanıyor",
  kismi: "Kısmi",
  acik: "Açık",
  kapsam_disi: "Kapsam Dışı",
};

export const DURUM_SEMANTIK: Record<Durum, SemantikDurum> = {
  karsilaniyor: "success",
  kismi: "warning",
  acik: "danger",
  kapsam_disi: "neutral",
};

export const ONEM_LABEL: Record<Onem, string> = {
  acil: "Acil",
  kritik: "Kritik",
  yuksek: "Yüksek",
  orta: "Orta",
  dusuk: "Düşük",
};

export const ONEM_SEMANTIK: Record<Onem, SemantikDurum> = {
  acil: "danger",
  kritik: "danger",
  yuksek: "warning",
  orta: "neutral",
  dusuk: "neutral",
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
  kontrol_testi: "Kontrol Testi",
};

/** Kontrol test motoru (M12): test türleri ve beş ayrı sonuç durumu. */
export const TEST_TUR_LABEL: Record<string, string> = {
  MANUAL_PROCEDURE: "Manuel prosedür",
  CONFIG_ASSERTION: "Konfigürasyon iddiası",
  SAMPLE_REVIEW: "Örneklem incelemesi",
  ATTACK_SIMULATION: "Saldırı simülasyonu",
  RESTORE_TEST: "Kurtarma testi",
};

/**
 * Beş AYRI durum, birleştirilemez (kural 13). Etiketler bu ayrımı da
 * taşımalı: "Bilinmiyor" ile "Kaldı" aynı renk/kelimeyle gösterilirse UI,
 * motorun özenle koruduğu ayrımı kullanıcıya geri iade etmemiş olur.
 */
export const TEST_SONUC_LABEL: Record<string, string> = {
  PASSED: "Geçti",
  FAILED: "Kaldı",
  UNKNOWN: "Bilinmiyor (ölçülemedi)",
  STALE: "Bayat",
  EXCEPTION: "İstisna",
};

/** Kural 13 görsel dili: beş durum beş AYRI semantiğe düşer, birleşmez. */
export const TEST_SONUC_SEMANTIK: Record<string, SemantikDurum> = {
  PASSED: "success",
  FAILED: "danger",
  UNKNOWN: "unknown", // "ölçemedik" — nötr gri de, danger da DEĞİL
  STALE: "warning",
  EXCEPTION: "legal-review",
};

export const FINDING_DURUM_SEMANTIK: Record<FindingDurum, SemantikDurum> = {
  acik: "danger",
  kapali: "success",
};

export const SIMULASYON_DURUM_SEMANTIK: Record<string, SemantikDurum> = {
  taslak: "neutral",
  planlandi: "info",
  hazir: "info",
  calisiyor: "info",
  duraklatildi: "warning",
  tamamlandi: "success",
  puanlaniyor: "info",
  incelendi: "success",
  kapandi: "neutral",
  iptal: "neutral",
};

export const PUANLAMA_DURUM_SEMANTIK: Record<string, SemantikDurum> = {
  BASARILI: "success",
  KISMI: "warning",
  BASARISIZ: "danger",
  CRITICAL_FAILURE: "danger",
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
  sod_kural_olusturuldu: "SoD kuralı oluşturuldu",
  sod_kural_guncellendi: "SoD kuralı güncellendi",
  sod_catisma_tespit_edildi: "SoD çatışması tespit edildi",
  sod_catisma_durumu_degisti: "SoD çatışması güncellendi",
  sod_istisna_talep_edildi: "SoD istisnası talep edildi",
  sod_istisna_karar_verildi: "SoD istisnası karara bağlandı",
  sod_telafi_kontrol_atandi: "Telafi edici kontrol atandı",
};

/** SoD (M16): kural/çatışma/istisna durum etiketleri. */
export const SOD_MEVZUAT_DURUMU_LABEL: Record<string, string> = {
  INTERNAL: "İç kural",
  TODO_DOGRULA: "Doğrulanmadı",
  VERIFIED: "Doğrulandı",
};

export const SOD_CATISMA_DURUM_LABEL: Record<string, string> = {
  OPEN: "Açık",
  UNDER_REVIEW: "İnceleniyor",
  EXCEPTION_REQUESTED: "İstisna talep edildi",
  EXCEPTION_APPROVED: "İstisna onaylandı",
  MITIGATED: "Telafi edildi",
  RESOLVED: "Kapatıldı",
  REOPENED: "Yeniden açıldı",
  EXPIRED: "İstisna süresi doldu",
  FALSE_POSITIVE: "Yanlış pozitif",
};

export const SOD_CATISMA_DURUM_SEMANTIK: Record<string, SemantikDurum> = {
  OPEN: "danger",
  UNDER_REVIEW: "info",
  EXCEPTION_REQUESTED: "legal-review",
  EXCEPTION_APPROVED: "legal-review",
  MITIGATED: "success",
  RESOLVED: "success",
  REOPENED: "danger",
  EXPIRED: "danger",
  FALSE_POSITIVE: "neutral",
};

export const SOD_ISTISNA_DURUM_SEMANTIK: Record<string, SemantikDurum> = {
  talep_edildi: "info",
  onaylandi: "success",
  reddedildi: "danger",
  iptal: "neutral",
  suresi_doldu: "danger",
};

export const SOD_MEVZUAT_DURUMU_SEMANTIK: Record<string, SemantikDurum> = {
  INTERNAL: "neutral",
  TODO_DOGRULA: "legal-review",
  VERIFIED: "success",
};

export const SOD_ISTISNA_DURUM_LABEL: Record<string, string> = {
  talep_edildi: "Talep edildi",
  onaylandi: "Onaylandı",
  reddedildi: "Reddedildi",
  iptal: "İptal edildi",
  suresi_doldu: "Süresi doldu",
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
