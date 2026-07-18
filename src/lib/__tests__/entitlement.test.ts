import { describe, expect, it } from "vitest";
import {
  VARSAYILAN_YETKILER,
  denetciAlaniAcikMi,
  erpBankaReviewAcikMi,
  sodTamMi,
  trialDoldu,
  yetenekAcik,
  yetenekDegeri,
} from "../entitlement";

// V2 PR-2c ADR-V2-3: yetenek yorumlama saf/deterministik; limitler koda gömülü
// değil (matris DB'den). Bu testler yorum mantığını sabitler.

const STARTER = {
  sod: "gorunum",
  erp_banka_review: false,
  denetci_alani: false,
  kanit_kasasi: "limitli",
};
const PRO = { sod: "tam", erp_banka_review: true, denetci_alani: false, kanit_kasasi: "tam" };
const GOVERNANCE = { sod: "tam", erp_banka_review: true, denetci_alani: true };

describe("entitlement yetenek yorumlama", () => {
  it("sodTamMi: Starter false, Pro/Governance true", () => {
    expect(sodTamMi(STARTER)).toBe(false);
    expect(sodTamMi(PRO)).toBe(true);
    expect(sodTamMi(GOVERNANCE)).toBe(true);
  });

  it("erpBankaReviewAcikMi: yalnız true değerinde", () => {
    expect(erpBankaReviewAcikMi(STARTER)).toBe(false);
    expect(erpBankaReviewAcikMi(PRO)).toBe(true);
  });

  it("denetciAlaniAcikMi: yalnız Governance", () => {
    expect(denetciAlaniAcikMi(PRO)).toBe(false);
    expect(denetciAlaniAcikMi(GOVERNANCE)).toBe(true);
  });

  it("yetenekAcik yalnız boolean true; string 'tam' boolean açık SAYILMAZ", () => {
    expect(yetenekAcik({ x: true }, "x")).toBe(true);
    expect(yetenekAcik({ x: "tam" }, "x")).toBe(false);
    expect(yetenekAcik({}, "x")).toBe(false);
  });

  it("yetenekDegeri seviye string döndürür", () => {
    expect(yetenekDegeri({ sod: "tam" }, "sod")).toBe("tam");
    expect(yetenekDegeri({ sod: true }, "sod")).toBeNull();
  });

  it("VARSAYILAN permissive ama yeni ücretli yetenekler KAPALI", () => {
    // Mevcut yüzeyler açık (abonelik gelene dek pilot çalışsın)...
    expect(sodTamMi(VARSAYILAN_YETKILER)).toBe(true);
    // ...ama yeni ücretli yetenekler varsayılanda kapalı.
    expect(erpBankaReviewAcikMi(VARSAYILAN_YETKILER)).toBe(false);
    expect(denetciAlaniAcikMi(VARSAYILAN_YETKILER)).toBe(false);
  });

  it("trial DB zamanına göre dolar (istemci saati değil)", () => {
    const simdi = new Date("2026-07-18T12:00:00Z");
    expect(trialDoldu(null, simdi)).toBe(false);
    expect(trialDoldu("2026-07-10", simdi)).toBe(true);
    expect(trialDoldu("2026-08-01", simdi)).toBe(false);
  });
});
