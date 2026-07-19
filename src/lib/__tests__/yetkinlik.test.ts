// M18 saf yardımcı (G8): sınav geçme + yetkinlik boşluğu.
import { describe, expect, it } from "vitest";
import { periyotYenilemeDurumu, sinavGecti, yetkinlikBoslugu, type AtamaDurumu } from "../yetkinlik";

const SIMDI = "2026-07-19T12:00:00Z";

describe("sinavGecti (M18)", () => {
  it("eşik ve üzeri geçer, altı kalır", () => {
    expect(sinavGecti(70, 70)).toBe(true);
    expect(sinavGecti(69, 70)).toBe(false);
  });
});

describe("yetkinlikBoslugu (M18)", () => {
  it("süresi geçmiş tamamlanmamış + kalınmış atamalar boşluktur", () => {
    const atamalar: AtamaDurumu[] = [
      { kullaniciAd: "Ali", gereksinimAd: "KVKK", durum: "ATANDI", sonTarih: "2026-07-01", gecti: null },
      { kullaniciAd: "Ayşe", gereksinimAd: "KVKK", durum: "TAMAMLANDI", sonTarih: "2026-06-01", gecti: true },
      { kullaniciAd: "Veli", gereksinimAd: "AI", durum: "ATANDI", sonTarih: "2026-08-01", gecti: false },
    ];
    const r = yetkinlikBoslugu(atamalar, SIMDI);
    // Ali (süresi geçmiş, tamamlanmamış) + Veli (kalınmış). Ayşe tamam.
    expect(r.bosluklar.map((b) => b.kullaniciAd)).toEqual(["Ali", "Veli"]);
    expect(r.tamamlanmaOrani).toBeCloseTo(1 / 3);
  });

  it("deterministik ve boş atama %100 (kural 11)", () => {
    expect(yetkinlikBoslugu([], SIMDI).tamamlanmaOrani).toBe(1);
    const a: AtamaDurumu[] = [{ kullaniciAd: "X", gereksinimAd: "Y", durum: "ATANDI", sonTarih: "2026-01-01", gecti: null }];
    expect(yetkinlikBoslugu(a, SIMDI)).toEqual(yetkinlikBoslugu(a, SIMDI));
  });
});

describe("periyotYenilemeDurumu (M18 retraining — ROADMAP §1.30)", () => {
  it("periyot içindeyse gecikti=false, kalan gün pozitif", () => {
    const r = periyotYenilemeDurumu("2026-07-01T00:00:00Z", 30, SIMDI);
    expect(r.gecikti).toBe(false);
    expect(r.kalanGun).toBeGreaterThan(0);
    expect(r.sonrakiTarih).toBe("2026-07-31");
  });

  it("periyot dolmuşsa gecikti=true, kalan gün negatif", () => {
    const r = periyotYenilemeDurumu("2020-01-01T00:00:00Z", 30, SIMDI);
    expect(r.gecikti).toBe(true);
    expect(r.kalanGun).toBeLessThan(0);
  });

  it("deterministik (kural 11)", () => {
    const r1 = periyotYenilemeDurumu("2026-01-01T00:00:00Z", 365, SIMDI);
    const r2 = periyotYenilemeDurumu("2026-01-01T00:00:00Z", 365, SIMDI);
    expect(r1).toEqual(r2);
  });
});
