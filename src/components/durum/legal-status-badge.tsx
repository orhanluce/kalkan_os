// Mevzuat doğrulama durumu rozeti (kural 3 + M16 mevzuat_durumu sözlüğü).
//
// INTERNAL: KALKAN_OS'un kendi tasarım kararı — doğrulama beklemez.
// TODO_DOGRULA: SPK notu/araştırmadan türedi, hukuk/uyum onayı bekliyor.
// VERIFIED: doğrulandı (geçiş ayrı yetki ister, DB guard'lı).
// M21 knowledge graph durumları (DRAFT_RESEARCH/LEGAL_REVIEW/SUPERSEDED/
// REJECTED) o taş geldiğinde BURAYA eklenir — ikinci bir rozet bileşeni değil.
import { StatusBadge, type SemantikDurum } from "./status-badge";

export type MevzuatDurumu = "INTERNAL" | "TODO_DOGRULA" | "VERIFIED";

const ESLEME: Record<MevzuatDurumu, { durum: SemantikDurum; etiket: string }> = {
  INTERNAL: { durum: "neutral", etiket: "İç kural" },
  TODO_DOGRULA: { durum: "legal-review", etiket: "Hukuk onayı bekliyor" },
  VERIFIED: { durum: "success", etiket: "Doğrulandı" },
};

export function LegalStatusBadge({ mevzuatDurumu }: { mevzuatDurumu: MevzuatDurumu }) {
  const { durum, etiket } = ESLEME[mevzuatDurumu];
  return <StatusBadge durum={durum}>{etiket}</StatusBadge>;
}
