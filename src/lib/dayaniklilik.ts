// Operasyonel dayanıklılık saf yardımcıları (M13, G8; kural 11).
// Kritik hizmetlerin bağımlılık grafından tekil-nokta/yoğunlaşma türetir.

export interface HizmetBagimliligi {
  ad: string;
  bagimlilikTuru: string;
  tekilNokta: boolean;
}

export interface KritikHizmetGraf {
  id: string;
  ad: string;
  bagimliliklar: HizmetBagimliligi[];
}

export interface TekilNoktaSonucu {
  /** Birden fazla kritik hizmetin paylaştığı bağımlılık (sistemik tekil nokta). */
  sistemikNoktalar: { bagimlilikAd: string; etkilenenHizmetler: string[] }[];
  /** Açıkça "tekil nokta" işaretli bağımlılıklar (hizmet-bağımlılık çiftleri). */
  isaretliTekilNoktalar: { hizmetAd: string; bagimlilikAd: string }[];
}

/**
 * Tekil-nokta analizi: aynı bağımlılığa dayanan birden fazla kritik hizmeti
 * (sistemik risk) ve açıkça işaretli tekil noktaları bulur. Deterministik.
 */
export function tekilNoktaAnalizi(graf: KritikHizmetGraf[]): TekilNoktaSonucu {
  const paylasim = new Map<string, Set<string>>();
  const isaretli: { hizmetAd: string; bagimlilikAd: string }[] = [];

  for (const h of graf) {
    for (const b of h.bagimliliklar) {
      const anahtar = b.ad.trim().toLowerCase();
      if (!paylasim.has(anahtar)) paylasim.set(anahtar, new Set());
      paylasim.get(anahtar)!.add(h.ad);
      if (b.tekilNokta) isaretli.push({ hizmetAd: h.ad, bagimlilikAd: b.ad });
    }
  }

  const sistemikNoktalar: TekilNoktaSonucu["sistemikNoktalar"] = [];
  for (const [anahtar, hizmetler] of paylasim) {
    if (hizmetler.size >= 2) {
      sistemikNoktalar.push({ bagimlilikAd: anahtar, etkilenenHizmetler: [...hizmetler].sort() });
    }
  }
  sistemikNoktalar.sort((a, b) => a.bagimlilikAd.localeCompare(b.bagimlilikAd));
  isaretli.sort((a, b) => `${a.hizmetAd}|${a.bagimlilikAd}`.localeCompare(`${b.hizmetAd}|${b.bagimlilikAd}`));

  return { sistemikNoktalar, isaretliTekilNoktalar: isaretli };
}
