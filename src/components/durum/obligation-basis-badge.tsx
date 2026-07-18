// Yükümlülük dayanak rozeti (V2 §6.4, ADR-V2-2). Dört dayanak türü ikon+metin+
// renk ile — BEST_PRACTICE mevzuat gibi GÖSTERİLMEZ (nötr + ampul ikonu).
//
// Dayanak iş DURUMU değil KATEGORİdir: StatusBadge'in renk sınıfını (tek
// kaynak) kullanır ama KENDİ ikonunu taşır (Scale=yasal, FileText=sözleşme,
// Gavel=YK kararı, Lightbulb=iyi uygulama) — durum rozetleriyle karışmaz.
import { FileText, Gavel, Lightbulb, Scale, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { OBLIGATION_BASIS_LABEL, OBLIGATION_BASIS_SEMANTIK } from "@/lib/ui-labels";
import { ROZET_TEMEL, SEMANTIK_SINIF, type SemantikDurum } from "./status-badge";

const IKON: Record<string, LucideIcon> = {
  LEGAL_MANDATORY: Scale,
  CONTRACTUAL: FileText,
  BOARD_POLICY: Gavel,
  BEST_PRACTICE: Lightbulb,
};

export function ObligationBasisBadge({ basis }: { basis: string }) {
  const Ikon = IKON[basis] ?? Lightbulb;
  const semantik: SemantikDurum = OBLIGATION_BASIS_SEMANTIK[basis] ?? "neutral";
  return (
    <span className={cn(ROZET_TEMEL, SEMANTIK_SINIF[semantik])}>
      <Ikon className="size-3 shrink-0" aria-hidden />
      {OBLIGATION_BASIS_LABEL[basis] ?? basis}
    </span>
  );
}
