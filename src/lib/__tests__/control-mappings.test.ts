import { describe, it, expect } from "vitest";
import { findEquivalentControlIds } from "../control-mappings";
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
