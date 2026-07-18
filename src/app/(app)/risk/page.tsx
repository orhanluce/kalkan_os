"use client";

// Risk & KRI hub (M40, G8). Risk iştahı (yönetim onaylı), KRI + okuma trendi +
// ihlal sinyali, senaryo (kayıp DAĞILIMI + zorunlu varsayım + kontrol fayda).
// CRQ: SAHTE KESİNLİK YOK — tek risk puanı gösterilmez, dağılım özeti + uyarı.
import { useCallback, useEffect, useState } from "react";
import { StatusBadge, type SemantikDurum } from "@/components/durum/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { kontrolFaydaOrani, kriIhlali, ucgenselOzet } from "@/lib/risk";
import { createClient } from "@/lib/supabase/client";

interface Istah {
  id: string;
  kategori: string;
  esik: number;
  yon: string;
  durum: string;
}
interface Kri {
  id: string;
  ad: string;
  esik: number;
  yon: string;
  sonDeger: number | null;
}
interface Senaryo {
  id: string;
  ad: string;
  kayip_min: number;
  kayip_olasi: number;
  kayip_max: number;
  varsayimlar: string;
  kontrol_maliyeti: number | null;
  risk_azaltma: number | null;
}

const KAT_SEM: Record<string, SemantikDurum> = { SIBER: "danger", OPERASYONEL: "warning", UYUM: "info", FINANSAL: "neutral" };

export default function RiskPage() {
  const [istahlar, setIstahlar] = useState<Istah[]>([]);
  const [kriler, setKriler] = useState<Kri[]>([]);
  const [senaryolar, setSenaryolar] = useState<Senaryo[]>([]);
  const [hata, setHata] = useState<string | null>(null);
  const [iKat, setIKat] = useState("SIBER");
  const [iEsik, setIEsik] = useState("");
  const [kAd, setKAd] = useState("");
  const [kEsik, setKEsik] = useState("");
  const [kDeger, setKDeger] = useState<Record<string, string>>({});
  const [sAd, setSAd] = useState("");
  const [sMin, setSMin] = useState("");
  const [sOlasi, setSOlasi] = useState("");
  const [sMax, setSMax] = useState("");
  const [sVars, setSVars] = useState("");
  const [sMaliyet, setSMaliyet] = useState("");
  const [sAzaltma, setSAzaltma] = useState("");

  const baglamCoz = useCallback(async (): Promise<{ tid: string; uid: string } | null> => {
    const db = createClient();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) return null;
    const { data: p } = await db.from("profiles").select("tenant_id").eq("id", user.id).maybeSingle();
    return p?.tenant_id ? { tid: p.tenant_id, uid: user.id } : null;
  }, []);

  const yukle = useCallback(async () => {
    const db = createClient();
    const [{ data: is }, { data: ks }, { data: ss }] = await Promise.all([
      db.from("risk_appetites").select("id, kategori, esik, yon, durum").order("kategori"),
      db.from("key_risk_indicators").select("id, ad, esik, yon, kri_readings (deger, olcum_tarihi)").order("ad"),
      db.from("risk_scenarios").select("id, ad, kayip_min, kayip_olasi, kayip_max, varsayimlar, kontrol_maliyeti, risk_azaltma").order("ad"),
    ]);
    setIstahlar((is ?? []) as Istah[]);
    setKriler(
      ((ks ?? []) as unknown as (Omit<Kri, "sonDeger"> & { kri_readings: { deger: number; olcum_tarihi: string }[] })[]).map((k) => ({
        id: k.id,
        ad: k.ad,
        esik: k.esik,
        yon: k.yon,
        sonDeger: [...(k.kri_readings ?? [])].sort((a, b) => b.olcum_tarihi.localeCompare(a.olcum_tarihi))[0]?.deger ?? null,
      })),
    );
    setSenaryolar((ss ?? []) as Senaryo[]);
  }, []);

  useEffect(() => {
    const c = async () => {
      await yukle();
    };
    void c();
  }, [yukle]);

  const istahEkle = useCallback(async () => {
    setHata(null);
    if (!iEsik.trim()) return;
    const b = await baglamCoz();
    if (!b) return setHata("Kurum bağlamı çözülemedi.");
    const db = createClient();
    const { error } = await db.from("risk_appetites").insert({ tenant_id: b.tid, kategori: iKat, esik: Number(iEsik) });
    if (error) return setHata(error.message.includes("duplicate") ? "Bu kategori için iştah zaten var." : error.message);
    setIEsik("");
    await yukle();
  }, [iKat, iEsik, baglamCoz, yukle]);

  const istahYururluge = useCallback(
    async (id: string) => {
      setHata(null);
      const b = await baglamCoz();
      if (!b) return;
      const db = createClient();
      const { error } = await db.from("risk_appetites").update({ durum: "YURURLUKTE", yonetim_onayi: true, onaylayan: b.uid, onay_zamani: new Date().toISOString() }).eq("id", id);
      if (error) setHata(error.message);
      await yukle();
    },
    [baglamCoz, yukle],
  );

  const kriEkle = useCallback(async () => {
    setHata(null);
    if (!kAd.trim() || !kEsik.trim()) return;
    const b = await baglamCoz();
    if (!b) return setHata("Kurum bağlamı çözülemedi.");
    const db = createClient();
    const { error } = await db.from("key_risk_indicators").insert({ tenant_id: b.tid, ad: kAd.trim(), esik: Number(kEsik) });
    if (error) return setHata(error.message);
    setKAd("");
    setKEsik("");
    await yukle();
  }, [kAd, kEsik, baglamCoz, yukle]);

  const okumaEkle = useCallback(
    async (kriId: string) => {
      setHata(null);
      const d = Number(kDeger[kriId]);
      if (!d && d !== 0) return;
      const b = await baglamCoz();
      if (!b) return;
      const db = createClient();
      const { error } = await db.from("kri_readings").insert({ tenant_id: b.tid, kri_id: kriId, deger: d });
      if (error) setHata(error.message);
      setKDeger((m) => ({ ...m, [kriId]: "" }));
      await yukle();
    },
    [kDeger, baglamCoz, yukle],
  );

  const senaryoEkle = useCallback(async () => {
    setHata(null);
    if (!sAd.trim() || !sMin || !sOlasi || !sMax || !sVars.trim()) return;
    const b = await baglamCoz();
    if (!b) return setHata("Kurum bağlamı çözülemedi.");
    const db = createClient();
    const { error } = await db.from("risk_scenarios").insert({
      tenant_id: b.tid,
      ad: sAd.trim(),
      kayip_min: Number(sMin),
      kayip_olasi: Number(sOlasi),
      kayip_max: Number(sMax),
      varsayimlar: sVars.trim(),
      kontrol_maliyeti: sMaliyet ? Number(sMaliyet) : null,
      risk_azaltma: sAzaltma ? Number(sAzaltma) : null,
    });
    if (error) return setHata(error.message.includes("dagilim") ? "Kayıp dağılımı tutarsız (min ≤ olası ≤ max olmalı)." : error.message);
    setSAd("");
    setSMin("");
    setSOlasi("");
    setSMax("");
    setSVars("");
    setSMaliyet("");
    setSAzaltma("");
    await yukle();
  }, [sAd, sMin, sOlasi, sMax, sVars, sMaliyet, sAzaltma, baglamCoz, yukle]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Risk &amp; KRI</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Risk iştahı (yönetim onaylı), anahtar risk göstergeleri (KRI + trend + ihlal) ve senaryo
          kayıp dağılımı. Kayıp TEK PUAN DEĞİL — bir dağılım (min/olası/max) ve zorunlu varsayımlarla
          gösterilir; sahte kesinlik üretilmez.
        </p>
      </div>

      {hata ? (
        <p role="alert" className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {hata}
        </p>
      ) : null}

      {/* Risk iştahı */}
      <Card>
        <CardHeader>
          <CardTitle>Risk iştahı ({istahlar.length})</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          {istahlar.map((i) => (
            <div key={i.id} className="flex flex-wrap items-center gap-2">
              <StatusBadge durum={KAT_SEM[i.kategori] ?? "neutral"}>{i.kategori}</StatusBadge>
              <span>eşik {i.esik} ({i.yon})</span>
              <StatusBadge durum={i.durum === "YURURLUKTE" ? "success" : "neutral"}>{i.durum}</StatusBadge>
              {i.durum === "TASLAK" ? (
                <Button size="sm" onClick={() => void istahYururluge(i.id)}>
                  Yönetim Onayıyla Yürürlüğe Al
                </Button>
              ) : null}
            </div>
          ))}
          <div className="flex flex-wrap items-end gap-2 border-t pt-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="i-kat">Kategori</Label>
              <select id="i-kat" value={iKat} onChange={(e) => setIKat(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm">
                <option value="SIBER">Siber</option>
                <option value="OPERASYONEL">Operasyonel</option>
                <option value="UYUM">Uyum</option>
                <option value="FINANSAL">Finansal</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="i-esik">İştah eşiği</Label>
              <Input id="i-esik" type="number" value={iEsik} onChange={(e) => setIEsik(e.target.value)} className="w-28" />
            </div>
            <Button size="sm" onClick={() => void istahEkle()} disabled={!iEsik.trim()}>
              İştah Ekle
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* KRI */}
      <Card>
        <CardHeader>
          <CardTitle>Anahtar risk göstergeleri ({kriler.length})</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          {kriler.map((k) => {
            const ihlal = k.sonDeger !== null && kriIhlali(k.sonDeger, k.esik, k.yon as "UST" | "ALT");
            return (
              <div key={k.id} className="flex flex-wrap items-center gap-2">
                <span>{k.ad}</span>
                <span className="text-xs text-muted-foreground">eşik {k.esik} ({k.yon})</span>
                {k.sonDeger !== null ? (
                  <StatusBadge durum={ihlal ? "danger" : "success"}>
                    son {k.sonDeger} {ihlal ? "· İHLAL" : "· uygun"}
                  </StatusBadge>
                ) : (
                  <span className="text-xs text-muted-foreground">okuma yok</span>
                )}
                <Input
                  type="number"
                  placeholder="Yeni okuma"
                  value={kDeger[k.id] ?? ""}
                  onChange={(e) => setKDeger((m) => ({ ...m, [k.id]: e.target.value }))}
                  className="w-28"
                  aria-label={`${k.ad} okuma`}
                />
                <Button size="sm" variant="outline" onClick={() => void okumaEkle(k.id)} disabled={!(kDeger[k.id] ?? "").trim()}>
                  Okuma Ekle
                </Button>
              </div>
            );
          })}
          <div className="flex flex-wrap items-end gap-2 border-t pt-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="k-ad">KRI adı</Label>
              <Input id="k-ad" value={kAd} onChange={(e) => setKAd(e.target.value)} className="w-56" />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="k-esik">KRI eşiği</Label>
              <Input id="k-esik" type="number" value={kEsik} onChange={(e) => setKEsik(e.target.value)} className="w-24" />
            </div>
            <Button size="sm" onClick={() => void kriEkle()} disabled={!kAd.trim() || !kEsik.trim()}>
              KRI Ekle
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Senaryolar */}
      <Card>
        <CardHeader>
          <CardTitle>Kayıp senaryoları ({senaryolar.length})</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          {senaryolar.map((s) => {
            const ozet = ucgenselOzet(s.kayip_min, s.kayip_olasi, s.kayip_max);
            const fayda = kontrolFaydaOrani(s.kontrol_maliyeti, s.risk_azaltma);
            return (
              <div key={s.id} className="rounded-md border p-3">
                <p className="font-medium">{s.ad}</p>
                <p className="text-xs text-muted-foreground">
                  Dağılım: {s.kayip_min} / {s.kayip_olasi} / {s.kayip_max} · beklenen ≈ {Math.round(ozet.beklenen)} · ~P90 ≈{" "}
                  {Math.round(ozet.yaklasikP90)}
                </p>
                <p className="mt-1 text-xs italic text-muted-foreground">{ozet.uyari}</p>
                <p className="mt-1 text-xs">Varsayımlar: {s.varsayimlar}</p>
                {fayda !== null ? <p className="text-xs">Kontrol fayda oranı: {fayda.toFixed(2)}× (azaltım/maliyet)</p> : null}
              </div>
            );
          })}
          <div className="flex flex-col gap-2 rounded-md border border-dashed p-3">
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex flex-col gap-1">
                <Label htmlFor="s-ad">Senaryo</Label>
                <Input id="s-ad" value={sAd} onChange={(e) => setSAd(e.target.value)} className="w-56" />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="s-min">Min</Label>
                <Input id="s-min" type="number" value={sMin} onChange={(e) => setSMin(e.target.value)} className="w-24" />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="s-olasi">Olası</Label>
                <Input id="s-olasi" type="number" value={sOlasi} onChange={(e) => setSOlasi(e.target.value)} className="w-24" />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="s-max">Max</Label>
                <Input id="s-max" type="number" value={sMax} onChange={(e) => setSMax(e.target.value)} className="w-24" />
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex flex-col gap-1">
                <Label htmlFor="s-maliyet">Kontrol maliyeti</Label>
                <Input id="s-maliyet" type="number" value={sMaliyet} onChange={(e) => setSMaliyet(e.target.value)} className="w-32" />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="s-azaltma">Risk azaltımı</Label>
                <Input id="s-azaltma" type="number" value={sAzaltma} onChange={(e) => setSAzaltma(e.target.value)} className="w-32" />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="s-vars">Varsayımlar (zorunlu)</Label>
              <Textarea id="s-vars" value={sVars} onChange={(e) => setSVars(e.target.value)} rows={2} />
            </div>
            <Button size="sm" className="w-fit" onClick={() => void senaryoEkle()} disabled={!sAd.trim() || !sMin || !sOlasi || !sMax || !sVars.trim()}>
              Senaryo Ekle
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
