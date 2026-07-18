"use client";

// Üst bağlam çubuğu (master talimat §7.1): kurum/tenant, kullanıcı, tema,
// çıkış. Global arama/komut paleti ve bildirim SONRAKİ tur (PR-2+) —
// çalışmayan ikon koymak yerine yer bırakıyoruz (ölü UI eklenmez).
import { Button } from "@/components/ui/button";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { useAuth } from "@/lib/auth";
import { useLocalStore } from "@/lib/store";
import { ROLE_LABEL } from "@/lib/ui-labels";

export function ContextHeader() {
  const { currentUser, logout } = useAuth();
  const { kurum } = useLocalStore();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur-sm md:px-6">
      {/* Mobilde rail görünmez — marka burada gösterilir. */}
      <span className="text-sm font-semibold tracking-tight md:hidden">KALKAN-OS</span>
      {kurum.tenant && (
        <span className="hidden truncate text-sm text-muted-foreground md:inline" title={kurum.tenant.name}>
          {kurum.tenant.name}
        </span>
      )}
      <div className="ml-auto flex items-center gap-2">
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
