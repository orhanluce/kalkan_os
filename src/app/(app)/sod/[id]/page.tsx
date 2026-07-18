"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { StatusBadge } from "@/components/durum/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AuditLogList } from "@/components/audit-log-list";
import { EmptyState } from "@/components/empty-state";
import { useAuth } from "@/lib/auth";
import { useLocalStore } from "@/lib/store";
import { createClient } from "@/lib/supabase/client";
import {
  ONEM_LABEL,
  ONEM_SEMANTIK,
  SOD_CATISMA_DURUM_LABEL,
  SOD_CATISMA_DURUM_SEMANTIK,
  SOD_ISTISNA_DURUM_LABEL,
  SOD_ISTISNA_DURUM_SEMANTIK,
  TEST_SONUC_LABEL,
  TEST_SONUC_SEMANTIK,
} from "@/lib/ui-labels";

// SoD çatışma detayı (docs/ROADMAP.md M16). Bu sayfa RLS'in üstünde bir
// GÖRÜNTÜLEYİCİDİR; gerçek sınır RLS + rota rol kontrolündedir.
//
// TELAFİ EDİCİ KONTROL: YENİ BİR TEST ALTYAPISI YAZILMADI. Bu sayfa mevcut
// M12 rotasını (/api/kontrol-test/[id]/calistir) DOĞRUDAN çağırır; test
// sonucuna göre çatışma durumunu (MITIGATED/REOPENED) günceller. Guard
// (sod_catisma_durum_guard) bu geçişin gerçekten PASSED bir teste dayandığını
// DB'de yeniden doğrular — istemci "MITIGATED" yazsa bile testsiz geçemez.

interface Catisma {
  id: string;
  rule_id: string;
  onem: string;
  durum: string;
  sistem_kapsami: string;
  ilk_gorulme_at: string;
  son_gorulme_at: string;
  kullanici_id: string | null;
  harici_kullanici_id: string | null;
}

interface Kural {
  kod: string;
  ad: string;
  aciklama: string | null;
  kaynak_turu: string;
  kaynak_referansi: string | null;
  mevzuat_durumu: string;
}

interface Istisna {
  id: string;
  gerekce: string;
  risk_degerlendirmesi: string | null;
  talep_eden_id: string;
  onaylayan_id: string | null;
  bitis: string;
  durum: string;
  karar_notu: string | null;
  onceki_istisna_id: string | null;
}

interface TelafiKontrol {
  id: string;
  test_definition_id: string;
  ad: string;
  son_test_sonuc: string | null;
  son_test_gerekce: string | null;
}

export default function SodCatismaDetayPage() {
  const params = useParams<{ id: string }>();
  const { currentUser } = useAuth();
  const { auditLog, kurum } = useLocalStore();

  const [catisma, setCatisma] = useState<Catisma | null>(null);
  const [kural, setKural] = useState<Kural | null>(null);
  const [istisnalar, setIstisnalar] = useState<Istisna[]>([]);
  const [telafiler, setTelafiler] = useState<TelafiKontrol[]>([]);
  const [testTanimlari, setTestTanimlari] = useState<{ id: string; ad: string }[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState<string | null>(null);
  const [islemSuruyor, setIslemSuruyor] = useState(false);

  const [istisnaFormAcik, setIstisnaFormAcik] = useState(false);
  const [gerekce, setGerekce] = useState("");
  const [bitis, setBitis] = useState("");
  const [riskDegerlendirmesi, setRiskDegerlendirmesi] = useState("");
  // UZATMA modu (M16 #3): dolu ise form yeni bir UZATMA kaydı açar —
  // onaylı/dolmuş kayıt DEĞİŞTİRİLMEZ (kilit guard'ı), zincire bağlanır.
  const [uzatilanId, setUzatilanId] = useState<string | null>(null);

  const [kararNotlari, setKararNotlari] = useState<Record<string, string>>({});
  const [secilenTanimId, setSecilenTanimId] = useState("");

  const yukle = useCallback(async () => {
    const db = createClient();
    const { data: c } = await db
      .from("sod_catismalari")
      .select("id, rule_id, onem, durum, sistem_kapsami, ilk_gorulme_at, son_gorulme_at, kullanici_id, harici_kullanici_id")
      .eq("id", params.id)
      .maybeSingle();
    if (!c) {
      setYukleniyor(false);
      return;
    }
    setCatisma(c);

    const { data: k } = await db
      .from("sod_kurallari")
      .select("kod, ad, aciklama, kaynak_turu, kaynak_referansi, mevzuat_durumu")
      .eq("id", c.rule_id)
      .maybeSingle();
    setKural(k);

    const { data: exc } = await db
      .from("sod_istisnalari")
      .select("id, gerekce, risk_degerlendirmesi, talep_eden_id, onaylayan_id, bitis, durum, karar_notu, onceki_istisna_id")
      .eq("conflict_id", c.id)
      .order("created_at", { ascending: false });
    setIstisnalar(exc ?? []);

    const { data: cc } = await db
      .from("sod_telafi_edici_kontroller")
      .select("id, test_definition_id, control_test_definitions(ad)")
      .eq("conflict_id", c.id);

    const telafiListesi: TelafiKontrol[] = [];
    for (const link of cc ?? []) {
      const { data: sonRun } = await db
        .from("test_runs")
        .select("sonuc, gerekce")
        .eq("test_definition_id", link.test_definition_id)
        .order("calisti_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      telafiListesi.push({
        id: link.id,
        test_definition_id: link.test_definition_id,
        ad: (link.control_test_definitions as unknown as { ad: string } | null)?.ad ?? "—",
        son_test_sonuc: sonRun?.sonuc ?? null,
        son_test_gerekce: sonRun?.gerekce ?? null,
      });
    }
    setTelafiler(telafiListesi);

    const { data: tanimlar } = await db.from("control_test_definitions").select("id, ad");
    setTestTanimlari(tanimlar ?? []);

    setYukleniyor(false);
  }, [params.id]);

  useEffect(() => {
    const calistir = async () => {
      await yukle();
    };
    void calistir();
  }, [yukle]);

  async function istisnaTalepEt(e: React.FormEvent) {
    e.preventDefault();
    if (!gerekce.trim() || !bitis || !currentUser || !catisma) return;
    setIslemSuruyor(true);
    setHata(null);
    const db = createClient();
    const { error } = await db.from("sod_istisnalari").insert({
      conflict_id: catisma.id,
      tenant_id: currentUser.tenantId,
      gerekce: gerekce.trim(),
      talep_eden_id: currentUser.id,
      bitis,
      risk_degerlendirmesi: riskDegerlendirmesi.trim() || null,
      // Uzatma: önceki kayda zincir (guard: aynı çatışma, karara bağlanmış
      // önceki, ileri tarih). Normal talepte null.
      onceki_istisna_id: uzatilanId,
    });
    if (error) {
      setHata(error.message);
    } else {
      await db.from("sod_catismalari").update({ durum: "EXCEPTION_REQUESTED" }).eq("id", catisma.id);
      setGerekce("");
      setBitis("");
      setRiskDegerlendirmesi("");
      setIstisnaFormAcik(false);
      setUzatilanId(null);
      await yukle();
    }
    setIslemSuruyor(false);
  }

  async function istisnayaKararVer(istisnaId: string, karar: "ONAYLA" | "REDDET") {
    const notu = kararNotlari[istisnaId] ?? "";
    if (!notu.trim()) {
      setHata("Karar gerekçesi zorunlu.");
      return;
    }
    setIslemSuruyor(true);
    setHata(null);
    const res = await fetch(`/api/sod/istisna/${istisnaId}/karar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ karar, notu }),
    });
    const body = await res.json();
    if (!res.ok) setHata(body.hata ?? "Karar uygulanamadı.");
    await yukle();
    setIslemSuruyor(false);
  }

  async function telafiKontrolBagla() {
    if (!secilenTanimId || !currentUser || !catisma) return;
    setIslemSuruyor(true);
    setHata(null);
    const db = createClient();
    const { error } = await db.from("sod_telafi_edici_kontroller").insert({
      conflict_id: catisma.id,
      tenant_id: currentUser.tenantId,
      test_definition_id: secilenTanimId,
    });
    if (error) setHata(error.message);
    setSecilenTanimId("");
    await yukle();
    setIslemSuruyor(false);
  }

  /** M12'nin mevcut test rotasını çağırır, sonucuna göre çatışma durumunu günceller. */
  async function telafiTestiCalistirVeUygula(testDefinitionId: string, basarili: boolean) {
    if (!catisma) return;
    setIslemSuruyor(true);
    setHata(null);
    const res = await fetch(`/api/kontrol-test/${testDefinitionId}/calistir`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ iddiaKarsilandi: basarili, gozlemZamani: new Date().toISOString() }),
    });
    const body = await res.json();
    if (!res.ok) {
      setHata(body.hata ?? "Test çalıştırılamadı.");
      setIslemSuruyor(false);
      return;
    }

    const db = createClient();
    if (body.sonuc === "PASSED") {
      // Guard, bu geçişin gerçekten PASSED bir teste dayandığını yeniden
      // doğrular — istemci "MITIGATED" yazmaya ÇALIŞIR, ama testsiz geçemez.
      const { error } = await db.from("sod_catismalari").update({ durum: "MITIGATED" }).eq("id", catisma.id);
      if (error) setHata(error.message);
    } else if (catisma.durum === "MITIGATED") {
      // Daha önce telafi edilmişti, şimdi test başarısız — yeniden aç.
      const { error } = await db.from("sod_catismalari").update({ durum: "REOPENED" }).eq("id", catisma.id);
      if (error) setHata(error.message);
    }
    await yukle();
    setIslemSuruyor(false);
  }

  async function bagimsizKapat() {
    if (!currentUser || !catisma) return;
    setIslemSuruyor(true);
    setHata(null);
    const db = createClient();
    const { error } = await db
      .from("sod_catismalari")
      .update({ durum: "RESOLVED", resolved_by: currentUser.id })
      .eq("id", catisma.id);
    if (error) setHata(error.message);
    await yukle();
    setIslemSuruyor(false);
  }

  if (yukleniyor) {
    return <p className="text-sm text-muted-foreground">Yükleniyor…</p>;
  }

  if (!catisma) {
    return (
      <EmptyState
        title="Çatışma bulunamadı"
        description="Bu id'ye sahip bir çatışma yok — silinmiş veya yanlış bir link olabilir."
        action={{ href: "/sod", label: "Görevler Ayrılığına dön" }}
      />
    );
  }

  const kisi = catisma.kullanici_id
    ? kurum.profiller.find((p) => p.id === catisma.kullanici_id)?.fullName ?? "Bilinmeyen kullanıcı"
    : (catisma.harici_kullanici_id ?? "—");

  const catismaAudit = auditLog.filter(
    (e) =>
      (e.hedefTablo === "sod_catismalari" && e.hedefId === catisma.id) ||
      (e.hedefTablo === "sod_istisnalari" && istisnalar.some((i) => i.id === e.hedefId)) ||
      (e.hedefTablo === "sod_telafi_edici_kontroller" && telafiler.some((t) => t.id === e.hedefId)),
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{kural?.ad ?? kural?.kod ?? "Çatışma"}</h1>
        <p className="text-sm text-muted-foreground">
          {kural?.kod} · {kisi} · {catisma.sistem_kapsami}
        </p>
      </div>

      {hata && <p className="text-sm text-destructive">{hata}</p>}

      <Card>
        <CardHeader>
          <CardTitle>Durum</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <StatusBadge durum={SOD_CATISMA_DURUM_SEMANTIK[catisma.durum] ?? "unknown"}>
              {SOD_CATISMA_DURUM_LABEL[catisma.durum]}
            </StatusBadge>
            <StatusBadge durum={ONEM_SEMANTIK[catisma.onem as keyof typeof ONEM_SEMANTIK]}>
              {ONEM_LABEL[catisma.onem as keyof typeof ONEM_LABEL]}
            </StatusBadge>
          </div>
          <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-xs text-muted-foreground">İlk görülme</dt>
              <dd>{new Date(catisma.ilk_gorulme_at).toLocaleString("tr-TR")}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Son görülme</dt>
              <dd>{new Date(catisma.son_gorulme_at).toLocaleString("tr-TR")}</dd>
            </div>
          </dl>
          {kural?.kaynak_turu === "spk_notu" && (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Bu kuralın kaynağı SPK çalışma notudur ve mevzuat durumu &ldquo;
              {kural.mevzuat_durumu}&rdquo;dır — hukuki bağlayıcılığı ayrı bir onay gerektirir.
            </p>
          )}

          {(catisma.durum === "MITIGATED" || catisma.durum === "EXCEPTION_APPROVED") && (
            <Button size="sm" className="w-fit" disabled={islemSuruyor} onClick={bagimsizKapat}>
              Bağımsız Kapat (RESOLVED)
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>İstisna</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {istisnalar.length === 0 && !istisnaFormAcik && (
            <Button size="sm" className="w-fit" variant="outline" onClick={() => setIstisnaFormAcik(true)}>
              İstisna Talep Et
            </Button>
          )}

          {istisnaFormAcik && (
            <form onSubmit={istisnaTalepEt} className="flex flex-col gap-3 rounded-lg border p-3">
              {uzatilanId && (
                <p className="text-xs text-muted-foreground">
                  <strong>Uzatma talebi:</strong> önceki kayıt değiştirilmez; yeni gerekçe, yeni risk
                  değerlendirmesi ve İLERİ bir bitiş tarihiyle yeni bir talep açılır — onay yine
                  bağımsızdır.
                </p>
              )}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="gerekce">{uzatilanId ? "Uzatma gerekçesi (yeni)" : "Gerekçe"}</Label>
                <Textarea id="gerekce" value={gerekce} onChange={(e) => setGerekce(e.target.value)} required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="bitis">Bitiş tarihi (zorunlu — süresiz istisna olamaz)</Label>
                <Input id="bitis" type="date" value={bitis} onChange={(e) => setBitis(e.target.value)} required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="risk">Risk değerlendirmesi (opsiyonel)</Label>
                <Textarea
                  id="risk"
                  value={riskDegerlendirmesi}
                  onChange={(e) => setRiskDegerlendirmesi(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={islemSuruyor}>
                  Talep Et
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setIstisnaFormAcik(false);
                    setUzatilanId(null);
                  }}
                >
                  Vazgeç
                </Button>
              </div>
            </form>
          )}

          {istisnalar.map((i) => (
            <div key={i.id} className="rounded-lg border p-3 text-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <StatusBadge durum={SOD_ISTISNA_DURUM_SEMANTIK[i.durum] ?? "unknown"}>
                    {SOD_ISTISNA_DURUM_LABEL[i.durum]}
                  </StatusBadge>
                  {i.onceki_istisna_id && <StatusBadge durum="info">Uzatma</StatusBadge>}
                </div>
                <span className="text-xs text-muted-foreground">Bitiş: {i.bitis}</span>
              </div>
              <p className="mt-2">{i.gerekce}</p>
              {i.risk_degerlendirmesi && (
                <p className="mt-1 text-xs text-muted-foreground">Risk: {i.risk_degerlendirmesi}</p>
              )}
              {i.karar_notu && <p className="mt-1 text-xs text-muted-foreground">Karar notu: {i.karar_notu}</p>}

              {i.durum === "talep_edildi" && currentUser && i.talep_eden_id !== currentUser.id && (
                <div className="mt-3 flex flex-col gap-2">
                  <Textarea
                    placeholder="Karar gerekçesi (zorunlu)"
                    value={kararNotlari[i.id] ?? ""}
                    onChange={(e) => setKararNotlari((s) => ({ ...s, [i.id]: e.target.value }))}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" disabled={islemSuruyor} onClick={() => istisnayaKararVer(i.id, "ONAYLA")}>
                      Onayla
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={islemSuruyor}
                      onClick={() => istisnayaKararVer(i.id, "REDDET")}
                    >
                      Reddet
                    </Button>
                  </div>
                </div>
              )}
              {i.durum === "talep_edildi" && currentUser && i.talep_eden_id === currentUser.id && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Kendi talebinizi onaylayamazsınız — farklı bir yetkili karar vermeli.
                </p>
              )}
              {/* UZATMA (M16 #3): yalnız karara bağlanmış (onaylı/dolmuş)
                  kayıttan; bekleyen bir talep zaten varken açılmaz. */}
              {["onaylandi", "suresi_doldu"].includes(i.durum) &&
                !istisnalar.some((x) => x.durum === "talep_edildi") &&
                !istisnaFormAcik && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-3"
                    onClick={() => {
                      setUzatilanId(i.id);
                      setIstisnaFormAcik(true);
                    }}
                  >
                    Uzatma Talep Et
                  </Button>
                )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Telafi Edici Kontrol</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-xs text-muted-foreground">
            Mevcut bir kontrol testine bağlanır (M12) — yeni bir test altyapısı burada
            oluşturulmaz. Testin başarılı sonucu yukarıdaki durum rozetini günceller.
          </p>

          {telafiler.map((t) => (
            <div key={t.id} className="rounded-lg border p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium">{t.ad}</span>
                {t.son_test_sonuc && (
                  <StatusBadge durum={TEST_SONUC_SEMANTIK[t.son_test_sonuc] ?? "unknown"}>
                    {TEST_SONUC_LABEL[t.son_test_sonuc] ?? t.son_test_sonuc}
                  </StatusBadge>
                )}
              </div>
              {t.son_test_gerekce && <p className="mt-1 text-xs text-muted-foreground">{t.son_test_gerekce}</p>}
              <div className="mt-2 flex gap-2">
                <Button
                  size="sm"
                  disabled={islemSuruyor}
                  onClick={() => telafiTestiCalistirVeUygula(t.test_definition_id, true)}
                >
                  Başarılı çalıştır
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={islemSuruyor}
                  onClick={() => telafiTestiCalistirVeUygula(t.test_definition_id, false)}
                >
                  Başarısız çalıştır
                </Button>
              </div>
            </div>
          ))}

          <div className="flex items-end gap-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="test-sec">Kontrol testi seç</Label>
              <Select
                items={Object.fromEntries(testTanimlari.map((t) => [t.id, t.ad]))}
                value={secilenTanimId}
                onValueChange={(v) => setSecilenTanimId(v ?? "")}
              >
                <SelectTrigger id="test-sec" className="w-64">
                  <SelectValue placeholder="Test seçin" />
                </SelectTrigger>
                <SelectContent>
                  {testTanimlari.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.ad}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" variant="outline" disabled={islemSuruyor || !secilenTanimId} onClick={telafiKontrolBagla}>
              Bağla
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Denetim İzi</CardTitle>
        </CardHeader>
        <CardContent>
          <AuditLogList entries={catismaAudit} />
        </CardContent>
      </Card>
    </div>
  );
}
