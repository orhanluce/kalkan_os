import { describe, it, expect } from "vitest";
import { calculateMaturityScore, topRiskyOpenControls } from "../maturity";
import type { Control, TenantControl } from "../types";

const controls: Control[] = [
  {
    id: "c1",
    frameworkId: "f1",
    maddeRef: "1",
    baslik: "A",
    aciklama: "",
    kanitTipi: [],
    periyot: "yillik",
    kritiklik: 5,
  },
  {
    id: "c2",
    frameworkId: "f1",
    maddeRef: "2",
    baslik: "B",
    aciklama: "",
    kanitTipi: [],
    periyot: "yillik",
    kritiklik: 3,
  },
  {
    id: "c3",
    frameworkId: "f1",
    maddeRef: "3",
    baslik: "C",
    aciklama: "",
    kanitTipi: [],
    periyot: "yillik",
    kritiklik: 1,
  },
];

function tc(controlId: string, durum: TenantControl["durum"]): TenantControl {
  return {
    id: `tc-${controlId}`,
    tenantId: "t1",
    controlId,
    durum,
    sorumluUserId: null,
    sonDegerlendirme: null,
    notMetni: null,
  };
}

describe("calculateMaturityScore", () => {
  it("returns 100 when every control is fully met", () => {
    const score = calculateMaturityScore(
      [tc("c1", "karsilaniyor"), tc("c2", "karsilaniyor"), tc("c3", "karsilaniyor")],
      controls,
    );
    expect(score).toBe(100);
  });

  it("returns 0 when every control is open", () => {
    const score = calculateMaturityScore(
      [tc("c1", "acik"), tc("c2", "acik"), tc("c3", "acik")],
      controls,
    );
    expect(score).toBe(0);
  });

  it("weighs by kritiklik, not by control count", () => {
    // c1 (kritiklik 5) open, c2+c3 (kritiklik 3+1) fully met.
    // weighted = (5*0 + 3*1 + 1*1) / (5+3+1) = 4/9 -> 44
    const score = calculateMaturityScore(
      [tc("c1", "acik"), tc("c2", "karsilaniyor"), tc("c3", "karsilaniyor")],
      controls,
    );
    expect(score).toBe(44);
  });

  it("counts kismi as half credit", () => {
    const score = calculateMaturityScore([tc("c1", "kismi")], controls);
    expect(score).toBe(50);
  });

  it("excludes kapsam_disi controls from both numerator and denominator", () => {
    const score = calculateMaturityScore(
      [tc("c1", "kapsam_disi"), tc("c2", "karsilaniyor")],
      controls,
    );
    expect(score).toBe(100);
  });

  it("returns 0 for an empty control set", () => {
    expect(calculateMaturityScore([], controls)).toBe(0);
  });

  it("is deterministic across repeated calls with the same input", () => {
    const input: TenantControl[] = [tc("c1", "kismi"), tc("c2", "acik"), tc("c3", "karsilaniyor")];
    const first = calculateMaturityScore(input, controls);
    const second = calculateMaturityScore(input, controls);
    expect(first).toBe(second);
  });
});

describe("topRiskyOpenControls", () => {
  it("sorts open/kismi controls by kritiklik descending and excludes met/out-of-scope", () => {
    const result = topRiskyOpenControls(
      [tc("c3", "acik"), tc("c1", "kismi"), tc("c2", "karsilaniyor")],
      controls,
    );
    expect(result.map((r) => r.controlId)).toEqual(["c1", "c3"]);
  });

  it("respects the limit parameter", () => {
    const result = topRiskyOpenControls(
      [tc("c1", "acik"), tc("c2", "acik"), tc("c3", "acik")],
      controls,
      2,
    );
    expect(result).toHaveLength(2);
  });
});
