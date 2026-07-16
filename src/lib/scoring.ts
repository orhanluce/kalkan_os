// Simülasyon puanlama motoru (docs/ROADMAP.md M8, belge §9).
//
// DETERMİNİSTİK VE AÇIKLANABİLİR (CLAUDE.md kural 11):
//   - Aynı girdi her zaman aynı sonucu verir. Bu yüzden burada rastgelelik,
//     tarih okuma (Date.now) veya dış çağrı YOKTUR: her şey parametre olarak
//     gelir. Bir tatbikat sonucu denetime sunulacaksa, aynı veriyle yeniden
//     hesaplandığında aynı çıkmalıdır.
//   - Her puan satırı NEDEN o puanı aldığını taşır. Gerekçesiz puan,
//     katılımcıya "sistem böyle dedi" demekten ibarettir.
//   - AI burada yoktur ve olmamalıdır. Gözlem notlarını özetlemek ayrı bir
//     iştir; puanı deterministik kurallar belirler.
//
// KRİTİK BAŞARISIZLIK (belge §9.3): zorunlu bir aksiyon eksikse genel puan
// yüksek olsa bile sonuç CRITICAL_FAILURE'dır. Bir tatbikatta "ortalamayı
// tutturdu ama delil toplamadı" başarı değildir.

export type KuralTipi =
  | "ACTION_COMPLETED"
  | "ACTION_COMPLETED_WITHIN"
  | "ROLE_NOTIFIED_WITHIN"
  | "DECISION_SELECTED"
  | "EVIDENCE_UPLOADED"
  | "TASK_COMPLETED"
  | "RTO_WITHIN_TARGET"
  | "RPO_WITHIN_TARGET"
  | "OBSERVER_RATING"
  | "PENALTY_IF"
  | "MANDATORY_FAIL_IF";

export type Bilesen =
  | "zaman_hedefleri"
  | "zorunlu_aksiyonlar"
  | "rol_eskalasyon"
  | "kanit_yeterliligi"
  | "is_surekliligi"
  | "gozlemci";

export interface PuanlamaKurali {
  kod: string;
  tip: KuralTipi;
  bilesen: Bilesen;
  agirlik: number;
  aciklama: string;
  /** Kuralın bağlı olduğu beklenen aksiyon kodu (varsa). */
  beklenenAksiyon: string | null;
  parametreler: Record<string, unknown>;
}

/** Tatbikatta fiilen olan şey: hangi aksiyon, kaçıncı senaryo dakikasında tamamlandı. */
export interface AksiyonSonucu {
  kod: string;
  tamamlandi: boolean;
  /** Senaryo dakikası (gerçek zaman değil). Tamamlanmadıysa null. */
  dakika: number | null;
}

export interface PuanlamaGirdisi {
  kurallar: PuanlamaKurali[];
  aksiyonlar: AksiyonSonucu[];
  /** Verilen karar kodları (DECISION_SELECTED için). */
  verilenKararlar: string[];
  /** Gözlemci puanı 0-100 arası; yoksa null. */
  gozlemciPuani: number | null;
}

export type SatirSonuc = "gecti" | "kaldi" | "uygulanamadi";

export interface PuanSatiri {
  kod: string;
  bilesen: Bilesen;
  sonuc: SatirSonuc;
  /** Kazanılan puan (0..agirlik). */
  puan: number;
  agirlik: number;
  /** NEDEN bu puan verildi — kural 11. */
  gerekce: string;
}

export type GenelDurum = "BASARILI" | "KISMI" | "BASARISIZ" | "CRITICAL_FAILURE";

export interface PuanlamaSonucu {
  /** 0-100. Kritik başarısızlıkta bile hesaplanır — gizlenmez, ama durum ayrı söylenir. */
  puan: number;
  durum: GenelDurum;
  satirlar: PuanSatiri[];
  kritikBasarisizliklar: string[];
}

function aksiyonBul(girdi: PuanlamaGirdisi, kod: string | null): AksiyonSonucu | undefined {
  if (!kod) return undefined;
  return girdi.aksiyonlar.find((a) => a.kod === kod);
}

function sayi(parametreler: Record<string, unknown>, ad: string): number | null {
  const v = parametreler[ad];
  return typeof v === "number" ? v : null;
}

/**
 * Tek bir kuralı değerlendirir. Kuralın uygulanamadığı durum (örn. bağlı
 * aksiyon şablonda tanımlı değil) SESSİZCE geçilmez: "uygulanamadi" olarak
 * raporlanır ve paydadan düşer — aksi halde eksik bir şablon, puanı sessizce
 * şişirir veya düşürürdü.
 */
function kuraliDegerlendir(kural: PuanlamaKurali, girdi: PuanlamaGirdisi): PuanSatiri {
  const temel = { kod: kural.kod, bilesen: kural.bilesen, agirlik: kural.agirlik };
  const aksiyon = aksiyonBul(girdi, kural.beklenenAksiyon);

  switch (kural.tip) {
    case "OBSERVER_RATING": {
      if (girdi.gozlemciPuani === null) {
        return {
          ...temel,
          sonuc: "uygulanamadi",
          puan: 0,
          gerekce: "Gözlemci değerlendirmesi girilmedi.",
        };
      }
      // Gözlemci puanı toplamı TEK BAŞINA belirlemez (belge §9.3): yalnızca
      // kendi ağırlığı kadar katkı verir.
      const oran = Math.max(0, Math.min(100, girdi.gozlemciPuani)) / 100;
      return {
        ...temel,
        sonuc: oran >= 0.5 ? "gecti" : "kaldi",
        puan: kural.agirlik * oran,
        gerekce: `Gözlemci değerlendirmesi ${girdi.gozlemciPuani}/100.`,
      };
    }

    case "DECISION_SELECTED": {
      const kararKodu = kural.parametreler.karar_kodu;
      if (typeof kararKodu !== "string") {
        return { ...temel, sonuc: "uygulanamadi", puan: 0, gerekce: "Kural karar kodu tanımsız." };
      }
      const verildi = girdi.verilenKararlar.includes(kararKodu);
      return {
        ...temel,
        sonuc: verildi ? "gecti" : "kaldi",
        puan: verildi ? kural.agirlik : 0,
        gerekce: verildi ? `${kararKodu} kararı verildi.` : `${kararKodu} kararı verilmedi.`,
      };
    }

    case "MANDATORY_FAIL_IF": {
      // Bu kural puan vermez; kritik başarısızlığı işaretler. Ağırlığı varsa
      // bile puana katılmaz — "zorunlu" olmanın anlamı budur.
      const eksik = !aksiyon?.tamamlandi;
      return {
        ...temel,
        agirlik: 0,
        sonuc: eksik ? "kaldi" : "gecti",
        puan: 0,
        gerekce: eksik
          ? `KRİTİK: ${kural.aciklama}`
          : `Zorunlu aksiyon tamamlandı: ${kural.beklenenAksiyon}.`,
      };
    }

    case "ACTION_COMPLETED_WITHIN":
    case "ROLE_NOTIFIED_WITHIN":
    case "RTO_WITHIN_TARGET":
    case "RPO_WITHIN_TARGET": {
      const hedef = sayi(kural.parametreler, "dakika") ?? sayi(kural.parametreler, "hedef_dakika");
      if (hedef === null || !aksiyon) {
        return {
          ...temel,
          sonuc: "uygulanamadi",
          puan: 0,
          gerekce: "Hedef süre veya bağlı aksiyon tanımsız.",
        };
      }
      if (!aksiyon.tamamlandi || aksiyon.dakika === null) {
        return { ...temel, sonuc: "kaldi", puan: 0, gerekce: `Aksiyon tamamlanmadı (hedef ${hedef} dk).` };
      }
      const zamaninda = aksiyon.dakika <= hedef;
      return {
        ...temel,
        sonuc: zamaninda ? "gecti" : "kaldi",
        puan: zamaninda ? kural.agirlik : 0,
        // Süreyi HER İKİ durumda da yaz: "42 dakika, hedef 15" bilgisi,
        // katılımcıya ne kadar geciktiğini gösterir (belge §8.5 örneği).
        gerekce: `${aksiyon.dakika} dakikada tamamlandı, hedef ${hedef} dakika.`,
      };
    }

    case "PENALTY_IF": {
      const olustu = !aksiyon?.tamamlandi;
      return {
        ...temel,
        sonuc: olustu ? "kaldi" : "gecti",
        puan: olustu ? 0 : kural.agirlik,
        gerekce: olustu ? `Ceza koşulu oluştu: ${kural.aciklama}` : "Ceza koşulu oluşmadı.",
      };
    }

    // ACTION_COMPLETED, EVIDENCE_UPLOADED, TASK_COMPLETED: tamamlandı mı?
    default: {
      if (!aksiyon) {
        return { ...temel, sonuc: "uygulanamadi", puan: 0, gerekce: "Bağlı aksiyon tanımsız." };
      }
      return {
        ...temel,
        sonuc: aksiyon.tamamlandi ? "gecti" : "kaldi",
        puan: aksiyon.tamamlandi ? kural.agirlik : 0,
        gerekce: aksiyon.tamamlandi
          ? `Tamamlandı: ${kural.beklenenAksiyon}.`
          : `Tamamlanmadı: ${kural.beklenenAksiyon}.`,
      };
    }
  }
}

/**
 * Tatbikatı puanlar.
 *
 * Payda, UYGULANABİLEN kuralların ağırlık toplamıdır: uygulanamayan kurallar
 * (eksik şablon verisi, girilmemiş gözlemci puanı) hem paydan hem paydadan
 * düşer. Paydaya dahil etmek, şablon eksiğini katılımcının başarısızlığı gibi
 * gösterirdi.
 */
export function puanla(girdi: PuanlamaGirdisi): PuanlamaSonucu {
  const satirlar = girdi.kurallar.map((k) => kuraliDegerlendir(k, girdi));

  const kritikBasarisizliklar = satirlar
    .filter((s, i) => girdi.kurallar[i].tip === "MANDATORY_FAIL_IF" && s.sonuc === "kaldi")
    .map((s) => s.gerekce);

  const puanlananlar = satirlar.filter((s) => s.sonuc !== "uygulanamadi" && s.agirlik > 0);
  const toplamAgirlik = puanlananlar.reduce((t, s) => t + s.agirlik, 0);
  const kazanilan = puanlananlar.reduce((t, s) => t + s.puan, 0);

  // Hiç uygulanabilir kural yoksa 0 döndür: sıfıra bölmek yerine açıkça
  // "puanlanacak bir şey yoktu" demek daha dürüst.
  const puan = toplamAgirlik === 0 ? 0 : Math.round((kazanilan / toplamAgirlik) * 100);

  // Kritik başarısızlık, puandan BAĞIMSIZ olarak sonucu belirler (belge §9.3).
  const durum: GenelDurum =
    kritikBasarisizliklar.length > 0
      ? "CRITICAL_FAILURE"
      : puan >= 80
        ? "BASARILI"
        : puan >= 50
          ? "KISMI"
          : "BASARISIZ";

  return { puan, durum, satirlar, kritikBasarisizliklar };
}

/**
 * Başarısız kontrollerden bulgu önerisi üretir.
 *
 * Kural 11: öneri PROPOSED doğar, insan kabul etmeden gerçek bulgu olmaz.
 * Bu fonksiyon yalnızca ÖNERİ üretir — bulgu yaratmaz.
 */
export interface BulguOnerisi {
  controlId: string;
  baslik: string;
  gerekce: string;
  onem: "acil" | "kritik" | "yuksek" | "orta" | "dusuk";
}

export function bulguOnerileriUret(
  sonuc: PuanlamaSonucu,
  kurallar: PuanlamaKurali[],
  /** Beklenen aksiyon kodu -> kontrol id'leri (şablondaki eşleme). */
  aksiyonKontrolleri: Map<string, string[]>,
): BulguOnerisi[] {
  const oneriler: BulguOnerisi[] = [];

  for (const [i, satir] of sonuc.satirlar.entries()) {
    if (satir.sonuc !== "kaldi") continue;

    const kural = kurallar[i];
    if (!kural.beklenenAksiyon) continue;

    for (const controlId of aksiyonKontrolleri.get(kural.beklenenAksiyon) ?? []) {
      oneriler.push({
        controlId,
        baslik: kural.aciklama,
        // Gerekçe puanlama satırından gelir: öneri, "sistem böyle dedi"
        // değil ölçülen bir olguya dayanmalı (belge §8.5).
        gerekce: satir.gerekce,
        // MANDATORY_FAIL zaten kritik bir eksiği işaret ediyor.
        onem: kural.tip === "MANDATORY_FAIL_IF" ? "kritik" : "yuksek",
      });
    }
  }

  return oneriler;
}
