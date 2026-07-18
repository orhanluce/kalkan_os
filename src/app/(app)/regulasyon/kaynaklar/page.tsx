"use client";

// Resmî kaynak sicili — SALT OKUR (V2 PR-4a, M19; V1 §9.4). Global ortak
// referans: her kiracı aynı hukuk kaynağı listesini görür. İçerik küratör/
// connector tarafından eklenir (script); tenant bu ekranda yazamaz.
import { useCallback, useEffect, useState } from "react";
import { StatusBadge } from "@/components/durum/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createClient } from "@/lib/supabase/client";

interface Kaynak {
  id: string;
  authority: string;
  jurisdiction: string;
  kaynak_seviyesi: string;
  ad: string;
  canonical_url: string | null;
  erisim_politikasi_durumu: string;
  artifact_sayisi: number;
}

const SEVIYE_LABEL: Record<string, string> = {
  A: "A — Birincil hukuk",
  B: "B — Resmî rehber",
  C: "C — Standart",
  D: "D — Akademik",
};

const POLITIKA: Record<string, { etiket: string; semantik: "success" | "warning" | "danger" | "neutral" }> = {
  onaylandi: { etiket: "Erişim onaylı", semantik: "success" },
  manuel: { etiket: "Manuel", semantik: "neutral" },
  onay_bekliyor: { etiket: "Politika onayı bekliyor", semantik: "warning" },
  reddedildi: { etiket: "Reddedildi", semantik: "danger" },
};

export default function KaynaklarPage() {
  const [kaynaklar, setKaynaklar] = useState<Kaynak[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);

  const yukle = useCallback(async () => {
    const db = createClient();
    const { data } = await db
      .from("regulatory_sources")
      .select("id, authority, jurisdiction, kaynak_seviyesi, ad, canonical_url, erisim_politikasi_durumu, source_artifacts(count)")
      .order("jurisdiction")
      .order("kaynak_seviyesi");
    setKaynaklar(
      (data ?? []).map((k) => ({
        ...k,
        artifact_sayisi: (k.source_artifacts as unknown as { count: number }[] | null)?.[0]?.count ?? 0,
      })) as Kaynak[],
    );
    setYukleniyor(false);
  }, []);

  useEffect(() => {
    const c = async () => {
      await yukle();
    };
    void c();
  }, [yukle]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Resmî Kaynak Sicili</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          İzlenen resmî hukuk ve düzenleyici kaynaklar. Bu liste ortak referanstır — kaynak künyeleri
          ve artifact&apos;lar küratör tarafından, doğrulanabilir hash&apos;lerle eklenir. Otomatik
          çekim (connector) erişim politikası onaylanmadan üretime çıkmaz.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Kaynaklar ({kaynaklar.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {yukleniyor ? (
            <p className="text-sm text-muted-foreground">Yükleniyor…</p>
          ) : kaynaklar.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Henüz kaynak eklenmemiş. Küratör seed&apos;i: <code>pnpm tsx scripts/seed-regulatory-sources.ts</code>
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Otorite</TableHead>
                    <TableHead>Yargı</TableHead>
                    <TableHead>Seviye</TableHead>
                    <TableHead>Ad</TableHead>
                    <TableHead>Erişim politikası</TableHead>
                    <TableHead>Artifact</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {kaynaklar.map((k) => (
                    <TableRow key={k.id}>
                      <TableCell>{k.authority}</TableCell>
                      <TableCell className="text-xs">{k.jurisdiction}</TableCell>
                      <TableCell className="text-xs">{SEVIYE_LABEL[k.kaynak_seviyesi] ?? k.kaynak_seviyesi}</TableCell>
                      <TableCell>
                        {k.canonical_url ? (
                          <a href={k.canonical_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                            {k.ad}
                          </a>
                        ) : (
                          k.ad
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge durum={POLITIKA[k.erisim_politikasi_durumu]?.semantik ?? "neutral"}>
                          {POLITIKA[k.erisim_politikasi_durumu]?.etiket ?? k.erisim_politikasi_durumu}
                        </StatusBadge>
                      </TableCell>
                      <TableCell className="tabular-nums text-xs">{k.artifact_sayisi}</TableCell>
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
