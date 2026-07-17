"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/empty-state";
import { useAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";
import { KATILIM_TIPI_LABEL, ONEM_BADGE_VARIANT, ONEM_LABEL, PUANLAMA_DURUM_LABEL, SIMULASYON_DURUM_LABEL } from "@/lib/ui-labels";

// Tatbikat çalışma ekranı (docs/ROADMAP.md M8, kalan iş).
//
// TEK SAYFA, ROL-BAZLI BÖLÜMLER: ayrı control-room/katılımcı/gözlemci
// sayfaları yerine, aynı sayfa üzerinde `benimKatilimTipi`ye göre koşullu
// bölümler render edilir. Pilot ölçeğinde (CLAUDE.md: 5-15 kullanıcı) üç
// ayrı sayfa inşa etmek, aynı veriyi üç kere çekmek ve senkronize tutmak
// anlamına gelirdi — burası daha basit ve doğru.
//
// GÜVENLİK SINIRI: bu sayfanın kendisi bir yetki kontrolü DEĞİLDİR.
// Gerçek sınır RLS'tedir (simulation_inject_deliveries_rol_bazli vb.) —
// katılımcı SORGUYLA DA başka rolün gizli gelişmesini göremez. Bu yüzden
// PARTICIPANT görünümü scenario_injects'i DOĞRUDAN sorgulamaz, yalnızca
// simulation_inject_deliveries'i (RLS filtreli) okur. scenario_injects'in
// TAMAMINI yalnızca YÖNETİCİ paneli okur (sıradaki gelişmeyi seçmek için) —
// bu tablo zaten herkese açık okunur (kütüphane), ama UI disiplini olarak
// yalnızca yöneticiye gösterilir.

interface Run {
  id: string;
  ad: string;
  mod: string;
  durum: string;
  zaman_olcegi: number;
  basladi_at: string | null;
  bitti_at: string | null;
  duraklatildi_at: string | null;
  duraklatilan_saniye: number;
  version_id: string;
}

interface Katilimci {
  user_id: string;
  senaryo_rolu: string;
  katilim_tipi: "yonetici" | "katilimci" | "gozlemci";
  full_name: string;
}

interface TeslimEdilenGelisme {
  inject_id: string;
  yayinlandi_at: string;
  sira: number;
  t_dakika: number;
  baslik: string;
  icerik: string;
  beklenen_davranis: string | null;
}

interface SablonGelisme {
  id: string;
  sira: number;
  t_dakika: number;
  baslik: string;
  gorunur_roller: string[];
}

interface KararNoktasi {
  id: string;
  inject_id: string | null;
  kod: string;
  soru: string;
  tip: string;
  secenekler: string[] | null;
}

interface Karar {
  decision_point_id: string;
  katilimci_id: string;
  cevap: string | null;
  created_at: string;
}

interface BeklenenAksiyon {
  id: string;
  kod: string;
  aciklama: string;
  hedef_dakika: number | null;
}

interface AksiyonSonucu {
  expected_action_id: string;
  tamamlandi: boolean;
  senaryo_dakika: number | null;
}

interface PuanSatiri {
  kod: string;
  bilesen: string;
  sonuc: string;
  puan: number;
  agirlik: number;
  gerekce: string;
}

interface PuanSonucu {
  puan: number;
  durum: string;
  satirlar: PuanSatiri[];
  kritik_basarisizliklar: string[];
}

interface OneriSatiri {
  id: string;
  baslik: string;
  gerekce: string;
  onem: string;
  durum: string;
  control_id: string | null;
}

/** Tatbikatın senaryo zamanını (dakika) fiili geçen süreden türetir. */
function senaryoDakikasiHesapla(run: Run): number {
  if (!run.basladi_at) return 0;
  const gecenSaniye =
    (Date.now() - new Date(run.basladi_at).getTime()) / 1000 - run.duraklatilan_saniye;
  return Math.max(0, Math.round((gecenSaniye / 60) * run.zaman_olcegi));
}

export default function TatbikatDetayPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { currentUser } = useAuth();

  const [run, setRun] = useState<Run | null>(null);
  const [sablon, setSablon] = useState<{ kod: string; ad: string; surum: number } | null>(null);
  const [katilimcilar, setKatilimcilar] = useState<Katilimci[]>([]);
  const [teslimEdilenler, setTeslimEdilenler] = useState<TeslimEdilenGelisme[]>([]);
  const [tumGelismeler, setTumGelismeler] = useState<SablonGelisme[]>([]);
  const [kararNoktalari, setKararNoktalari] = useState<KararNoktasi[]>([]);
  const [kararlar, setKararlar] = useState<Karar[]>([]);
  const [beklenenAksiyonlar, setBeklenenAksiyonlar] = useState<BeklenenAksiyon[]>([]);
  const [aksiyonSonuclari, setAksiyonSonuclari] = useState<AksiyonSonucu[]>([]);
  const [puan, setPuan] = useState<PuanSonucu | null>(null);
  const [oneriler, setOneriler] = useState<OneriSatiri[]>([]);
  const [tenantProfilleri, setTenantProfilleri] = useState<{ id: string; full_name: string }[]>([]);

  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState<string | null>(null);
  const [islemSuruyor, setIslemSuruyor] = useState(false);

  const benimKatilimim = useMemo(
    () => katilimcilar.find((k) => k.user_id === currentUser?.id) ?? null,
    [katilimcilar, currentUser],
  );
  const yonetebilirMi = benimKatilimim?.katilim_tipi === "yonetici";
  const gozlemleyebilirMi =
    benimKatilimim?.katilim_tipi === "yonetici" || benimKatilimim?.katilim_tipi === "gozlemci";

  const yenidenYukle = useCallback(async () => {
    const db = createClient();
    const { data: runRow } = await db
      .from("simulation_runs")
      .select(
        "id, ad, mod, durum, zaman_olcegi, basladi_at, bitti_at, duraklatildi_at, duraklatilan_saniye, version_id",
      )
      .eq("id", params.id)
      .maybeSingle();

    if (!runRow) {
      setHata("Tatbikat bulunamadı.");
      setYukleniyor(false);
      return;
    }
    setRun(runRow);

    const { data: versionRow } = await db
      .from("scenario_template_versions")
      .select("surum, scenario_templates(kod, ad)")
      .eq("id", runRow.version_id)
      .single();
    if (versionRow) {
      const tpl = versionRow.scenario_templates as unknown as { kod: string; ad: string };
      setSablon({ kod: tpl.kod, ad: tpl.ad, surum: versionRow.surum });
    }

    const { data: katilimRows } = await db
      .from("simulation_participants")
      .select("user_id, senaryo_rolu, katilim_tipi, profiles(full_name)")
      .eq("run_id", params.id);
    setKatilimcilar(
      (katilimRows ?? []).map((k) => ({
        user_id: k.user_id,
        senaryo_rolu: k.senaryo_rolu,
        katilim_tipi: k.katilim_tipi as Katilimci["katilim_tipi"],
        full_name: (k.profiles as unknown as { full_name: string } | null)?.full_name ?? "—",
      })),
    );

    // RLS-filtreli: yalnızca kendi rolüme (veya herkese açık) yayınlanmış
    // gelişmeleri döner. scenario_injects'i BURADA doğrudan sorgulamıyoruz.
    const { data: teslimRows } = await db
      .from("simulation_inject_deliveries")
      .select("inject_id, yayinlandi_at, scenario_injects(sira, t_dakika, baslik, icerik, beklenen_davranis)")
      .eq("run_id", params.id);
    const teslim = (teslimRows ?? [])
      .map((t) => {
        const si = t.scenario_injects as unknown as {
          sira: number;
          t_dakika: number;
          baslik: string;
          icerik: string;
          beklenen_davranis: string | null;
        };
        return { inject_id: t.inject_id, yayinlandi_at: t.yayinlandi_at, ...si };
      })
      .sort((a, b) => a.sira - b.sira);
    setTeslimEdilenler(teslim);

    const teslimEdilenIdSeti = new Set(teslim.map((t) => t.inject_id));

    // Karar noktaları kütüphaneden okunur (herkese açık şablon verisi) ama
    // yalnızca inject_id'si null OLAN ya da yayınlanmış bir gelişmeye bağlı
    // olanlar GÖSTERİLİR — write-guard trigger'ının izin verdiğiyle birebir
    // aynı küme. Görünürlük ayrıca scenario_injects'in kendisini sızdırmaz,
    // çünkü sorulan soru zaten decision_points tablosunda herkese açık.
    const { data: dpRows } = await db
      .from("scenario_decision_points")
      .select("id, inject_id, kod, soru, tip, secenekler")
      .eq("version_id", runRow.version_id);
    setKararNoktalari(
      (dpRows ?? [])
        .filter((dp) => dp.inject_id === null || teslimEdilenIdSeti.has(dp.inject_id))
        .map((dp) => ({ ...dp, secenekler: dp.secenekler as string[] | null })),
    );

    const { data: kararRows } = await db
      .from("simulation_decisions")
      .select("decision_point_id, katilimci_id, cevap, created_at")
      .eq("run_id", params.id);
    setKararlar(kararRows ?? []);

    if (runRow.durum !== "taslak") {
      const { data: scoreRow } = await db
        .from("simulation_scores")
        .select("puan, durum, satirlar, kritik_basarisizliklar")
        .eq("run_id", params.id)
        .maybeSingle();
      setPuan(scoreRow as unknown as PuanSonucu | null);

      const { data: oneriRows } = await db
        .from("simulation_finding_proposals")
        .select("id, baslik, gerekce, onem, durum, control_id")
        .eq("run_id", params.id)
        .order("onem");
      setOneriler(oneriRows ?? []);
    }

    setYukleniyor(false);
  }, [params.id]);

  // Yönetici/gözlemci paneli: şablonun TAMAMINI ve beklenen aksiyonları ayrı
  // çekiyoruz — yalnızca bu rollere gösterildiği için ayrı bir effect'te.
  const yonetimVerisiYukle = useCallback(async () => {
    if (!run || !yonetebilirMi) return;
    const db = createClient();

    const { data: gelismeler } = await db
      .from("scenario_injects")
      .select("id, sira, t_dakika, baslik, gorunur_roller")
      .eq("version_id", run.version_id)
      .order("sira");
    setTumGelismeler(gelismeler ?? []);

    const { data: aksiyonlar } = await db
      .from("scenario_expected_actions")
      .select("id, kod, aciklama, hedef_dakika")
      .eq("version_id", run.version_id);
    setBeklenenAksiyonlar(aksiyonlar ?? []);

    const { data: sonuclar } = await db
      .from("simulation_action_results")
      .select("expected_action_id, tamamlandi, senaryo_dakika")
      .eq("run_id", run.id);
    setAksiyonSonuclari(sonuclar ?? []);

    const { data: profiller } = await db.from("profiles").select("id, full_name");
    setTenantProfilleri((profiller ?? []).map((p) => ({ id: p.id, full_name: p.full_name ?? "—" })));
  }, [run, yonetebilirMi]);

  // İçte tanımlı+çağrılan async sarmalayıcı: store.tsx'teki kabul edilmiş
  // desenin aynısı. Doğrudan `void yenidenYukle()` yazmak (dıştaki bir
  // useCallback'i effect gövdesinden çağırmak) lint'in
  // react-hooks/set-state-in-effect kuralını tetikliyordu — kural, effect
  // gövdesinde SENKRON tanımlanmayan bir setState zincirini "harici sistemi
  // React state'iyle senkronize etme" belirtisi sayıyor.
  useEffect(() => {
    const yukle = async () => {
      await yenidenYukle();
    };
    void yukle();
  }, [yenidenYukle]);

  useEffect(() => {
    const yukle = async () => {
      await yonetimVerisiYukle();
    };
    void yukle();
  }, [yonetimVerisiYukle]);

  // PromiseLike, Promise değil: Supabase'in PostgrestFilterBuilder'ı
  // thenable'dır (await edilebilir) ama TypeScript onu Promise<T>'ye uygun
  // saymaz. Çağıranlar db.from(...).update(...).eq(...) gibi await'siz bir
  // builder döndürüyor — imza bunu kabul etmeli.
  async function calistir(islem: () => PromiseLike<{ error: { message: string } | null }>) {
    setIslemSuruyor(true);
    setHata(null);
    const { error } = await islem();
    if (error) setHata(error.message);
    await yenidenYukle();
    await yonetimVerisiYukle();
    setIslemSuruyor(false);
  }

  async function durumDegistir(yeniDurum: string) {
    const db = createClient();
    await calistir(() => db.from("simulation_runs").update({ durum: yeniDurum }).eq("id", params.id));
  }

  async function gelismeYayinla(injectId: string) {
    if (!currentUser || !run) return;
    const db = createClient();
    await calistir(() =>
      db.from("simulation_inject_deliveries").insert({
        run_id: run.id,
        tenant_id: currentUser.tenantId,
        inject_id: injectId,
        yayinlayan: currentUser.id,
      }),
    );
  }

  async function kararVer(decisionPointId: string, cevap: string) {
    if (!currentUser || !run) return;
    const db = createClient();
    await calistir(() =>
      db.from("simulation_decisions").insert({
        run_id: run.id,
        tenant_id: currentUser.tenantId,
        decision_point_id: decisionPointId,
        katilimci_id: currentUser.id,
        cevap,
        senaryo_dakika: senaryoDakikasiHesapla(run),
      }),
    );
  }

  async function aksiyonIsaretle(expectedActionId: string, tamamlandi: boolean) {
    if (!currentUser || !run) return;
    const db = createClient();
    await calistir(() =>
      db.from("simulation_action_results").upsert(
        {
          run_id: run.id,
          tenant_id: currentUser.tenantId,
          expected_action_id: expectedActionId,
          tamamlandi,
          senaryo_dakika: tamamlandi ? senaryoDakikasiHesapla(run) : null,
          isaretleyen: currentUser.id,
        },
        { onConflict: "run_id,expected_action_id" },
      ),
    );
  }

  async function puanla() {
    setIslemSuruyor(true);
    setHata(null);
    const res = await fetch(`/api/simulasyon/${params.id}/puanla`, { method: "POST" });
    const body = await res.json();
    if (!res.ok) {
      setHata(body.hata ?? "Puanlama başarısız.");
    }
    await yenidenYukle();
    setIslemSuruyor(false);
  }

  async function oneriyeKararVer(oneriId: string, karar: "KABUL" | "RET") {
    setIslemSuruyor(true);
    setHata(null);
    const res = await fetch(`/api/simulasyon/${params.id}/oneri/${oneriId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ karar }),
    });
    const body = await res.json();
    if (!res.ok) setHata(body.hata ?? "İşlem başarısız.");
    await yenidenYukle();
    setIslemSuruyor(false);
  }

  if (yukleniyor) return <p className="text-sm text-muted-foreground">Yükleniyor…</p>;
  if (!run) {
    return (
      <EmptyState
        title="Tatbikat bulunamadı"
        description="Bu tatbikat silinmiş veya erişiminiz yok olabilir."
        action={{ href: "/simulasyonlar", label: "Simülasyonlara dön" }}
      />
    );
  }

  const yayinlanmamisGelismeler = tumGelismeler.filter(
    (g) => !teslimEdilenler.some((t) => t.inject_id === g.id),
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{run.ad}</h1>
          <Badge variant="outline" className="border-amber-500/50 text-amber-700 dark:text-amber-400">
            TATBİKAT
          </Badge>
          <Badge variant="secondary">{SIMULASYON_DURUM_LABEL[run.durum] ?? run.durum}</Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {sablon ? `${sablon.kod} v${sablon.surum} — ${sablon.ad}` : ""} · {run.mod}
          {run.mod === "hizlandirilmis" ? ` (${run.zaman_olcegi}x)` : ""}
        </p>
        {benimKatilimim && (
          <p className="mt-1 text-xs text-muted-foreground">
            Rolünüz: {KATILIM_TIPI_LABEL[benimKatilimim.katilim_tipi]}
            {benimKatilimim.katilim_tipi === "katilimci" ? ` (${benimKatilimim.senaryo_rolu})` : ""}
          </p>
        )}
      </div>

      {hata && <p className="text-sm text-destructive">{hata}</p>}

      {!benimKatilimim && (
        <EmptyState
          title="Bu tatbikata katılımcı olarak eklenmemişsiniz"
          description="Görüntüleyebilirsiniz ama gelişme veya karar göremezsiniz. Tatbikat yöneticisinden sizi eklemesini isteyin."
        />
      )}

      {/* --- YÖNETİCİ PANELİ --- */}
      {yonetebilirMi && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tatbikat Yöneticisi Paneli</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              {run.durum === "taslak" && (
                <Button size="sm" disabled={islemSuruyor} onClick={() => durumDegistir("hazir")}>
                  Hazırla
                </Button>
              )}
              {run.durum === "hazir" && (
                <Button size="sm" disabled={islemSuruyor} onClick={() => durumDegistir("calisiyor")}>
                  Başlat
                </Button>
              )}
              {run.durum === "calisiyor" && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={islemSuruyor}
                    onClick={() => durumDegistir("duraklatildi")}
                  >
                    Duraklat
                  </Button>
                  <Button size="sm" disabled={islemSuruyor} onClick={() => durumDegistir("tamamlandi")}>
                    Tamamla
                  </Button>
                </>
              )}
              {run.durum === "duraklatildi" && (
                <>
                  <Button size="sm" disabled={islemSuruyor} onClick={() => durumDegistir("calisiyor")}>
                    Devam Et
                  </Button>
                  <Button size="sm" disabled={islemSuruyor} onClick={() => durumDegistir("tamamlandi")}>
                    Tamamla
                  </Button>
                </>
              )}
              {(run.durum === "taslak" || run.durum === "hazir") && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={islemSuruyor}
                  onClick={() => durumDegistir("iptal")}
                >
                  İptal Et
                </Button>
              )}
              {run.durum === "tamamlandi" && (
                <Button size="sm" disabled={islemSuruyor} onClick={puanla}>
                  Puanla
                </Button>
              )}
            </div>

            {(run.durum === "calisiyor" || run.durum === "duraklatildi") && (
              <div>
                <p className="mb-2 text-sm font-medium">Sıradaki gelişmeler</p>
                {yayinlanmamisGelismeler.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Tüm gelişmeler yayınlandı.</p>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {yayinlanmamisGelismeler.map((g) => (
                      <li
                        key={g.id}
                        className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"
                      >
                        <span>
                          <span className="text-muted-foreground">t={g.t_dakika}dk</span> {g.baslik}
                          {g.gorunur_roller.length > 0 && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              ({g.gorunur_roller.join(", ")})
                            </span>
                          )}
                        </span>
                        <Button size="sm" disabled={islemSuruyor} onClick={() => gelismeYayinla(g.id)}>
                          Yayınla
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {(run.durum === "calisiyor" || run.durum === "duraklatildi" || run.durum === "tamamlandi") &&
              beklenenAksiyonlar.length > 0 && (
                <div>
                  <p className="mb-2 text-sm font-medium">Beklenen aksiyonlar — fiilen ne oldu?</p>
                  <p className="mb-2 text-xs text-muted-foreground">
                    Bir karar verilmiş olması, aksiyonun fiilen yapıldığı anlamına gelmez — burada
                    yalnızca gözünüzle gördüğünüzü işaretleyin.
                  </p>
                  <ul className="flex flex-col gap-1.5">
                    {beklenenAksiyonlar.map((a) => {
                      const sonuc = aksiyonSonuclari.find((s) => s.expected_action_id === a.id);
                      return (
                        <li
                          key={a.id}
                          className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"
                        >
                          <span>
                            {a.aciklama}
                            {a.hedef_dakika !== null && (
                              <span className="ml-2 text-xs text-muted-foreground">
                                hedef {a.hedef_dakika}dk
                              </span>
                            )}
                            {sonuc?.tamamlandi && (
                              <span className="ml-2 text-xs text-muted-foreground">
                                ({sonuc.senaryo_dakika}dk&apos;da tamamlandı)
                              </span>
                            )}
                          </span>
                          <div className="flex gap-1.5">
                            <Button
                              size="sm"
                              variant={sonuc?.tamamlandi ? "default" : "outline"}
                              disabled={islemSuruyor}
                              onClick={() => aksiyonIsaretle(a.id, true)}
                            >
                              Tamamlandı
                            </Button>
                            <Button
                              size="sm"
                              variant={sonuc && !sonuc.tamamlandi ? "default" : "outline"}
                              disabled={islemSuruyor}
                              onClick={() => aksiyonIsaretle(a.id, false)}
                            >
                              Yapılmadı
                            </Button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

            <KatilimciEkleFormu
              runId={run.id}
              tenantId={currentUser?.tenantId ?? ""}
              tenantProfilleri={tenantProfilleri}
              mevcutKatilimcilar={katilimcilar}
              onEklendi={yenidenYukle}
            />
          </CardContent>
        </Card>
      )}

      {/* --- ZAMAN ÇİZELGESİ (herkese, yalnızca yayınlanmış+görünür) --- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Zaman Çizelgesi</CardTitle>
        </CardHeader>
        <CardContent>
          {teslimEdilenler.length === 0 ? (
            <p className="text-sm text-muted-foreground">Henüz bir gelişme yayınlanmadı.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {teslimEdilenler.map((g) => (
                <li key={g.inject_id} className="rounded-md border p-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>t={g.t_dakika}dk</span>
                  </div>
                  <p className="font-medium">{g.baslik}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{g.icerik}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* --- KARAR NOKTALARI --- */}
      {benimKatilimim && kararNoktalari.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Karar Noktaları</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {kararNoktalari.map((dp) => {
              const benimCevabim = kararlar.find(
                (k) => k.decision_point_id === dp.id && k.katilimci_id === currentUser?.id,
              );
              const aktif = run.durum === "calisiyor" || run.durum === "duraklatildi";

              return (
                <div key={dp.id} className="rounded-md border p-3">
                  <p className="text-sm font-medium">{dp.soru}</p>
                  {benimCevabim ? (
                    <p className="mt-2 text-sm text-muted-foreground">
                      Cevabınız: <span className="font-medium">{benimCevabim.cevap}</span>
                    </p>
                  ) : aktif ? (
                    <KararFormu tip={dp.tip} secenekler={dp.secenekler} onGonder={(c) => kararVer(dp.id, c)} />
                  ) : (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Tatbikat çalışmıyor, karar verilemez.
                    </p>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* --- TÜM KARARLAR (yönetici/gözlemci) --- */}
      {gozlemleyebilirMi && kararlar.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Verilen Tüm Kararlar</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-1.5 text-sm">
              {kararlar.map((k) => {
                const dp = kararNoktalari.find((d) => d.id === k.decision_point_id);
                const katilimci = katilimcilar.find((p) => p.user_id === k.katilimci_id);
                return (
                  <li key={`${k.decision_point_id}-${k.katilimci_id}`} className="text-muted-foreground">
                    <span className="font-medium text-foreground">{katilimci?.full_name ?? "—"}</span> —{" "}
                    {dp?.soru ?? k.decision_point_id}: <span className="font-medium">{k.cevap}</span>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* --- PUAN + BULGU ÖNERİLERİ --- */}
      {puan && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sonuç</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <span className="text-3xl font-semibold tabular-nums">{puan.puan}</span>
              <span className="text-muted-foreground">/100</span>
              <Badge variant={puan.durum === "CRITICAL_FAILURE" ? "destructive" : "secondary"}>
                {PUANLAMA_DURUM_LABEL[puan.durum] ?? puan.durum}
              </Badge>
            </div>

            {puan.kritik_basarisizliklar.length > 0 && (
              <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3">
                <p className="text-sm font-medium text-destructive">Kritik başarısızlıklar</p>
                <ul className="mt-1 list-inside list-disc text-sm">
                  {puan.kritik_basarisizliklar.map((k, i) => (
                    <li key={i}>{k}</li>
                  ))}
                </ul>
              </div>
            )}

            <ul className="flex flex-col gap-1.5 text-sm">
              {puan.satirlar.map((s) => (
                <li key={s.kod} className="flex items-start gap-2">
                  <span
                    className={
                      s.sonuc === "gecti"
                        ? "text-emerald-600"
                        : s.sonuc === "kaldi"
                          ? "text-destructive"
                          : "text-muted-foreground"
                    }
                  >
                    {s.sonuc === "gecti" ? "✓" : s.sonuc === "kaldi" ? "✗" : "·"}
                  </span>
                  <span className="text-muted-foreground">{s.gerekce}</span>
                </li>
              ))}
            </ul>

            {oneriler.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-medium">Bulgu önerileri</p>
                <ul className="flex flex-col gap-2">
                  {oneriler.map((o) => (
                    <li key={o.id} className="rounded-md border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">{o.baslik}</span>
                        <Badge variant={ONEM_BADGE_VARIANT[o.onem as keyof typeof ONEM_BADGE_VARIANT]}>
                          {ONEM_LABEL[o.onem as keyof typeof ONEM_LABEL] ?? o.onem}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{o.gerekce}</p>
                      {o.durum === "PROPOSED" && gozlemleyebilirMi ? (
                        <div className="mt-2 flex gap-2">
                          <Button
                            size="sm"
                            disabled={islemSuruyor}
                            onClick={() => oneriyeKararVer(o.id, "KABUL")}
                          >
                            Kabul Et (bulgu oluştur)
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={islemSuruyor}
                            onClick={() => oneriyeKararVer(o.id, "RET")}
                          >
                            Reddet
                          </Button>
                        </div>
                      ) : (
                        <Badge variant="outline" className="mt-2">
                          {o.durum === "KABUL" ? "Kabul edildi — bulgu oluşturuldu" : o.durum === "RET" ? "Reddedildi" : "PROPOSED"}
                        </Badge>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Button variant="outline" size="sm" onClick={() => router.push("/simulasyonlar")}>
        ← Simülasyonlara dön
      </Button>
    </div>
  );
}

function KararFormu({
  tip,
  secenekler,
  onGonder,
}: {
  tip: string;
  secenekler: string[] | null;
  onGonder: (cevap: string) => void;
}) {
  const [metin, setMetin] = useState("");

  if (tip === "secim" && secenekler) {
    return (
      <div className="mt-2 flex flex-wrap gap-2">
        {secenekler.map((s) => (
          <Button key={s} size="sm" variant="outline" onClick={() => onGonder(s)}>
            {s}
          </Button>
        ))}
      </div>
    );
  }

  if (tip === "onay") {
    return (
      <div className="mt-2 flex gap-2">
        <Button size="sm" onClick={() => onGonder("Onaylandı")}>
          Onayla
        </Button>
      </div>
    );
  }

  // serbest_metin / gorev / dosya: MVP'de hepsi serbest metin girişi olarak
  // ele alınıyor — gerçek dosya yükleme kanıt motoruna bağlanmayı gerektirir
  // (ayrı bir iş, bkz. docs/ROADMAP.md M8 kalan işler).
  return (
    <form
      className="mt-2 flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (metin.trim()) onGonder(metin.trim());
      }}
    >
      <Input value={metin} onChange={(e) => setMetin(e.target.value)} placeholder="Cevabınız…" />
      <Button size="sm" type="submit">
        Gönder
      </Button>
    </form>
  );
}

function KatilimciEkleFormu({
  runId,
  tenantId,
  tenantProfilleri,
  mevcutKatilimcilar,
  onEklendi,
}: {
  runId: string;
  tenantId: string;
  tenantProfilleri: { id: string; full_name: string }[];
  mevcutKatilimcilar: Katilimci[];
  onEklendi: () => Promise<void>;
}) {
  const eklenebilecekler = tenantProfilleri.filter(
    (p) => !mevcutKatilimcilar.some((k) => k.user_id === p.id),
  );
  const [seciliUserId, setSeciliUserId] = useState("");
  const [senaryoRolu, setSenaryoRolu] = useState("");
  const [katilimTipi, setKatilimTipi] = useState<"katilimci" | "gozlemci">("katilimci");
  const [ekleniyor, setEkleniyor] = useState(false);

  if (eklenebilecekler.length === 0) return null;

  async function ekle() {
    if (!seciliUserId) return;
    setEkleniyor(true);
    const db = createClient();
    await db.from("simulation_participants").insert({
      run_id: runId,
      tenant_id: tenantId,
      user_id: seciliUserId,
      senaryo_rolu: katilimTipi === "gozlemci" ? "gozlemci" : senaryoRolu || "katilimci",
      katilim_tipi: katilimTipi,
    });
    setSeciliUserId("");
    setSenaryoRolu("");
    setEkleniyor(false);
    await onEklendi();
  }

  return (
    <div className="border-t pt-4">
      <p className="mb-2 text-sm font-medium">Katılımcı ekle</p>
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1.5">
          <Label>Kullanıcı</Label>
          <Select value={seciliUserId} onValueChange={(v) => setSeciliUserId(v ?? "")}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Seçin" />
            </SelectTrigger>
            <SelectContent>
              {eklenebilecekler.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Katılım tipi</Label>
          <Select value={katilimTipi} onValueChange={(v) => setKatilimTipi((v as typeof katilimTipi) ?? "katilimci")}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="katilimci">Katılımcı</SelectItem>
              <SelectItem value="gozlemci">Gözlemci</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {katilimTipi === "katilimci" && (
          <div className="flex flex-col gap-1.5">
            <Label>Senaryo rolü</Label>
            <Input
              value={senaryoRolu}
              onChange={(e) => setSenaryoRolu(e.target.value)}
              placeholder="örn. soc_bt_operasyon"
              className="w-48"
            />
          </div>
        )}
        <Button size="sm" disabled={!seciliUserId || ekleniyor} onClick={ekle}>
          Ekle
        </Button>
      </div>
    </div>
  );
}
