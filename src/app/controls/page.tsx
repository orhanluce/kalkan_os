import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { mockControls, mockFramework, mockTenantControls } from "@/lib/mock-data";
import { DURUM_BADGE_VARIANT, DURUM_LABEL } from "@/lib/ui-labels";

export default function ControlsPage() {
  const durumByControlId = new Map(mockTenantControls.map((tc) => [tc.controlId, tc.durum]));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Kontrol Kütüphanesi</h1>
        <p className="text-sm text-muted-foreground">
          Çerçeve: {mockFramework.code} — {mockFramework.name}
        </p>
        <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
          Bu kütüphane doğrulanmamış iskelet veridir (TODO-DOGRULA), bkz. data/controls/vii-128-10.yaml
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{mockControls.length} kontrol</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Madde</TableHead>
                <TableHead>Başlık</TableHead>
                <TableHead>Periyot</TableHead>
                <TableHead>Kritiklik</TableHead>
                <TableHead>Durum</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockControls.map((c) => {
                const durum = durumByControlId.get(c.id) ?? "acik";
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {c.maddeRef}
                    </TableCell>
                    <TableCell>{c.baslik}</TableCell>
                    <TableCell className="capitalize">{c.periyot.replace("_", " ")}</TableCell>
                    <TableCell>{c.kritiklik}</TableCell>
                    <TableCell>
                      <Badge variant={DURUM_BADGE_VARIANT[durum]}>{DURUM_LABEL[durum]}</Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
