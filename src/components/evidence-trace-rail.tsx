"use client";

// Kanıt izi rayı (master talimat §4.3) — KALKAN_OS'un görsel imzası.
//
// Hüküm → Yükümlülük → Kontrol → Test → Kanıt zinciri, soldan sağa ince bir
// ray üzerinde. Her düğüm durum taşır (ikon + etiket + renk — renk tek sinyal
// değil) ve tıklanabilirse çağıranın verdiği onClick'i çağırır (drawer/panel
// açma kararı ÇAĞIRANIN — bu bileşen veri çekmez, navigasyon yapmaz).
//
// PR-1'DE İSKELET: veri bağlanmadı. Hüküm/Yükümlülük düğümleri M20/M21
// gelmeden "eksik" (unknown) durumuyla dürüstçe gösterilir — regülasyon
// zinciri kurulmadan "bağlı" GÖSTERİLMEZ (kural 3'ün ruhu: köken uydurulmaz).
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  HelpCircle,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SemantikDurum } from "@/components/durum/status-badge";

export interface TraceDugumu {
  /** Sabit beş aşamadan biri — sıra bileşende, içerik çağıranda. */
  ad: "Hüküm" | "Yükümlülük" | "Kontrol" | "Test" | "Kanıt";
  durum: SemantikDurum;
  /** Kısa durum metni (ör. "Geçti", "Bekliyor", "Bağlı değil"). */
  etiket: string;
  onClick?: () => void;
}

const IKONLAR: Partial<Record<SemantikDurum, LucideIcon>> = {
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
  unknown: HelpCircle,
};

const RENKLER: Record<SemantikDurum, string> = {
  success: "text-success border-success/40",
  warning: "text-warning border-warning/40",
  danger: "text-danger border-danger/40",
  info: "text-info border-info/40",
  neutral: "text-neutral-status border-neutral-status/40",
  unknown: "text-unknown border-unknown/40",
  "legal-review": "text-legal-review border-legal-review/40",
};

export function EvidenceTraceRail({ dugumler, className }: { dugumler: TraceDugumu[]; className?: string }) {
  return (
    <ol
      aria-label="Kanıt izi: hükümden kanıta zincir"
      className={cn(
        "flex items-stretch gap-1 overflow-x-auto rounded-lg border bg-card px-3 py-2",
        className,
      )}
    >
      {dugumler.map((dugum, i) => {
        const Ikon = IKONLAR[dugum.durum] ?? CircleDashed;
        const icerik = (
          <>
            <Ikon className="size-3.5 shrink-0" aria-hidden />
            <span className="flex flex-col items-start leading-tight">
              <span className="text-xs font-medium text-foreground">{dugum.ad}</span>
              <span className="text-[11px]">{dugum.etiket}</span>
            </span>
          </>
        );
        return (
          <li key={dugum.ad} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="size-3 shrink-0 text-border" aria-hidden />}
            {dugum.onClick ? (
              <button
                type="button"
                onClick={dugum.onClick}
                className={cn(
                  "flex min-h-11 items-center gap-1.5 rounded-md border bg-background px-2.5 py-1 transition-colors hover:bg-accent",
                  RENKLER[dugum.durum],
                )}
              >
                {icerik}
              </button>
            ) : (
              <span
                className={cn(
                  "flex min-h-11 items-center gap-1.5 rounded-md border border-dashed bg-background px-2.5 py-1",
                  RENKLER[dugum.durum],
                )}
              >
                {icerik}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
