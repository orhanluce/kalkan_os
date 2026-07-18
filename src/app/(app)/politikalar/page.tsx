"use client";

// Politika & Prosedür Yaşam Döngüsü (G2, M34). Kurumun kendi yönetişim
// belgeleri: sürümlü, durum makineli (DRAFT→REVIEW→APPROVED→EFFECTIVE→
// RETIRED), dört-göz onaylı. Dört göz + geçiş kuralları DB'de zorlanır; bu
// ekran akışı sürer ve dürüst hatayı gösterir.
import { useCallback, useEffect, useMemo, useState } from "react";
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
  effective_from: string | null;
}
interface Belge {
  id: string;
  kod: string;
  baslik: string;
  kategori: string;
  guncelSurum: Surum | null;
  attestVar: boolean;
}

const DURUM: Record<string, { etiket: string; semantik: SemantikDurum }> = {
  DRAFT: { etiket: "Taslak", semantik: "neutral" },
  REVIEW: { etiket: "İncelemede", semantik: "legal-review" },
  APPROVED: { etiket: "Onaylandı", semantik: "info" },
  EFFECTIVE: { etiket: "Yürürlükte", semantik: "success" },
  RETIRED: { etiket: "Emekli", semantik: "neutral" },
};

export default function PolitikalarPage() {
  const [belgeler, setBelgeler] = useState<Belge[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [yeniKod, setYeniKod] = useState("");
  const [yeniBaslik, setYeniBaslik] = useState("");

  const bugun = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const yukle = useCallback(async () => {
    const db = createClient();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (user) {
      const { data: profil } = await db.from("profiles").select("tenant_id").eq("id", user.id).maybeSingle();
      setTenantId(profil?.tenant_id ?? null);
    }

    const { data: docs } = await db
      .from("policy_documents")
      .select("id, kod, baslik, kategori, policy_versions (id, surum, durum, effective_from)")
      .order("kod");
    const { data: attests } = user
      ? await db.from("policy_attestations").select("policy_version_id").eq("attesting_user", user.id)
      : { data: [] };
    const attestSet = new Set((attests ?? []).map((a) => a.policy_version_id));

    setBelgeler(
      ((docs ?? []) as unknown as (Omit<Belge, "guncelSurum" | "attestVar"> & { policy_versions: Surum[] })[]).map((d) => {
        const guncel = [...(d.policy_versions ?? [])].sort((a, b) => b.surum - a.surum)[0] ?? null;
        return {
          id: d.id,
          kod: d.kod,
          baslik: d.baslik,
          kategori: d.kategori,
          guncelSurum: guncel,
          attestVar: guncel ? attestSet.has(guncel.id) : false,
        };
      }),
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
    // tenant_id'yi state yarışına bırakmadan işlem anında çek (RLS with check).
    let tid = tenantId;
    if (!tid) {
      const {
        data: { user },
      } = await db.auth.getUser();
      const { data: profil } = user
        ? await db.from("profiles").select("tenant_id").eq("id", user.id).maybeSingle()
        : { data: null };
      tid = profil?.tenant_id ?? null;
    }
    if (!tid) {
      setHata("Kurum bağlamı çözülemedi.");
      return;
    }
    const { data: doc, error } = await db
      .from("policy_documents")
      .insert({ tenant_id: tid, kod: yeniKod.trim(), baslik: yeniBaslik.trim() })
      .select("id")
      .single();
    if (error || !doc) {
      setHata(error?.message ?? "Belge oluşturulamadı.");
      return;
    }
    // İlk sürüm DRAFT.
    const { error: vErr } = await db
      .from("policy_versions")
      .insert({ tenant_id: tid, policy_document_id: doc.id, surum: 1 });
    if (vErr) {
      setHata(vErr.message);
      return;
    }
    setYeniKod("");
    setYeniBaslik("");
    await yukle();
  }, [yeniKod, yeniBaslik, tenantId, yukle]);

  const gecis = useCallback(
    async (versionId: string, eylem: string, effectiveFrom?: string) => {
      setHata(null);
      const yanit = await fetch("/api/politika/durum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionId, eylem, effectiveFrom }),
      });
      if (!yanit.ok) {
        const g = (await yanit.json().catch(() => ({}))) as { hata?: string };
        setHata(g.hata ?? `İşlem başarısız (${yanit.status}).`);
      }
      await yukle();
    },
    [yukle],
  );

  const attestEt = useCallback(
    async (versionId: string) => {
      setHata(null);
      const db = createClient();
      const {
        data: { user },
      } = await db.auth.getUser();
      if (!user) return;
      const { data: profil } = await db.from("profiles").select("tenant_id").eq("id", user.id).maybeSingle();
      if (!profil?.tenant_id) return;
      const { error } = await db
        .from("policy_attestations")
        .insert({ tenant_id: profil.tenant_id, policy_version_id: versionId, attesting_user: user.id });
      if (error) setHata(error.message);
      await yukle();
    },
    [yukle],
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Politikalar</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Kurumun yönetişim belgeleri. Sürümlü ve durum makineli: taslak → inceleme → onay →
          yürürlük → emekli. Dört göz ilkesi veritabanında zorlanır: hazırlayan kendi sürümünü
          onaylayamaz. Yürürlükteki sürümün maddeleri değişmez; değişiklik yeni sürüm gerektirir.
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
                    <TableHead>Eylem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {belgeler.map((b) => {
                    const v = b.guncelSurum;
                    return (
                      <TableRow key={b.id}>
                        <TableCell className="font-medium">{b.kod}</TableCell>
                        <TableCell>{b.baslik}</TableCell>
                        <TableCell className="tabular-nums text-xs">{v ? `v${v.surum}` : "—"}</TableCell>
                        <TableCell>
                          {v ? (
                            <StatusBadge durum={DURUM[v.durum]?.semantik ?? "neutral"}>
                              {DURUM[v.durum]?.etiket ?? v.durum}
                            </StatusBadge>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            {v?.durum === "DRAFT" ? (
                              <Button size="sm" variant="outline" onClick={() => void gecis(v.id, "incelemeye_al")}>
                                İncelemeye Al
                              </Button>
                            ) : null}
                            {v?.durum === "REVIEW" ? (
                              <>
                                <Button size="sm" onClick={() => void gecis(v.id, "onayla")}>
                                  Onayla
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => void gecis(v.id, "geri_gonder")}>
                                  Geri Gönder
                                </Button>
                              </>
                            ) : null}
                            {v?.durum === "APPROVED" ? (
                              <Button size="sm" onClick={() => void gecis(v.id, "yururluge_al", bugun)}>
                                Yürürlüğe Al
                              </Button>
                            ) : null}
                            {v?.durum === "EFFECTIVE" ? (
                              <>
                                <Button
                                  size="sm"
                                  variant={b.attestVar ? "outline" : "default"}
                                  disabled={b.attestVar}
                                  onClick={() => void attestEt(v.id)}
                                >
                                  {b.attestVar ? "Okundu ✓" : "Okudum, anladım"}
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => void gecis(v.id, "emekliye_ayir")}>
                                  Emekliye Ayır
                                </Button>
                              </>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
