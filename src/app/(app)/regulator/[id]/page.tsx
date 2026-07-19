"use client";

// Regülatör yazışması detayı (M38+M41, G7): talepler (son tarih) → yanıtlar
// (taslak → farklı kullanıcı onayı [dört göz] → gönder [makbuz]) + bağımsızlık
// beyanı + matter-kapsamlı dış erişim linki. Guard'lar DB'de.
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { StatusBadge, type SemantikDurum } from "@/components/durum/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { gonderimMakbuzu, talepSonTarih } from "@/lib/regulator";
import { createClient } from "@/lib/supabase/client";
import { MATTER_DURUM } from "../page";

interface Yanit {
  id: string;
  surum: number;
  icerik: string;
  durum: string;
  hazirlayan: string | null;
}
interface Talep {
  id: string;
  talep_metni: string;
  son_tarih: string | null;
  durum: string;
  yanitlar: Yanit[];
}
interface Toplanti {
  id: string;
  konu: string;
  tarih: string;
  katilimcilar: string[];
  notlar: string | null;
}

const YANIT_DURUM: Record<string, SemantikDurum> = {
  TASLAK: "neutral",
  ONAY_BEKLIYOR: "legal-review",
  ONAYLANDI: "info",
  GONDERILDI: "success",
};

export default function RegulatorDetayPage() {
  const params = useParams<{ id: string }>();
  const [matter, setMatter] = useState<{ otorite: string; konu: string; durum: string } | null>(null);
  const [talepler, setTalepler] = useState<Talep[]>([]);
  const [grantUrl, setGrantUrl] = useState<string | null>(null);
  const [kullaniciId, setKullaniciId] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [tMetin, setTMetin] = useState("");
  const [tSon, setTSon] = useState("");
  const [yMetin, setYMetin] = useState<Record<string, string>>({});
  const [disEmail, setDisEmail] = useState("");
  const [toplantilar, setToplantilar] = useState<Toplanti[]>([]);
  const [tpKonu, setTpKonu] = useState("");
  const [tpKatilimcilar, setTpKatilimcilar] = useState("");
  const [tpNotlar, setTpNotlar] = useState("");

  const simdi = useMemo(() => new Date(), []);

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
    const { data: m } = await db.from("regulatory_matters").select("otorite, konu, durum").eq("id", params.id).maybeSingle();
    setMatter(m as { otorite: string; konu: string; durum: string } | null);
    const { data: rs } = await db
      .from("regulatory_requests")
      .select("id, talep_metni, son_tarih, durum, regulatory_responses (id, surum, icerik, durum, hazirlayan)")
      .eq("matter_id", params.id)
      .order("created_at");
    setTalepler(
      ((rs ?? []) as unknown as (Omit<Talep, "yanitlar"> & { regulatory_responses: Yanit[] })[]).map((r) => ({
        id: r.id,
        talep_metni: r.talep_metni,
        son_tarih: r.son_tarih,
        durum: r.durum,
        yanitlar: [...(r.regulatory_responses ?? [])].sort((a, b) => b.surum - a.surum),
      })),
    );
    const { data: tps } = await db
      .from("regulatory_meetings")
      .select("id, konu, tarih, katilimcilar, notlar")
      .eq("matter_id", params.id)
      .order("tarih", { ascending: false });
    setToplantilar((tps ?? []) as Toplanti[]);
  }, [params.id]);

  useEffect(() => {
    const c = async () => {
      await yukle();
    };
    void c();
  }, [yukle]);

  const talepEkle = useCallback(async () => {
    setHata(null);
    if (!tMetin.trim() || !tenantId) return;
    const db = createClient();
    const { error } = await db.from("regulatory_requests").insert({ tenant_id: tenantId, matter_id: params.id, talep_metni: tMetin.trim(), son_tarih: tSon || null });
    if (error) setHata(error.message);
    setTMetin("");
    setTSon("");
    await yukle();
  }, [tMetin, tSon, tenantId, params.id, yukle]);

  // Regülatör toplantı kaydı (M38 sonraki dilim, §8.0 sonu öncelik #4):
  // içerik uydurulmaz — katılımcı/notlar tamamen kurumun kendi girdisi.
  const toplantiEkle = useCallback(async () => {
    setHata(null);
    if (!tpKonu.trim() || !tenantId || !kullaniciId) return;
    const db = createClient();
    const katilimcilar = tpKatilimcilar
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const { error } = await db.from("regulatory_meetings").insert({
      tenant_id: tenantId,
      matter_id: params.id,
      konu: tpKonu.trim(),
      katilimcilar,
      notlar: tpNotlar.trim() || null,
      kayit_eden: kullaniciId,
    });
    if (error) setHata(error.message);
    setTpKonu("");
    setTpKatilimcilar("");
    setTpNotlar("");
    await yukle();
  }, [tpKonu, tpKatilimcilar, tpNotlar, tenantId, kullaniciId, params.id, yukle]);

  const yanitEkle = useCallback(
    async (talep: Talep) => {
      setHata(null);
      const metin = (yMetin[talep.id] ?? "").trim();
      if (!metin || !tenantId || !kullaniciId) return;
      const db = createClient();
      const surum = (talep.yanitlar[0]?.surum ?? 0) + 1;
      const { error } = await db.from("regulatory_responses").insert({ tenant_id: tenantId, request_id: talep.id, surum, icerik: metin, hazirlayan: kullaniciId });
      if (error) setHata(error.message);
      setYMetin((s) => ({ ...s, [talep.id]: "" }));
      await yukle();
    },
    [yMetin, tenantId, kullaniciId, yukle],
  );

  const yanitOnayla = useCallback(
    async (yanitId: string) => {
      setHata(null);
      if (!kullaniciId) return;
      const db = createClient();
      const { error } = await db
        .from("regulatory_responses")
        .update({ durum: "ONAYLANDI", onaylayan: kullaniciId, onay_zamani: new Date().toISOString() })
        .eq("id", yanitId);
      if (error) setHata(error.message.includes("dort goz") ? "Hazırlayan kendi yanıtını onaylayamaz (dört göz)." : error.message);
      await yukle();
    },
    [kullaniciId, yukle],
  );

  const yanitGonder = useCallback(
    async (talepId: string, y: Yanit) => {
      setHata(null);
      const db = createClient();
      const receipt = await gonderimMakbuzu(talepId, y.surum, y.icerik);
      const { error } = await db
        .from("regulatory_responses")
        .update({ durum: "GONDERILDI", gonderim_receipt: receipt, gonderildi_at: new Date().toISOString() })
        .eq("id", y.id);
      if (error) setHata(error.message);
      await db.from("regulatory_requests").update({ durum: "YANITLANDI" }).eq("id", talepId);
      await yukle();
    },
    [yukle],
  );

  const disErisimAc = useCallback(async () => {
    setHata(null);
    if (!disEmail.trim() || !tenantId) return;
    const db = createClient();
    // Bağımsızlık beyanı + grant (beyansız erişim RPC'de reddedilir).
    const { data: beyan, error: bErr } = await db
      .from("independence_declarations")
      .insert({ tenant_id: tenantId, matter_id: params.id, external_email: disEmail.trim(), beyan_eden_ad: disEmail.trim(), cikar_catismasi_yok: true })
      .select("id")
      .single();
    if (bErr || !beyan) {
      setHata(bErr?.message ?? "Beyan oluşturulamadı.");
      return;
    }
    const son = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const { data: grant, error: gErr } = await db
      .from("matter_access_grants")
      .insert({ tenant_id: tenantId, matter_id: params.id, external_email: disEmail.trim(), bagimsizlik_beyani_id: beyan.id, son_gecerlilik: son, olusturan: kullaniciId })
      .select("token")
      .single();
    if (gErr || !grant) {
      setHata(gErr?.message ?? "Erişim oluşturulamadı.");
      return;
    }
    setGrantUrl(`/matter/${grant.token}`);
    setDisEmail("");
  }, [disEmail, tenantId, kullaniciId, params.id]);

  if (!matter) return <div className="p-2 text-sm text-muted-foreground">Yükleniyor…</div>;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/regulator" className="text-sm text-muted-foreground hover:underline">
          ← Regülatör İşlemleri
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            {matter.otorite} — {matter.konu}
          </h1>
          <StatusBadge durum={MATTER_DURUM[matter.durum] ?? "neutral"}>{matter.durum}</StatusBadge>
        </div>
      </div>

      {hata ? (
        <p role="alert" className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {hata}
        </p>
      ) : null}

      {/* Talepler + yanıtlar */}
      <Card>
        <CardHeader>
          <CardTitle>Talepler (PBC) ({talepler.length})</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {talepler.map((t) => {
            const saat = talepSonTarih(t.son_tarih, simdi);
            return (
              <div key={t.id} className="rounded-md border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{t.talep_metni}</span>
                  <StatusBadge durum={saat.gecikti ? "danger" : "warning"}>{saat.mesaj}</StatusBadge>
                  <StatusBadge durum={t.durum === "YANITLANDI" ? "success" : "neutral"}>{t.durum}</StatusBadge>
                </div>
                <div className="mt-2 flex flex-col gap-2">
                  {t.yanitlar.map((y) => (
                    <div key={y.id} className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="text-xs text-muted-foreground">v{y.surum}</span>
                      <span>{y.icerik}</span>
                      <StatusBadge durum={YANIT_DURUM[y.durum] ?? "neutral"}>{y.durum}</StatusBadge>
                      {y.durum === "TASLAK" || y.durum === "ONAY_BEKLIYOR" ? (
                        <Button size="sm" variant="outline" onClick={() => void yanitOnayla(y.id)}>
                          Onayla
                        </Button>
                      ) : null}
                      {y.durum === "ONAYLANDI" ? (
                        <Button size="sm" onClick={() => void yanitGonder(t.id, y)}>
                          Gönder (makbuz)
                        </Button>
                      ) : null}
                    </div>
                  ))}
                  <div className="flex flex-wrap items-end gap-2 border-t pt-2">
                    <div className="flex flex-col gap-1">
                      <Label htmlFor={`y-${t.id}`}>Yanıt (yeni sürüm)</Label>
                      <Textarea id={`y-${t.id}`} value={yMetin[t.id] ?? ""} onChange={(e) => setYMetin((s) => ({ ...s, [t.id]: e.target.value }))} rows={2} className="w-80" />
                    </div>
                    <Button size="sm" onClick={() => void yanitEkle(t)} disabled={!(yMetin[t.id] ?? "").trim()}>
                      Yanıt Ekle
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
          <div className="flex flex-wrap items-end gap-2 rounded-md border border-dashed p-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="t-metin">Talep</Label>
              <Input id="t-metin" value={tMetin} onChange={(e) => setTMetin(e.target.value)} className="w-72" />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="t-son">Son tarih</Label>
              <Input id="t-son" type="date" value={tSon} onChange={(e) => setTSon(e.target.value)} />
            </div>
            <Button size="sm" onClick={() => void talepEkle()} disabled={!tMetin.trim()}>
              Talep Ekle
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Toplantılar */}
      <Card>
        <CardHeader>
          <CardTitle>Toplantılar ({toplantilar.length})</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          {toplantilar.map((tp) => (
            <div key={tp.id} className="rounded-md border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{tp.konu}</span>
                <span className="text-xs text-muted-foreground">{new Date(tp.tarih).toLocaleString("tr-TR")}</span>
              </div>
              {tp.katilimcilar.length > 0 ? (
                <p className="mt-1 text-xs text-muted-foreground">Katılımcılar: {tp.katilimcilar.join(", ")}</p>
              ) : null}
              {tp.notlar ? <p className="mt-1 text-xs">{tp.notlar}</p> : null}
            </div>
          ))}
          <div className="flex flex-col gap-2 rounded-md border border-dashed p-3">
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex flex-col gap-1">
                <Label htmlFor="tp-konu">Konu</Label>
                <Input id="tp-konu" value={tpKonu} onChange={(e) => setTpKonu(e.target.value)} placeholder="Saha ziyareti" className="w-56" />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="tp-katilimcilar">Katılımcılar (virgülle)</Label>
                <Input id="tp-katilimcilar" value={tpKatilimcilar} onChange={(e) => setTpKatilimcilar(e.target.value)} placeholder="A. Yılmaz (SPK), B. Demir (Uyum)" className="w-72" />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="tp-notlar">Notlar</Label>
              <Textarea id="tp-notlar" value={tpNotlar} onChange={(e) => setTpNotlar(e.target.value)} rows={2} />
            </div>
            <Button size="sm" className="w-fit" onClick={() => void toplantiEkle()} disabled={!tpKonu.trim()}>
              Toplantı Kaydet
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Dış erişim (bağımsızlık beyanlı) */}
      <Card>
        <CardHeader>
          <CardTitle>Dış erişim (denetçi/regülatör)</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <p className="text-muted-foreground">
            Matter-kapsamlı, süreli, oturumsuz erişim. Bağımsızlık/çıkar-çatışması beyanı olmadan
            erişim çalışmaz; her görüntüleme denetim izine yazılır.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="dis-email">Dış e-posta</Label>
              <Input id="dis-email" value={disEmail} onChange={(e) => setDisEmail(e.target.value)} placeholder="denetci@firma.com" className="w-64" />
            </div>
            <Button size="sm" onClick={() => void disErisimAc()} disabled={!disEmail.trim()}>
              Erişim Aç (beyanlı)
            </Button>
          </div>
          {grantUrl ? (
            <p className="text-xs">
              Erişim linki:{" "}
              <Link href={grantUrl} className="text-primary underline">
                {grantUrl}
              </Link>
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
