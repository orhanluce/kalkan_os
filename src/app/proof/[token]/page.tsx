"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge, type SemantikDurum } from "@/components/durum/status-badge";
import {
  sitasyonPaketiOlustur,
  type SitasyonGirdisi,
  type SitasyonPaketi,
} from "@/lib/citation-bundle";
import type { CanonicalDeger } from "@/lib/canonical";
import { makbuzUret, STH_SCHEMA, type AgacBasi, type SeffaflikMakbuzu, type SignedStatement } from "@/lib/transparency";
import type { DetachedImza } from "@/lib/manifest-signature";
import { createClient } from "@/lib/supabase/client";
import { roiSablonCsvYap, roiSablonXlsxYap, ROI_EXPORT_UYARI_METNI } from "@/lib/roi-export-serialize";
import type { RoiSablonPaketi } from "@/lib/roi-export";

// Proof Room — OTURUMSUZ denetçi/regülatör görünümü (G1; nihai §8).
//
// paylasim/[token] deseninin devamı: kapsam, süre ve iptal İSTEMCİDE DEĞİL
// veritabanında (proof_room_goruntule RPC) uygulanır; bu sayfa yalnızca
// görüntüleyicidir. Geçersiz/dolmuş/iptal token aynı "geçersiz" ekranını
// görür. Sayfa ayrıca sunucu verisinden sitasyon paketini TARAYICIDA üretir
// ve indirtir — denetçi paketi `npx tsx scripts/verify-sitasyon.ts` ile
// KALKAN_OS'a erişmeden doğrular (paket İMZASIZ_HASH_BUTUNLUKLU'dur; sahte
// "signed" iddiası yok).

interface ProofZincirSatiri {
  obligationKod: string;
  nitelik: string;
  obligationDogrulama: string;
  mappingDogrulama: string;
  kapsam: string;
  provisionRef: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  provisionDogrulama: string;
  snippet: string;
  artifactBaslik: string;
  artifactSha256: string;
  authority: string;
  kaynakAd: string;
  jurisdiction: string;
  kaynakSeviyesi: string;
  canonicalUrl: string | null;
}

interface ProofVerisi {
  kurumAdi: string;
  sonGecerlilik: string;
  kosu?: {
    id: string;
    sonuc: string;
    gerekce: string;
    calistiAt: string;
    tanimAd: string;
    kontrolMaddeRef: string;
    kontrolBaslik: string;
  };
  legalSnapshot?: { karar: string; snapshot: CanonicalDeger } | null;
  kaynakZinciri?: ProofZincirSatiri[];
  applicability?: {
    obligationKod: string;
    durum: string;
    gerekce: string | null;
    factSnapshotFingerprint: string;
    kararKaynagi: string;
  }[];
  kanit?: { evidenceId: string; dosyaHashSha256: string | null } | null;
  /** G3 şeffaflık defteri durumu (nihai §8.0) — PENDING/ANCHORED/FAILED/KAYITSIZ. */
  ledgerDurumu?: string;
  /** 37 Tez Dikey B, Faz 3: DORA RoI export bağlantısı — kosu ile AYRIK dal. */
  roiExport?: {
    id: string;
    paket: RoiSablonPaketi;
    paketHash: string;
    onKontrolRaporu: { sorunlar: { kod: string; seviye: string; mesaj: string }[]; engelleyiciSayisi: number };
    yayinlanmaZamani: string;
    ledgerDurumu?: string;
    /** 37 Tez Dikey B, Faz 4: alan bazlı, MİNİMİZE provenance özeti — ham iddia/kanıt içeriği YOK. */
    provenanceOzeti?: { alanKodu: string; kaynakDurumu: string; genelDurum: string; iddiaSayisi: number }[] | null;
  };
}

/** proof_room_ledger_malzeme RPC'sinin ham dönüşü — yalnız ANCHORED iken leaves/signedStatement/sth dolu. */
interface LedgerMalzemesi {
  durum: string;
  leafIndex?: number;
  signedStatement?: SignedStatement;
  sth?: { treeSize: number; rootHash: string };
  sthImza?: DetachedImza;
  leaves?: string[];
}

const SONUC_SEMANTIK: Record<string, SemantikDurum> = {
  PASSED: "success",
  FAILED: "danger",
  UNKNOWN: "unknown",
  STALE: "warning",
  EXCEPTION: "neutral",
};

const KARAR_SEMANTIK: Record<string, SemantikDurum> = {
  ALLOW: "success",
  ALLOW_WITH_WARNING: "warning",
  BLOCK: "danger",
};

const DOGRULAMA_ETIKET: Record<string, string> = {
  DRAFT_RESEARCH: "Araştırma taslağı",
  TODO_DOGRULA: "Doğrulanmadı",
  LEGAL_REVIEW: "Hukuk incelemesinde",
  VERIFIED: "Doğrulandı",
  SUPERSEDED: "Yerini yeni sürüm aldı",
  REJECTED: "Reddedildi",
};

const LEDGER_DURUM_SEMANTIK: Record<string, SemantikDurum> = {
  ANCHORED: "success",
  PENDING: "warning",
  DEFTERDE_STH_BEKLIYOR: "warning",
  FAILED: "danger",
  KAYITSIZ: "unknown",
};
const LEDGER_DURUM_ETIKET: Record<string, string> = {
  ANCHORED: "Şeffaflık defterinde mühürlü",
  PENDING: "Mühür bekleniyor (PENDING)",
  DEFTERDE_STH_BEKLIYOR: "Defterde — ağaç başı bekleniyor",
  FAILED: "Mühürleme başarısız",
  KAYITSIZ: "Bu koşu deftere bağlı değil",
};

// 37 Tez Dikey B, Faz 4: roiExport.provenanceOzeti'nin genelDurum alanı için.
const PROVENANCE_ROZET: Record<string, SemantikDurum> = {
  VERIFIED: "success",
  LEGAL_REVIEW_REQUIRED: "legal-review",
  UNVERIFIED: "neutral",
  SURESI_GECMIS_INCELEME_GEREKLI: "warning",
  REDDEDILDI: "danger",
  KAYNAK_YOK: "unknown",
};
const PROVENANCE_ETIKET: Record<string, string> = {
  VERIFIED: "Doğrulanmış",
  LEGAL_REVIEW_REQUIRED: "Hukuki inceleme gerekli",
  UNVERIFIED: "Doğrulanmamış",
  SURESI_GECMIS_INCELEME_GEREKLI: "Süresi geçmiş",
  REDDEDILDI: "Reddedilmiş",
  KAYNAK_YOK: "Kaynak yok",
};

export default function ProofRoomPage() {
  const params = useParams<{ token: string }>();
  const [veri, setVeri] = useState<ProofVerisi | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [paket, setPaket] = useState<SitasyonPaketi | null>(null);
  const [ledgerMalzeme, setLedgerMalzeme] = useState<LedgerMalzemesi | null>(null);
  const [makbuz, setMakbuz] = useState<SeffaflikMakbuzu | null>(null);

  useEffect(() => {
    let iptal = false;
    const yukle = async () => {
      const db = createClient();
      const [{ data }, { data: malzeme }] = await Promise.all([
        db.rpc("proof_room_goruntule", { p_token: params.token }),
        db.rpc("proof_room_ledger_malzeme", { p_token: params.token }),
      ]);
      if (iptal) return;
      setVeri((data as unknown as ProofVerisi | null) ?? null);
      setLedgerMalzeme((malzeme as unknown as LedgerMalzemesi | null) ?? null);
      setYukleniyor(false);
    };
    void yukle();
    return () => {
      iptal = true;
    };
  }, [params.token]);

  // ANCHORED ise makbuzu TARAYICIDA kur (transparency.ts makbuzUret,
  // G3'ten YENİDEN KULLANILIR — Merkle proof burada yeniden yazılmaz).
  useEffect(() => {
    if (!ledgerMalzeme || ledgerMalzeme.durum !== "ANCHORED") return;
    if (!ledgerMalzeme.leaves || ledgerMalzeme.leafIndex === undefined || !ledgerMalzeme.sth || !ledgerMalzeme.sthImza || !ledgerMalzeme.signedStatement) return;
    let iptal = false;
    const kur = async () => {
      const sth: AgacBasi = { schema: STH_SCHEMA, treeSize: ledgerMalzeme.sth!.treeSize, rootHash: ledgerMalzeme.sth!.rootHash };
      const m = await makbuzUret(
        ledgerMalzeme.leaves!,
        ledgerMalzeme.leafIndex!,
        sth,
        ledgerMalzeme.sthImza!,
        ledgerMalzeme.signedStatement!,
      );
      if (!iptal) setMakbuz(m);
    };
    void kur();
    return () => {
      iptal = true;
    };
  }, [ledgerMalzeme]);

  const makbuzIndirmeUrl = useMemo(() => {
    if (!makbuz) return null;
    return URL.createObjectURL(new Blob([JSON.stringify(makbuz, null, 2)], { type: "application/json" }));
  }, [makbuz]);

  // Sitasyon paketi tarayıcıda, sunucudan gelen veriyle üretilir (RFC 8785
  // hash'leri dahil) — indirme sonrası bağımsız CLI doğrulaması için.
  useEffect(() => {
    if (!veri || veri.roiExport || !veri.kosu) return;
    let iptal = false;
    const uret = async () => {
      const girdi: SitasyonGirdisi = {
        testRun: veri.kosu!,
        legalSnapshot: veri.legalSnapshot ?? null,
        kaynakZinciri: (veri.kaynakZinciri ?? []).map((z) => ({
          authority: z.authority,
          kaynakAd: z.kaynakAd,
          jurisdiction: z.jurisdiction,
          kaynakSeviyesi: z.kaynakSeviyesi,
          canonicalUrl: z.canonicalUrl,
          artifactBaslik: z.artifactBaslik,
          artifactSha256: z.artifactSha256,
          provisionRef: z.provisionRef,
          effectiveFrom: z.effectiveFrom,
          effectiveTo: z.effectiveTo,
          provisionDogrulama: z.provisionDogrulama,
          snippet: z.snippet,
          obligationKod: z.obligationKod,
          obligationDogrulama: z.obligationDogrulama,
          mappingDogrulama: z.mappingDogrulama,
          kapsam: z.kapsam,
        })),
        applicability: (veri.applicability ?? []).map((a) => ({
          obligationKod: a.obligationKod,
          durum: a.durum,
          gerekce: a.gerekce,
          factSnapshotFingerprint: a.factSnapshotFingerprint,
          kararKaynagi: a.kararKaynagi,
        })),
        kanit: veri.kanit ?? null,
        auditOlaylari: [],
        aktor: { id: "proof-room", ad: null },
        olusturmaZamani: new Date().toISOString(),
      };
      const p = await sitasyonPaketiOlustur(girdi);
      if (!iptal) setPaket(p);
    };
    void uret();
    return () => {
      iptal = true;
    };
  }, [veri]);

  const indirmeUrl = useMemo(() => {
    if (!paket) return null;
    return URL.createObjectURL(new Blob([JSON.stringify(paket, null, 2)], { type: "application/json" }));
  }, [paket]);

  // DORA RoI export dalı: CSV/XLSX TARAYICIDA, sunucudan gelen paketten
  // üretilir (roi-export-serialize.ts — sitasyon paketinin AYNI deseni).
  // CSV senkron olduğundan useMemo (indirmeUrl'in aynı deseni); XLSX async
  // olduğundan (jszip) useEffect + state gerekiyor.
  const roiCsvUrl = useMemo(() => {
    if (!veri?.roiExport) return null;
    const csv = roiSablonCsvYap(veri.roiExport.paket);
    return URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  }, [veri]);
  const [roiXlsxUrl, setRoiXlsxUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!veri?.roiExport) return;
    let iptal = false;
    const uret = async () => {
      const bayt = await roiSablonXlsxYap(veri.roiExport!.paket);
      if (!iptal) {
        const arabellek = bayt.buffer.slice(bayt.byteOffset, bayt.byteOffset + bayt.byteLength) as ArrayBuffer;
        setRoiXlsxUrl(URL.createObjectURL(new Blob([arabellek], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })));
      }
    };
    void uret();
    return () => {
      iptal = true;
    };
  }, [veri]);

  if (yukleniyor) {
    return <main className="mx-auto max-w-4xl p-6 text-sm text-muted-foreground">Yükleniyor…</main>;
  }
  if (!veri) {
    // Geçersiz/dolmuş/iptal — hepsi AYNI mesaj (ayrım bilgi sızdırır).
    return (
      <main className="mx-auto max-w-4xl p-6">
        <h1 className="text-xl font-semibold">Proof Room</h1>
        <p className="mt-2 text-sm text-muted-foreground">Link geçersiz veya süresi dolmuş.</p>
      </main>
    );
  }

  if (veri.roiExport) {
    const { roiExport } = veri;
    return (
      <main className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Proof Room — {veri.kurumAdi}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            DORA RoI export görünümü. Erişim süresi: {new Date(veri.sonGecerlilik).toLocaleString("tr-TR")} · Bu
            görüntüleme denetim izine kaydedildi.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Export özeti</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <p className="text-xs text-muted-foreground">{ROI_EXPORT_UYARI_METNI}</p>
            <p>
              Yayınlanma zamanı: {new Date(roiExport.yayinlanmaZamani).toLocaleString("tr-TR")}
            </p>
            <p className="text-xs text-muted-foreground" title={roiExport.paketHash}>
              Snapshot hash&apos;i (SHA-256): {roiExport.paketHash}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {roiExport.onKontrolRaporu.sorunlar.length === 0 ? (
                <StatusBadge durum="success">Ön-kontrol: sorun yok</StatusBadge>
              ) : (
                roiExport.onKontrolRaporu.sorunlar.map((s, i) => (
                  <StatusBadge key={`${s.kod}-${i}`} durum={s.seviye === "blok" ? "danger" : "warning"}>
                    {s.mesaj}
                  </StatusBadge>
                ))
              )}
              <StatusBadge durum={LEDGER_DURUM_SEMANTIK[roiExport.ledgerDurumu ?? "KAYITSIZ"] ?? "unknown"}>
                {LEDGER_DURUM_ETIKET[roiExport.ledgerDurumu ?? "KAYITSIZ"] ?? roiExport.ledgerDurumu}
              </StatusBadge>
            </div>
            {roiExport.provenanceOzeti && roiExport.provenanceOzeti.length > 0 ? (
              <div className="mt-2 flex flex-col gap-1.5">
                <p className="text-xs font-medium text-muted-foreground">
                  Alan bazlı kanıt zinciri (yalnız durum özeti — kaynak/iddia gerekçe metni gösterilmez):
                </p>
                <div className="flex flex-wrap items-center gap-1.5">
                  {roiExport.provenanceOzeti.map((s, i) => (
                    <StatusBadge key={`${s.alanKodu}-${i}`} durum={PROVENANCE_ROZET[s.genelDurum] ?? "unknown"}>
                      {s.alanKodu}: {PROVENANCE_ETIKET[s.genelDurum] ?? s.genelDurum} ({s.iddiaSayisi} iddia)
                    </StatusBadge>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {roiCsvUrl ? (
                <a href={roiCsvUrl} download={`kalkan-dora-roi-${roiExport.id}.csv`} className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                  CSV indir
                </a>
              ) : null}
              {roiXlsxUrl ? (
                <a href={roiXlsxUrl} download={`kalkan-dora-roi-${roiExport.id}.xlsx`} className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                  XLSX indir
                </a>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!veri.kosu) {
    // RPC ya roiExport ya kosu döner (yukarıda ele alındı) — ikisi de yoksa gösterilecek bir şey yok.
    return (
      <main className="mx-auto max-w-4xl p-6">
        <h1 className="text-xl font-semibold">Proof Room</h1>
        <p className="mt-2 text-sm text-muted-foreground">Link geçersiz veya süresi dolmuş.</p>
      </main>
    );
  }

  const kosu = veri.kosu;
  const kaynakZinciri = veri.kaynakZinciri ?? [];
  const applicability = veri.applicability ?? [];
  const ledgerDurumu = veri.ledgerDurumu ?? "KAYITSIZ";

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Proof Room — {veri.kurumAdi}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Salt-okur kanıt görünümü. Erişim süresi:{" "}
          {new Date(veri.sonGecerlilik).toLocaleString("tr-TR")} · Bu görüntüleme denetim izine
          kaydedildi.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Kontrol testi koşusu</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <p>
            <strong>{kosu.kontrolMaddeRef}</strong> — {kosu.kontrolBaslik} ·{" "}
            {kosu.tanimAd}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge durum={SONUC_SEMANTIK[kosu.sonuc] ?? "neutral"}>
              Sonuç: {kosu.sonuc}
            </StatusBadge>
            {veri.legalSnapshot ? (
              <StatusBadge durum={KARAR_SEMANTIK[veri.legalSnapshot.karar] ?? "neutral"}>
                Yasal dayanak: {veri.legalSnapshot.karar}
              </StatusBadge>
            ) : (
              <StatusBadge durum="unknown">Dayanak fotoğrafı yok (eski koşu)</StatusBadge>
            )}
            <StatusBadge durum={LEDGER_DURUM_SEMANTIK[ledgerDurumu] ?? "neutral"}>
              {LEDGER_DURUM_ETIKET[ledgerDurumu] ?? ledgerDurumu}
            </StatusBadge>
          </div>
          <p className="text-muted-foreground">{kosu.gerekce}</p>
          <p className="text-xs text-muted-foreground">
            Koşu zamanı: {new Date(kosu.calistiAt).toLocaleString("tr-TR")}
            {veri.kanit ? ` · Kanıt dosya hash'i: ${veri.kanit.dosyaHashSha256 ?? "—"}` : ""}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Kaynak zinciri ({kaynakZinciri.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {kaynakZinciri.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Bu kontrol için yasal dayanak eşlemesi yok — koşu dayanak iddiası taşımıyor.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kaynak</TableHead>
                    <TableHead>Hüküm</TableHead>
                    <TableHead>Yükümlülük</TableHead>
                    <TableHead>Doğrulama</TableHead>
                    <TableHead>Artifact SHA-256</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {kaynakZinciri.map((z) => (
                    <TableRow key={`${z.obligationKod}-${z.provisionRef}`}>
                      <TableCell className="text-xs">
                        {z.authority} · {z.kaynakAd} ({z.kaynakSeviyesi})
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{z.provisionRef}</span>
                        <p className="max-w-xs text-xs text-muted-foreground">{z.snippet}</p>
                      </TableCell>
                      <TableCell className="text-sm">
                        {z.obligationKod} ({z.nitelik})
                      </TableCell>
                      <TableCell>
                        <StatusBadge
                          durum={z.obligationDogrulama === "VERIFIED" && z.mappingDogrulama === "VERIFIED" ? "success" : "warning"}
                        >
                          {DOGRULAMA_ETIKET[z.mappingDogrulama] ?? z.mappingDogrulama}
                        </StatusBadge>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs" title={z.artifactSha256}>
                          {z.artifactSha256.slice(0, 16)}…
                        </code>
                      </TableCell>
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
          <CardTitle>Uygulanabilirlik kararları ({applicability.length})</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {applicability.length === 0 ? (
            <p className="text-sm text-muted-foreground">Güncel uygulanabilirlik kararı yok.</p>
          ) : (
            applicability.map((a) => (
              <div key={a.obligationKod} className="flex flex-wrap items-center gap-2 text-sm">
                <span>{a.obligationKod}</span>
                <StatusBadge durum={a.durum === "APPLICABLE" ? "info" : a.durum === "UNKNOWN" ? "unknown" : "neutral"}>
                  {a.durum}
                </StatusBadge>
                {a.gerekce ? <span className="text-xs text-muted-foreground">{a.gerekce}</span> : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sitasyon paketi</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <p className="text-muted-foreground">
            Paket bu sayfada, sunucudan gelen veriyle üretildi (hash&apos;ler RFC 8785 kanonik
            JSON&apos;dan). Bağımsız doğrulama: paketi indirin ve KALKAN_OS&apos;a erişmeden{" "}
            <code>npx tsx scripts/verify-sitasyon.ts paket.json</code> çalıştırın. Paket imzasız,
            hash-bütünlüklüdür.
          </p>
          {paket && indirmeUrl ? (
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={indirmeUrl}
                download={`kalkan-sitasyon-${kosu.id}.json`}
                className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Paketi indir (JSON)
              </a>
              <code className="text-xs text-muted-foreground" title={paket.sourceBundleHash}>
                sourceBundleHash: {paket.sourceBundleHash.slice(0, 16)}…
              </code>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Paket hazırlanıyor…</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Şeffaflık Defteri Mührü (G3)</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <p className="text-muted-foreground">
            Bu koşu, append-only bir Merkle defterine (SCITT tarzı) imzalı ifade olarak eklendi.
            Aşağıdaki kapsama makbuzu, KALKAN-OS&apos;a erişmeden{" "}
            <code>npx tsx scripts/verify-seffaflik.ts makbuz.json</code> ile bağımsız
            doğrulanabilir — mühür DÜRÜST bir durum taşır: henüz mühürlenmediyse{" "}
            <em>bekliyor</em> denir, sahte &quot;doğrulandı&quot; iddiası üretilmez.
          </p>
          {!ledgerMalzeme || ledgerMalzeme.durum !== "ANCHORED" ? (
            <StatusBadge durum={LEDGER_DURUM_SEMANTIK[ledgerMalzeme?.durum ?? "KAYITSIZ"] ?? "unknown"}>
              {LEDGER_DURUM_ETIKET[ledgerMalzeme?.durum ?? "KAYITSIZ"] ?? "Bilinmiyor"}
            </StatusBadge>
          ) : makbuz && makbuzIndirmeUrl ? (
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={makbuzIndirmeUrl}
                download={`kalkan-makbuz-${kosu.id}.json`}
                className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Kapsama makbuzunu indir (JSON)
              </a>
              <code className="text-xs text-muted-foreground" title={makbuz.sth.rootHash}>
                kök: {makbuz.sth.rootHash.slice(0, 16)}… · yaprak #{makbuz.leafIndex}
              </code>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Makbuz hazırlanıyor…</p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
