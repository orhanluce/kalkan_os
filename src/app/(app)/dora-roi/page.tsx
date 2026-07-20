"use client";

// DORA RoI Export Motoru (37 Tez Dikey B, Faz 3). Dar kapsam: export
// oluştur → on-kontrol raporu → onay talebi (engelleyici sorun varken
// KAPALI) → maker-checker karar (talep eden kendi export'unu onaylayamaz)
// → YAYINLANDI'da CSV/XLSX indirme + Proof Room linki. Karar sınırı DB
// guard'ında (20260720130000); bu ekran akışı sürer.
import { useCallback, useEffect, useState } from "react";
import { StatusBadge, type SemantikDurum } from "@/components/durum/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";

interface OnKontrolSorunu {
  kod: string;
  seviye: "blok" | "uyari";
  mesaj: string;
}

interface ExportRun {
  id: string;
  durum: "TASLAK" | "ONAY_TALEP_EDILDI" | "YAYINLANDI" | "REDDEDILDI";
  paket_hash: string;
  engelleyici_sorun_sayisi: number;
  on_kontrol_raporu: { sorunlar: OnKontrolSorunu[] };
  talep_eden: string;
  onaylayan: string | null;
  red_notu: string | null;
  created_at: string;
}

const DURUM_ROZET: Record<ExportRun["durum"], SemantikDurum> = {
  TASLAK: "neutral",
  ONAY_TALEP_EDILDI: "legal-review",
  YAYINLANDI: "success",
  REDDEDILDI: "danger",
};

export default function DoraRoiPage() {
  const [runlar, setRunlar] = useState<ExportRun[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [olusturuluyor, setOlusturuluyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [proofLinkleri, setProofLinkleri] = useState<Record<string, string>>({});

  const yukle = useCallback(async () => {
    const db = createClient();
    const { data } = await db
      .from("roi_export_runs")
      .select("id, durum, paket_hash, engelleyici_sorun_sayisi, on_kontrol_raporu, talep_eden, onaylayan, red_notu, created_at")
      .order("created_at", { ascending: false });
    setRunlar((data ?? []) as unknown as ExportRun[]);
    setYukleniyor(false);
  }, []);

  useEffect(() => {
    const c = async () => {
      const db = createClient();
      const {
        data: { user },
      } = await db.auth.getUser();
      setUserId(user?.id ?? null);
      await yukle();
    };
    void c();
  }, [yukle]);

  const exportOlustur = useCallback(async () => {
    setHata(null);
    setOlusturuluyor(true);
    const res = await fetch("/api/dora-roi/export", { method: "POST" });
    const govde = (await res.json().catch(() => ({}))) as { hata?: string };
    setOlusturuluyor(false);
    if (!res.ok) return setHata(govde.hata ?? "Export oluşturulamadı.");
    await yukle();
  }, [yukle]);

  const karaVer = useCallback(
    async (id: string, eylem: "talep_et" | "onayla" | "reddet") => {
      setHata(null);
      const res = await fetch(`/api/dora-roi/export/${id}/karar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eylem }),
      });
      const govde = (await res.json().catch(() => ({}))) as { hata?: string };
      if (!res.ok) return setHata(govde.hata ?? "İşlem başarısız.");
      await yukle();
    },
    [yukle],
  );

  const proofLinkiOlustur = useCallback(async (id: string) => {
    setHata(null);
    const res = await fetch("/api/proof-room", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eylem: "olustur", roiExportRunId: id }),
    });
    const govde = (await res.json().catch(() => ({}))) as { url?: string; hata?: string };
    if (!res.ok || !govde.url) return setHata(govde.hata ?? "Proof Room linki oluşturulamadı.");
    setProofLinkleri((m) => ({ ...m, [id]: govde.url! }));
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">DORA RoI Export</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Kurum kimliği, ICT hizmet türü, tedarikçi/sözleşme ve kritik fonksiyon eşlemesinden RoI
          şablon satırları üretir. Engelleyici sorun (ör. doğrulanmamış ICT hizmet türü) varken
          onay talebi açılamaz — indirme yalnız YAYINLANDI export&apos;larda, dört-göz onayı ister
          (talep eden kendi export&apos;unu onaylayamaz).
        </p>
      </div>

      {hata ? (
        <p role="alert" className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {hata}
        </p>
      ) : null}

      <Card>
        <CardContent className="flex items-center gap-3 pt-6">
          <Button onClick={() => void exportOlustur()} disabled={olusturuluyor}>
            {olusturuluyor ? "Oluşturuluyor…" : "Yeni Export Oluştur"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Export geçmişi ({runlar.length})</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {yukleniyor ? (
            <p className="text-sm text-muted-foreground">Yükleniyor…</p>
          ) : runlar.length === 0 ? (
            <p className="text-sm text-muted-foreground">Henüz export yok. Yukarıdan bir tane oluşturun.</p>
          ) : (
            runlar.map((r) => {
              const kendiTalebi = r.talep_eden === userId;
              const blokVar = r.engelleyici_sorun_sayisi > 0;
              return (
                <div key={r.id} data-testid={`roi-export-${r.id}`} className="flex flex-col gap-2 border-t pt-3 first:border-t-0 first:pt-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge durum={DURUM_ROZET[r.durum]}>{r.durum}</StatusBadge>
                    <code className="text-xs text-muted-foreground" title={r.paket_hash}>
                      {r.paket_hash.slice(0, 16)}…
                    </code>
                    <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("tr-TR")}</span>
                  </div>

                  {r.on_kontrol_raporu.sorunlar.length > 0 ? (
                    <div className="flex flex-col gap-1 pl-1 text-xs">
                      {r.on_kontrol_raporu.sorunlar.map((s, i) => (
                        <span key={`${s.kod}-${i}`} className={s.seviye === "blok" ? "text-danger" : "text-warning"}>
                          [{s.seviye === "blok" ? "BLOK" : "UYARI"}] {s.mesaj}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="pl-1 text-xs text-success">Ön-kontrol: sorun yok</span>
                  )}

                  <div className="flex flex-wrap items-center gap-2 pl-1">
                    {r.durum === "TASLAK" ? (
                      <Button size="sm" variant="outline" onClick={() => void karaVer(r.id, "talep_et")} disabled={blokVar} title={blokVar ? "Engelleyici sorun varken onay talebi açılamaz" : undefined}>
                        Onay Talep Et
                      </Button>
                    ) : null}

                    {r.durum === "ONAY_TALEP_EDILDI" ? (
                      kendiTalebi ? (
                        <span className="text-xs text-warning">Bu export&apos;u siz talep ettiniz — başka bir yetkili onaylamalı (dört göz).</span>
                      ) : (
                        <>
                          <Button size="sm" onClick={() => void karaVer(r.id, "onayla")}>
                            Onayla
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => void karaVer(r.id, "reddet")}>
                            Reddet
                          </Button>
                        </>
                      )
                    ) : null}

                    {r.durum === "YAYINLANDI" ? (
                      <>
                        <a href={`/api/dora-roi/export/${r.id}/dosya?format=csv`} className="inline-flex h-8 items-center rounded-md border px-3 text-xs font-medium hover:bg-accent">
                          CSV indir
                        </a>
                        <a href={`/api/dora-roi/export/${r.id}/dosya?format=xlsx`} className="inline-flex h-8 items-center rounded-md border px-3 text-xs font-medium hover:bg-accent">
                          XLSX indir
                        </a>
                        {proofLinkleri[r.id] ? (
                          <a href={proofLinkleri[r.id]} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">
                            Proof Room linki: {proofLinkleri[r.id]}
                          </a>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => void proofLinkiOlustur(r.id)}>
                            Proof Room Linki Oluştur
                          </Button>
                        )}
                      </>
                    ) : null}

                    {r.durum === "REDDEDILDI" && r.red_notu ? <span className="text-xs text-muted-foreground">Red notu: {r.red_notu}</span> : null}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
