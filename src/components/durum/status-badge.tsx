// Semantik durum rozetleri (master talimat §5.3 + §8, ADR-T1).
//
// KURAL: renk TEK sinyal DEĞİLDİR — her rozet ikon + metin + renk taşır
// (erişilebilirlik, belge §11). `unknown` nötr griyle karışmasın diye ayrı
// renk (arduvaz-mavi) VE ayrı ikon (soru işareti) taşır; `legal-review`
// ölçülü indigo. Token değerleri globals.css'te (light+dark).
//
// Bu bileşen ANLAM katmanıdır: hangi iş durumunun hangi semantiğe düştüğüne
// ÇAĞIRAN karar verir (ör. M12 PASSED→success, UNKNOWN→unknown, STALE→warning,
// EXCEPTION→legal-review benzeri eşlemeler ekran taşımalarında — PR-2).
import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  HelpCircle,
  Info,
  Scale,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type SemantikDurum =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral"
  | "unknown"
  | "legal-review";

const GORUNUM: Record<SemantikDurum, { Ikon: LucideIcon; sinif: string }> = {
  success: { Ikon: CheckCircle2, sinif: "bg-success/10 text-success border-success/30" },
  warning: { Ikon: AlertTriangle, sinif: "bg-warning/10 text-warning border-warning/30" },
  danger: { Ikon: XCircle, sinif: "bg-danger/10 text-danger border-danger/30" },
  info: { Ikon: Info, sinif: "bg-info/10 text-info border-info/30" },
  neutral: { Ikon: CircleDashed, sinif: "bg-neutral-status/10 text-neutral-status border-neutral-status/30" },
  unknown: { Ikon: HelpCircle, sinif: "bg-unknown/10 text-unknown border-unknown/30" },
  "legal-review": { Ikon: Scale, sinif: "bg-legal-review/10 text-legal-review border-legal-review/30" },
};

export function StatusBadge({
  durum,
  children,
  className,
}: {
  durum: SemantikDurum;
  children: React.ReactNode;
  className?: string;
}) {
  const { Ikon, sinif } = GORUNUM[durum];
  return (
    <span
      className={cn(
        "inline-flex h-5 w-fit shrink-0 items-center gap-1 whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-medium",
        sinif,
        className,
      )}
    >
      <Ikon className="size-3 shrink-0" aria-hidden />
      {children}
    </span>
  );
}
