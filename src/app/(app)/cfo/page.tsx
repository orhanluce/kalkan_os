"use client";

// CFO Kalkanı yönetim özeti / dashboard (V2 PR-3b, §6.3). Finans odaklı
// güvence görünümü — mevcut motorları (SoD, IBAN doğrulama, kanıt tazeliği,
// bulgular) YENİDEN KULLANIR; yeni motor kurulmaz. Regulated dashboard'dan
// ayrı eksen: ödeme/SoD/erişim/IBAN.
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { StatusBadge } from "@/components/durum/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ttvMetrikleri, type AktivasyonOlayi } from "@/lib/aktivasyon";
import { createClient } from "@/lib/supabase/client";

export default function CfoDashboardPage() {
  const [acikCatisma, setAcikCatisma] = useState(0);
  const [bekleyenIban, setBekleyenIban] = useState(0);
  const [dolanKanit, setDolanKanit] = useState(0);
  const [acikBulgu, setAcikBulgu] = useState(0);
  const [ttv, setTtv] = useState<ReturnType<typeof ttvMetrikleri>>([]);
  const [yukleniyor, setYukleniyor] = useState(true);

  const yukle = useCallback(async () => {
    const db = createClient();
    const simdi = new Date().toISOString();
    const [catisma, iban, kanit, bulgu, olaylar] = await Promise.all([
      db
        .from("sod_catismalari")
        .select("id", { count: "exact", head: true })
        .in("durum", ["OPEN", "REOPENED"]),
      db
        .from("supplier_bank_change_verifications")
        .select("id", { count: "exact", head: true })
        .eq("durum", "TALEP_EDILDI"),
      db
        .from("evidences")
        .select("id", { count: "exact", head: true })
        .not("gecerlilik_bitis", "is", null)
        .lt("gecerlilik_bitis", simdi),
      db.from("findings").select("id", { count: "exact", head: true }).eq("durum", "acik"),
      db.from("activation_events").select("event_type, occurred_at"),
    ]);
    setAcikCatisma(catisma.count ?? 0);
    setBekleyenIban(iban.count ?? 0);
    setDolanKanit(kanit.count ?? 0);
    setAcikBulgu(bulgu.count ?? 0);
    setTtv(ttvMetrikleri((olaylar.data ?? []) as AktivasyonOlayi[]));
    setYukleniyor(false);
  }, []);

  useEffect(() => {
    const c = async () => {
      await yukle();
    };
    void c();
  }, [yukle]);

  const kart = (baslik: string, sayi: number, kritikMi: boolean, link: string) => (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">{baslik}</CardTitle>
      </CardHeader>
      <CardContent className="flex items-center justify-between">
        <span className="text-3xl font-semibold tabular-nums">{sayi}</span>
        <Link href={link} className={buttonVariants({ variant: "outline", size: "sm" })}>
          Aç
        </Link>
      </CardContent>
    </Card>
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Finans Güvence Özeti</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ödeme kontrolleri, görevler ayrılığı, IBAN doğrulama ve kanıt tazeliği tek bakışta. Bu
          görünüm mevcut kontrol/test/kanıt çekirdeğini kullanır.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kart("Açık SoD çatışması", acikCatisma, acikCatisma > 0, "/sod")}
        {kart("Bekleyen IBAN doğrulaması", bekleyenIban, bekleyenIban > 0, "/cfo/iban-degisiklik")}
        {kart("Süresi dolan kanıt", dolanKanit, dolanKanit > 0, "/controls")}
        {kart("Açık finans bulgusu", acikBulgu, acikBulgu > 0, "/findings")}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Değer Süresi (Time-to-Value)</CardTitle>
        </CardHeader>
        <CardContent>
          {yukleniyor ? (
            <p className="text-sm text-muted-foreground">Yükleniyor…</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {ttv.map((m) => (
                <StatusBadge key={m.anahtar} durum={m.saat === null ? "unknown" : "success"}>
                  {m.etiket}: {m.saat === null ? "henüz yok" : `${m.saat} saat`}
                </StatusBadge>
              ))}
            </div>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Profil tamamlanmasından itibaren ölçülür. &quot;Henüz yok&quot; = o kilometre taşına
            ulaşılmadı (sıfır ile karıştırılmaz).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
