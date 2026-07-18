"use client";

// Politika & Prosedür Yaşam Döngüsü — İNDEKS (G2, M34 v2). Oluştur + listele +
// detaya git. Zengin akış (madde yazımı, bağlama, onay, yürürlük, salt-okur +
// audit) detay sayfasında (/politikalar/[id]).
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { StatusBadge, type SemantikDurum } from "@/components/durum/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createClient } from "@/lib/supabase/client";

interface Surum {
  id: string;
  surum: number;
  durum: string;
}
interface Belge {
  id: string;
  kod: string;
  baslik: string;
  guncelSurum: Surum | null;
}

export const DURUM_ETIKET: Record<string, { etiket: string; semantik: SemantikDurum }> = {
  DRAFT: { etiket: "Taslak", semantik: "neutral" },
  IN_REVIEW: { etiket: "İncelemede", semantik: "legal-review" },
  APPROVED: { etiket: "Onaylandı", semantik: "info" },
  EFFECTIVE: { etiket: "Yürürlükte", semantik: "success" },
  RETIRED: { etiket: "Emekli", semantik: "neutral" },
};

export default function PolitikalarPage() {
  const [belgeler, setBelgeler] = useState<Belge[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState<string | null>(null);
  const [yeniKod, setYeniKod] = useState("");
  const [yeniBaslik, setYeniBaslik] = useState("");

  const yukle = useCallback(async () => {
    const db = createClient();
    const { data: docs } = await db
      .from("policy_documents")
      .select("id, kod, baslik, policy_versions (id, surum, durum)")
      .order("kod");
    setBelgeler(
      ((docs ?? []) as unknown as (Omit<Belge, "guncelSurum"> & { policy_versions: Surum[] })[]).map((d) => ({
        id: d.id,
        kod: d.kod,
        baslik: d.baslik,
        guncelSurum: [...(d.policy_versions ?? [])].sort((a, b) => b.surum - a.surum)[0] ?? null,
      })),
    );
    setYukleniyor(false);
  }, []);

  useEffect(() => {
    const c = async () => {
      await yukle();
    };
    void c();
  }, [yukle]);

  const belgeOlustur = useCallback(async () => {
    setHata(null);
    if (!yeniKod.trim() || !yeniBaslik.trim()) return;
    const db = createClient();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) return;
    const { data: profil } = await db.from("profiles").select("tenant_id").eq("id", user.id).maybeSingle();
    if (!profil?.tenant_id) {
      setHata("Kurum bağlamı çözülemedi.");
      return;
    }
    const { data: doc, error } = await db
      .from("policy_documents")
      .insert({ tenant_id: profil.tenant_id, kod: yeniKod.trim(), baslik: yeniBaslik.trim() })
      .select("id")
      .single();
    if (error || !doc) {
      setHata(error?.message ?? "Belge oluşturulamadı.");
      return;
    }
    const { error: vErr } = await db
      .from("policy_versions")
      .insert({ tenant_id: profil.tenant_id, policy_document_id: doc.id, surum: 1 });
    if (vErr) {
      setHata(vErr.message);
      return;
    }
    setYeniKod("");
    setYeniBaslik("");
    await yukle();
  }, [yeniKod, yeniBaslik, yukle]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Politikalar</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Kurumun yönetişim belgeleri. Sürümlü ve durum makineli: taslak → inceleme → onay →
          yürürlük → emekli. Dört göz ilkesi ve geriye-tarih yasağı veritabanında zorlanır.
          Bir politikayı yönetmek için üstüne tıklayın.
        </p>
      </div>

      {hata ? (
        <p role="alert" className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {hata}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Yeni politika</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="pol-kod">Kod</Label>
              <Input id="pol-kod" value={yeniKod} onChange={(e) => setYeniKod(e.target.value)} placeholder="POL-BG-01" className="w-40" />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="pol-baslik">Başlık</Label>
              <Input id="pol-baslik" value={yeniBaslik} onChange={(e) => setYeniBaslik(e.target.value)} placeholder="Bilgi Güvenliği Politikası" className="w-80" />
            </div>
            <Button onClick={() => void belgeOlustur()} disabled={!yeniKod.trim() || !yeniBaslik.trim()}>
              Oluştur (v1 taslak)
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Politikalar ({belgeler.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {yukleniyor ? (
            <p className="text-sm text-muted-foreground">Yükleniyor…</p>
          ) : belgeler.length === 0 ? (
            <p className="text-sm text-muted-foreground">Henüz politika yok. Yukarıdan bir tane oluşturun.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kod</TableHead>
                    <TableHead>Başlık</TableHead>
                    <TableHead>Güncel sürüm</TableHead>
                    <TableHead>Durum</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {belgeler.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium">
                        <Link href={`/politikalar/${b.id}`} className="text-primary hover:underline">
                          {b.kod}
                        </Link>
                      </TableCell>
                      <TableCell>{b.baslik}</TableCell>
                      <TableCell className="tabular-nums text-xs">{b.guncelSurum ? `v${b.guncelSurum.surum}` : "—"}</TableCell>
                      <TableCell>
                        {b.guncelSurum ? (
                          <StatusBadge durum={DURUM_ETIKET[b.guncelSurum.durum]?.semantik ?? "neutral"}>
                            {DURUM_ETIKET[b.guncelSurum.durum]?.etiket ?? b.guncelSurum.durum}
                          </StatusBadge>
                        ) : (
                          "—"
                        )}
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
