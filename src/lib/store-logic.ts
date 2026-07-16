// store.tsx'in React'tan bağımsız, saf durum-geçiş mantığı. Burada
// tutulmasının sebebi doğrudan unit test edilebilmesi — store.tsx'teki
// setState kapanışları içinde kalsaydı yalnızca tarayıcıda (ve bu oturumda
// gördüğümüz gibi bazen o da güvenilir olmayabilen bir otomasyon aracıyla)
// doğrulanabilirdi.
import { findEquivalentControlIds } from "./control-mappings";
import { deriveDurumFromEvidenceExpiry } from "./evidence";
import type { Evidence } from "./evidence-types";
import type {
  AuditEylem,
  AuditLogEntry,
  ControlMapping,
  Durum,
  Finding,
  ShareLink,
  TenantControl,
} from "./types";

export interface StoreState {
  tenantControls: TenantControl[];
  findings: Finding[];
  evidencesByControl: Record<string, Evidence[]>;
  shareLinks: ShareLink[];
  auditLog: AuditLogEntry[];
}

/** Eylemi kimin, hangi tenant adına yaptığı. actorId null ise sistem eylemi. */
export interface ActorContext {
  tenantId: string;
  actorId: string | null;
}

/**
 * audit_log'a kayıt ekler. APPEND-ONLY (CLAUDE.md kural 2): bu dosyada
 * auditLog dizisinden kayıt çıkaran veya var olan bir kaydı değiştiren
 * başka bir yol YOKTUR ve eklenmemelidir.
 */
function appendAudit(
  state: StoreState,
  ctx: ActorContext,
  eylem: AuditEylem,
  hedefTablo: string | null,
  hedefId: string | null,
  detay: Record<string, unknown> | null,
  asOf: Date,
): StoreState {
  const entry: AuditLogEntry = {
    id: crypto.randomUUID(),
    tenantId: ctx.tenantId,
    actorId: ctx.actorId,
    eylem,
    hedefTablo,
    hedefId,
    detay,
    createdAt: asOf.toISOString(),
  };
  return { ...state, auditLog: [...state.auditLog, entry] };
}

export function setDurumInState(
  state: StoreState,
  controlId: string,
  durum: Durum,
  ctx: ActorContext,
  asOf: Date,
): StoreState {
  const onceki = state.tenantControls.find((tc) => tc.controlId === controlId)?.durum;
  if (onceki === durum) return state;

  const next: StoreState = {
    ...state,
    tenantControls: state.tenantControls.map((tc) =>
      tc.controlId === controlId ? { ...tc, durum } : tc,
    ),
  };
  return appendAudit(next, ctx, "durum_degisti", "tenant_controls", controlId, { onceki, durum }, asOf);
}

export function setNotInState(
  state: StoreState,
  controlId: string,
  notMetni: string,
  ctx: ActorContext,
  asOf: Date,
): StoreState {
  const onceki = state.tenantControls.find((tc) => tc.controlId === controlId)?.notMetni ?? null;
  const yeni = notMetni || null;
  if (onceki === yeni) return state;

  const next: StoreState = {
    ...state,
    tenantControls: state.tenantControls.map((tc) =>
      tc.controlId === controlId ? { ...tc, notMetni: yeni } : tc,
    ),
  };
  // Not içeriği audit detayına YAZILMAZ (CLAUDE.md kural 7: loglara PII/kanıt
  // içeriği yazılmaz) — yalnızca değiştiği bilgisi tutulur.
  return appendAudit(next, ctx, "not_guncellendi", "tenant_controls", controlId, null, asOf);
}

export function setSorumluInState(
  state: StoreState,
  controlId: string,
  sorumluUserId: string | null,
  ctx: ActorContext,
  asOf: Date,
): StoreState {
  const onceki = state.tenantControls.find((tc) => tc.controlId === controlId)?.sorumluUserId ?? null;
  if (onceki === sorumluUserId) return state;

  const next: StoreState = {
    ...state,
    tenantControls: state.tenantControls.map((tc) =>
      tc.controlId === controlId ? { ...tc, sorumluUserId } : tc,
    ),
  };
  return appendAudit(
    next,
    ctx,
    "sorumlu_atandi",
    "tenant_controls",
    controlId,
    { onceki, yeni: sorumluUserId },
    asOf,
  );
}

function applyEvidenceEntry(state: StoreState, evidence: Evidence, asOf: Date): StoreState {
  const existing = state.evidencesByControl[evidence.controlId] ?? [];
  const nextDurum = deriveDurumFromEvidenceExpiry("karsilaniyor", evidence.gecerlilikBitis, asOf);
  return {
    ...state,
    evidencesByControl: {
      ...state.evidencesByControl,
      [evidence.controlId]: [...existing, evidence],
    },
    tenantControls: state.tenantControls.map((tc) =>
      tc.controlId === evidence.controlId
        ? { ...tc, durum: nextDurum, sonDegerlendirme: evidence.createdAt }
        : tc,
    ),
  };
}

/**
 * Bir kanıtı state'e ekler ve "bir kanıt, dört çerçeve" kuralı gereği
 * control_mappings üzerinden eşdeğer kontrollere de (kaynağı etiketlenmiş
 * bir kopya olarak) yansıtır. Hem asıl hem yansıtılan kanıt için audit
 * kaydı yazılır — denetçi, bir kontrolün neden "karşılanıyor" olduğunu
 * izleyebilmeli.
 */
export function addEvidenceToState(
  state: StoreState,
  evidence: Evidence,
  mappings: ControlMapping[],
  ctx: ActorContext,
  asOf: Date,
): StoreState {
  let next = applyEvidenceEntry(state, evidence, asOf);
  // Kanıt içeriği/dosya adı audit detayına yazılmaz (CLAUDE.md kural 7);
  // hash ve tip, kaydın hangi kanıta ait olduğunu göstermeye yeter.
  next = appendAudit(next, ctx, "kanit_eklendi", "evidences", evidence.id, {
    controlId: evidence.controlId,
    tip: evidence.tip,
    hashSha256: evidence.hashSha256,
  }, asOf);

  for (const mappedControlId of findEquivalentControlIds(evidence.controlId, mappings)) {
    const yansitilan: Evidence = {
      ...evidence,
      id: `${evidence.id}-eslenik-${mappedControlId}`,
      controlId: mappedControlId,
      kaynakKontrolId: evidence.controlId,
    };
    next = applyEvidenceEntry(next, yansitilan, asOf);
    next = appendAudit(next, ctx, "kanit_eklendi", "evidences", yansitilan.id, {
      controlId: mappedControlId,
      tip: yansitilan.tip,
      hashSha256: yansitilan.hashSha256,
      kaynakKontrolId: evidence.controlId,
    }, asOf);
  }

  return next;
}

/**
 * M2 kuralı: her yüklemede, en son kanıtı süresi geçmiş "karşılanıyor"
 * kontrolleri "kısmi"ye düşürür (gerçek bir cron yerine sorgu-anında hesap).
 * Bu bir sistem eylemidir — audit kaydına actorId null yazılır.
 */
export function applyExpiryDowngrades(
  state: StoreState,
  ctx: ActorContext,
  asOf: Date,
): StoreState {
  const dusenler: string[] = [];

  const tenantControls = state.tenantControls.map((tc) => {
    const evidences = state.evidencesByControl[tc.controlId] ?? [];
    const latest = evidences[evidences.length - 1];
    if (!latest) return tc;
    const durum = deriveDurumFromEvidenceExpiry(tc.durum, latest.gecerlilikBitis, asOf);
    if (durum === tc.durum) return tc;
    dusenler.push(tc.controlId);
    return { ...tc, durum };
  });

  let next: StoreState = { ...state, tenantControls };
  for (const controlId of dusenler) {
    next = appendAudit(
      next,
      { tenantId: ctx.tenantId, actorId: null },
      "kanit_suresi_doldu",
      "tenant_controls",
      controlId,
      { durum: "kismi" },
      asOf,
    );
  }
  return next;
}

export function addFindingToState(
  state: StoreState,
  finding: Finding,
  ctx: ActorContext,
  asOf: Date,
): StoreState {
  const next: StoreState = { ...state, findings: [finding, ...state.findings] };
  return appendAudit(next, ctx, "bulgu_eklendi", "findings", finding.id, {
    kaynak: finding.kaynak,
    onem: finding.onem,
  }, asOf);
}

export function toggleFindingDurumInState(
  state: StoreState,
  findingId: string,
  ctx: ActorContext,
  asOf: Date,
): StoreState {
  const mevcut = state.findings.find((f) => f.id === findingId);
  if (!mevcut) return state;
  const yeni = mevcut.durum === "acik" ? "kapali" : "acik";

  const next: StoreState = {
    ...state,
    findings: state.findings.map((f) => (f.id === findingId ? { ...f, durum: yeni } : f)),
  };
  return appendAudit(next, ctx, "bulgu_durumu_degisti", "findings", findingId, {
    onceki: mevcut.durum,
    yeni,
  }, asOf);
}

export function updateFindingInState(
  state: StoreState,
  findingId: string,
  patch: Partial<Finding>,
  ctx: ActorContext,
  asOf: Date,
): StoreState {
  const mevcut = state.findings.find((f) => f.id === findingId);
  if (!mevcut) return state;

  const next: StoreState = {
    ...state,
    findings: state.findings.map((f) => (f.id === findingId ? { ...f, ...patch } : f)),
  };
  // Aksiyon planı metni serbest metin — audit detayına içerik değil, yalnızca
  // hangi alanların değiştiği yazılır (CLAUDE.md kural 7).
  return appendAudit(next, ctx, "bulgu_durumu_degisti", "findings", findingId, {
    degisenAlanlar: Object.keys(patch),
  }, asOf);
}

export function addShareLinkToState(
  state: StoreState,
  shareLink: ShareLink,
  ctx: ActorContext,
  asOf: Date,
): StoreState {
  const next: StoreState = { ...state, shareLinks: [shareLink, ...state.shareLinks] };
  // Token audit detayına YAZILMAZ — logdan okunabilseydi paylaşım linkinin
  // gizliliği anlamsızlaşırdı (CLAUDE.md kural 7).
  return appendAudit(next, ctx, "paylasim_linki_olusturuldu", "share_links", shareLink.id, {
    frameworkId: shareLink.kapsam.frameworkId,
    sonGecerlilik: shareLink.sonGecerlilik,
  }, asOf);
}
