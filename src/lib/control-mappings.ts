import type { ControlMapping } from "./types";

/**
 * "Bir kanıt, dört çerçeve": bir kontrole eşdeğer (esdeger) olarak
 * eşlenmiş diğer kontrollerin id'lerini döner (yön farketmez).
 */
export function findEquivalentControlIds(controlId: string, mappings: ControlMapping[]): string[] {
  return mappings
    .filter((m) => m.iliski === "esdeger" && (m.controlIdA === controlId || m.controlIdB === controlId))
    .map((m) => (m.controlIdA === controlId ? m.controlIdB : m.controlIdA));
}
