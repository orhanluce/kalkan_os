// M18 "sonraki dilim" borcu (ROADMAP §1.30/§1.52 sonu): tatbikat sonucunu
// eğitim tamamlamasına gerçek bağla (20260719280000).
//
// SAF FONKSİYON (kural 11): hangi atamaların otomatik tamamlanacağını
// belirler, YAZMAZ. Yazma (skor damgalama, service_role insert) rotada olur —
// burada yalnızca "kim, hangi atama" eşlemesi test edilebilir biçimde durur.

export interface SimulasyonKatilimci {
  userId: string;
  katilimTipi: "yonetici" | "katilimci" | "gozlemci";
}

/** Bir kiracıdaki AKTİF (ATANDI) atama + bağlı gereksinimin konusu. */
export interface AktifEgitimAtamasi {
  assignmentId: string;
  kullanici: string;
  konu: string;
}

export interface SimulasyonTamamlamaGirdisi {
  /** scenario_templates.egitim_konusu — null ise hiçbir bağ kurulmaz. */
  egitimKonusu: string | null;
  katilimcilar: SimulasyonKatilimci[];
  aktifAtamalar: AktifEgitimAtamasi[];
}

export interface OlusturulacakTamamlama {
  assignmentId: string;
  kullanici: string;
}

/**
 * Yalnızca KATILIMCI rolündeki kullanıcılar tamamlama alır — yönetici
 * tatbikatı yürütür, gözlemci değerlendirir; ikisi de "eğitim aldı" anlamına
 * gelmez. Konu eşleşmeyen ya da aktif ataması olmayan kullanıcı atlanır
 * (kurumun o eğitim matrisini hiç kurmamış olması hata değildir).
 */
export function simulasyonTamamlamalariniBelirle(
  girdi: SimulasyonTamamlamaGirdisi,
): OlusturulacakTamamlama[] {
  if (!girdi.egitimKonusu) return [];

  const katilimciKullanicilar = new Set(
    girdi.katilimcilar.filter((k) => k.katilimTipi === "katilimci").map((k) => k.userId),
  );

  return girdi.aktifAtamalar
    .filter((a) => a.konu === girdi.egitimKonusu && katilimciKullanicilar.has(a.kullanici))
    .map((a) => ({ assignmentId: a.assignmentId, kullanici: a.kullanici }));
}
