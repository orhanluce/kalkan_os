"use client";

import { StatusBadge } from "@/components/durum/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { calculateMaturityScore, topRiskyOpenControls } from "@/lib/maturity";
import { useLocalStore } from "@/lib/store";
import { DURUM_LABEL, DURUM_SEMANTIK } from "@/lib/ui-labels";
import type { Durum } from "@/lib/types";

const EMPTY_DAGILIM: Record<Durum, number> = {
  karsilaniyor: 0,
  kismi: 0,
  acik: 0,
  kapsam_disi: 0,
};

export default function DashboardPage() {
  const { tenantControls, findings, kutuphane, kurum, yukleniyor } = useLocalStore();
  const score = calculateMaturityScore(tenantControls, kutuphane.controls);
  const risky = topRiskyOpenControls(tenantControls, kutuphane.controls, 10);
  const openFindings = findings.filter((f) => f.durum === "acik").length;

  const dagilim = tenantControls.reduce<Record<Durum, number>>(
    (acc, tc) => {
      acc[tc.durum] += 1;
      return acc;
    },
    { ...EMPTY_DAGILIM },
  );

  const controlToFrameworkId = new Map(kutuphane.controls.map((c) => [c.id, c.frameworkId]));
  const dagilimByFramework = kutuphane.frameworks.map((framework) => {
    const counts = tenantControls.reduce<Record<Durum, number>>(
      (acc, tc) => {
        if (controlToFrameworkId.get(tc.controlId) === framework.id) acc[tc.durum] += 1;
        return acc;
      },
      { ...EMPTY_DAGILIM },
    );
    return { framework, counts };
  });

  // Yükleme sırasında sıfırlar göstermek, "hiç kontrolünüz yok" gibi okunur —
  // bir uyum panosunda bu, olmayan bir gerçeği iddia etmektir.
  if (yukleniyor) {
    return <p className="text-sm text-muted-foreground">Yükleniyor…</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{kurum.tenant?.name ?? "—"}</h1>
        <p className="text-sm text-muted-foreground">Uyum Panosu</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Olgunluk Skoru
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-4xl font-semibold tabular-nums">{score}</span>
            <span className="text-muted-foreground">/100</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Açık Bulgular
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-4xl font-semibold tabular-nums">{openFindings}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Toplam İzlenen Kontrol
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-4xl font-semibold tabular-nums">{tenantControls.length}</span>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Durum Dağılımı (tüm çerçeveler)</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {(Object.keys(dagilim) as Durum[]).map((durum) => (
            <StatusBadge key={durum} durum={DURUM_SEMANTIK[durum]}>
              {DURUM_LABEL[durum]}: {dagilim[durum]}
            </StatusBadge>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Çerçeve Bazında Dağılım</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {dagilimByFramework.map(({ framework, counts }) => (
            <div key={framework.id} className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">{framework.code}</span>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(counts) as Durum[]).map((durum) => (
                  <StatusBadge key={durum} durum={DURUM_SEMANTIK[durum]}>
                    {DURUM_LABEL[durum]}: {counts[durum]}
                  </StatusBadge>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>En Riskli Açık Kontroller</CardTitle>
        </CardHeader>
        <CardContent>
          {risky.length === 0 ? (
            <p className="text-sm text-muted-foreground">Açık veya kısmi kontrol yok.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {risky.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-4 text-sm">
                  <span>
                    <span className="text-muted-foreground">{r.control.maddeRef}</span>{" "}
                    {r.control.baslik}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      kritiklik {r.control.kritiklik}
                    </span>
                    <StatusBadge durum={DURUM_SEMANTIK[r.durum]}>{DURUM_LABEL[r.durum]}</StatusBadge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
