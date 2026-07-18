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
import { createClient } from "@/lib/supabase/client";

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
  kosu: {
    id: string;
    sonuc: string;
    gerekce: string;
    calistiAt: string;
    tanimAd: string;
    kontrolMaddeRef: string;
    kontrolBaslik: string;
  };
  legalSnapshot: { karar: string; snapshot: CanonicalDeger } | null;
  kaynakZinciri: ProofZincirSatiri[];
  applicability: {
    obligationKod: string;
    durum: string;
    gerekce: string | null;
    factSnapshotFingerprint: string;
    kararKaynagi: string;
  }[];
  kanit: { evidenceId: string; dosyaHashSha256: string | null } | null;
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

export default function ProofRoomPage() {
  const params = useParams<{ token: string }>();
  const [veri, setVeri] = useState<ProofVerisi | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [paket, setPaket] = useState<SitasyonPaketi | null>(null);

  useEffect(() => {
    let iptal = false;
    const yukle = async () => {
      const db = createClient();
      const { data } = await db.rpc("proof_room_goruntule", { p_token: params.token });
      if (iptal) return;
      setVeri((data as unknown as ProofVerisi | null) ?? null);
      setYukleniyor(false);
    };
    void yukle();
    return () => {
      iptal = true;
    };
  }, [params.token]);

  // Sitasyon paketi tarayıcıda, sunucudan gelen veriyle üretilir (RFC 8785
  // hash'leri dahil) — indirme sonrası bağımsız CLI doğrulaması için.
  useEffect(() => {
    if (!veri) return;
    let iptal = false;
    const uret = async () => {
      const girdi: SitasyonGirdisi = {
        testRun: veri.kosu,
        legalSnapshot: veri.legalSnapshot,
        kaynakZinciri: veri.kaynakZinciri.map((z) => ({
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
        applicability: veri.applicability.map((a) => ({
          obligationKod: a.obligationKod,
          durum: a.durum,
          gerekce: a.gerekce,
          factSnapshotFingerprint: a.factSnapshotFingerprint,
          kararKaynagi: a.kararKaynagi,
        })),
        kanit: veri.kanit,
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
            <strong>{veri.kosu.kontrolMaddeRef}</strong> — {veri.kosu.kontrolBaslik} ·{" "}
            {veri.kosu.tanimAd}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge durum={SONUC_SEMANTIK[veri.kosu.sonuc] ?? "neutral"}>
              Sonuç: {veri.kosu.sonuc}
            </StatusBadge>
            {veri.legalSnapshot ? (
              <StatusBadge durum={KARAR_SEMANTIK[veri.legalSnapshot.karar] ?? "neutral"}>
                Yasal dayanak: {veri.legalSnapshot.karar}
              </StatusBadge>
            ) : (
              <StatusBadge durum="unknown">Dayanak fotoğrafı yok (eski koşu)</StatusBadge>
            )}
          </div>
          <p className="text-muted-foreground">{veri.kosu.gerekce}</p>
          <p className="text-xs text-muted-foreground">
            Koşu zamanı: {new Date(veri.kosu.calistiAt).toLocaleString("tr-TR")}
            {veri.kanit ? ` · Kanıt dosya hash'i: ${veri.kanit.dosyaHashSha256 ?? "—"}` : ""}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Kaynak zinciri ({veri.kaynakZinciri.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {veri.kaynakZinciri.length === 0 ? (
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
                  {veri.kaynakZinciri.map((z) => (
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
          <CardTitle>Uygulanabilirlik kararları ({veri.applicability.length})</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {veri.applicability.length === 0 ? (
            <p className="text-sm text-muted-foreground">Güncel uygulanabilirlik kararı yok.</p>
          ) : (
            veri.applicability.map((a) => (
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
                download={`kalkan-sitasyon-${veri.kosu.id}.json`}
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
    </main>
  );
}
