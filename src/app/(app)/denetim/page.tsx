"use client";

// Denetim çalışma alanı — İNDEKS (M17, G8). Denetim işi (risk tabanlı) oluştur
// + listele. Örnekleme/çalışma kağıdı detayda.
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { StatusBadge, type SemantikDurum } from "@/components/durum/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createClient } from "@/lib/supabase/client";
import { EkranYardimPaneli } from "@/components/yardim/ekran-yardim-paneli";

interface Is {
  id: string;
  ad: string;
  risk_seviyesi: string;
  durum: string;
}

export const RISK_SEM: Record<string, SemantikDurum> = { DUSUK: "neutral", ORTA: "warning", YUKSEK: "danger" };

export default function DenetimPage() {
  const [liste, setListe] = useState<Is[]>([]);
  const [hata, setHata] = useState<string | null>(null);
  const [ad, setAd] = useState("");
  const [risk, setRisk] = useState("ORTA");

  const yukle = useCallback(async () => {
    const db = createClient();
    const { data } = await db.from("audit_engagements").select("id, ad, risk_seviyesi, durum").order("ad");
    setListe((data ?? []) as Is[]);
  }, []);

  useEffect(() => {
    const c = async () => {
      await yukle();
    };
    void c();
  }, [yukle]);

  const olustur = useCallback(async () => {
    setHata(null);
    if (!ad.trim()) return;
    const db = createClient();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) return;
    const { data: p } = await db.from("profiles").select("tenant_id").eq("id", user.id).maybeSingle();
    if (!p?.tenant_id) return setHata("Kurum bağlamı çözülemedi.");
    const { error } = await db.from("audit_engagements").insert({ tenant_id: p.tenant_id, ad: ad.trim(), risk_seviyesi: risk, sorumlu: user.id });
    if (error) return setHata(error.message);
    setAd("");
    await yukle();
  }, [ad, risk, yukle]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Denetim Çalışma Alanı</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Risk tabanlı denetim işleri, tekrarlanabilir örnekleme (yöntem + seed) ve çalışma kağıtları
          (hazırlayan/reviewer bağımsızlık sign-off). Denetçi seed&apos;le örneği yeniden üretebilir.
        </p>
      </div>

      <EkranYardimPaneli modulId="yonetim-denetim-raporlari" />

      {hata ? (
        <p role="alert" className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {hata}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Yeni denetim işi</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="d-ad">Ad</Label>
              <Input id="d-ad" value={ad} onChange={(e) => setAd(e.target.value)} placeholder="Bilgi sistemleri denetimi" className="w-72" />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="d-risk">Risk</Label>
              <select id="d-risk" value={risk} onChange={(e) => setRisk(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm">
                <option value="DUSUK">Düşük</option>
                <option value="ORTA">Orta</option>
                <option value="YUKSEK">Yüksek</option>
              </select>
            </div>
            <Button onClick={() => void olustur()} disabled={!ad.trim()}>
              Oluştur
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Denetim işleri ({liste.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {liste.length === 0 ? (
            <p className="text-sm text-muted-foreground">Henüz denetim işi yok.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ad</TableHead>
                    <TableHead>Risk</TableHead>
                    <TableHead>Durum</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {liste.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell className="font-medium">
                        <Link href={`/denetim/${i.id}`} className="text-primary hover:underline">
                          {i.ad}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <StatusBadge durum={RISK_SEM[i.risk_seviyesi] ?? "neutral"}>{i.risk_seviyesi}</StatusBadge>
                      </TableCell>
                      <TableCell className="text-xs">{i.durum}</TableCell>
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
