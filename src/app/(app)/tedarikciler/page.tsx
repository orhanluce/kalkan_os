"use client";

// Tedarikçi / ICT tedarik zinciri riski — İNDEKS (M35, G4). Oluştur + listele +
// yoğunlaşma özeti. Detay (hizmet/dördüncü-taraf/sözleşme/çıkış planı/karar/
// RoI) /tedarikciler/[id]'de.
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { StatusBadge, type SemantikDurum } from "@/components/durum/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { konsantrasyonAnalizi, type TedarikciGraf } from "@/lib/tedarikci";
import { createClient } from "@/lib/supabase/client";

export const TIER: Record<string, { etiket: string; semantik: SemantikDurum }> = {
  KRITIK: { etiket: "Kritik", semantik: "danger" },
  ONEMLI: { etiket: "Önemli", semantik: "warning" },
  DUSUK: { etiket: "Düşük", semantik: "neutral" },
};
export const KARAR: Record<string, { etiket: string; semantik: SemantikDurum }> = {
  INCELEME: { etiket: "İncelemede", semantik: "legal-review" },
  ONAYLANDI: { etiket: "Onaylandı", semantik: "success" },
  REDDEDILDI: { etiket: "Reddedildi", semantik: "danger" },
};

interface Tedarikci {
  id: string;
  ad: string;
  tier: string;
  karar: string;
  durum: string;
}
interface Sablon {
  id: string;
  tur: string;
  soru: string;
  aktif: boolean;
  kategori: string | null;
  kaynak_citation: string | null;
  kaynak_surumu: string | null;
  dogrulama_durumu: string;
}

// 11 bulut alanı (Dikey 3).
const BULUT_KATEGORI: Record<string, string> = {
  BULUT_ENVANTERI: "Bulut envanteri",
  SHARED_RESPONSIBILITY: "Shared responsibility",
  SLA_GUVENLIK: "SLA / güvenlik",
  DORDUNCU_TARAF: "Dördüncü taraf",
  VERI_LOKASYON: "Veri lokasyonu",
  IAM_LOG: "IAM / merkezi log",
  OLAY_BILDIRIM: "Olay bildirim süresi",
  YEDEKLEME_KURTARMA: "Yedekleme / kurtarma",
  VERI_IMHA: "Güvenli imha",
  CIKIS_PLANI: "Çıkış / ikame",
  DDOS_KAPASITE: "DDoS / kapasite",
};

export default function TedariklerPage() {
  const [liste, setListe] = useState<Tedarikci[]>([]);
  const [konsantrasyon, setKonsantrasyon] = useState<ReturnType<typeof konsantrasyonAnalizi> | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState<string | null>(null);
  const [yeniAd, setYeniAd] = useState("");
  const [yeniTier, setYeniTier] = useState("DUSUK");
  const [sablonlar, setSablonlar] = useState<Sablon[]>([]);
  const [sTur, setSTur] = useState("DORA");
  const [sSoru, setSSoru] = useState("");
  const [sKategori, setSKategori] = useState("");
  const [sCitation, setSCitation] = useState("");
  const [sSurum, setSSurum] = useState("");

  const yukle = useCallback(async () => {
    const db = createClient();
    const { data: tps } = await db
      .from("third_parties")
      .select("id, ad, tier, karar, durum, third_party_services (kritik), fourth_parties (id, ad, bilinmiyor)")
      .order("ad");
    const rows = (tps ?? []) as unknown as (Tedarikci & {
      third_party_services: { kritik: boolean }[];
      fourth_parties: { id: string; ad: string | null; bilinmiyor: boolean }[];
    })[];
    setListe(rows.map((t) => ({ id: t.id, ad: t.ad, tier: t.tier, karar: t.karar, durum: t.durum })));
    const graf: TedarikciGraf[] = rows.map((t) => ({
      id: t.id,
      ad: t.ad,
      tier: t.tier as TedarikciGraf["tier"],
      kritikHizmetVar: (t.third_party_services ?? []).some((s) => s.kritik),
      dorduncuTaraflar: (t.fourth_parties ?? []).map((f) => ({ id: f.id, ad: f.ad, bilinmiyor: f.bilinmiyor })),
    }));
    setKonsantrasyon(konsantrasyonAnalizi(graf));
    const { data: sb } = await db
      .from("assessment_question_templates")
      .select("id, tur, soru, aktif, kategori, kaynak_citation, kaynak_surumu, dogrulama_durumu")
      .order("tur")
      .order("sira");
    setSablonlar((sb ?? []) as Sablon[]);
    setYukleniyor(false);
  }, []);

  useEffect(() => {
    const c = async () => {
      await yukle();
    };
    void c();
  }, [yukle]);

  const olustur = useCallback(async () => {
    setHata(null);
    if (!yeniAd.trim()) return;
    const db = createClient();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) return;
    const { data: profil } = await db.from("profiles").select("tenant_id").eq("id", user.id).maybeSingle();
    if (!profil?.tenant_id) {
      setHata("Kurum bağlamı çözülemedi.");
      return;
    }
    const { error } = await db.from("third_parties").insert({ tenant_id: profil.tenant_id, ad: yeniAd.trim(), tier: yeniTier });
    if (error) {
      setHata(error.message);
      return;
    }
    setYeniAd("");
    await yukle();
  }, [yeniAd, yeniTier, yukle]);

  // Doğrulanmış anket şablonu (M35 sonraki dilim, §8.0 sonu öncelik #3): tenant
  // kendi soru bankasını yazar (KALKAN_OS soru İÇERİĞİ uydurmaz, kural 3/12
  // ruhu) — bir kez yazılır, her yeni değerlendirmede tekrar yazılmadan kopyalanır.
  const sablonEkle = useCallback(async () => {
    setHata(null);
    if (!sSoru.trim()) return;
    const db = createClient();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) return;
    const { data: profil } = await db.from("profiles").select("tenant_id").eq("id", user.id).maybeSingle();
    if (!profil?.tenant_id) return setHata("Kurum bağlamı çözülemedi.");
    // Pak maddesi TODO_DOGRULA doğar (kural 6) — içerik/kaynak tenant girdisi.
    const { error } = await db.from("assessment_question_templates").insert({
      tenant_id: profil.tenant_id,
      tur: sTur,
      soru: sSoru.trim(),
      kategori: sKategori || null,
      kaynak_citation: sCitation.trim() || null,
      kaynak_surumu: sSurum.trim() || null,
    });
    if (error) return setHata(error.message);
    setSSoru("");
    setSCitation("");
    setSSurum("");
    await yukle();
  }, [sTur, sSoru, sKategori, sCitation, sSurum, yukle]);

  // Doğrulama (kural 6): pak maddesini İNSAN doğrulayıcı olarak VERIFIED yap.
  const sablonDogrula = useCallback(
    async (id: string) => {
      setHata(null);
      const db = createClient();
      const {
        data: { user },
      } = await db.auth.getUser();
      if (!user) return;
      const { error } = await db
        .from("assessment_question_templates")
        .update({ dogrulama_durumu: "VERIFIED", dogrulayan: user.id, dogrulama_zamani: new Date().toISOString() })
        .eq("id", id);
      if (error) setHata(error.message);
      await yukle();
    },
    [yukle],
  );

  const sablonPasifYap = useCallback(
    async (id: string) => {
      setHata(null);
      const db = createClient();
      const { error } = await db.from("assessment_question_templates").update({ aktif: false }).eq("id", id);
      if (error) setHata(error.message);
      await yukle();
    },
    [yukle],
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Tedarikçiler</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Üçüncü/dördüncü taraf ICT tedarik zinciri riski. Vendor kararı yalnız insana aittir (dış
          rating otomatik karar değildir); çıkış planı tatbikat kanıtı olmadan &quot;test edildi&quot;
          işaretlenemez; bilinmeyen alt-bağımlılık düşük risk sayılmaz.
        </p>
      </div>

      {hata ? (
        <p role="alert" className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {hata}
        </p>
      ) : null}

      {konsantrasyon && (konsantrasyon.yogunlasmaNoktalari.length > 0 || konsantrasyon.bilinmeyenBagimliligiOlanlar.length > 0) ? (
        <Card>
          <CardHeader>
            <CardTitle>Yoğunlaşma sinyalleri</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {konsantrasyon.yogunlasmaNoktalari.map((y) => (
              <div key={y.dorduncuTarafAd} className="flex flex-wrap items-center gap-2">
                <StatusBadge durum="warning">Yoğunlaşma</StatusBadge>
                <span>
                  <strong>{y.dorduncuTarafAd}</strong> — {y.bagimliTedarikciler.join(", ")}
                </span>
              </div>
            ))}
            {konsantrasyon.bilinmeyenBagimliligiOlanlar.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge durum="unknown">Bilinmeyen bağımlılık</StatusBadge>
                <span>{konsantrasyon.bilinmeyenBagimliligiOlanlar.join(", ")} (düşük risk varsayılmaz)</span>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Yeni tedarikçi</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="tp-ad">Ad</Label>
              <Input id="tp-ad" value={yeniAd} onChange={(e) => setYeniAd(e.target.value)} placeholder="Bulut Sağlayıcı A.Ş." className="w-72" />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="tp-tier">Kritiklik</Label>
              <select id="tp-tier" value={yeniTier} onChange={(e) => setYeniTier(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm">
                <option value="KRITIK">Kritik</option>
                <option value="ONEMLI">Önemli</option>
                <option value="DUSUK">Düşük</option>
              </select>
            </div>
            <Button onClick={() => void olustur()} disabled={!yeniAd.trim()}>
              Oluştur
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tedarikçiler ({liste.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {yukleniyor ? (
            <p className="text-sm text-muted-foreground">Yükleniyor…</p>
          ) : liste.length === 0 ? (
            <p className="text-sm text-muted-foreground">Henüz tedarikçi yok.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ad</TableHead>
                    <TableHead>Kritiklik</TableHead>
                    <TableHead>Karar</TableHead>
                    <TableHead>Durum</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {liste.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">
                        <Link href={`/tedarikciler/${t.id}`} className="text-primary hover:underline">
                          {t.ad}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <StatusBadge durum={TIER[t.tier]?.semantik ?? "neutral"}>{TIER[t.tier]?.etiket ?? t.tier}</StatusBadge>
                      </TableCell>
                      <TableCell>
                        <StatusBadge durum={KARAR[t.karar]?.semantik ?? "neutral"}>{KARAR[t.karar]?.etiket ?? t.karar}</StatusBadge>
                      </TableCell>
                      <TableCell className="text-xs">{t.durum}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Anket şablonları ({sablonlar.filter((s) => s.aktif).length} aktif)</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <p className="text-muted-foreground">
            Kendi due-diligence soru bankanız — bir kez yazılır, her tedarikçi değerlendirmesinde
            tekrar yazılmadan kopyalanır. Bu ekran soru İÇERİĞİ üretmez; sorular kurumunuzun uyum
            ekibi tarafından girilir.
          </p>
          {Object.entries(
            sablonlar.reduce<Record<string, Sablon[]>>((acc, s) => {
              (acc[s.tur] ??= []).push(s);
              return acc;
            }, {}),
          ).map(([tur, sorular]) => (
            <div key={tur} className="flex flex-col gap-1 border-t pt-2">
              <span className="font-medium">{tur}</span>
              {sorular.map((s) => (
                <div key={s.id} className="flex flex-wrap items-center gap-2 text-xs">
                  <span className={s.aktif ? "" : "text-muted-foreground line-through"}>{s.soru}</span>
                  {s.kategori ? <StatusBadge durum="info">{BULUT_KATEGORI[s.kategori] ?? s.kategori}</StatusBadge> : null}
                  {s.kaynak_citation ? (
                    <span className="text-muted-foreground">
                      [{s.kaynak_citation}
                      {s.kaynak_surumu ? ` · ${s.kaynak_surumu}` : ""}]
                    </span>
                  ) : null}
                  <StatusBadge durum={s.dogrulama_durumu === "VERIFIED" ? "success" : s.dogrulama_durumu === "YURURLUKTEN_KALKTI" ? "neutral" : "warning"}>
                    {s.dogrulama_durumu === "VERIFIED" ? "Doğrulandı" : s.dogrulama_durumu === "YURURLUKTEN_KALKTI" ? "Yürürlükten kalktı" : "Doğrulanmadı"}
                  </StatusBadge>
                  {s.dogrulama_durumu === "TODO_DOGRULA" ? (
                    <Button size="sm" variant="outline" onClick={() => void sablonDogrula(s.id)}>
                      Doğrula (VERIFIED)
                    </Button>
                  ) : null}
                  {!s.aktif ? (
                    <StatusBadge durum="neutral">Pasif</StatusBadge>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => void sablonPasifYap(s.id)}>
                      Pasif Yap
                    </Button>
                  )}
                </div>
              ))}
            </div>
          ))}
          <div className="flex flex-wrap items-end gap-2 border-t pt-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="sb-tur">Değerlendirme türü</Label>
              <select id="sb-tur" value={sTur} onChange={(e) => setSTur(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm">
                <option value="GUVENLIK">Güvenlik</option>
                <option value="GIZLILIK">Gizlilik</option>
                <option value="FINANSAL">Finansal</option>
                <option value="OPERASYONEL">Operasyonel</option>
                <option value="DORA">DORA</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="sb-soru">Soru</Label>
              <Input id="sb-soru" value={sSoru} onChange={(e) => setSSoru(e.target.value)} className="w-72" />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="sb-kategori">Bulut alanı (opsiyonel)</Label>
              <select id="sb-kategori" value={sKategori} onChange={(e) => setSKategori(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm">
                <option value="">—</option>
                {Object.entries(BULUT_KATEGORI).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="sb-citation">Kaynak künyesi (opsiyonel)</Label>
              <Input id="sb-citation" value={sCitation} onChange={(e) => setSCitation(e.target.value)} placeholder="ör. DORA md.28" className="w-44" />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="sb-surum">Kaynak sürümü (opsiyonel)</Label>
              <Input id="sb-surum" value={sSurum} onChange={(e) => setSSurum(e.target.value)} placeholder="ör. RTS-2024" className="w-32" />
            </div>
            <Button size="sm" onClick={() => void sablonEkle()} disabled={!sSoru.trim()}>
              Şablona Ekle
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
