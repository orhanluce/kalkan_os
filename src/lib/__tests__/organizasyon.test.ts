import { describe, expect, it } from "vitest";
import {
  ONBOARDING_SECENEKLERI,
  cfoOdakliMi,
  financeVarsayilanAcik,
  urunHatti,
  type OrganizationType,
} from "../organizasyon";

// V2 PR-2 ADR-V2-1: segment → ürün hattı eşlemesi saf/deterministik.

const TURLER: OrganizationType[] = [
  "REGULATED_FINANCIAL_INSTITUTION",
  "CORPORATE_FINANCE",
  "MIXED_GROUP",
];

describe("organizasyon segment eşlemesi", () => {
  it("her tür bir ürün hattına düşer", () => {
    expect(urunHatti("REGULATED_FINANCIAL_INSTITUTION")).toBe("REGULATED");
    expect(urunHatti("CORPORATE_FINANCE")).toBe("CFO");
    expect(urunHatti("MIXED_GROUP")).toBe("KARMA");
  });

  it("CFO odağı: CFO ve KARMA'da açık, REGULATED'da kapalı", () => {
    expect(cfoOdakliMi("CORPORATE_FINANCE")).toBe(true);
    expect(cfoOdakliMi("MIXED_GROUP")).toBe(true);
    expect(cfoOdakliMi("REGULATED_FINANCIAL_INSTITUTION")).toBe(false);
  });

  it("finance varsayılanı CFO odaklı türlerde açık", () => {
    expect(financeVarsayilanAcik("CORPORATE_FINANCE")).toBe(true);
    expect(financeVarsayilanAcik("REGULATED_FINANCIAL_INSTITUTION")).toBe(false);
  });

  it("onboarding üç seçenek sunar, her biri geçerli bir türe bağlı", () => {
    expect(ONBOARDING_SECENEKLERI).toHaveLength(3);
    const turler = ONBOARDING_SECENEKLERI.map((s) => s.tur).sort();
    expect(turler).toEqual([...TURLER].sort());
  });

  it("her tür için tüm yardımcılar bir değer döndürür (eksik dal yok)", () => {
    for (const t of TURLER) {
      expect(["REGULATED", "CFO", "KARMA"]).toContain(urunHatti(t));
      expect(typeof cfoOdakliMi(t)).toBe("boolean");
      expect(typeof financeVarsayilanAcik(t)).toBe("boolean");
    }
  });
});
