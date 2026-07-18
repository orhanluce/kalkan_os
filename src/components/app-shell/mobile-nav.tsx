"use client";

// Mobil alt navigasyon (master talimat §7.3): en fazla 5 ana hedef; kalan
// rotalar "Menü" sheet'inde. Dokunma hedefleri ≥44px. <md'de görünür.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { MOBIL_ANA_HEDEFLER, NAV_GRUPLARI, aktifMi } from "./nav-items";

export function MobileNav() {
  const pathname = usePathname();
  const [menuAcik, setMenuAcik] = useState(false);

  // Route değişince sheet kapanır (link tıklandı demektir). Effect değil,
  // render-sırasında türetilmiş state (React'ın önerdiği desen — effect'te
  // setState kademeli render tetikler).
  const [oncekiYol, setOncekiYol] = useState(pathname);
  if (pathname !== oncekiYol) {
    setOncekiYol(pathname);
    if (menuAcik) setMenuAcik(false);
  }

  // Sheet açıkken arka plan kaydırılmasın.
  useEffect(() => {
    document.body.style.overflow = menuAcik ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuAcik]);

  return (
    <>
      {menuAcik && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Tüm menü"
          className="fixed inset-0 z-40 flex flex-col bg-background pb-20 md:hidden"
        >
          <div className="flex h-14 items-center justify-between border-b px-4">
            <span className="text-sm font-semibold">Menü</span>
            <button
              type="button"
              onClick={() => setMenuAcik(false)}
              aria-label="Menüyü kapat"
              className="grid size-11 place-items-center text-muted-foreground"
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>
          <nav aria-label="Tüm sayfalar" className="flex-1 overflow-y-auto p-4">
            {NAV_GRUPLARI.map((grup) => (
              <div key={grup.baslik ?? "genel"} className="mb-4">
                {grup.baslik && (
                  <div className="pb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    {grup.baslik}
                  </div>
                )}
                <ul>
                  {grup.ogeler.map((oge) => (
                    <li key={oge.href}>
                      <Link
                        href={oge.href}
                        aria-current={aktifMi(pathname, oge.href) ? "page" : undefined}
                        className={`flex min-h-11 items-center gap-3 rounded-md px-2 text-sm ${
                          aktifMi(pathname, oge.href)
                            ? "bg-accent font-medium"
                            : "text-muted-foreground"
                        }`}
                      >
                        <oge.Ikon className="size-4" aria-hidden />
                        {oge.etiket}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>
      )}

      <nav
        aria-label="Alt navigasyon"
        className="fixed inset-x-0 bottom-0 z-50 flex border-t bg-background md:hidden"
      >
        {MOBIL_ANA_HEDEFLER.map((oge) => {
          const aktif = aktifMi(pathname, oge.href);
          return (
            <Link
              key={oge.href}
              href={oge.href}
              aria-current={aktif ? "page" : undefined}
              className={`flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 text-[11px] ${
                aktif ? "font-medium text-brand-accent" : "text-muted-foreground"
              }`}
            >
              <oge.Ikon className="size-5" aria-hidden />
              {oge.etiket}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMenuAcik((a) => !a)}
          aria-label="Tüm menüyü aç"
          aria-expanded={menuAcik}
          className={`flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 text-[11px] ${
            menuAcik ? "font-medium text-brand-accent" : "text-muted-foreground"
          }`}
        >
          <Menu className="size-5" aria-hidden />
          Menü
        </button>
      </nav>
    </>
  );
}
