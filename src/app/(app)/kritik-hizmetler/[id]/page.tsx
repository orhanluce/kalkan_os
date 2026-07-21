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
import type { KritikHizmetTestPaketi } from "@/lib/kritik-hizmet-test-paketi";

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
interface KontrolBagi {
  id: string;
  control_id: string;
  gerekce: string | null;
  controls: { madde_ref: string; baslik: string } | null;
}
interface KontrolSecenegi {
  id: string;
  ref: string;
}

const TOL_DURUM: Record<string, SemantikDurum> = { TASLAK: "neutral", YURURLUKTE: "success", SUPERSEDED: "neutral" };

// Dikey F, F2: genel durum etiketleri — kurucunun tercih ettiği dil (kesin
// "tamamen dayanıklıdır" iddiası ÜRETİLMEZ).
const GENEL_DURUM_ETIKET: Record<string, { metin: string; durum: SemantikDurum }> = {
  DOGRULANMIS: { metin: "Doğrulanmış güncel test görünümü", durum: "success" },
  INCELEME_GEREKLI: { metin: "İnceleme gerekli", durum: "warning" },
  ENGELLENDI: { metin: "Başarısız test nedeniyle engellendi", durum: "danger" },
  VERI_EKSIK: { metin: "Güncel test bulunamadı", durum: "unknown" },
  TEST_YOK: { metin: "Kapsamda test tanımı yok", durum: "neutral" },
};

interface SnapshotSatiri {
  id: string;
  created_at: string;
  paket_hash: string;
  genel_durum: string | null;
}

// Dikey F, F3: onaylı etki toleransının VARLIĞI — nicel karşılaştırma DEĞİL.
// "RTO/RPO karşılandı" gibi hiçbir hüküm ÜRETİLMEZ (kural 11, ADR §2).
const ETKI_TOLERANSI_ETIKET: Record<string, { metin: string; durum: SemantikDurum }> = {
  TOLERANS_TANIMLI_VE_ONAYLI: { metin: "Onaylı etki toleransı mevcut", durum: "success" },
  TOLERANS_TANIMLI_FAKAT_ONAYSIZ: { metin: "Etki toleransı onay bekliyor", durum: "warning" },
  TOLERANS_BULUNAMADI: { metin: "Etki toleransı tanımlanmamış", durum: "neutral" },
  TOLERANS_VERISI_EKSIK: { metin: "Etki toleransı verisi eksik", durum: "unknown" },
  BIRDEN_FAZLA_AKTIF_TOLERANS: { metin: "Birden fazla yürürlükte tolerans kaydı bulundu", durum: "warning" },
};

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
  const [kontrolBaglari, setKontrolBaglari] = useState<KontrolBagi[]>([]);
  const [kontrolSecenekleri, setKontrolSecenekleri] = useState<KontrolSecenegi[]>([]);
  const [kSecim, setKSecim] = useState("");
  const [kGerekce, setKGerekce] = useState("");

  // Dikey F, F2: Kritik Hizmet Test Paketi.
  const [onizleme, setOnizleme] = useState<KritikHizmetTestPaketi | null>(null);
  const [onizlemeYukleniyor, setOnizlemeYukleniyor] = useState(false);
  const [muhurleniyor, setMuhurleniyor] = useState(false);
  const [snapshotlar, setSnapshotlar] = useState<SnapshotSatiri[]>([]);
  const [proofLinki, setProofLinki] = useState<string | null>(null);

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
    const { data: kb } = await db
      .from("critical_service_controls")
      .select("id, control_id, gerekce, controls (madde_ref, baslik)")
      .eq("critical_service_id", params.id);
    setKontrolBaglari((kb ?? []) as unknown as KontrolBagi[]);
    const { data: ks } = await db.from("controls").select("id, madde_ref").order("madde_ref").limit(100);
    setKontrolSecenekleri((ks ?? []).map((c) => ({ id: c.id, ref: c.madde_ref })));
    const { data: sn } = await db
      .from("kritik_hizmet_test_paketi_snapshots")
      .select("id, created_at, paket_hash, genel_durum:paket->>genelDurum")
      .eq("critical_service_id", params.id)
      .order("created_at", { ascending: false });
    setSnapshotlar((sn ?? []) as unknown as SnapshotSatiri[]);
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

  const kontrolBagla = useCallback(async () => {
    setHata(null);
    if (!kSecim || !tenantId) return;
    const db = createClient();
    const { error } = await db
      .from("critical_service_controls")
      .insert({ tenant_id: tenantId, critical_service_id: params.id, control_id: kSecim, gerekce: kGerekce.trim() || null });
    if (error) setHata(error.message);
    setKSecim("");
    setKGerekce("");
    await yukle();
  }, [kSecim, kGerekce, tenantId, params.id, yukle]);

  const testPaketiOnizle = useCallback(async () => {
    setHata(null);
    setOnizlemeYukleniyor(true);
    const res = await fetch(`/api/kritik-hizmetler/${params.id}/test-paketi`);
    const govde = (await res.json().catch(() => ({}))) as { paket?: KritikHizmetTestPaketi; hata?: string };
    setOnizlemeYukleniyor(false);
    if (!res.ok || !govde.paket) return setHata(govde.hata ?? "Test paketi önizlenemedi.");
    setOnizleme(govde.paket);
  }, [params.id]);

  const testPaketiMuhurle = useCallback(async () => {
    setHata(null);
    setMuhurleniyor(true);
    setProofLinki(null);
    const res = await fetch(`/api/kritik-hizmetler/${params.id}/test-paketi`, { method: "POST" });
    const govde = (await res.json().catch(() => ({}))) as { paket?: KritikHizmetTestPaketi; hata?: string };
    setMuhurleniyor(false);
    if (!res.ok || !govde.paket) return setHata(govde.hata ?? "Test paketi mühürlenemedi.");
    setOnizleme(govde.paket);
    await yukle();
  }, [params.id, yukle]);

  const proofLinkiOlustur = useCallback(async (snapshotId: string) => {
    setHata(null);
    const res = await fetch("/api/proof-room", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eylem: "olustur", kritikHizmetTestPaketiSnapshotId: snapshotId }),
    });
    const govde = (await res.json().catch(() => ({}))) as { url?: string; hata?: string };
    if (!res.ok || !govde.url) return setHata(govde.hata ?? "Proof Room linki oluşturulamadı.");
    setProofLinki(govde.url);
  }, []);

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

      {/* Etki grafiği kenarı: bu hizmeti koruyan kontroller (Dikey 5) */}
      <Card>
        <CardHeader>
          <CardTitle>Koruyan kontroller ({kontrolBaglari.length})</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <p className="text-xs text-muted-foreground">
            Bu kenar M13&apos;ün kritik hizmet grafını genişletir: hangi kontrol bu hizmeti koruyor. &quot;En çok kritik
            hizmet etkileyen kontroller&quot; ve iyileştirme önceliği bu bağdan türetilir (bkz. Dayanıklılık Etki Grafiği).
          </p>
          {kontrolBaglari.map((k) => (
            <div key={k.id} className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs">{k.controls?.madde_ref ?? k.control_id}</span>
              <span>{k.controls?.baslik}</span>
              {k.gerekce ? <span className="text-xs text-muted-foreground">— {k.gerekce}</span> : null}
            </div>
          ))}
          <div className="flex flex-wrap items-end gap-2 border-t pt-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="k-secim">Kontrol</Label>
              <select id="k-secim" value={kSecim} onChange={(e) => setKSecim(e.target.value)} className="h-9 w-56 rounded-md border bg-background px-2 text-sm">
                <option value="">Seçiniz…</option>
                {kontrolSecenekleri.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.ref}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="k-gerekce">Gerekçe (opsiyonel)</Label>
              <Input id="k-gerekce" value={kGerekce} onChange={(e) => setKGerekce(e.target.value)} className="w-56" />
            </div>
            <Button size="sm" onClick={() => void kontrolBagla()} disabled={!kSecim}>
              Kontrol Bağla
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Dikey F, F2: Kritik Hizmet Test Paketi — mühürlü, tek kritik hizmet için M12 zincirinin fotoğrafı. */}
      <Card>
        <CardHeader>
          <CardTitle>Kritik Hizmet Test Paketi</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <p className="text-xs text-muted-foreground">
            Bu hizmete DOĞRUDAN veya bağlı kontroller üzerinden bağlı test tanımlarının en güncel sonucunu tek pakette
            toplar. Yapısal bir özet, kesin bir uyum kararı DEĞİLDİR — tarihsel sonuçlar hiçbir zaman silinmez.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => void testPaketiOnizle()} disabled={onizlemeYukleniyor}>
              {onizlemeYukleniyor ? "Önizleniyor…" : "Test Paketi Önizle"}
            </Button>
            <Button size="sm" onClick={() => void testPaketiMuhurle()} disabled={muhurleniyor}>
              {muhurleniyor ? "Mühürleniyor…" : "Mühürlü Paket Oluştur"}
            </Button>
          </div>

          {onizleme ? (
            <div className="flex flex-col gap-3 border-t pt-3">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge durum={GENEL_DURUM_ETIKET[onizleme.genelDurum]?.durum ?? "unknown"}>
                  {GENEL_DURUM_ETIKET[onizleme.genelDurum]?.metin ?? onizleme.genelDurum}
                </StatusBadge>
                <span className="text-xs text-muted-foreground">
                  {onizleme.kapsam.testTanimiSayisi} test tanımı · {onizleme.kapsam.kontrolSayisi} kontrol ·{" "}
                  {onizleme.kapsam.dogrudanBagliSayisi} doğrudan · {onizleme.kapsam.kontrolUzerindenBagliSayisi} kontrol üzerinden
                </span>
              </div>
              {onizleme.gerekceler.length > 0 ? (
                <ul className="list-inside list-disc text-xs text-muted-foreground">
                  {onizleme.gerekceler.map((g, i) => (
                    <li key={i}>{g}</li>
                  ))}
                </ul>
              ) : null}

              {/* Dikey F, F3: Etki Toleransı — onaylı hedeflerin VARLIĞI, nicel karşılaştırma YOK. */}
              {onizleme.etkiToleransiOzeti ? (
                <div data-testid="etki-toleransi-karti" className="flex flex-col gap-2 rounded-md border border-dashed p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">Etki Toleransı</span>
                    <StatusBadge durum={ETKI_TOLERANSI_ETIKET[onizleme.etkiToleransiOzeti.durum]?.durum ?? "unknown"}>
                      {ETKI_TOLERANSI_ETIKET[onizleme.etkiToleransiOzeti.durum]?.metin ?? onizleme.etkiToleransiOzeti.durum}
                    </StatusBadge>
                  </div>
                  {onizleme.etkiToleransiOzeti.durum === "TOLERANS_TANIMLI_VE_ONAYLI" ||
                  onizleme.etkiToleransiOzeti.durum === "TOLERANS_TANIMLI_FAKAT_ONAYSIZ" ? (
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <dt>Azami kesinti süresi (RTO)</dt>
                      <dd>{onizleme.etkiToleransiOzeti.maxKesintiSaat === null ? "Tanımlanmamış" : `${onizleme.etkiToleransiOzeti.maxKesintiSaat} saat`}</dd>
                      <dt>Azami veri kaybı (RPO)</dt>
                      <dd>{onizleme.etkiToleransiOzeti.maxVeriKaybiSaat === null ? "Tanımlanmamış" : `${onizleme.etkiToleransiOzeti.maxVeriKaybiSaat} saat`}</dd>
                      <dt>Sürüm</dt>
                      <dd>{onizleme.etkiToleransiOzeti.version ?? "—"}</dd>
                      <dt>Onay durumu</dt>
                      <dd>{onizleme.etkiToleransiOzeti.onayDurumu ?? "—"}</dd>
                      <dt>Onay zamanı</dt>
                      <dd>{onizleme.etkiToleransiOzeti.onayZamani ? new Date(onizleme.etkiToleransiOzeti.onayZamani).toLocaleString("tr-TR") : "—"}</dd>
                    </dl>
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    Bu değerler kurumun onaylı hedeflerini gösterir. Test koşularında yapılandırılmış gerçek kesinti ve veri kaybı ölçümü
                    bulunmadığından hedeflerle nicel karşılaştırma yapılmamıştır.
                  </p>
                </div>
              ) : null}

              {onizleme.testler.map((t) => (
                <div key={t.testDefinitionId} data-testid={`test-paketi-satir-${t.testDefinitionId}`} className="flex flex-col gap-1.5 rounded-md border p-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{t.ad}</span>
                    <StatusBadge durum="neutral">
                      {t.bagTuru === "DIRECT" ? "Doğrudan bağlı" : t.bagTuru === "BOTH" ? "Doğrudan + kontrol üzerinden" : "Kontrol üzerinden bağlı"}
                    </StatusBadge>
                  </div>
                  {t.enGuncelKosu ? (
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <StatusBadge durum={t.enGuncelKosu.sonuc === "PASSED" ? "success" : t.enGuncelKosu.sonuc === "FAILED" ? "danger" : "unknown"}>
                        {t.enGuncelKosu.sonuc}
                      </StatusBadge>
                      {t.enGuncelKosu.tazelikDurumu === "BAYAT" ? <StatusBadge durum="warning">Test sonucu süresi dolmuş</StatusBadge> : null}
                      <span className="text-muted-foreground">{new Date(t.enGuncelKosu.calistiAt).toLocaleString("tr-TR")}</span>
                    </div>
                  ) : (
                    <StatusBadge durum="unknown">Güncel test bulunamadı</StatusBadge>
                  )}
                  {t.bulguOzeti.acikBulguIdleri.length > 0 ? (
                    <StatusBadge durum="warning">Açık bulgu mevcut ({t.bulguOzeti.acikBulguIdleri.length})</StatusBadge>
                  ) : null}
                  {t.bulguOzeti.kapanisRetestRunIdleri.length > 0 ? (
                    <StatusBadge durum="success">Kapanış retest&apos;i doğrulandı</StatusBadge>
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    Tarihsel sonuç özeti: {t.tarihselOzet.toplamKosu} koşu (PASSED {t.tarihselOzet.sonucDagilimi.PASSED} · FAILED{" "}
                    {t.tarihselOzet.sonucDagilimi.FAILED} · UNKNOWN {t.tarihselOzet.sonucDagilimi.UNKNOWN} · STALE {t.tarihselOzet.sonucDagilimi.STALE} ·
                    EXCEPTION {t.tarihselOzet.sonucDagilimi.EXCEPTION})
                  </p>
                </div>
              ))}
            </div>
          ) : null}

          {snapshotlar.length > 0 ? (
            <div className="flex flex-col gap-2 border-t pt-3">
              <p className="text-xs font-medium text-muted-foreground">Mühürlenmiş paket geçmişi ({snapshotlar.length})</p>
              {snapshotlar.map((s) => (
                <div key={s.id} data-testid={`test-paketi-snapshot-${s.id}`} className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-muted-foreground">{new Date(s.created_at).toLocaleString("tr-TR")}</span>
                  <StatusBadge durum={GENEL_DURUM_ETIKET[s.genel_durum ?? ""]?.durum ?? "unknown"}>
                    {GENEL_DURUM_ETIKET[s.genel_durum ?? ""]?.metin ?? s.genel_durum ?? "—"}
                  </StatusBadge>
                  <code className="text-muted-foreground" title={s.paket_hash}>
                    {s.paket_hash.slice(0, 16)}…
                  </code>
                  <Button size="sm" variant="outline" onClick={() => void proofLinkiOlustur(s.id)}>
                    Proof Room Linki Oluştur
                  </Button>
                </div>
              ))}
              {proofLinki ? (
                <a href={proofLinki} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">
                  Proof Room linki: {proofLinki}
                </a>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
