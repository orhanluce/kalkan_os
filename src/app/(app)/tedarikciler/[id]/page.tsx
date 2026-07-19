"use client";

// Tedarikçi detayı (M35, G4): karar (insan) + hizmet + dördüncü taraf +
// sözleşme + çıkış planı + DORA RoI iskele indirme. İnvariant'lar DB'de:
// insan-karar, bilinmeyen dördüncü taraf, tested-exit kanıt şartı, süresiz
// sözleşme yasağı.
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { StatusBadge } from "@/components/durum/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { bulguOzeti, roiKaydiUret, sozlesmeYakinligi, type Bulgu } from "@/lib/tedarikci";
import { createClient } from "@/lib/supabase/client";
import { KARAR, TIER } from "../page";

interface Tedarikci {
  ad: string;
  ulke: string | null;
  tier: string;
  karar: string;
  dis_rating: string | null;
  dis_rating_kaynagi: string | null;
}
interface Hizmet {
  id: string;
  hizmet_adi: string;
  kritik: boolean;
  veri_siniflari: string[];
}
interface Dorduncu {
  id: string;
  ad: string | null;
  bilinmiyor: boolean;
  ulke: string | null;
}
interface Sozlesme {
  id: string;
  sozlesme_ref: string;
  baslangic: string;
  bitis: string;
  denetim_hakki: boolean;
  cikis_maddesi: boolean;
  durum: string;
}
interface CikisPlani {
  id: string;
  ozet: string;
  test_edildi: boolean;
  test_tarihi: string | null;
  test_kaniti: string | null;
}

interface Degerlendirme {
  id: string;
  tur: string;
  durum: string;
  tamamlandi_at: string | null;
}
interface BulguRow {
  id: string;
  assessment_id: string;
  baslik: string;
  ciddiyet: string;
  durum: string;
}
interface SoruRow {
  id: string;
  assessment_id: string;
  soru: string;
}

export default function TedarikciDetayPage() {
  const params = useParams<{ id: string }>();
  const [t, setT] = useState<Tedarikci | null>(null);
  const [hizmetler, setHizmetler] = useState<Hizmet[]>([]);
  const [dorduncular, setDorduncular] = useState<Dorduncu[]>([]);
  const [sozlesmeler, setSozlesmeler] = useState<Sozlesme[]>([]);
  const [cikis, setCikis] = useState<CikisPlani[]>([]);
  const [degerlendirmeler, setDegerlendirmeler] = useState<Degerlendirme[]>([]);
  const [bulgular, setBulgular] = useState<BulguRow[]>([]);
  const [sorular, setSorular] = useState<SoruRow[]>([]);
  const [bBaslik, setBBaslik] = useState<Record<string, string>>({});
  const [bCiddiyet, setBCiddiyet] = useState<Record<string, string>>({});
  const [bKanit, setBKanit] = useState<Record<string, string>>({});
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [kullaniciId, setKullaniciId] = useState<string | null>(null);
  const [hata, setHata] = useState<string | null>(null);

  // Form state
  const [hizmetAd, setHizmetAd] = useState("");
  const [hizmetKritik, setHizmetKritik] = useState(false);
  const [dtAd, setDtAd] = useState("");
  const [dtBilinmiyor, setDtBilinmiyor] = useState(false);
  const [szRef, setSzRef] = useState("");
  const [szBitis, setSzBitis] = useState("");
  const [cpOzet, setCpOzet] = useState("");
  const [cpTest, setCpTest] = useState(false);
  const [cpKanit, setCpKanit] = useState("");

  const bugun = useMemo(() => new Date().toISOString().slice(0, 10), []);

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
    const { data: tp } = await db
      .from("third_parties")
      .select("ad, ulke, tier, karar, dis_rating, dis_rating_kaynagi")
      .eq("id", params.id)
      .maybeSingle();
    setT(tp as Tedarikci | null);
    const [{ data: hs }, { data: ds }, { data: ss }, { data: cs }] = await Promise.all([
      db.from("third_party_services").select("id, hizmet_adi, kritik, veri_siniflari").eq("third_party_id", params.id),
      db.from("fourth_parties").select("id, ad, bilinmiyor, ulke").eq("third_party_id", params.id),
      db.from("third_party_contracts").select("id, sozlesme_ref, baslangic, bitis, denetim_hakki, cikis_maddesi, durum").eq("third_party_id", params.id),
      db.from("exit_plans").select("id, ozet, test_edildi, test_tarihi, test_kaniti").eq("third_party_id", params.id),
    ]);
    setHizmetler((hs ?? []) as Hizmet[]);
    setDorduncular((ds ?? []) as Dorduncu[]);
    setSozlesmeler((ss ?? []) as Sozlesme[]);
    setCikis((cs ?? []) as CikisPlani[]);
    const [{ data: as_ }, { data: fs }] = await Promise.all([
      db.from("third_party_assessments").select("id, tur, durum, tamamlandi_at").eq("third_party_id", params.id).order("baslangic_at", { ascending: false }),
      db.from("assessment_findings").select("id, assessment_id, baslik, ciddiyet, durum").eq("third_party_id", params.id),
    ]);
    setDegerlendirmeler((as_ ?? []) as Degerlendirme[]);
    setBulgular((fs ?? []) as BulguRow[]);
    const assessmentIds = (as_ ?? []).map((a) => a.id);
    if (assessmentIds.length > 0) {
      const { data: qs } = await db.from("assessment_questions").select("id, assessment_id, soru").in("assessment_id", assessmentIds);
      setSorular((qs ?? []) as SoruRow[]);
    } else {
      setSorular([]);
    }
  }, [params.id]);

  useEffect(() => {
    const c = async () => {
      await yukle();
    };
    void c();
  }, [yukle]);

  const kararVer = useCallback(
    async (karar: "ONAYLANDI" | "REDDEDILDI") => {
      setHata(null);
      if (!kullaniciId) return;
      const db = createClient();
      const { error } = await db
        .from("third_parties")
        .update({ karar, karar_veren: kullaniciId, karar_zamani: new Date().toISOString() })
        .eq("id", params.id);
      if (error) setHata(error.message);
      await yukle();
    },
    [kullaniciId, params.id, yukle],
  );

  const degerlendirmeOlustur = useCallback(async () => {
    setHata(null);
    if (!tenantId) return;
    const db = createClient();
    const { error } = await db.from("third_party_assessments").insert({ tenant_id: tenantId, third_party_id: params.id, tur: "DORA" });
    if (error) setHata(error.message);
    await yukle();
  }, [tenantId, params.id, yukle]);

  // Doğrulanmış anket şablonu (M35 sonraki dilim, §8.0 sonu öncelik #3): aktif
  // şablon sorularını bu değerlendirmeye KOPYALAR (assessment_questions'a düz
  // insert) — şablonun kendisi değişmez, kopyalanan soru artık bağımsız kayıt.
  const sablondanKopyala = useCallback(
    async (assessmentId: string, tur: string) => {
      setHata(null);
      if (!tenantId) return;
      const db = createClient();
      const { data: sablonlar, error: selErr } = await db
        .from("assessment_question_templates")
        .select("soru, sira")
        .eq("tenant_id", tenantId)
        .eq("tur", tur)
        .eq("aktif", true)
        .order("sira");
      if (selErr) return setHata(selErr.message);
      if (!sablonlar || sablonlar.length === 0) {
        return setHata(`"${tur}" türü için aktif şablon sorusu yok (Tedarikçiler ana sayfasında ekleyin).`);
      }
      const { error } = await db.from("assessment_questions").insert(
        sablonlar.map((s) => ({ tenant_id: tenantId, assessment_id: assessmentId, soru: s.soru, sira: s.sira })),
      );
      if (error) setHata(error.message);
      await yukle();
    },
    [tenantId, yukle],
  );

  const bulguEkle = useCallback(
    async (assessmentId: string) => {
      setHata(null);
      const baslik = (bBaslik[assessmentId] ?? "").trim();
      if (!baslik || !tenantId) return;
      const db = createClient();
      const { error } = await db.from("assessment_findings").insert({
        tenant_id: tenantId,
        assessment_id: assessmentId,
        third_party_id: params.id,
        baslik,
        ciddiyet: bCiddiyet[assessmentId] ?? "ORTA",
      });
      if (error) setHata(error.message);
      setBBaslik((m) => ({ ...m, [assessmentId]: "" }));
      await yukle();
    },
    [bBaslik, bCiddiyet, tenantId, params.id, yukle],
  );

  const bulguKapat = useCallback(
    async (findingId: string) => {
      setHata(null);
      const kanit = (bKanit[findingId] ?? "").trim();
      if (!kanit || !kullaniciId) return setHata("Kapanış kanıtı zorunlu (kural 14).");
      const db = createClient();
      const { error } = await db
        .from("assessment_findings")
        .update({ durum: "KAPANDI", kapanis_kanit: kanit, kapatan: kullaniciId, kapanis_zamani: new Date().toISOString() })
        .eq("id", findingId);
      if (error) setHata(error.message);
      setBKanit((m) => ({ ...m, [findingId]: "" }));
      await yukle();
    },
    [bKanit, kullaniciId, yukle],
  );

  const degerlendirmeTamamla = useCallback(
    async (assessmentId: string) => {
      setHata(null);
      if (!kullaniciId) return;
      const db = createClient();
      const { error } = await db
        .from("third_party_assessments")
        .update({ durum: "TAMAMLANDI", degerlendiren: kullaniciId })
        .eq("id", assessmentId);
      if (error) setHata(error.message.includes("KRITIK") ? "Açık KRİTİK bulgu varken tamamlanamaz." : error.message);
      await yukle();
    },
    [kullaniciId, yukle],
  );

  const hizmetEkle = useCallback(async () => {
    setHata(null);
    if (!hizmetAd.trim() || !tenantId) return;
    const db = createClient();
    const { error } = await db.from("third_party_services").insert({ tenant_id: tenantId, third_party_id: params.id, hizmet_adi: hizmetAd.trim(), kritik: hizmetKritik });
    if (error) setHata(error.message);
    setHizmetAd("");
    setHizmetKritik(false);
    await yukle();
  }, [hizmetAd, hizmetKritik, tenantId, params.id, yukle]);

  const dtEkle = useCallback(async () => {
    setHata(null);
    if (!tenantId) return;
    if (!dtBilinmiyor && !dtAd.trim()) {
      setHata("Bilinen dördüncü taraf için ad zorunlu (ya da bilinmiyor işaretleyin).");
      return;
    }
    const db = createClient();
    const { error } = await db.from("fourth_parties").insert({ tenant_id: tenantId, third_party_id: params.id, ad: dtBilinmiyor ? null : dtAd.trim(), bilinmiyor: dtBilinmiyor });
    if (error) setHata(error.message);
    setDtAd("");
    setDtBilinmiyor(false);
    await yukle();
  }, [dtAd, dtBilinmiyor, tenantId, params.id, yukle]);

  const szEkle = useCallback(async () => {
    setHata(null);
    if (!szRef.trim() || !szBitis || !tenantId) return;
    const db = createClient();
    const { error } = await db.from("third_party_contracts").insert({ tenant_id: tenantId, third_party_id: params.id, sozlesme_ref: szRef.trim(), baslangic: bugun, bitis: szBitis });
    if (error) setHata(error.message);
    setSzRef("");
    setSzBitis("");
    await yukle();
  }, [szRef, szBitis, tenantId, params.id, bugun, yukle]);

  const cpEkle = useCallback(async () => {
    setHata(null);
    if (!cpOzet.trim() || !tenantId) return;
    const db = createClient();
    // test_edildi=true ise kanıt+tarih DB'de zorunlu; kanıtsız işaretlersek DB reddeder.
    const { error } = await db.from("exit_plans").insert({
      tenant_id: tenantId,
      third_party_id: params.id,
      ozet: cpOzet.trim(),
      test_edildi: cpTest,
      test_tarihi: cpTest ? bugun : null,
      test_kaniti: cpTest ? (cpKanit.trim() || null) : null,
    });
    if (error) {
      setHata(error.message.includes("exit_plans_test_kaniti") ? "Test edildi işaretlendiyse tatbikat kanıtı zorunlu." : error.message);
      return;
    }
    setCpOzet("");
    setCpTest(false);
    setCpKanit("");
    await yukle();
  }, [cpOzet, cpTest, cpKanit, tenantId, params.id, bugun, yukle]);

  const roiUrl = useMemo(() => {
    if (!t) return null;
    const kayit = roiKaydiUret({
      tedarikci: { ad: t.ad, ulke: t.ulke, tier: t.tier as "KRITIK" | "ONEMLI" | "DUSUK", karar: t.karar },
      hizmetler: hizmetler.map((h) => ({ hizmet_adi: h.hizmet_adi, kritik: h.kritik, veri_siniflari: h.veri_siniflari })),
      sozlesmeler: sozlesmeler.map((s) => ({ sozlesme_ref: s.sozlesme_ref, baslangic: s.baslangic, bitis: s.bitis, denetim_hakki: s.denetim_hakki, cikis_maddesi: s.cikis_maddesi })),
      dorduncuTaraflar: dorduncular.map((d) => ({ ad: d.ad, bilinmiyor: d.bilinmiyor, ulke: d.ulke })),
    });
    return URL.createObjectURL(new Blob([JSON.stringify(kayit, null, 2)], { type: "application/json" }));
  }, [t, hizmetler, sozlesmeler, dorduncular]);

  if (!t) return <div className="p-2 text-sm text-muted-foreground">Yükleniyor…</div>;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/tedarikciler" className="text-sm text-muted-foreground hover:underline">
          ← Tedarikçiler
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{t.ad}</h1>
          <StatusBadge durum={TIER[t.tier]?.semantik ?? "neutral"}>{TIER[t.tier]?.etiket ?? t.tier}</StatusBadge>
          <StatusBadge durum={KARAR[t.karar]?.semantik ?? "neutral"}>{KARAR[t.karar]?.etiket ?? t.karar}</StatusBadge>
        </div>
      </div>

      {hata ? (
        <p role="alert" className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {hata}
        </p>
      ) : null}

      {/* Karar (insan) */}
      <Card>
        <CardHeader>
          <CardTitle>Vendor kararı</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <p className="text-muted-foreground">
            Dış rating {t.dis_rating ? `(${t.dis_rating}, ${t.dis_rating_kaynagi ?? "?"})` : "yok"} — salt bilgi; karar
            insana aittir.
          </p>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => void kararVer("ONAYLANDI")} disabled={t.karar === "ONAYLANDI"}>
              Onayla
            </Button>
            <Button size="sm" variant="outline" onClick={() => void kararVer("REDDEDILDI")} disabled={t.karar === "REDDEDILDI"}>
              Reddet
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Hizmetler */}
      <Card>
        <CardHeader>
          <CardTitle>Hizmetler ({hizmetler.length})</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          {hizmetler.map((h) => (
            <div key={h.id} className="flex flex-wrap items-center gap-2">
              <span>{h.hizmet_adi}</span>
              {h.kritik ? <StatusBadge durum="danger">Kritik</StatusBadge> : null}
            </div>
          ))}
          <div className="flex flex-wrap items-end gap-2 border-t pt-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="hz-ad">Hizmet</Label>
              <Input id="hz-ad" value={hizmetAd} onChange={(e) => setHizmetAd(e.target.value)} className="w-56" />
            </div>
            <label className="flex items-center gap-1 text-xs">
              <input type="checkbox" checked={hizmetKritik} onChange={(e) => setHizmetKritik(e.target.checked)} /> Kritik hizmet
            </label>
            <Button size="sm" onClick={() => void hizmetEkle()} disabled={!hizmetAd.trim()}>
              Hizmet Ekle
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Dördüncü taraflar */}
      <Card>
        <CardHeader>
          <CardTitle>Dördüncü taraflar ({dorduncular.length})</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          {dorduncular.map((d) => (
            <div key={d.id} className="flex flex-wrap items-center gap-2">
              {d.bilinmiyor ? <StatusBadge durum="unknown">Bilinmiyor</StatusBadge> : <span>{d.ad}</span>}
            </div>
          ))}
          <div className="flex flex-wrap items-end gap-2 border-t pt-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="dt-ad">Alt yüklenici</Label>
              <Input id="dt-ad" value={dtAd} onChange={(e) => setDtAd(e.target.value)} disabled={dtBilinmiyor} className="w-56" />
            </div>
            <label className="flex items-center gap-1 text-xs">
              <input type="checkbox" checked={dtBilinmiyor} onChange={(e) => setDtBilinmiyor(e.target.checked)} /> Bilinmiyor
            </label>
            <Button size="sm" onClick={() => void dtEkle()}>
              Dördüncü Taraf Ekle
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Sözleşmeler */}
      <Card>
        <CardHeader>
          <CardTitle>Sözleşmeler ({sozlesmeler.length})</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          {sozlesmeler.map((s) => {
            const y = sozlesmeYakinligi(s.bitis, new Date());
            return (
              <div key={s.id} className="flex flex-wrap items-center gap-2">
                <span>{s.sozlesme_ref}</span>
                <StatusBadge durum={s.durum === "SURESI_DOLDU" || y.gecmis ? "danger" : y.yaklasiyor ? "warning" : "success"}>
                  {s.durum === "SURESI_DOLDU" ? "Süresi doldu" : y.mesaj}
                </StatusBadge>
              </div>
            );
          })}
          <div className="flex flex-wrap items-end gap-2 border-t pt-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="sz-ref">Sözleşme ref</Label>
              <Input id="sz-ref" value={szRef} onChange={(e) => setSzRef(e.target.value)} className="w-40" />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="sz-bitis">Bitiş</Label>
              <Input id="sz-bitis" type="date" value={szBitis} onChange={(e) => setSzBitis(e.target.value)} />
            </div>
            <Button size="sm" onClick={() => void szEkle()} disabled={!szRef.trim() || !szBitis}>
              Sözleşme Ekle
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Çıkış planı */}
      <Card>
        <CardHeader>
          <CardTitle>Çıkış planı ({cikis.length})</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          {cikis.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center gap-2">
              <span>{c.ozet}</span>
              <StatusBadge durum={c.test_edildi ? "success" : "warning"}>
                {c.test_edildi ? `Test edildi (${c.test_kaniti})` : "Test edilmedi"}
              </StatusBadge>
            </div>
          ))}
          <div className="flex flex-wrap items-end gap-2 border-t pt-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="cp-ozet">Özet</Label>
              <Input id="cp-ozet" value={cpOzet} onChange={(e) => setCpOzet(e.target.value)} className="w-56" />
            </div>
            <label className="flex items-center gap-1 text-xs">
              <input type="checkbox" checked={cpTest} onChange={(e) => setCpTest(e.target.checked)} /> Test edildi
            </label>
            {cpTest ? (
              <div className="flex flex-col gap-1">
                <Label htmlFor="cp-kanit">Tatbikat kanıtı</Label>
                <Input id="cp-kanit" value={cpKanit} onChange={(e) => setCpKanit(e.target.value)} className="w-48" />
              </div>
            ) : null}
            <Button size="sm" onClick={() => void cpEkle()} disabled={!cpOzet.trim()}>
              Çıkış Planı Ekle
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* RoI export */}
      <Card>
        <CardHeader>
          <CardTitle>DORA Register of Information (iskele)</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <p className="text-muted-foreground">
            MVP iskele — resmî DORA RTS şeması açık karardır; tedarikçi grafından türetilir.
          </p>
          {roiUrl ? (
            <a
              href={roiUrl}
              download={`kalkan-roi-${t.ad}.json`}
              className="inline-flex h-8 w-fit items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              RoI kaydını indir (JSON)
            </a>
          ) : null}
        </CardContent>
      </Card>

      {/* Değerlendirmeler (DORA due-diligence) */}
      <Card>
        <CardHeader>
          <CardTitle>Değerlendirmeler ({degerlendirmeler.length})</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <Button size="sm" variant="outline" className="w-fit" onClick={() => void degerlendirmeOlustur()}>
            Yeni Değerlendirme (DORA)
          </Button>
          {degerlendirmeler.map((a) => {
            const aBulgular = bulgular.filter((b) => b.assessment_id === a.id);
            const ozet = bulguOzeti(aBulgular as unknown as Bulgu[]);
            return (
              <div key={a.id} className="flex flex-col gap-2 rounded-md border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{a.tur}</span>
                  <StatusBadge durum={a.durum === "TAMAMLANDI" ? "success" : a.durum === "DEVAM" ? "legal-review" : "neutral"}>
                    {a.durum}
                  </StatusBadge>
                  {ozet.acikKritikVar ? <StatusBadge durum="danger">Açık KRİTİK bulgu</StatusBadge> : null}
                  {a.durum !== "TAMAMLANDI" ? (
                    <Button size="sm" onClick={() => void degerlendirmeTamamla(a.id)} disabled={!ozet.tamamlanabilir}>
                      Değerlendirmeyi Tamamla
                    </Button>
                  ) : null}
                  {a.durum !== "TAMAMLANDI" ? (
                    <Button size="sm" variant="outline" onClick={() => void sablondanKopyala(a.id, a.tur)}>
                      Şablondan Soru Kopyala
                    </Button>
                  ) : null}
                </div>

                {sorular.filter((s) => s.assessment_id === a.id).length > 0 ? (
                  <div className="flex flex-col gap-1 border-t pt-2 text-xs">
                    <span className="font-medium">Anket soruları</span>
                    {sorular
                      .filter((s) => s.assessment_id === a.id)
                      .map((s) => (
                        <span key={s.id}>• {s.soru}</span>
                      ))}
                  </div>
                ) : null}

                {aBulgular.map((f) => (
                  <div key={f.id} className="flex flex-wrap items-center gap-2 border-t pt-2 text-xs">
                    <span>{f.baslik}</span>
                    <StatusBadge durum={f.ciddiyet === "KRITIK" ? "danger" : f.ciddiyet === "YUKSEK" ? "warning" : "neutral"}>{f.ciddiyet}</StatusBadge>
                    <StatusBadge durum={f.durum === "KAPANDI" ? "success" : "warning"}>{f.durum}</StatusBadge>
                    {f.durum !== "KAPANDI" ? (
                      <>
                        <Input
                          value={bKanit[f.id] ?? ""}
                          onChange={(e) => setBKanit((m) => ({ ...m, [f.id]: e.target.value }))}
                          placeholder="kapanış kanıtı"
                          aria-label={`${f.id} kapanış kanıtı`}
                          className="h-7 w-44 text-xs"
                        />
                        <Button size="sm" variant="outline" onClick={() => void bulguKapat(f.id)}>
                          Kapat
                        </Button>
                      </>
                    ) : null}
                  </div>
                ))}

                {a.durum !== "TAMAMLANDI" ? (
                  <div className="flex flex-wrap items-end gap-2 border-t pt-2">
                    <Input
                      value={bBaslik[a.id] ?? ""}
                      onChange={(e) => setBBaslik((m) => ({ ...m, [a.id]: e.target.value }))}
                      placeholder="Bulgu başlığı"
                      aria-label={`${a.id} bulgu başlık`}
                      className="h-8 w-56 text-xs"
                    />
                    <select
                      value={bCiddiyet[a.id] ?? "ORTA"}
                      onChange={(e) => setBCiddiyet((m) => ({ ...m, [a.id]: e.target.value }))}
                      aria-label={`${a.id} ciddiyet`}
                      className="h-8 rounded-md border bg-background px-2 text-xs"
                    >
                      <option value="DUSUK">Düşük</option>
                      <option value="ORTA">Orta</option>
                      <option value="YUKSEK">Yüksek</option>
                      <option value="KRITIK">Kritik</option>
                    </select>
                    <Button size="sm" variant="outline" onClick={() => void bulguEkle(a.id)} disabled={!(bBaslik[a.id] ?? "").trim()}>
                      Bulgu Ekle
                    </Button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
