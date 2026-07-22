"use client";

// Resmî kaynak sicili — SALT OKUR (V2 PR-4a + QRegu PR-Q1'; V1 §9.4). Global
// ortak referans: her kiracı aynı hukuk kaynağı listesini görür. İçerik
// küratör/connector tarafından eklenir (script); tenant bu ekranda yazamaz.
// PR-Q1': kaynak başına TAZELİK (kural 8: çekim yoksa "güncellik iddia
// edilemez" — "güncel" DENMEZ) ve artifact listesi (hash + doğrulama rozeti).
import { useCallback, useEffect, useState } from "react";
import { StatusBadge, type SemantikDurum } from "@/components/durum/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { kaynakTazeligi } from "@/lib/kaynak-tazelik";
import { createClient } from "@/lib/supabase/client";
import { EkranYardimPaneli } from "@/components/yardim/ekran-yardim-paneli";

interface Kaynak {
  id: string;
  authority: string;
  jurisdiction: string;
  kaynak_seviyesi: string;
  ad: string;
  canonical_url: string | null;
  erisim_politikasi_durumu: string;
}

interface Artifact {
  id: string;
  source_id: string;
  external_id: string | null;
  baslik: string;
  media_type: string | null;
  sha256: string;
  fetched_at: string | null;
  issued_at: string | null;
  effective_from: string | null;
  dogrulama_durumu: string;
}

const SEVIYE_LABEL: Record<string, string> = {
  A: "A — Birincil hukuk",
  B: "B — Resmî rehber",
  C: "C — Standart",
  D: "D — Akademik",
};

const POLITIKA: Record<string, { etiket: string; semantik: SemantikDurum }> = {
  onaylandi: { etiket: "Erişim onaylı", semantik: "success" },
  manuel: { etiket: "Manuel", semantik: "neutral" },
  onay_bekliyor: { etiket: "Politika onayı bekliyor", semantik: "warning" },
  reddedildi: { etiket: "Reddedildi", semantik: "danger" },
};

// Artifact doğrulama sözlüğü (kural 3: uydurulmuş kaynak VERIFIED doğmaz).
const DOGRULAMA: Record<string, { etiket: string; semantik: SemantikDurum }> = {
  DRAFT_RESEARCH: { etiket: "Araştırma taslağı", semantik: "neutral" },
  TODO_DOGRULA: { etiket: "Doğrulanmadı", semantik: "warning" },
  VERIFIED: { etiket: "Doğrulandı", semantik: "success" },
  SUPERSEDED: { etiket: "Yerini yeni sürüm aldı", semantik: "neutral" },
};

function tarihEtiketi(tarih: string | null, yokMetni: string): string {
  if (!tarih) return yokMetni;
  return new Date(`${tarih}T00:00:00Z`).toLocaleDateString("tr-TR", { timeZone: "UTC" });
}

export default function KaynaklarPage() {
  const [kaynaklar, setKaynaklar] = useState<Kaynak[]>([]);
  const [artifactlar, setArtifactlar] = useState<Artifact[]>([]);
  // Kaynak başına son BAŞARILI çekim zamanı (tazelik türetiminin girdisi).
  const [sonCekim, setSonCekim] = useState<Record<string, string>>({});
  const [yukleniyor, setYukleniyor] = useState(true);

  const yukle = useCallback(async () => {
    const db = createClient();
    const [{ data: k }, { data: a }, { data: r }] = await Promise.all([
      db
        .from("regulatory_sources")
        .select(
          "id, authority, jurisdiction, kaynak_seviyesi, ad, canonical_url, erisim_politikasi_durumu",
        )
        .order("jurisdiction")
        .order("kaynak_seviyesi"),
      db
        .from("source_artifacts")
        .select(
          "id, source_id, external_id, baslik, media_type, sha256, fetched_at, issued_at, effective_from, dogrulama_durumu",
        )
        .order("created_at", { ascending: false }),
      db
        .from("source_fetch_runs")
        .select("source_id, fetched_at")
        .eq("durum", "BASARILI")
        .order("fetched_at", { ascending: false }),
    ]);
    setKaynaklar((k ?? []) as Kaynak[]);
    setArtifactlar((a ?? []) as Artifact[]);
    const son: Record<string, string> = {};
    for (const run of r ?? []) {
      if (!(run.source_id in son)) son[run.source_id] = run.fetched_at;
    }
    setSonCekim(son);
    setYukleniyor(false);
  }, []);

  useEffect(() => {
    const c = async () => {
      await yukle();
    };
    void c();
  }, [yukle]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Resmî Kaynak Sicili</h1>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
          İzlenen resmî hukuk ve düzenleyici kaynaklar. Bu liste ortak referanstır — kaynak
          künyeleri ve artifact&apos;lar küratör tarafından, doğrulanabilir hash&apos;lerle eklenir.
          Otomatik çekim (connector) erişim politikası onaylanmadan üretime çıkmaz.
        </p>
      </div>

      <EkranYardimPaneli modulId="regulasyon-kaynaklar" />

      <Card>
        <CardHeader>
          <CardTitle>Kaynaklar ({kaynaklar.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {yukleniyor ? (
            <p className="text-muted-foreground text-sm">Yükleniyor…</p>
          ) : kaynaklar.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Henüz kaynak eklenmemiş. Küratör seed&apos;i:{" "}
              <code>pnpm tsx scripts/seed-regulatory-sources.ts</code>
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Otorite</TableHead>
                    <TableHead>Yargı</TableHead>
                    <TableHead>Seviye</TableHead>
                    <TableHead>Ad</TableHead>
                    <TableHead>Erişim politikası</TableHead>
                    <TableHead>Tazelik</TableHead>
                    <TableHead>Artifact</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {kaynaklar.map((k) => {
                    const tazelik = kaynakTazeligi(sonCekim[k.id] ?? null, new Date());
                    const kaynakArtifactlari = artifactlar.filter((a) => a.source_id === k.id);
                    return (
                      <TableRow key={k.id}>
                        <TableCell>{k.authority}</TableCell>
                        <TableCell className="text-xs">{k.jurisdiction}</TableCell>
                        <TableCell className="text-xs">
                          {SEVIYE_LABEL[k.kaynak_seviyesi] ?? k.kaynak_seviyesi}
                        </TableCell>
                        <TableCell>
                          {k.canonical_url ? (
                            <a
                              href={k.canonical_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline"
                            >
                              {k.ad}
                            </a>
                          ) : (
                            k.ad
                          )}
                        </TableCell>
                        <TableCell>
                          <StatusBadge
                            durum={POLITIKA[k.erisim_politikasi_durumu]?.semantik ?? "neutral"}
                          >
                            {POLITIKA[k.erisim_politikasi_durumu]?.etiket ??
                              k.erisim_politikasi_durumu}
                          </StatusBadge>
                        </TableCell>
                        <TableCell>
                          {/* Kural 8 + 13: çekim yoksa UNKNOWN semantiği — nötr griyle karışmaz. */}
                          <StatusBadge
                            durum={
                              tazelik.hicCekimYok ? "unknown" : tazelik.bayat ? "danger" : "success"
                            }
                          >
                            {tazelik.mesaj}
                          </StatusBadge>
                        </TableCell>
                        <TableCell>
                          {kaynakArtifactlari.length === 0 ? (
                            <span className="text-muted-foreground text-xs">Yok</span>
                          ) : (
                            <details>
                              <summary className="text-primary cursor-pointer text-xs">
                                {kaynakArtifactlari.length} nüsha
                              </summary>
                              <ul className="mt-2 flex flex-col gap-1">
                                {kaynakArtifactlari.map((a) => (
                                  <li
                                    key={a.id}
                                    className="border-border/60 rounded-md border p-2 text-xs"
                                  >
                                    <div className="flex flex-wrap items-center gap-2">
                                      {a.external_id ? <code>{a.external_id}</code> : null}
                                      <StatusBadge
                                        durum={DOGRULAMA[a.dogrulama_durumu]?.semantik ?? "neutral"}
                                      >
                                        {DOGRULAMA[a.dogrulama_durumu]?.etiket ??
                                          a.dogrulama_durumu}
                                      </StatusBadge>
                                    </div>
                                    <p className="text-muted-foreground mt-1">{a.baslik}</p>
                                    <dl className="mt-2 grid gap-x-3 gap-y-1 sm:grid-cols-2">
                                      <div>
                                        <dt className="text-muted-foreground inline">
                                          Yayım/sürüm tarihi:{" "}
                                        </dt>
                                        <dd className="inline">
                                          {tarihEtiketi(a.issued_at, "Künye metninde")}
                                        </dd>
                                      </div>
                                      <div>
                                        <dt className="text-muted-foreground inline">Yürürlük: </dt>
                                        <dd className="inline">
                                          {tarihEtiketi(
                                            a.effective_from,
                                            "Künye metninde / uygulanmaz",
                                          )}
                                        </dd>
                                      </div>
                                      <div className="sm:col-span-2">
                                        <dt className="text-muted-foreground inline">SHA-256: </dt>
                                        <dd className="inline">
                                          <code title={a.sha256}>{a.sha256}</code>
                                        </dd>
                                      </div>
                                    </dl>
                                  </li>
                                ))}
                              </ul>
                            </details>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
