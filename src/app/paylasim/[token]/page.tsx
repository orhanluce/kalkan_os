"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { createClient } from "@/lib/supabase/client";
import { DURUM_BADGE_VARIANT, DURUM_LABEL } from "@/lib/ui-labels";
import type { Durum } from "@/lib/types";

// Denetçi görünümü: OTURUMSUZ çalışır (denetçinin hesabı yoktur).
//
// Bu sayfa store'u KULLANMAZ: store oturuma bağlıdır ve RLS anon'a hiçbir
// satır döndürmez. Bunun yerine paylasim_goruntule RPC'si çağrılır — token'ı
// doğrulayan, süreyi kontrol eden ve kapsamı belirleyen tek kapı orasıdır
// (bkz. 20260717100000_share_link_guest_access.sql).
//
// Kapsam ve gizlilik istemcide DEĞİL veritabanında uygulanır: bu bileşen bir
// filtre değil, yalnızca bir görüntüleyicidir. Filtreleme istemcide olsaydı,
// tarayıcı ağ sekmesini açan denetçi kapsam dışı veriyi görürdü.

interface PaylasimKontrol {
  madde_ref: string;
  baslik: string;
  kritiklik: number;
  durum: Durum;
  kanit_sayisi: number;
}

interface PaylasimVerisi {
  kurumAdi: string;
  frameworkCode: string;
  frameworkAdi: string;
  sonGecerlilik: string;
  kontroller: PaylasimKontrol[];
}

export default function ShareLinkGuestPage() {
  const params = useParams<{ token: string }>();
  const [veri, setVeri] = useState<PaylasimVerisi | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);

  useEffect(() => {
    let iptal = false;

    const yukle = async () => {
      const db = createClient();
      const { data } = await db.rpc("paylasim_goruntule", { p_token: params.token });
      if (iptal) return;
      setVeri((data as unknown as PaylasimVerisi | null) ?? null);
      setYukleniyor(false);
    };

    void yukle();
    return () => {
      iptal = true;
    };
  }, [params.token]);

  return (
    <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col gap-6 px-6 py-8">
      <div className="flex items-center justify-between border-b pb-4">
        <span className="text-lg font-semibold tracking-tight">KALKAN-OS</span>
        <Badge variant="outline">Denetçi Görünümü · salt-okunur</Badge>
      </div>

      {yukleniyor ? (
        <p className="text-sm text-muted-foreground">Yükleniyor…</p>
      ) : !veri ? (
        // Geçersiz, süresi dolmuş ve var olmayan token AYNI mesajı alır:
        // ayırt edilebilselerdi, saldırgan geçerli token'ları eleyebilirdi.
        <EmptyState
          title="Bu link geçersiz veya süresi dolmuş"
          description="Kurumunuzla iletişime geçip güncel bir paylaşım linki isteyin."
        />
      ) : (
        <>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{veri.kurumAdi}</h1>
            <p className="text-sm text-muted-foreground">
              Kapsam: {veri.frameworkCode} — {veri.frameworkAdi}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Erişim bitişi: {new Date(veri.sonGecerlilik).toLocaleDateString("tr-TR")}
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Kontrol–Kanıt İndeksi</CardTitle>
            </CardHeader>
            <CardContent>
              {veri.kontroller.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Bu kapsamda izlenen kontrol yok.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Madde</TableHead>
                      <TableHead>Kontrol</TableHead>
                      <TableHead>Kritiklik</TableHead>
                      <TableHead>Durum</TableHead>
                      <TableHead>Kanıt</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {veri.kontroller.map((k) => (
                      <TableRow key={k.madde_ref}>
                        <TableCell className="text-muted-foreground">{k.madde_ref}</TableCell>
                        <TableCell>{k.baslik}</TableCell>
                        <TableCell className="tabular-nums">{k.kritiklik}</TableCell>
                        <TableCell>
                          <Badge variant={DURUM_BADGE_VARIANT[k.durum]}>
                            {DURUM_LABEL[k.durum]}
                          </Badge>
                        </TableCell>
                        <TableCell className="tabular-nums">{k.kanit_sayisi}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <p className="mt-auto pt-8 text-xs text-muted-foreground">
        Bu görünüm kanıt dosyalarının içeriğini göstermez; yalnızca kontrol durumlarını ve kanıt
        sayısını listeler. Erişiminiz kurumun denetim izine kaydedilir.
      </p>
    </div>
  );
}
