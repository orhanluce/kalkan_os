// M40 saf yardımcı (G8): KRI ihlali, üçgensel dağılım özeti, kontrol fayda.
import { describe, expect, it } from "vitest";
import { kontrolFaydaOrani, kriIhlali, ucgenselOzet } from "../risk";

describe("kriIhlali (M40)", () => {
  it("UST: eşiğin üstü ihlal; ALT: eşiğin altı ihlal", () => {
    expect(kriIhlali(80, 70, "UST")).toBe(true);
    expect(kriIhlali(60, 70, "UST")).toBe(false);
    expect(kriIhlali(60, 70, "ALT")).toBe(true);
    expect(kriIhlali(80, 70, "ALT")).toBe(false);
  });
});

describe("ucgenselOzet (M40) — SAHTE KESİNLİK YOK", () => {
  it("tek puan değil: beklenen + P90 + aralık + belirsizlik uyarısı", () => {
    const o = ucgenselOzet(100, 300, 1000);
    expect(o.beklenen).toBeCloseTo((100 + 300 + 1000) / 3);
    expect(o.aralik).toEqual([100, 1000]);
    expect(o.yaklasikP90).toBeGreaterThan(o.beklenen);
    expect(o.yaklasikP90).toBeLessThanOrEqual(1000);
    expect(o.uyari).toContain("belirsizlik");
  });
  it("deterministik (kural 11)", () => {
    expect(ucgenselOzet(0, 50, 100)).toEqual(ucgenselOzet(0, 50, 100));
  });
});

describe("kontrolFaydaOrani (M40)", () => {
  it("maliyet başına azaltım; maliyet 0/eksik → null (uydurma bölme yok)", () => {
    expect(kontrolFaydaOrani(1000, 5000)).toBe(5);
    expect(kontrolFaydaOrani(0, 5000)).toBeNull();
    expect(kontrolFaydaOrani(1000, null)).toBeNull();
  });
});
