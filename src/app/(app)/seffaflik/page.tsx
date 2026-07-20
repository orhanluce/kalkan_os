"use client";

// Şeffaflık Defteri (G3, M5.5). İmzalı ifadeleri append-only, Merkle destekli
// kütüğe yazar; imzalı ağaç başı (STH) yayınlanınca her kayıt için ÇEVRİMDIŞI
// doğrulanabilir kapsama makbuzu üretilir. Durum DÜRÜST: "defterde" ≠ "dış
// zaman damgalı" (ikincisi nitelikli TSA ister — henüz bağlı değil).
import { useCallback, useEffect, useMemo, useState } from "react";
import { StatusBadge, type SemantikDurum } from "@/components/durum/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { EkranYardimPaneli } from "@/components/yardim/ekran-yardim-paneli";

interface Girdi {
  id: string;
  statement_kind: string;
  statement_hash: string;
  leaf_index: number;
}
interface Checkpoint {
  id: string;
  tree_size: number;
  root_hash: string;
  timestamp_saglayici: string | null;
}

const DURUM_SEM: Record<string, SemantikDurum> = {
  defterde_beklemede: "warning",
  seffaflik_defterinde: "success",
  dis_zaman_damgali: "success",
};
const DURUM_ETIKET: Record<string, string> = {
  defterde_beklemede: "Defterde (STH bekliyor)",
  seffaflik_defterinde: "Şeffaflık defterinde",
  dis_zaman_damgali: "Dış zaman damgalı",
};

async function sha256HexTarayici(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export default function SeffaflikPage() {
  const [girdiler, setGirdiler] = useState<Girdi[]>([]);
  const [checkpointler, setCheckpointler] = useState<Checkpoint[]>([]);
  const [hata, setHata] = useState<string | null>(null);
  const [kind, setKind] = useState("SIMULATION_MANIFEST");
  const [icerik, setIcerik] = useState("");
  const [mesaj, setMesaj] = useState<string | null>(null);

  const yukle = useCallback(async () => {
    const db = createClient();
    const [{ data: gs }, { data: cs }] = await Promise.all([
      db
        .from("transparency_ledger_entries")
        .select("id, statement_kind, statement_hash, leaf_index")
        .order("leaf_index", { ascending: true }),
      db
        .from("transparency_checkpoints")
        .select("id, tree_size, root_hash, timestamp_saglayici")
        .order("tree_size", { ascending: false }),
    ]);
    setGirdiler((gs ?? []).map((g) => ({ ...g, leaf_index: Number(g.leaf_index) })) as Girdi[]);
    setCheckpointler((cs ?? []).map((c) => ({ ...c, tree_size: Number(c.tree_size) })) as Checkpoint[]);
  }, []);

  useEffect(() => {
    const c = async () => {
      await yukle();
    };
    void c();
  }, [yukle]);

  // Durum türetimi client-side (RPC ile birebir): kapsayan STH var mı, nitelikli mi.
  const durumCoz = useCallback(
    (leafIndex: number): string => {
      const kapsayan = checkpointler.filter((c) => c.tree_size > leafIndex);
      if (kapsayan.length === 0) return "defterde_beklemede";
      if (kapsayan.some((c) => c.timestamp_saglayici && !c.timestamp_saglayici.startsWith("local-dev")))
        return "dis_zaman_damgali";
      return "seffaflik_defterinde";
    },
    [checkpointler],
  );

  const sonRoot = useMemo(() => checkpointler[0] ?? null, [checkpointler]);
  // Farklı iki boyutta STH varsa append-only tutarlılık kanıtı indirilebilir.
  const tutarlilikAraligi = useMemo(() => {
    const boyutlar = [...new Set(checkpointler.map((c) => c.tree_size))].sort((a, b) => a - b);
    return boyutlar.length >= 2 ? { from: boyutlar[0], to: boyutlar[boyutlar.length - 1] } : null;
  }, [checkpointler]);

  const kaydet = useCallback(async () => {
    setHata(null);
    setMesaj(null);
    if (!icerik.trim()) return;
    const statementHash = await sha256HexTarayici(icerik);
    const r = await fetch("/api/seffaflik/kaydet", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind, statementHash }),
    });
    const j = (await r.json().catch(() => ({}))) as { hata?: string; leafIndex?: number };
    if (!r.ok) return setHata(j.hata ?? "Kayıt başarısız.");
    setIcerik("");
    setMesaj(`Kaydedildi (yaprak #${j.leafIndex}, özet ${statementHash.slice(0, 12)}…).`);
    await yukle();
  }, [kind, icerik, yukle]);

  const checkpointYayinla = useCallback(async () => {
    setHata(null);
    setMesaj(null);
    const r = await fetch("/api/seffaflik/checkpoint", { method: "POST" });
    const j = (await r.json().catch(() => ({}))) as { hata?: string; treeSize?: number; root?: string };
    if (!r.ok) return setHata(j.hata ?? "Ağaç başı yayınlanamadı.");
    setMesaj(`Ağaç başı yayınlandı (boy ${j.treeSize}, kök ${(j.root ?? "").slice(0, 12)}…).`);
    await yukle();
  }, [yukle]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Şeffaflık Defteri</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          İmzalı ifadeler (bir artefakt özeti + imza) append-only, Merkle destekli bir kütüğe yazılır.
          İmzalı ağaç başı (STH) yayınlanınca her kayıt için, veritabanına ulaşmadan doğrulanabilen bir
          kapsama makbuzu üretilir. Kütük SIRAYI ve DEĞİŞMEZLİĞİ kanıtlar; bağımsız takvim zamanı için
          nitelikli bir RFC 3161 TSA gerekir (henüz bağlı değil — durum bunu dürüstçe ayırır).
        </p>
      </div>

      <EkranYardimPaneli modulId="seffaflik-defteri" />

      {hata ? (
        <p role="alert" className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {hata}
        </p>
      ) : null}
      {mesaj ? (
        <p className="rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">{mesaj}</p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>İfade kaydet</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <div className="flex flex-col gap-1">
            <Label htmlFor="s-kind">Artefakt türü</Label>
            <select
              id="s-kind"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              className="h-9 w-64 rounded-md border bg-background px-2 text-sm"
            >
              <option value="SIMULATION_MANIFEST">Simülasyon manifesti</option>
              <option value="POLICY_VERSION">Politika sürümü</option>
              <option value="EVIDENCE_ENVELOPE">Kanıt zarfı</option>
              <option value="BOARD_DECLARATION">YK beyanı</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="s-icerik">Kaydedilecek içerik (SHA-256 özeti alınır)</Label>
            <Textarea id="s-icerik" value={icerik} onChange={(e) => setIcerik(e.target.value)} rows={2} />
          </div>
          <Button size="sm" className="w-fit" onClick={() => void kaydet()} disabled={!icerik.trim()}>
            İfadeyi Kaydet
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ağaç başları (STH)</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          {sonRoot ? (
            <p className="text-xs text-muted-foreground">
              En güncel: boy {sonRoot.tree_size}, kök{" "}
              <code className="font-mono">{sonRoot.root_hash.slice(0, 16)}…</code>
              {sonRoot.timestamp_saglayici && !sonRoot.timestamp_saglayici.startsWith("local-dev")
                ? " · nitelikli TSA damgalı"
                : " · nitelikli TSA damgası yok"}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">Henüz ağaç başı yayınlanmadı.</p>
          )}
          <Button size="sm" variant="outline" className="w-fit" onClick={() => void checkpointYayinla()} disabled={girdiler.length === 0}>
            Ağaç Başı Yayınla
          </Button>
          {tutarlilikAraligi ? (
            <a
              href={`/api/seffaflik/tutarlilik?from=${tutarlilikAraligi.from}&to=${tutarlilikAraligi.to}`}
              download={`tutarlilik-${tutarlilikAraligi.from}-${tutarlilikAraligi.to}.json`}
              className="text-xs underline underline-offset-2"
            >
              Tutarlılık kanıtı indir (append-only: boy {tutarlilikAraligi.from} ↔ {tutarlilikAraligi.to})
            </a>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Defter kayıtları ({girdiler.length})</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          {girdiler.length === 0 ? (
            <p className="text-xs text-muted-foreground">Kütük boş.</p>
          ) : (
            girdiler.map((g) => {
              const durum = durumCoz(g.leaf_index);
              return (
                <div key={g.id} className="flex flex-wrap items-center gap-2 border-t py-1 first:border-t-0">
                  <span className="font-mono text-xs">#{g.leaf_index}</span>
                  <StatusBadge durum="info">{g.statement_kind}</StatusBadge>
                  <code className="font-mono text-xs text-muted-foreground">{g.statement_hash.slice(0, 16)}…</code>
                  <StatusBadge durum={DURUM_SEM[durum] ?? "neutral"}>{DURUM_ETIKET[durum] ?? durum}</StatusBadge>
                  {durum !== "defterde_beklemede" ? (
                    <a
                      href={`/api/seffaflik/makbuz/${g.id}`}
                      download={`makbuz-${g.leaf_index}.json`}
                      className="text-xs underline underline-offset-2"
                    >
                      Makbuz İndir
                    </a>
                  ) : null}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
