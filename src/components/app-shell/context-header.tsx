"use client";

// Üst bağlam çubuğu (master talimat §7.1): kurum/tenant, kullanıcı, tema,
// çıkış. Global arama/komut paleti ve bildirim SONRAKİ tur (PR-2+) —
// çalışmayan ikon koymak yerine yer bırakıyoruz (ölü UI eklenmez).
import Link from "next/link";
import { CircleHelp } from "lucide-react";
import { WardproofMark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { useAuth } from "@/lib/auth";
import { ORGANIZATION_TYPE_LABEL, type OrganizationType } from "@/lib/organizasyon";
import { useLocalStore } from "@/lib/store";
import { ROLE_LABEL } from "@/lib/ui-labels";

export function ContextHeader() {
  const { currentUser, logout } = useAuth();
  const { kurum } = useLocalStore();
  const orgType = kurum.organizasyon?.organizationType as OrganizationType | undefined;

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur-sm md:px-6">
      {/* Mobilde rail görünmez — marka burada gösterilir. */}
      <span className="flex items-center gap-2 md:hidden">
        <WardproofMark className="size-7" glyphClassName="size-4.5" />
        <span className="font-heading text-sm font-semibold tracking-tight">WardProof</span>
      </span>
      {kurum.tenant && (
        <span className="hidden truncate text-sm text-muted-foreground md:inline" title={kurum.tenant.name}>
          {kurum.tenant.name}
        </span>
      )}
      {orgType && (
        <Link
          href="/kurulum"
          className="hidden rounded-md border px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground lg:inline"
          title="Kurum türü — değiştirmek için tıklayın"
        >
          {ORGANIZATION_TYPE_LABEL[orgType] ?? orgType}
        </Link>
      )}
      <div className="ml-auto flex items-center gap-2">
        <Link
          href="/yardim"
          title="Kullanıcı Kılavuzu"
          aria-label="Kullanıcı Kılavuzu"
          className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        >
          <CircleHelp className="size-4" aria-hidden />
        </Link>
        <ThemeSwitcher />
        {currentUser && (
          <>
            <span className="hidden max-w-[220px] truncate text-sm text-muted-foreground sm:inline">
              {currentUser.fullName} · {ROLE_LABEL[currentUser.role]}
            </span>
            <Button variant="outline" size="sm" onClick={logout}>
              Çıkış
            </Button>
          </>
        )}
      </div>
    </header>
  );
}
