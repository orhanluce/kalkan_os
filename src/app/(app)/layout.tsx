"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ContextHeader } from "@/components/app-shell/context-header";
import { MobileNav } from "@/components/app-shell/mobile-nav";
import { NavRail } from "@/components/app-shell/nav-rail";
import { useAuth } from "@/lib/auth";

// Uygulama kabuğu (master talimat §7, PR-1): sol rail (md+) + üst bağlam
// çubuğu + mobil alt nav. Route DAVRANIŞI değişmedi — yalnız kabuk.
export default function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { currentUser, yukleniyor } = useAuth();
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
    <div className="flex min-h-screen">
      <NavRail />
      <div className="flex min-w-0 flex-1 flex-col">
        <ContextHeader />
        {/* pb-20: mobil alt nav içeriğin üstüne binmesin (md+'da sıfırlanır). */}
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 pb-20 md:px-6 md:py-8 md:pb-8">
          {children}
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
