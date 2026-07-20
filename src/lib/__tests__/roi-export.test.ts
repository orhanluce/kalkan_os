import { describe, expect, it } from "vitest";
import { roiExportOnKontrol, roiSablonSatirlariUret, type RoiExportGirdisi } from "../roi-export";

const BOS_GIRDI: RoiExportGirdisi = {
  kimlik: null,
  hizmetTurleri: [],
  ucuncuTaraflar: [],
  sozlesmeler: [],
  altYukleniciler: [],
  kritikFonksiyonlar: [],
  eslesmeler: [],
  asOf: "2026-07-20",
};

describe("roiExportOnKontrol", () => {
  it("kimlik yoksa iki blok sorunu üretir (KIMLIK_YOK)", () => {
    const sonuc = roiExportOnKontrol(BOS_GIRDI);
    expect(sonuc.sorunlar.some((s) => s.kod === "KIMLIK_YOK" && s.seviye === "blok")).toBe(true);
    expect(sonuc.engelleyiciSayisi).toBeGreaterThan(0);
  });

  it("LEI/ülke eksikse ayrı blok sorunları üretir", () => {
    const sonuc = roiExportOnKontrol({
      ...BOS_GIRDI,
      kimlik: { lei: null, euid: null, ticaretSicilNo: null, ulkeKodu: null, paraBirimi: null, kurulusTuru: null, hiyerarsiSeviyesi: null, anaKurulusLei: null, kayitTutanKurulusLei: null, kayitTutanKurulusAdi: null },
    });
    expect(sonuc.sorunlar.map((s) => s.kod)).toEqual(expect.arrayContaining(["LEI_YOK", "ULKE_YOK", "ULUSAL_KIMLIK_YOK"]));
  });

  it("tam kimlik + ulusal kimlik kodu varsa kimlikle ilgili sorun üretmez", () => {
    const sonuc = roiExportOnKontrol({
      ...BOS_GIRDI,
      kimlik: { lei: "5493001KJTIIGC8Y1R12", euid: "TR.123", ticaretSicilNo: null, ulkeKodu: "TR", paraBirimi: "TRY", kurulusTuru: "investment firms", hiyerarsiSeviyesi: null, anaKurulusLei: null, kayitTutanKurulusLei: null, kayitTutanKurulusAdi: null },
    });
    expect(sonuc.sorunlar.filter((s) => s.alan?.startsWith("kimlik"))).toHaveLength(0);
  });

  it("sözleşme VERIFIED olmayan hizmet türüne bağlıysa BLOK üretir (kural 3: doğrulanmamış kaynak export'a giremez)", () => {
    const sonuc = roiExportOnKontrol({
      ...BOS_GIRDI,
      hizmetTurleri: [{ kod: "S09", ad: "Non-Cloud Data storage", dogrulamaDurumu: "TODO_DOGRULA" }],
      sozlesmeler: [
        {
          id: "c1", thirdPartyId: "tp1", sozlesmeRef: "S-1", baslangic: "2025-01-01", bitis: "2026-01-01", durum: "AKTIF",
          tedarikciKimlikKodu: null, tedarikciKimlikKoduTuru: null, ictHizmetTuruKod: "S09",
          veriSaklaniyorMu: null, veriSaklamaUlkesi: null, veriIslemeUlkesi: null, sonaErmeNedeni: null,
          bildirimSuresiKurumGun: null, bildirimSuresiSaglayiciGun: null,
        },
      ],
    });
    const sorun = sonuc.sorunlar.find((s) => s.kod === "HIZMET_TURU_DOGRULANMAMIS");
    expect(sorun?.seviye).toBe("blok");
    expect(sonuc.engelleyiciSayisi).toBeGreaterThanOrEqual(1);
  });

  it("sözleşme VERIFIED hizmet türüne bağlıysa o sözleşme için blok üretmez", () => {
    const sonuc = roiExportOnKontrol({
      ...BOS_GIRDI,
      hizmetTurleri: [{ kod: "S09", ad: "Non-Cloud Data storage", dogrulamaDurumu: "VERIFIED" }],
      sozlesmeler: [
        {
          id: "c1", thirdPartyId: "tp1", sozlesmeRef: "S-1", baslangic: "2025-01-01", bitis: "2026-01-01", durum: "AKTIF",
          tedarikciKimlikKodu: null, tedarikciKimlikKoduTuru: null, ictHizmetTuruKod: "S09",
          veriSaklaniyorMu: null, veriSaklamaUlkesi: null, veriIslemeUlkesi: null, sonaErmeNedeni: null,
          bildirimSuresiKurumGun: null, bildirimSuresiSaglayiciGun: null,
        },
      ],
    });
    expect(sonuc.sorunlar.some((s) => s.kod === "HIZMET_TURU_DOGRULANMAMIS")).toBe(false);
  });

  it("aktif ama süresi geçmiş sözleşme UYARI üretir, BLOK değil", () => {
    const sonuc = roiExportOnKontrol({
      ...BOS_GIRDI,
      sozlesmeler: [
        {
          id: "c1", thirdPartyId: "tp1", sozlesmeRef: "S-1", baslangic: "2020-01-01", bitis: "2021-01-01", durum: "AKTIF",
          tedarikciKimlikKodu: null, tedarikciKimlikKoduTuru: null, ictHizmetTuruKod: null,
          veriSaklaniyorMu: null, veriSaklamaUlkesi: null, veriIslemeUlkesi: null, sonaErmeNedeni: null,
          bildirimSuresiKurumGun: null, bildirimSuresiSaglayiciGun: null,
        },
      ],
    });
    const sorun = sonuc.sorunlar.find((s) => s.kod === "SOZLESME_TUTARSIZ_DURUM");
    expect(sorun?.seviye).toBe("uyari");
  });

  it("veri saklanıyor ama ülke yoksa uyarı üretir", () => {
    const sonuc = roiExportOnKontrol({
      ...BOS_GIRDI,
      sozlesmeler: [
        {
          id: "c1", thirdPartyId: "tp1", sozlesmeRef: "S-1", baslangic: "2025-01-01", bitis: "2026-01-01", durum: "AKTIF",
          tedarikciKimlikKodu: null, tedarikciKimlikKoduTuru: null, ictHizmetTuruKod: null,
          veriSaklaniyorMu: true, veriSaklamaUlkesi: null, veriIslemeUlkesi: null, sonaErmeNedeni: null,
          bildirimSuresiKurumGun: null, bildirimSuresiSaglayiciGun: null,
        },
      ],
    });
    expect(sonuc.sorunlar.some((s) => s.kod === "VERI_LOKASYONU_EKSIK" && s.seviye === "uyari")).toBe(true);
  });

  it("alt yüklenicinin sözleşme bağı girdi kümesinde yoksa uyarı üretir", () => {
    const sonuc = roiExportOnKontrol({
      ...BOS_GIRDI,
      altYukleniciler: [{ id: "a1", thirdPartyId: "tp1", thirdPartyContractId: "yok-boyle-bir-sozlesme", ad: "Alt A.Ş.", bilinmiyor: false, ulke: null, sira: 2, ictHizmetTuruKod: null }],
    });
    expect(sonuc.sorunlar.some((s) => s.kod === "ALT_YUKLENICI_SOZLESME_TUTARSIZ")).toBe(true);
  });

  it("PASİF kritik fonksiyona eşleme uyarı üretir", () => {
    const sonuc = roiExportOnKontrol({
      ...BOS_GIRDI,
      kritikFonksiyonlar: [{ id: "k1", ad: "Ödeme İşleme", durum: "PASIF" }],
      eslesmeler: [{ thirdPartyContractId: "c1", criticalServiceId: "k1" }],
    });
    expect(sonuc.sorunlar.some((s) => s.kod === "ESLEME_PASIF_FONKSIYON")).toBe(true);
  });

  it("deterministik: aynı girdi (farklı sırayla verilse de) aynı sorun kümesini üretir", () => {
    const girdiA: RoiExportGirdisi = {
      ...BOS_GIRDI,
      sozlesmeler: [
        { id: "c2", thirdPartyId: "tp1", sozlesmeRef: "S-2", baslangic: "2020-01-01", bitis: "2021-01-01", durum: "AKTIF", tedarikciKimlikKodu: null, tedarikciKimlikKoduTuru: null, ictHizmetTuruKod: null, veriSaklaniyorMu: null, veriSaklamaUlkesi: null, veriIslemeUlkesi: null, sonaErmeNedeni: null, bildirimSuresiKurumGun: null, bildirimSuresiSaglayiciGun: null },
        { id: "c1", thirdPartyId: "tp1", sozlesmeRef: "S-1", baslangic: "2020-01-01", bitis: "2021-01-01", durum: "AKTIF", tedarikciKimlikKodu: null, tedarikciKimlikKoduTuru: null, ictHizmetTuruKod: null, veriSaklaniyorMu: null, veriSaklamaUlkesi: null, veriIslemeUlkesi: null, sonaErmeNedeni: null, bildirimSuresiKurumGun: null, bildirimSuresiSaglayiciGun: null },
      ],
    };
    const girdiB: RoiExportGirdisi = { ...girdiA, sozlesmeler: [...girdiA.sozlesmeler].reverse() };
    expect(roiExportOnKontrol(girdiA).sorunlar).toEqual(roiExportOnKontrol(girdiB).sorunlar);
  });
});

describe("roiSablonSatirlariUret", () => {
  it("kimlik yoksa B_01_01 boş dizi döner (uydurulmaz)", () => {
    const paket = roiSablonSatirlariUret(BOS_GIRDI);
    expect(paket.B_01_01).toEqual([]);
    expect(paket.schema).toBe("KALKAN_ROI_EXPORT_V1");
  });

  it("kimlik varsa B_01_01 tek satır olarak dolar, karşılığı olmayan alan kayit_tutan_kurulus dahil taşınır", () => {
    const paket = roiSablonSatirlariUret({
      ...BOS_GIRDI,
      kimlik: { lei: "5493001KJTIIGC8Y1R12", euid: null, ticaretSicilNo: "123", ulkeKodu: "TR", paraBirimi: "TRY", kurulusTuru: "investment firms", hiyerarsiSeviyesi: null, anaKurulusLei: null, kayitTutanKurulusLei: "969500HYABCDEFG12345", kayitTutanKurulusAdi: "Grup A.Ş." },
    });
    expect(paket.B_01_01[0]).toEqual({
      B_01_01_0010_lei: "5493001KJTIIGC8Y1R12",
      B_01_01_0030_ulke: "TR",
      B_01_01_0040_kurulusTuru: "investment firms",
      kayitTutanKurulusLei: "969500HYABCDEFG12345",
    });
  });

  it("B_02_02 satırları eşlemelerden fonksiyonKimlikleri toplar (yalnız o sözleşmeye ait olanlar)", () => {
    const paket = roiSablonSatirlariUret({
      ...BOS_GIRDI,
      sozlesmeler: [
        { id: "c1", thirdPartyId: "tp1", sozlesmeRef: "S-1", baslangic: "2025-01-01", bitis: "2026-01-01", durum: "AKTIF", tedarikciKimlikKodu: null, tedarikciKimlikKoduTuru: null, ictHizmetTuruKod: "S09", veriSaklaniyorMu: null, veriSaklamaUlkesi: null, veriIslemeUlkesi: null, sonaErmeNedeni: null, bildirimSuresiKurumGun: null, bildirimSuresiSaglayiciGun: null },
        { id: "c2", thirdPartyId: "tp1", sozlesmeRef: "S-2", baslangic: "2025-01-01", bitis: "2026-01-01", durum: "AKTIF", tedarikciKimlikKodu: null, tedarikciKimlikKoduTuru: null, ictHizmetTuruKod: null, veriSaklaniyorMu: null, veriSaklamaUlkesi: null, veriIslemeUlkesi: null, sonaErmeNedeni: null, bildirimSuresiKurumGun: null, bildirimSuresiSaglayiciGun: null },
      ],
      eslesmeler: [{ thirdPartyContractId: "c1", criticalServiceId: "k1" }],
    });
    const c1 = paket.B_02_02.find((r) => r.B_02_02_0010_sozlesmeReferansNo === "S-1");
    const c2 = paket.B_02_02.find((r) => r.B_02_02_0010_sozlesmeReferansNo === "S-2");
    expect(c1?.fonksiyonKimlikleri).toEqual(["k1"]);
    expect(c2?.fonksiyonKimlikleri).toEqual([]);
  });

  it("B_06_01 satırları RTO/RPO'yu kapsamDisiAlanlar olarak işaretler, uydurmaz", () => {
    const paket = roiSablonSatirlariUret({ ...BOS_GIRDI, kritikFonksiyonlar: [{ id: "k1", ad: "Ödeme İşleme", durum: "AKTIF" }] });
    expect(paket.B_06_01[0].kapsamDisiAlanlar).toEqual(expect.arrayContaining(["RTO", "RPO"]));
    expect((paket.B_06_01[0] as unknown as Record<string, unknown>).RTO).toBeUndefined();
  });

  it("B_05_02 satırı sözleşme referansını thirdPartyContractId üzerinden çözer", () => {
    const paket = roiSablonSatirlariUret({
      ...BOS_GIRDI,
      sozlesmeler: [{ id: "c1", thirdPartyId: "tp1", sozlesmeRef: "S-1", baslangic: "2025-01-01", bitis: "2026-01-01", durum: "AKTIF", tedarikciKimlikKodu: null, tedarikciKimlikKoduTuru: null, ictHizmetTuruKod: null, veriSaklaniyorMu: null, veriSaklamaUlkesi: null, veriIslemeUlkesi: null, sonaErmeNedeni: null, bildirimSuresiKurumGun: null, bildirimSuresiSaglayiciGun: null }],
      altYukleniciler: [{ id: "a1", thirdPartyId: "tp1", thirdPartyContractId: "c1", ad: "Alt A.Ş.", bilinmiyor: false, ulke: "DE", sira: 2, ictHizmetTuruKod: "S09" }],
    });
    expect(paket.B_05_02[0].B_05_02_0010_sozlesmeReferansNo).toBe("S-1");
  });
});
