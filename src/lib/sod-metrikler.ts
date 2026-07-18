// SoD üretim panosu metrikleri (docs/ROADMAP.md M16 #8, master talimat §9.1).
//
// SAF ve DETERMİNİSTİK (kural 11): DB'ye dokunmaz, `simdi` enjekte edilir —
// aynı girdi aynı metrikleri verir, birim testte sınanır. Sayfa yalnız ham
// satırları çekip buraya verir.
//
// TEK BİRLEŞİK SKOR YOK (master §9.1: "gösterişli ama yanıltıcı compliance
// score üretme"): her metrik paydası ve belirsizliğiyle AYRI raporlanır —
// "değerlendirilemeyen kural" (eksik tanım) gizlenmez, 'unknown' olarak
// görünür (kural 13'ün ruhu).

export interface MetrikKuralGirdisi {
  id: string;
  durum: string; // aktif | pasif
  mevzuat_durumu: string; // INTERNAL | TODO_DOGRULA | VERIFIED
}

export interface MetrikAtamaGirdisi {
  kisiKimligi: string;
  gecerlilik_bitis: string | null; // ISO tarih
}

export interface MetrikCatismaGirdisi {
  durum: string;
  ilk_gorulme_at: string; // ISO zaman
}

export interface MetrikIstisnaGirdisi {
  durum: string;
  bitis: string; // ISO tarih
}

export interface MetrikImportGirdisi {
  created_at: string;
  kaynak: string;
}

export interface SodMetrikleri {
  /** Kapsama: değerlendirmeye fiilen girebilen malzeme — payda görünür. */
  kapsama: {
    aktifKural: number;
    /** Aktif ama A/B taraf çifti eksik → motor değerlendiremiyor (unknown). */
    eksikTanimliKural: number;
    aktifAtama: number;
    sonaErmisAtama: number;
    /** Aktif atamalardaki farklı kimlik sayısı. */
    kisiSayisi: number;
  };
  /** Kural 3 görünürlüğü: doğrulanmış kural oranı (pay/payda ayrı). */
  mevzuat: { verified: number; todoDogrula: number; internal: number };
  /** Çatışma yaşam döngüsü — durumlar BİRLEŞTİRİLMEZ, gruplar yalnız sunum. */
  catisma: {
    acik: number; // OPEN + REOPENED
    incelemede: number; // UNDER_REVIEW + EXCEPTION_REQUESTED
    kontrolAltinda: number; // EXCEPTION_APPROVED + MITIGATED
    kapali: number; // RESOLVED + FALSE_POSITIVE
    dagilim: Record<string, number>;
  };
  /** Onaylı istisnalardan bitişi <= 14 gün kalanlar (uzatma penceresi). */
  yaklasanIstisna: number;
  /**
   * Son import'tan SONRA ilk kez görülen çatışma sayısı (kurucu #8:
   * "importtan sonra yeni çatışmalar"). null = henüz import yok — 0 İLE
   * KARIŞTIRILMAZ (0 "import oldu, yeni çatışma çıkmadı" demektir).
   */
  importSonrasiYeniCatisma: number | null;
  sonImport: MetrikImportGirdisi | null;
}

const YAKLASAN_ESIK_GUN = 14;

export function sodMetrikleriHesapla(
  girdi: {
    kurallar: MetrikKuralGirdisi[];
    tamTanimliKuralIdleri: Set<string>;
    atamalar: MetrikAtamaGirdisi[];
    catismalar: MetrikCatismaGirdisi[];
    istisnalar: MetrikIstisnaGirdisi[];
    sonImport: MetrikImportGirdisi | null;
  },
  simdi: Date,
): SodMetrikleri {
  const aktifKurallar = girdi.kurallar.filter((k) => k.durum === "aktif");
  const eksikTanimli = aktifKurallar.filter((k) => !girdi.tamTanimliKuralIdleri.has(k.id));

  const aktifAtamalar = girdi.atamalar.filter(
    (a) => a.gecerlilik_bitis === null || new Date(a.gecerlilik_bitis) >= simdi,
  );

  const dagilim: Record<string, number> = {};
  for (const c of girdi.catismalar) {
    dagilim[c.durum] = (dagilim[c.durum] ?? 0) + 1;
  }
  const say = (...durumlar: string[]) => durumlar.reduce((t, d) => t + (dagilim[d] ?? 0), 0);

  const esik = new Date(simdi.getTime() + YAKLASAN_ESIK_GUN * 86_400_000);
  const yaklasan = girdi.istisnalar.filter(
    (i) => i.durum === "onaylandi" && new Date(i.bitis) <= esik && new Date(i.bitis) >= simdi,
  ).length;

  const importSonrasi = girdi.sonImport
    ? girdi.catismalar.filter((c) => new Date(c.ilk_gorulme_at) > new Date(girdi.sonImport!.created_at))
        .length
    : null;

  return {
    kapsama: {
      aktifKural: aktifKurallar.length,
      eksikTanimliKural: eksikTanimli.length,
      aktifAtama: aktifAtamalar.length,
      sonaErmisAtama: girdi.atamalar.length - aktifAtamalar.length,
      kisiSayisi: new Set(aktifAtamalar.map((a) => a.kisiKimligi)).size,
    },
    mevzuat: {
      verified: aktifKurallar.filter((k) => k.mevzuat_durumu === "VERIFIED").length,
      todoDogrula: aktifKurallar.filter((k) => k.mevzuat_durumu === "TODO_DOGRULA").length,
      internal: aktifKurallar.filter((k) => k.mevzuat_durumu === "INTERNAL").length,
    },
    catisma: {
      acik: say("OPEN", "REOPENED"),
      incelemede: say("UNDER_REVIEW", "EXCEPTION_REQUESTED"),
      kontrolAltinda: say("EXCEPTION_APPROVED", "MITIGATED"),
      kapali: say("RESOLVED", "FALSE_POSITIVE"),
      dagilim,
    },
    yaklasanIstisna: yaklasan,
    importSonrasiYeniCatisma: importSonrasi,
    sonImport: girdi.sonImport,
  };
}
