"use client";

// Tema değiştirici (master talimat §6, ADR-T2): light → dark → system döngüsü.
//
// İKİ KALICILIK KATMANI:
//   - cookie: oturumsuz sayfalar + ilk paint (inline script okur).
//   - profiles.tema_tercihi: oturum açıkken kullanıcıya kalıcı (cihazlar
//     arası). Yazma fire-and-forget: tema DOM'a ZATEN uygulandı, profil
//     yazımı başarısız olsa bile kullanıcı deneyimi bozulmaz (bir sonraki
//     girişte cookie hâlâ doğru temayı verir).
import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";
import { temaCookieOku, temaCookieYaz, temayiUygula, type TemaTercihi } from "@/lib/tema";
import { useIstemcideMi } from "@/lib/use-istemci";

const SIRA: TemaTercihi[] = ["light", "dark", "system"];

const GORUNUM: Record<TemaTercihi, { Ikon: typeof Sun; etiket: string }> = {
  light: { Ikon: Sun, etiket: "Açık tema" },
  dark: { Ikon: Moon, etiket: "Koyu tema" },
  system: { Ikon: Monitor, etiket: "Sistem teması" },
};

export function ThemeSwitcher() {
  const { currentUser } = useAuth();
  const istemcide = useIstemcideMi();
  // Cookie RENDER SIRASINDA türetilir (effect'te setState yok): SSR'da
  // "system", istemcide gerçek cookie değeri — tema kendisi zaten inline
  // script ile ilk paint'te doğru uygulanmış durumda (görsel flash yok).
  // Kullanıcı tıklayınca state devralır.
  const [secilen, setSecilen] = useState<TemaTercihi | null>(null);
  const tercih: TemaTercihi = secilen ?? (istemcide ? (temaCookieOku() ?? "system") : "system");

  // Sistem tercihi değişirse (OS ayarı) ve tercih "system" ise canlı uygula.
  useEffect(() => {
    if (tercih !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const dinleyici = () => temayiUygula("system");
    mq.addEventListener("change", dinleyici);
    return () => mq.removeEventListener("change", dinleyici);
  }, [tercih]);

  function degistir() {
    const yeni = SIRA[(SIRA.indexOf(tercih) + 1) % SIRA.length];
    setSecilen(yeni);
    temayiUygula(yeni);
    temaCookieYaz(yeni);
    if (currentUser) {
      // RLS: profiles_update_self yalnız kendi satırına izin verir.
      // DİKKAT: supabase-js builder'ı LAZY — istek ancak then/await ile
      // tetiklenir; `void builder` hiçbir şey GÖNDERMEZ (ilk sürümde tam bu
      // hata vardı, tema e2e'si yakaladı). Fire-and-forget bilinçli: tema
      // DOM'a zaten uygulandı, profil yazımı arka planda tamamlanır.
      createClient()
        .from("profiles")
        .update({ tema_tercihi: yeni })
        .eq("id", currentUser.id)
        .then(undefined, () => {});
    }
  }

  const { Ikon, etiket } = GORUNUM[tercih];
  return (
    <Button variant="ghost" size="icon" onClick={degistir} aria-label={etiket} title={etiket}>
      <Ikon className="size-4" aria-hidden />
    </Button>
  );
}
