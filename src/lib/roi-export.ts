// DORA RoI Export Motoru — saf değerlendirme + şablon üretim katmanı (37 Tez
// Dikey B, Faz 3 ilk dilim, docs/adr/PR0-37-tez-dikeyB-faz3-export-2026-07-20.md).
//
// MİMARİ `legal-basis.ts`ten (M23) ÖDÜNÇ: sebepler[] (kod/seviye/mesaj),
// asOf parametresi, Date.now() yok, deterministik sıralama — ikinci bir
// motor mimarisi İCAT EDİLMEDİ.
//
// UYDURMA YOK (kural 3): yalnız kurucunun bu tur belirttiği 5 yapıdan
// (kimlik/hizmet türü/third_parties/fourth_parties/critical_business_
// services) doğrudan türeyen alanlar dolduruluyor. RoI'nin gerektirdiği ama
// bu yapılarda karşılığı olmayan alanlar (ör. B_06.01 RTO/RPO) `null` +
// `kapsamDisi: true` ile bırakılıyor.
//
// EXPORT ÖNCESİ ENGELLEME (kurucu talimatı): `roiExportOnKontrol` üretimi
// ENGELLEMEZ (taslak her zaman görülebilir) — yalnız YAYIN onayına
// (roi_export_runs guard'ı, ayrı) engel olan "blok" seviyeli sorunları
// SAYAR. Bugün hiçbir ict_service_types satırı VERIFIED olmadığından, ICT
// hizmet türü bağlı HER sözleşme bir blok sorunu üretir — bu DÜRÜST ve
// İSTENEN davranıştır (kural 3: doğrulanmamış kaynak export'a giremez).

export type RoiOnKontrolSeviye = "blok" | "uyari";

export interface RoiOnKontrolSorunu {
  kod: string;
  seviye: RoiOnKontrolSeviye;
  mesaj: string;
  alan?: string;
}

export interface RoiKimlik {
  lei: string | null;
  euid: string | null;
  ticaretSicilNo: string | null;
  ulkeKodu: string | null;
  paraBirimi: string | null;
  kurulusTuru: string | null;
  hiyerarsiSeviyesi: string | null;
  anaKurulusLei: string | null;
  kayitTutanKurulusLei: string | null;
  kayitTutanKurulusAdi: string | null;
}

export interface RoiHizmetTuru {
  kod: string;
  ad: string;
  dogrulamaDurumu: "DRAFT_RESEARCH" | "TODO_DOGRULA" | "LEGAL_REVIEW" | "VERIFIED" | "SUPERSEDED" | "REJECTED";
}

export interface RoiUcuncuTaraf {
  id: string;
  ad: string;
  ulke: string | null;
}

export interface RoiSozlesme {
  id: string;
  thirdPartyId: string;
  sozlesmeRef: string;
  baslangic: string; // ISO tarih
  bitis: string; // ISO tarih
  durum: "AKTIF" | "SURESI_DOLDU" | "FESHEDILDI";
  tedarikciKimlikKodu: string | null;
  tedarikciKimlikKoduTuru: string | null;
  ictHizmetTuruKod: string | null;
  veriSaklaniyorMu: boolean | null;
  veriSaklamaUlkesi: string | null;
  veriIslemeUlkesi: string | null;
  sonaErmeNedeni: string | null;
  bildirimSuresiKurumGun: number | null;
  bildirimSuresiSaglayiciGun: number | null;
}

export interface RoiAltYuklenici {
  id: string;
  thirdPartyId: string;
  thirdPartyContractId: string | null;
  ad: string | null;
  bilinmiyor: boolean;
  ulke: string | null;
  sira: number | null;
  ictHizmetTuruKod: string | null;
}

export interface RoiKritikFonksiyon {
  id: string;
  ad: string;
  durum: "AKTIF" | "PASIF";
}

export interface RoiSozlesmeFonksiyonEslemesi {
  thirdPartyContractId: string;
  criticalServiceId: string;
}

export interface RoiExportGirdisi {
  kimlik: RoiKimlik | null;
  hizmetTurleri: RoiHizmetTuru[];
  ucuncuTaraflar: RoiUcuncuTaraf[];
  sozlesmeler: RoiSozlesme[];
  altYukleniciler: RoiAltYuklenici[];
  kritikFonksiyonlar: RoiKritikFonksiyon[];
  eslesmeler: RoiSozlesmeFonksiyonEslemesi[];
  /** Deterministik "bugün" — Date.now() burada YOK (kural 11). */
  asOf: string; // ISO tarih (yyyy-mm-dd)
}

export interface RoiOnKontrolSonucu {
  sorunlar: RoiOnKontrolSorunu[];
  engelleyiciSayisi: number;
}

function hizmetTuruDurumu(hizmetTurleri: RoiHizmetTuru[], kod: string | null): RoiHizmetTuru["dogrulamaDurumu"] | null {
  if (kod === null) return null;
  return hizmetTurleri.find((h) => h.kod === kod)?.dogrulamaDurumu ?? null;
}

/**
 * Ön-kontrol (kural 3 + kural 11): mevcut 5 yapının anlık görüntüsünden
 * blok/uyarı sorunları üretir. Girdi sırasından bağımsız, deterministik
 * sıralı çıktı.
 */
export function roiExportOnKontrol(girdi: RoiExportGirdisi): RoiOnKontrolSonucu {
  const sorunlar: RoiOnKontrolSorunu[] = [];

  if (girdi.kimlik === null) {
    sorunlar.push({ kod: "KIMLIK_YOK", seviye: "blok", mesaj: "Kurum yasal kimlik profili hiç girilmemiş (B_01.01).", alan: "kimlik" });
  } else {
    if (!girdi.kimlik.lei) {
      sorunlar.push({ kod: "LEI_YOK", seviye: "blok", mesaj: "B_01.01.0010 LEI zorunlu ama boş.", alan: "kimlik.lei" });
    }
    if (!girdi.kimlik.ulkeKodu) {
      sorunlar.push({ kod: "ULKE_YOK", seviye: "blok", mesaj: "B_01.01.0030 ülke kodu zorunlu ama boş.", alan: "kimlik.ulkeKodu" });
    }
    if (!girdi.kimlik.euid && !girdi.kimlik.ticaretSicilNo) {
      sorunlar.push({ kod: "ULUSAL_KIMLIK_YOK", seviye: "uyari", mesaj: "Ne EUID ne ticaret sicil no girilmiş — ulusal kurum kimliği eksik.", alan: "kimlik" });
    }
  }

  for (const s of [...girdi.sozlesmeler].sort((a, b) => a.id.localeCompare(b.id))) {
    if (s.ictHizmetTuruKod !== null) {
      const durum = hizmetTuruDurumu(girdi.hizmetTurleri, s.ictHizmetTuruKod);
      if (durum !== "VERIFIED") {
        sorunlar.push({
          kod: "HIZMET_TURU_DOGRULANMAMIS",
          seviye: "blok",
          mesaj: `Sözleşme ${s.sozlesmeRef}: ICT hizmet türü (${s.ictHizmetTuruKod}) kaynağı doğrulanmamış (durum: ${durum ?? "bulunamadı"}).`,
          alan: `sozlesme.${s.id}.ictHizmetTuruKod`,
        });
      }
    }
    if (s.durum === "AKTIF" && s.bitis < girdi.asOf) {
      sorunlar.push({
        kod: "SOZLESME_TUTARSIZ_DURUM",
        seviye: "uyari",
        mesaj: `Sözleşme ${s.sozlesmeRef}: durum AKTIF ama bitiş tarihi (${s.bitis}) ${girdi.asOf} itibarıyla geçmiş.`,
        alan: `sozlesme.${s.id}.durum`,
      });
    }
    if (s.veriSaklaniyorMu === true && !s.veriSaklamaUlkesi) {
      sorunlar.push({
        kod: "VERI_LOKASYONU_EKSIK",
        seviye: "uyari",
        mesaj: `Sözleşme ${s.sozlesmeRef}: veri saklanıyor işaretli ama saklama ülkesi girilmemiş.`,
        alan: `sozlesme.${s.id}.veriSaklamaUlkesi`,
      });
    }
  }

  const sozlesmeIdleri = new Set(girdi.sozlesmeler.map((s) => s.id));
  for (const a of [...girdi.altYukleniciler].sort((x, y) => x.id.localeCompare(y.id))) {
    if (a.thirdPartyContractId !== null && !sozlesmeIdleri.has(a.thirdPartyContractId)) {
      sorunlar.push({
        kod: "ALT_YUKLENICI_SOZLESME_TUTARSIZ",
        seviye: "uyari",
        mesaj: `Alt yüklenici ${a.ad ?? "(bilinmiyor)"}: bağlı olduğu sözleşme girdi kümesinde yok.`,
        alan: `altYuklenici.${a.id}`,
      });
    }
  }

  const kritikDurumu = new Map(girdi.kritikFonksiyonlar.map((k) => [k.id, k.durum]));
  for (const e of [...girdi.eslesmeler].sort((x, y) => (x.thirdPartyContractId + x.criticalServiceId).localeCompare(y.thirdPartyContractId + y.criticalServiceId))) {
    if (kritikDurumu.get(e.criticalServiceId) === "PASIF") {
      sorunlar.push({
        kod: "ESLEME_PASIF_FONKSIYON",
        seviye: "uyari",
        mesaj: `Sözleşme↔fonksiyon eşlemesi PASİF bir kritik hizmete işaret ediyor (${e.criticalServiceId}).`,
        alan: `esleme.${e.thirdPartyContractId}.${e.criticalServiceId}`,
      });
    }
  }

  return { sorunlar, engelleyiciSayisi: sorunlar.filter((s) => s.seviye === "blok").length };
}

export interface RoiSablonPaketi {
  schema: "KALKAN_ROI_EXPORT_V1";
  olusturulmaTarihi: string;
  B_01_01: Array<{
    B_01_01_0010_lei: string | null;
    B_01_01_0030_ulke: string | null;
    B_01_01_0040_kurulusTuru: string | null;
    kayitTutanKurulusLei: string | null;
  }>;
  B_02_01: Array<{ B_02_01_0010_sozlesmeReferansNo: string }>;
  B_02_02: Array<{
    B_02_02_0010_sozlesmeReferansNo: string;
    B_02_02_0030_tedarikciKimlikKodu: string | null;
    B_02_02_0040_kodTuru: string | null;
    B_02_02_0060_hizmetTuru: string | null;
    B_02_02_0070_baslangic: string;
    B_02_02_0080_bitis: string;
    B_02_02_0090_sonaErmeNedeni: string | null;
    B_02_02_0100_bildirimSuresiKurumGun: number | null;
    B_02_02_0110_bildirimSuresiSaglayiciGun: number | null;
    B_02_02_0140_veriSaklaniyorMu: boolean | null;
    B_02_02_0150_veriSaklamaUlkesi: string | null;
    B_02_02_0160_veriIslemeUlkesi: string | null;
    fonksiyonKimlikleri: string[];
  }>;
  B_05_01: Array<{ id: string; B_05_01_0050_yasalAd: string; B_05_01_0080_merkezUlkesi: string | null }>;
  B_05_02: Array<{
    ad: string | null;
    B_05_02_0010_sozlesmeReferansNo: string | null;
    B_05_02_0020_hizmetTuru: string | null;
    B_05_02_0050_sira: number | null;
    bilinmiyor: boolean;
  }>;
  B_06_01: Array<{ id: string; B_06_01_0030_fonksiyonAdi: string; kapsamDisiAlanlar: string[] }>;
}

/**
 * Şablon satırlarını üretir — yalnız girdideki 5 yapıdan doğrudan türeyen
 * alanlar dolar; karşılığı olmayan RoI alanları (RTO/RPO gibi) `kapsamDisi`
 * listesine düşer, UYDURULMAZ.
 */
export function roiSablonSatirlariUret(girdi: RoiExportGirdisi): RoiSablonPaketi {
  const sozlesmeRefById = new Map(girdi.sozlesmeler.map((s) => [s.id, s.sozlesmeRef]));

  return {
    schema: "KALKAN_ROI_EXPORT_V1",
    olusturulmaTarihi: girdi.asOf,
    B_01_01: girdi.kimlik
      ? [
          {
            B_01_01_0010_lei: girdi.kimlik.lei,
            B_01_01_0030_ulke: girdi.kimlik.ulkeKodu,
            B_01_01_0040_kurulusTuru: girdi.kimlik.kurulusTuru,
            kayitTutanKurulusLei: girdi.kimlik.kayitTutanKurulusLei,
          },
        ]
      : [],
    B_02_01: [...girdi.sozlesmeler]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((s) => ({ B_02_01_0010_sozlesmeReferansNo: s.sozlesmeRef })),
    B_02_02: [...girdi.sozlesmeler]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((s) => ({
        B_02_02_0010_sozlesmeReferansNo: s.sozlesmeRef,
        B_02_02_0030_tedarikciKimlikKodu: s.tedarikciKimlikKodu,
        B_02_02_0040_kodTuru: s.tedarikciKimlikKoduTuru,
        B_02_02_0060_hizmetTuru: s.ictHizmetTuruKod,
        B_02_02_0070_baslangic: s.baslangic,
        B_02_02_0080_bitis: s.bitis,
        B_02_02_0090_sonaErmeNedeni: s.sonaErmeNedeni,
        B_02_02_0100_bildirimSuresiKurumGun: s.bildirimSuresiKurumGun,
        B_02_02_0110_bildirimSuresiSaglayiciGun: s.bildirimSuresiSaglayiciGun,
        B_02_02_0140_veriSaklaniyorMu: s.veriSaklaniyorMu,
        B_02_02_0150_veriSaklamaUlkesi: s.veriSaklamaUlkesi,
        B_02_02_0160_veriIslemeUlkesi: s.veriIslemeUlkesi,
        fonksiyonKimlikleri: girdi.eslesmeler
          .filter((e) => e.thirdPartyContractId === s.id)
          .map((e) => e.criticalServiceId)
          .sort(),
      })),
    B_05_01: [...girdi.ucuncuTaraflar]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((t) => ({ id: t.id, B_05_01_0050_yasalAd: t.ad, B_05_01_0080_merkezUlkesi: t.ulke })),
    B_05_02: [...girdi.altYukleniciler]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((a) => ({
        ad: a.ad,
        B_05_02_0010_sozlesmeReferansNo: a.thirdPartyContractId ? (sozlesmeRefById.get(a.thirdPartyContractId) ?? null) : null,
        B_05_02_0020_hizmetTuru: a.ictHizmetTuruKod,
        B_05_02_0050_sira: a.sira,
        bilinmiyor: a.bilinmiyor,
      })),
    B_06_01: [...girdi.kritikFonksiyonlar]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((k) => ({ id: k.id, B_06_01_0030_fonksiyonAdi: k.ad, kapsamDisiAlanlar: ["RTO", "RPO", "kritiklikDegerlendirmesi"] })),
  };
}
