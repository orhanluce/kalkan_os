"use client";

import { useCallback, useEffect, useState } from "react";
import { StatusBadge } from "@/components/durum/status-badge";
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
}

interface SonTestRun {
  sonuc: string;
  gerekce: string;
  calisti_at: string;
}

interface OneriSatiri {
  id: string;
  test_definition_id: string;
  baslik: string;
  gerekce: string;
  onem: string;
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

  const [gozlemSecimleri, setGozlemSecimleri] = useState<Record<string, GozlemSecimi>>({});
  const [toplamaHatasi, setToplamaHatasi] = useState<Record<string, string>>({});

  const yukle = useCallback(async () => {
    const db = createClient();
    const { data: t } = await db
      .from("control_test_definitions")
      .select("id, tur, ad, aciklama, tazelik_gun, basarisizlik_onem, otomatik_bulgu, retest_gerekli")
      .eq("control_id", controlId)
      .order("created_at", { ascending: true });
    setTanimlar(t ?? []);

    if (t && t.length > 0) {
      const { data: runs } = await db
        .from("test_runs")
        .select("test_definition_id, sonuc, gerekce, calisti_at")
        .in(
          "test_definition_id",
          t.map((x) => x.id),
        )
        .order("calisti_at", { ascending: false });

      // İlk (en yeni) koşu her tanım için kazanır — sıra sorgudan geliyor.
      const map: Record<string, SonTestRun> = {};
      for (const r of runs ?? []) {
        if (!map[r.test_definition_id]) {
          map[r.test_definition_id] = { sonuc: r.sonuc, gerekce: r.gerekce, calisti_at: r.calisti_at };
        }
      }
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
    } else {
      setSonRunlar({});
      setOneriler([]);
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

    const govde: Record<string, unknown> = { gozlemZamani: new Date().toISOString() };
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
    });
    if (error) {
      setHata(error.message);
    } else {
      setYeniAd("");
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

              return (
                <li key={tanim.id} className="rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{tanim.ad}</p>
                      <p className="text-xs text-muted-foreground">
                        {TEST_TUR_LABEL[tanim.tur] ?? tanim.tur}
                        {tanim.tazelik_gun && ` · tazelik ${tanim.tazelik_gun} gün`}
                      </p>
                    </div>
                    {sonRun && (
                      <StatusBadge durum={TEST_SONUC_SEMANTIK[sonRun.sonuc] ?? "unknown"}>
                        {TEST_SONUC_LABEL[sonRun.sonuc] ?? sonRun.sonuc}
                      </StatusBadge>
                    )}
                  </div>

                  {sonRun && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {sonRun.gerekce} — {new Date(sonRun.calisti_at).toLocaleString("tr-TR")}
                    </p>
                  )}

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

                  <div className="mt-3 flex flex-wrap items-end gap-2">
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
