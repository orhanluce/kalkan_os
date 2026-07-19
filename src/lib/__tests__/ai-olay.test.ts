// M37 sonraki dilim: AI olay/eval saf türetimler (kural 11 + 13).
import { describe, expect, it } from "vitest";
import { aiOlayOzeti, evalOzeti, type EvalKayit, type OlayKayit } from "../ai-olay";

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
