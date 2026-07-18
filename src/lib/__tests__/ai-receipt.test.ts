// M37 (G5): AI receipt fingerprint — deterministik, kaynak-hash sıra-bağımsız.
import { describe, expect, it } from "vitest";
import { aiReceiptFingerprint, type AiReceiptGirdisi } from "../ai-receipt";

const G: AiReceiptGirdisi = {
  aiSystemId: "s1",
  aiAgentId: "a1",
  amac: "yükümlülük çıkarımı",
  modelSaglayici: "X",
  modelId: "m1",
  modelSurum: "v1",
  promptHash: "b".repeat(64),
  kaynakHash: ["c".repeat(64), "a".repeat(64)],
  confidence: 0.8,
};

describe("aiReceiptFingerprint (M37)", () => {
  it("aynı girdi aynı fingerprint; 64-hex (kural 11+15)", async () => {
    const f1 = await aiReceiptFingerprint(G);
    const f2 = await aiReceiptFingerprint({ ...G });
    expect(f1).toBe(f2);
    expect(f1).toMatch(/^[0-9a-f]{64}$/);
  });

  it("kaynak hash SIRASI fingerprint'i değiştirmez", async () => {
    const f1 = await aiReceiptFingerprint(G);
    const f2 = await aiReceiptFingerprint({ ...G, kaynakHash: [...G.kaynakHash].reverse() });
    expect(f1).toBe(f2);
  });

  it("farklı model sürümü farklı fingerprint", async () => {
    const f1 = await aiReceiptFingerprint(G);
    const f2 = await aiReceiptFingerprint({ ...G, modelSurum: "v2" });
    expect(f1).not.toBe(f2);
  });
});
