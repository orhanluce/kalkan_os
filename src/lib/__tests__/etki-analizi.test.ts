// Dikey 5 saf yardımcıları (M13/M35 grafının genişlemesi + M21/M42 taksonomi).
import { describe, expect, it } from "vitest";
import {
  DAYANIKLILIK_ALAN_SIRASI,
  dayaniklilikKapsamOzeti,
  enCokKritikHizmetEtkileyenKontroller,
  iyilestirmeOnceligiSirala,
  zincirlemeEtkiYollari,
} from "../etki-analizi";

describe("zincirlemeEtkiYollari (Dikey 5)", () => {
  it("kritik hizmet → tedarikçi → dördüncü taraf zincirini kurar", () => {
    const yollar = zincirlemeEtkiYollari(
      [{ kritikHizmetAd: "Ödeme", bagimliliklar: [{ bagimlilikTuru: "TEDARIKCI", thirdPartyId: "tp1" }] }],
      [{ thirdPartyId: "tp1", thirdPartyAd: "Bulut A.Ş.", dorduncuTaraflar: [{ ad: "Alt Yüklenici X", bilinmiyor: false }] }],
    );
    expect(yollar).toEqual([
      { kritikHizmetAd: "Ödeme", tedarikciAd: "Bulut A.Ş.", dorduncuTarafAd: "Alt Yüklenici X", bilinmiyor: false },
    ]);
  });

  it("bilinmeyen dördüncü taraf DÜŞÜK RİSK VARSAYILMAZ — ad null, bilinmiyor true", () => {
    const yollar = zincirlemeEtkiYollari(
      [{ kritikHizmetAd: "Emir İletim", bagimliliklar: [{ bagimlilikTuru: "TEDARIKCI", thirdPartyId: "tp1" }] }],
      [{ thirdPartyId: "tp1", thirdPartyAd: "Veri Merkezi Ltd.", dorduncuTaraflar: [{ ad: null, bilinmiyor: true }] }],
    );
    expect(yollar[0]).toEqual({ kritikHizmetAd: "Emir İletim", tedarikciAd: "Veri Merkezi Ltd.", dorduncuTarafAd: null, bilinmiyor: true });
  });

  it("SISTEM/EKIP gibi tedarikçi-olmayan bağımlılıklar zincire girmez", () => {
    const yollar = zincirlemeEtkiYollari(
      [{ kritikHizmetAd: "Rapor", bagimliliklar: [{ bagimlilikTuru: "SISTEM", thirdPartyId: null }] }],
      [],
    );
    expect(yollar).toEqual([]);
  });

  it("deterministik: girdi sırasından bağımsız (kural 11)", () => {
    const hizmetler = [
      { kritikHizmetAd: "B", bagimliliklar: [{ bagimlilikTuru: "TEDARIKCI", thirdPartyId: "tp1" }] },
      { kritikHizmetAd: "A", bagimliliklar: [{ bagimlilikTuru: "TEDARIKCI", thirdPartyId: "tp1" }] },
    ];
    const tedarikciler = [{ thirdPartyId: "tp1", thirdPartyAd: "X", dorduncuTaraflar: [{ ad: "Y", bilinmiyor: false }] }];
    const r1 = zincirlemeEtkiYollari(hizmetler, tedarikciler);
    const r2 = zincirlemeEtkiYollari([...hizmetler].reverse(), tedarikciler);
    expect(r1).toEqual(r2);
    expect(r1.map((y) => y.kritikHizmetAd)).toEqual(["A", "B"]);
  });
});

describe("enCokKritikHizmetEtkileyenKontroller (Dikey 5)", () => {
  it("birden fazla hizmeti etkileyen kontrolü üste sıralar", () => {
    const sonuc = enCokKritikHizmetEtkileyenKontroller([
      { kritikHizmetAd: "Ödeme", controlId: "c1", controlAd: "Erişim kontrolü" },
      { kritikHizmetAd: "Emir", controlId: "c1", controlAd: "Erişim kontrolü" },
      { kritikHizmetAd: "Rapor", controlId: "c2", controlAd: "Yedekleme" },
    ]);
    expect(sonuc[0]).toEqual({
      controlId: "c1",
      controlAd: "Erişim kontrolü",
      etkilenenHizmetler: ["Emir", "Ödeme"],
      etkilenenHizmetSayisi: 2,
    });
    expect(sonuc[1].etkilenenHizmetSayisi).toBe(1);
  });

  it("eşit sayıda hizmet etkileyen kontroller ad ile deterministik sıralanır", () => {
    const sonuc = enCokKritikHizmetEtkileyenKontroller([
      { kritikHizmetAd: "Ödeme", controlId: "c2", controlAd: "Zeta" },
      { kritikHizmetAd: "Ödeme", controlId: "c1", controlAd: "Alfa" },
    ]);
    expect(sonuc.map((s) => s.controlAd)).toEqual(["Alfa", "Zeta"]);
  });
});

describe("iyilestirmeOnceligiSirala (Dikey 5 — açıklanabilir, tek sahte skor yok)", () => {
  it("faktör sayısına göre sıralar ve gerekçeleri isimlendirir", () => {
    const sonuc = iyilestirmeOnceligiSirala([
      { hedefId: "1", hedefAd: "Tek faktör", etkilenenHizmetSayisi: 1, sistemikTekilNoktaMi: false, tedarikciYogunlasmaNoktasiMi: false, acikKritikBulguVarMi: true },
      {
        hedefId: "2",
        hedefAd: "Dört faktör",
        etkilenenHizmetSayisi: 3,
        sistemikTekilNoktaMi: true,
        tedarikciYogunlasmaNoktasiMi: true,
        acikKritikBulguVarMi: true,
      },
      { hedefId: "3", hedefAd: "Faktörsüz", etkilenenHizmetSayisi: 0, sistemikTekilNoktaMi: false, tedarikciYogunlasmaNoktasiMi: false, acikKritikBulguVarMi: false },
    ]);
    expect(sonuc.map((s) => s.hedefAd)).toEqual(["Dört faktör", "Tek faktör"]);
    expect(sonuc[0].faktorler).toEqual(["Sistemik tekil nokta", "3 kritik hizmeti etkiliyor", "Tedarikçi yoğunlaşma noktası", "Açık kritik/yüksek bulgu var"]);
    expect(sonuc[0].faktorSayisi).toBe(4);
  });

  it("faktörsüz hedefler sonuçtan ÇIKARILIR (açık liste, sessiz sıfır skor yok)", () => {
    const sonuc = iyilestirmeOnceligiSirala([
      { hedefId: "1", hedefAd: "X", etkilenenHizmetSayisi: 0, sistemikTekilNoktaMi: false, tedarikciYogunlasmaNoktasiMi: false, acikKritikBulguVarMi: false },
    ]);
    expect(sonuc).toEqual([]);
  });
});

describe("dayaniklilikKapsamOzeti (M21/M42 — 8 üst alan, THESIS_DERIVED)", () => {
  it("8 alanın hepsi sırayla döner, kapsamsız alan da GÖRÜNÜR", () => {
    const sonuc = dayaniklilikKapsamOzeti([]);
    expect(sonuc).toHaveLength(8);
    expect(sonuc.map((s) => s.kategori)).toEqual(DAYANIKLILIK_ALAN_SIRASI);
    expect(sonuc.every((s) => s.toplam === 0 && s.kapsamVar === false)).toBe(true);
  });

  it("yalnız VERIFIED sınıflandırma kapsamVar üretir — TODO_DOGRULA yetmez", () => {
    const sonuc = dayaniklilikKapsamOzeti([
      { kategori: "KURTARMA", dogrulamaDurumu: "TODO_DOGRULA" },
      { kategori: "MUDAHALE", dogrulamaDurumu: "VERIFIED" },
    ]);
    const kurtarma = sonuc.find((s) => s.kategori === "KURTARMA")!;
    const mudahale = sonuc.find((s) => s.kategori === "MUDAHALE")!;
    expect(kurtarma.toplam).toBe(1);
    expect(kurtarma.kapsamVar).toBe(false);
    expect(mudahale.verifiedSayisi).toBe(1);
    expect(mudahale.kapsamVar).toBe(true);
  });
});
