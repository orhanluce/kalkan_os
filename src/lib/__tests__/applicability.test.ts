// M22 saf yardımcılar: fact snapshot deterministik (dizi sırasından bağımsız),
// fingerprint RFC 8785 sha256, eksik-olgu listesi dürüst (UNKNOWN sınırı).
import { describe, expect, it } from "vitest";
import {
  applicabilityFactSnapshot,
  eksikProfilAlanlari,
  factSnapshotFingerprint,
  type ProfilOlgulari,
} from "../applicability";

const TAM_PROFIL: ProfilOlgulari = {
  organization_type: "REGULATED_FINANCIAL_INSTITUTION",
  regulated_entity_types: ["ARACI_KURUM"],
  regulated_status: "REGULATED",
  regulator_types: ["SPK", "BDDK"],
  jurisdictions: ["TR"],
  operating_sectors: ["araci_kurum"],
  finance_department_enabled: true,
  employee_band: "50-249",
  legal_entity_count: 2,
};

describe("applicability saf yardımcılar (M22)", () => {
  it("aynı olgular farklı dizi sırasıyla AYNI fingerprint'i verir (kural 11)", async () => {
    const a = applicabilityFactSnapshot(TAM_PROFIL);
    const b = applicabilityFactSnapshot({
      ...TAM_PROFIL,
      regulator_types: ["BDDK", "SPK", "BDDK"], // sıra farklı + mükerrer
    });
    expect(await factSnapshotFingerprint(a)).toBe(await factSnapshotFingerprint(b));
  });

  it("farklı olgular farklı fingerprint verir", async () => {
    const a = applicabilityFactSnapshot(TAM_PROFIL);
    const b = applicabilityFactSnapshot({ ...TAM_PROFIL, jurisdictions: ["TR", "EU"] });
    expect(await factSnapshotFingerprint(a)).not.toBe(await factSnapshotFingerprint(b));
  });

  it("fingerprint 64 haneli hex'tir (DB check ile uyumlu)", async () => {
    const fp = await factSnapshotFingerprint(applicabilityFactSnapshot(TAM_PROFIL));
    expect(fp).toMatch(/^[0-9a-f]{64}$/);
  });

  it("kritik olgu eksikse listelenir — dürüst karar UNKNOWN'dur", () => {
    const snap = applicabilityFactSnapshot({
      ...TAM_PROFIL,
      organization_type: null,
      jurisdictions: [],
    });
    expect(eksikProfilAlanlari(snap)).toEqual(["organizationType", "jurisdictions"]);
  });

  it("regulated_status UNKNOWN da 'eksik olgu' sayılır (bilinmiyor != hayır)", () => {
    const snap = applicabilityFactSnapshot({ ...TAM_PROFIL, regulated_status: "UNKNOWN" });
    expect(eksikProfilAlanlari(snap)).toEqual(["regulatedStatus"]);
  });

  it("tam profilde eksik listesi boştur", () => {
    expect(eksikProfilAlanlari(applicabilityFactSnapshot(TAM_PROFIL))).toEqual([]);
  });
});
