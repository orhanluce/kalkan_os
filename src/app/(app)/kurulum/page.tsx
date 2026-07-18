"use client";

// Kurum kurulum / onboarding (docs/ROADMAP.md V2 PR-2, master §6.1):
// "KALKAN_OS'u hangi amaçla kuruyorsunuz?" — üç seçenek, ürün hattını belirler.
//
// SALT UI DEĞİL: seçim organization_profiles'a RLS altında yazılır (yalnız
// admin/uyum; denetçi-misafir yazamaz — DB'de de zorlanır). Değişiklik scope
// recalculation outbox olayı + audit üretir (kilitli değil, kontrollü).
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { financeVarsayilanAcik, ONBOARDING_SECENEKLERI, type OrganizationType } from "@/lib/organizasyon";
import { useLocalStore } from "@/lib/store";
import { createClient } from "@/lib/supabase/client";

export default function KurulumPage() {
  const router = useRouter();
  const { currentUser } = useAuth();
  const { kurum, yenidenYukle } = useLocalStore();
  const [secilen, setSecilen] = useState<OrganizationType | null>(null);
  const [suruyor, setSuruyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  const mevcut = kurum.organizasyon?.organizationType ?? null;
  const yetkili = currentUser?.role === "admin" || currentUser?.role === "uyum";

  async function kaydet() {
    if (!secilen || !currentUser) return;
    setSuruyor(true);
    setHata(null);
    const db = createClient();
    // Upsert: ilk kurulum insert, değişiklik update. Guard'lar (rol, scope
    // recalc, audit) DB'de. finance varsayılanı türe göre önerilir; kullanıcı
    // sonra CFO profil wizard'ında (PR-3) inceleyecek.
    const { error } = await db.from("organization_profiles").upsert(
      {
        tenant_id: currentUser.tenantId,
        organization_type: secilen,
        finance_department_enabled: financeVarsayilanAcik(secilen),
        profil_tamamlandi_at: new Date().toISOString(),
      },
      { onConflict: "tenant_id" },
    );
    if (error) {
      setHata(error.message);
      setSuruyor(false);
      return;
    }
    await yenidenYukle();
    router.push("/");
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          KALKAN_OS&apos;u hangi amaçla kuruyorsunuz?
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Bu seçim ürün hattını ve varsayılan ekranları belirler. Kilitli değildir — yetkili bir
          kullanıcı sonradan değiştirebilir; değişiklik kapsam yeniden hesaplaması ve denetim kaydı
          üretir.
        </p>
        {mevcut && (
          <p className="mt-2 text-sm">
            Mevcut seçim:{" "}
            <strong>{ONBOARDING_SECENEKLERI.find((s) => s.tur === mevcut)?.baslik ?? mevcut}</strong>
          </p>
        )}
      </div>

      {!yetkili && (
        <p role="alert" className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
          Kurum türünü yalnızca admin veya uyum rolü belirleyebilir.
        </p>
      )}
      {hata && (
        <p role="alert" className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {hata}
        </p>
      )}

      <div className="grid gap-4">
        {ONBOARDING_SECENEKLERI.map((s) => {
          const seciliMi = secilen === s.tur;
          return (
            <Card
              key={s.tur}
              className={`cursor-pointer transition-colors ${seciliMi ? "border-brand-accent ring-1 ring-brand-accent" : "hover:bg-accent"}`}
            >
              <button
                type="button"
                disabled={!yetkili}
                onClick={() => setSecilen(s.tur)}
                aria-pressed={seciliMi}
                className="w-full text-left disabled:cursor-not-allowed disabled:opacity-60"
              >
                <CardHeader>
                  <CardTitle className="text-base">{s.baslik}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{s.aciklama}</p>
                </CardContent>
              </button>
            </Card>
          );
        })}
      </div>

      <div className="flex gap-2">
        <Button onClick={kaydet} disabled={!secilen || suruyor || !yetkili}>
          {mevcut ? "Değiştir" : "Kur ve devam et"}
        </Button>
        {mevcut && (
          <Button variant="outline" onClick={() => router.push("/")}>
            Vazgeç
          </Button>
        )}
      </div>
    </div>
  );
}
