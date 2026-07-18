// M23 legal-basis guard motoru: deterministik kapı kararları.
// V2 kabul kriteri: hukuk onayı olmayan eşleme ZORUNLU kontrolü çalıştırmaz.
import { describe, expect, it } from "vitest";
import {
  executionLegalSnapshot,
  legalBasisDegerlendir,
  type DayanakEslemesi,
} from "../legal-basis";

const AS_OF = "2026-07-18T12:00:00Z";

function esleme(patch: Partial<DayanakEslemesi> = {}): DayanakEslemesi {
  return {
    mappingId: "m-1",
    obligationKod: "YUK-1",
    nitelik: "zorunlu",
    kapsam: "tam",
    obligationDogrulama: "VERIFIED",
    mappingDogrulama: "VERIFIED",
    hukum: {
      provisionRef: "md. 26",
      effectiveFrom: "2020-01-01",
      effectiveTo: null,
      guncelKayit: true,
    },
    applicability: {
      mevcut: true,
      durum: "APPLICABLE",
      kosul: null,
      fingerprintGuncel: true,
    },
    ...patch,
  };
}

describe("legalBasisDegerlendir (M23)", () => {
  it("dayanak iddiası yoksa ALLOW — dayanaksız güvence koşusu engellenmez", () => {
    const r = legalBasisDegerlendir([], AS_OF);
    expect(r.karar).toBe("ALLOW");
    expect(r.sebepler[0].kod).toBe("DAYANAK_IDDIASI_YOK");
  });

  it("sağlam zincir: VERIFIED + yürürlükte + APPLICABLE güncel → ALLOW", () => {
    const r = legalBasisDegerlendir([esleme()], AS_OF);
    expect(r.karar).toBe("ALLOW");
    expect(r.sebepler).toEqual([]);
  });

  it("V2 kabulü: doğrulanmamış eşleme ZORUNLU kontrolü BLOKLAR", () => {
    const r = legalBasisDegerlendir([esleme({ mappingDogrulama: "TODO_DOGRULA" })], AS_OF);
    expect(r.karar).toBe("BLOCK");
    expect(r.sebepler.map((s) => s.kod)).toContain("DOGRULANMAMIS_ESLEME");
  });

  it("doğrulanmamış YÜKÜMLÜLÜK de zorunluda BLOK'tur", () => {
    const r = legalBasisDegerlendir([esleme({ obligationDogrulama: "LEGAL_REVIEW" })], AS_OF);
    expect(r.karar).toBe("BLOCK");
  });

  it("aynı sorun REHBER nitelikte BLOK DEĞİL uyarıdır", () => {
    const r = legalBasisDegerlendir(
      [esleme({ nitelik: "rehber", mappingDogrulama: "TODO_DOGRULA" })],
      AS_OF,
    );
    expect(r.karar).toBe("ALLOW_WITH_WARNING");
  });

  it("yürürlükten kalkmış hüküm zorunluda BLOK (asOf penceresi)", () => {
    const r = legalBasisDegerlendir(
      [esleme({ hukum: { provisionRef: "md. 26", effectiveFrom: "2020-01-01", effectiveTo: "2025-12-31", guncelKayit: true } })],
      AS_OF,
    );
    expect(r.karar).toBe("BLOCK");
    expect(r.sebepler.map((s) => s.kod)).toContain("HUKUM_YURURLUKTE_DEGIL");
  });

  it("henüz yürürlüğe girmemiş hüküm de yürürlükte değildir", () => {
    const r = legalBasisDegerlendir(
      [esleme({ hukum: { provisionRef: "md. 26", effectiveFrom: "2027-01-01", effectiveTo: null, guncelKayit: true } })],
      AS_OF,
    );
    expect(r.karar).toBe("BLOCK");
  });

  it("kapsam sorunları BLOK DEĞİL uyarıdır (kural 13 ruhu: ölçmeyi durdurma)", () => {
    for (const applicability of [
      { mevcut: false, durum: null, kosul: null, fingerprintGuncel: null },
      { mevcut: true, durum: "UNKNOWN" as const, kosul: null, fingerprintGuncel: true },
      { mevcut: true, durum: "APPLICABLE" as const, kosul: null, fingerprintGuncel: false },
      { mevcut: true, durum: "NOT_APPLICABLE" as const, kosul: null, fingerprintGuncel: true },
      { mevcut: true, durum: "CONDITIONAL" as const, kosul: "Halka açıksa", fingerprintGuncel: true },
    ]) {
      const r = legalBasisDegerlendir([esleme({ applicability })], AS_OF);
      expect(r.karar).toBe("ALLOW_WITH_WARNING");
    }
  });

  it("kısmi eşleme uyarı üretir — tek kontrol 'karşılandı' yanılsaması yapamaz", () => {
    const r = legalBasisDegerlendir([esleme({ kapsam: "kismi" })], AS_OF);
    expect(r.karar).toBe("ALLOW_WITH_WARNING");
    expect(r.sebepler.map((s) => s.kod)).toContain("KISMI_ESLEME");
  });

  it("bir BLOK her uyarıyı ezer; sebepler girdi sırasından bağımsızdır (kural 11)", () => {
    const a = esleme({ mappingId: "m-a", kapsam: "kismi" });
    const b = esleme({ mappingId: "m-b", mappingDogrulama: "REJECTED" });
    const r1 = legalBasisDegerlendir([a, b], AS_OF);
    const r2 = legalBasisDegerlendir([b, a], AS_OF);
    expect(r1.karar).toBe("BLOCK");
    expect(r1).toEqual(r2);
  });

  it("snapshot deterministik: aynı girdi aynı fotoğraf (eşleme sırası fark etmez)", () => {
    const a = esleme({ mappingId: "m-a" });
    const b = esleme({ mappingId: "m-b", nitelik: "rehber" });
    const s1 = executionLegalSnapshot([a, b], AS_OF, legalBasisDegerlendir([a, b], AS_OF));
    const s2 = executionLegalSnapshot([b, a], AS_OF, legalBasisDegerlendir([b, a], AS_OF));
    expect(s1).toEqual(s2);
    expect(s1.schema).toBe("KALKAN_EXECUTION_LEGAL_SNAPSHOT_V1");
  });
});
