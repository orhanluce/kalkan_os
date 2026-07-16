import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { mockFindings } from "@/lib/mock-data";
import { FINDING_DURUM_LABEL, ONEM_BADGE_VARIANT, ONEM_LABEL } from "@/lib/ui-labels";

const KAYNAK_LABEL: Record<string, string> = {
  sizma_testi: "Sızma Testi",
  denetim: "Denetim",
  ic_tespit: "İç Tespit",
};

export default function FindingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Bulgular</h1>
        <p className="text-sm text-muted-foreground">
          Sızma testi, denetim ve iç tespit kaynaklı bulgu takibi.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{mockFindings.length} bulgu</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Başlık</TableHead>
                <TableHead>Kaynak</TableHead>
                <TableHead>Önem</TableHead>
                <TableHead>Hedef Kapama</TableHead>
                <TableHead>Durum</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockFindings.map((f) => (
                <TableRow key={f.id}>
                  <TableCell>{f.baslik}</TableCell>
                  <TableCell>{KAYNAK_LABEL[f.kaynak]}</TableCell>
                  <TableCell>
                    <Badge variant={ONEM_BADGE_VARIANT[f.onem]}>{ONEM_LABEL[f.onem]}</Badge>
                  </TableCell>
                  <TableCell>{f.hedefKapama ?? "—"}</TableCell>
                  <TableCell>{FINDING_DURUM_LABEL[f.durum]}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
