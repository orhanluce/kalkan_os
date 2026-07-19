// Etki grafiği saf yardımcıları (Dikey 5, M13/M35 grafının genişlemesi;
// kural 11: dış çağrı/rastgelelik yok, aynı girdi aynı sonuç).
//
// M13'ün tekilNoktaAnalizi (dayaniklilik.ts) ve M35'in konsantrasyonAnalizi
// (tedarikci.ts) fonksiyonları BURADA TEKRAR EDİLMEZ — mevcut graf bu
// modülde YENİ kenar türleriyle (kritik hizmet → kontrol, tedarikçi →
// dördüncü taraf zinciri) genişletilir. Nihai talimat v3.3 §8.0 Dikey 5:
// "tek sahte skor YOK" — iyileştirme önceliği tek bir opak sayı değil,
// AÇIKLANABİLİR faktör listesi olarak döner.

export interface ZincirHizmet {
  kritikHizmetAd: string;
  bagimliliklar: { bagimlilikTuru: string; thirdPartyId: string | null }[];
}

export interface ZincirTedarikci {
  thirdPartyId: string;
  thirdPartyAd: string;
  dorduncuTaraflar: { ad: string | null; bilinmiyor: boolean }[];
}

export interface ZincirlemeEtkiYolu {
  kritikHizmetAd: string;
  tedarikciAd: string;
  /** null yalnızca bilinmiyor=true iken (ad uydurulmaz). */
  dorduncuTarafAd: string | null;
  bilinmiyor: boolean;
}

/**
 * Zincirleme etki yolu: kritik hizmet → tedarikçi (TEDARIKCI bağımlılığı) →
 * o tedarikçinin dördüncü tarafları (M35). Doğrudan bağımlılığın ÖTESİNDEKİ
 * gizli maruziyeti gösterir — bilinmeyen dördüncü taraf DÜŞÜK RİSK
 * VARSAYILMAZ, ayrı işaretlenir (bilinmiyor: true, ad: null).
 */
export function zincirlemeEtkiYollari(hizmetler: ZincirHizmet[], tedarikciler: ZincirTedarikci[]): ZincirlemeEtkiYolu[] {
  const tedarikciMap = new Map(tedarikciler.map((t) => [t.thirdPartyId, t]));
  const yollar: ZincirlemeEtkiYolu[] = [];

  for (const h of hizmetler) {
    for (const b of h.bagimliliklar) {
      if (b.bagimlilikTuru !== "TEDARIKCI" || !b.thirdPartyId) continue;
      const t = tedarikciMap.get(b.thirdPartyId);
      if (!t) continue;
      for (const d of t.dorduncuTaraflar) {
        yollar.push({
          kritikHizmetAd: h.kritikHizmetAd,
          tedarikciAd: t.thirdPartyAd,
          dorduncuTarafAd: d.bilinmiyor ? null : d.ad,
          bilinmiyor: d.bilinmiyor,
        });
      }
    }
  }

  yollar.sort((a, b) =>
    `${a.kritikHizmetAd}|${a.tedarikciAd}|${a.dorduncuTarafAd ?? ""}`.localeCompare(
      `${b.kritikHizmetAd}|${b.tedarikciAd}|${b.dorduncuTarafAd ?? ""}`,
    ),
  );
  return yollar;
}

export interface KontrolBagi {
  kritikHizmetAd: string;
  controlId: string;
  controlAd: string;
}

export interface KontrolEtkiSonucu {
  controlId: string;
  controlAd: string;
  etkilenenHizmetler: string[];
  etkilenenHizmetSayisi: number;
}

/**
 * En çok kritik hizmet etkileyen kontroller: critical_service_controls
 * kenarından türetilir (kritik hizmet → kontrol). Kontrolün kendisi
 * bozulursa/koşusu FAILED olursa kaç kritik hizmetin doğrudan etkilendiğini
 * gösterir — sıralama AÇIK (etkilenen hizmet sayısı + ad), opak skor yok.
 */
export function enCokKritikHizmetEtkileyenKontroller(baglar: KontrolBagi[]): KontrolEtkiSonucu[] {
  const map = new Map<string, { controlAd: string; hizmetler: Set<string> }>();
  for (const b of baglar) {
    if (!map.has(b.controlId)) map.set(b.controlId, { controlAd: b.controlAd, hizmetler: new Set() });
    map.get(b.controlId)!.hizmetler.add(b.kritikHizmetAd);
  }
  const sonuc: KontrolEtkiSonucu[] = [...map.entries()].map(([controlId, v]) => ({
    controlId,
    controlAd: v.controlAd,
    etkilenenHizmetler: [...v.hizmetler].sort(),
    etkilenenHizmetSayisi: v.hizmetler.size,
  }));
  sonuc.sort((a, b) => b.etkilenenHizmetSayisi - a.etkilenenHizmetSayisi || a.controlAd.localeCompare(b.controlAd));
  return sonuc;
}

export interface IyilestirmeGirdi {
  hedefId: string;
  hedefAd: string;
  etkilenenHizmetSayisi: number;
  sistemikTekilNoktaMi: boolean;
  tedarikciYogunlasmaNoktasiMi: boolean;
  acikKritikBulguVarMi: boolean;
}

export interface IyilestirmeOnceligi {
  hedefId: string;
  hedefAd: string;
  /** İnsan-okur, açıklanabilir gerekçeler — TEK SAHTE SKOR YOK (nihai talimat v3.3 §8.0). */
  faktorler: string[];
  faktorSayisi: number;
  etkilenenHizmetSayisi: number;
}

/**
 * İyileştirme önceliği: her hedefin (kontrol/bağımlılık) tetiklediği
 * faktörleri sayar ve bunları AÇIKÇA listeler. Tek bir birleşik puan
 * ÜRETİLMEZ — sıralama faktör sayısı + etkilenen hizmet sayısı + ad ile
 * deterministik, ama "neden öncelikli" sorusunun cevabı her zaman
 * faktör listesinde okunabilir kalır.
 */
export function iyilestirmeOnceligiSirala(girdi: IyilestirmeGirdi[]): IyilestirmeOnceligi[] {
  const sonuc: IyilestirmeOnceligi[] = girdi.map((g) => {
    const faktorler: string[] = [];
    if (g.sistemikTekilNoktaMi) faktorler.push("Sistemik tekil nokta");
    if (g.etkilenenHizmetSayisi >= 2) faktorler.push(`${g.etkilenenHizmetSayisi} kritik hizmeti etkiliyor`);
    if (g.tedarikciYogunlasmaNoktasiMi) faktorler.push("Tedarikçi yoğunlaşma noktası");
    if (g.acikKritikBulguVarMi) faktorler.push("Açık kritik/yüksek bulgu var");
    return {
      hedefId: g.hedefId,
      hedefAd: g.hedefAd,
      faktorler,
      faktorSayisi: faktorler.length,
      etkilenenHizmetSayisi: g.etkilenenHizmetSayisi,
    };
  });
  sonuc.sort(
    (a, b) => b.faktorSayisi - a.faktorSayisi || b.etkilenenHizmetSayisi - a.etkilenenHizmetSayisi || a.hedefAd.localeCompare(b.hedefAd),
  );
  return sonuc.filter((s) => s.faktorSayisi > 0);
}

// --- M21/M42 dayanıklılık taksonomisi: 8 üst alan (tezden, THESIS_DERIVED) ---
// 29 alt kategori bu dilimde DOĞRUDAN BAĞLANMAZ (nihai talimat v3.3 §8.0,
// bilinçli dar kapsam). Sıra sabit — kapsamı sıfır olan alan da GÖRÜNÜR
// (sessiz boşluk yok, kural 3 ruhu).
export const DAYANIKLILIK_ALAN_ETIKETLERI: Record<string, string> = {
  YONETISIM: "Yönetişim",
  ONGORU_HAZIRLIK: "Öngörü / Hazırlık / Tanımlama",
  ONLEME_KORUMA: "Önleme / Koruma",
  IZLEME_TESPIT: "İzleme / Tespit",
  MUDAHALE: "Müdahale",
  KURTARMA: "Kurtarma",
  TEHDIT_ISTIHBARATI: "Tehdit İstihbaratı / Paylaşım",
  UCUNCU_TARAF: "Üçüncü Taraf Yönetimi",
};

export const DAYANIKLILIK_ALAN_SIRASI = Object.keys(DAYANIKLILIK_ALAN_ETIKETLERI);

export interface DomainKapsamGirdisi {
  kategori: string;
  dogrulamaDurumu: string;
}

export interface DomainKapsamSonucu {
  kategori: string;
  etiket: string;
  toplam: number;
  verifiedSayisi: number;
  /** VERIFIED sınıflandırma en az bir varsa true — TODO_DOGRULA "kapsanıyor" sayılmaz. */
  kapsamVar: boolean;
}

/**
 * 8 üst alan kapsam özeti: her alana bağlı kontrol sınıflandırması sayısı +
 * bunlardan kaçı VERIFIED. Kapsamı sıfır olan alan da listede kalır —
 * "hiç bağlanmamış alan" dürüstçe görünür kılınır.
 */
export function dayaniklilikKapsamOzeti(baglar: DomainKapsamGirdisi[]): DomainKapsamSonucu[] {
  const sayac = new Map<string, { toplam: number; verified: number }>();
  for (const k of DAYANIKLILIK_ALAN_SIRASI) sayac.set(k, { toplam: 0, verified: 0 });
  for (const b of baglar) {
    if (!sayac.has(b.kategori)) sayac.set(b.kategori, { toplam: 0, verified: 0 });
    const s = sayac.get(b.kategori)!;
    s.toplam += 1;
    if (b.dogrulamaDurumu === "VERIFIED") s.verified += 1;
  }
  return DAYANIKLILIK_ALAN_SIRASI.map((k) => ({
    kategori: k,
    etiket: DAYANIKLILIK_ALAN_ETIKETLERI[k],
    toplam: sayac.get(k)!.toplam,
    verifiedSayisi: sayac.get(k)!.verified,
    kapsamVar: sayac.get(k)!.verified > 0,
  }));
}
