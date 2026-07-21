import Link from "next/link";
import { Inbox, type LucideIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: { href: string; label: string };
  /** Bağlama uygun ikon (varsayılan: gelen kutusu). */
  icon?: LucideIcon;
}

// Boş durum bir hata değil, bir davettir: ne olmadığını söyler ve varsa
// sıradaki adımı gösterir. Kesikli çerçeve "henüz doldurulmamış alan"
// dilidir — dolu kartlarla karışmaz.
export function EmptyState({ title, description, action, icon: Icon = Inbox }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card/50 px-6 py-12 text-center">
      <span className="grid size-11 place-items-center rounded-xl bg-muted text-muted-foreground">
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">{title}</p>
        {description && <p className="mx-auto max-w-sm text-sm text-muted-foreground">{description}</p>}
      </div>
      {action && (
        <Link href={action.href} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-1")}>
          {action.label}
        </Link>
      )}
    </div>
  );
}
