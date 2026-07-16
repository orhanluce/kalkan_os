import { describe, it, expect } from "vitest";
import {
  addEvidenceToState,
  addFindingToState,
  addShareLinkToState,
  applyExpiryDowngrades,
  setDurumInState,
  setNotInState,
  setSorumluInState,
  toggleFindingDurumInState,
  type ActorContext,
  type StoreState,
} from "../store-logic";
import type { Evidence } from "../evidence-types";
import type { ControlMapping, Finding, ShareLink, TenantControl } from "../types";

const ctx: ActorContext = { tenantId: "t1", actorId: "u-admin" };
const asOf = new Date("2026-07-16T12:00:00Z");

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

function baseFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    id: "fn-1",
    tenantId: "t1",
    kaynak: "ic_tespit",
    onem: "orta",
    baslik: "Test bulgusu",
    aksiyonPlani: null,
    ykOnayTarihi: null,
    hedefKapama: null,
    durum: "acik",
    ...overrides,
  };
}

function baseState(overrides: Partial<StoreState> = {}): StoreState {
  return {
    tenantControls: [tc("c-a", "acik")],
    findings: [],
    evidencesByControl: {},
    shareLinks: [],
    auditLog: [],
    ...overrides,
  };
}

describe("addEvidenceToState", () => {
  it("adds the evidence to evidencesByControl and marks the control karsilaniyor", () => {
    const next = addEvidenceToState(baseState(), baseEvidence(), [], ctx, asOf);

    expect(next.evidencesByControl["c-a"]).toHaveLength(1);
    expect(next.tenantControls.find((t) => t.controlId === "c-a")?.durum).toBe("karsilaniyor");
  });

  it("does not mutate the original state (immutability)", () => {
    const state = baseState();
    addEvidenceToState(state, baseEvidence(), [], ctx, asOf);

    expect(state.evidencesByControl["c-a"]).toBeUndefined();
    expect(state.tenantControls[0].durum).toBe("acik");
    expect(state.auditLog).toHaveLength(0);
  });

  it("downgrades straight to kismi when the evidence is already expired at upload time", () => {
    const next = addEvidenceToState(
      baseState(),
      baseEvidence({ gecerlilikBitis: "2020-01-01" }),
      [],
      ctx,
      asOf,
    );

    expect(next.tenantControls.find((t) => t.controlId === "c-a")?.durum).toBe("kismi");
  });

  it("propagates a tagged copy to equivalent controls (bir kanıt, dört çerçeve)", () => {
    const state = baseState({ tenantControls: [tc("c-a", "acik"), tc("c-b", "acik")] });
    const mappings: ControlMapping[] = [
      { id: "cm-1", controlIdA: "c-a", controlIdB: "c-b", iliski: "esdeger" },
    ];

    const next = addEvidenceToState(state, baseEvidence(), mappings, ctx, asOf);

    expect(next.evidencesByControl["c-b"]).toHaveLength(1);
    expect(next.evidencesByControl["c-b"][0].kaynakKontrolId).toBe("c-a");
    expect(next.evidencesByControl["c-a"][0].kaynakKontrolId).toBeNull();
    expect(next.tenantControls.find((t) => t.controlId === "c-b")?.durum).toBe("karsilaniyor");
  });

  it("does not propagate across a kismi (partial) mapping", () => {
    const state = baseState({ tenantControls: [tc("c-a", "acik"), tc("c-b", "acik")] });
    const mappings: ControlMapping[] = [
      { id: "cm-1", controlIdA: "c-a", controlIdB: "c-b", iliski: "kismi" },
    ];

    const next = addEvidenceToState(state, baseEvidence(), mappings, ctx, asOf);
    expect(next.evidencesByControl["c-b"]).toBeUndefined();
  });

  it("gives the propagated copy a distinct id from the original", () => {
    const state = baseState({ tenantControls: [tc("c-a", "acik"), tc("c-b", "acik")] });
    const mappings: ControlMapping[] = [
      { id: "cm-1", controlIdA: "c-a", controlIdB: "c-b", iliski: "esdeger" },
    ];

    const next = addEvidenceToState(state, baseEvidence({ id: "ev-original" }), mappings, ctx, asOf);

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

    const next = applyExpiryDowngrades(state, ctx, asOf);
    expect(next.tenantControls[0].durum).toBe("kismi");
  });

  it("leaves a karsilaniyor control alone when its evidence is still valid", () => {
    const state = baseState({
      tenantControls: [tc("c-a", "karsilaniyor")],
      evidencesByControl: { "c-a": [baseEvidence({ gecerlilikBitis: "2030-01-01" })] },
    });

    const next = applyExpiryDowngrades(state, ctx, asOf);
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

    const next = applyExpiryDowngrades(state, ctx, asOf);
    expect(next.tenantControls[0].durum).toBe("karsilaniyor");
  });

  it("leaves a control with no evidence untouched", () => {
    const next = applyExpiryDowngrades(baseState(), ctx, asOf);
    expect(next.tenantControls[0].durum).toBe("acik");
  });

  it("writes no audit entry when nothing changed (idempotent on repeat loads)", () => {
    const state = baseState({
      tenantControls: [tc("c-a", "karsilaniyor")],
      evidencesByControl: { "c-a": [baseEvidence({ gecerlilikBitis: "2030-01-01" })] },
    });

    const next = applyExpiryDowngrades(state, ctx, asOf);
    expect(next.auditLog).toHaveLength(0);
  });
});

// CLAUDE.md kural 2: audit_log append-only. Kural 7: loglara PII/kanıt
// içeriği yazılmaz.
describe("audit_log", () => {
  it("records a durum change with the previous and new value and the actor", () => {
    const next = setDurumInState(baseState(), "c-a", "karsilaniyor", ctx, asOf);

    expect(next.auditLog).toHaveLength(1);
    expect(next.auditLog[0]).toMatchObject({
      tenantId: "t1",
      actorId: "u-admin",
      eylem: "durum_degisti",
      hedefTablo: "tenant_controls",
      hedefId: "c-a",
      detay: { onceki: "acik", durum: "karsilaniyor" },
    });
    expect(next.auditLog[0].createdAt).toBe(asOf.toISOString());
  });

  it("records evidence upload", () => {
    const next = addEvidenceToState(baseState(), baseEvidence({ hashSha256: "abc123" }), [], ctx, asOf);

    const kanitKaydi = next.auditLog.find((e) => e.eylem === "kanit_eklendi");
    expect(kanitKaydi).toBeDefined();
    expect(kanitKaydi?.detay).toMatchObject({ controlId: "c-a", tip: "beyan", hashSha256: "abc123" });
  });

  it("records a separate entry for each propagated (eşlenik) evidence copy", () => {
    const state = baseState({ tenantControls: [tc("c-a", "acik"), tc("c-b", "acik")] });
    const mappings: ControlMapping[] = [
      { id: "cm-1", controlIdA: "c-a", controlIdB: "c-b", iliski: "esdeger" },
    ];

    const next = addEvidenceToState(state, baseEvidence(), mappings, ctx, asOf);

    const kanitKayitlari = next.auditLog.filter((e) => e.eylem === "kanit_eklendi");
    expect(kanitKayitlari).toHaveLength(2);
    expect(kanitKayitlari[1].detay).toMatchObject({ kaynakKontrolId: "c-a" });
  });

  it("attributes an automatic expiry downgrade to the system (actorId null), not a user", () => {
    const state = baseState({
      tenantControls: [tc("c-a", "karsilaniyor")],
      evidencesByControl: { "c-a": [baseEvidence({ gecerlilikBitis: "2020-01-01" })] },
    });

    const next = applyExpiryDowngrades(state, ctx, asOf);

    expect(next.auditLog).toHaveLength(1);
    expect(next.auditLog[0]).toMatchObject({ eylem: "kanit_suresi_doldu", actorId: null });
  });

  it("appends without ever mutating or removing existing entries (append-only)", () => {
    let state = baseState();
    state = setDurumInState(state, "c-a", "karsilaniyor", ctx, asOf);
    const ilkKayit = state.auditLog[0];

    state = setSorumluInState(state, "c-a", "u-uyum", ctx, asOf);
    state = setNotInState(state, "c-a", "bir not", ctx, asOf);
    state = addFindingToState(state, baseFinding(), ctx, asOf);

    expect(state.auditLog).toHaveLength(4);
    // İlk kayıt bit bit aynı kalmalı.
    expect(state.auditLog[0]).toEqual(ilkKayit);
  });

  it("does not write the note text into the audit detail (no PII in logs)", () => {
    const gizliNot = "Müşteri T.C. 12345678901 ile ilgili bulgu";
    const next = setNotInState(baseState(), "c-a", gizliNot, ctx, asOf);

    expect(JSON.stringify(next.auditLog)).not.toContain(gizliNot);
  });

  it("does not write the share token into the audit detail", () => {
    const shareLink: ShareLink = {
      id: "sl-1",
      tenantId: "t1",
      token: "cok-gizli-token-abc123",
      kapsam: { frameworkId: "f-vii128" },
      olusturan: "u-admin",
      sonGecerlilik: "2026-08-01T00:00:00Z",
      createdAt: "2026-07-16T00:00:00Z",
    };

    const next = addShareLinkToState(baseState(), shareLink, ctx, asOf);

    expect(JSON.stringify(next.auditLog)).not.toContain("cok-gizli-token-abc123");
    expect(next.auditLog[0].eylem).toBe("paylasim_linki_olusturuldu");
  });

  it("records finding lifecycle changes", () => {
    let state = baseState({ findings: [baseFinding()] });
    state = toggleFindingDurumInState(state, "fn-1", ctx, asOf);

    expect(state.findings[0].durum).toBe("kapali");
    expect(state.auditLog[0]).toMatchObject({
      eylem: "bulgu_durumu_degisti",
      hedefId: "fn-1",
      detay: { onceki: "acik", yeni: "kapali" },
    });
  });

  it("writes no entry when a setter is called with the value it already has", () => {
    const state = baseState({ tenantControls: [tc("c-a", "acik")] });

    expect(setDurumInState(state, "c-a", "acik", ctx, asOf).auditLog).toHaveLength(0);
    expect(setSorumluInState(state, "c-a", null, ctx, asOf).auditLog).toHaveLength(0);
    expect(setNotInState(state, "c-a", "", ctx, asOf).auditLog).toHaveLength(0);
  });
});
