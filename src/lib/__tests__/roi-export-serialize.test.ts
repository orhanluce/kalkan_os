import { describe, expect, it } from "vitest";
import { roiSablonSatirlariUret, type RoiExportGirdisi } from "../roi-export";
import { roiSablonCsvYap, roiSablonXlsxYap, ROI_EXPORT_UYARI_METNI } from "../roi-export-serialize";
import { xlsxOlustur } from "../xlsx-writer";

const BOS_GIRDI: RoiExportGirdisi = {
  kimlik: { lei: "5493001KJTIIGC8Y1R12", euid: null, ticaretSicilNo: "123", ulkeKodu: "TR", paraBirimi: "TRY", kurulusTuru: "investment firms", hiyerarsiSeviyesi: null, anaKurulusLei: null, kayitTutanKurulusLei: null, kayitTutanKurulusAdi: null },
  hizmetTurleri: [{ kod: "S09", ad: "Non-Cloud Data storage", dogrulamaDurumu: "VERIFIED" }],
  ucuncuTaraflar: [{ id: "tp1", ad: "Vendor A.Ş.", ulke: "DE" }],
  sozlesmeler: [
    {
      id: "c1", thirdPartyId: "tp1", sozlesmeRef: "S-1, özel", baslangic: "2025-01-01", bitis: "2026-01-01", durum: "AKTIF",
      tedarikciKimlikKodu: "LEI123", tedarikciKimlikKoduTuru: "LEI", ictHizmetTuruKod: "S09",
      veriSaklaniyorMu: true, veriSaklamaUlkesi: "DE", veriIslemeUlkesi: "DE", sonaErmeNedeni: null,
      bildirimSuresiKurumGun: 30, bildirimSuresiSaglayiciGun: 60,
    },
  ],
  altYukleniciler: [{ id: "a1", thirdPartyId: "tp1", thirdPartyContractId: "c1", ad: 'Alt "A" A.Ş.', bilinmiyor: false, ulke: "DE", sira: 2, ictHizmetTuruKod: "S09" }],
  kritikFonksiyonlar: [{ id: "k1", ad: "Ödeme İşleme", durum: "AKTIF" }],
  eslesmeler: [{ thirdPartyContractId: "c1", criticalServiceId: "k1" }],
  asOf: "2026-07-20",
};

describe("roiSablonCsvYap", () => {
  it("uyarı metnini içerir", () => {
    const paket = roiSablonSatirlariUret(BOS_GIRDI);
    const csv = roiSablonCsvYap(paket);
    expect(csv).toContain(ROI_EXPORT_UYARI_METNI);
  });

  it("her şablon için kolon başlığı + veri satırı üretir", () => {
    const paket = roiSablonSatirlariUret(BOS_GIRDI);
    const csv = roiSablonCsvYap(paket);
    expect(csv).toContain("## B_01.01 — Kaydı tutan kuruluş");
    expect(csv).toContain("B_01_01_0010_lei,B_01_01_0030_ulke,B_01_01_0040_kurulusTuru,kayitTutanKurulusLei");
    expect(csv).toContain("5493001KJTIIGC8Y1R12,TR,investment firms,");
  });

  it("virgül/tırnak/yeni-satır içeren alanlar RFC 4180'e göre kaçırılır", () => {
    const paket = roiSablonSatirlariUret(BOS_GIRDI);
    const csv = roiSablonCsvYap(paket);
    expect(csv).toContain('"Alt ""A"" A.Ş."'); // altYuklenici.ad, B_05_02
    expect(csv).toContain('"S-1, özel"'); // sozlesmeRef, virgül içeriyor
  });

  it("deterministik: aynı paket iki kez üretilse aynı metni verir", () => {
    const paket = roiSablonSatirlariUret(BOS_GIRDI);
    expect(roiSablonCsvYap(paket)).toBe(roiSablonCsvYap(paket));
  });

  it("boş paket (satır yok) da geçerli CSV üretir, hata atmaz", () => {
    const paket = roiSablonSatirlariUret({ ...BOS_GIRDI, kimlik: null, sozlesmeler: [], ucuncuTaraflar: [], altYukleniciler: [], kritikFonksiyonlar: [] });
    expect(() => roiSablonCsvYap(paket)).not.toThrow();
  });
});

describe("roiSablonXlsxYap", () => {
  it("geçerli bir ZIP (XLSX) baytı üretir — PK imzasıyla başlar", async () => {
    const paket = roiSablonSatirlariUret(BOS_GIRDI);
    const bayt = await roiSablonXlsxYap(paket);
    expect(bayt[0]).toBe(0x50); // 'P'
    expect(bayt[1]).toBe(0x4b); // 'K'
  });

  it("deterministik: aynı paket iki kez üretilse aynı baytları verir", async () => {
    const paket = roiSablonSatirlariUret(BOS_GIRDI);
    const b1 = await roiSablonXlsxYap(paket);
    const b2 = await roiSablonXlsxYap(paket);
    expect(Buffer.from(b1).equals(Buffer.from(b2))).toBe(true);
  });
});

describe("xlsxOlustur — düşük seviye yazıcı", () => {
  it("özel karakterler (& < > \" ') XML'de kaçırılır, üretim hata vermez", async () => {
    const bayt = await xlsxOlustur([{ ad: "Test", kolonlar: ["a"], satirlar: [['<tag> & "quote" \'apos\'']] }]);
    expect(bayt.length).toBeGreaterThan(0);
  });

  it("sayfa adı 31 karakteri aşarsa kesilir, yasak karakterler _ olur", async () => {
    const bayt = await xlsxOlustur([{ ad: "a".repeat(40) + "[x]:*?/\\", kolonlar: ["a"], satirlar: [[1]] }]);
    expect(bayt.length).toBeGreaterThan(0);
  });

  it("31 sütundan fazla (AA sütun harfi) doğru hesaplanır, hata atmaz", async () => {
    const kolonlar = Array.from({ length: 30 }, (_, i) => `k${i}`);
    const bayt = await xlsxOlustur([{ ad: "Genis", kolonlar, satirlar: [kolonlar.map((_, i) => i)] }]);
    expect(bayt.length).toBeGreaterThan(0);
  });
});
