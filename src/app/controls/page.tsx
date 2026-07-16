"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { mockControls, mockFrameworks } from "@/lib/mock-data";
import { useLocalStore } from "@/lib/store";
import { DURUM_BADGE_VARIANT, DURUM_LABEL } from "@/lib/ui-labels";

const TUMU = "tumu";

export default function ControlsPage() {
  const { tenantControls } = useLocalStore();
  const [frameworkId, setFrameworkId] = useState<string>(TUMU);

  const durumByControlId = new Map(tenantControls.map((tc) => [tc.controlId, tc.durum]));
  const frameworkById = new Map(mockFrameworks.map((f) => [f.id, f]));
  const controls =
    frameworkId === TUMU ? mockControls : mockControls.filter((c) => c.frameworkId === frameworkId);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Kontrol Kütüphanesi</h1>
        <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
          Bu kütüphane doğrulanmamış iskelet veridir (TODO-DOGRULA), bkz. data/controls/*.yaml
        </p>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Çerçeve:</span>
        <Select value={frameworkId} onValueChange={(v) => setFrameworkId(v ?? TUMU)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TUMU}>Tümü</SelectItem>
            {mockFrameworks.map((f) => (
              <SelectItem key={f.id} value={f.id}>
                {f.code}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{controls.length} kontrol</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Çerçeve</TableHead>
                <TableHead>Madde</TableHead>
                <TableHead>Başlık</TableHead>
                <TableHead>Periyot</TableHead>
                <TableHead>Kritiklik</TableHead>
                <TableHead>Durum</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {controls.map((c) => {
                const durum = durumByControlId.get(c.id) ?? "acik";
                return (
                  <TableRow key={c.id}>
                    <TableCell className="text-xs text-muted-foreground">
                      {frameworkById.get(c.frameworkId)?.code}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      <Link href={`/controls/${c.id}`} className="hover:underline">
                        {c.maddeRef}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/controls/${c.id}`} className="hover:underline">
                        {c.baslik}
                      </Link>
                    </TableCell>
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
