// Kontrol testi koşusu manifesti (nihai talimat v3.2 §8.0, "İlk kapsam" madde 1).
import { describe, expect, it } from "vitest";
import { controlTestRunManifestHash, controlTestRunManifestKur } from "../kontrol-test-ledger";

describe("controlTestRunManifest (saf)", () => {
  it("deterministik: aynı girdi aynı hash'i verir", async () => {
    const args = {
      testRunId: "r1",
      controlId: "c1",
      testDefinitionId: "d1",
      sonuc: "PASSED",
      gerekce: "g",
      tanimSurumu: 1,
      calistiAt: "2026-07-19T00:00:00.000Z",
      evidenceId: null,
    };
    const h1 = await controlTestRunManifestHash(controlTestRunManifestKur(args));
    const h2 = await controlTestRunManifestHash(controlTestRunManifestKur({ ...args }));
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
  });

  it("sonuç değişirse hash değişir (kural 13: durumlar birleşmez, hash de ayrışır)", async () => {
    const base = {
      testRunId: "r1",
      controlId: "c1",
      testDefinitionId: "d1",
      gerekce: "g",
      tanimSurumu: 1,
      calistiAt: "2026-07-19T00:00:00.000Z",
      evidenceId: null,
    };
    const h1 = await controlTestRunManifestHash(controlTestRunManifestKur({ ...base, sonuc: "PASSED" }));
    const h2 = await controlTestRunManifestHash(controlTestRunManifestKur({ ...base, sonuc: "FAILED" }));
    expect(h1).not.toBe(h2);
  });
});
