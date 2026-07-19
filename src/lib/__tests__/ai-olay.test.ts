// M37 sonraki dilim: AI olay/eval saf türetimler (kural 11 + 13).
import { describe, expect, it } from "vitest";
import { aiOlayOzeti, driftSegmentGrupla, evalOzeti, type DriftOkuma, type EvalKayit, type OlayKayit } from "../ai-olay";

describe("evalOzeti (kural 13: birleştirmez)", () => {
  it("tür başına en son sonuç; FAILED ve UNKNOWN ayrı raporlanır", () => {
    const evals: EvalKayit[] = [
      { tur: "BIAS", sonuc: "FAILED", degerlendirme_at: "2026-07-01T00:00:00Z" },
      { tur: "BIAS", sonuc: "PASSED", degerlendirme_at: "2026-07-10T00:00:00Z" }, // daha yeni
      { tur: "ROBUSTLUK", sonuc: "UNKNOWN", degerlendirme_at: "2026-07-05T00:00:00Z" },
    ];
    const o = evalOzeti(evals);
    expect(o.turSonuc.BIAS).toBe("PASSED"); // en yeni kazanır
    expect(o.turSonuc.ROBUSTLUK).toBe("UNKNOWN");
    expect(o.failedVar).toBe(false);
    expect(o.unknownVar).toBe(true);
  });

  it("UNKNOWN 'başarısız' ile karışmaz", () => {
    const o = evalOzeti([{ tur: "GUVENLIK", sonuc: "UNKNOWN", degerlendirme_at: "2026-07-01T00:00:00Z" }]);
    expect(o.failedVar).toBe(false);
    expect(o.unknownVar).toBe(true);
  });
});

describe("aiOlayOzeti", () => {
  it("açık YÜKSEK/KRİTİK ciddi sinyali; KAPANDI sayılmaz", () => {
    const olaylar: OlayKayit[] = [
      { ciddiyet: "KRITIK", durum: "KAPANDI" },
      { ciddiyet: "YUKSEK", durum: "ACIK" },
      { ciddiyet: "DUSUK", durum: "INCELENIYOR" },
    ];
    const o = aiOlayOzeti(olaylar);
    expect(o.acikSayisi).toBe(2);
    expect(o.acikCiddiVar).toBe(true);
    expect(o.ciddiyetSayisi.KRITIK).toBe(1);
  });

  it("yalnız düşük/orta açık → ciddi sinyal yok", () => {
    const o = aiOlayOzeti([{ ciddiyet: "ORTA", durum: "ACIK" }]);
    expect(o.acikCiddiVar).toBe(false);
    expect(o.acikSayisi).toBe(1);
  });
});

describe("driftSegmentGrupla (Dikey 4 kalanı — segmentler birleştirilmez)", () => {
  it("aynı metriğin farklı segmentleri AYRI durum taşıyabilir", () => {
    const okumalar: DriftOkuma[] = [
      { metrik: "accuracy", segment: "istanbul", deger: 0.5, baseline: 0.9, esik: 0.1, olcumTarihi: "2026-07-19", overrideEdildi: false },
      { metrik: "accuracy", segment: "izmir", deger: 0.88, baseline: 0.9, esik: 0.1, olcumTarihi: "2026-07-19", overrideEdildi: false },
      { metrik: "accuracy", segment: null, deger: 0.85, baseline: 0.9, esik: 0.1, olcumTarihi: "2026-07-19", overrideEdildi: false },
    ];
    const g = driftSegmentGrupla(okumalar);
    expect(g.find((x) => x.segment === "istanbul")!.degerlendirme.durum).toBe("ESIK_ASILDI");
    expect(g.find((x) => x.segment === "izmir")!.degerlendirme.durum).toBe("TOLERANS_ICINDE");
    expect(g.find((x) => x.segment === null)!.degerlendirme.durum).toBe("TOLERANS_ICINDE");
  });

  it("metrik+segment başına EN SON okuma kazanır", () => {
    const okumalar: DriftOkuma[] = [
      { metrik: "accuracy", segment: null, deger: 0.5, baseline: 0.9, esik: 0.1, olcumTarihi: "2026-07-01", overrideEdildi: false },
      { metrik: "accuracy", segment: null, deger: 0.89, baseline: 0.9, esik: 0.1, olcumTarihi: "2026-07-19", overrideEdildi: false },
    ];
    const g = driftSegmentGrupla(okumalar);
    expect(g).toHaveLength(1);
    expect(g[0].degerlendirme.durum).toBe("TOLERANS_ICINDE");
  });

  it("override edildi bilgisi görünür kalır, gizlenmez", () => {
    const g = driftSegmentGrupla([
      { metrik: "accuracy", segment: null, deger: 0.5, baseline: 0.9, esik: 0.1, olcumTarihi: "2026-07-19", overrideEdildi: true },
    ]);
    expect(g[0].degerlendirme.durum).toBe("ESIK_ASILDI");
    expect(g[0].overrideEdildi).toBe(true);
  });

  it("deterministik: girdi sırasından bağımsız, sıralı döner (kural 11)", () => {
    const okumalar: DriftOkuma[] = [
      { metrik: "b", segment: null, deger: 1, baseline: null, esik: null, olcumTarihi: "2026-07-19", overrideEdildi: false },
      { metrik: "a", segment: null, deger: 1, baseline: null, esik: null, olcumTarihi: "2026-07-19", overrideEdildi: false },
    ];
    const g1 = driftSegmentGrupla(okumalar);
    const g2 = driftSegmentGrupla([...okumalar].reverse());
    expect(g1).toEqual(g2);
    expect(g1.map((x) => x.metrik)).toEqual(["a", "b"]);
  });
});
