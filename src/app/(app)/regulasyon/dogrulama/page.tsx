"use client";

// Hukuk doğrulama kuyruğu (QRegu PR-Q2a', M21 dört-göz). Global yükümlülük ve
// eşlemelerin doğrulama yaşam döngüsü: incelemeye al → onayla/reddet.
// DÖRT GÖZ DB'DE zorlanır (incelemeye alan kendi sunumunu doğrulayamaz);
// bu ekran yalnız akışı sürer ve sonucu dürüstçe gösterir.
import { useCallback, useEffect, useState } from "react";
import { StatusBadge, type SemantikDurum } from "@/components/durum/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createClient } from "@/lib/supabase/client";

interface Satir {
  id: string;
  hedef: "yukumluluk" | "esleme";
  etiket: string;
  dogrulama_durumu: string;
  incelemeye_alan: string | null;
}

const DURUM: Record<string, { etiket: string; semantik: SemantikDurum }> = {
  DRAFT_RESEARCH: { etiket: "Araştırma taslağı", semantik: "neutral" },
  TODO_DOGRULA: { etiket: "Doğrulanmadı", semantik: "warning" },
  LEGAL_REVIEW: { etiket: "Hukuk incelemesinde", semantik: "legal-review" },
  VERIFIED: { etiket: "Doğrulandı", semantik: "success" },
  SUPERSEDED: { etiket: "Yerini yeni sürüm aldı", semantik: "neutral" },
  REJECTED: { etiket: "Reddedildi", semantik: "danger" },
};

export default function DogrulamaKuyruguPage() {
  const [satirlar, setSatirlar] = useState<Satir[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState<string | null>(null);

  const yukle = useCallback(async () => {
    const db = createClient();
    const [{ data: yukumlulukler }, { data: eslemeler }] = await Promise.all([
      db
        .from("obligations")
        .select("id, kod, baslik, dogrulama_durumu, incelemeye_alan")
        .order("created_at", { ascending: false }),
      db
        .from("obligation_control_mappings")
        .select("id, dogrulama_durumu, incelemeye_alan, obligations (kod), controls (madde_ref)")
        .order("created_at", { ascending: false }),
    ]);
    setSatirlar([
      ...(yukumlulukler ?? []).map((y) => ({
        id: y.id,
        hedef: "yukumluluk" as const,
        etiket: `${y.kod} — ${y.baslik}`,
        dogrulama_durumu: y.dogrulama_durumu,
        incelemeye_alan: y.incelemeye_alan,
      })),
      ...(eslemeler ?? []).map((e) => ({
        id: e.id,
        hedef: "esleme" as const,
        etiket: `${(e.obligations as unknown as { kod: string })?.kod ?? "?"} → ${(e.controls as unknown as { madde_ref: string })?.madde_ref ?? "?"}`,
        dogrulama_durumu: e.dogrulama_durumu,
        incelemeye_alan: e.incelemeye_alan,
      })),
    ]);
    setYukleniyor(false);
  }, []);

  useEffect(() => {
    const c = async () => {
      await yukle();
    };
    void c();
  }, [yukle]);

  const eylem = useCallback(
    async (satir: Satir, ad: "incelemeye_al" | "onayla" | "reddet") => {
      setHata(null);
      const yanit = await fetch("/api/regulasyon/dogrulama", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hedef: satir.hedef, id: satir.id, eylem: ad }),
      });
      if (!yanit.ok) {
        const govde = (await yanit.json().catch(() => ({}))) as { hata?: string };
        setHata(govde.hata ?? `İşlem başarısız (${yanit.status}).`);
      }
      await yukle();
    },
    [yukle],
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Hukuk Doğrulama Kuyruğu</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Yükümlülük ve kontrol eşlemelerinin doğrulama yaşam döngüsü. Dört göz ilkesi veritabanında
          zorlanır: incelemeye alan kişi kendi sunumunu doğrulayamaz. Doğrulama kararı bugün admin
          rolündedir (hukuk-küratör rolü açık karar K8).
        </p>
      </div>

      {hata ? (
        <p role="alert" className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {hata}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Kayıtlar ({satirlar.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {yukleniyor ? (
            <p className="text-sm text-muted-foreground">Yükleniyor…</p>
          ) : satirlar.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Doğrulama kuyruğu boş — henüz yükümlülük/eşleme kaydı yok. İçerik küratör aracıyla
              (kural 3: uydurulmaz) eklenir.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tür</TableHead>
                    <TableHead>Kayıt</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead>Eylem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {satirlar.map((s) => (
                    <TableRow key={`${s.hedef}-${s.id}`}>
                      <TableCell className="text-xs">{s.hedef === "yukumluluk" ? "Yükümlülük" : "Eşleme"}</TableCell>
                      <TableCell>{s.etiket}</TableCell>
                      <TableCell>
                        <StatusBadge durum={DURUM[s.dogrulama_durumu]?.semantik ?? "neutral"}>
                          {DURUM[s.dogrulama_durumu]?.etiket ?? s.dogrulama_durumu}
                        </StatusBadge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          {["DRAFT_RESEARCH", "TODO_DOGRULA"].includes(s.dogrulama_durumu) ? (
                            <Button size="sm" variant="outline" onClick={() => void eylem(s, "incelemeye_al")}>
                              İncelemeye Al
                            </Button>
                          ) : null}
                          {s.dogrulama_durumu === "LEGAL_REVIEW" ? (
                            <>
                              <Button size="sm" onClick={() => void eylem(s, "onayla")}>
                                Onayla (VERIFIED)
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => void eylem(s, "reddet")}>
                                Reddet
                              </Button>
                            </>
                          ) : null}
                        </div>
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
