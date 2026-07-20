"use client";

// Kritik hizmetler — İNDEKS (M13, G8). Hizmet oluştur + listele + sistemik
// tekil-nokta sinyalleri. Tolerans/bağımlılık detayda.
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { StatusBadge } from "@/components/durum/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { tekilNoktaAnalizi, type KritikHizmetGraf } from "@/lib/dayaniklilik";
import { createClient } from "@/lib/supabase/client";
import { EkranYardimPaneli } from "@/components/yardim/ekran-yardim-paneli";

interface Hizmet {
  id: string;
  ad: string;
  durum: string;
  toleransVar: boolean;
}

export default function KritikHizmetlerPage() {
  const [liste, setListe] = useState<Hizmet[]>([]);
  const [analiz, setAnaliz] = useState<ReturnType<typeof tekilNoktaAnalizi> | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [yeniAd, setYeniAd] = useState("");

  const yukle = useCallback(async () => {
    const db = createClient();
    const { data } = await db
      .from("critical_business_services")
      .select("id, ad, durum, impact_tolerances (durum), service_dependencies (ad, bagimlilik_turu, tekil_nokta)")
      .order("ad");
    const rows = (data ?? []) as unknown as (Hizmet & {
      impact_tolerances: { durum: string }[];
      service_dependencies: { ad: string; bagimlilik_turu: string; tekil_nokta: boolean }[];
    })[];
    setListe(
      rows.map((h) => ({
        id: h.id,
        ad: h.ad,
        durum: h.durum,
        toleransVar: (h.impact_tolerances ?? []).some((t) => t.durum === "YURURLUKTE"),
      })),
    );
    const graf: KritikHizmetGraf[] = rows.map((h) => ({
      id: h.id,
      ad: h.ad,
      bagimliliklar: (h.service_dependencies ?? []).map((d) => ({ ad: d.ad, bagimlilikTuru: d.bagimlilik_turu, tekilNokta: d.tekil_nokta })),
    }));
    setAnaliz(tekilNoktaAnalizi(graf));
  }, []);

  useEffect(() => {
    const c = async () => {
      await yukle();
    };
    void c();
  }, [yukle]);

  const olustur = useCallback(async () => {
    setHata(null);
    if (!yeniAd.trim()) return;
    const db = createClient();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) return;
    const { data: p } = await db.from("profiles").select("tenant_id").eq("id", user.id).maybeSingle();
    if (!p?.tenant_id) return setHata("Kurum bağlamı çözülemedi.");
    const { error } = await db.from("critical_business_services").insert({ tenant_id: p.tenant_id, ad: yeniAd.trim(), sahip: user.id });
    if (error) return setHata(error.message);
    setYeniAd("");
    await yukle();
  }, [yeniAd, yukle]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Kritik Hizmetler</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Kritik iş hizmetleri, etki toleransları (yönetim onaylı; değişiklik yeni sürüm) ve
          bağımlılık grafı. Aynı bağımlılığa dayanan birden fazla kritik hizmet sistemik tekil nokta
          olarak işaretlenir.
        </p>
      </div>

      <EkranYardimPaneli modulId="kritik-hizmetler" />

      {hata ? (
        <p role="alert" className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {hata}
        </p>
      ) : null}

      {analiz && (analiz.sistemikNoktalar.length > 0 || analiz.isaretliTekilNoktalar.length > 0) ? (
        <Card>
          <CardHeader>
            <CardTitle>Tekil nokta sinyalleri</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {analiz.sistemikNoktalar.map((s) => (
              <div key={s.bagimlilikAd} className="flex flex-wrap items-center gap-2">
                <StatusBadge durum="danger">Sistemik</StatusBadge>
                <span>
                  <strong>{s.bagimlilikAd}</strong> — {s.etkilenenHizmetler.join(", ")}
                </span>
              </div>
            ))}
            {analiz.isaretliTekilNoktalar.map((i, idx) => (
              <div key={idx} className="flex flex-wrap items-center gap-2">
                <StatusBadge durum="warning">Tekil nokta</StatusBadge>
                <span>
                  {i.hizmetAd} → {i.bagimlilikAd}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Yeni kritik hizmet</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="h-ad">Ad</Label>
              <Input id="h-ad" value={yeniAd} onChange={(e) => setYeniAd(e.target.value)} placeholder="Müşteri para transferi" className="w-72" />
            </div>
            <Button onClick={() => void olustur()} disabled={!yeniAd.trim()}>
              Oluştur
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Hizmetler ({liste.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {liste.length === 0 ? (
            <p className="text-sm text-muted-foreground">Henüz kritik hizmet yok.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ad</TableHead>
                    <TableHead>Tolerans</TableHead>
                    <TableHead>Durum</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {liste.map((h) => (
                    <TableRow key={h.id}>
                      <TableCell className="font-medium">
                        <Link href={`/kritik-hizmetler/${h.id}`} className="text-primary hover:underline">
                          {h.ad}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <StatusBadge durum={h.toleransVar ? "success" : "warning"}>
                          {h.toleransVar ? "Yürürlükte" : "Tanımsız"}
                        </StatusBadge>
                      </TableCell>
                      <TableCell className="text-xs">{h.durum}</TableCell>
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
