import type { Durum, TenantControl, Control } from "./types";

const DURUM_FACTOR: Record<Durum, number> = {
  karsilaniyor: 1,
  kismi: 0.5,
  acik: 0,
  kapsam_disi: 0, // excluded from denominator below, factor unused
};

/**
 * Kritiklik-ağırlıklı olgunluk skoru (0-100). kapsam_disi kontroller
 * paydadan da çıkarılır (uygulanabilir değiller). Uygulanabilir kontrol
 * yoksa 0 döner.
 */
export function calculateMaturityScore(
  tenantControls: TenantControl[],
  controls: Pick<Control, "id" | "kritiklik">[],
): number {
  const kritiklikById = new Map(controls.map((c) => [c.id, c.kritiklik]));

  let weightedSum = 0;
  let weightTotal = 0;

  for (const tc of tenantControls) {
    if (tc.durum === "kapsam_disi") continue;
    const kritiklik = kritiklikById.get(tc.controlId);
    if (kritiklik === undefined) continue;

    weightedSum += kritiklik * DURUM_FACTOR[tc.durum];
    weightTotal += kritiklik;
  }

  if (weightTotal === 0) return 0;
  return Math.round((weightedSum / weightTotal) * 100);
}

export function topRiskyOpenControls(
  tenantControls: TenantControl[],
  controls: Control[],
  limit = 10,
): Array<TenantControl & { control: Control }> {
  const controlById = new Map(controls.map((c) => [c.id, c]));

  return tenantControls
    .filter((tc) => tc.durum === "acik" || tc.durum === "kismi")
    .map((tc) => ({ ...tc, control: controlById.get(tc.controlId)! }))
    .filter((tc) => tc.control)
    .sort((a, b) => b.control.kritiklik - a.control.kritiklik)
    .slice(0, limit);
}
