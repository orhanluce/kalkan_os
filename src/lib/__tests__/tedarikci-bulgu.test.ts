// M35 sonraki dilim: bulgu dağılımı + değerlendirme tamamlanabilirliği (saf).
import { describe, expect, it } from "vitest";
import { bulguOzeti, type Bulgu } from "../tedarikci";

describe("bulguOzeti (saf)", () => {
  it("ciddiyet sayar; açık KRİTİK yoksa tamamlanabilir", () => {
    const bulgular: Bulgu[] = [
      { ciddiyet: "DUSUK", durum: "KAPANDI" },
      { ciddiyet: "YUKSEK", durum: "ACIK" },
      { ciddiyet: "KRITIK", durum: "KAPANDI" },
    ];
    const o = bulguOzeti(bulgular);
    expect(o.ciddiyetSayisi.KRITIK).toBe(1);
    expect(o.acikSayisi).toBe(1);
    expect(o.acikKritikVar).toBe(false);
    expect(o.tamamlanabilir).toBe(true);
  });

  it("açık KRİTİK bulgu tamamlanmayı engeller", () => {
    const o = bulguOzeti([{ ciddiyet: "KRITIK", durum: "ACIK" }]);
    expect(o.acikKritikVar).toBe(true);
    expect(o.tamamlanabilir).toBe(false);
  });

  it("AKSIYON_PLANLI da açık sayılır", () => {
    const o = bulguOzeti([{ ciddiyet: "KRITIK", durum: "AKSIYON_PLANLI" }]);
    expect(o.acikKritikVar).toBe(true);
    expect(o.acikSayisi).toBe(1);
  });

  it("boş liste tamamlanabilir", () => {
    const o = bulguOzeti([]);
    expect(o.acikSayisi).toBe(0);
    expect(o.tamamlanabilir).toBe(true);
  });
});
