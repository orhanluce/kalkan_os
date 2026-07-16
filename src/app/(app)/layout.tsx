"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/ui-labels";

const NAV_ITEMS = [
  { href: "/", label: "Pano" },
  { href: "/controls", label: "Kontrol Kütüphanesi" },
  { href: "/findings", label: "Bulgular" },
  { href: "/simulasyonlar", label: "Simülasyonlar" },
  { href: "/paylasim", label: "Paylaşım" },
  { href: "/denetim-izi", label: "Denetim İzi" },
];

export default function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { currentUser, yukleniyor, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // `yukleniyor` kontrolü şart: oturum Supabase'den asenkron gelir ve ilk
    // render'da currentUser her zaman null'dur. Bunu beklemeden yönlendirmek,
    // giriş yapmış kullanıcıyı her sayfa yüklemesinde /giris'e atardı.
    if (!yukleniyor && !currentUser) router.replace("/giris");
  }, [currentUser, yukleniyor, router]);

  // Yönlendirme gerçekleşene kadar korunan içeriği göstermeyelim — bu
  // gerçek bir erişim kontrolü değil, yalnızca UX (bkz. src/lib/auth.tsx).
  if (yukleniyor || !currentUser) return null;

  return (
    <>
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-4">
          <span className="text-lg font-semibold tracking-tight">KALKAN-OS</span>
          <nav className="flex gap-4 text-sm text-muted-foreground">
            {NAV_ITEMS.map((item) => (
              <Link key={item.href} href={item.href} className="hover:text-foreground">
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            {/* Kimlik doğrulama artık gerçek Supabase Auth; veri katmanı
                henüz localStorage'da. Rozet, geçiş bitene kadar bu ayrımı
                söylüyor — "canlı" demek, veriyi de canlı sanmaya yol açardı. */}
            <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-xs font-medium text-amber-700 dark:text-amber-400">
              Veriler yerel — Supabase geçişi sürüyor
            </span>
            <span className="text-sm text-muted-foreground">
              {currentUser.fullName} · {ROLE_LABEL[currentUser.role]}
            </span>
            <Button variant="outline" size="sm" onClick={logout}>
              Çıkış
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</main>
    </>
  );
}
