import { describe, it, expect } from "vitest";
import { isShareLinkValid } from "../share-links";
import type { ShareLink } from "../types";

const asOf = new Date("2026-07-16T00:00:00Z");

const baseLink: ShareLink = {
  id: "sl-01",
  tenantId: "t-demo",
  token: "abc123",
  kapsam: { frameworkId: "f-vii128" },
  olusturan: null,
  sonGecerlilik: "2026-08-01T00:00:00Z",
  createdAt: "2026-07-01T00:00:00Z",
};

describe("isShareLinkValid", () => {
  it("returns false for undefined (unknown token)", () => {
    expect(isShareLinkValid(undefined, asOf)).toBe(false);
  });

  it("returns true when the expiry is in the future", () => {
    expect(isShareLinkValid(baseLink, asOf)).toBe(true);
  });

  it("returns false when the expiry is in the past", () => {
    expect(isShareLinkValid({ ...baseLink, sonGecerlilik: "2026-01-01T00:00:00Z" }, asOf)).toBe(
      false,
    );
  });
});
