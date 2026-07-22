"use client";

// Resmî kaynak sicili — SALT OKUR (V2 PR-4a + QRegu PR-Q1'; V1 §9.4). Global
// ortak referans: her kiracı aynı hukuk kaynağı listesini görür. İçerik
// küratör/connector tarafından eklenir (script); tenant bu ekranda yazamaz.
// PR-Q1': kaynak başına TAZELİK (kural 8: çekim yoksa "güncellik iddia
// edilemez" — "güncel" DENMEZ) ve artifact listesi (hash + doğrulama rozeti).
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { StatusBadge, type SemantikDurum } from "@/components/durum/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { useAuth } from "@/lib/auth";
import { REGULATED_ENTITY_LABEL, type RegulatedEntityType } from "@/lib/regulatory-scope";

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

interface TenantScope {
  id: string;
  source_id: string | null;
  manual_authority: string | null;
  manual_title: string | null;
  manual_url: string | null;
  note: string | null;
  origin: "PROFILE_RULE" | "MANUAL";
  scope_status: "AUTO_ACTIVE" | "REVIEW_REQUIRED" | "MANUAL_TRACKED";
  matched_entity_type: string | null;
  module_keys: string[];
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
  const { currentUser } = useAuth();
  const [kaynaklar, setKaynaklar] = useState<Kaynak[]>([]);
  const [artifactlar, setArtifactlar] = useState<Artifact[]>([]);
  // Kaynak başına son BAŞARILI çekim zamanı (tazelik türetiminin girdisi).
  const [sonCekim, setSonCekim] = useState<Record<string, string>>({});
  const [yukleniyor, setYukleniyor] = useState(true);
  const [kapsamlar, setKapsamlar] = useState<TenantScope[]>([]);
  const [kurulusTurleri, setKurulusTurleri] = useState<string[]>([]);
  const [islemMesaji, setIslemMesaji] = useState<string | null>(null);
  const [manuelBaslik, setManuelBaslik] = useState("");
  const [manuelOtorite, setManuelOtorite] = useState("");
  const [manuelUrl, setManuelUrl] = useState("");
  const [manuelNot, setManuelNot] = useState("");

  const yukle = useCallback(async () => {
    const db = createClient();
    const [{ data: k }, { data: a }, { data: r }, { data: s }, { data: p }] = await Promise.all([
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
      db
        .from("tenant_regulatory_scopes")
        .select(
          "id, source_id, manual_authority, manual_title, manual_url, note, origin, scope_status, matched_entity_type, module_keys",
        )
        .is("superseded_at", null)
        .order("created_at", { ascending: false }),
      db.from("organization_profiles").select("regulated_entity_types").maybeSingle(),
    ]);
    setKaynaklar((k ?? []) as Kaynak[]);
    setArtifactlar((a ?? []) as Artifact[]);
    const son: Record<string, string> = {};
    for (const run of r ?? []) {
      if (!(run.source_id in son)) son[run.source_id] = run.fetched_at;
    }
    setSonCekim(son);
    setKapsamlar((s ?? []) as TenantScope[]);
    setKurulusTurleri(p?.regulated_entity_types ?? []);
    setYukleniyor(false);
  }, []);

  const yetkili = currentUser?.role === "admin" || currentUser?.role === "uyum";
  const manuelUrlGecerli = manuelUrl.trim() === "" || manuelUrl.trim().startsWith("https://");

  async function kapsamiEsleştir() {
    if (!currentUser || !yetkili) return;
    setIslemMesaji(null);
    const db = createClient();
    const { data, error } = await db.rpc("regulatory_scope_refresh", {
      p_tenant_id: currentUser.tenantId,
    });
    if (error) {
      setIslemMesaji(error.message);
      return;
    }
    const sonuc = data?.[0];
    setIslemMesaji(
      sonuc
        ? `${sonuc.eklenen} yeni eşleşme eklendi; ${sonuc.inceleme_gerekli} kayıt hukuk incelemesi bekliyor, ${sonuc.aktif_modul_kurali} doğrulanmış kural modül açıyor.`
        : "Kapsam yenilendi.",
    );
    await yukle();
  }

  async function manuelKaynakEkle() {
    if (!currentUser || !yetkili || manuelBaslik.trim() === "" || !manuelUrlGecerli) return;
    setIslemMesaji(null);
    const db = createClient();
    const { error } = await db.from("tenant_regulatory_scopes").insert({
      tenant_id: currentUser.tenantId,
      source_id: null,
      rule_id: null,
      manual_authority: manuelOtorite.trim() || null,
      manual_title: manuelBaslik.trim(),
      manual_url: manuelUrl.trim() || null,
      note: manuelNot.trim() || null,
      origin: "MANUAL",
      scope_status: "MANUAL_TRACKED",
      module_keys: [],
      added_by: currentUser.id,
    });
    if (error) {
      setIslemMesaji(error.message);
      return;
    }
    setManuelBaslik("");
    setManuelOtorite("");
    setManuelUrl("");
    setManuelNot("");
    setIslemMesaji(
      "Manuel mevzuat izleme kapsamına eklendi; hukuki uygulanabilirlik kararı ayrıca verilir.",
    );
    await yukle();
  }

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
          <CardTitle>Kurum mevzuat kapsamı</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div>
            <p className="text-muted-foreground text-sm">Kayıtlı kuruluş türü</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {kurulusTurleri.length === 0 ? (
                <span className="text-warning text-sm">Kesin kuruluş türü seçilmemiş.</span>
              ) : (
                kurulusTurleri.map((tur) => (
                  <StatusBadge key={tur} durum="info">
                    {REGULATED_ENTITY_LABEL[tur as RegulatedEntityType] ?? tur}
                  </StatusBadge>
                ))
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              disabled={!yetkili || kurulusTurleri.length === 0}
              onClick={() => void kapsamiEsleştir()}
            >
              Kurum türüne göre kapsamı yenile
            </Button>
            {kurulusTurleri.length === 0 ? (
              <a href="/kurulum" className="text-primary text-sm underline">
                Kurum türünü seç
              </a>
            ) : null}
          </div>
          {islemMesaji ? (
            <p role="status" className="text-sm">
              {islemMesaji}
            </p>
          ) : null}
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-md border p-3">
              <p className="text-muted-foreground text-xs">Otomatik aktif</p>
              <p className="text-xl font-semibold">
                {kapsamlar.filter((x) => x.scope_status === "AUTO_ACTIVE").length}
              </p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-muted-foreground text-xs">Hukuk incelemesi gerekli</p>
              <p className="text-xl font-semibold">
                {kapsamlar.filter((x) => x.scope_status === "REVIEW_REQUIRED").length}
              </p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-muted-foreground text-xs">Manuel izlenen</p>
              <p className="text-xl font-semibold">
                {kapsamlar.filter((x) => x.scope_status === "MANUAL_TRACKED").length}
              </p>
            </div>
          </div>
          <p className="text-muted-foreground text-xs">
            Yalnız dört-göz hukuk doğrulamasından geçen kapsam kuralı ilgili modülü otomatik
            açabilir. Araştırma taslağı eşleşmeleri görünürdür fakat “uygulanır” sonucu sayılmaz.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Manuel mevzuat ekle</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1 sm:col-span-2">
            <Label htmlFor="manuel-mevzuat-baslik">Mevzuat adı</Label>
            <Input
              id="manuel-mevzuat-baslik"
              value={manuelBaslik}
              onChange={(e) => setManuelBaslik(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="manuel-mevzuat-otorite">Otorite</Label>
            <Input
              id="manuel-mevzuat-otorite"
              value={manuelOtorite}
              onChange={(e) => setManuelOtorite(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="manuel-mevzuat-url">Resmî bağlantı</Label>
            <Input
              id="manuel-mevzuat-url"
              type="url"
              value={manuelUrl}
              onChange={(e) => setManuelUrl(e.target.value)}
            />
            {!manuelUrlGecerli ? (
              <p className="text-danger text-xs">Yalnız HTTPS resmî bağlantısı kabul edilir.</p>
            ) : null}
          </div>
          <div className="flex flex-col gap-1 sm:col-span-2">
            <Label htmlFor="manuel-mevzuat-not">Not</Label>
            <Textarea
              id="manuel-mevzuat-not"
              value={manuelNot}
              onChange={(e) => setManuelNot(e.target.value)}
              rows={2}
            />
          </div>
          <div className="sm:col-span-2">
            <Button
              disabled={!yetkili || manuelBaslik.trim() === "" || !manuelUrlGecerli}
              onClick={() => void manuelKaynakEkle()}
            >
              İzleme kapsamına ekle
            </Button>
          </div>
          {kapsamlar.filter((x) => x.origin === "MANUAL").length > 0 ? (
            <ul className="flex flex-col gap-2 sm:col-span-2">
              {kapsamlar
                .filter((x) => x.origin === "MANUAL")
                .map((x) => (
                  <li key={x.id} className="rounded-md border p-3 text-sm">
                    <strong>{x.manual_title}</strong>
                    {x.manual_authority ? ` — ${x.manual_authority}` : ""}
                    {x.manual_url ? (
                      <a
                        href={x.manual_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary ml-2 underline"
                      >
                        Resmî kaynak
                      </a>
                    ) : null}
                  </li>
                ))}
            </ul>
          ) : null}
        </CardContent>
      </Card>

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
                    <TableHead>Kurum kapsamı</TableHead>
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
                          {kapsamlar.some((x) => x.source_id === k.id) ? (
                            <StatusBadge
                              durum={
                                kapsamlar.some(
                                  (x) => x.source_id === k.id && x.scope_status === "AUTO_ACTIVE",
                                )
                                  ? "success"
                                  : "warning"
                              }
                            >
                              {kapsamlar.some(
                                (x) => x.source_id === k.id && x.scope_status === "AUTO_ACTIVE",
                              )
                                ? "Otomatik aktif"
                                : "İnceleme gerekli"}
                            </StatusBadge>
                          ) : (
                            <span className="text-muted-foreground text-xs">
                              Kapsam dışı / karar yok
                            </span>
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
