// M36 saf yardımcılar (G6): DSAR saati, ihlal bildirim saati, maskeleme.
import { describe, expect, it } from "vitest";
import { dsarSonTarih, ihlalBildirimSaati, maskele } from "../gizlilik";

const SIMDI = "2026-07-19T12:00:00Z";

describe("dsarSonTarih (M36)", () => {
  it("süre içinde 'kalan gün'; aşımda 'gecikti'", () => {
    expect(dsarSonTarih("2026-07-10T12:00:00Z", 30, SIMDI).gecikti).toBe(false);
    expect(dsarSonTarih("2026-06-01T12:00:00Z", 30, SIMDI).gecikti).toBe(true);
  });
  it("deterministik (kural 11)", () => {
    expect(dsarSonTarih("2026-07-01T00:00:00Z", 30, SIMDI)).toEqual(dsarSonTarih("2026-07-01T00:00:00Z", 30, SIMDI));
  });
});

describe("ihlalBildirimSaati (M36)", () => {
  it("72 saat penceresi: içinde bildirilmemiş → kalan saat; geçmiş → gecikti", () => {
    // tespit 1 saat önce → 71 saat kaldı.
    const yakin = ihlalBildirimSaati("2026-07-19T11:00:00Z", SIMDI);
    expect(yakin.gecikti).toBe(false);
    expect(yakin.kalanSaat).toBe(71);
    // tespit 100 saat önce → gecikti.
    expect(ihlalBildirimSaati("2026-07-15T08:00:00Z", SIMDI).gecikti).toBe(true);
  });
  it("bildirildiyse süresinde/geç ayrımı", () => {
    // tespit 00:00, bildirim +48h (süre içinde).
    const s = ihlalBildirimSaati("2026-07-17T00:00:00Z", SIMDI, "2026-07-19T00:00:00Z");
    expect(s.gecikti).toBe(false);
    expect(s.mesaj).toContain("Süresinde");
  });
});

describe("maskele (M36)", () => {
  it("e-posta ilk karakter + domain", () => {
    expect(maskele("ayse@example.com")).toBe("a***@example.com");
  });
  it("diğer değerler ilk 2 + son 2", () => {
    expect(maskele("12345678901")).toBe("12***01");
    expect(maskele("abcd")).toBe("***");
  });
});
