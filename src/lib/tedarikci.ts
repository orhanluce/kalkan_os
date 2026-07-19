// Tedarikçi/ICT tedarik zinciri riski — saf, deterministik yardımcılar
// (M35, Gate G4; kural 11: dış çağrı/rastgelelik yok, aynı girdi aynı sonuç).
//
// Yoğunlaşma (concentration), sözleşme süre-yakınlığı ve DORA RoI iskeleti
// türetimi burada; karar (vendor kabul/red) DB'de insana ait (kural: rating
// otomatik karar değildir).

export type Tier = "KRITIK" | "ONEMLI" | "DUSUK";

export interface DorduncuTaraf {
  id: string;
  ad: string | null;
  bilinmiyor: boolean;
}

export interface TedarikciGraf {
  id: string;
  ad: string;
  tier: Tier;
  kritikHizmetVar: boolean;
  dorduncuTaraflar: DorduncuTaraf[];
}

export interface YogunlasmaNoktasi {
  /** Dördüncü tarafın adı (normalize: trim + küçük harf eşleşmesi). */
  dorduncuTarafAd: string;
  /** Bu dördüncü tarafa bağımlı DİSTİNKT tedarikçiler (ad). */
  bagimliTedarikciler: string[];
}

export interface KonsantrasyonSonucu {
  /** Birden fazla tedarikçinin paylaştığı dördüncü taraflar (yoğunlaşma). */
  yogunlasmaNoktalari: YogunlasmaNoktasi[];
  /** Bilinmeyen alt-bağımlılığı olan tedarikçiler — DÜŞÜK RİSK VARSAYILMAZ. */
  bilinmeyenBagimliligiOlanlar: string[];
}

/**
 * Yoğunlaşma analizi: aynı dördüncü tarafa bağımlı birden fazla tedarikçiyi
 * bulur (tek sağlayıcı çöktüğünde etkilenen kritik hizmet kümesi). Bilinmeyen
 * dördüncü taraflar AYRI raporlanır — "bilinmiyor" düşük risk sayılmaz.
 */
export function konsantrasyonAnalizi(graf: TedarikciGraf[]): KonsantrasyonSonucu {
  // ad(normalize) -> bağımlı tedarikçi adları (set)
  const bagimlilik = new Map<string, Set<string>>();
  const bilinmeyen = new Set<string>();

  for (const t of graf) {
    for (const d of t.dorduncuTaraflar) {
      if (d.bilinmiyor || d.ad === null) {
        bilinmeyen.add(t.ad);
        continue;
      }
      const anahtar = d.ad.trim().toLowerCase();
      if (!bagimlilik.has(anahtar)) bagimlilik.set(anahtar, new Set());
      bagimlilik.get(anahtar)!.add(t.ad);
    }
  }

  const yogunlasmaNoktalari: YogunlasmaNoktasi[] = [];
  for (const [anahtar, tedarikciler] of bagimlilik) {
    if (tedarikciler.size >= 2) {
      yogunlasmaNoktalari.push({
        dorduncuTarafAd: anahtar,
        bagimliTedarikciler: [...tedarikciler].sort(),
      });
    }
  }
  // Deterministik sıra (kural 11).
  yogunlasmaNoktalari.sort((a, b) => a.dorduncuTarafAd.localeCompare(b.dorduncuTarafAd));

  return {
    yogunlasmaNoktalari,
    bilinmeyenBagimliligiOlanlar: [...bilinmeyen].sort(),
  };
}

export interface SozlesmeYakinlik {
  /** Bitişe kalan gün (negatif = geçmiş). */
  kalanGun: number;
  /** Eşik içinde mi (yaklaşan yenileme). */
  yaklasiyor: boolean;
  /** Süresi geçmiş mi. */
  gecmis: boolean;
  mesaj: string;
}

const GUN_MS = 24 * 60 * 60 * 1000;
export const VARSAYILAN_YENILEME_ESIGI_GUN = 60;

/** Sözleşme bitişine yakınlık (deterministik; `simdi` parametre). */
export function sozlesmeYakinligi(
  bitis: string,
  simdi: string | Date,
  esikGun: number = VARSAYILAN_YENILEME_ESIGI_GUN,
): SozlesmeYakinlik {
  const simdiMs = typeof simdi === "string" ? new Date(simdi).getTime() : simdi.getTime();
  const kalanGun = Math.ceil((new Date(bitis).getTime() - simdiMs) / GUN_MS);
  const gecmis = kalanGun < 0;
  const yaklasiyor = !gecmis && kalanGun <= esikGun;
  return {
    kalanGun,
    yaklasiyor,
    gecmis,
    mesaj: gecmis
      ? `Süresi ${Math.abs(kalanGun)} gün önce doldu`
      : yaklasiyor
        ? `Yenileme yaklaşıyor: ${kalanGun} gün`
        : `Bitiş: ${kalanGun} gün sonra`,
  };
}

// --- Değerlendirme / bulgu türetimleri (M35 sonraki dilim; kural 11) ---

export type Ciddiyet = "DUSUK" | "ORTA" | "YUKSEK" | "KRITIK";
export type BulguDurum = "ACIK" | "AKSIYON_PLANLI" | "KAPANDI";

export interface Bulgu {
  ciddiyet: Ciddiyet;
  durum: BulguDurum;
}

export interface BulguOzeti {
  ciddiyetSayisi: Record<Ciddiyet, number>;
  acikSayisi: number;
  acikKritikVar: boolean;
  /** Açık kritik bulgu olmadan değerlendirme TAMAMLANDI olabilir mi. */
  tamamlanabilir: boolean;
}

/**
 * Bulgu dağılımı + değerlendirme tamamlanabilirliği (saf; DB guard'ıyla AYNI
 * kural): açık (KAPANDI olmayan) KRİTİK bulgu varsa değerlendirme kapatılamaz.
 * Bu türetim yalnız EKRAN içindir; zorlama DB'de (assessment_tamamla_guard).
 */
export function bulguOzeti(bulgular: Bulgu[]): BulguOzeti {
  const ciddiyetSayisi: Record<Ciddiyet, number> = { DUSUK: 0, ORTA: 0, YUKSEK: 0, KRITIK: 0 };
  let acikSayisi = 0;
  let acikKritikVar = false;
  for (const b of bulgular) {
    ciddiyetSayisi[b.ciddiyet] += 1;
    if (b.durum !== "KAPANDI") {
      acikSayisi += 1;
      if (b.ciddiyet === "KRITIK") acikKritikVar = true;
    }
  }
  return { ciddiyetSayisi, acikSayisi, acikKritikVar, tamamlanabilir: !acikKritikVar };
}

export const ROI_SCHEMA = "KALKAN_DORA_ROI_MVP_V1";

export interface RoiGirdisi {
  tedarikci: { ad: string; ulke: string | null; tier: Tier; karar: string };
  hizmetler: { hizmet_adi: string; kritik: boolean; veri_siniflari: string[] }[];
  sozlesmeler: { sozlesme_ref: string; baslangic: string; bitis: string; denetim_hakki: boolean; cikis_maddesi: boolean }[];
  dorduncuTaraflar: { ad: string | null; bilinmiyor: boolean; ulke: string | null }[];
}

/**
 * DORA "Register of Information" iskeleti (MVP şekli — resmî RTS şeması AÇIK
 * KARAR; sahte "resmî RoI" iddiası YOK). Tedarikçi grafından TÜRETİLİR
 * (invariant: RoI alanları saklanmaz, üretilir). Bilinmeyen dördüncü taraf
 * dürüstçe işaretlenir.
 */
export function roiKaydiUret(girdi: RoiGirdisi) {
  return {
    schema: ROI_SCHEMA,
    uyari: "Bu MVP iskelesidir; resmî DORA RTS Register of Information şeması açık karardır.",
    tedarikci: girdi.tedarikci,
    kritikHizmetSayisi: girdi.hizmetler.filter((h) => h.kritik).length,
    hizmetler: girdi.hizmetler,
    sozlesmeler: girdi.sozlesmeler,
    dorduncuTaraflar: girdi.dorduncuTaraflar,
    bilinmeyenAltBagimlilik: girdi.dorduncuTaraflar.some((d) => d.bilinmiyor),
  };
}
