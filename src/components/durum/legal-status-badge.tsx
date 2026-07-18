// Mevzuat doğrulama durumu rozeti (kural 3 + M16 mevzuat_durumu sözlüğü).
//
// Etiket ve semantik TEK kaynaktan (ui-labels): ürünün yerleşik dili
// ("Doğrulanmadı" vb.) burada YENİDEN icat edilmez. M21 knowledge graph
// durumları (DRAFT_RESEARCH/LEGAL_REVIEW/SUPERSEDED/REJECTED) o taş
// geldiğinde ui-labels eşlemesine eklenir — ikinci bir rozet bileşeni değil.
import { SOD_MEVZUAT_DURUMU_LABEL, SOD_MEVZUAT_DURUMU_SEMANTIK } from "@/lib/ui-labels";
import { StatusBadge } from "./status-badge";

export function LegalStatusBadge({ mevzuatDurumu }: { mevzuatDurumu: string }) {
  return (
    <StatusBadge durum={SOD_MEVZUAT_DURUMU_SEMANTIK[mevzuatDurumu] ?? "unknown"}>
      {SOD_MEVZUAT_DURUMU_LABEL[mevzuatDurumu] ?? mevzuatDurumu}
    </StatusBadge>
  );
}
