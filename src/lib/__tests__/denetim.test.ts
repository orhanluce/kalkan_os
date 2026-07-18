// M17 saf motor (G8): tekrarlanabilir örnekleme.
import { describe, expect, it } from "vitest";
import { ornekIndeksleriSec, ornekYenidenUretilebilir } from "../denetim";

describe("ornekIndeksleriSec (M17)", () => {
  it("aynı seed AYNI seçimi verir (tekrarlanabilir, kural 11)", () => {
    const a = ornekIndeksleriSec(100, 10, "denetim-2026");
    const b = ornekIndeksleriSec(100, 10, "denetim-2026");
    expect(a).toEqual(b);
    expect(a).toHaveLength(10);
  });

  it("farklı seed farklı seçim verir", () => {
    const a = ornekIndeksleriSec(100, 10, "seed-a");
    const b = ornekIndeksleriSec(100, 10, "seed-b");
    expect(a).not.toEqual(b);
  });

  it("boyut popülasyonu aşamaz; artan sırada döner", () => {
    const r = ornekIndeksleriSec(5, 10, "x");
    expect(r).toHaveLength(5);
    expect([...r]).toEqual([...r].sort((a, b) => a - b));
  });

  it("boş popülasyon/boyut boş döner", () => {
    expect(ornekIndeksleriSec(0, 5, "x")).toEqual([]);
    expect(ornekIndeksleriSec(10, 0, "x")).toEqual([]);
  });

  it("yeniden üretim doğrulaması: kayıtlı seçim yeniden hesapla ile eşleşir", () => {
    const secim = ornekIndeksleriSec(200, 20, "audit-seed-7");
    expect(ornekYenidenUretilebilir(200, 20, "audit-seed-7", secim)).toBe(true);
    // Kurcalanmış seçim reddedilir.
    expect(ornekYenidenUretilebilir(200, 20, "audit-seed-7", [...secim.slice(1), 999])).toBe(false);
  });
});
