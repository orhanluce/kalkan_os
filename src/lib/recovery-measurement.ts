// Dikey F, F4 (docs/adr/PR0-dikeyF-f4-kurtarma-olcumu-yakalama-2026-07-21.md):
// bir kontrol testi koşusuna bağlı, ÖLÇÜLEN gerçek kesinti/veri-kaybı verisinin
// KANONİK, MÜHÜRLENEBİLİR payload'ını kurar ve doğrular.
//
// SAF: DB/ağ/AI çağrısı yok, `Date.now()` yok — measuredAt/recordedAt girdiden
// gelir. Aynı girdi her zaman aynı payload'ı (ve hash'i) üretir.
//
// KARŞILAŞTIRMA YOK: bu payload bir "RTO/RPO karşılandı" hükmü ÜRETMEZ —
// yalnız ölçülen/beyan edilen ham veriyi kaynağı+güvenilirlik katmanıyla
// taşır. `comparisonPerformed` HER ZAMAN false (kural 11; ADR §6).
//
// GÜVENİLİRLİK: bir insanın girdiği süre bir ÖLÇÜM değil BEYANDIR
// (measurementSource=MANUEL_BEYAN). Kanıt eklenmesi beyanı ölçüme dönüştürmez.
import { canonicalHash, type CanonicalDeger } from "./canonical";

export const RECOVERY_MEASUREMENT_SCHEMA = "WARDPROOF_TEST_RUN_RECOVERY_MEASUREMENT_V1";
export const RECOVERY_MEASUREMENT_KIND = "RECOVERY_MEASUREMENT" as const;

export type OlcumKaynagi = "MANUEL_BEYAN" | "OTOMATIK_OLCUM";
export type GirdiModu = "EVENT_TIMESTAMPS" | "DURATION_DECLARATION";

/** Ham girdi — motor bunları doğrular, süreleri türetir, payload'ı kurar. */
export interface KurtarmaOlcumuGirdisi {
  testRunId: string;
  measurementId: string;
  measurementSource: OlcumKaynagi;
  inputMode: GirdiModu;
  outage: { startedAt: string | null; restoredAt: string | null; declaredHours: number | null };
  dataLoss: { lastConsistentDataAt: string | null; recoveryPointAt: string | null; declaredHours: number | null };
  provenance: {
    evidenceId: string | null;
    sourceSystem: string | null;
    sourceEventId: string | null;
    sourcePayloadHash: string | null;
    declarantPresent: boolean;
  };
  supersedesMeasurementId: string | null;
  measuredAt: string;
  recordedAt: string;
}

export interface TestRunRecoveryMeasurement {
  schema: typeof RECOVERY_MEASUREMENT_SCHEMA;
  testRunId: string;
  measurementId: string;
  measurementSource: OlcumKaynagi;
  inputMode: GirdiModu;
  outage: { startedAt: string | null; restoredAt: string | null; declaredHours: number | null; derivedHours: number | null };
  dataLoss: { lastConsistentDataAt: string | null; recoveryPointAt: string | null; declaredHours: number | null; derivedHours: number | null };
  provenance: {
    evidenceId: string | null;
    sourceSystem: string | null;
    sourceEventId: string | null;
    sourcePayloadHash: string | null;
    declarantPresent: boolean;
  };
  supersedesMeasurementId: string | null;
  measuredAt: string;
  recordedAt: string;
  /** HER ZAMAN false — bu katmanda nicel karşılaştırma yapılmaz (ADR §6). */
  comparisonPerformed: false;
}

export class KurtarmaOlcumuHatasi extends Error {
  constructor(
    public readonly kod: string,
    mesaj: string,
  ) {
    super(mesaj);
    this.name = "KurtarmaOlcumuHatasi";
  }
}

/** İki ISO zaman arasındaki SAAT farkı; deterministik. Negatif olamaz (çağıran sıralar). */
function saatFarki(bas: string, bit: string): number {
  return (new Date(bit).getTime() - new Date(bas).getTime()) / 3_600_000;
}

// Dikey F, F5 hazırlık — Karar D: measured_at gelecekte makul olmayan bir
// zamana ayarlanamaz. recordedAt (sunucu now()) referans alınır — saat
// farkı toleransı DB CHECK'iyle (trrm_measured_at_gelecek_degil) birebir
// aynı olmalı (tek sözleşme, iki yerde savunma derinliği).
const GELECEK_TOLERANS_DK = 5;

/**
 * Ölçüm payload'ını doğrular + türetir + kanonik biçimde kurar.
 * Kurallar (ADR §4/§5): mod tutarlılığı, negatif/sıra reddi, NULL≠0,
 * en az bir boyut, OTOMATIK_OLCUM zorunlu provenance.
 */
export function kurtarmaOlcumuOlustur(girdi: KurtarmaOlcumuGirdisi): TestRunRecoveryMeasurement {
  const { outage, dataLoss, provenance, inputMode, measurementSource } = girdi;

  // --- Mod tutarlılığı: aynı olgu için ham zaman + süre-beyan BİRLİKTE olamaz ---
  if (inputMode === "EVENT_TIMESTAMPS") {
    if (outage.declaredHours !== null || dataLoss.declaredHours !== null) {
      throw new KurtarmaOlcumuHatasi("MOD_CAKISMASI", "EVENT_TIMESTAMPS modunda süre-yalnız beyan (declaredHours) gönderilemez.");
    }
  } else {
    if (outage.startedAt !== null || outage.restoredAt !== null || dataLoss.lastConsistentDataAt !== null || dataLoss.recoveryPointAt !== null) {
      throw new KurtarmaOlcumuHatasi("MOD_CAKISMASI", "DURATION_DECLARATION modunda ham olay zamanı gönderilemez.");
    }
  }

  // --- Negatif süre reddi (beyan) ---
  if ((outage.declaredHours !== null && outage.declaredHours < 0) || (dataLoss.declaredHours !== null && dataLoss.declaredHours < 0)) {
    throw new KurtarmaOlcumuHatasi("NEGATIF_SURE", "Beyan edilen süre negatif olamaz.");
  }

  // --- Sıra reddi: başlangıç bitişten sonra olamaz ---
  if (outage.startedAt !== null && outage.restoredAt !== null && new Date(outage.startedAt).getTime() > new Date(outage.restoredAt).getTime()) {
    throw new KurtarmaOlcumuHatasi("SIRA_HATASI", "Kesinti başlangıcı, hizmetin geri gelmesinden sonra olamaz.");
  }
  if (dataLoss.lastConsistentDataAt !== null && dataLoss.recoveryPointAt !== null && new Date(dataLoss.lastConsistentDataAt).getTime() > new Date(dataLoss.recoveryPointAt).getTime()) {
    throw new KurtarmaOlcumuHatasi("SIRA_HATASI", "Son tutarlı veri anı, kurtarma noktasından sonra olamaz.");
  }

  // --- measured_at gelecekte makul olmayan bir zamana ayarlanamaz (Karar D) ---
  if (new Date(girdi.measuredAt).getTime() > new Date(girdi.recordedAt).getTime() + GELECEK_TOLERANS_DK * 60_000) {
    throw new KurtarmaOlcumuHatasi("GELECEK_ZAMAN", "Ölçüm zamanı, kayıt anından makul olmayan ölçüde ileri bir tarihe ayarlanamaz.");
  }

  // --- Ham olay zamanları mevcutsa measured_at olay penceresiyle TUTARLI olmalı
  //     (Karar D): kesinti olay zamanı varsa measured_at = hizmet_geri_geldi_at
  //     — motor bunu KENDİSİ türetmez, çağıranın (route) bunu ZATEN türetip
  //     gönderdiğini doğrular; tutarsızsa reddeder (tek kaynak, sessizce
  //     farklı bir zaman kabul edilmez).
  if (outage.restoredAt !== null && girdi.measuredAt !== outage.restoredAt) {
    throw new KurtarmaOlcumuHatasi(
      "OLCUM_ZAMANI_TUTARSIZ",
      "Kesinti olay zamanları mevcutken ölçüm zamanı, hizmetin geri geldiği andan farklı olamaz.",
    );
  }

  // --- En az bir boyut dolu olmalı ---
  const kesintiVar = outage.startedAt !== null || outage.declaredHours !== null;
  const veriVar = dataLoss.lastConsistentDataAt !== null || dataLoss.declaredHours !== null;
  if (!kesintiVar && !veriVar) {
    throw new KurtarmaOlcumuHatasi("BOS_OLCUM", "En az bir ölçüm boyutu (kesinti veya veri kaybı) doldurulmalı.");
  }

  // --- OTOMATIK_OLCUM zorunlu provenance ---
  if (measurementSource === "OTOMATIK_OLCUM" && (provenance.sourceSystem === null || provenance.sourceEventId === null || provenance.evidenceId === null)) {
    throw new KurtarmaOlcumuHatasi("PROVENANCE_EKSIK", "OTOMATIK_OLCUM için source_system + source_event_id + evidence_id zorunludur.");
  }

  // --- Türetme (SUNUCU hesaplar; NULL≠0 — zaman yoksa null) ---
  const kesintiDerived = outage.startedAt !== null && outage.restoredAt !== null ? saatFarki(outage.startedAt, outage.restoredAt) : null;
  const veriDerived = dataLoss.lastConsistentDataAt !== null && dataLoss.recoveryPointAt !== null ? saatFarki(dataLoss.lastConsistentDataAt, dataLoss.recoveryPointAt) : null;

  return {
    schema: RECOVERY_MEASUREMENT_SCHEMA,
    testRunId: girdi.testRunId,
    measurementId: girdi.measurementId,
    measurementSource,
    inputMode,
    outage: { startedAt: outage.startedAt, restoredAt: outage.restoredAt, declaredHours: outage.declaredHours, derivedHours: kesintiDerived },
    dataLoss: { lastConsistentDataAt: dataLoss.lastConsistentDataAt, recoveryPointAt: dataLoss.recoveryPointAt, declaredHours: dataLoss.declaredHours, derivedHours: veriDerived },
    provenance: { ...provenance },
    supersedesMeasurementId: girdi.supersedesMeasurementId,
    measuredAt: girdi.measuredAt,
    recordedAt: girdi.recordedAt,
    comparisonPerformed: false,
  };
}

/** Kanonik hash (RFC 8785) — mühür ve bağımsız yeniden-doğrulama için tek kapı. */
export function kurtarmaOlcumuHash(payload: TestRunRecoveryMeasurement): Promise<string> {
  return canonicalHash(payload as unknown as CanonicalDeger);
}
