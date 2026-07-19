"use client";

// Eğitim / Yetkinlik hub (M18, G8). Gereksinim (rol bazlı + geçme eşiği) →
// atama → tamamlama (skor + attestation; geçme EŞİKTEN hesaplanır, uydurulamaz)
// + yetkinlik boşluğu. AI literacy konu bazlı (M37 ile ilişkilenir).
import { useCallback, useEffect, useMemo, useState } from "react";
import { StatusBadge, type SemantikDurum } from "@/components/durum/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { periyotYenilemeDurumu, yetkinlikBoslugu, type AtamaDurumu } from "@/lib/yetkinlik";
import { createClient } from "@/lib/supabase/client";

interface Gereksinim {
  id: string;
  ad: string;
  konu: string;
  gecme_esigi: number;
  periyot_gun: number | null;
}
interface Atama {
  id: string;
  requirement_id: string;
  durum: string;
  son_tarih: string | null;
  gereksinimAd: string;
  gecti: boolean | null;
  skor: number | null;
  periyotGun: number | null;
  tamamlandiAt: string | null;
  kaynak: string | null;
  kaynakRunId: string | null;
}

const KONU_SEM: Record<string, SemantikDurum> = {
  GENEL: "neutral",
  GUVENLIK: "info",
  KVKK: "info",
  AI_LITERACY: "legal-review",
  BEC_DEEPFAKE: "warning",
  SOD: "info",
};

export default function EgitimPage() {
  const [gereksinimler, setGereksinimler] = useState<Gereksinim[]>([]);
  const [atamalar, setAtamalar] = useState<Atama[]>([]);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [kullaniciId, setKullaniciId] = useState<string | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [gAd, setGAd] = useState("");
  const [gKonu, setGKonu] = useState("GUVENLIK");
  const [gEsik, setGEsik] = useState("70");
  const [gPeriyot, setGPeriyot] = useState("");
  const [skor, setSkor] = useState<Record<string, string>>({});

  const simdi = useMemo(() => new Date(), []);

  // user+tenant'ı state yarışına bırakmadan çöz (ilk yüklemede null olabilir).
  const baglamCoz = useCallback(async (): Promise<{ tid: string; uid: string } | null> => {
    if (tenantId && kullaniciId) return { tid: tenantId, uid: kullaniciId };
    const db = createClient();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) return null;
    const { data: p } = await db.from("profiles").select("tenant_id").eq("id", user.id).maybeSingle();
    return p?.tenant_id ? { tid: p.tenant_id, uid: user.id } : null;
  }, [tenantId, kullaniciId]);

  const yukle = useCallback(async () => {
    const db = createClient();
    const {
      data: { user },
    } = await db.auth.getUser();
    setKullaniciId(user?.id ?? null);
    if (user) {
      const { data: p } = await db.from("profiles").select("tenant_id").eq("id", user.id).maybeSingle();
      setTenantId(p?.tenant_id ?? null);
    }
    const { data: gs } = await db.from("training_requirements").select("id, ad, konu, gecme_esigi, periyot_gun").order("ad");
    setGereksinimler((gs ?? []) as Gereksinim[]);
    const { data: as } = await db
      .from("training_assignments")
      .select(
        "id, requirement_id, durum, son_tarih, training_requirements (ad, periyot_gun), training_completions (gecti, skor, tamamlandi_at, kaynak, kaynak_simulasyon_run_id)",
      )
      .order("created_at");
    setAtamalar(
      ((as ?? []) as unknown as (Omit<Atama, "gereksinimAd" | "gecti" | "skor" | "periyotGun" | "tamamlandiAt" | "kaynak" | "kaynakRunId"> & {
        training_requirements: { ad: string; periyot_gun: number | null };
        // assignment_id unique → PostgREST tekil obje döndürür (dizi değil);
        // yine de her iki biçimi de güvenle normalize et.
        training_completions:
          | { gecti: boolean; skor: number; tamamlandi_at: string; kaynak: string; kaynak_simulasyon_run_id: string | null }
          | { gecti: boolean; skor: number; tamamlandi_at: string; kaynak: string; kaynak_simulasyon_run_id: string | null }[]
          | null;
      })[]).map((a) => {
        const comp = Array.isArray(a.training_completions) ? a.training_completions[0] : a.training_completions;
        return {
          id: a.id,
          requirement_id: a.requirement_id,
          durum: a.durum,
          son_tarih: a.son_tarih,
          gereksinimAd: a.training_requirements?.ad ?? "?",
          gecti: comp?.gecti ?? null,
          skor: comp?.skor ?? null,
          periyotGun: a.training_requirements?.periyot_gun ?? null,
          tamamlandiAt: comp?.tamamlandi_at ?? null,
          kaynak: comp?.kaynak ?? null,
          kaynakRunId: comp?.kaynak_simulasyon_run_id ?? null,
        };
      }),
    );
  }, []);

  useEffect(() => {
    const c = async () => {
      await yukle();
    };
    void c();
  }, [yukle]);

  const gereksinimEkle = useCallback(async () => {
    setHata(null);
    if (!gAd.trim()) return;
    const b = await baglamCoz();
    if (!b) return setHata("Kurum bağlamı çözülemedi.");
    const db = createClient();
    const { error } = await db.from("training_requirements").insert({
      tenant_id: b.tid,
      ad: gAd.trim(),
      konu: gKonu,
      gecme_esigi: Number(gEsik) || 70,
      periyot_gun: gPeriyot.trim() ? Number(gPeriyot) : null,
    });
    if (error) return setHata(error.message);
    setGAd("");
    setGPeriyot("");
    await yukle();
  }, [gAd, gKonu, gEsik, gPeriyot, baglamCoz, yukle]);

  const ataBana = useCallback(
    async (requirementId: string) => {
      setHata(null);
      const b = await baglamCoz();
      if (!b) return;
      const db = createClient();
      const { error } = await db.from("training_assignments").insert({ tenant_id: b.tid, requirement_id: requirementId, kullanici: b.uid });
      if (error) setHata(error.message.includes("duplicate") ? "Zaten atanmış." : error.message);
      await yukle();
    },
    [baglamCoz, yukle],
  );

  const tamamla = useCallback(
    async (atama: Atama) => {
      setHata(null);
      const s = Number(skor[atama.id]);
      if (!s && s !== 0) return;
      const b = await baglamCoz();
      if (!b) return;
      const db = createClient();
      // attestation zorunlu (guard); geçme skordan hesaplanır.
      const { error } = await db.from("training_completions").insert({ tenant_id: b.tid, assignment_id: atama.id, skor: s, attestation: true });
      if (error) setHata(error.message);
      setSkor((m) => ({ ...m, [atama.id]: "" }));
      await yukle();
    },
    [skor, baglamCoz, yukle],
  );

  const gapGirdi: AtamaDurumu[] = atamalar.map((a) => ({
    kullaniciAd: "Ben",
    gereksinimAd: a.gereksinimAd,
    durum: a.durum,
    sonTarih: a.son_tarih,
    gecti: a.gecti,
  }));
  const gap = yetkinlikBoslugu(gapGirdi, simdi);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Eğitim / Yetkinlik</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Rol bazlı eğitim gereksinimleri, atama ve tamamlama. Geçme skordan hesaplanır (kullanıcı
          &quot;geçtim&quot; diyemez); tamamlama attestation (okudum-anladım) ister. Yetkinlik boşluğu
          tamamlanmamış/kalınmış atamalardan türetilir.
        </p>
      </div>

      {hata ? (
        <p role="alert" className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {hata}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>
            Yetkinlik özeti · tamamlanma {Math.round(gap.tamamlanmaOrani * 100)}%
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 text-sm">
          {gap.bosluklar.length === 0 ? (
            <p className="text-muted-foreground">Açık yetkinlik boşluğu yok.</p>
          ) : (
            gap.bosluklar.map((b, i) => (
              <div key={i} className="flex items-center gap-2">
                <StatusBadge durum="danger">Boşluk</StatusBadge>
                <span>{b.gereksinimAd}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Gereksinimler ({gereksinimler.length})</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="g-ad">Ad</Label>
              <Input id="g-ad" value={gAd} onChange={(e) => setGAd(e.target.value)} className="w-56" />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="g-konu">Konu</Label>
              <select id="g-konu" value={gKonu} onChange={(e) => setGKonu(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm">
                <option value="GENEL">Genel</option>
                <option value="GUVENLIK">Güvenlik</option>
                <option value="KVKK">KVKK</option>
                <option value="AI_LITERACY">AI okuryazarlığı</option>
                <option value="BEC_DEEPFAKE">BEC/Deepfake</option>
                <option value="SOD">SoD</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="g-esik">Geçme eşiği</Label>
              <Input id="g-esik" type="number" value={gEsik} onChange={(e) => setGEsik(e.target.value)} className="w-24" />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="g-periyot">Periyot (gün, opsiyonel)</Label>
              <Input id="g-periyot" type="number" value={gPeriyot} onChange={(e) => setGPeriyot(e.target.value)} placeholder="ör. 365" className="w-32" />
            </div>
            <Button size="sm" onClick={() => void gereksinimEkle()} disabled={!gAd.trim()}>
              Gereksinim Ekle
            </Button>
          </div>
          {gereksinimler.map((g) => (
            <div key={g.id} className="flex flex-wrap items-center gap-2 text-sm">
              <StatusBadge durum={KONU_SEM[g.konu] ?? "neutral"}>{g.konu}</StatusBadge>
              <span>{g.ad}</span>
              <span className="text-xs text-muted-foreground">eşik {g.gecme_esigi}</span>
              {g.periyot_gun ? <span className="text-xs text-muted-foreground">· periyodik: {g.periyot_gun} gün</span> : null}
              <Button size="sm" variant="outline" onClick={() => void ataBana(g.id)}>
                Bana Ata
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Atamalarım ({atamalar.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {atamalar.length === 0 ? (
            <p className="text-sm text-muted-foreground">Atama yok.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Eğitim</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead>Sonuç</TableHead>
                    <TableHead>Eylem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {atamalar.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>{a.gereksinimAd}</TableCell>
                      <TableCell>
                        <StatusBadge durum={a.durum === "TAMAMLANDI" ? "success" : "warning"}>{a.durum}</StatusBadge>
                      </TableCell>
                      <TableCell>
                        {a.gecti === null ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          <div className="flex flex-wrap items-center gap-1">
                            <StatusBadge durum={a.gecti ? "success" : "danger"}>
                              {a.gecti ? "Geçti" : "Kaldı"} ({a.skor})
                            </StatusBadge>
                            {a.kaynak === "SIMULASYON" ? (
                              a.kaynakRunId ? (
                                <a href={`/simulasyonlar/${a.kaynakRunId}`} className="underline">
                                  <StatusBadge durum="info">Tatbikattan (otomatik)</StatusBadge>
                                </a>
                              ) : (
                                <StatusBadge durum="info">Tatbikattan (otomatik)</StatusBadge>
                              )
                            ) : null}
                            {a.gecti && a.periyotGun && a.tamamlandiAt
                              ? (() => {
                                  const yenileme = periyotYenilemeDurumu(a.tamamlandiAt!, a.periyotGun!, simdi);
                                  return (
                                    <StatusBadge durum={yenileme.gecikti ? "warning" : "neutral"}>
                                      {yenileme.gecikti ? "Yenileme gecikti (otomatik atanacak)" : `Yenileme: ${yenileme.sonrakiTarih}`}
                                    </StatusBadge>
                                  );
                                })()
                              : null}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {a.gecti === null ? (
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              placeholder="Skor"
                              value={skor[a.id] ?? ""}
                              onChange={(e) => setSkor((m) => ({ ...m, [a.id]: e.target.value }))}
                              className="w-24"
                              aria-label={`${a.gereksinimAd} skor`}
                            />
                            <Button size="sm" onClick={() => void tamamla(a)} disabled={!(skor[a.id] ?? "").trim()}>
                              Tamamla (attestation)
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Tamamlandı</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
