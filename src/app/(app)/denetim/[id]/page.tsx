"use client";

// Denetim işi detayı (M17, G8): tekrarlanabilir örnekleme (seed) + çalışma
// kağıtları (hazırlayan → farklı reviewer sign-off, bağımsızlık). Örnek seçimi
// saf motorda (denetim.ts); reviewer≠hazırlayan DB guard'ında.
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { StatusBadge, type SemantikDurum } from "@/components/durum/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ornekIndeksleriSec, ornekYenidenUretilebilir } from "@/lib/denetim";
import { createClient } from "@/lib/supabase/client";
import { RISK_SEM } from "../page";

interface Ornek {
  id: string;
  yontem: string;
  populasyon_boyutu: number;
  ornek_boyutu: number;
  seed: string;
  secilen_indeksler: number[];
}
interface Workpaper {
  id: string;
  baslik: string;
  icerik: string;
  durum: string;
  hazirlayan: string | null;
}
interface KontrolBagi {
  id: string;
  workpaper_id: string;
  control_id: string;
  controls: { madde_ref: string } | null;
}
interface BulguBagi {
  id: string;
  workpaper_id: string;
  finding_id: string;
  findings: { baslik: string } | null;
}
interface KontrolSecenegi {
  id: string;
  ref: string;
}
interface BulguSecenegi {
  id: string;
  baslik: string;
}

const WP_DURUM: Record<string, SemantikDurum> = { TASLAK: "neutral", INCELEME: "legal-review", ONAYLANDI: "success" };

export default function DenetimDetayPage() {
  const params = useParams<{ id: string }>();
  const [is, setIs] = useState<{ ad: string; risk_seviyesi: string } | null>(null);
  const [ornekler, setOrnekler] = useState<Ornek[]>([]);
  const [workpaperlar, setWorkpaperlar] = useState<Workpaper[]>([]);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [kullaniciId, setKullaniciId] = useState<string | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [bilgi, setBilgi] = useState<string | null>(null);
  const [pop, setPop] = useState("");
  const [boyut, setBoyut] = useState("");
  const [seed, setSeed] = useState("");
  const [wpBaslik, setWpBaslik] = useState("");
  const [wpIcerik, setWpIcerik] = useState("");
  const [kontrolBaglari, setKontrolBaglari] = useState<KontrolBagi[]>([]);
  const [bulguBaglari, setBulguBaglari] = useState<BulguBagi[]>([]);
  const [kontrolSecenekleri, setKontrolSecenekleri] = useState<KontrolSecenegi[]>([]);
  const [bulguSecenekleri, setBulguSecenekleri] = useState<BulguSecenegi[]>([]);
  const [kSecim, setKSecim] = useState<Record<string, string>>({});
  const [bSecim, setBSecim] = useState<Record<string, string>>({});

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
    const { data: i } = await db.from("audit_engagements").select("ad, risk_seviyesi").eq("id", params.id).maybeSingle();
    setIs(i as { ad: string; risk_seviyesi: string } | null);
    const { data: os } = await db.from("audit_samples").select("id, yontem, populasyon_boyutu, ornek_boyutu, seed, secilen_indeksler").eq("engagement_id", params.id).order("created_at", { ascending: false });
    setOrnekler((os ?? []) as Ornek[]);
    const { data: ws } = await db.from("audit_workpapers").select("id, baslik, icerik, durum, hazirlayan").eq("engagement_id", params.id).order("created_at");
    setWorkpaperlar((ws ?? []) as Workpaper[]);
    const wpIds = (ws ?? []).map((w) => w.id);
    if (wpIds.length > 0) {
      const { data: kb } = await db.from("audit_workpaper_controls").select("id, workpaper_id, control_id, controls (madde_ref)").in("workpaper_id", wpIds);
      setKontrolBaglari((kb ?? []) as unknown as KontrolBagi[]);
      const { data: bb } = await db.from("audit_workpaper_findings").select("id, workpaper_id, finding_id, findings (baslik)").in("workpaper_id", wpIds);
      setBulguBaglari((bb ?? []) as unknown as BulguBagi[]);
    } else {
      setKontrolBaglari([]);
      setBulguBaglari([]);
    }
    const { data: ks } = await db.from("controls").select("id, madde_ref").order("madde_ref").limit(100);
    setKontrolSecenekleri((ks ?? []).map((k) => ({ id: k.id, ref: k.madde_ref })));
    const { data: bs } = await db.from("findings").select("id, baslik").order("created_at", { ascending: false }).limit(100);
    setBulguSecenekleri((bs ?? []).map((b) => ({ id: b.id, baslik: b.baslik })));
  }, [params.id]);

  useEffect(() => {
    const c = async () => {
      await yukle();
    };
    void c();
  }, [yukle]);

  const ornekSec = useCallback(async () => {
    setHata(null);
    setBilgi(null);
    const p = Number(pop);
    const b = Number(boyut);
    if (!p || !b || !seed.trim() || !tenantId) return;
    const secim = ornekIndeksleriSec(p, b, seed.trim());
    const db = createClient();
    const { error } = await db.from("audit_samples").insert({
      tenant_id: tenantId,
      engagement_id: params.id,
      populasyon_boyutu: p,
      ornek_boyutu: b,
      seed: seed.trim(),
      secilen_indeksler: secim,
    });
    if (error) return setHata(error.message);
    setPop("");
    setBoyut("");
    setSeed("");
    await yukle();
  }, [pop, boyut, seed, tenantId, params.id, yukle]);

  const yenidenUret = useCallback((o: Ornek) => {
    setHata(null);
    const ok = ornekYenidenUretilebilir(o.populasyon_boyutu, o.ornek_boyutu, o.seed, o.secilen_indeksler.map(Number));
    setBilgi(ok ? `Örnek ${o.seed} yeniden üretildi: birebir aynı seçim ✓` : `Örnek ${o.seed} YENİDEN ÜRETİLEMEDİ (uyuşmuyor)`);
  }, []);

  const wpEkle = useCallback(async () => {
    setHata(null);
    if (!wpBaslik.trim() || !tenantId || !kullaniciId) return;
    const db = createClient();
    const { error } = await db.from("audit_workpapers").insert({ tenant_id: tenantId, engagement_id: params.id, baslik: wpBaslik.trim(), icerik: wpIcerik.trim(), hazirlayan: kullaniciId, hazirlama_zamani: new Date().toISOString() });
    if (error) return setHata(error.message);
    setWpBaslik("");
    setWpIcerik("");
    await yukle();
  }, [wpBaslik, wpIcerik, tenantId, kullaniciId, params.id, yukle]);

  const wpOnayla = useCallback(
    async (id: string) => {
      setHata(null);
      if (!kullaniciId) return;
      const db = createClient();
      const { error } = await db
        .from("audit_workpapers")
        .update({ durum: "ONAYLANDI", reviewer: kullaniciId, review_zamani: new Date().toISOString() })
        .eq("id", id);
      if (error) setHata(error.message.includes("bagimsizlik") || error.message.includes("dort goz") ? "Hazırlayan kendi çalışma kağıdını onaylayamaz (bağımsızlık)." : error.message);
      await yukle();
    },
    [kullaniciId, yukle],
  );

  const kontrolBagla = useCallback(
    async (workpaperId: string) => {
      setHata(null);
      const controlId = kSecim[workpaperId];
      if (!controlId || !tenantId) return;
      const db = createClient();
      const { error } = await db.from("audit_workpaper_controls").insert({ tenant_id: tenantId, workpaper_id: workpaperId, control_id: controlId });
      if (error) setHata(error.message.includes("donuk") ? "Onaylanmış çalışma kağıdının bağ listesi değiştirilemez (sign-off sonrası donuk)." : error.message);
      setKSecim((m) => ({ ...m, [workpaperId]: "" }));
      await yukle();
    },
    [kSecim, tenantId, yukle],
  );

  const bulguBagla = useCallback(
    async (workpaperId: string) => {
      setHata(null);
      const findingId = bSecim[workpaperId];
      if (!findingId || !tenantId) return;
      const db = createClient();
      const { error } = await db.from("audit_workpaper_findings").insert({ tenant_id: tenantId, workpaper_id: workpaperId, finding_id: findingId });
      if (error) setHata(error.message.includes("donuk") ? "Onaylanmış çalışma kağıdının bağ listesi değiştirilemez (sign-off sonrası donuk)." : error.message);
      setBSecim((m) => ({ ...m, [workpaperId]: "" }));
      await yukle();
    },
    [bSecim, tenantId, yukle],
  );

  if (!is) return <div className="p-2 text-sm text-muted-foreground">Yükleniyor…</div>;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/denetim" className="text-sm text-muted-foreground hover:underline">
          ← Denetim Çalışma Alanı
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{is.ad}</h1>
          <StatusBadge durum={RISK_SEM[is.risk_seviyesi] ?? "neutral"}>{is.risk_seviyesi}</StatusBadge>
        </div>
      </div>

      {hata ? (
        <p role="alert" className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {hata}
        </p>
      ) : null}
      {bilgi ? <p className="rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">{bilgi}</p> : null}

      {/* Örnekleme */}
      <Card>
        <CardHeader>
          <CardTitle>Örnekleme (tekrarlanabilir)</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          {ornekler.map((o) => (
            <div key={o.id} className="flex flex-wrap items-center gap-2">
              <span>
                {o.yontem} · popülasyon {o.populasyon_boyutu} · örnek {o.ornek_boyutu} · seed{" "}
                <code>{o.seed}</code>
              </span>
              <span className="text-xs text-muted-foreground">[{o.secilen_indeksler.slice(0, 8).join(", ")}{o.secilen_indeksler.length > 8 ? "…" : ""}]</span>
              <Button size="sm" variant="outline" onClick={() => yenidenUret(o)}>
                Yeniden Üret (doğrula)
              </Button>
            </div>
          ))}
          <div className="flex flex-wrap items-end gap-2 border-t pt-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="o-pop">Popülasyon</Label>
              <Input id="o-pop" type="number" value={pop} onChange={(e) => setPop(e.target.value)} className="w-28" />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="o-boyut">Örnek boyutu</Label>
              <Input id="o-boyut" type="number" value={boyut} onChange={(e) => setBoyut(e.target.value)} className="w-28" />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="o-seed">Seed</Label>
              <Input id="o-seed" value={seed} onChange={(e) => setSeed(e.target.value)} placeholder="denetim-2026-q3" className="w-48" />
            </div>
            <Button size="sm" onClick={() => void ornekSec()} disabled={!pop || !boyut || !seed.trim()}>
              Örnek Seç
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Çalışma kağıtları */}
      <Card>
        <CardHeader>
          <CardTitle>Çalışma kağıtları ({workpaperlar.length})</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          {workpaperlar.map((w) => {
            const wKontroller = kontrolBaglari.filter((k) => k.workpaper_id === w.id);
            const wBulgular = bulguBaglari.filter((b) => b.workpaper_id === w.id);
            const donuk = w.durum === "ONAYLANDI";
            return (
              <div key={w.id} className="flex flex-col gap-1 border-b pb-2 last:border-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{w.baslik}</span>
                  <StatusBadge durum={WP_DURUM[w.durum] ?? "neutral"}>{w.durum}</StatusBadge>
                  {w.durum !== "ONAYLANDI" ? (
                    <Button size="sm" onClick={() => void wpOnayla(w.id)}>
                      Sign-off (onayla)
                    </Button>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-1 pl-1 text-xs text-muted-foreground">
                  <span>Kontrol bağı:</span>
                  {wKontroller.length === 0 ? <span>yok</span> : wKontroller.map((k) => <StatusBadge key={k.id} durum="info">{k.controls?.madde_ref ?? k.control_id}</StatusBadge>)}
                  {!donuk ? (
                    <>
                      <select
                        value={kSecim[w.id] ?? ""}
                        onChange={(e) => setKSecim((m) => ({ ...m, [w.id]: e.target.value }))}
                        aria-label={`${w.id} kontrol seç`}
                        className="h-7 rounded-md border bg-background px-1 text-xs"
                      >
                        <option value="">Seçiniz…</option>
                        {kontrolSecenekleri.map((k) => (
                          <option key={k.id} value={k.id}>
                            {k.ref}
                          </option>
                        ))}
                      </select>
                      <Button size="sm" variant="outline" onClick={() => void kontrolBagla(w.id)} disabled={!kSecim[w.id]}>
                        Kontrol Bağla
                      </Button>
                    </>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-1 pl-1 text-xs text-muted-foreground">
                  <span>Bulgu bağı:</span>
                  {wBulgular.length === 0 ? <span>yok</span> : wBulgular.map((b) => <StatusBadge key={b.id} durum="warning">{b.findings?.baslik ?? b.finding_id}</StatusBadge>)}
                  {!donuk ? (
                    <>
                      <select
                        value={bSecim[w.id] ?? ""}
                        onChange={(e) => setBSecim((m) => ({ ...m, [w.id]: e.target.value }))}
                        aria-label={`${w.id} bulgu seç`}
                        className="h-7 rounded-md border bg-background px-1 text-xs"
                      >
                        <option value="">Seçiniz…</option>
                        {bulguSecenekleri.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.baslik}
                          </option>
                        ))}
                      </select>
                      <Button size="sm" variant="outline" onClick={() => void bulguBagla(w.id)} disabled={!bSecim[w.id]}>
                        Bulgu Bağla
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
            );
          })}
          <div className="flex flex-col gap-2 rounded-md border border-dashed p-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="wp-baslik">Başlık</Label>
              <Input id="wp-baslik" value={wpBaslik} onChange={(e) => setWpBaslik(e.target.value)} className="w-72" />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="wp-icerik">İçerik</Label>
              <Textarea id="wp-icerik" value={wpIcerik} onChange={(e) => setWpIcerik(e.target.value)} rows={2} />
            </div>
            <Button size="sm" className="w-fit" onClick={() => void wpEkle()} disabled={!wpBaslik.trim()}>
              Çalışma Kağıdı Ekle
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
