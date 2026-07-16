import { describe, it, expect } from "vitest";
import { addEvidenceToState, applyExpiryDowngrades, type StoreState } from "../store-logic";
import type { Evidence } from "../evidence-types";
import type { ControlMapping, TenantControl } from "../types";

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

function baseEvidence(overrides: Partial<Evidence> = {}): Evidence {
  return {
    id: "ev-1",
    controlId: "c-a",
    tip: "beyan",
    storagePathOrLink: "test",
    hashSha256: null,
    gecerlilikBitis: null,
    createdAt: "2026-07-16T00:00:00Z",
    kaynakKontrolId: null,
    ...overrides,
  };
}

function baseState(overrides: Partial<StoreState> = {}): StoreState {
  return {
    tenantControls: [tc("c-a", "acik")],
    findings: [],
    evidencesByControl: {},
    shareLinks: [],
    ...overrides,
  };
}

const asOf = new Date("2026-07-16T12:00:00Z");

describe("addEvidenceToState", () => {
  it("adds the evidence to evidencesByControl and marks the control karsilaniyor", () => {
    const state = baseState();
    const next = addEvidenceToState(state, baseEvidence(), [], asOf);

    expect(next.evidencesByControl["c-a"]).toHaveLength(1);
    expect(next.tenantControls.find((t) => t.controlId === "c-a")?.durum).toBe("karsilaniyor");
  });

  it("does not mutate the original state (immutability)", () => {
    const state = baseState();
    addEvidenceToState(state, baseEvidence(), [], asOf);

    expect(state.evidencesByControl["c-a"]).toBeUndefined();
    expect(state.tenantControls[0].durum).toBe("acik");
  });

  it("downgrades straight to kismi when the evidence is already expired at upload time", () => {
    const state = baseState();
    const next = addEvidenceToState(
      state,
      baseEvidence({ gecerlilikBitis: "2020-01-01" }),
      [],
      asOf,
    );

    expect(next.tenantControls.find((t) => t.controlId === "c-a")?.durum).toBe("kismi");
  });

  it("propagates a tagged copy to equivalent controls (bir kanıt, dört çerçeve)", () => {
    const state = baseState({
      tenantControls: [tc("c-a", "acik"), tc("c-b", "acik")],
    });
    const mappings: ControlMapping[] = [
      { id: "cm-1", controlIdA: "c-a", controlIdB: "c-b", iliski: "esdeger" },
    ];

    const next = addEvidenceToState(state, baseEvidence(), mappings, asOf);

    expect(next.evidencesByControl["c-b"]).toHaveLength(1);
    expect(next.evidencesByControl["c-b"][0].kaynakKontrolId).toBe("c-a");
    expect(next.evidencesByControl["c-a"][0].kaynakKontrolId).toBeNull();
    expect(next.tenantControls.find((t) => t.controlId === "c-b")?.durum).toBe("karsilaniyor");
  });

  it("does not propagate across a kismi (partial) mapping", () => {
    const state = baseState({
      tenantControls: [tc("c-a", "acik"), tc("c-b", "acik")],
    });
    const mappings: ControlMapping[] = [
      { id: "cm-1", controlIdA: "c-a", controlIdB: "c-b", iliski: "kismi" },
    ];

    const next = addEvidenceToState(state, baseEvidence(), mappings, asOf);

    expect(next.evidencesByControl["c-b"]).toBeUndefined();
  });

  it("gives the propagated copy a distinct id from the original", () => {
    const state = baseState({
      tenantControls: [tc("c-a", "acik"), tc("c-b", "acik")],
    });
    const mappings: ControlMapping[] = [
      { id: "cm-1", controlIdA: "c-a", controlIdB: "c-b", iliski: "esdeger" },
    ];

    const next = addEvidenceToState(state, baseEvidence({ id: "ev-original" }), mappings, asOf);

    expect(next.evidencesByControl["c-a"][0].id).toBe("ev-original");
    expect(next.evidencesByControl["c-b"][0].id).not.toBe("ev-original");
  });
});

describe("applyExpiryDowngrades", () => {
  it("downgrades a karsilaniyor control whose latest evidence has expired", () => {
    const state = baseState({
      tenantControls: [tc("c-a", "karsilaniyor")],
      evidencesByControl: { "c-a": [baseEvidence({ gecerlilikBitis: "2020-01-01" })] },
    });

    const next = applyExpiryDowngrades(state, asOf);
    expect(next.tenantControls[0].durum).toBe("kismi");
  });

  it("leaves a karsilaniyor control alone when its evidence is still valid", () => {
    const state = baseState({
      tenantControls: [tc("c-a", "karsilaniyor")],
      evidencesByControl: { "c-a": [baseEvidence({ gecerlilikBitis: "2030-01-01" })] },
    });

    const next = applyExpiryDowngrades(state, asOf);
    expect(next.tenantControls[0].durum).toBe("karsilaniyor");
  });

  it("evaluates only the most recently added evidence, not the earliest", () => {
    const state = baseState({
      tenantControls: [tc("c-a", "karsilaniyor")],
      evidencesByControl: {
        "c-a": [
          baseEvidence({ id: "ev-old", gecerlilikBitis: "2020-01-01" }),
          baseEvidence({ id: "ev-new", gecerlilikBitis: "2030-01-01" }),
        ],
      },
    });

    const next = applyExpiryDowngrades(state, asOf);
    expect(next.tenantControls[0].durum).toBe("karsilaniyor");
  });

  it("leaves a control with no evidence untouched", () => {
    const state = baseState({ tenantControls: [tc("c-a", "acik")] });
    const next = applyExpiryDowngrades(state, asOf);
    expect(next.tenantControls[0].durum).toBe("acik");
  });
});
