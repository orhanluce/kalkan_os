import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { calculateMaturityScore, topRiskyOpenControls } from "@/lib/maturity";
import { mockControls, mockFindings, mockTenant, mockTenantControls } from "@/lib/mock-data";
import { DURUM_BADGE_VARIANT, DURUM_LABEL } from "@/lib/ui-labels";
import type { Durum } from "@/lib/types";

export default function DashboardPage() {
  const score = calculateMaturityScore(mockTenantControls, mockControls);
  const risky = topRiskyOpenControls(mockTenantControls, mockControls, 10);
  const openFindings = mockFindings.filter((f) => f.durum === "acik").length;

  const dagilim = mockTenantControls.reduce<Record<Durum, number>>(
    (acc, tc) => {
      acc[tc.durum] += 1;
      return acc;
    },
    { karsilaniyor: 0, kismi: 0, acik: 0, kapsam_disi: 0 },
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{mockTenant.name}</h1>
        <p className="text-sm text-muted-foreground">Uyum Panosu · mock veri üzerinden</p>
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
            <span className="text-4xl font-semibold tabular-nums">{mockTenantControls.length}</span>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Durum Dağılımı</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {(Object.keys(dagilim) as Durum[]).map((durum) => (
            <Badge key={durum} variant={DURUM_BADGE_VARIANT[durum]}>
              {DURUM_LABEL[durum]}: {dagilim[durum]}
            </Badge>
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
                    <Badge variant={DURUM_BADGE_VARIANT[r.durum]}>{DURUM_LABEL[r.durum]}</Badge>
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
