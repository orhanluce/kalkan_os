"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { LegalStatusBadge } from "@/components/durum/legal-status-badge";
import { StatusBadge } from "@/components/durum/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { useAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";
import {
  ONEM_LABEL,
  ONEM_SEMANTIK,
  SOD_CATISMA_DURUM_LABEL,
  SOD_CATISMA_DURUM_SEMANTIK,
} from "@/lib/ui-labels";

// Görevler Ayrılığı (SoD) — ana sayfa (docs/ROADMAP.md M16, SPK notları §5).
//
// GÜVENLİK SINIRI: bu sayfa bir yetki kontrolü DEĞİLDİR. Gerçek sınır RLS'te
// (tenant izolasyonu) ve rotalardaki rol kontrolündedir. Değerlendirme
// çalıştırma, istisna kararı ve mevzuat_durumu geçişi SUNUCU rotalarından
// geçer (motor mantığı + ayrı yetki kontrolü orada); kural/taraf oluşturma
// basit CRUD olduğu için doğrudan Supabase client + RLS ile yapılır (M12'nin
// "yeni test tanımı" desenindeki gibi).

interface SodKuralSatiri {
  id: string;
  kod: string;
  ad: string;
  durum: string;
  onem: string;
  kaynak_turu: string;
  kaynak_referansi: string | null;
  mevzuat_durumu: string;
}

interface SodCatismaSatiri {
  id: string;
  rule_id: string;
  sistem_kapsami: string;
  onem: string;
  durum: string;
  ilk_gorulme_at: string;
  son_gorulme_at: string;
}

const ONEM_OPTIONS = ["acil", "kritik", "yuksek", "orta", "dusuk"] as const;
const DURUM_FILTRE_ITEMS: Record<string, string> = { HEPSI: "Tümü", ...SOD_CATISMA_DURUM_LABEL };

export default function SodPage() {
  const { currentUser } = useAuth();

  const [kurallar, setKurallar] = useState<SodKuralSatiri[]>([]);
  const [catismalar, setCatismalar] = useState<SodCatismaSatiri[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState<string | null>(null);
  const [islemSuruyor, setIslemSuruyor] = useState(false);
  const [sonCalistirma, setSonCalistirma] = useState<string | null>(null);

  const [durumFiltre, setDurumFiltre] = useState("HEPSI");
  const [onemFiltre, setOnemFiltre] = useState("HEPSI");

  const [formAcik, setFormAcik] = useState(false);
  const [yeniKod, setYeniKod] = useState("");
  const [yeniAd, setYeniAd] = useState("");
  const [yeniOnem, setYeniOnem] = useState<string>("kritik");
  const [yeniKaynakTuru, setYeniKaynakTuru] = useState<"internal" | "spk_notu">("internal");
  const [yeniKaynakReferansi, setYeniKaynakReferansi] = useState("");
  const [tarafAAktivite, setTarafAAktivite] = useState("");
  const [tarafBAktivite, setTarafBAktivite] = useState("");

  const yukle = useCallback(async () => {
    const db = createClient();
    const [{ data: k }, { data: c }, { data: sonRun }] = await Promise.all([
      db
        .from("sod_kurallari")
        .select("id, kod, ad, durum, onem, kaynak_turu, kaynak_referansi, mevzuat_durumu")
        .order("created_at", { ascending: true }),
      db
        .from("sod_catismalari")
        .select("id, rule_id, sistem_kapsami, onem, durum, ilk_gorulme_at, son_gorulme_at")
        .order("son_gorulme_at", { ascending: false }),
      db
        .from("sod_degerlendirme_calistirmalari")
        .select("bitis_at")
        .order("baslama_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    setKurallar(k ?? []);
    setCatismalar(c ?? []);
    setSonCalistirma(sonRun?.bitis_at ?? null);
    setYukleniyor(false);
  }, []);

  useEffect(() => {
    const calistir = async () => {
      await yukle();
    };
    void calistir();
  }, [yukle]);

  async function degerlendirmeCalistir() {
    setIslemSuruyor(true);
    setHata(null);
    const res = await fetch("/api/sod/degerlendir", { method: "POST" });
    const body = await res.json();
    if (!res.ok) setHata(body.hata ?? "Değerlendirme çalıştırılamadı.");
    await yukle();
    setIslemSuruyor(false);
  }

  async function yeniKuralEkle(e: React.FormEvent) {
    e.preventDefault();
    if (!yeniKod.trim() || !yeniAd.trim() || !tarafAAktivite.trim() || !tarafBAktivite.trim() || !currentUser) {
      return;
    }
    setIslemSuruyor(true);
    setHata(null);
    const db = createClient();
    const { data: kural, error } = await db
      .from("sod_kurallari")
      .insert({
        tenant_id: currentUser.tenantId,
        kod: yeniKod.trim(),
        ad: yeniAd.trim(),
        onem: yeniOnem,
        kaynak_turu: yeniKaynakTuru,
        kaynak_referansi: yeniKaynakReferansi.trim() || null,
        // SPK kaynaklı kural her zaman TODO_DOGRULA doğar (kural 3) — asla
        // doğrudan VERIFIED yazılmaz. İç kural (internal) doğrulama beklemez.
        mevzuat_durumu: yeniKaynakTuru === "spk_notu" ? "TODO_DOGRULA" : "INTERNAL",
        olusturan: currentUser.id,
      })
      .select("id")
      .single();

    if (error || !kural) {
      setHata(error?.message ?? "Kural oluşturulamadı.");
      setIslemSuruyor(false);
      return;
    }

    const { error: tarafErr } = await db.from("sod_kural_taraflari").insert([
      { rule_id: kural.id, taraf: "A", aktivite_kodu: tarafAAktivite.trim() },
      { rule_id: kural.id, taraf: "B", aktivite_kodu: tarafBAktivite.trim() },
    ]);
    if (tarafErr) {
      setHata(tarafErr.message);
    } else {
      setYeniKod("");
      setYeniAd("");
      setYeniKaynakReferansi("");
      setTarafAAktivite("");
      setTarafBAktivite("");
      setFormAcik(false);
      await yukle();
    }
    setIslemSuruyor(false);
  }

  if (yukleniyor) {
    return <p className="text-sm text-muted-foreground">Yükleniyor…</p>;
  }

  const acikSayisi = catismalar.filter((c) => !["RESOLVED", "FALSE_POSITIVE"].includes(c.durum)).length;
  const onemDagilimi = ONEM_OPTIONS.map((o) => ({
    onem: o,
    sayi: catismalar.filter((c) => c.onem === o && !["RESOLVED", "FALSE_POSITIVE"].includes(c.durum)).length,
  })).filter((d) => d.sayi > 0);

  const gorunenCatismalar = catismalar.filter(
    (c) =>
      (durumFiltre === "HEPSI" || c.durum === durumFiltre) &&
      (onemFiltre === "HEPSI" || c.onem === onemFiltre),
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Görevler Ayrılığı</h1>
          <p className="text-sm text-muted-foreground">
            Kritik işlemlerin çatışan aşamalarının aynı kişide birleşip birleşmediğini
            değerlendirir; tam ayrım mümkün değilse süreli, test edilebilir bir telafi edici
            kontrol izler.
          </p>
        </div>
        <Button disabled={islemSuruyor} onClick={degerlendirmeCalistir}>
          Değerlendirmeyi Çalıştır
        </Button>
      </div>

      {hata && <p className="text-sm text-destructive">{hata}</p>}

      {/* --- ÖZET --- */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Açık Çatışma</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-semibold tabular-nums">{acikSayisi}</span>
          </CardContent>
        </Card>
        <Card className="sm:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Önem Dağılımı</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {onemDagilimi.length === 0 ? (
              <span className="text-sm text-muted-foreground">Açık çatışma yok.</span>
            ) : (
              onemDagilimi.map((d) => (
                <StatusBadge key={d.onem} durum={ONEM_SEMANTIK[d.onem as keyof typeof ONEM_SEMANTIK]}>
                  {ONEM_LABEL[d.onem as keyof typeof ONEM_LABEL]}: {d.sayi}
                </StatusBadge>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Son Değerlendirme</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-sm">
              {sonCalistirma ? new Date(sonCalistirma).toLocaleString("tr-TR") : "Hiç çalıştırılmadı"}
            </span>
          </CardContent>
        </Card>
      </div>

      {/* --- KURAL LİSTESİ --- */}
      <Card>
        <CardHeader>
          <CardTitle>Kurallar ({kurallar.length})</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {kurallar.length === 0 ? (
            <p className="text-sm text-muted-foreground">Henüz kural tanımlanmadı.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kod</TableHead>
                  <TableHead>Ad</TableHead>
                  <TableHead>Önem</TableHead>
                  <TableHead>Kaynak</TableHead>
                  <TableHead>Mevzuat durumu</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {kurallar.map((k) => (
                  <TableRow key={k.id}>
                    <TableCell className="font-mono text-xs">{k.kod}</TableCell>
                    <TableCell>{k.ad}</TableCell>
                    <TableCell>
                      <StatusBadge durum={ONEM_SEMANTIK[k.onem as keyof typeof ONEM_SEMANTIK]}>
                        {ONEM_LABEL[k.onem as keyof typeof ONEM_LABEL]}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {k.kaynak_turu === "spk_notu" ? k.kaynak_referansi ?? "SPK notu" : "İç kural"}
                    </TableCell>
                    <TableCell>
                      <LegalStatusBadge mevzuatDurumu={k.mevzuat_durumu} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {!formAcik ? (
            <Button variant="outline" size="sm" className="w-fit" onClick={() => setFormAcik(true)}>
              + Yeni kural
            </Button>
          ) : (
            <form onSubmit={yeniKuralEkle} className="flex flex-col gap-3 rounded-lg border p-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="yeni-kod">Kod</Label>
                  <Input
                    id="yeni-kod"
                    value={yeniKod}
                    onChange={(e) => setYeniKod(e.target.value)}
                    placeholder="ör. SOD-01"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="yeni-ad">Ad</Label>
                  <Input
                    id="yeni-ad"
                    value={yeniAd}
                    onChange={(e) => setYeniAd(e.target.value)}
                    placeholder="ör. Talep eden onaylayamaz"
                    required
                  />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="taraf-a">Taraf A — aktivite kodu</Label>
                  <Input
                    id="taraf-a"
                    value={tarafAAktivite}
                    onChange={(e) => setTarafAAktivite(e.target.value)}
                    placeholder="ör. KANIT_YUKLE"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="taraf-b">Taraf B — aktivite kodu</Label>
                  <Input
                    id="taraf-b"
                    value={tarafBAktivite}
                    onChange={(e) => setTarafBAktivite(e.target.value)}
                    placeholder="ör. KANIT_ONAYLA"
                    required
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Aynı kişinin hem Taraf A hem Taraf B aktivitesine sahip olması çatışma sayılır.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="yeni-onem">Önem</Label>
                  <Select items={ONEM_LABEL} value={yeniOnem} onValueChange={(v) => setYeniOnem(v ?? "kritik")}>
                    <SelectTrigger id="yeni-onem">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ONEM_OPTIONS.map((o) => (
                        <SelectItem key={o} value={o}>
                          {ONEM_LABEL[o]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="yeni-kaynak">Kaynak</Label>
                  <Select
                    items={{ internal: "İç kural (KALKAN_OS tasarımı)", spk_notu: "SPK çalışma notu" }}
                    value={yeniKaynakTuru}
                    onValueChange={(v) => setYeniKaynakTuru((v ?? "internal") as "internal" | "spk_notu")}
                  >
                    <SelectTrigger id="yeni-kaynak">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="internal">İç kural (KALKAN_OS tasarımı)</SelectItem>
                      <SelectItem value="spk_notu">SPK çalışma notu</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {yeniKaynakTuru === "spk_notu" && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="yeni-referans">Kaynak referansı</Label>
                  <Input
                    id="yeni-referans"
                    value={yeniKaynakReferansi}
                    onChange={(e) => setYeniKaynakReferansi(e.target.value)}
                    placeholder="ör. SPL 1020 §5"
                  />
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    SPK kaynaklı kural &ldquo;Doğrulanmadı&rdquo; durumunda doğar; hukuki bağlayıcılık
                    ayrı bir onay gerektirir.
                  </p>
                </div>
              )}
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

      {/* --- ÇATIŞMA LİSTESİ --- */}
      <Card>
        <CardHeader>
          <CardTitle>Çatışmalar ({gorunenCatismalar.length})</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="durum-filtre">Durum</Label>
              <Select items={DURUM_FILTRE_ITEMS} value={durumFiltre} onValueChange={(v) => setDurumFiltre(v ?? "HEPSI")}>
                <SelectTrigger id="durum-filtre" className="w-52">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.keys(DURUM_FILTRE_ITEMS).map((d) => (
                    <SelectItem key={d} value={d}>
                      {DURUM_FILTRE_ITEMS[d]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="onem-filtre">Önem</Label>
              <Select
                items={{ HEPSI: "Tümü", ...ONEM_LABEL }}
                value={onemFiltre}
                onValueChange={(v) => setOnemFiltre(v ?? "HEPSI")}
              >
                <SelectTrigger id="onem-filtre" className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="HEPSI">Tümü</SelectItem>
                  {ONEM_OPTIONS.map((o) => (
                    <SelectItem key={o} value={o}>
                      {ONEM_LABEL[o]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {gorunenCatismalar.length === 0 ? (
            <EmptyState
              title="Çatışma yok"
              description="Değerlendirmeyi çalıştırarak mevcut atamalar üzerinde SoD taraması yapın."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kural</TableHead>
                  <TableHead>Sistem kapsamı</TableHead>
                  <TableHead>Önem</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>Son görülme</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {gorunenCatismalar.map((c) => {
                  const kural = kurallar.find((k) => k.id === c.rule_id);
                  return (
                    <TableRow key={c.id}>
                      <TableCell>{kural?.ad ?? kural?.kod ?? "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{c.sistem_kapsami}</TableCell>
                      <TableCell>
                        <StatusBadge durum={ONEM_SEMANTIK[c.onem as keyof typeof ONEM_SEMANTIK]}>
                          {ONEM_LABEL[c.onem as keyof typeof ONEM_LABEL]}
                        </StatusBadge>
                      </TableCell>
                      <TableCell>
                        <StatusBadge durum={SOD_CATISMA_DURUM_SEMANTIK[c.durum] ?? "unknown"}>
                          {SOD_CATISMA_DURUM_LABEL[c.durum]}
                        </StatusBadge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(c.son_gorulme_at).toLocaleString("tr-TR")}
                      </TableCell>
                      <TableCell>
                        <Link href={`/sod/${c.id}`} className="text-sm underline underline-offset-2">
                          Detay
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
