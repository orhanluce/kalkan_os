"use client";

// Dayanıklılık Etki Grafiği (Dikey 5, nihai talimat v3.3 §8.0): M13'ün kritik
// hizmet grafını (critical_business_services/service_dependencies) M35
// tedarikçi zinciriyle ve YENİ kontrol kenarıyla (critical_service_controls)
// genişletir. Yeni bir graf DB kurulmadı — mevcut tablolar üzerinde saf
// türetim (src/lib/etki-analizi.ts, kural 11). "Tek sahte skor YOK": öncelik
// listesi AÇIKLANABİLİR faktörlerle döner, tek bir opak sayı üretilmez.
//
// M21/M42 taksonomisi: tezden 8 üst alan (THESIS_DERIVED/TODO_DOGRULA doğar,
// VERIFIED seed yok). Sınıflandırma kararı burada değil dört-göz kuyruğunda
// (aşağıdaki "İncelemeye Al / Onayla / Reddet" — obligations deseni).
import { useCallback, useEffect, useState } from "react";
import { StatusBadge } from "@/components/durum/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { tekilNoktaAnalizi, type KritikHizmetGraf } from "@/lib/dayaniklilik";
import {
  DAYANIKLILIK_ALAN_ETIKETLERI,
  dayaniklilikKapsamOzeti,
  enCokKritikHizmetEtkileyenKontroller,
  iyilestirmeOnceligiSirala,
  zincirlemeEtkiYollari,
  type KontrolBagi,
} from "@/lib/etki-analizi";
import { createClient } from "@/lib/supabase/client";
import { konsantrasyonAnalizi, type TedarikciGraf } from "@/lib/tedarikci";
import type { DugumTuru, TekNoktaTespitSonucu, EtkiYayilimSonucu } from "@/lib/impact-graph";

const DUGUM_TUR_ETIKET: Record<DugumTuru, string> = {
  KRITIK_HIZMET: "Kritik hizmet",
  BAGIMLILIK: "Bağımlılık",
  UCUNCU_TARAF: "Üçüncü taraf",
  ALT_YUKLENICI: "Alt yüklenici",
  ICT_HIZMETI: "ICT hizmeti",
  KONTROL: "Kontrol",
  MEVZUAT: "Mevzuat",
  TEST: "Test",
  BULGU: "Bulgu",
  KANIT: "Kanıt",
};

interface AnlikGoruntuSonucu {
  id: string;
  grafHash: string;
  olusturulmaZamani: string;
  dugumSayisi: number;
  kenarSayisi: number;
  spofRaporu: TekNoktaTespitSonucu;
  yayilimRaporu: { baslangicKontrolDugumIdleri: string[]; geri: EtkiYayilimSonucu | null; ileri: EtkiYayilimSonucu | null };
}

interface Siniflandirma {
  id: string;
  control_id: string;
  kategori: string;
  dogrulama_durumu: string;
  gerekce: string | null;
  controls: { madde_ref: string; baslik: string } | null;
}
interface KontrolSecenegi {
  id: string;
  ref: string;
}

export default function DayaniklilikPage() {
  const [kapsam, setKapsam] = useState<ReturnType<typeof dayaniklilikKapsamOzeti>>([]);
  const [zincirler, setZincirler] = useState<ReturnType<typeof zincirlemeEtkiYollari>>([]);
  const [kontrolEtkisi, setKontrolEtkisi] = useState<ReturnType<typeof enCokKritikHizmetEtkileyenKontroller>>([]);
  const [oncelik, setOncelik] = useState<ReturnType<typeof iyilestirmeOnceligiSirala>>([]);
  const [siniflandirmalar, setSiniflandirmalar] = useState<Siniflandirma[]>([]);
  const [kontrolSecenekleri, setKontrolSecenekleri] = useState<KontrolSecenegi[]>([]);
  const [sSecim, setSSecim] = useState("");
  const [sKategori, setSKategori] = useState("YONETISIM");
  const [sGerekce, setSGerekce] = useState("");
  const [hata, setHata] = useState<string | null>(null);
  const [anlikGoruntu, setAnlikGoruntu] = useState<AnlikGoruntuSonucu | null>(null);
  const [anlikGoruntuOlusturuluyor, setAnlikGoruntuOlusturuluyor] = useState(false);
  const [proofLinki, setProofLinki] = useState<string | null>(null);

  const yukle = useCallback(async () => {
    const db = createClient();

    const [{ data: hizmetler }, { data: bagimliliklar }, { data: tedarikciler }, { data: dorduncuTaraflar }, { data: kontrolBaglari }, { data: siniflar }, { data: acikBulgular }, { data: kontroller }] =
      await Promise.all([
        db.from("critical_business_services").select("id, ad"),
        db.from("service_dependencies").select("critical_service_id, ad, bagimlilik_turu, third_party_id, tekil_nokta"),
        db.from("third_parties").select("id, ad, tier"),
        db.from("fourth_parties").select("third_party_id, ad, bilinmiyor"),
        db.from("critical_service_controls").select("critical_service_id, control_id, controls (madde_ref, baslik)"),
        db.from("control_resilience_domains").select("id, control_id, kategori, dogrulama_durumu, gerekce, controls (madde_ref, baslik)").order("created_at", { ascending: false }),
        db.from("findings").select("kaynak_test_definition_id, onem").eq("durum", "acik").in("onem", ["acil", "kritik", "yuksek"]),
        db.from("controls").select("id, madde_ref").order("madde_ref").limit(100),
      ]);

    setKontrolSecenekleri((kontroller ?? []).map((k) => ({ id: k.id, ref: k.madde_ref })));
    setSiniflandirmalar((siniflar ?? []) as unknown as Siniflandirma[]);

    const hizmetMap = new Map((hizmetler ?? []).map((h) => [h.id, h.ad]));
    const tedarikciMap = new Map((tedarikciler ?? []).map((t) => [t.id, t.ad]));

    // --- Tekil nokta (M13, mevcut fonksiyon — tekrar edilmedi) ---
    const graf: KritikHizmetGraf[] = (hizmetler ?? []).map((h) => ({
      id: h.id,
      ad: h.ad,
      bagimliliklar: (bagimliliklar ?? [])
        .filter((b) => b.critical_service_id === h.id)
        .map((b) => ({ ad: b.ad, bagimlilikTuru: b.bagimlilik_turu, tekilNokta: b.tekil_nokta })),
    }));
    const tekilNoktaSonucu = tekilNoktaAnalizi(graf);
    const sistemikHizmetAdlari = new Set(tekilNoktaSonucu.sistemikNoktalar.flatMap((s) => s.etkilenenHizmetler));

    // --- Tedarikçi yoğunlaşması (M35, mevcut fonksiyon — tekrar edilmedi) ---
    const tedarikciGraf: TedarikciGraf[] = (tedarikciler ?? []).map((t) => ({
      id: t.id,
      ad: t.ad,
      tier: t.tier as TedarikciGraf["tier"],
      kritikHizmetVar: (bagimliliklar ?? []).some((b) => b.third_party_id === t.id),
      dorduncuTaraflar: (dorduncuTaraflar ?? []).filter((d) => d.third_party_id === t.id).map((d) => ({ id: t.id, ad: d.ad, bilinmiyor: d.bilinmiyor })),
    }));
    const konsantrasyon = konsantrasyonAnalizi(tedarikciGraf);
    const yogunTedarikciAdlari = new Set(konsantrasyon.yogunlasmaNoktalari.flatMap((y) => y.bagimliTedarikciler));

    // --- Zincirleme etki yolu (Dikey 5 — YENİ kenar) ---
    setZincirler(
      zincirlemeEtkiYollari(
        (hizmetler ?? []).map((h) => ({
          kritikHizmetAd: h.ad,
          bagimliliklar: (bagimliliklar ?? []).filter((b) => b.critical_service_id === h.id).map((b) => ({ bagimlilikTuru: b.bagimlilik_turu, thirdPartyId: b.third_party_id })),
        })),
        (tedarikciler ?? []).map((t) => ({
          thirdPartyId: t.id,
          thirdPartyAd: t.ad,
          dorduncuTaraflar: (dorduncuTaraflar ?? []).filter((d) => d.third_party_id === t.id).map((d) => ({ ad: d.ad, bilinmiyor: d.bilinmiyor })),
        })),
      ),
    );

    // --- En çok kritik hizmet etkileyen kontroller (Dikey 5 — YENİ kenar) ---
    const baglar: KontrolBagi[] = (kontrolBaglari ?? [])
      .map((k) => ({
        kritikHizmetAd: hizmetMap.get(k.critical_service_id) ?? "?",
        controlId: k.control_id,
        controlAd: (k.controls as unknown as { madde_ref: string } | null)?.madde_ref ?? k.control_id,
      }))
      .filter((b) => b.kritikHizmetAd !== "?");
    const kEtkisi = enCokKritikHizmetEtkileyenKontroller(baglar);
    setKontrolEtkisi(kEtkisi);

    // --- Kapsam özeti (M21/M42 — 8 üst alan) ---
    setKapsam(dayaniklilikKapsamOzeti((siniflar ?? []).map((s) => ({ kategori: s.kategori, dogrulamaDurumu: s.dogrulama_durumu }))));

    // --- Açık kritik/yüksek bulgusu olan kontroller ---
    const testTanimIds = [...new Set((acikBulgular ?? []).map((b) => b.kaynak_test_definition_id).filter(Boolean))] as string[];
    let acikControlIds = new Set<string>();
    if (testTanimIds.length > 0) {
      const { data: tanimlar } = await db.from("control_test_definitions").select("id, control_id").in("id", testTanimIds);
      acikControlIds = new Set((tanimlar ?? []).map((t) => t.control_id));
    }

    // --- İyileştirme önceliği (açıklanabilir faktörler — tek sahte skor yok) ---
    const hizmetleriByControl = new Map<string, Set<string>>();
    for (const b of baglar) {
      if (!hizmetleriByControl.has(b.controlId)) hizmetleriByControl.set(b.controlId, new Set());
      hizmetleriByControl.get(b.controlId)!.add(b.kritikHizmetAd);
    }
    setOncelik(
      iyilestirmeOnceligiSirala(
        kEtkisi.map((k) => {
          const hizmetAdlari = hizmetleriByControl.get(k.controlId) ?? new Set();
          const sistemik = [...hizmetAdlari].some((ad) => sistemikHizmetAdlari.has(ad));
          const yogunlasma = (bagimliliklar ?? [])
            .filter((b) => hizmetAdlari.has(hizmetMap.get(b.critical_service_id) ?? ""))
            .some((b) => b.third_party_id && yogunTedarikciAdlari.has((tedarikciMap.get(b.third_party_id) ?? "").trim().toLowerCase()));
          return {
            hedefId: k.controlId,
            hedefAd: k.controlAd,
            etkilenenHizmetSayisi: k.etkilenenHizmetSayisi,
            sistemikTekilNoktaMi: sistemik,
            tedarikciYogunlasmaNoktasiMi: yogunlasma,
            acikKritikBulguVarMi: acikControlIds.has(k.controlId),
          };
        }),
      ),
    );
  }, []);

  useEffect(() => {
    const c = async () => {
      await yukle();
    };
    void c();
  }, [yukle]);

  const eylemGonder = useCallback(
    async (govde: Record<string, unknown>) => {
      setHata(null);
      const res = await fetch("/api/dayaniklilik/siniflandirma", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(govde),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { hata?: string };
        setHata(j.hata ?? "İşlem başarısız.");
        return;
      }
      await yukle();
    },
    [yukle],
  );

  const anlikGoruntuOlustur = useCallback(async () => {
    setHata(null);
    setProofLinki(null);
    setAnlikGoruntuOlusturuluyor(true);
    const res = await fetch("/api/dayaniklilik/graf/anlik-goruntu", { method: "POST" });
    const govde = (await res.json().catch(() => ({}))) as AnlikGoruntuSonucu & { hata?: string };
    setAnlikGoruntuOlusturuluyor(false);
    if (!res.ok) return setHata(govde.hata ?? "Anlık görüntü oluşturulamadı.");
    setAnlikGoruntu(govde);
  }, []);

  const proofLinkiOlustur = useCallback(async () => {
    if (!anlikGoruntu) return;
    setHata(null);
    const res = await fetch("/api/proof-room", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eylem: "olustur", graphSnapshotId: anlikGoruntu.id }),
    });
    const govde = (await res.json().catch(() => ({}))) as { url?: string; hata?: string };
    if (!res.ok || !govde.url) return setHata(govde.hata ?? "Proof Room linki oluşturulamadı.");
    setProofLinki(govde.url);
  }, [anlikGoruntu]);

  const siniflandirmaOner = useCallback(async () => {
    if (!sSecim) return;
    await eylemGonder({ eylem: "olustur", controlId: sSecim, kategori: sKategori, gerekce: sGerekce.trim() || undefined });
    setSSecim("");
    setSGerekce("");
  }, [sSecim, sKategori, sGerekce, eylemGonder]);

  const DURUM_ROZET: Record<string, "neutral" | "legal-review" | "success" | "danger" | "warning"> = {
    DRAFT_RESEARCH: "neutral",
    TODO_DOGRULA: "warning",
    LEGAL_REVIEW: "legal-review",
    VERIFIED: "success",
    SUPERSEDED: "neutral",
    REJECTED: "danger",
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dayanıklılık Etki Grafiği</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Kritik hizmet grafının (M13) tedarikçi zinciri (M35) ve kontrol kenarıyla genişlemesi. M21/M42 taksonomisi
          tezden türeyen 8 üst alandır (THESIS_DERIVED, VERIFIED seed yok — sınıflandırma dört-gözden geçer). Öncelik
          listesi açıklanabilir faktörlerle döner; tek bir birleşik skor üretilmez.
        </p>
      </div>

      {hata ? (
        <p role="alert" className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {hata}
        </p>
      ) : null}

      {/* Birleşik etki grafı anlık görüntüsü (Dikey D, ilk dilim) */}
      <Card>
        <CardHeader>
          <CardTitle>Birleşik etki grafı anlık görüntüsü</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <p className="text-xs text-muted-foreground">
            Mevzuat/kritik hizmet/ICT hizmeti/üçüncü taraf/alt yüklenici/kontrol/test/bulgu/kanıt arasındaki zincirleme etkiyi TEK bir
            mühürlü anlık görüntüde birleştirir. Aşağıdaki sonuçlar yapısal bir hesaplamadır, kesin/doğrulanmış gerçek DEĞİLDİR.
          </p>
          <Button size="sm" onClick={() => void anlikGoruntuOlustur()} disabled={anlikGoruntuOlusturuluyor}>
            {anlikGoruntuOlusturuluyor ? "Oluşturuluyor…" : "Anlık Görüntü Oluştur"}
          </Button>
          {anlikGoruntu ? (
            <div data-testid="etki-grafi-anlik-goruntu" className="flex flex-col gap-3 border-t pt-3">
              <p className="text-xs text-muted-foreground" title={anlikGoruntu.grafHash}>
                Graf hash&apos;i: {anlikGoruntu.grafHash} · {anlikGoruntu.dugumSayisi} düğüm · {anlikGoruntu.kenarSayisi} kenar
              </p>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Sistemik tekil noktalar ({anlikGoruntu.spofRaporu.sistemikNoktalar.length}):</p>
                {anlikGoruntu.spofRaporu.sistemikNoktalar.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Bulunamadı.</p>
                ) : (
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {anlikGoruntu.spofRaporu.sistemikNoktalar.map((s) => (
                      <StatusBadge key={s.dugumId} durum="warning">
                        {DUGUM_TUR_ETIKET[s.tur]}: {s.etiket} ({s.etkilenenKritikHizmetIdleri.length})
                      </StatusBadge>
                    ))}
                  </div>
                )}
              </div>
              {anlikGoruntu.yayilimRaporu.baslangicKontrolDugumIdleri.length > 0 ? (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Açık kritik/yüksek bulgulu kontrollerden etkilenen kritik hizmetler:
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {(anlikGoruntu.yayilimRaporu.geri?.etkilenenler ?? []).map((e) => (
                      <StatusBadge key={e.dugumId} durum="danger">
                        {DUGUM_TUR_ETIKET[e.tur]}: {e.etiket}
                      </StatusBadge>
                    ))}
                  </div>
                </div>
              ) : null}
              {proofLinki ? (
                <a href={proofLinki} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">
                  Proof Room linki: {proofLinki}
                </a>
              ) : (
                <Button size="sm" variant="outline" onClick={() => void proofLinkiOlustur()}>
                  Proof Room Linki Oluştur
                </Button>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* 8 üst alan kapsam özeti */}
      <Card>
        <CardHeader>
          <CardTitle>Dayanıklılık taksonomisi kapsamı (8 üst alan)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Alan</TableHead>
                  <TableHead>Sınıflandırma sayısı</TableHead>
                  <TableHead>VERIFIED</TableHead>
                  <TableHead>Kapsam</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {kapsam.map((k) => (
                  <TableRow key={k.kategori}>
                    <TableCell className="font-medium">{k.etiket}</TableCell>
                    <TableCell>{k.toplam}</TableCell>
                    <TableCell>{k.verifiedSayisi}</TableCell>
                    <TableCell>
                      <StatusBadge durum={k.kapsamVar ? "success" : "unknown"}>{k.kapsamVar ? "Kapsanıyor" : "Doğrulanmış kapsam yok"}</StatusBadge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Sınıflandırma öner + dört-göz kuyruğu */}
      <Card>
        <CardHeader>
          <CardTitle>Kontrol sınıflandırmaları ({siniflandirmalar.length})</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          {siniflandirmalar.map((s) => (
            <div key={s.id} data-testid={`siniflandirma-${s.control_id}`} className="flex flex-wrap items-center gap-2 border-b pb-2 last:border-0">
              <span className="font-mono text-xs">{s.controls?.madde_ref ?? s.control_id}</span>
              <StatusBadge durum="info">{DAYANIKLILIK_ALAN_ETIKETLERI[s.kategori] ?? s.kategori}</StatusBadge>
              <StatusBadge durum={DURUM_ROZET[s.dogrulama_durumu] ?? "neutral"}>{s.dogrulama_durumu}</StatusBadge>
              {["DRAFT_RESEARCH", "TODO_DOGRULA"].includes(s.dogrulama_durumu) ? (
                <Button size="sm" variant="outline" onClick={() => void eylemGonder({ eylem: "incelemeye_al", id: s.id })}>
                  İncelemeye Al
                </Button>
              ) : null}
              {s.dogrulama_durumu === "LEGAL_REVIEW" ? (
                <>
                  <Button size="sm" onClick={() => void eylemGonder({ eylem: "onayla", id: s.id })}>
                    Onayla
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void eylemGonder({ eylem: "reddet", id: s.id })}>
                    Reddet
                  </Button>
                </>
              ) : null}
            </div>
          ))}
          <div className="flex flex-wrap items-end gap-2 border-t pt-2">
              <div className="flex flex-col gap-1">
                <Label htmlFor="s-secim">Kontrol</Label>
                <select id="s-secim" value={sSecim} onChange={(e) => setSSecim(e.target.value)} className="h-9 w-56 rounded-md border bg-background px-2 text-sm">
                  <option value="">Seçiniz…</option>
                  {kontrolSecenekleri.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.ref}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="s-kategori">Dayanıklılık alanı</Label>
                <select id="s-kategori" value={sKategori} onChange={(e) => setSKategori(e.target.value)} className="h-9 w-64 rounded-md border bg-background px-2 text-sm">
                  {Object.entries(DAYANIKLILIK_ALAN_ETIKETLERI).map(([kod, etiket]) => (
                    <option key={kod} value={kod}>
                      {etiket}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="s-gerekce">Gerekçe (opsiyonel)</Label>
                <Input id="s-gerekce" value={sGerekce} onChange={(e) => setSGerekce(e.target.value)} className="w-56" />
              </div>
              <Button size="sm" onClick={() => void siniflandirmaOner()} disabled={!sSecim}>
                Sınıflandırma Öner (TODO_DOĞRULA)
              </Button>
            </div>
        </CardContent>
      </Card>

      {/* Zincirleme etki yolu */}
      <Card>
        <CardHeader>
          <CardTitle>Zincirleme etki yolları ({zincirler.length})</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          {zincirler.length === 0 ? (
            <p className="text-muted-foreground">Kritik hizmet → tedarikçi → dördüncü taraf zinciri bulunamadı.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {zincirler.map((z, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <span>{z.kritikHizmetAd}</span>
                  <span className="text-muted-foreground">→</span>
                  <span>{z.tedarikciAd}</span>
                  <span className="text-muted-foreground">→</span>
                  {z.bilinmiyor ? <StatusBadge durum="unknown">Bilinmeyen dördüncü taraf</StatusBadge> : <span>{z.dorduncuTarafAd}</span>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* En çok kritik hizmet etkileyen kontroller */}
      <Card>
        <CardHeader>
          <CardTitle>En çok kritik hizmet etkileyen kontroller</CardTitle>
        </CardHeader>
        <CardContent>
          {kontrolEtkisi.length === 0 ? (
            <p className="text-sm text-muted-foreground">Henüz kritik hizmet↔kontrol bağı yok (kritik hizmet detayından ekleyin).</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kontrol</TableHead>
                    <TableHead>Etkilenen hizmet sayısı</TableHead>
                    <TableHead>Hizmetler</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {kontrolEtkisi.map((k) => (
                    <TableRow key={k.controlId}>
                      <TableCell className="font-mono text-xs">{k.controlAd}</TableCell>
                      <TableCell>{k.etkilenenHizmetSayisi}</TableCell>
                      <TableCell>{k.etkilenenHizmetler.join(", ")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* İyileştirme önceliği — açıklanabilir faktörler */}
      <Card>
        <CardHeader>
          <CardTitle>İyileştirme önceliği (açıklanabilir sinyal — tek sahte skor yok)</CardTitle>
        </CardHeader>
        <CardContent>
          {oncelik.length === 0 ? (
            <p className="text-sm text-muted-foreground">Hiçbir kontrol öncelik faktörü tetiklemiyor.</p>
          ) : (
            <div className="flex flex-col gap-2 text-sm">
              {oncelik.map((o) => (
                <div key={o.hedefId} className="flex flex-wrap items-center gap-2 border-b pb-2 last:border-0">
                  <span className="font-mono text-xs">{o.hedefAd}</span>
                  {o.faktorler.map((f) => (
                    <StatusBadge key={f} durum="warning">
                      {f}
                    </StatusBadge>
                  ))}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
