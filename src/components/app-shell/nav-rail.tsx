"use client";

// Sol navigasyon rayı (master talimat §7.1-7.2, ADR-T1 tokenları).
//
// Kırılımlar: <md görünmez (mobil alt nav devralır, mobile-nav.tsx);
// md–xl arası HEP daraltılmış (72px, ikon modu — belge §7.2 tablet);
// xl+ kullanıcı 272px ↔ 72px arasında daraltabilir (tercih localStorage'da).
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useState } from "react";
import { WardproofMark } from "@/components/brand";
import { useLocalStore } from "@/lib/store";
import { useIstemcideMi } from "@/lib/use-istemci";
import { navGruplari, aktifMi } from "./nav-items";

const DARALTMA_ANAHTARI = "kalkan-rail-dar";

export function NavRail() {
  const pathname = usePathname();
  const { kurum } = useLocalStore();
  const NAV_GRUPLARI = navGruplari(kurum.organizasyon?.organizationType);
  const istemcide = useIstemcideMi();
  // localStorage RENDER SIRASINDA türetilir (bkz. use-istemci.ts): SSR'da
  // açık, istemcide kayıtlı tercih; kullanıcı tıklayınca state devralır.
  const [secilenDar, setSecilenDar] = useState<boolean | null>(null);
  const dar = secilenDar ?? (istemcide && localStorage.getItem(DARALTMA_ANAHTARI) === "1");

  function daraltmayiDegistir() {
    const yeni = !dar;
    setSecilenDar(yeni);
    localStorage.setItem(DARALTMA_ANAHTARI, yeni ? "1" : "0");
  }

  return (
    <aside
      className={`sticky top-0 hidden h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex ${
        dar ? "xl:w-[72px]" : "xl:w-[272px]"
      } w-[72px]`}
    >
      <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
        {/* Wardproof W işareti (src/components/brand.tsx) — stok kalkan ikonu
            bilinçli YOK (belge §4.2), glyph iki vuruşlu iz/mühür çizgisidir. */}
        <WardproofMark />
        <span className={`font-heading text-sm font-semibold tracking-tight ${dar ? "xl:hidden" : "hidden xl:inline"}`}>
          Wardproof
        </span>
      </div>

      <nav aria-label="Ana navigasyon" className="flex-1 overflow-y-auto py-3">
        {NAV_GRUPLARI.map((grup) => (
          <div key={grup.baslik ?? "genel"} className="mb-2 px-2">
            {grup.baslik && (
              <div
                className={`px-2 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground ${
                  dar ? "xl:hidden" : "hidden xl:block"
                }`}
              >
                {grup.baslik}
              </div>
            )}
            <ul>
              {grup.ogeler.map((oge) => {
                const aktif = aktifMi(pathname, oge.href);
                return (
                  <li key={oge.href}>
                    <Link
                      href={oge.href}
                      aria-current={aktif ? "page" : undefined}
                      title={oge.etiket}
                      className={`flex items-center gap-3 rounded-md px-2.5 py-2 text-sm transition-colors ${
                        aktif
                          ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                          : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      }`}
                    >
                      {/* Aktif öğede sol turkuaz çizgi: renk tek sinyal değil
                          (aria-current + font ağırlığı da işaretler). */}
                      <span
                        aria-hidden
                        className={`h-5 w-0.5 shrink-0 rounded-full ${aktif ? "bg-brand-accent" : "bg-transparent"}`}
                      />
                      <oge.Ikon className="size-4 shrink-0" aria-hidden />
                      <span className={dar ? "xl:hidden" : "hidden xl:inline"}>{oge.etiket}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <button
        type="button"
        onClick={daraltmayiDegistir}
        aria-label={dar ? "Menüyü genişlet" : "Menüyü daralt"}
        className="hidden h-11 items-center justify-center border-t border-sidebar-border text-muted-foreground hover:text-foreground xl:flex"
      >
        {dar ? <PanelLeftOpen className="size-4" aria-hidden /> : <PanelLeftClose className="size-4" aria-hidden />}
      </button>
    </aside>
  );
}
