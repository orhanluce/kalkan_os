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
import {
  financeVarsayilanAcik,
  ONBOARDING_SECENEKLERI,
  type OrganizationType,
} from "@/lib/organizasyon";
import { useLocalStore } from "@/lib/store";
import { createClient } from "@/lib/supabase/client";
import { EkranYardimPaneli } from "@/components/yardim/ekran-yardim-paneli";
import {
  REGULATED_ENTITY_LABEL,
  REGULATED_ENTITY_TYPES,
  regulatedEntitySelectionRequired,
  regulatorTypesForEntities,
  type RegulatedEntityType,
} from "@/lib/regulatory-scope";

export default function KurulumPage() {
  const router = useRouter();
  const { currentUser } = useAuth();
  const { kurum, yenidenYukle } = useLocalStore();
  const [secilen, setSecilen] = useState<OrganizationType | null>(null);
  const [kurulusTurleri, setKurulusTurleri] = useState<RegulatedEntityType[]>([]);
  const [suruyor, setSuruyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  const mevcut = kurum.organizasyon?.organizationType ?? null;
  const yetkili = currentUser?.role === "admin" || currentUser?.role === "uyum";

  async function kaydet() {
    if (!secilen || !currentUser) return;
    if (regulatedEntitySelectionRequired(secilen) && kurulusTurleri.length === 0) return;
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
        regulated_entity_types: regulatedEntitySelectionRequired(secilen) ? kurulusTurleri : [],
        regulated_status:
          secilen === "REGULATED_FINANCIAL_INSTITUTION"
            ? "REGULATED"
            : secilen === "MIXED_GROUP"
              ? "PARTIALLY_REGULATED"
              : "NOT_REGULATED",
        regulator_types: regulatedEntitySelectionRequired(secilen)
          ? regulatorTypesForEntities(kurulusTurleri)
          : [],
        jurisdictions: ["TR"],
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
    // Aktivasyon (ADR-V2-5): TTV başlangıcı. PII yok — yalnız tür + org tipi.
    await db
      .from("activation_events")
      .insert({
        tenant_id: currentUser.tenantId,
        event_type: "PROFILE_COMPLETED",
        meta: { organization_type: secilen },
      });
    await yenidenYukle();
    router.push("/");
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          KALKAN_OS&apos;u hangi amaçla kuruyorsunuz?
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Bu seçim ürün hattını ve varsayılan ekranları belirler. Kilitli değildir — yetkili bir
          kullanıcı sonradan değiştirebilir; değişiklik kapsam yeniden hesaplaması ve denetim kaydı
          üretir.
        </p>
        {mevcut && (
          <p className="mt-2 text-sm">
            Mevcut seçim:{" "}
            <strong>
              {ONBOARDING_SECENEKLERI.find((s) => s.tur === mevcut)?.baslik ?? mevcut}
            </strong>
          </p>
        )}
      </div>

      <EkranYardimPaneli modulId="kurum-profili" />

      {!yetkili && (
        <p
          role="alert"
          className="border-warning/40 bg-warning/10 text-warning rounded-md border px-3 py-2 text-sm"
        >
          Kurum türünü yalnızca admin veya uyum rolü belirleyebilir.
        </p>
      )}
      {hata && (
        <p
          role="alert"
          className="border-danger/40 bg-danger/10 text-danger rounded-md border px-3 py-2 text-sm"
        >
          {hata}
        </p>
      )}

      <div className="grid gap-4">
        {ONBOARDING_SECENEKLERI.map((s) => {
          const seciliMi = secilen === s.tur;
          return (
            <Card
              key={s.tur}
              className={`cursor-pointer transition-colors ${seciliMi ? "border-brand-accent ring-brand-accent ring-1" : "hover:bg-accent"}`}
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
                  <p className="text-muted-foreground text-sm">{s.aciklama}</p>
                </CardContent>
              </button>
            </Card>
          );
        })}
      </div>

      {secilen && regulatedEntitySelectionRequired(secilen) ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Düzenlemeye tabi kuruluş türü</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-3 text-sm">
              Bir veya birden fazla kesin tür seçin. Sistem mevzuat izleme kapsamını bu seçimden
              üretir; doğrulanmamış eşleşmeler hukuk kararı sayılmaz ve inceleme kuyruğunda kalır.
            </p>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Kuruluş türleri">
              {REGULATED_ENTITY_TYPES.map((tur) => {
                const seciliMi = kurulusTurleri.includes(tur);
                return (
                  <Button
                    key={tur}
                    type="button"
                    size="sm"
                    variant={seciliMi ? "default" : "outline"}
                    aria-pressed={seciliMi}
                    onClick={() =>
                      setKurulusTurleri((onceki) =>
                        seciliMi ? onceki.filter((x) => x !== tur) : [...onceki, tur],
                      )
                    }
                  >
                    {REGULATED_ENTITY_LABEL[tur]}
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex gap-2">
        <Button
          onClick={kaydet}
          disabled={
            !secilen ||
            suruyor ||
            !yetkili ||
            (regulatedEntitySelectionRequired(secilen) && kurulusTurleri.length === 0)
          }
        >
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
