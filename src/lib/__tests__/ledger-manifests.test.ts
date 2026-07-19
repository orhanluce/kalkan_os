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
import { aiIncidentClosureManifestHash, aiIncidentClosureManifestKur } from "../ai-olay";
import { aiReceiptDecisionManifestHash, aiReceiptDecisionManifestKur } from "../ai-receipt";
import { boardDeclarationAttestationManifestHash, boardDeclarationAttestationManifestKur } from "../board-declaration-ledger";

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
