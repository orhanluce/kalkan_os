"use client";

// AI Assurance & Agent Governance hub (M37, G5). AI sistem envanteri (yasak
// uygulama aktif edilemez), ajanlar (yazma yetkisi insan onayı ister; kill/
// disable), AI Decision Receipt'ler (SUGGESTED doğar; kabul/red İNSANA ait —
// AI karar veremez). Karar sınırı DB guard'ında; bu ekran akışı sürer.
import { useCallback, useEffect, useMemo, useState } from "react";
import { StatusBadge, type SemantikDurum } from "@/components/durum/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { aiReceiptFingerprint } from "@/lib/ai-receipt";
import { aiOlayOzeti, type OlayKayit } from "@/lib/ai-olay";
import { ihlalBildirimSaati } from "@/lib/gizlilik";
import { createClient } from "@/lib/supabase/client";

interface Sistem {
  id: string;
  ad: string;
  rol: string;
  risk_sinifi: string;
  durum: string;
}
interface Ajan {
  id: string;
  ad: string;
  yazma_yetkisi: boolean;
  insan_onay_gerekli: boolean;
  durum: string;
}
interface Receipt {
  id: string;
  amac: string;
  karar: string;
  model_saglayici: string | null;
}
interface Olay {
  id: string;
  ai_system_id: string;
  ozet: string;
  ciddiyet: string;
  durum: string;
  tespit_at: string;
  otorite_bildirildi_at: string | null;
  bildirim_esik_saat: number | null;
}
interface Eval {
  id: string;
  ai_system_id: string;
  tur: string;
  sonuc: string;
}
interface Soyagaci {
  id: string;
  ai_evaluation_id: string;
  tur: string;
  ad: string;
}

const RISK: Record<string, SemantikDurum> = { PROHIBITED: "danger", HIGH: "warning", LIMITED: "info", MINIMAL: "neutral" };
const KARAR_SEM: Record<string, SemantikDurum> = { SUGGESTED: "legal-review", ACCEPTED: "success", REJECTED: "danger" };

export default function AiGuvencePage() {
  const [sistemler, setSistemler] = useState<Sistem[]>([]);
  const [ajanlar, setAjanlar] = useState<Ajan[]>([]);
  const [receiptler, setReceiptler] = useState<Receipt[]>([]);
  const [hata, setHata] = useState<string | null>(null);

  const [sAd, setSAd] = useState("");
  const [sRisk, setSRisk] = useState("HIGH");
  const [aAd, setAAd] = useState("");
  const [aSistem, setASistem] = useState("");
  const [aYazma, setAYazma] = useState(false);
  const [olaylar, setOlaylar] = useState<Olay[]>([]);
  const [evaller, setEvaller] = useState<Eval[]>([]);
  const [oOzet, setOOzet] = useState("");
  const [oCiddiyet, setOCiddiyet] = useState("KRITIK");
  const [oKanit, setOKanit] = useState<Record<string, string>>({});
  const [oEsik, setOEsik] = useState<Record<string, string>>({});
  const [eTur, setETur] = useState("BIAS");
  const [eSonuc, setESonuc] = useState("UNKNOWN");
  const [soyagaclar, setSoyagaclar] = useState<Soyagaci[]>([]);
  const [sgTur, setSgTur] = useState<Record<string, string>>({});
  const [sgAd, setSgAd] = useState<Record<string, string>>({});
  const simdi = useMemo(() => new Date(), []);

  const tenantCoz = useCallback(async (): Promise<string | null> => {
    const db = createClient();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) return null;
    const { data: p } = await db.from("profiles").select("tenant_id").eq("id", user.id).maybeSingle();
    return p?.tenant_id ?? null;
  }, []);

  const yukle = useCallback(async () => {
    const db = createClient();
    const [{ data: ss }, { data: as }, { data: rs }, { data: os }, { data: es }, { data: sg }] = await Promise.all([
      db.from("ai_systems").select("id, ad, rol, risk_sinifi, durum").order("ad"),
      db.from("ai_agents").select("id, ad, yazma_yetkisi, insan_onay_gerekli, durum").order("ad"),
      db.from("ai_execution_receipts").select("id, amac, karar, model_saglayici").order("created_at", { ascending: false }),
      db.from("ai_incidents").select("id, ai_system_id, ozet, ciddiyet, durum, tespit_at, otorite_bildirildi_at, bildirim_esik_saat").order("tespit_at", { ascending: false }),
      db.from("ai_evaluations").select("id, ai_system_id, tur, sonuc").order("degerlendirme_at", { ascending: false }),
      db.from("ai_data_lineage").select("id, ai_evaluation_id, tur, ad").order("created_at", { ascending: false }),
    ]);
    setSistemler((ss ?? []) as Sistem[]);
    setAjanlar((as ?? []) as Ajan[]);
    setReceiptler((rs ?? []) as Receipt[]);
    setOlaylar((os ?? []) as Olay[]);
    setEvaller((es ?? []) as Eval[]);
    setSoyagaclar((sg ?? []) as Soyagaci[]);
    if (!aSistem && (ss ?? []).length > 0) setASistem((ss as Sistem[])[0].id);
  }, [aSistem]);

  useEffect(() => {
    const c = async () => {
      await yukle();
    };
    void c();
  }, [yukle]);

  const sistemEkle = useCallback(async () => {
    setHata(null);
    if (!sAd.trim()) return;
    const tid = await tenantCoz();
    if (!tid) return setHata("Kurum bağlamı çözülemedi.");
    const db = createClient();
    const { error } = await db.from("ai_systems").insert({ tenant_id: tid, ad: sAd.trim(), risk_sinifi: sRisk });
    if (error) return setHata(error.message);
    setSAd("");
    await yukle();
  }, [sAd, sRisk, tenantCoz, yukle]);

  const sistemDurum = useCallback(
    async (id: string, durum: string) => {
      setHata(null);
      const db = createClient();
      const { error } = await db.from("ai_systems").update({ durum }).eq("id", id);
      if (error) setHata(error.message.includes("yasak uygulama") ? "PROHIBITED risk sınıflı sistem aktif edilemez (yasak uygulama)." : error.message);
      await yukle();
    },
    [yukle],
  );

  const olayEkle = useCallback(async () => {
    setHata(null);
    if (!oOzet.trim() || !aSistem) return;
    const tid = await tenantCoz();
    if (!tid) return setHata("Kurum bağlamı çözülemedi.");
    const db = createClient();
    const { error } = await db.from("ai_incidents").insert({ tenant_id: tid, ai_system_id: aSistem, ozet: oOzet.trim(), ciddiyet: oCiddiyet });
    if (error) return setHata(error.message);
    setOOzet("");
    await yukle();
  }, [oOzet, oCiddiyet, aSistem, tenantCoz, yukle]);

  const olayKapat = useCallback(
    async (id: string) => {
      setHata(null);
      const kanit = (oKanit[id] ?? "").trim();
      if (!kanit) return setHata("Olay kapanışı kanıt ister (kural 14).");
      const db = createClient();
      const {
        data: { user },
      } = await db.auth.getUser();
      if (!user) return;
      const { error } = await db
        .from("ai_incidents")
        .update({ durum: "KAPANDI", kapanis_kanit: kanit, kapatan: user.id, kapanis_zamani: new Date().toISOString() })
        .eq("id", id);
      if (error) setHata(error.message);
      setOKanit((m) => ({ ...m, [id]: "" }));
      await yukle();
    },
    [oKanit, yukle],
  );

  // Bildirim eşiği (saat) — KALKAN_OS bir sabit sayı UYDURMAZ (kural 3): AB AI
  // Act madde 73 eşiği olay türüne göre değişir; kurum kendi hukuk danışmanlığıyla
  // belirler. Saat türetimi src/lib/gizlilik.ts'ten YENİDEN KULLANILIR.
  const esikKaydet = useCallback(
    async (id: string) => {
      setHata(null);
      const saat = Number(oEsik[id]);
      if (!saat || saat <= 0) return;
      const db = createClient();
      const { error } = await db.from("ai_incidents").update({ bildirim_esik_saat: saat }).eq("id", id);
      if (error) setHata(error.message);
      setOEsik((m) => ({ ...m, [id]: "" }));
      await yukle();
    },
    [oEsik, yukle],
  );

  const otoriteyeBildir = useCallback(
    async (id: string) => {
      setHata(null);
      const db = createClient();
      const { error } = await db.from("ai_incidents").update({ otorite_bildirildi_at: new Date().toISOString() }).eq("id", id);
      if (error) setHata(error.message);
      await yukle();
    },
    [yukle],
  );

  const evalEkle = useCallback(async () => {
    setHata(null);
    if (!aSistem) return;
    const tid = await tenantCoz();
    if (!tid) return setHata("Kurum bağlamı çözülemedi.");
    const db = createClient();
    const { error } = await db.from("ai_evaluations").insert({ tenant_id: tid, ai_system_id: aSistem, tur: eTur, sonuc: eSonuc });
    if (error) setHata(error.message);
    await yukle();
  }, [aSistem, eTur, eSonuc, tenantCoz, yukle]);

  // Soyağacı: eval sonucunun HANGİ veri kümesi/model sürümüne karşı ölçüldüğü
  // (ISO 42001/NIST AI RMF izlenebilirliği). Ham veri değil, yalnız referans.
  const soyagaciEkle = useCallback(
    async (evalId: string) => {
      setHata(null);
      const ad = (sgAd[evalId] ?? "").trim();
      if (!ad) return;
      const tid = await tenantCoz();
      if (!tid) return setHata("Kurum bağlamı çözülemedi.");
      const db = createClient();
      const { error } = await db.from("ai_data_lineage").insert({
        tenant_id: tid,
        ai_evaluation_id: evalId,
        tur: sgTur[evalId] ?? "DEGERLENDIRME_VERISI",
        ad,
      });
      if (error) setHata(error.message);
      setSgAd((m) => ({ ...m, [evalId]: "" }));
      await yukle();
    },
    [sgAd, sgTur, tenantCoz, yukle],
  );

  const ajanEkle = useCallback(async () => {
    setHata(null);
    if (!aAd.trim() || !aSistem) return;
    const tid = await tenantCoz();
    if (!tid) return setHata("Kurum bağlamı çözülemedi.");
    const db = createClient();
    // Yazma yetkisi işaretliyse insan onayı ZORUNLU (guard da zorlar).
    const { error } = await db.from("ai_agents").insert({ tenant_id: tid, ai_system_id: aSistem, ad: aAd.trim(), yazma_yetkisi: aYazma, insan_onay_gerekli: aYazma ? true : true });
    if (error) return setHata(error.message);
    setAAd("");
    setAYazma(false);
    await yukle();
  }, [aAd, aSistem, aYazma, tenantCoz, yukle]);

  const ajanDevreDisi = useCallback(
    async (id: string) => {
      setHata(null);
      const db = createClient();
      const { error } = await db.from("ai_agents").update({ durum: "DEVRE_DISI" }).eq("id", id);
      if (error) setHata(error.message);
      await yukle();
    },
    [yukle],
  );

  const receiptOlustur = useCallback(async () => {
    setHata(null);
    if (!aSistem) return setHata("Önce bir AI sistemi ekleyin.");
    const tid = await tenantCoz();
    if (!tid) return setHata("Kurum bağlamı çözülemedi.");
    const db = createClient();
    const fingerprint = await aiReceiptFingerprint({
      aiSystemId: aSistem,
      aiAgentId: null,
      amac: "yükümlülük çıkarımı önerisi",
      modelSaglayici: "OPEN_DECISION",
      modelId: "dev",
      modelSurum: "0",
      promptHash: null,
      kaynakHash: [],
      confidence: 0.8,
    });
    const { error } = await db.from("ai_execution_receipts").insert({
      tenant_id: tid,
      ai_system_id: aSistem,
      amac: "yükümlülük çıkarımı önerisi",
      model_saglayici: "OPEN_DECISION",
      model_id: "dev",
      model_surum: "0",
      confidence: 0.8,
      fingerprint,
    });
    if (error) return setHata(error.message);
    await yukle();
  }, [aSistem, tenantCoz, yukle]);

  const receiptKarar = useCallback(
    async (id: string, karar: "ACCEPTED" | "REJECTED") => {
      setHata(null);
      const db = createClient();
      const {
        data: { user },
      } = await db.auth.getUser();
      if (!user) return;
      const { error } = await db
        .from("ai_execution_receipts")
        .update({ karar, reviewer: user.id, reviewer_karar_zamani: new Date().toISOString() })
        .eq("id", id);
      if (error) setHata(error.message);
      await yukle();
    },
    [yukle],
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">AI Güvence</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          AI sistem/ajan yönetimi ve karar makbuzları. Yasak (PROHIBITED) uygulama aktif edilemez;
          yazma yetkili ajan insan onayı gerektirir; AI önerisi SUGGESTED doğar ve kabul/red kararı
          yalnız insana aittir — AI karar veremez.
        </p>
      </div>

      {hata ? (
        <p role="alert" className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {hata}
        </p>
      ) : null}

      {/* AI sistemleri */}
      <Card>
        <CardHeader>
          <CardTitle>AI sistemleri ({sistemler.length})</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="s-ad">Sistem adı</Label>
              <Input id="s-ad" value={sAd} onChange={(e) => setSAd(e.target.value)} className="w-56" />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="s-risk">Risk sınıfı</Label>
              <select id="s-risk" value={sRisk} onChange={(e) => setSRisk(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm">
                <option value="MINIMAL">Minimal</option>
                <option value="LIMITED">Sınırlı</option>
                <option value="HIGH">Yüksek</option>
                <option value="PROHIBITED">Yasak</option>
              </select>
            </div>
            <Button size="sm" onClick={() => void sistemEkle()} disabled={!sAd.trim()}>
              AI Sistemi Ekle
            </Button>
          </div>
          {sistemler.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ad</TableHead>
                    <TableHead>Risk</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead>Eylem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sistemler.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>{s.ad}</TableCell>
                      <TableCell>
                        <StatusBadge durum={RISK[s.risk_sinifi] ?? "neutral"}>{s.risk_sinifi}</StatusBadge>
                      </TableCell>
                      <TableCell className="text-xs">{s.durum}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {s.durum !== "AKTIF" ? (
                            <Button size="sm" variant="outline" onClick={() => void sistemDurum(s.id, "AKTIF")}>
                              Aktifleştir
                            </Button>
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => void sistemDurum(s.id, "DEVRE_DISI")}>
                              Devre Dışı
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Ajanlar */}
      <Card>
        <CardHeader>
          <CardTitle>AI ajanları ({ajanlar.length})</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="a-ad">Ajan adı</Label>
              <Input id="a-ad" value={aAd} onChange={(e) => setAAd(e.target.value)} className="w-48" />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="a-sistem">Sistem</Label>
              <select id="a-sistem" value={aSistem} onChange={(e) => setASistem(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm">
                {sistemler.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.ad}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-1 text-xs">
              <input type="checkbox" checked={aYazma} onChange={(e) => setAYazma(e.target.checked)} /> Yazma yetkisi (insan onayı zorunlu olur)
            </label>
            <Button size="sm" onClick={() => void ajanEkle()} disabled={!aAd.trim() || !aSistem}>
              Ajan Ekle
            </Button>
          </div>
          {ajanlar.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ad</TableHead>
                    <TableHead>Yazma</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead>Eylem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ajanlar.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>{a.ad}</TableCell>
                      <TableCell className="text-xs">{a.yazma_yetkisi ? "Evet (onaylı)" : "Hayır"}</TableCell>
                      <TableCell className="text-xs">{a.durum}</TableCell>
                      <TableCell>
                        {a.durum === "AKTIF" ? (
                          <Button size="sm" variant="outline" onClick={() => void ajanDevreDisi(a.id)}>
                            Devre Dışı Bırak
                          </Button>
                        ) : (
                          <StatusBadge durum="neutral">Devre dışı</StatusBadge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Karar makbuzları */}
      <Card>
        <CardHeader>
          <CardTitle>AI karar makbuzları ({receiptler.length})</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button size="sm" variant="outline" className="w-fit" onClick={() => void receiptOlustur()} disabled={sistemler.length === 0}>
            Örnek AI önerisi (SUGGESTED) oluştur
          </Button>
          {receiptler.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Amaç</TableHead>
                    <TableHead>Karar</TableHead>
                    <TableHead>İnsan kararı</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receiptler.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-sm">{r.amac}</TableCell>
                      <TableCell>
                        <StatusBadge durum={KARAR_SEM[r.karar] ?? "neutral"}>{r.karar}</StatusBadge>
                      </TableCell>
                      <TableCell>
                        {r.karar === "SUGGESTED" ? (
                          <div className="flex gap-1">
                            <Button size="sm" onClick={() => void receiptKarar(r.id, "ACCEPTED")}>
                              Kabul Et
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => void receiptKarar(r.id, "REJECTED")}>
                              Reddet
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Karara bağlandı</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Olaylar & Değerlendirmeler */}
      <Card>
        <CardHeader>
          <CardTitle>Olaylar &amp; Değerlendirmeler</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <div className="flex flex-col gap-1">
            <Label htmlFor="oe-sistem">Sistem</Label>
            <select
              id="oe-sistem"
              value={aSistem}
              onChange={(e) => setASistem(e.target.value)}
              aria-label="Olay/eval sistemi"
              className="h-9 w-64 rounded-md border bg-background px-2 text-sm"
            >
              {sistemler.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.ad}
                </option>
              ))}
            </select>
          </div>

          {(() => {
            const sistemOlaylari = olaylar.filter((o) => o.ai_system_id === aSistem);
            const ozet = aiOlayOzeti(sistemOlaylari as unknown as OlayKayit[]);
            return (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">Olaylar ({sistemOlaylari.length})</span>
                  {ozet.acikCiddiVar ? <StatusBadge durum="danger">Açık ciddi olay</StatusBadge> : null}
                </div>
                {sistemOlaylari.map((o) => {
                  const ciddi = o.ciddiyet === "KRITIK" || o.ciddiyet === "YUKSEK";
                  const saat = o.bildirim_esik_saat
                    ? ihlalBildirimSaati(o.tespit_at, simdi, o.otorite_bildirildi_at, o.bildirim_esik_saat)
                    : null;
                  return (
                    <div key={o.id} className="flex flex-col gap-1 border-t pt-2 text-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        <span>{o.ozet}</span>
                        <StatusBadge durum={ciddi ? "danger" : "neutral"}>{o.ciddiyet}</StatusBadge>
                        <StatusBadge durum={o.durum === "KAPANDI" ? "success" : "warning"}>{o.durum}</StatusBadge>
                        {o.durum !== "KAPANDI" ? (
                          <>
                            <Input
                              value={oKanit[o.id] ?? ""}
                              onChange={(e) => setOKanit((m) => ({ ...m, [o.id]: e.target.value }))}
                              placeholder="kapanış kanıtı"
                              aria-label={`${o.id} olay kanıtı`}
                              className="h-7 w-44 text-xs"
                            />
                            <Button size="sm" variant="outline" onClick={() => void olayKapat(o.id)}>
                              Kapat
                            </Button>
                          </>
                        ) : null}
                      </div>
                      {ciddi && o.durum !== "KAPANDI" ? (
                        <div className="flex flex-wrap items-center gap-2 pl-1">
                          {saat ? (
                            <StatusBadge durum={saat.gecikti ? "danger" : "warning"}>{saat.mesaj}</StatusBadge>
                          ) : (
                            <StatusBadge durum="unknown">Bildirim eşiği belirlenmedi</StatusBadge>
                          )}
                          {!o.bildirim_esik_saat ? (
                            <>
                              <Input
                                type="number"
                                value={oEsik[o.id] ?? ""}
                                onChange={(e) => setOEsik((m) => ({ ...m, [o.id]: e.target.value }))}
                                placeholder="eşik (saat) — hukuk danışmanınızla belirleyin"
                                aria-label={`${o.id} bildirim eşiği saat`}
                                className="h-7 w-64 text-xs"
                              />
                              <Button size="sm" variant="outline" onClick={() => void esikKaydet(o.id)} disabled={!(oEsik[o.id] ?? "").trim()}>
                                Eşiği Kaydet
                              </Button>
                            </>
                          ) : !o.otorite_bildirildi_at ? (
                            <Button size="sm" variant="outline" onClick={() => void otoriteyeBildir(o.id)}>
                              Otoriteye Bildirildi İşaretle
                            </Button>
                          ) : (
                            <span className="text-muted-foreground">
                              Bildirildi: {new Date(o.otorite_bildirildi_at).toLocaleString("tr-TR")}
                            </span>
                          )}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
                <div className="flex flex-wrap items-end gap-2 border-t pt-2">
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="o-ozet">Olay özeti</Label>
                    <Input id="o-ozet" value={oOzet} onChange={(e) => setOOzet(e.target.value)} className="w-56" />
                  </div>
                  <select value={oCiddiyet} onChange={(e) => setOCiddiyet(e.target.value)} aria-label="Olay ciddiyeti" className="h-9 rounded-md border bg-background px-2 text-sm">
                    <option value="DUSUK">Düşük</option>
                    <option value="ORTA">Orta</option>
                    <option value="YUKSEK">Yüksek</option>
                    <option value="KRITIK">Kritik</option>
                  </select>
                  <Button size="sm" onClick={() => void olayEkle()} disabled={!oOzet.trim() || !aSistem}>
                    Olay Ekle
                  </Button>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2 border-t pt-2">
                  <span className="font-medium">Değerlendirmeler (eval)</span>
                  <span className="text-xs text-muted-foreground">UNKNOWN = ölçülmedi (kural 13: başarısız değil)</span>
                </div>
                {evaller.filter((e) => e.ai_system_id === aSistem).map((e) => {
                  const evalSoyagaclari = soyagaclar.filter((s) => s.ai_evaluation_id === e.id);
                  return (
                    <div key={e.id} className="flex flex-col gap-1 border-t pt-2 text-xs first:border-t-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span>{e.tur}</span>
                        <StatusBadge durum={e.sonuc === "PASSED" ? "success" : e.sonuc === "FAILED" ? "danger" : "unknown"}>{e.sonuc}</StatusBadge>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 pl-1 text-muted-foreground">
                        <span>Soyağacı:</span>
                        {evalSoyagaclari.length === 0 ? (
                          <span>yok</span>
                        ) : (
                          evalSoyagaclari.map((s) => (
                            <StatusBadge key={s.id} durum="info">
                              {s.tur}: {s.ad}
                            </StatusBadge>
                          ))
                        )}
                      </div>
                      <div className="flex flex-wrap items-end gap-2 pl-1">
                        <select
                          value={sgTur[e.id] ?? "DEGERLENDIRME_VERISI"}
                          onChange={(ev) => setSgTur((m) => ({ ...m, [e.id]: ev.target.value }))}
                          aria-label={`${e.id} soyağacı türü`}
                          className="h-7 rounded-md border bg-background px-2 text-xs"
                        >
                          <option value="EGITIM_VERISI">Eğitim verisi</option>
                          <option value="DEGERLENDIRME_VERISI">Değerlendirme verisi</option>
                          <option value="MODEL_SURUMU">Model sürümü</option>
                          <option value="REFERANS_KIYAS">Referans kıyas</option>
                        </select>
                        <Input
                          value={sgAd[e.id] ?? ""}
                          onChange={(ev) => setSgAd((m) => ({ ...m, [e.id]: ev.target.value }))}
                          placeholder="ad/referans (örn. 2026-Q2 seti, model-v3)"
                          aria-label={`${e.id} soyağacı adı`}
                          className="h-7 w-56 text-xs"
                        />
                        <Button size="sm" variant="outline" onClick={() => void soyagaciEkle(e.id)} disabled={!(sgAd[e.id] ?? "").trim()}>
                          Soyağacı Ekle
                        </Button>
                      </div>
                    </div>
                  );
                })}
                <div className="flex flex-wrap items-end gap-2">
                  <select value={eTur} onChange={(ev) => setETur(ev.target.value)} aria-label="Eval türü" className="h-9 rounded-md border bg-background px-2 text-sm">
                    <option value="BIAS">Bias</option>
                    <option value="ROBUSTLUK">Robustluk</option>
                    <option value="DOGRULUK">Doğruluk</option>
                    <option value="GUVENLIK">Güvenlik</option>
                    <option value="ACIKLANABILIRLIK">Açıklanabilirlik</option>
                  </select>
                  <select value={eSonuc} onChange={(ev) => setESonuc(ev.target.value)} aria-label="Eval sonucu" className="h-9 rounded-md border bg-background px-2 text-sm">
                    <option value="UNKNOWN">Ölçülmedi (UNKNOWN)</option>
                    <option value="PASSED">Geçti</option>
                    <option value="FAILED">Kaldı</option>
                  </select>
                  <Button size="sm" variant="outline" onClick={() => void evalEkle()} disabled={!aSistem}>
                    Eval Ekle
                  </Button>
                </div>
              </>
            );
          })()}
        </CardContent>
      </Card>
    </div>
  );
}
