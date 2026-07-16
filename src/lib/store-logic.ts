// store.tsx'in React'tan bağımsız, saf durum-geçiş mantığı. Burada
// tutulmasının sebebi doğrudan unit test edilebilmesi — store.tsx'teki
// setState kapanışları içinde kalsaydı yalnızca tarayıcıda (ve bu oturumda
// gördüğümüz gibi bazen o da güvenilir olmayabilen bir otomasyon aracıyla)
// doğrulanabilirdi.
import { findEquivalentControlIds } from "./control-mappings";
import { deriveDurumFromEvidenceExpiry } from "./evidence";
import type { Evidence } from "./evidence-types";
import type { ControlMapping, Finding, ShareLink, TenantControl } from "./types";

export interface StoreState {
  tenantControls: TenantControl[];
  findings: Finding[];
  evidencesByControl: Record<string, Evidence[]>;
  shareLinks: ShareLink[];
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
 * bir kopya olarak) yansıtır.
 */
export function addEvidenceToState(
  state: StoreState,
  evidence: Evidence,
  mappings: ControlMapping[],
  asOf: Date,
): StoreState {
  let next = applyEvidenceEntry(state, evidence, asOf);

  for (const mappedControlId of findEquivalentControlIds(evidence.controlId, mappings)) {
    next = applyEvidenceEntry(
      next,
      {
        ...evidence,
        id: `${evidence.id}-eslenik-${mappedControlId}`,
        controlId: mappedControlId,
        kaynakKontrolId: evidence.controlId,
      },
      asOf,
    );
  }

  return next;
}

/**
 * M2 kuralı: her yüklemede, en son kanıtı süresi geçmiş "karşılanıyor"
 * kontrolleri "kısmi"ye düşürür (gerçek bir cron yerine sorgu-anında hesap).
 */
export function applyExpiryDowngrades(state: StoreState, asOf: Date): StoreState {
  return {
    ...state,
    tenantControls: state.tenantControls.map((tc) => {
      const evidences = state.evidencesByControl[tc.controlId] ?? [];
      const latest = evidences[evidences.length - 1];
      if (!latest) return tc;
      const durum = deriveDurumFromEvidenceExpiry(tc.durum, latest.gecerlilikBitis, asOf);
      return durum === tc.durum ? tc : { ...tc, durum };
    }),
  };
}
