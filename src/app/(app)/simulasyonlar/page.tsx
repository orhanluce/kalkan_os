"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { useAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";
import { StatusBadge } from "@/components/durum/status-badge";
import { SIMULASYON_DURUM_LABEL, SIMULASYON_DURUM_SEMANTIK } from "@/lib/ui-labels";

// Senaryo kütüphanesi (M7). Yürütme ekranları (control room / katılımcı /
// gözlemci) M8'in kalan işidir — bu sayfa yalnızca şablonları gösterir.
//
// Kural 9: her tatbikat yüzeyi açıkça TATBİKAT etiketi taşır. Gerçek bir olay
// müdahalesiyle karışması, bir uyum ürününde felaket olurdu.

interface SenaryoSurumu {
  id: string;
  surum: number;
  tahmini_dakika: number;
  hedef_roller: string[];
  durum: string;
}

interface Senaryo {
  id: string;
  kod: string;
  ad: string;
  aciklama: string | null;
  tehdit_kategorisi: string;
  icerik_durumu: string;
  scenario_template_versions: SenaryoSurumu[];
}

const KATEGORI_LABEL: Record<string, string> = {
  fidye_yazilimi: "Fidye yazılımı",
  hesap_ele_gecirme: "Hesap ele geçirme",
  veri_sizintisi: "Veri sızıntısı",
  is_surekliligi: "İş sürekliliği",
  tedarikci_riski: "Tedarikçi riski",
};

interface TatbikatOzeti {
  id: string;
  ad: string;
  durum: string;
  created_at: string;
}

export default function SimulasyonlarPage() {
  const router = useRouter();
  const { currentUser } = useAuth();
  const [senaryolar, setSenaryolar] = useState<Senaryo[]>([]);
  const [tatbikatlar, setTatbikatlar] = useState<TatbikatOzeti[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [baslatiliyor, setBaslatiliyor] = useState<string | null>(null);

  async function tatbikatBaslat(versionId: string, senaryoAdi: string) {
    if (!currentUser) return;
    setBaslatiliyor(versionId);
    const db = createClient();

    const { data: run, error } = await db
      .from("simulation_runs")
      .insert({
        tenant_id: currentUser.tenantId,
        version_id: versionId,
        ad: `${senaryoAdi} — ${new Date().toLocaleDateString("tr-TR")}`,
        mod: "canli",
      })
      .select("id")
      .single();

    if (error || !run) {
      setBaslatiliyor(null);
      alert(`Tatbikat oluşturulamadı: ${error?.message ?? "bilinmeyen hata"}`);
      return;
    }

    // Oluşturan kişi otomatik tatbikat yöneticisi olur (demo-simulation.ts
    // ile aynı desen). Ek katılımcı/gözlemci eklemek run ekranından yapılır.
    await db.from("simulation_participants").insert({
      run_id: run.id,
      tenant_id: currentUser.tenantId,
      user_id: currentUser.id,
      senaryo_rolu: "yonetici",
      katilim_tipi: "yonetici",
    });

    router.push(`/simulasyonlar/${run.id}`);
  }

  useEffect(() => {
    let iptal = false;

    const yukle = async () => {
      const db = createClient();
      const [{ data: senaryoData }, { data: tatbikatData }] = await Promise.all([
        db
          .from("scenario_templates")
          .select(
            "id, kod, ad, aciklama, tehdit_kategorisi, icerik_durumu, scenario_template_versions(id, surum, tahmini_dakika, hedef_roller, durum)",
          )
          .order("kod"),
        db
          .from("simulation_runs")
          .select("id, ad, durum, created_at")
          .order("created_at", { ascending: false }),
      ]);

      if (iptal) return;
      setSenaryolar((senaryoData as unknown as Senaryo[]) ?? []);
      setTatbikatlar(tatbikatData ?? []);
      setYukleniyor(false);
    };

    void yukle();
    return () => {
      iptal = true;
    };
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Simülasyon Senaryoları</h1>
          {/* Kural 9: tatbikat yüzeyleri açıkça etiketlenir. */}
          <Badge variant="outline" className="border-warning/50 text-warning">
            TATBİKAT
          </Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Bu senaryolar tatbikat içindir; gerçek bir sistemde hiçbir işlem başlatmaz.
        </p>
        <p className="mt-1 text-xs text-warning">
          Şablonlar doğrulanmamış örneklerdir (UNVERIFIED_SAMPLE) — kurumunuzun kendi olay müdahale
          planına göre gözden geçirilmeden oynanmamalıdır. Bkz. data/scenarios/*.yaml
        </p>
      </div>

      {!yukleniyor && tatbikatlar.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tatbikatlarım</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {tatbikatlar.map((t) => (
              <Link
                key={t.id}
                href={`/simulasyonlar/${t.id}`}
                className="flex items-center justify-between rounded-md border px-3 py-2 text-sm hover:bg-muted"
              >
                <span>{t.ad}</span>
                <StatusBadge durum={SIMULASYON_DURUM_SEMANTIK[t.durum] ?? "unknown"}>
                  {SIMULASYON_DURUM_LABEL[t.durum] ?? t.durum}
                </StatusBadge>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {yukleniyor ? (
        <p className="text-sm text-muted-foreground">Yükleniyor…</p>
      ) : senaryolar.length === 0 ? (
        <EmptyState
          title="Senaryo kütüphanesi boş"
          description="Senaryolar YAML'dan seed edilir: pnpm seed:scenarios"
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {senaryolar.map((s) => {
            const yayinli = s.scenario_template_versions
              .filter((v) => v.durum === "yayinlandi")
              .sort((a, b) => b.surum - a.surum)[0];

            return (
              <Card key={s.id} data-testid={`senaryo-${s.kod}`}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">
                      <span className="text-muted-foreground">{s.kod}</span> {s.ad}
                    </CardTitle>
                    <Badge variant="outline">
                      {KATEGORI_LABEL[s.tehdit_kategorisi] ?? s.tehdit_kategorisi}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <p className="text-sm text-muted-foreground">{s.aciklama}</p>

                  {yayinli ? (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="rounded bg-muted px-2 py-0.5">v{yayinli.surum}</span>
                        <span>{yayinli.tahmini_dakika} dakika</span>
                        <span>·</span>
                        <span>{yayinli.hedef_roller.length} rol</span>
                      </div>
                      <Button
                        size="sm"
                        disabled={baslatiliyor !== null}
                        onClick={() => tatbikatBaslat(yayinli.id, s.ad)}
                      >
                        {baslatiliyor === yayinli.id ? "Başlatılıyor…" : "Yeni Tatbikat Başlat"}
                      </Button>
                    </div>
                  ) : (
                    // Yayınlanmamış şablon oynanamaz: run yalnızca yayınlanmış
                    // (dondurulmuş) bir sürüme bağlanabilir.
                    <span className="text-xs text-muted-foreground">Yayınlanmış sürüm yok</span>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

    </div>
  );
}
