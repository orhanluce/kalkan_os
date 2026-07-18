"use client";

// Kritik hizmet detayı (M13, G8): etki toleransı (taslak → yönetim onaylı
// yürürlük; değişiklik yeni sürüm) + bağımlılık grafı (tür + M35 tedarikçi bağı
// + tekil nokta). Guard'lar DB'de.
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { StatusBadge, type SemantikDurum } from "@/components/durum/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

interface Tolerans {
  id: string;
  surum: number;
  max_kesinti_saat: number | null;
  durum: string;
}
interface Bagimlilik {
  id: string;
  bagimlilik_turu: string;
  ad: string;
  tekil_nokta: boolean;
}

const TOL_DURUM: Record<string, SemantikDurum> = { TASLAK: "neutral", YURURLUKTE: "success", SUPERSEDED: "neutral" };

export default function KritikHizmetDetayPage() {
  const params = useParams<{ id: string }>();
  const [hizmet, setHizmet] = useState<{ ad: string; durum: string } | null>(null);
  const [toleranslar, setToleranslar] = useState<Tolerans[]>([]);
  const [bagimliliklar, setBagimliliklar] = useState<Bagimlilik[]>([]);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [kullaniciId, setKullaniciId] = useState<string | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [tKesinti, setTKesinti] = useState("");
  const [bTur, setBTur] = useState("SISTEM");
  const [bAd, setBAd] = useState("");
  const [bTekil, setBTekil] = useState(false);

  const yukle = useCallback(async () => {
    const db = createClient();
    const {
      data: { user },
    } = await db.auth.getUser();
    setKullaniciId(user?.id ?? null);
    if (user) {
      const { data: p } = await db.from("profiles").select("tenant_id").eq("id", user.id).maybeSingle();
      setTenantId(p?.tenant_id ?? null);
    }
    const { data: h } = await db.from("critical_business_services").select("ad, durum").eq("id", params.id).maybeSingle();
    setHizmet(h as { ad: string; durum: string } | null);
    const { data: ts } = await db.from("impact_tolerances").select("id, surum, max_kesinti_saat, durum").eq("critical_service_id", params.id).order("surum", { ascending: false });
    setToleranslar((ts ?? []) as Tolerans[]);
    const { data: bs } = await db.from("service_dependencies").select("id, bagimlilik_turu, ad, tekil_nokta").eq("critical_service_id", params.id);
    setBagimliliklar((bs ?? []) as Bagimlilik[]);
  }, [params.id]);

  useEffect(() => {
    const c = async () => {
      await yukle();
    };
    void c();
  }, [yukle]);

  const toleransEkle = useCallback(async () => {
    setHata(null);
    if (!tKesinti.trim() || !tenantId) return;
    const db = createClient();
    const surum = (toleranslar[0]?.surum ?? 0) + 1;
    const { error } = await db.from("impact_tolerances").insert({ tenant_id: tenantId, critical_service_id: params.id, surum, max_kesinti_saat: Number(tKesinti) });
    if (error) setHata(error.message);
    setTKesinti("");
    await yukle();
  }, [tKesinti, tenantId, toleranslar, params.id, yukle]);

  const toleransYururluge = useCallback(
    async (id: string) => {
      setHata(null);
      if (!kullaniciId) return;
      const db = createClient();
      // Önceki yürürlüktekini SUPERSEDED yap (tek yürürlükte).
      await db.from("impact_tolerances").update({ durum: "SUPERSEDED" }).eq("critical_service_id", params.id).eq("durum", "YURURLUKTE");
      const { error } = await db
        .from("impact_tolerances")
        .update({ durum: "YURURLUKTE", yonetim_onayi: true, onaylayan: kullaniciId, onay_zamani: new Date().toISOString() })
        .eq("id", id);
      if (error) setHata(error.message);
      await yukle();
    },
    [kullaniciId, params.id, yukle],
  );

  const bagimlilikEkle = useCallback(async () => {
    setHata(null);
    if (!bAd.trim() || !tenantId) return;
    const db = createClient();
    const { error } = await db.from("service_dependencies").insert({ tenant_id: tenantId, critical_service_id: params.id, bagimlilik_turu: bTur, ad: bAd.trim(), tekil_nokta: bTekil });
    if (error) setHata(error.message);
    setBAd("");
    setBTekil(false);
    await yukle();
  }, [bAd, bTur, bTekil, tenantId, params.id, yukle]);

  if (!hizmet) return <div className="p-2 text-sm text-muted-foreground">Yükleniyor…</div>;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/kritik-hizmetler" className="text-sm text-muted-foreground hover:underline">
          ← Kritik Hizmetler
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{hizmet.ad}</h1>
      </div>

      {hata ? (
        <p role="alert" className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {hata}
        </p>
      ) : null}

      {/* Etki toleransı */}
      <Card>
        <CardHeader>
          <CardTitle>Etki toleransı</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          {toleranslar.map((t) => (
            <div key={t.id} className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">v{t.surum}</span>
              <span>Maks. kesinti: {t.max_kesinti_saat ?? "—"} saat</span>
              <StatusBadge durum={TOL_DURUM[t.durum] ?? "neutral"}>{t.durum}</StatusBadge>
              {t.durum === "TASLAK" ? (
                <Button size="sm" onClick={() => void toleransYururluge(t.id)}>
                  Yönetim Onayıyla Yürürlüğe Al
                </Button>
              ) : null}
            </div>
          ))}
          <div className="flex flex-wrap items-end gap-2 border-t pt-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="t-kesinti">Maks. kesinti (saat)</Label>
              <Input id="t-kesinti" type="number" value={tKesinti} onChange={(e) => setTKesinti(e.target.value)} className="w-40" />
            </div>
            <Button size="sm" onClick={() => void toleransEkle()} disabled={!tKesinti.trim()}>
              Tolerans Sürümü Ekle
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Bağımlılık grafı */}
      <Card>
        <CardHeader>
          <CardTitle>Bağımlılıklar ({bagimliliklar.length})</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          {bagimliliklar.map((b) => (
            <div key={b.id} className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">{b.bagimlilik_turu}</span>
              <span>{b.ad}</span>
              {b.tekil_nokta ? <StatusBadge durum="warning">Tekil nokta</StatusBadge> : null}
            </div>
          ))}
          <div className="flex flex-wrap items-end gap-2 border-t pt-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="b-tur">Tür</Label>
              <select id="b-tur" value={bTur} onChange={(e) => setBTur(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm">
                <option value="SISTEM">Sistem</option>
                <option value="EKIP">Ekip</option>
                <option value="TESIS">Tesis</option>
                <option value="TEDARIKCI">Tedarikçi</option>
                <option value="BULUT">Bulut</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="b-ad">Bağımlılık adı</Label>
              <Input id="b-ad" value={bAd} onChange={(e) => setBAd(e.target.value)} className="w-56" />
            </div>
            <label className="flex items-center gap-1 text-xs">
              <input type="checkbox" checked={bTekil} onChange={(e) => setBTekil(e.target.checked)} /> Tekil nokta
            </label>
            <Button size="sm" onClick={() => void bagimlilikEkle()} disabled={!bAd.trim()}>
              Bağımlılık Ekle
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
