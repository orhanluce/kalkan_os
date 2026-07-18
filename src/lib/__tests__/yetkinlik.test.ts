// M18 saf yardımcı (G8): sınav geçme + yetkinlik boşluğu.
import { describe, expect, it } from "vitest";
import { sinavGecti, yetkinlikBoslugu, type AtamaDurumu } from "../yetkinlik";

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
