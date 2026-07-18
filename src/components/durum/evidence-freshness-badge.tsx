// Kanıt tazeliği rozeti (master talimat §8).
//
// Tazelik ÜÇ durumdur ve kural 13'ün ruhuyla ayrık kalır: "taze" ≠ "yaklaşıyor"
// ≠ "süresi doldu" — bunlar birleştirilip tek bir yüzdeye indirgenemez.
// Hesap ÇAĞIRANDA değil burada: aynı eşik her ekranda aynı sonucu versin.
import { StatusBadge } from "./status-badge";

/** Süre-dolumuna 14 günden az kaldıysa "yaklaşıyor" (pg_cron işi 'kismi'ye
 * düşürmeden önce kullanıcıya görünür uyarı penceresi). */
const YAKLASIYOR_ESIGI_GUN = 14;

export function EvidenceFreshnessBadge({
  gecerlilikBitis,
  simdi = new Date(),
}: {
  /** ISO tarih; null = süresiz kanıt. */
  gecerlilikBitis: string | null;
  /** Test edilebilirlik için enjekte edilebilir (kural 11: deterministik). */
  simdi?: Date;
}) {
  if (!gecerlilikBitis) {
    return <StatusBadge durum="neutral">Süresiz</StatusBadge>;
  }
  const bitis = new Date(gecerlilikBitis);
  const kalanGun = Math.floor((bitis.getTime() - simdi.getTime()) / 86_400_000);

  if (kalanGun < 0) {
    return <StatusBadge durum="danger">Süresi doldu</StatusBadge>;
  }
  if (kalanGun <= YAKLASIYOR_ESIGI_GUN) {
    return <StatusBadge durum="warning">{kalanGun} gün kaldı</StatusBadge>;
  }
  return <StatusBadge durum="success">Taze</StatusBadge>;
}
