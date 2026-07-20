// G3 defter kapsamı genişlemesi — yeni artefakt manifestleri (nihai v3.3 §8.0
// Dikey 1). Deterministik hash (kural 11/15): aynı girdi aynı hash; içerik
// değişince hash değişir; sıra bağımsızlık.
import { describe, expect, it } from "vitest";
import {
  tprAssessmentSignoffManifestHash,
  tprAssessmentSignoffManifestKur,
  tprCriticalFindingClosureManifestHash,
  tprCriticalFindingClosureManifestKur,
} from "../tedarikci-ledger";
import {
  CONTROL_TEST_RUN_MANIFEST_SCHEMA,
  CONTROL_TEST_RUN_MANIFEST_SCHEMA_V2,
  controlTestRunManifestHash,
  controlTestRunManifestKur,
} from "../kontrol-test-ledger";
import { aiIncidentClosureManifestHash, aiIncidentClosureManifestKur } from "../ai-olay";
import { aiReceiptDecisionManifestHash, aiReceiptDecisionManifestKur } from "../ai-receipt";
import { boardDeclarationAttestationManifestHash, boardDeclarationAttestationManifestKur } from "../board-declaration-ledger";

describe("kontrol testi koşusu manifesti V2 (Dikey 2 zengin snapshot)", () => {
  const base = {
    testRunId: "r1", controlId: "c1", testDefinitionId: "d1", tanimSurumu: 1,
    amac: "a", kapsam: "k", hedefVarlik: "h", kritikHizmetAdi: "kh", senaryoKimligi: "TAT-01", senaryoSurumu: 1,
    sonuc: "PASSED", gerekce: "g", beklenenSonuc: "b", performansEtkisi: "yok",
    yanlisPozitif: false, yanlisNegatif: false, baslangicAt: "2026-07-19T00:00:00.000Z",
    bitisAt: "2026-07-19T00:01:00.000Z", calistiAt: "2026-07-19T00:01:00.000Z",
    hazirlayan: "u1", sorumlu: "u2", bagimsizOnaylayan: "u3", evidenceId: null,
    retestOfFindingId: null, criticalServiceId: null, scenarioTemplateId: null,
  };
  it("deterministik + 64-hex; log referans SIRASI hash'i değiştirmez", async () => {
    const h1 = await controlTestRunManifestHash(controlTestRunManifestKur({ ...base, logReferanslari: [{ ad: "b", hash: null }, { ad: "a", hash: "x".repeat(64) }] }));
    const h2 = await controlTestRunManifestHash(controlTestRunManifestKur({ ...base, logReferanslari: [{ ad: "a", hash: "x".repeat(64) }, { ad: "b", hash: null }] }));
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
    expect(h1).toBe(h2);
  });
  it("sonuç değişince hash değişir (kural 13)", async () => {
    const h1 = await controlTestRunManifestHash(controlTestRunManifestKur({ ...base, sonuc: "PASSED" }));
    const h2 = await controlTestRunManifestHash(controlTestRunManifestKur({ ...base, sonuc: "FAILED" }));
    expect(h1).not.toBe(h2);
  });
  it("beklenen sonuç (snapshot) değişince hash değişir", async () => {
    const h1 = await controlTestRunManifestHash(controlTestRunManifestKur({ ...base, beklenenSonuc: "b1" }));
    const h2 = await controlTestRunManifestHash(controlTestRunManifestKur({ ...base, beklenenSonuc: "b2" }));
    expect(h1).not.toBe(h2);
  });

  describe("V3 (Dikey F, F1): retest/kritik hizmet/senaryo referansları", () => {
    it("şema V3'tür ve V2 sabiti hâlâ ayrı bir sabit olarak dışa açık (eski kayıtlar okunabilir)", () => {
      expect(CONTROL_TEST_RUN_MANIFEST_SCHEMA).toBe("KALKAN_CONTROL_TEST_RUN_MANIFEST_V3");
      expect(CONTROL_TEST_RUN_MANIFEST_SCHEMA_V2).toBe("KALKAN_CONTROL_TEST_RUN_MANIFEST_V2");
      expect(CONTROL_TEST_RUN_MANIFEST_SCHEMA).not.toBe(CONTROL_TEST_RUN_MANIFEST_SCHEMA_V2);
    });

    it("findingId alanı manifestte HİÇ yok (bilinçli mimari karar — bkz. ADR §3)", () => {
      const m = controlTestRunManifestKur(base);
      expect("findingId" in m).toBe(false);
    });

    it("retestOfFindingId belirtilmezse null kalır (normal ilk koşu)", async () => {
      const m = controlTestRunManifestKur(base);
      expect(m.retestOfFindingId).toBeNull();
      expect(await controlTestRunManifestHash(m)).toMatch(/^[0-9a-f]{64}$/);
    });

    it("retestOfFindingId doluysa hash'e taşınır (retest koşusu)", async () => {
      const h1 = await controlTestRunManifestHash(controlTestRunManifestKur({ ...base, retestOfFindingId: null }));
      const h2 = await controlTestRunManifestHash(controlTestRunManifestKur({ ...base, retestOfFindingId: "f1" }));
      expect(h1).not.toBe(h2);
    });

    it("criticalServiceId/scenarioTemplateId değişince hash değişir", async () => {
      const h1 = await controlTestRunManifestHash(controlTestRunManifestKur({ ...base, criticalServiceId: "cs1" }));
      const h2 = await controlTestRunManifestHash(controlTestRunManifestKur({ ...base, criticalServiceId: "cs2" }));
      expect(h1).not.toBe(h2);
    });

    it("V2-şekilli eski bir manifest (yeni alanlar hiç yokmuş gibi null) hâlâ deterministik hash üretir — eski kayıt bozuk sayılmaz", async () => {
      const eskiSekil = { ...base, retestOfFindingId: null, criticalServiceId: null, scenarioTemplateId: null };
      const h1 = await controlTestRunManifestHash(controlTestRunManifestKur(eskiSekil));
      const h2 = await controlTestRunManifestHash(controlTestRunManifestKur(eskiSekil));
      expect(h1).toBe(h2);
    });
  });
});

describe("TPR sign-off manifesti", () => {
  const base = { assessmentId: "a1", thirdPartyId: "t1", tur: "DORA", degerlendiren: "u1", tamamlandiAt: "2026-07-19T00:00:00.000Z" };
  it("deterministik + 64-hex", async () => {
    const h = await tprAssessmentSignoffManifestHash(tprAssessmentSignoffManifestKur(base));
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).toBe(await tprAssessmentSignoffManifestHash(tprAssessmentSignoffManifestKur({ ...base })));
  });
  it("değerlendiren değişince hash değişir", async () => {
    const h1 = await tprAssessmentSignoffManifestHash(tprAssessmentSignoffManifestKur(base));
    const h2 = await tprAssessmentSignoffManifestHash(tprAssessmentSignoffManifestKur({ ...base, degerlendiren: "u2" }));
    expect(h1).not.toBe(h2);
  });
});

describe("TPR kritik bulgu kapanış manifesti", () => {
  it("kapanış kanıtı değişince hash değişir", async () => {
    const base = { findingId: "f1", assessmentId: "a1", thirdPartyId: "t1", baslik: "B", kapanisKanit: "k1", kapatan: "u1", kapanisZamani: "2026-07-19T00:00:00.000Z" };
    const h1 = await tprCriticalFindingClosureManifestHash(tprCriticalFindingClosureManifestKur(base));
    const h2 = await tprCriticalFindingClosureManifestHash(tprCriticalFindingClosureManifestKur({ ...base, kapanisKanit: "k2" }));
    expect(h1).not.toBe(h2);
  });
});

describe("AI olay kapanış manifesti", () => {
  it("deterministik + ciddiyet değişince hash değişir", async () => {
    const base = { incidentId: "i1", aiSystemId: "s1", ciddiyet: "KRITIK" as const, kapanisKanit: "k", kapatan: "u1", kapanisZamani: "2026-07-19T00:00:00.000Z" };
    const h1 = await aiIncidentClosureManifestHash(aiIncidentClosureManifestKur(base));
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
    const h2 = await aiIncidentClosureManifestHash(aiIncidentClosureManifestKur({ ...base, ciddiyet: "YUKSEK" }));
    expect(h1).not.toBe(h2);
  });
});

describe("AI receipt karar manifesti", () => {
  it("karar (ACCEPTED/REJECTED) değişince hash değişir", async () => {
    const base = { receiptId: "r1", receiptFingerprint: "a".repeat(64), karar: "ACCEPTED" as const, reviewer: "u1", reviewerKararZamani: "2026-07-19T00:00:00.000Z" };
    const h1 = await aiReceiptDecisionManifestHash(aiReceiptDecisionManifestKur(base));
    const h2 = await aiReceiptDecisionManifestHash(aiReceiptDecisionManifestKur({ ...base, karar: "REJECTED" }));
    expect(h1).not.toBe(h2);
  });
});

describe("YK beyanı attestation manifesti", () => {
  it("cevap SIRASI hash'i değiştirmez (kural 11 sıra bağımsızlık)", async () => {
    const cevaplar = [
      { questionId: "q2", beyan: "evet", aciklama: null, tarih: null },
      { questionId: "q1", beyan: "hayir", aciklama: "x", tarih: "2026-07-01" },
    ];
    const m1 = boardDeclarationAttestationManifestKur({ declarationId: "d1", donemEtiketi: "2026-Q3", sunan: "u1", sunulduAt: "2026-07-19T00:00:00.000Z", cevaplar });
    const m2 = boardDeclarationAttestationManifestKur({ declarationId: "d1", donemEtiketi: "2026-Q3", sunan: "u1", sunulduAt: "2026-07-19T00:00:00.000Z", cevaplar: [...cevaplar].reverse() });
    expect(await boardDeclarationAttestationManifestHash(m1)).toBe(await boardDeclarationAttestationManifestHash(m2));
  });
  it("bir cevap değişince hash değişir", async () => {
    const cevaplar = [{ questionId: "q1", beyan: "evet", aciklama: null, tarih: null }];
    const m1 = boardDeclarationAttestationManifestKur({ declarationId: "d1", donemEtiketi: "2026-Q3", sunan: "u1", sunulduAt: "2026-07-19T00:00:00.000Z", cevaplar });
    const m2 = boardDeclarationAttestationManifestKur({ declarationId: "d1", donemEtiketi: "2026-Q3", sunan: "u1", sunulduAt: "2026-07-19T00:00:00.000Z", cevaplar: [{ ...cevaplar[0], beyan: "hayir" }] });
    expect(await boardDeclarationAttestationManifestHash(m1)).not.toBe(await boardDeclarationAttestationManifestHash(m2));
  });
});
