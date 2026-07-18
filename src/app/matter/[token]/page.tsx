"use client";

// Matter oturumsuz dış görünüm (M41, G7): denetçi/regülatör hesapsız, süreli
// token ile matter özetini görür. Kapsam/süre/iptal/bağımsızlık-beyanı
// matter_goruntule RPC'sinde (Proof Room disiplini); bu sayfa görüntüleyici.
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { StatusBadge } from "@/components/durum/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createClient } from "@/lib/supabase/client";

interface Talep {
  talepMetni: string;
  sonTarih: string | null;
  durum: string;
  gonderilenSurum: number | null;
}
interface MatterVeri {
  otorite: string;
  konu: string;
  durum: string;
  sonGecerlilik: string;
  talepler: Talep[];
}

export default function MatterGorunumPage() {
  const params = useParams<{ token: string }>();
  const [veri, setVeri] = useState<MatterVeri | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);

  useEffect(() => {
    let iptal = false;
    const yukle = async () => {
      const db = createClient();
      const { data } = await db.rpc("matter_goruntule", { p_token: params.token });
      if (iptal) return;
      setVeri((data as unknown as MatterVeri | null) ?? null);
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
        <h1 className="text-xl font-semibold">Regülatör Erişimi</h1>
        <p className="mt-2 text-sm text-muted-foreground">Link geçersiz, süresi dolmuş veya bağımsızlık beyanı eksik.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {veri.otorite} — {veri.konu}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Salt-okur matter görünümü · Erişim: {new Date(veri.sonGecerlilik).toLocaleString("tr-TR")} · Bu
          görüntüleme denetim izine kaydedildi.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Talepler ({veri.talepler.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {veri.talepler.length === 0 ? (
            <p className="text-sm text-muted-foreground">Talep yok.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Talep</TableHead>
                    <TableHead>Son tarih</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead>Gönderilen sürüm</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {veri.talepler.map((t, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-sm">{t.talepMetni}</TableCell>
                      <TableCell className="text-xs">{t.sonTarih ?? "—"}</TableCell>
                      <TableCell>
                        <StatusBadge durum={t.durum === "YANITLANDI" ? "success" : "neutral"}>{t.durum}</StatusBadge>
                      </TableCell>
                      <TableCell className="text-xs tabular-nums">{t.gonderilenSurum ? `v${t.gonderilenSurum}` : "—"}</TableCell>
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
