import type { ControlIliski, ControlMapping } from "./types";

/**
 * "Bir kanıt, dört çerçeve": bir kontrole eşdeğer (esdeger) olarak
 * eşlenmiş diğer kontrollerin id'lerini döner (yön farketmez).
 */
export function findEquivalentControlIds(controlId: string, mappings: ControlMapping[]): string[] {
  return mappings
    .filter((m) => m.iliski === "esdeger" && (m.controlIdA === controlId || m.controlIdB === controlId))
    .map((m) => (m.controlIdA === controlId ? m.controlIdB : m.controlIdA));
}

/**
 * FAZ 1 (Kanonik Kanıt): `findEquivalentControlIds`'in aksine 'kismi'
 * (kısmi eşdeğerlik) ilişkilerini de döner, her biri kendi `iliski`
 * değeriyle etiketli — çağıran, yansıtılan kanıt satırının `kapsam`
 * alanını buradan türetir ('esdeger' → 'tam', 'kismi' → 'kismi').
 * `findEquivalentControlIds`'in kendisi DEĞİŞMEDİ (mevcut çağıranlar ve
 * testleri bozulmasın diye) — bu ayrı, ek bir fonksiyon.
 */
export function findRelatedControlIds(
  controlId: string,
  mappings: ControlMapping[],
): { controlId: string; iliski: ControlIliski }[] {
  return mappings
    .filter((m) => m.controlIdA === controlId || m.controlIdB === controlId)
    .map((m) => ({
      controlId: m.controlIdA === controlId ? m.controlIdB : m.controlIdA,
      iliski: m.iliski,
    }));
}
