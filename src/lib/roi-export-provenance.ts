// DORA RoI export — alan bazlı kanıt zinciri (provenance) motoru. 37 Tez
// Dikey B, Faz 4 (docs/adr/PR0-37-tez-dikeyB-faz4-kanit-zinciri-2026-07-20.md).
//
// YENİ BİR MOTOR/MODEL İCAT EDİLMEDİ: iddia gösterim durumu `claim-guard.
// ts`'in `iddiaGosterimDurumuHesapla`'sıyla BİREBİR hesaplanır; kaynak
// durumu roi_kaynak_kayitlari/ict_service_types'ın KENDİ dogrulama_durumu
// sözlüğüyle. Bu dosya yalnız bu ikisini export satırlarına EŞLER ve
// "en kötüsü kazanır" (worst-of) ilkesiyle BİRLEŞTİRİR — legal-basis.ts'in
// AYNI ilkesi.
//
// KURAL 3/6 YAPISAL GARANTİ: kanıtı (iliskiliIddialar) OLMAYAN ve kaynağı
// VERIFIED OLMAYAN bir satır asla "VERIFIED" genelDurum alamaz — worst-of
// birleştirmede kaçış yolu yoktur.
import { iddiaGosterimDurumuHesapla, type DogrulamaDurumu, type IddiaGosterimDurumu, type IddiaSonucu } from "./claim-guard";
import type { RoiSablonPaketi } from "./roi-export";

export type RoiProvenanceDurum = IddiaGosterimDurumu | "KAYNAK_YOK";

const DURUM_SIRASI: Record<RoiProvenanceDurum, number> = {
  VERIFIED: 0,
  LEGAL_REVIEW_REQUIRED: 1,
  UNVERIFIED: 2,
  SURESI_GECMIS_INCELEME_GEREKLI: 3,
  REDDEDILDI: 4,
  KAYNAK_YOK: 5,
};

/** İki durumdan "daha kötü" olanı döner — deterministik, kural 11. */
function kotusu(a: RoiProvenanceDurum, b: RoiProvenanceDurum): RoiProvenanceDurum {
  return DURUM_SIRASI[a] >= DURUM_SIRASI[b] ? a : b;
}

function kaynakDurumuGosterimineCevir(d: DogrulamaDurumu): RoiProvenanceDurum {
  if (d === "VERIFIED") return "VERIFIED";
  if (d === "LEGAL_REVIEW") return "LEGAL_REVIEW_REQUIRED";
  if (d === "REJECTED" || d === "SUPERSEDED") return "REDDEDILDI";
  return "UNVERIFIED"; // DRAFT_RESEARCH, TODO_DOGRULA
}

export interface RoiKaynakDurumu {
  sablonKodu: string;
  alanKodu: string | null;
  dogrulamaDurumu: DogrulamaDurumu;
}

export interface RoiIliskiliIddia {
  id: string;
  hedefTablo: string | null;
  hedefId: string | null;
  sonuc: IddiaSonucu;
  dogrulamaDurumu: DogrulamaDurumu;
  yururlukTarihi: string | null;
  yenidenIncelemeGerekli: boolean;
}

export interface RoiExportProvenanceGirdisi {
  paket: RoiSablonPaketi;
  roiKaynaklari: RoiKaynakDurumu[];
  ictHizmetTurleri: { kod: string; dogrulamaDurumu: DogrulamaDurumu }[];
  iddialar: RoiIliskiliIddia[];
  /** Deterministik "bugün" — Date.now() burada YOK (kural 11). */
  asOf: string;
}

export interface RoiSatirProvenance {
  sablon: string;
  satirId: string;
  kaynakDurumu: RoiProvenanceDurum;
  iliskiliIddiaSayisi: number;
  genelDurum: RoiProvenanceDurum;
}

export interface RoiExportProvenanceRaporu {
  schema: "KALKAN_ROI_EXPORT_PROVENANCE_V1";
  satirlar: RoiSatirProvenance[];
  ozet: Record<RoiProvenanceDurum, number>;
  /**
   * Mühürleme anında dayanılan kaynak/iddia kimlikleri — reconciliation
   * cron'unun (kaynak SONRADAN değişirse export'u işaretlemek için) TEK
   * doğruluk kaynağı. Bu olmadan cron ya hiçbir şeyi izleyemez ya da
   * "hangi kayıtlar" sorusunu tahmin ederdi (uydurma) — kayıt anındaki
   * gerçek eşleşme burada donuyor.
   */
  izlenenler: {
    iddiaIdleri: string[];
    roiKaynaklari: { sablonKodu: string; alanKodu: string | null }[];
    ictHizmetKodlari: string[];
  };
}

function iliskiliIddialariBul(iddialar: RoiIliskiliIddia[], hedefTablo: string, hedefId: string, asOf: string): { sayi: number; enKotuDurum: RoiProvenanceDurum } {
  const eslesenler = iddialar.filter((i) => i.hedefTablo === hedefTablo && i.hedefId === hedefId);
  if (eslesenler.length === 0) return { sayi: 0, enKotuDurum: "KAYNAK_YOK" };
  let enKotu: RoiProvenanceDurum = "VERIFIED";
  for (const iddia of eslesenler) {
    const gosterim = iddiaGosterimDurumuHesapla({
      dogrulamaDurumu: iddia.dogrulamaDurumu,
      yururlukTarihi: iddia.yururlukTarihi,
      yenidenIncelemeGerekli: iddia.yenidenIncelemeGerekli,
      asOf,
    });
    enKotu = kotusu(enKotu, gosterim.gosterimDurumu);
  }
  return { sayi: eslesenler.length, enKotuDurum: enKotu };
}

function roiKaynakDurumuBul(kaynaklar: RoiKaynakDurumu[], sablonKodu: string, alanKodu: string | null): RoiProvenanceDurum {
  const adaylar = kaynaklar.filter((k) => k.sablonKodu === sablonKodu && (alanKodu === null || k.alanKodu === alanKodu || k.alanKodu === null));
  if (adaylar.length === 0) return "KAYNAK_YOK";
  return adaylar.map((k) => kaynakDurumuGosterimineCevir(k.dogrulamaDurumu)).reduce(kotusu);
}

/**
 * Export paketindeki her satır için provenance hesaplar. Sıra girdiden
 * BAĞIMSIZ (satırId'ye göre sıralı çıktı, kural 11).
 */
export function roiExportProvenanceOlustur(girdi: RoiExportProvenanceGirdisi): RoiExportProvenanceRaporu {
  const satirlar: RoiSatirProvenance[] = [];
  const iddiaIdSeti = new Set<string>();
  const roiKaynakSeti = new Map<string, { sablonKodu: string; alanKodu: string | null }>();
  const ictHizmetSeti = new Set<string>();

  function roiKaynakIzle(sablonKodu: string, alanKodu: string | null) {
    roiKaynakSeti.set(`${sablonKodu}::${alanKodu ?? ""}`, { sablonKodu, alanKodu });
  }

  function iddialariIzle(hedefTablo: string, hedefId: string) {
    for (const i of girdi.iddialar) {
      if (i.hedefTablo === hedefTablo && i.hedefId === hedefId) iddiaIdSeti.add(i.id);
    }
  }

  for (const s of girdi.paket.B_01_01) {
    void s;
    roiKaynakIzle("B_01.01", null);
    const kaynakDurumu = roiKaynakDurumuBul(girdi.roiKaynaklari, "B_01.01", null);
    satirlar.push({ sablon: "B_01.01", satirId: "kimlik", kaynakDurumu, iliskiliIddiaSayisi: 0, genelDurum: kaynakDurumu });
  }

  for (const s of girdi.paket.B_02_02) {
    roiKaynakIzle("B_02.02", "B_02.02.0060");
    let kaynakDurumu = roiKaynakDurumuBul(girdi.roiKaynaklari, "B_02.02", "B_02.02.0060");
    if (s.B_02_02_0060_hizmetTuru !== null) {
      ictHizmetSeti.add(s.B_02_02_0060_hizmetTuru);
      const hizmet = girdi.ictHizmetTurleri.find((h) => h.kod === s.B_02_02_0060_hizmetTuru);
      const hizmetDurumu = hizmet ? kaynakDurumuGosterimineCevir(hizmet.dogrulamaDurumu) : "KAYNAK_YOK";
      kaynakDurumu = kotusu(kaynakDurumu, hizmetDurumu);
    }
    iddialariIzle("third_party_contracts", s.id);
    const { sayi, enKotuDurum } = iliskiliIddialariBul(girdi.iddialar, "third_party_contracts", s.id, girdi.asOf);
    satirlar.push({
      sablon: "B_02.02",
      satirId: s.id,
      kaynakDurumu,
      iliskiliIddiaSayisi: sayi,
      genelDurum: kotusu(kaynakDurumu, enKotuDurum),
    });
  }

  for (const s of girdi.paket.B_06_01) {
    roiKaynakIzle("B_06.01", null);
    const kaynakDurumu = roiKaynakDurumuBul(girdi.roiKaynaklari, "B_06.01", null);
    iddialariIzle("critical_business_services", s.id);
    const { sayi, enKotuDurum } = iliskiliIddialariBul(girdi.iddialar, "critical_business_services", s.id, girdi.asOf);
    satirlar.push({
      sablon: "B_06.01",
      satirId: s.id,
      kaynakDurumu,
      iliskiliIddiaSayisi: sayi,
      genelDurum: kotusu(kaynakDurumu, enKotuDurum),
    });
  }

  satirlar.sort((a, b) => (a.sablon + a.satirId).localeCompare(b.sablon + b.satirId));

  const ozet: Record<RoiProvenanceDurum, number> = {
    VERIFIED: 0,
    LEGAL_REVIEW_REQUIRED: 0,
    UNVERIFIED: 0,
    SURESI_GECMIS_INCELEME_GEREKLI: 0,
    REDDEDILDI: 0,
    KAYNAK_YOK: 0,
  };
  for (const s of satirlar) ozet[s.genelDurum]++;

  return {
    schema: "KALKAN_ROI_EXPORT_PROVENANCE_V1",
    satirlar,
    ozet,
    izlenenler: {
      iddiaIdleri: [...iddiaIdSeti].sort(),
      roiKaynaklari: [...roiKaynakSeti.values()].sort((a, b) => (a.sablonKodu + (a.alanKodu ?? "")).localeCompare(b.sablonKodu + (b.alanKodu ?? ""))),
      ictHizmetKodlari: [...ictHizmetSeti].sort(),
    },
  };
}
