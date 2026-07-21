"use client";

// Dikey G1: platform_operator konsolu — bilinçli olarak ana (app) kabuğunun
// (NavRail/ContextHeader, tenant-scoped AuthProvider varsayımı) DIŞINDA.
// platform_operator'ın profiles.tenant_id'si NULL'dur (bkz. ADR §3);
// AuthProvider (src/lib/auth.tsx) bu durumda BİLİNÇLİ olarak `null` döner —
// bu yüzden bu route grubu kendi rol kontrolünü doğrudan yapar.
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function PlatformLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const router = useRouter();
  const [durum, setDurum] = useState<"yukleniyor" | "yetkili" | "yetkisiz">("yukleniyor");

  useEffect(() => {
    const kontrolEt = async () => {
      const db = createClient();
      const {
        data: { user },
      } = await db.auth.getUser();
      if (!user) {
        router.replace("/giris");
        return;
      }
      const { data: profil } = await db.from("profiles").select("role").eq("id", user.id).maybeSingle();
      if (profil?.role !== "platform_operator") {
        setDurum("yetkisiz");
        return;
      }
      setDurum("yetkili");
    };
    void kontrolEt();
  }, [router]);

  if (durum === "yukleniyor") return null;
  if (durum === "yetkisiz") {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <p className="text-sm text-muted-foreground">Bu alan yalnız platform operatörünün işidir.</p>
      </main>
    );
  }

  return <main className="mx-auto max-w-4xl px-4 py-8 md:px-6">{children}</main>;
}
