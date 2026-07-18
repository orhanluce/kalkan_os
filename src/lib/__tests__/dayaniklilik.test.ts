// M13 saf yardımcı (G8): tekil-nokta/yoğunlaşma analizi.
import { describe, expect, it } from "vitest";
import { tekilNoktaAnalizi, type KritikHizmetGraf } from "../dayaniklilik";

describe("tekilNoktaAnalizi (M13)", () => {
  it("aynı bağımlılığa dayanan ≥2 kritik hizmet sistemik tekil noktadır", () => {
    const graf: KritikHizmetGraf[] = [
      { id: "1", ad: "Ödeme", bagimliliklar: [{ ad: "IAM", bagimlilikTuru: "SISTEM", tekilNokta: false }] },
      { id: "2", ad: "Emir", bagimliliklar: [{ ad: "iam", bagimlilikTuru: "SISTEM", tekilNokta: true }] },
      { id: "3", ad: "Rapor", bagimliliklar: [{ ad: "DWH", bagimlilikTuru: "SISTEM", tekilNokta: false }] },
    ];
    const r = tekilNoktaAnalizi(graf);
    expect(r.sistemikNoktalar).toHaveLength(1);
    expect(r.sistemikNoktalar[0].bagimlilikAd).toBe("iam");
    expect(r.sistemikNoktalar[0].etkilenenHizmetler).toEqual(["Emir", "Ödeme"]);
    expect(r.isaretliTekilNoktalar).toEqual([{ hizmetAd: "Emir", bagimlilikAd: "iam" }]);
  });

  it("deterministik: girdi sırasından bağımsız (kural 11)", () => {
    const graf: KritikHizmetGraf[] = [
      { id: "1", ad: "B", bagimliliklar: [{ ad: "X", bagimlilikTuru: "BULUT", tekilNokta: false }] },
      { id: "2", ad: "A", bagimliliklar: [{ ad: "X", bagimlilikTuru: "BULUT", tekilNokta: false }] },
    ];
    const r1 = tekilNoktaAnalizi(graf);
    const r2 = tekilNoktaAnalizi([...graf].reverse());
    expect(r1).toEqual(r2);
    expect(r1.sistemikNoktalar[0].etkilenenHizmetler).toEqual(["A", "B"]);
  });
});
