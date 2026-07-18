// Regülatör yazışması saf yardımcıları (M38, G7; kural 11).
import { canonicalHash, type CanonicalDeger } from "./canonical";

const GUN_MS = 24 * 60 * 60 * 1000;

export interface TalepSaati {
  kalanGun: number | null;
  gecikti: boolean;
  mesaj: string;
}

/** PBC/talep son tarih saati (deterministik; `simdi` parametre). */
export function talepSonTarih(sonTarih: string | null, simdi: string | Date): TalepSaati {
  if (sonTarih === null) return { kalanGun: null, gecikti: false, mesaj: "Son tarih yok" };
  const simdiMs = typeof simdi === "string" ? new Date(simdi).getTime() : simdi.getTime();
  const kalanGun = Math.ceil((new Date(sonTarih).getTime() - simdiMs) / GUN_MS);
  const gecikti = kalanGun < 0;
  return {
    kalanGun,
    gecikti,
    mesaj: gecikti ? `Süre ${Math.abs(kalanGun)} gün aşıldı` : `Kalan: ${kalanGun} gün`,
  };
}

export const GONDERIM_MAKBUZU_SCHEMA = "KALKAN_REG_SUBMISSION_RECEIPT_V1";

/**
 * Gönderim makbuzu: gönderilen yanıtın deterministik hash'i (ne gönderdik).
 * İçerik + istek + sürüm mühürlenir (kendi RFC 8785 uygulamamız).
 */
export function gonderimMakbuzu(requestId: string, surum: number, icerik: string): Promise<string> {
  return canonicalHash({
    schema: GONDERIM_MAKBUZU_SCHEMA,
    requestId,
    surum,
    icerik,
  } as unknown as CanonicalDeger);
}
