import { describe, it, expect } from "vitest";
import { sha256Hex, isEvidenceExpired, deriveDurumFromEvidenceExpiry } from "../evidence";

describe("sha256Hex", () => {
  it("matches the known SHA-256 of an empty input", async () => {
    const hash = await sha256Hex(new ArrayBuffer(0));
    expect(hash).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });

  it("matches the known SHA-256 of 'abc'", async () => {
    const bytes = new TextEncoder().encode("abc");
    const hash = await sha256Hex(bytes.buffer);
    expect(hash).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("is deterministic for the same input", async () => {
    const bytes = new TextEncoder().encode("kalkan-os");
    const a = await sha256Hex(bytes.buffer);
    const b = await sha256Hex(bytes.buffer);
    expect(a).toBe(b);
  });
});

describe("isEvidenceExpired", () => {
  const asOf = new Date("2026-07-16T00:00:00Z");

  it("returns false when there is no expiry date (e.g. beyan)", () => {
    expect(isEvidenceExpired(null, asOf)).toBe(false);
  });

  it("returns true for a past date", () => {
    expect(isEvidenceExpired("2026-01-01", asOf)).toBe(true);
  });

  it("returns false for a future date", () => {
    expect(isEvidenceExpired("2027-01-01", asOf)).toBe(false);
  });
});

describe("deriveDurumFromEvidenceExpiry", () => {
  const asOf = new Date("2026-07-16T00:00:00Z");

  it("downgrades karsilaniyor to kismi when evidence expired", () => {
    expect(deriveDurumFromEvidenceExpiry("karsilaniyor", "2026-01-01", asOf)).toBe("kismi");
  });

  it("keeps karsilaniyor when evidence still valid", () => {
    expect(deriveDurumFromEvidenceExpiry("karsilaniyor", "2027-01-01", asOf)).toBe("karsilaniyor");
  });

  it("does not touch acik, kismi, or kapsam_disi regardless of expiry", () => {
    expect(deriveDurumFromEvidenceExpiry("acik", "2026-01-01", asOf)).toBe("acik");
    expect(deriveDurumFromEvidenceExpiry("kismi", "2026-01-01", asOf)).toBe("kismi");
    expect(deriveDurumFromEvidenceExpiry("kapsam_disi", "2026-01-01", asOf)).toBe("kapsam_disi");
  });
});
