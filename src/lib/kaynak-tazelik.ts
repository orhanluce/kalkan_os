// Kaynak tazeliği (QRegu PR-Q1', kural 8 + kural 11).
//
// "Kaynak erişilemiyorsa/çekilmemişse sistem güncel olduğunu İDDİA EDEMEZ."
// Bu modül o iddianın tek dürüst türetimidir: son BAŞARILI çekimin yaşına
// bakar; hiç çekim yoksa "güncellik iddia edilemez" der — "güncel" DEMEZ.
// Deterministik (kural 11): `simdi` parametredir, Date.now yok; aynı girdi
// her zaman aynı sonucu ve aynı mesajı verir.

export interface KaynakTazelik {
  /** Hiç başarılı çekim kaydı yok — güncellik iddiası kurulamaz. */
  hicCekimYok: boolean;
  /** Son başarılı çekimin yaşı (tam gün); çekim yoksa null. */
  sonBasariliYasGun: number | null;
  /** Yaş eşiği aştı — kaynak BAYAT sayılır (SOURCE_STALE sinyali). */
  bayat: boolean;
  /** UI'da gösterilecek dürüst mesaj. */
  mesaj: string;
}

const GUN_MS = 24 * 60 * 60 * 1000;

/** Varsayılan bayatlık eşiği (gün) — connector'lu kaynakta SLA ayrıca gelir. */
export const VARSAYILAN_BAYATLIK_ESIGI_GUN = 30;

export function kaynakTazeligi(
  sonBasariliCekim: string | null,
  simdi: string | Date,
  esikGun: number = VARSAYILAN_BAYATLIK_ESIGI_GUN,
): KaynakTazelik {
  if (sonBasariliCekim === null) {
    return {
      hicCekimYok: true,
      sonBasariliYasGun: null,
      bayat: false,
      mesaj: "Hiç çekim yok — güncellik iddia edilemez",
    };
  }
  const simdiMs = typeof simdi === "string" ? new Date(simdi).getTime() : simdi.getTime();
  const yasGun = Math.floor((simdiMs - new Date(sonBasariliCekim).getTime()) / GUN_MS);
  const bayat = yasGun > esikGun;
  return {
    hicCekimYok: false,
    sonBasariliYasGun: yasGun,
    bayat,
    mesaj: bayat
      ? `Kaynak bayat: son başarılı çekim ${yasGun} gün önce (eşik ${esikGun} gün)`
      : yasGun === 0
        ? "Son çekim: bugün"
        : `Son çekim: ${yasGun} gün önce`,
  };
}
