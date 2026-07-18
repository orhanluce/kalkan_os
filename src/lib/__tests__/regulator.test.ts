// M38 saf yardımcılar (G7): talep son-tarih saati + gönderim makbuzu.
import { describe, expect, it } from "vitest";
import { gonderimMakbuzu, talepSonTarih } from "../regulator";

const SIMDI = "2026-07-19T12:00:00Z";

describe("talepSonTarih (M38)", () => {
  it("son tarih yoksa nötr; süre içinde kalan gün; aşımda gecikti", () => {
    expect(talepSonTarih(null, SIMDI).kalanGun).toBeNull();
    expect(talepSonTarih("2026-07-25", SIMDI).gecikti).toBe(false);
    expect(talepSonTarih("2026-07-10", SIMDI).gecikti).toBe(true);
  });
  it("deterministik (kural 11)", () => {
    expect(talepSonTarih("2026-08-01", SIMDI)).toEqual(talepSonTarih("2026-08-01", SIMDI));
  });
});

describe("gonderimMakbuzu (M38)", () => {
  it("aynı içerik aynı makbuz; 64-hex", async () => {
    const a = await gonderimMakbuzu("r1", 1, "yanıt metni");
    const b = await gonderimMakbuzu("r1", 1, "yanıt metni");
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
  it("içerik değişince makbuz değişir", async () => {
    const a = await gonderimMakbuzu("r1", 1, "yanıt metni");
    const b = await gonderimMakbuzu("r1", 1, "başka metin");
    expect(a).not.toBe(b);
  });
});
