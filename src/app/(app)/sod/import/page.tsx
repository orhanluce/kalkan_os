"use client";

// SoD atama CSV içe aktarma — DAR ekran (docs/ROADMAP.md M16 PR-3D,
// master talimat §9.10): yükle → dry-run → diff → uygula → geçmiş → rollback.
//
// GÜVENLİK SINIRI: bu ekran bir yetki kontrolü DEĞİLDİR. Gerçek sınırlar:
// RLS (kiracı izolasyonu), rota rol kontrolü (admin/uyum), DB guard'ları
// (stale 409, durum kilidi, maker-checker). Burada butonların görünmesi
// isteğin kabul edileceği anlamına gelmez — hatalar olduğu gibi gösterilir.
//
// DRY-RUN ATAMAYI DEĞİŞTİRMEZ; uygulama ayrı ve açık bir insan kararıdır
// (PR-3A/3B ayrımı). Rollback kararını talep eden veremez (maker-checker) —
// UI kendi talebinde karar butonlarını gizler ama asıl zorlayıcı DB'dir.
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { StatusBadge } from "@/components/durum/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";

const MOD_LABEL: Record<string, string> = {
  DELTA: "DELTA — yalnız gelen kayıtlar işlenir",
  AUTHORITATIVE_SNAPSHOT: "SNAPSHOT — kaynağın tam listesi; listede olmayan sona erdirilir",
};

interface OnizlemeSonucu {
  dryRunId?: string;
  durum: string;
  dosyaHatasi?: { kod: string; neden: string } | null;
  ozet?: {
    eklenecek: number;
    guncellenecek: number;
    degismeyecek: number;
    sonaErdirilecek: number;
    satirHatasi: number;
    duplicate: number;
    beklenenYeniCatisma: number;
  };
  satirHatalari?: { satir: number; kod: string; neden: string }[];
}

interface ManifestSatiri {
  id: string;
  kaynak: string;
  mode: string;
  eklenen_sayisi: number;
  guncellenen_sayisi: number;
  sona_erdirilen_sayisi: number;
  ters_degisiklik: unknown;
  created_at: string;
}

interface RollbackSatiri {
  id: string;
  manifest_id: string;
  durum: string;
  talep_eden: string;
  gerekce: string;
  created_at: string;
}

const ROLLBACK_DURUM: Record<string, { etiket: string; semantik: "info" | "danger" | "success" }> = {
  TALEP_EDILDI: { etiket: "Talep edildi", semantik: "info" },
  REDDEDILDI: { etiket: "Reddedildi", semantik: "danger" },
  UYGULANDI: { etiket: "Geri alındı", semantik: "success" },
};

export default function SodImportPage() {
  const { currentUser } = useAuth();

  const [dosya, setDosya] = useState<File | null>(null);
  const [kaynak, setKaynak] = useState("");
  const [mod, setMod] = useState("DELTA");
  const [onizleme, setOnizleme] = useState<OnizlemeSonucu | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [mesaj, setMesaj] = useState<string | null>(null);
  const [suruyor, setSuruyor] = useState(false);

  const [manifestler, setManifestler] = useState<ManifestSatiri[]>([]);
  const [rollbacklar, setRollbacklar] = useState<RollbackSatiri[]>([]);
  const [bekleyenOlay, setBekleyenOlay] = useState(0);
  const [gerekceler, setGerekceler] = useState<Record<string, string>>({});
  const [kararNotlari, setKararNotlari] = useState<Record<string, string>>({});

  const yenile = useCallback(async () => {
    const db = createClient();
    const [{ data: man }, { data: rb }, { count }] = await Promise.all([
      db
        .from("sod_import_manifestleri")
        .select("id, kaynak, mode, eklenen_sayisi, guncellenen_sayisi, sona_erdirilen_sayisi, ters_degisiklik, created_at")
        .order("created_at", { ascending: false })
        .limit(20),
      db
        .from("sod_import_rollbacklari")
        .select("id, manifest_id, durum, talep_eden, gerekce, created_at")
        .order("created_at", { ascending: false })
        .limit(20),
      db.from("sod_outbox").select("id", { count: "exact", head: true }).eq("durum", "PENDING"),
    ]);
    setManifestler((man ?? []) as ManifestSatiri[]);
    setRollbacklar((rb ?? []) as RollbackSatiri[]);
    setBekleyenOlay(count ?? 0);
  }, []);

  useEffect(() => {
    const calistir = async () => {
      await yenile();
    };
    void calistir();
  }, [yenile]);

  async function dryRun() {
    if (!dosya || !kaynak.trim()) {
      setHata("Dosya ve kaynak zorunlu.");
      return;
    }
    setSuruyor(true);
    setHata(null);
    setMesaj(null);
    setOnizleme(null);
    try {
      const buf = new Uint8Array(await dosya.arrayBuffer());
      // 5MB sınırı route'ta da zorlanır; büyük dizide String.fromCharCode
      // spread stack'i patlatır — parça parça çevrilir.
      let ikili = "";
      const PARCA = 0x8000;
      for (let i = 0; i < buf.length; i += PARCA) {
        ikili += String.fromCharCode(...buf.subarray(i, i + PARCA));
      }
      const res = await fetch("/api/sod/import/onizle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          csvBase64: btoa(ikili),
          kaynak: kaynak.trim(),
          mode: mod,
          dosyaAdi: dosya.name,
          mimeType: dosya.type,
        }),
      });
      const veri = (await res.json()) as OnizlemeSonucu & { hata?: string };
      if (!res.ok) {
        setHata(veri.hata ?? "Önizleme başarısız.");
        return;
      }
      setOnizleme(veri);
    } finally {
      setSuruyor(false);
    }
  }

  async function uygula() {
    if (!onizleme?.dryRunId) return;
    setSuruyor(true);
    setHata(null);
    setMesaj(null);
    try {
      const res = await fetch(`/api/sod/import/${onizleme.dryRunId}/uygula`, { method: "POST" });
      const veri = (await res.json()) as {
        hata?: string;
        kod?: string;
        ozet?: { eklenen: number; guncellenen: number; sonaErdirilen: number };
      };
      if (!res.ok) {
        // Stale: önizleme artık uygulanamaz — kullanıcı yeni dry-run almalı.
        setHata(veri.kod === "IMPORT_PREVIEW_STALE" ? `${veri.hata} (kod: IMPORT_PREVIEW_STALE)` : (veri.hata ?? "Uygulama başarısız."));
        if (veri.kod === "IMPORT_PREVIEW_STALE") setOnizleme(null);
        return;
      }
      setMesaj(
        `İçe aktarma uygulandı: ${veri.ozet?.eklenen ?? 0} eklendi, ${veri.ozet?.guncellenen ?? 0} güncellendi, ${veri.ozet?.sonaErdirilen ?? 0} sona erdirildi. Değerlendirme kuyruğa alındı.`,
      );
      setOnizleme(null);
      setDosya(null);
      await yenile();
    } finally {
      setSuruyor(false);
    }
  }

  async function rollbackTalep(manifestId: string) {
    const gerekce = (gerekceler[manifestId] ?? "").trim();
    if (!gerekce) {
      setHata("Rollback gerekçesi zorunlu.");
      return;
    }
    setSuruyor(true);
    setHata(null);
    setMesaj(null);
    try {
      const res = await fetch("/api/sod/import/rollback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manifestId, gerekce }),
      });
      const veri = (await res.json()) as { hata?: string };
      if (!res.ok) {
        setHata(veri.hata ?? "Rollback talebi başarısız.");
        return;
      }
      setMesaj("Rollback talebi açıldı — farklı bir yetkili karara bağlamalı.");
      setGerekceler((g) => ({ ...g, [manifestId]: "" }));
      await yenile();
    } finally {
      setSuruyor(false);
    }
  }

  async function rollbackKarar(talepId: string, karar: "ONAYLA" | "REDDET") {
    const notu = (kararNotlari[talepId] ?? "").trim();
    if (!notu) {
      setHata("Karar gerekçesi zorunlu.");
      return;
    }
    setSuruyor(true);
    setHata(null);
    setMesaj(null);
    try {
      const res = await fetch(`/api/sod/import/rollback/${talepId}/karar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ karar, notu }),
      });
      const veri = (await res.json()) as {
        hata?: string;
        ozet?: { sonaErdirilen: number; geriYuklenen: number; yenidenAcilan: number };
      };
      if (!res.ok) {
        setHata(veri.hata ?? "Karar başarısız.");
        return;
      }
      setMesaj(
        karar === "ONAYLA"
          ? `Rollback uygulandı: ${veri.ozet?.sonaErdirilen ?? 0} sona erdirildi, ${veri.ozet?.geriYuklenen ?? 0} geri yüklendi, ${veri.ozet?.yenidenAcilan ?? 0} yeniden açıldı.`
          : "Rollback talebi reddedildi.",
      );
      await yenile();
    } finally {
      setSuruyor(false);
    }
  }

  async function outboxIsle() {
    setSuruyor(true);
    setHata(null);
    setMesaj(null);
    try {
      const res = await fetch("/api/sod/outbox/isle", { method: "POST" });
      const veri = (await res.json()) as { hata?: string; islenen?: number; bulunanSayisi?: number };
      if (!res.ok) {
        setHata(veri.hata ?? "Drenaj başarısız.");
        return;
      }
      setMesaj(
        veri.islenen === 0
          ? "Bekleyen olay yok."
          : `${veri.islenen} olay işlendi; değerlendirme ${veri.bulunanSayisi ?? 0} çatışma buldu.`,
      );
      await yenile();
    } finally {
      setSuruyor(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/sod" className="text-sm text-muted-foreground hover:underline">
          ← Görevler Ayrılığı
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Atama İçe Aktarma (CSV)</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Dry-run atamaları DEĞİŞTİRMEZ; uygulama ayrı ve açık bir karardır. Geri alma farklı bir
          yetkilinin onayını ister.
        </p>
      </div>

      {hata && (
        <p role="alert" className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {hata}
        </p>
      )}
      {mesaj && (
        <p role="status" className="rounded-md border border-success/40 bg-success/10 px-3 py-2 text-sm text-success">
          {mesaj}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>1. Dosya ve Dry-Run</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="csv-dosya">CSV dosyası</Label>
              <Input
                id="csv-dosya"
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => setDosya(e.target.files?.[0] ?? null)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="kaynak">Kaynak sistem</Label>
              <Input
                id="kaynak"
                value={kaynak}
                onChange={(e) => setKaynak(e.target.value)}
                placeholder="ör. hr, ldap"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mod">Mod</Label>
              <Select items={MOD_LABEL} value={mod} onValueChange={(v) => setMod(v as string)}>
                <SelectTrigger id="mod">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.keys(MOD_LABEL).map((m) => (
                    <SelectItem key={m} value={m}>
                      {MOD_LABEL[m]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Button onClick={dryRun} disabled={suruyor}>
              Dry-Run Önizleme
            </Button>
          </div>
        </CardContent>
      </Card>

      {onizleme && (
        <Card>
          <CardHeader>
            <CardTitle>2. Önizleme Sonucu</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {onizleme.dosyaHatasi ? (
              <StatusBadge durum="danger">
                Dosya reddedildi: {onizleme.dosyaHatasi.neden} ({onizleme.dosyaHatasi.kod})
              </StatusBadge>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  <StatusBadge durum="success">Eklenecek: {onizleme.ozet?.eklenecek ?? 0}</StatusBadge>
                  <StatusBadge durum="info">Güncellenecek: {onizleme.ozet?.guncellenecek ?? 0}</StatusBadge>
                  <StatusBadge durum="neutral">Değişmeyecek: {onizleme.ozet?.degismeyecek ?? 0}</StatusBadge>
                  <StatusBadge durum="warning">
                    Sona erdirilecek: {onizleme.ozet?.sonaErdirilecek ?? 0}
                  </StatusBadge>
                  <StatusBadge durum={onizleme.ozet?.satirHatasi ? "danger" : "neutral"}>
                    Satır hatası: {onizleme.ozet?.satirHatasi ?? 0}
                  </StatusBadge>
                  <StatusBadge durum={onizleme.ozet?.beklenenYeniCatisma ? "warning" : "neutral"}>
                    Beklenen yeni çatışma: {onizleme.ozet?.beklenenYeniCatisma ?? 0}
                  </StatusBadge>
                </div>
                {(onizleme.satirHatalari?.length ?? 0) > 0 && (
                  <ul className="max-h-40 overflow-y-auto text-sm text-danger">
                    {onizleme.satirHatalari!.map((h) => (
                      <li key={`${h.satir}-${h.kod}`}>
                        Satır {h.satir}: {h.neden} ({h.kod})
                      </li>
                    ))}
                  </ul>
                )}
                {onizleme.durum === "READY_FOR_REVIEW" ? (
                  <div>
                    <Button onClick={uygula} disabled={suruyor}>
                      Uygula
                    </Button>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Atamalar önizlemeden bu yana değiştiyse uygulama 409 ile reddedilir (stale) —
                      yeni bir dry-run alın.
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Önizleme {onizleme.durum} durumunda — uygulanamaz.
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>İçe Aktarma Geçmişi</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {manifestler.length === 0 ? (
            <p className="text-sm text-muted-foreground">Henüz uygulanmış içe aktarma yok.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tarih</TableHead>
                    <TableHead>Kaynak</TableHead>
                    <TableHead>Mod</TableHead>
                    <TableHead>+ / ~ / −</TableHead>
                    <TableHead>Rollback</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {manifestler.map((m) => {
                    const talep = rollbacklar.find(
                      (r) => r.manifest_id === m.id && r.durum !== "REDDEDILDI",
                    );
                    return (
                      <TableRow key={m.id}>
                        <TableCell className="whitespace-nowrap text-xs">
                          {new Date(m.created_at).toLocaleString("tr-TR")}
                        </TableCell>
                        <TableCell>{m.kaynak}</TableCell>
                        <TableCell className="text-xs">{m.mode}</TableCell>
                        <TableCell className="tabular-nums">
                          {m.eklenen_sayisi} / {m.guncellenen_sayisi} / {m.sona_erdirilen_sayisi}
                        </TableCell>
                        <TableCell>
                          {talep ? (
                            <div className="flex flex-col gap-2">
                              <StatusBadge durum={ROLLBACK_DURUM[talep.durum]?.semantik ?? "info"}>
                                {ROLLBACK_DURUM[talep.durum]?.etiket ?? talep.durum}
                              </StatusBadge>
                              {talep.durum === "TALEP_EDILDI" &&
                                (talep.talep_eden === currentUser?.id ? (
                                  <p className="text-xs text-muted-foreground">
                                    Kendi talebinizi karara bağlayamazsınız (maker-checker).
                                  </p>
                                ) : (
                                  <div className="flex flex-col gap-1.5">
                                    <Textarea
                                      aria-label="Karar gerekçesi"
                                      placeholder="Karar gerekçesi (zorunlu)"
                                      value={kararNotlari[talep.id] ?? ""}
                                      onChange={(e) =>
                                        setKararNotlari((k) => ({ ...k, [talep.id]: e.target.value }))
                                      }
                                      rows={2}
                                    />
                                    <div className="flex gap-2">
                                      <Button
                                        size="sm"
                                        onClick={() => rollbackKarar(talep.id, "ONAYLA")}
                                        disabled={suruyor}
                                      >
                                        Geri Almayı Onayla
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => rollbackKarar(talep.id, "REDDET")}
                                        disabled={suruyor}
                                      >
                                        Reddet
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                            </div>
                          ) : m.ters_degisiklik === null ? (
                            <span className="text-xs text-muted-foreground">
                              Desteklenmiyor (ters set yok)
                            </span>
                          ) : (
                            <div className="flex flex-col gap-1.5">
                              <Input
                                aria-label={`Rollback gerekçesi ${m.id}`}
                                placeholder="Rollback gerekçesi"
                                value={gerekceler[m.id] ?? ""}
                                onChange={(e) => setGerekceler((g) => ({ ...g, [m.id]: e.target.value }))}
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => rollbackTalep(m.id)}
                                disabled={suruyor}
                              >
                                Rollback Talep Et
                              </Button>
                            </div>
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

      <Card>
        <CardHeader>
          <CardTitle>Değerlendirme Kuyruğu (Outbox)</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          <StatusBadge durum={bekleyenOlay > 0 ? "warning" : "success"}>
            Bekleyen olay: {bekleyenOlay}
          </StatusBadge>
          <Button variant="outline" size="sm" onClick={outboxIsle} disabled={suruyor}>
            Değerlendirmeyi Şimdi Çalıştır
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
