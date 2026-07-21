// Dikey F, F5 (docs/adr/PR0-dikeyF-f5-kurtarma-karsilastirmasi-2026-07-21.md):
// belirli bir F4 ölçüm kaydı ile ölçüm anında yürürlükte olan onaylı F3
// tolerans sürümü arasında SAF, deterministik nicel karşılaştırma.
//
// SAF: DB/ağ/AI çağrısı yok, `Date.now()` yok — createdAt girdiden gelir.
// Ölçüm/tolerans/kritik-hizmet eşleşmesi ve tarihsel sürüm çözümü ÇAĞIRANIN
// (API route, `impact_tolerance_asof` ile) işidir — bu motor YALNIZ zaten
// eşleşmiş girdiyi karşılaştırır.
//
// RTO ve RPO BAĞIMSIZ değerlendirilir. "RTO karşılandı" gibi kaynağı gizleyen
// kesin ifade ASLA üretilmez: MANUEL_BEYAN için "beyan edilen değer hedefin
// içinde/aşıyor", OTOMATIK_OLCUM için "ölçülen değer hedefi karşıladı/aştı"
// (ADR §5). Motor, aldığı tolerans kaydının GERÇEKTEN yürürlükte/onaylı
// olduğunu KENDİSİ de doğrular — çağırana körlemesine güvenmez.
import { canonicalHash, type CanonicalDeger } from "./canonical";

export const RECOVERY_COMPARISON_SCHEMA = "WARDPROOF_TEST_RUN_RECOVERY_COMPARISON_V1";
export const RECOVERY_COMPARISON_KIND = "RECOVERY_COMPARISON" as const;

export type KarsilastirmaSonucu = "KARSILADI" | "ASTI" | "OLCUM_YOK" | "TOLERANS_YOK" | "KARSILASTIRILAMAZ";
export type OlcumKaynagi = "MANUEL_BEYAN" | "OTOMATIK_OLCUM";

export interface RecoveryComparisonGirdisi {
  testRunId: string;
  comparisonId: string;
  measurement: {
    id: string;
    olcumKaynagi: OlcumKaynagi;
    olculenKesintiSaat: number | null;
    olculenVeriKaybiSaat: number | null;
    beyanKesintiSaat: number | null;
    beyanVeriKaybiSaat: number | null;
  };
  /**
   * Ölçüm anında yürürlükte olan tolerans sürümü — ÇAĞIRAN as-of ile çözer
   * (`impact_tolerance_asof`). DİKKAT: bu sürümün BUGÜNKÜ `durum`'u SUPERSEDED
   * olabilir (geçmiş bir ölçüm anı için doğru eşleşme budur) — motor bu
   * yüzden `durum` DEĞİL, `yonetimOnayi + onayZamani` ile "GERÇEKTEN o anda
   * onaylı/aktif miydi" sorusunu doğrular (bitemporal doğruluk, ADR §2).
   */
  tolerance: {
    id: string;
    surum: number;
    yonetimOnayi: boolean;
    onayZamani: string | null;
    maxKesintiSaat: number | null;
    maxVeriKaybiSaat: number | null;
  };
  criticalServiceId: string;
  supersedesComparisonId: string | null;
  createdAt: string;
}

export interface RecoveryComparisonMetrikSonucu {
  sonuc: KarsilastirmaSonucu;
  olculenDegerSaat: number | null;
  hedefSaat: number | null;
  aciklama: string;
}

export interface RecoveryComparison {
  schema: typeof RECOVERY_COMPARISON_SCHEMA;
  testRunId: string;
  comparisonId: string;
  recoveryMeasurementId: string;
  impactToleranceId: string;
  criticalServiceId: string;
  toleransSurumu: number;
  toleransMaxKesintiSaat: number | null;
  toleransMaxVeriKaybiSaat: number | null;
  olcumKaynagi: OlcumKaynagi;
  rto: RecoveryComparisonMetrikSonucu;
  rpo: RecoveryComparisonMetrikSonucu;
  supersedesComparisonId: string | null;
  createdAt: string;
}

function metrikDegerlendir(olculen: number | null, beyan: number | null, hedef: number | null, kaynak: OlcumKaynagi): RecoveryComparisonMetrikSonucu {
  // Olay-zamanlarından türetilmiş değer (ölçüm) beyan edilen süreye TERCİH
  // edilir; ikisi de yoksa bu boyut için veri yok.
  const deger = olculen ?? beyan;

  if (deger === null) {
    return { sonuc: "OLCUM_YOK", olculenDegerSaat: null, hedefSaat: hedef, aciklama: "Bu boyut için ölçüm veya beyan yok." };
  }
  if (hedef === null) {
    return { sonuc: "TOLERANS_YOK", olculenDegerSaat: deger, hedefSaat: null, aciklama: "Onaylı hedef bu boyut için tanımlı değil." };
  }

  const hedefIcinde = deger <= hedef;
  const degerDili = kaynak === "MANUEL_BEYAN" ? "Beyan edilen değer" : "Ölçülen değer";
  const sonucDili = hedefIcinde
    ? kaynak === "MANUEL_BEYAN"
      ? "hedefin içinde"
      : "hedefi karşıladı"
    : kaynak === "MANUEL_BEYAN"
      ? "hedefi aşıyor"
      : "hedefi aştı";

  return {
    sonuc: hedefIcinde ? "KARSILADI" : "ASTI",
    olculenDegerSaat: deger,
    hedefSaat: hedef,
    aciklama: `${degerDili} ${sonucDili} (${deger} saat / hedef ${hedef} saat).`,
  };
}

/**
 * Ölçüm + tolerans karşılaştırmasını kurar. Tolerans kaydı GERÇEKTEN
 * onaylanmış/aktive edilmiş değilse (yonetimOnayi/onayZamani eksikse —
 * çağıranın as-of çözümü hatalıysa bile) motor bunu KENDİSİ reddeder — her
 * iki metrik de KARSILASTIRILAMAZ döner. `durum` alanı KASITLI OLARAK
 * kullanılmaz (SUPERSEDED bir sürüm, geçmiş bir ölçüm anı için hâlâ DOĞRU
 * eşleşme olabilir — ADR §2, bitemporal doğruluk).
 */
export function kurtarmaKarsilastirmasiOlustur(girdi: RecoveryComparisonGirdisi): RecoveryComparison {
  const { measurement, tolerance } = girdi;

  let rto: RecoveryComparisonMetrikSonucu;
  let rpo: RecoveryComparisonMetrikSonucu;

  if (!tolerance.yonetimOnayi || tolerance.onayZamani === null) {
    const karsilastirilamaz: RecoveryComparisonMetrikSonucu = {
      sonuc: "KARSILASTIRILAMAZ",
      olculenDegerSaat: null,
      hedefSaat: null,
      aciklama: "Sağlanan tolerans kaydı yönetim onaylı değil — karşılaştırma yapılamaz.",
    };
    rto = karsilastirilamaz;
    rpo = karsilastirilamaz;
  } else {
    rto = metrikDegerlendir(measurement.olculenKesintiSaat, measurement.beyanKesintiSaat, tolerance.maxKesintiSaat, measurement.olcumKaynagi);
    rpo = metrikDegerlendir(measurement.olculenVeriKaybiSaat, measurement.beyanVeriKaybiSaat, tolerance.maxVeriKaybiSaat, measurement.olcumKaynagi);
  }

  return {
    schema: RECOVERY_COMPARISON_SCHEMA,
    testRunId: girdi.testRunId,
    comparisonId: girdi.comparisonId,
    recoveryMeasurementId: measurement.id,
    impactToleranceId: tolerance.id,
    criticalServiceId: girdi.criticalServiceId,
    toleransSurumu: tolerance.surum,
    toleransMaxKesintiSaat: tolerance.maxKesintiSaat,
    toleransMaxVeriKaybiSaat: tolerance.maxVeriKaybiSaat,
    olcumKaynagi: measurement.olcumKaynagi,
    rto,
    rpo,
    supersedesComparisonId: girdi.supersedesComparisonId,
    createdAt: girdi.createdAt,
  };
}

/** Kanonik hash (RFC 8785) — mühür ve bağımsız yeniden-doğrulama için tek kapı. */
export function kurtarmaKarsilastirmasiHash(payload: RecoveryComparison): Promise<string> {
  return canonicalHash(payload as unknown as CanonicalDeger);
}
