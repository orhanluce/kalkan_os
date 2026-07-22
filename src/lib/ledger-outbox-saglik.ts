// K2 §8 — alarm eşikleri. Bu turda harici bir alarm servisi YOK; yalnız
// ölçülebilir eşikler + saf bir değerlendirme fonksiyonu. `ledger_outbox_
// saglik_ozeti()` RPC'sinin döndürdüğü JSON'u eşiklere karşı değerlendirir.
// Kural 11: deterministik, aynı girdi aynı sonucu verir.

export const LEDGER_OUTBOX_ESIKLERI = {
  /** Bir PENDING kaydın "eski" sayılacağı yaş (saniye). */
  pendingYasEsigiSaniye: 30 * 60,
  /** claim()'in kendi stale-reclaim penceresiyle AYNI (5 dk) — bilgi amaçlı,
      buradaki eşik yalnız RAPORLAMA için, claim'in kendi davranışını
      DEĞİŞTİRMEZ. */
  processingLeaseSuresiSaniye: 5 * 60,
  /** ledger_outbox'ın kendi sabiti (mark_failed, 5. denemede FAILED). */
  maksimumDeneme: 5,
  /** Bu sayının üzerinde FAILED kaydı varsa alarm. */
  failedAlarmEsigi: 1,
  /** Bu sayının üzerinde stale PROCESSING kaydı varsa alarm (consumer
      çökmüş/hiç çalışmamış olabilir). */
  staleProcessingAlarmEsigi: 1,
  /** Ani backlog artışı: iki ölçüm arasında pending sayısının bu kadar
      artması alarm sayılır (çağıran, önceki ölçümü kendi saklar). */
  backlogArtisAlarmEsigi: 20,
} as const;

export interface LedgerOutboxSaglikOzeti {
  kapsam: "TENANT" | "GLOBAL" | "YOK";
  pendingSayisi: number;
  staleProcessingSayisi: number;
  processingSayisi: number;
  failedSayisi: number;
  enEskiPendingYasSaniye: number | null;
  jobTuruBazinda: Record<string, number>;
}

export type AlarmKodu =
  | "ESKI_PENDING"
  | "STALE_PROCESSING"
  | "FAILED_BACKLOG"
  | "BACKLOG_SICRAMASI"
  | "CONSUMER_HIC_CALISMAMIS";

export interface AlarmDurumu {
  aktifAlarmlar: AlarmKodu[];
  detay: Record<AlarmKodu, string>;
}

/**
 * Saf değerlendirme — dışarıdan hiçbir servise bağlanmaz. `oncekiPending`
 * verilirse "ani backlog artışı" da değerlendirilir (verilmezse o kontrol
 * atlanır — ilk ölçümde karşılaştıracak bir şey yoktur, bu UYDURULMAZ).
 */
export function ledgerOutboxAlarmDegerlendir(
  ozet: LedgerOutboxSaglikOzeti,
  esikler: typeof LEDGER_OUTBOX_ESIKLERI = LEDGER_OUTBOX_ESIKLERI,
  oncekiPending?: number,
): AlarmDurumu {
  const aktif: AlarmKodu[] = [];
  const detay: Partial<Record<AlarmKodu, string>> = {};

  if (ozet.enEskiPendingYasSaniye !== null && ozet.enEskiPendingYasSaniye > esikler.pendingYasEsigiSaniye) {
    aktif.push("ESKI_PENDING");
    detay.ESKI_PENDING = `En eski PENDING kayıt ${Math.round(ozet.enEskiPendingYasSaniye)} saniyedir bekliyor (eşik: ${esikler.pendingYasEsigiSaniye}s).`;
  }

  if (ozet.staleProcessingSayisi >= esikler.staleProcessingAlarmEsigi) {
    aktif.push("STALE_PROCESSING");
    detay.STALE_PROCESSING = `${ozet.staleProcessingSayisi} kayıt lease süresini aştı (PROCESSING'de takılı) — consumer çökmüş olabilir.`;
  }

  if (ozet.failedSayisi >= esikler.failedAlarmEsigi) {
    aktif.push("FAILED_BACKLOG");
    detay.FAILED_BACKLOG = `${ozet.failedSayisi} kayıt dead-letter (FAILED) durumunda — manuel inceleme/yeniden deneme gerekebilir.`;
  }

  if (
    oncekiPending !== undefined &&
    ozet.pendingSayisi - oncekiPending >= esikler.backlogArtisAlarmEsigi
  ) {
    aktif.push("BACKLOG_SICRAMASI");
    detay.BACKLOG_SICRAMASI = `Pending sayısı ${oncekiPending} → ${ozet.pendingSayisi} (+${ozet.pendingSayisi - oncekiPending}) — ani artış.`;
  }

  // "Consumer hiç çalışmamış" — pending VAR ama processing/failed hiç YOK
  // (yani hiçbir zaman claim edilmemiş) VE en eski pending zaten eşiği
  // geçmiş: muhtemelen hiçbir route/worker drenajı hiç tetiklemedi.
  if (
    ozet.pendingSayisi > 0 &&
    ozet.processingSayisi === 0 &&
    ozet.failedSayisi === 0 &&
    ozet.enEskiPendingYasSaniye !== null &&
    ozet.enEskiPendingYasSaniye > esikler.pendingYasEsigiSaniye
  ) {
    aktif.push("CONSUMER_HIC_CALISMAMIS");
    detay.CONSUMER_HIC_CALISMAMIS = "Pending kayıtlar var ama hiç claim/processing/failed izi yok — consumer hiç çalışmamış olabilir.";
  }

  return { aktifAlarmlar: aktif, detay: detay as Record<AlarmKodu, string> };
}
