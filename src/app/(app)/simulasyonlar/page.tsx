"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { createClient } from "@/lib/supabase/client";

// Senaryo kütüphanesi (M7). Yürütme ekranları (control room / katılımcı /
// gözlemci) M8'in kalan işidir — bu sayfa yalnızca şablonları gösterir.
//
// Kural 9: her tatbikat yüzeyi açıkça TATBİKAT etiketi taşır. Gerçek bir olay
// müdahalesiyle karışması, bir uyum ürününde felaket olurdu.

interface SenaryoSurumu {
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

export default function SimulasyonlarPage() {
  const [senaryolar, setSenaryolar] = useState<Senaryo[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);

  useEffect(() => {
    let iptal = false;

    const yukle = async () => {
      const db = createClient();
      const { data } = await db
        .from("scenario_templates")
        .select(
          "id, kod, ad, aciklama, tehdit_kategorisi, icerik_durumu, scenario_template_versions(surum, tahmini_dakika, hedef_roller, durum)",
        )
        .order("kod");

      if (iptal) return;
      setSenaryolar((data as unknown as Senaryo[]) ?? []);
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
          <Badge variant="outline" className="border-amber-500/50 text-amber-700 dark:text-amber-400">
            TATBİKAT
          </Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Bu senaryolar tatbikat içindir; gerçek bir sistemde hiçbir işlem başlatmaz.
        </p>
        <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
          Şablonlar doğrulanmamış örneklerdir (UNVERIFIED_SAMPLE) — kurumunuzun kendi olay müdahale
          planına göre gözden geçirilmeden oynanmamalıdır. Bkz. data/scenarios/*.yaml
        </p>
      </div>

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
              <Card key={s.id}>
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
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="rounded bg-muted px-2 py-0.5">v{yayinli.surum}</span>
                      <span>{yayinli.tahmini_dakika} dakika</span>
                      <span>·</span>
                      <span>{yayinli.hedef_roller.length} rol</span>
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

      <p className="text-xs text-muted-foreground">
        Tatbikat yürütme ekranları (yönetici, katılımcı, gözlemci) henüz yok — bkz. docs/ROADMAP.md M8.
      </p>
    </div>
  );
}
