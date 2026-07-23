import { describe, it, expect } from "vitest";
import { findEquivalentControlIds, findRelatedControlIds } from "../control-mappings";
import type { ControlMapping } from "../types";

const mappings: ControlMapping[] = [
  { id: "cm-01", controlIdA: "c-05", controlIdB: "c-7545-01", iliski: "esdeger" },
  { id: "cm-02", controlIdA: "c-07", controlIdB: "c-7545-02", iliski: "esdeger" },
  { id: "cm-03", controlIdA: "c-09", controlIdB: "c-99", iliski: "kismi" },
];

describe("findEquivalentControlIds", () => {
  it("finds the equivalent control regardless of which side it's mapped from", () => {
    expect(findEquivalentControlIds("c-05", mappings)).toEqual(["c-7545-01"]);
    expect(findEquivalentControlIds("c-7545-01", mappings)).toEqual(["c-05"]);
  });

  it("does not include kismi (partial) mappings", () => {
    expect(findEquivalentControlIds("c-09", mappings)).toEqual([]);
  });

  it("returns an empty array for a control with no mappings", () => {
    expect(findEquivalentControlIds("c-01", mappings)).toEqual([]);
  });
});

describe("findRelatedControlIds", () => {
  it("includes both esdeger and kismi relations, each labeled with its own iliski", () => {
    expect(findRelatedControlIds("c-05", mappings)).toEqual([
      { controlId: "c-7545-01", iliski: "esdeger" },
    ]);
    expect(findRelatedControlIds("c-09", mappings)).toEqual([{ controlId: "c-99", iliski: "kismi" }]);
  });

  it("resolves regardless of which side of the mapping the control is on", () => {
    expect(findRelatedControlIds("c-99", mappings)).toEqual([{ controlId: "c-09", iliski: "kismi" }]);
  });

  it("returns an empty array for a control with no mappings", () => {
    expect(findRelatedControlIds("c-01", mappings)).toEqual([]);
  });

  it("does not mutate findEquivalentControlIds' existing esdeger-only contract", () => {
    // Regresyon kilidi: findRelatedControlIds eklenmesi findEquivalentControlIds'i
    // değiştirmemeli (mevcut çağıranlar hâlâ yalnız esdeger görmeli).
    expect(findEquivalentControlIds("c-09", mappings)).toEqual([]);
  });
});
