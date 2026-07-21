"use client";

import { useCallback, useEffect, useState } from "react";
import { StatusBadge } from "@/components/durum/status-badge";
import { KurtarmaOlcumuBolumu } from "@/components/kurtarma-olcumu-bolumu";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { kontrolGuvenceDurumu, type TestSonuc } from "@/lib/control-test";
import { createClient } from "@/lib/supabase/client";
import { TEST_SONUC_LABEL, TEST_SONUC_SEMANTIK, TEST_TUR_LABEL } from "@/lib/ui-labels";

// Kontrol test motoru UI'ı (docs/ROADMAP.md M12). Motor ve rotalar
// (src/lib/control-test.ts, /api/kontrol-test/*) önceki bir dilimde bitti ve
// canlıda e2e ile doğrulandı; burası onları kullanıcının gerçekten
// göreceği yüzeye bağlıyor.
//
// GÜVENLİK SINIRI: bu bileşen bir yetki kontrolü DEĞİLDİR. Gerçek sınır
// RLS'te (tenant izolasyonu) ve rotalardaki rol kontrolündedir (admin/uyum).
// Burada "Çalıştır" butonunun görünmesi, isteğin sunucuda kabul edileceği
// anlamına gelmez — 403 dönerse hata metninde gösterilir.

const TUR_OPTIONS = Object.keys(TEST_TUR_LABEL);

interface TestTanimi {
  id: string;
  tur: string;
  ad: string;
  aciklama: string | null;
  tazelik_gun: number | null;
  basarisizlik_onem: string;
  otomatik_bulgu: boolean;
  retest_gerekli: boolean;
  // Dikey F, F1: opsiyonel GERÇEK referanslar (serbest metin ile birlikte var).
  critical_service_id: string | null;
  scenario_template_id: string | null;
  kritik_hizmet_adi: string | null;
  senaryo_kimligi: string | null;
}

interface SonTestRun {
  id: string;
  sonuc: string;
  gerekce: string;
  calisti_at: string;
  beklenen_sonuc: string | null;
  performans_etkisi: string | null;
  ledgerDurum?: string;
}

interface OneriSatiri {
  id: string;
  test_definition_id: string;
  baslik: string;
  gerekce: string;
  onem: string;
}

// Dikey F, F1: kritik hizmet/senaryo GERÇEK referansı (opsiyonel) + bulgu/
// retest zinciri görünürlüğü.
interface KritikHizmetSatiri {
  id: string;
  ad: string;
}
interface SenaryoSatiri {
  id: string;
  kod: string;
  ad: string;
}
interface AcikBulguSatiri {
  id: string;
  baslik: string;
}
interface BulguZinciri {
  id: string;
  baslik: string;
  durum: string;
  aksiyon_plani: string | null;
  kapatan_ad: string | null;
  kapatma_retest_run_id: string | null;
  kapatma_retest_sonuc: string | null;
}

/** Kullanıcının seçtiği gözlem sonucu — motora gönderilecek sinyale çevrilir. */
type GozlemSecimi = "gecti" | "kaldi" | "olcemedim" | "istisna";

const GOZLEM_LABEL: Record<GozlemSecimi, string> = {
  gecti: "İddia karşılandı",
  kaldi: "İddia karşılanmadı",
  olcemedim: "Ölçülemedi (toplama/connector arızası)",
  istisna: "İstisna — yönetimce kabul edilmiş boşluk",
};

export function KontrolTestBolumu({
  controlId,
  onGuvenceDurumu,
}: {
  controlId: string;
  /**
   * Kontrolün türetilmiş test güvence durumu (kontrolGuvenceDurumu — en kötü
   * kazanır, birleştirme yok; kural 13). Kanıt izi rayı (EvidenceTraceRail)
   * için sayfaya raporlanır — sayfa AYNI veriyi ikinci kez sorgulamasın.
   * DİKKAT: stabil bir referans geçin (setState gibi) — inline arrow her
   * render'da yeni kimlik üretir ve yükleme döngüsü tetikler.
   */
  onGuvenceDurumu?: (durum: string) => void;
}) {
  const { currentUser } = useAuth();

  const [tanimlar, setTanimlar] = useState<TestTanimi[]>([]);
  const [sonRunlar, setSonRunlar] = useState<Record<string, SonTestRun>>({});
  const [oneriler, setOneriler] = useState<OneriSatiri[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState<string | null>(null);
  const [islemSuruyor, setIslemSuruyor] = useState(false);

  const [formAcik, setFormAcik] = useState(false);
  const [yeniAd, setYeniAd] = useState("");
  const [yeniTur, setYeniTur] = useState<string>("MANUAL_PROCEDURE");
  const [yeniTazelik, setYeniTazelik] = useState("90");
  const [yeniOnem, setYeniOnem] = useState("yuksek");
  const [yeniOtomatikBulgu, setYeniOtomatikBulgu] = useState(true);
  const [yeniRetestGerekli, setYeniRetestGerekli] = useState(true);
  // Dikey 2 (v3.3): tanım sabit kapsam alanları.
  const [yeniAmac, setYeniAmac] = useState("");
  const [yeniKapsam, setYeniKapsam] = useState("");
  const [yeniHedefVarlik, setYeniHedefVarlik] = useState("");
  const [yeniKritikHizmet, setYeniKritikHizmet] = useState("");
  const [yeniSenaryoKimligi, setYeniSenaryoKimligi] = useState("");
  // Dikey F, F1: opsiyonel GERÇEK referans seçimi — serbest metnin YANINDA,
  // yerine değil (kural: eski kayıt "doğrulanmış ilişki" gibi gösterilmez).
  const [kritikHizmetler, setKritikHizmetler] = useState<KritikHizmetSatiri[]>([]);
  const [senaryolar, setSenaryolar] = useState<SenaryoSatiri[]>([]);
  const [yeniKritikHizmetId, setYeniKritikHizmetId] = useState<string>("");
  const [yeniSenaryoTemplateId, setYeniSenaryoTemplateId] = useState<string>("");
  // Bu tanıma bağlı, retest gerektiren AÇIK bulgular — koşuyu retest niyetiyle
  // işaretlemek için (test_runs.retest_of_finding_id, API'de tenant/durum
  // doğrulanır — burada gösterilen liste yalnızca kullanıcı kolaylığı).
  const [acikBulgular, setAcikBulgular] = useState<Record<string, AcikBulguSatiri[]>>({});
  const [retestNiyeti, setRetestNiyeti] = useState<Record<string, string>>({});
  const [bulguZincirleri, setBulguZincirleri] = useState<Record<string, BulguZinciri[]>>({});

  const [gozlemSecimleri, setGozlemSecimleri] = useState<Record<string, GozlemSecimi>>({});
  const [toplamaHatasi, setToplamaHatasi] = useState<Record<string, string>>({});
  // Dikey 2 (v3.3): koşu-anı gözlem alanları (opsiyonel).
  const [beklenen, setBeklenen] = useState<Record<string, string>>({});
  const [performans, setPerformans] = useState<Record<string, string>>({});

  const yukle = useCallback(async () => {
    const db = createClient();
    const { data: t } = await db
      .from("control_test_definitions")
      .select(
        "id, tur, ad, aciklama, tazelik_gun, basarisizlik_onem, otomatik_bulgu, retest_gerekli, critical_service_id, scenario_template_id, kritik_hizmet_adi, senaryo_kimligi",
      )
      .eq("control_id", controlId)
      .order("created_at", { ascending: true });
    setTanimlar(t ?? []);

    // Seçici listeleri — kritik hizmet kiracıya özgü (AKTIF), senaryo global
    // katalog. Form her zaman görünür olduğundan tanım sayısından bağımsız
    // yükleniyor.
    const [{ data: khList }, { data: senList }] = await Promise.all([
      db.from("critical_business_services").select("id, ad").eq("durum", "AKTIF").order("ad", { ascending: true }),
      db.from("scenario_templates").select("id, kod, ad").order("kod", { ascending: true }),
    ]);
    setKritikHizmetler(khList ?? []);
    setSenaryolar(senList ?? []);

    if (t && t.length > 0) {
      const { data: runs } = await db
        .from("test_runs")
        .select("id, test_definition_id, sonuc, gerekce, calisti_at, beklenen_sonuc, performans_etkisi")
        .in(
          "test_definition_id",
          t.map((x) => x.id),
        )
        .order("calisti_at", { ascending: false });

      // İlk (en yeni) koşu her tanım için kazanır — sıra sorgudan geliyor.
      const map: Record<string, SonTestRun> = {};
      for (const r of runs ?? []) {
        if (!map[r.test_definition_id]) {
          map[r.test_definition_id] = {
            id: r.id,
            sonuc: r.sonuc,
            gerekce: r.gerekce,
            calisti_at: r.calisti_at,
            beklenen_sonuc: r.beklenen_sonuc,
            performans_etkisi: r.performans_etkisi,
          };
        }
      }
      // En yeni koşuların defter mühür durumu (§8.0 Dikey 2: her koşu manifest+
      // receipt taşır; §1.37/§1.42 ile OTOMATİK mühür).
      await Promise.all(
        Object.values(map).map(async (r) => {
          const { data: d } = await db.rpc("artifact_ledger_durumu", { p_artifact_table: "test_runs", p_artifact_id: r.id });
          r.ledgerDurum = (d as string | null) ?? "KAYITSIZ";
        }),
      );
      setSonRunlar(map);
      // Türetilmiş güvence: MOTORUN önceliğiyle (en kötü kazanır) — burada
      // yeniden icat edilmez, kontrolGuvenceDurumu kullanılır.
      onGuvenceDurumu?.(kontrolGuvenceDurumu(Object.values(map).map((r) => r.sonuc as TestSonuc)));

      const { data: props } = await db
        .from("control_test_finding_proposals")
        .select("id, test_definition_id, baslik, gerekce, onem")
        .eq("control_id", controlId)
        .eq("durum", "PROPOSED");
      setOneriler(props ?? []);

      // Dikey F, F1: bulgu/retest zinciri — "ilk test sonucu → kabul edilmiş
      // bulgu → düzeltici faaliyet varsa → kapanış retest'i → bağımsız
      // kapatan" (manifest DEĞİŞMEZ; bu tamamen İLİŞKİSEL bir görünüm).
      const { data: kabulEdilmisler } = await db
        .from("control_test_finding_proposals")
        .select("test_definition_id, finding_id")
        .eq("control_id", controlId)
        .eq("durum", "KABUL")
        .not("finding_id", "is", null);

      const zincirMap: Record<string, BulguZinciri[]> = {};
      const acikMap: Record<string, AcikBulguSatiri[]> = {};
      if (kabulEdilmisler && kabulEdilmisler.length > 0) {
        const findingIds = kabulEdilmisler.map((k) => k.finding_id as string);
        const { data: bulgular } = await db
          .from("findings")
          .select("id, baslik, durum, aksiyon_plani, kapatan, kapatma_retest_run_id, kaynak_test_definition_id")
          .in("id", findingIds);

        const kapatanIds = (bulgular ?? []).map((b) => b.kapatan).filter((x): x is string => !!x);
        const retestRunIds = (bulgular ?? [])
          .map((b) => b.kapatma_retest_run_id)
          .filter((x): x is string => !!x);
        const [{ data: kapatanlar }, { data: retestRunlar }] = await Promise.all([
          kapatanIds.length > 0
            ? db.from("profiles").select("id, full_name").in("id", kapatanIds)
            : Promise.resolve({ data: [] as { id: string; full_name: string | null }[] }),
          retestRunIds.length > 0
            ? db.from("test_runs").select("id, sonuc").in("id", retestRunIds)
            : Promise.resolve({ data: [] as { id: string; sonuc: string }[] }),
        ]);

        for (const k of kabulEdilmisler) {
          const b = (bulgular ?? []).find((x) => x.id === k.finding_id);
          if (!b) continue;
          const kapatan = kapatanlar?.find((p) => p.id === b.kapatan);
          const retestRun = retestRunlar?.find((r) => r.id === b.kapatma_retest_run_id);
          const satir: BulguZinciri = {
            id: b.id,
            baslik: b.baslik,
            durum: b.durum,
            aksiyon_plani: b.aksiyon_plani,
            kapatan_ad: kapatan?.full_name ?? (b.kapatan ? "(isim yok)" : null),
            kapatma_retest_run_id: b.kapatma_retest_run_id,
            kapatma_retest_sonuc: retestRun?.sonuc ?? null,
          };
          (zincirMap[k.test_definition_id] ??= []).push(satir);
        }
      }
      // Açık, retest gerektiren bulgular — koşuyu retest niyetiyle işaretlemek
      // için seçenek listesi (API'de yeniden doğrulanır, burası kolaylık).
      const { data: acikRetestBulgular } = await db
        .from("findings")
        .select("id, baslik, kaynak_test_definition_id")
        .eq("durum", "acik")
        .eq("retest_gerekli", true)
        .not("kaynak_test_definition_id", "is", null);
      for (const b of acikRetestBulgular ?? []) {
        if (!b.kaynak_test_definition_id) continue;
        (acikMap[b.kaynak_test_definition_id] ??= []).push({ id: b.id, baslik: b.baslik });
      }
      setBulguZincirleri(zincirMap);
      setAcikBulgular(acikMap);
    } else {
      setSonRunlar({});
      setOneriler([]);
      setBulguZincirleri({});
      setAcikBulgular({});
      onGuvenceDurumu?.(kontrolGuvenceDurumu([]));
    }
    setYukleniyor(false);
  }, [controlId, onGuvenceDurumu]);

  useEffect(() => {
    const calistir = async () => {
      await yukle();
    };
    void calistir();
  }, [yukle]);

  async function testCalistir(tanimId: string) {
    setIslemSuruyor(true);
    setHata(null);
    const secim = gozlemSecimleri[tanimId] ?? "gecti";

    const now = new Date().toISOString();
    const govde: Record<string, unknown> = {
      gozlemZamani: now,
      baslangicAt: now,
      bitisAt: now,
      beklenenSonuc: beklenen[tanimId]?.trim() || null,
      performansEtkisi: performans[tanimId]?.trim() || null,
      retestOfFindingId: retestNiyeti[tanimId] || null,
    };
    if (secim === "gecti") govde.iddiaKarsilandi = true;
    else if (secim === "kaldi") govde.iddiaKarsilandi = false;
    else if (secim === "olcemedim") {
      govde.toplamaBasarisiz = true;
      govde.toplamaHatasi = toplamaHatasi[tanimId] || null;
    } else if (secim === "istisna") govde.istisnaKabul = true;

    const res = await fetch(`/api/kontrol-test/${tanimId}/calistir`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(govde),
    });
    const body = await res.json();
    if (!res.ok) setHata(body.hata ?? "Test çalıştırılamadı.");
    await yukle();
    setIslemSuruyor(false);
  }

  async function oneriyeKararVer(oneriId: string, karar: "KABUL" | "RET") {
    setIslemSuruyor(true);
    setHata(null);
    const res = await fetch(`/api/kontrol-test/oneri/${oneriId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ karar }),
    });
    const body = await res.json();
    if (!res.ok) setHata(body.hata ?? "Karar uygulanamadı.");
    await yukle();
    setIslemSuruyor(false);
  }

  async function yeniTanimEkle(e: React.FormEvent) {
    e.preventDefault();
    if (!yeniAd.trim() || !currentUser) return;
    setIslemSuruyor(true);
    setHata(null);
    const db = createClient();
    const { error } = await db.from("control_test_definitions").insert({
      tenant_id: currentUser.tenantId,
      control_id: controlId,
      tur: yeniTur,
      ad: yeniAd.trim(),
      tazelik_gun: yeniTazelik ? Number(yeniTazelik) : null,
      basarisizlik_onem: yeniOnem,
      otomatik_bulgu: yeniOtomatikBulgu,
      retest_gerekli: yeniRetestGerekli,
      // Dikey 2 (v3.3): sabit test kapsamı (manifeste girer).
      amac: yeniAmac.trim() || null,
      kapsam: yeniKapsam.trim() || null,
      hedef_varlik: yeniHedefVarlik.trim() || null,
      kritik_hizmet_adi: yeniKritikHizmet.trim() || null,
      senaryo_kimligi: yeniSenaryoKimligi.trim() || null,
      // Dikey F, F1: opsiyonel GERÇEK referans — serbest metnin yerine değil,
      // yanında. Boş seçim null kalır (uydurulmuş bağ yok).
      critical_service_id: yeniKritikHizmetId || null,
      scenario_template_id: yeniSenaryoTemplateId || null,
    });
    if (error) {
      setHata(error.message);
    } else {
      setYeniAd("");
      setYeniAmac("");
      setYeniKapsam("");
      setYeniHedefVarlik("");
      setYeniKritikHizmet("");
      setYeniSenaryoKimligi("");
      setYeniKritikHizmetId("");
      setYeniSenaryoTemplateId("");
      setFormAcik(false);
      await yukle();
    }
    setIslemSuruyor(false);
  }

  if (yukleniyor) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Kontrol Testleri</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Yükleniyor…</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kontrol Testleri</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <p className="text-xs text-muted-foreground">
          Bir kontrolün tasarlandığını değil, gerçekten çalıştığını gösterir. Sonuç beş ayrı
          durumdan biridir ve birleştirilmez: toplama/connector arızası asla &ldquo;Kaldı&rdquo;
          üretmez, &ldquo;Bilinmiyor&rdquo; üretir.
        </p>

        {hata && <p className="text-sm text-destructive">{hata}</p>}

        {tanimlar.length === 0 ? (
          <p className="text-sm text-muted-foreground">Bu kontrole henüz test tanımlanmadı.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {tanimlar.map((tanim) => {
              const sonRun = sonRunlar[tanim.id];
              const secim = gozlemSecimleri[tanim.id] ?? "gecti";
              // Bu tanıma ait açık öneri: test_definition_id ile eşleştirilir
              // (control_test_finding_proposals'ın kendi kolonu — kırılgan bir
              // metin karşılaştırması değil).
              const tanimOnerisi = oneriler.find((o) => o.test_definition_id === tanim.id);
              const zincir = bulguZincirleri[tanim.id] ?? [];
              const acikBulgularBu = acikBulgular[tanim.id] ?? [];

              return (
                <li key={tanim.id} className="rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{tanim.ad}</p>
                      <p className="text-xs text-muted-foreground">
                        {TEST_TUR_LABEL[tanim.tur] ?? tanim.tur}
                        {tanim.tazelik_gun && ` · tazelik ${tanim.tazelik_gun} gün`}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {tanim.critical_service_id ? (
                          <StatusBadge durum="info">Kritik hizmete bağlı</StatusBadge>
                        ) : tanim.kritik_hizmet_adi ? (
                          <StatusBadge durum="warning">Serbest metin kapsamı: {tanim.kritik_hizmet_adi}</StatusBadge>
                        ) : null}
                        {tanim.scenario_template_id ? (
                          <StatusBadge durum="info">Senaryo şablonuna bağlı</StatusBadge>
                        ) : tanim.senaryo_kimligi ? (
                          <StatusBadge durum="warning">Doğrulanmamış senaryo kimliği: {tanim.senaryo_kimligi}</StatusBadge>
                        ) : null}
                      </div>
                    </div>
                    {sonRun && (
                      <StatusBadge durum={TEST_SONUC_SEMANTIK[sonRun.sonuc] ?? "unknown"}>
                        {TEST_SONUC_LABEL[sonRun.sonuc] ?? sonRun.sonuc}
                      </StatusBadge>
                    )}
                  </div>

                  {sonRun && (
                    <div className="mt-2 flex flex-col gap-1">
                      <p className="text-xs text-muted-foreground">
                        {sonRun.gerekce} — {new Date(sonRun.calisti_at).toLocaleString("tr-TR")}
                      </p>
                      {sonRun.beklenen_sonuc ? (
                        <p className="text-xs text-muted-foreground">Beklenen: {sonRun.beklenen_sonuc}</p>
                      ) : null}
                      {sonRun.ledgerDurum ? (
                        <StatusBadge durum={sonRun.ledgerDurum === "ANCHORED" ? "success" : sonRun.ledgerDurum === "FAILED" ? "danger" : "warning"}>
                          {sonRun.ledgerDurum === "ANCHORED"
                            ? "Manifest deftere mühürlü"
                            : sonRun.ledgerDurum === "FAILED"
                              ? "Mühürleme başarısız"
                              : "Mühür bekleniyor"}
                        </StatusBadge>
                      ) : null}
                    </div>
                  )}

                  {/* Dikey F, F4: kurtarma ölçümü yakalama (koşuya bağlı; karşılaştırma YOK). */}
                  {sonRun && <KurtarmaOlcumuBolumu testRunId={sonRun.id} />}

                  {tanimOnerisi && (
                    <div className="mt-3 rounded-md border border-amber-400/40 bg-amber-400/10 p-2">
                      <p className="text-xs font-medium">Bulgu önerisi: {tanimOnerisi.baslik}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{tanimOnerisi.gerekce}</p>
                      <div className="mt-2 flex gap-2">
                        <Button
                          size="sm"
                          disabled={islemSuruyor}
                          onClick={() => oneriyeKararVer(tanimOnerisi.id, "KABUL")}
                        >
                          Kabul Et (bulgu oluştur)
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={islemSuruyor}
                          onClick={() => oneriyeKararVer(tanimOnerisi.id, "RET")}
                        >
                          Reddet
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Dikey F, F1: bulgu/retest zinciri — manifest DEĞİŞMEZ, bu
                      tamamen ilişkisel bir görünüm (test_run → öneri → kabul
                      edilmiş bulgu → düzeltici faaliyet → kapanış retest'i →
                      bağımsız kapatan). Kapanmış bulgu geçmişten SİLİNMEZ. */}
                  {zincir.length > 0 && (
                    <div className="mt-3 flex flex-col gap-2 rounded-md border p-2">
                      <p className="text-xs font-medium">Bulgu ve retest zinciri</p>
                      {zincir.map((b) => (
                        <div key={b.id} className="flex flex-col gap-1 border-t pt-2 first:border-t-0 first:pt-0">
                          <div className="flex items-center gap-2">
                            <StatusBadge durum={b.durum === "kapali" ? "success" : "warning"}>
                              {b.durum === "kapali" ? "Kapandı" : "Açık — kabul edilmiş bulgu"}
                            </StatusBadge>
                            <p className="text-xs">{b.baslik}</p>
                          </div>
                          {b.aksiyon_plani && (
                            <p className="text-xs text-muted-foreground">Düzeltici faaliyet: {b.aksiyon_plani}</p>
                          )}
                          {b.kapatma_retest_run_id ? (
                            <p className="text-xs text-muted-foreground">
                              Kapanış retest&apos;i: {b.kapatma_retest_sonuc ?? "?"}
                              {b.kapatan_ad ? ` · bağımsız kapatan: ${b.kapatan_ad}` : ""}
                            </p>
                          ) : b.durum === "acik" ? (
                            <p className="text-xs text-muted-foreground">Kapanış retest&apos;i henüz yok.</p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-3 flex flex-wrap items-end gap-2">
                    {acikBulgularBu.length > 0 && (
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor={`retest-${tanim.id}`}>Bu koşu bir retest ise, hangi bulguyu kapatmak için (opsiyonel)</Label>
                        <Select
                          items={Object.fromEntries([["", "— (retest değil)"], ...acikBulgularBu.map((b) => [b.id, b.baslik])])}
                          value={retestNiyeti[tanim.id] ?? ""}
                          onValueChange={(v) => setRetestNiyeti((s) => ({ ...s, [tanim.id]: v ?? "" }))}
                        >
                          <SelectTrigger id={`retest-${tanim.id}`} className="w-64">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">— (retest değil)</SelectItem>
                            {acikBulgularBu.map((b) => (
                              <SelectItem key={b.id} value={b.id}>
                                {b.baslik}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor={`gozlem-${tanim.id}`}>Gözlem</Label>
                      <Select
                        items={GOZLEM_LABEL}
                        value={secim}
                        onValueChange={(v) =>
                          setGozlemSecimleri((s) => ({ ...s, [tanim.id]: v as GozlemSecimi }))
                        }
                      >
                        <SelectTrigger id={`gozlem-${tanim.id}`} className="w-64">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(GOZLEM_LABEL) as GozlemSecimi[]).map((k) => (
                            <SelectItem key={k} value={k}>
                              {GOZLEM_LABEL[k]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {secim === "olcemedim" && (
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor={`hata-${tanim.id}`}>Arıza açıklaması (opsiyonel)</Label>
                        <Input
                          id={`hata-${tanim.id}`}
                          value={toplamaHatasi[tanim.id] ?? ""}
                          onChange={(e) =>
                            setToplamaHatasi((s) => ({ ...s, [tanim.id]: e.target.value }))
                          }
                          placeholder="ör. connector timeout"
                          className="w-56"
                        />
                      </div>
                    )}
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor={`beklenen-${tanim.id}`}>Beklenen sonuç (opsiyonel)</Label>
                      <Input
                        id={`beklenen-${tanim.id}`}
                        value={beklenen[tanim.id] ?? ""}
                        onChange={(e) => setBeklenen((s) => ({ ...s, [tanim.id]: e.target.value }))}
                        placeholder="ör. tüm hesaplar MFA'lı"
                        className="w-48"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor={`perf-${tanim.id}`}>Performans etkisi (opsiyonel)</Label>
                      <Input
                        id={`perf-${tanim.id}`}
                        value={performans[tanim.id] ?? ""}
                        onChange={(e) => setPerformans((s) => ({ ...s, [tanim.id]: e.target.value }))}
                        placeholder="ör. yok / <%1 gecikme"
                        className="w-44"
                      />
                    </div>
                    <Button size="sm" disabled={islemSuruyor} onClick={() => testCalistir(tanim.id)}>
                      Çalıştır
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {!formAcik ? (
          <Button variant="outline" size="sm" className="w-fit" onClick={() => setFormAcik(true)}>
            + Yeni test tanımı
          </Button>
        ) : (
          <form onSubmit={yeniTanimEkle} className="flex flex-col gap-3 rounded-lg border p-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="yeni-ad">Test adı</Label>
              <Textarea
                id="yeni-ad"
                value={yeniAd}
                onChange={(e) => setYeniAd(e.target.value)}
                placeholder="ör. MFA tüm ayrıcalıklı hesaplarda zorunlu"
                required
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="yeni-tur">Test türü</Label>
                <Select
                  items={TEST_TUR_LABEL}
                  value={yeniTur}
                  onValueChange={(v) => setYeniTur(v ?? "MANUAL_PROCEDURE")}
                >
                  <SelectTrigger id="yeni-tur">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TUR_OPTIONS.map((t) => (
                      <SelectItem key={t} value={t}>
                        {TEST_TUR_LABEL[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="yeni-tazelik">Tazelik penceresi (gün)</Label>
                <Input
                  id="yeni-tazelik"
                  type="number"
                  min={1}
                  value={yeniTazelik}
                  onChange={(e) => setYeniTazelik(e.target.value)}
                  placeholder="boş = tazelik şartı yok"
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="yeni-amac">Amaç (opsiyonel)</Label>
                <Input id="yeni-amac" value={yeniAmac} onChange={(e) => setYeniAmac(e.target.value)} placeholder="testin amacı" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="yeni-kapsam">Kapsam (opsiyonel)</Label>
                <Input id="yeni-kapsam" value={yeniKapsam} onChange={(e) => setYeniKapsam(e.target.value)} placeholder="ör. tüm ayrıcalıklı hesaplar" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="yeni-hedef">Hedef varlık (opsiyonel)</Label>
                <Input id="yeni-hedef" value={yeniHedefVarlik} onChange={(e) => setYeniHedefVarlik(e.target.value)} placeholder="ör. Entra ID" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="yeni-kritik">Serbest metin kapsamı (opsiyonel)</Label>
                <Input id="yeni-kritik" value={yeniKritikHizmet} onChange={(e) => setYeniKritikHizmet(e.target.value)} placeholder="ör. Ödeme sistemi" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="yeni-senaryo">Doğrulanmamış senaryo kimliği (opsiyonel)</Label>
                <Input id="yeni-senaryo" value={yeniSenaryoKimligi} onChange={(e) => setYeniSenaryoKimligi(e.target.value)} placeholder="ör. TATBIKAT-MFA-01" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="yeni-kritik-id">Kritik hizmete bağlı (opsiyonel)</Label>
                <Select
                  items={Object.fromEntries([["", "— (bağlama)"], ...kritikHizmetler.map((k) => [k.id, k.ad])])}
                  value={yeniKritikHizmetId}
                  onValueChange={(v) => setYeniKritikHizmetId(v ?? "")}
                >
                  <SelectTrigger id="yeni-kritik-id">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">— (bağlama)</SelectItem>
                    {kritikHizmetler.map((k) => (
                      <SelectItem key={k.id} value={k.id}>
                        {k.ad}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="yeni-senaryo-id">Senaryo şablonuna bağlı (opsiyonel)</Label>
                <Select
                  items={Object.fromEntries([["", "— (bağlama)"], ...senaryolar.map((s) => [s.id, `${s.kod} — ${s.ad}`])])}
                  value={yeniSenaryoTemplateId}
                  onValueChange={(v) => setYeniSenaryoTemplateId(v ?? "")}
                >
                  <SelectTrigger id="yeni-senaryo-id">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">— (bağlama)</SelectItem>
                    {senaryolar.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.kod} — {s.ad}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Bir kayıt seçilirse görünen ad serbest metin alanına otomatik önerilebilir, ama tek
              doğruluk kaynağı olarak GERÇEK referans (yukarıdaki seçici) sayılır — serbest metin
              yalnızca eski kayıtlarda veya henüz kataloglanmamış kapsamlarda &ldquo;doğrulanmamış&rdquo;
              olarak kalır.
            </p>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="yeni-onem">Başarısızlık önemi (bulgu üretilirse)</Label>
              <Select
                items={{ acil: "Acil", kritik: "Kritik", yuksek: "Yüksek", orta: "Orta", dusuk: "Düşük" }}
                value={yeniOnem}
                onValueChange={(v) => setYeniOnem(v ?? "yuksek")}
              >
                <SelectTrigger id="yeni-onem">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="acil">Acil</SelectItem>
                  <SelectItem value="kritik">Kritik</SelectItem>
                  <SelectItem value="yuksek">Yüksek</SelectItem>
                  <SelectItem value="orta">Orta</SelectItem>
                  <SelectItem value="dusuk">Düşük</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={yeniOtomatikBulgu}
                onChange={(e) => setYeniOtomatikBulgu(e.target.checked)}
              />
              Başarısız olursa otomatik bulgu önerisi üret
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={yeniRetestGerekli}
                onChange={(e) => setYeniRetestGerekli(e.target.checked)}
              />
              Doğan bulgunun kapanması başarılı retest ister (kural 14)
            </label>
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={islemSuruyor}>
                Ekle
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setFormAcik(false)}>
                Vazgeç
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
