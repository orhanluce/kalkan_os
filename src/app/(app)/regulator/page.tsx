"use client";

// Regülatör işlemleri — İNDEKS (M38, G7). Otorite yazışması oluştur + listele.
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { StatusBadge, type SemantikDurum } from "@/components/durum/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createClient } from "@/lib/supabase/client";

interface Matter {
  id: string;
  otorite: string;
  konu: string;
  durum: string;
}

export const MATTER_DURUM: Record<string, SemantikDurum> = {
  ACIK: "info",
  DEVAM: "legal-review",
  KAPANDI: "neutral",
};

export default function RegulatorPage() {
  const [matterlar, setMatterlar] = useState<Matter[]>([]);
  const [hata, setHata] = useState<string | null>(null);
  const [otorite, setOtorite] = useState("");
  const [konu, setKonu] = useState("");

  const yukle = useCallback(async () => {
    const db = createClient();
    const { data } = await db.from("regulatory_matters").select("id, otorite, konu, durum").order("acilis_tarihi", { ascending: false });
    setMatterlar((data ?? []) as Matter[]);
  }, []);

  useEffect(() => {
    const c = async () => {
      await yukle();
    };
    void c();
  }, [yukle]);

  const olustur = useCallback(async () => {
    setHata(null);
    if (!otorite.trim() || !konu.trim()) return;
    const db = createClient();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) return;
    const { data: p } = await db.from("profiles").select("tenant_id").eq("id", user.id).maybeSingle();
    if (!p?.tenant_id) {
      setHata("Kurum bağlamı çözülemedi.");
      return;
    }
    const { error } = await db.from("regulatory_matters").insert({ tenant_id: p.tenant_id, otorite: otorite.trim(), konu: konu.trim() });
    if (error) {
      setHata(error.message);
      return;
    }
    setOtorite("");
    setKonu("");
    await yukle();
  }, [otorite, konu, yukle]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Regülatör İşlemleri</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Otorite yazışmaları, PBC/talepler (son tarih), sürümlü yanıtlar (dört-göz onay + gönderim
          makbuzu) ve bağımsızlık beyanlı matter-kapsamlı dış erişim. Otomatik dış gönderim yok —
          yalnız hazırlama, onay ve makbuz.
        </p>
      </div>

      {hata ? (
        <p role="alert" className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {hata}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Yeni yazışma</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="m-otorite">Otorite</Label>
              <Input id="m-otorite" value={otorite} onChange={(e) => setOtorite(e.target.value)} placeholder="SPK" className="w-40" />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="m-konu">Konu</Label>
              <Input id="m-konu" value={konu} onChange={(e) => setKonu(e.target.value)} placeholder="Bilgi sistemleri incelemesi" className="w-80" />
            </div>
            <Button onClick={() => void olustur()} disabled={!otorite.trim() || !konu.trim()}>
              Oluştur
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Yazışmalar ({matterlar.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {matterlar.length === 0 ? (
            <p className="text-sm text-muted-foreground">Henüz yazışma yok.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Otorite</TableHead>
                    <TableHead>Konu</TableHead>
                    <TableHead>Durum</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {matterlar.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.otorite}</TableCell>
                      <TableCell>
                        <Link href={`/regulator/${m.id}`} className="text-primary hover:underline">
                          {m.konu}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <StatusBadge durum={MATTER_DURUM[m.durum] ?? "neutral"}>{m.durum}</StatusBadge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
