// PrivacyOps saf yardımcıları (M36, G6; kural 11: deterministik, `simdi`
// parametre). Süre saatleri (DSAR/ihlal) SAKLANMAZ — türetilir; gerçek-zamanlı
// alarm (M05 incident clock ilkesi). Veri minimizasyonu için maskeleme.

const SAAT_MS = 60 * 60 * 1000;
const GUN_MS = 24 * SAAT_MS;

/** KVKK ihlal → otorite bildirimi: tespit + 72 saat (varsayılan). */
export const IHLAL_OTORITE_SAAT = 72;

export interface SureSaati {
  sonTarih: string; // ISO
  kalanSaat: number;
  gecikti: boolean;
  mesaj: string;
}

/** DSAR yasal süre saati: alındı + yasal_sure_gun. */
export function dsarSonTarih(
  alindiAt: string,
  yasalSureGun: number,
  simdi: string | Date,
): SureSaati {
  const sonMs = new Date(alindiAt).getTime() + yasalSureGun * GUN_MS;
  const simdiMs = typeof simdi === "string" ? new Date(simdi).getTime() : simdi.getTime();
  const kalanSaat = Math.floor((sonMs - simdiMs) / SAAT_MS);
  const gecikti = kalanSaat < 0;
  const kalanGun = Math.floor(kalanSaat / 24);
  return {
    sonTarih: new Date(sonMs).toISOString(),
    kalanSaat,
    gecikti,
    mesaj: gecikti
      ? `Süre ${Math.abs(kalanGun)} gün aşıldı`
      : `Kalan: ${kalanGun} gün`,
  };
}

/** İhlal otorite bildirim saati: tespit + IHLAL_OTORITE_SAAT saat. */
export function ihlalBildirimSaati(
  tespitAt: string,
  simdi: string | Date,
  bildirildiAt: string | null = null,
  esikSaat: number = IHLAL_OTORITE_SAAT,
): SureSaati {
  const sonMs = new Date(tespitAt).getTime() + esikSaat * SAAT_MS;
  const referansMs = bildirildiAt
    ? new Date(bildirildiAt).getTime()
    : typeof simdi === "string"
      ? new Date(simdi).getTime()
      : simdi.getTime();
  const kalanSaat = Math.floor((sonMs - referansMs) / SAAT_MS);
  const gecikti = kalanSaat < 0;
  return {
    sonTarih: new Date(sonMs).toISOString(),
    kalanSaat,
    gecikti,
    mesaj: bildirildiAt
      ? gecikti
        ? `Bildirim ${Math.abs(kalanSaat)} saat GEÇ yapıldı`
        : "Süresinde bildirildi"
      : gecikti
        ? `Otorite bildirimi ${Math.abs(kalanSaat)} saat gecikti`
        : `Otorite bildirimine ${kalanSaat} saat`,
  };
}

/**
 * Veri sahibi tanımlayıcısını maskeler (veri minimizasyonu). E-posta:
 * ilk karakter + *** + domain; diğer: ilk 2 + *** + son 2.
 */
export function maskele(deger: string): string {
  const s = deger.trim();
  if (s.includes("@")) {
    const [yerel, domain] = s.split("@");
    const bas = yerel.slice(0, 1);
    return `${bas}***@${domain}`;
  }
  if (s.length <= 4) return "***";
  return `${s.slice(0, 2)}***${s.slice(-2)}`;
}
