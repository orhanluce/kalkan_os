"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { mockTenant } from "@/lib/mock-data";
import { useLocalStore } from "@/lib/store";
import type { Finding, Onem } from "@/lib/types";
import {
  FINDING_DURUM_LABEL,
  KAYNAK_LABEL,
  ONEM_BADGE_VARIANT,
  ONEM_LABEL,
} from "@/lib/ui-labels";

const KAYNAK_OPTIONS = Object.keys(KAYNAK_LABEL) as Finding["kaynak"][];
const ONEM_OPTIONS = Object.keys(ONEM_LABEL) as Onem[];

export default function FindingsPage() {
  const { findings, addFinding, toggleFindingDurum } = useLocalStore();

  const [baslik, setBaslik] = useState("");
  const [kaynak, setKaynak] = useState<Finding["kaynak"]>("ic_tespit");
  const [onem, setOnem] = useState<Onem>("orta");
  const [hedefKapama, setHedefKapama] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!baslik.trim()) return;
    addFinding({
      id: crypto.randomUUID(),
      tenantId: mockTenant.id,
      kaynak,
      onem,
      baslik: baslik.trim(),
      aksiyonPlani: null,
      ykOnayTarihi: null,
      hedefKapama: hedefKapama || null,
      durum: "acik",
    });
    setBaslik("");
    setHedefKapama("");
  }

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
          <CardTitle>Yeni Bulgu</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
            <div className="flex flex-1 min-w-48 flex-col gap-1.5">
              <Label htmlFor="baslik">Başlık</Label>
              <Input
                id="baslik"
                value={baslik}
                onChange={(e) => setBaslik(e.target.value)}
                placeholder="Bulgu başlığı"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="kaynak">Kaynak</Label>
              <Select
                items={KAYNAK_LABEL}
                value={kaynak}
                onValueChange={(v) => setKaynak(v as Finding["kaynak"])}
              >
                <SelectTrigger id="kaynak">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KAYNAK_OPTIONS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {KAYNAK_LABEL[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="onem">Önem</Label>
              <Select items={ONEM_LABEL} value={onem} onValueChange={(v) => setOnem(v as Onem)}>
                <SelectTrigger id="onem">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ONEM_OPTIONS.map((o) => (
                    <SelectItem key={o} value={o}>
                      {ONEM_LABEL[o]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="hedef">Hedef kapama</Label>
              <Input
                id="hedef"
                type="date"
                value={hedefKapama}
                onChange={(e) => setHedefKapama(e.target.value)}
              />
            </div>
            <Button type="submit">Ekle</Button>
          </form>
        </CardContent>
      </Card>

      {findings.length === 0 ? (
        <EmptyState
          title="Henüz bulgu yok"
          description="Yukarıdaki formla sızma testi, denetim veya iç tespit kaynaklı ilk bulguyu ekleyin."
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{findings.length} bulgu</CardTitle>
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
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {findings.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell>
                      <Link href={`/findings/${f.id}`} className="hover:underline">
                        {f.baslik}
                      </Link>
                    </TableCell>
                    <TableCell>{KAYNAK_LABEL[f.kaynak]}</TableCell>
                    <TableCell>
                      <Badge variant={ONEM_BADGE_VARIANT[f.onem]}>{ONEM_LABEL[f.onem]}</Badge>
                    </TableCell>
                    <TableCell>{f.hedefKapama ?? "—"}</TableCell>
                    <TableCell>{FINDING_DURUM_LABEL[f.durum]}</TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" onClick={() => toggleFindingDurum(f.id)}>
                        {f.durum === "acik" ? "Kapat" : "Yeniden Aç"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
