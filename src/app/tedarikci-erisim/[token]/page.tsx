"use client";

// Tedarikçi oturumsuz dış görünüm (M35 sonraki dilim, G7 M41 partner modeli):
// tedarikçi hesapsız, süreli token ile kendi kaydının özetini görür.
// Kapsam/süre/iptal tedarikci_goruntule RPC'sinde (matter_goruntule
// disiplini); bu sayfa görüntüleyici.
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { StatusBadge } from "@/components/durum/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createClient } from "@/lib/supabase/client";

interface Bulgu {
  baslik: string;
  ciddiyet: string;
  durum: string;
  hedefTarih: string | null;
}
interface Degerlendirme {
  tur: string;
  durum: string;
  tamamlandiAt: string | null;
}
interface AnketOzeti {
  id: string;
  tur: string;
  durum: string;
}
interface TedarikciVeri {
  ad: string;
  tier: string;
  karar: string;
  sonGecerlilik: string;
  degerlendirme: Degerlendirme | null;
  acikBulgular: Bulgu[];
  anketler: AnketOzeti[];
}

const CIDDIYET_SEM: Record<string, "neutral" | "warning" | "danger"> = {
  DUSUK: "neutral",
  ORTA: "warning",
  YUKSEK: "danger",
  KRITIK: "danger",
};

export default function TedarikciGorunumPage() {
  const params = useParams<{ token: string }>();
  const [veri, setVeri] = useState<TedarikciVeri | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);

  useEffect(() => {
    let iptal = false;
    const yukle = async () => {
      const db = createClient();
      const { data } = await db.rpc("tedarikci_goruntule", { p_token: params.token });
      if (iptal) return;
      setVeri((data as unknown as TedarikciVeri | null) ?? null);
      setYukleniyor(false);
    };
    void yukle();
    return () => {
      iptal = true;
    };
  }, [params.token]);

  if (yukleniyor) {
    return <main className="mx-auto max-w-3xl p-6 text-sm text-muted-foreground">Yükleniyor…</main>;
  }
  if (!veri) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <h1 className="text-xl font-semibold">Tedarikçi Erişimi</h1>
        <p className="mt-2 text-sm text-muted-foreground">Link geçersiz, süresi dolmuş veya iptal edilmiş.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{veri.ad}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Salt-okur tedarikçi görünümü · Erişim: {new Date(veri.sonGecerlilik).toLocaleString("tr-TR")} · Bu
          görüntüleme denetim izine kaydedildi.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Durum</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2 text-sm">
          <StatusBadge durum="neutral">Kritiklik: {veri.tier}</StatusBadge>
          <StatusBadge durum={veri.karar === "ONAYLANDI" ? "success" : veri.karar === "REDDEDILDI" ? "danger" : "warning"}>
            {veri.karar}
          </StatusBadge>
          {veri.degerlendirme ? (
            <StatusBadge durum={veri.degerlendirme.durum === "TAMAMLANDI" ? "success" : "warning"}>
              Değerlendirme ({veri.degerlendirme.tur}): {veri.degerlendirme.durum}
            </StatusBadge>
          ) : (
            <span className="text-xs text-muted-foreground">Açık değerlendirme yok.</span>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Anketler ({veri.anketler.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {veri.anketler.length === 0 ? (
            <p className="text-sm text-muted-foreground">Yayınlanmış anket yok.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {veri.anketler.map((a) => (
                <div key={a.id} className="flex flex-wrap items-center gap-2 rounded-md border p-2 text-sm">
                  <StatusBadge durum="neutral">{a.tur}</StatusBadge>
                  <StatusBadge durum={a.durum === "TAMAMLANDI" ? "success" : "warning"}>{a.durum}</StatusBadge>
                  <Link href={`/tedarikci-erisim/${params.token}/anket/${a.id}`} className="ml-auto">
                    <Button size="sm" variant="outline">
                      Anketi Aç
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Açık bulgular ({veri.acikBulgular.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {veri.acikBulgular.length === 0 ? (
            <p className="text-sm text-muted-foreground">Açık bulgu yok.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bulgu</TableHead>
                    <TableHead>Ciddiyet</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead>Hedef tarih</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {veri.acikBulgular.map((b, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-sm">{b.baslik}</TableCell>
                      <TableCell>
                        <StatusBadge durum={CIDDIYET_SEM[b.ciddiyet] ?? "neutral"}>{b.ciddiyet}</StatusBadge>
                      </TableCell>
                      <TableCell>
                        <StatusBadge durum="warning">{b.durum}</StatusBadge>
                      </TableCell>
                      <TableCell className="text-xs">{b.hedefTarih ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
