"use client";

// Dikey F, F4: bir test koşusuna ölçülen kurtarma verisini KAYDEDER + gösterir.
// NİCEL KARŞILAŞTIRMA YOK — hiçbir "RTO/RPO karşılandı" ifadesi üretilmez.
// Kullanıcı formu yalnız MANUEL_BEYAN üretir; "bu bir beyandır" uyarısı taşır.
import { useCallback, useEffect, useState } from "react";
import { StatusBadge } from "@/components/durum/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Olcum {
  id: string;
  olcum_kaynagi: string;
  girdi_modu: string;
  kesinti_baslangic_at: string | null;
  hizmet_geri_geldi_at: string | null;
  son_tutarli_veri_at: string | null;
  kurtarma_noktasi_at: string | null;
  beyan_kesinti_saat: number | null;
  beyan_veri_kaybi_saat: number | null;
  olculen_kesinti_saat: number | null;
  olculen_veri_kaybi_saat: number | null;
  supersedes_measurement_id: string | null;
  olcum_hash: string;
  measured_at: string;
  recorded_at: string;
  guncel: boolean;
}

type Mod = "EVENT_TIMESTAMPS" | "DURATION_DECLARATION";

interface KarsilastirmaMetrikSonucu {
  sonuc: string;
  olculenDegerSaat: number | null;
  hedefSaat: number | null;
  aciklama: string;
}
interface KarsilastirmaVerisi {
  rto: KarsilastirmaMetrikSonucu;
  rpo: KarsilastirmaMetrikSonucu;
  olcumKaynagi: string;
  toleransSurumu: number;
}

const KARSILASTIRMA_SONUC_DURUM: Record<string, "success" | "danger" | "warning" | "neutral"> = {
  KARSILADI: "success",
  ASTI: "danger",
  OLCUM_YOK: "neutral",
  TOLERANS_YOK: "neutral",
  KARSILASTIRILAMAZ: "warning",
};
const KARSILASTIRMA_SONUC_ETIKET: Record<string, string> = {
  KARSILADI: "Karşıladı",
  ASTI: "Aştı",
  OLCUM_YOK: "Ölçüm yok",
  TOLERANS_YOK: "Tolerans yok",
  KARSILASTIRILAMAZ: "Karşılaştırılamaz",
};

function saatMetni(v: number | null): string {
  return v === null ? "—" : `${Number(v)} saat`;
}

export function KurtarmaOlcumuBolumu({ testRunId, criticalServiceId }: { testRunId: string; criticalServiceId: string | null }) {
  const [olcumler, setOlcumler] = useState<Olcum[]>([]);
  const [acik, setAcik] = useState(false);
  const [mod, setMod] = useState<Mod>("EVENT_TIMESTAMPS");
  const [hata, setHata] = useState<string | null>(null);
  const [gonderiliyor, setGonderiliyor] = useState(false);

  // Form alanları
  const [kesintiBaslangic, setKesintiBaslangic] = useState("");
  const [hizmetGeriGeldi, setHizmetGeriGeldi] = useState("");
  const [sonTutarliVeri, setSonTutarliVeri] = useState("");
  const [kurtarmaNoktasi, setKurtarmaNoktasi] = useState("");
  const [beyanKesinti, setBeyanKesinti] = useState("");
  const [beyanVeriKaybi, setBeyanVeriKaybi] = useState("");
  // Dikey F, F5 hazırlık — Karar D: kesinti olay zamanı varsa ölçüm zamanı
  // ondan TÜRETİLİR (bu alan gizlenir); aksi halde AÇIK ve ZORUNLU girdi.
  const [olcumZamani, setOlcumZamani] = useState("");
  const olcumZamaniTurendi = mod === "EVENT_TIMESTAMPS" && hizmetGeriGeldi !== "";

  // Dikey F, F5: bu koşunun güncel kurtarma karşılaştırması (varsa).
  const [karsilastirma, setKarsilastirma] = useState<KarsilastirmaVerisi | null>(null);
  const [karsilastirmaLedgerDurumu, setKarsilastirmaLedgerDurumu] = useState<string | null>(null);
  const [karsilastiriliyor, setKarsilastiriliyor] = useState(false);
  const [karsilastirmaHata, setKarsilastirmaHata] = useState<string | null>(null);

  const yukle = useCallback(async () => {
    const res = await fetch(`/api/kontrol-test/run/${testRunId}/kurtarma-olcumu`);
    if (res.ok) {
      const g = (await res.json()) as { olcumler: Olcum[] };
      setOlcumler(g.olcumler);
    }
  }, [testRunId]);

  const karsilastirmayiYukle = useCallback(async () => {
    const res = await fetch(`/api/kontrol-test/run/${testRunId}/kurtarma-karsilastirmasi`);
    if (res.ok) {
      const g = (await res.json()) as { karsilastirma: KarsilastirmaVerisi | null; ledgerDurumu?: string };
      setKarsilastirma(g.karsilastirma);
      setKarsilastirmaLedgerDurumu(g.ledgerDurumu ?? null);
    }
  }, [testRunId]);

  // TEMBEL YÜKLEME: bölüm KAPALIYKEN hiç fetch YAPILMAZ. Bir kontrolün onlarca
  // test tanımı olabilir; her koşu için mount anında fetch etmek Session Pooler
  // bağlantı havuzunu tüketirdi. Yalnız kullanıcı bölümü AÇTIĞINDA veri gelir.
  useEffect(() => {
    if (!acik) return;
    const calistir = async () => {
      await yukle();
      if (criticalServiceId) await karsilastirmayiYukle();
    };
    void calistir();
  }, [acik, yukle, karsilastirmayiYukle, criticalServiceId]);

  async function karsilastir() {
    if (!criticalServiceId) return;
    setKarsilastirmaHata(null);
    setKarsilastiriliyor(true);
    const res = await fetch(`/api/kontrol-test/run/${testRunId}/kurtarma-karsilastirmasi`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ criticalServiceId }),
    });
    setKarsilastiriliyor(false);
    if (!res.ok) {
      const e = (await res.json().catch(() => ({}))) as { hata?: string };
      setKarsilastirmaHata(e.hata ?? "Karşılaştırma oluşturulamadı.");
      return;
    }
    await karsilastirmayiYukle();
  }

  async function kaydet() {
    setHata(null);
    if (!olcumZamaniTurendi && olcumZamani === "") {
      setHata("Ölçüm zamanı zorunludur.");
      return;
    }
    setGonderiliyor(true);
    const iso = (v: string) => (v ? new Date(v).toISOString() : null);
    const govde =
      mod === "EVENT_TIMESTAMPS"
        ? {
            inputMode: mod,
            kesintiBaslangicAt: iso(kesintiBaslangic),
            hizmetGeriGeldiAt: iso(hizmetGeriGeldi),
            sonTutarliVeriAt: iso(sonTutarliVeri),
            kurtarmaNoktasiAt: iso(kurtarmaNoktasi),
            // Türetilmiş durumda gönderilmez — sunucu hizmetGeriGeldiAt'ten türetir.
            measuredAt: olcumZamaniTurendi ? undefined : iso(olcumZamani),
            declarantPresent: true,
          }
        : {
            inputMode: mod,
            beyanKesintiSaat: beyanKesinti === "" ? null : Number(beyanKesinti),
            beyanVeriKaybiSaat: beyanVeriKaybi === "" ? null : Number(beyanVeriKaybi),
            measuredAt: iso(olcumZamani),
            declarantPresent: true,
          };
    const res = await fetch(`/api/kontrol-test/run/${testRunId}/kurtarma-olcumu`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(govde),
    });
    setGonderiliyor(false);
    if (!res.ok) {
      const e = (await res.json().catch(() => ({}))) as { hata?: string };
      setHata(e.hata ?? "Kaydedilemedi.");
      return;
    }
    // Panel AÇIK kalır: kaydedilen beyan hemen listede görünsün (form temizlenir).
    setKesintiBaslangic("");
    setHizmetGeriGeldi("");
    setSonTutarliVeri("");
    setKurtarmaNoktasi("");
    setBeyanKesinti("");
    setBeyanVeriKaybi("");
    setOlcumZamani("");
    await yukle();
    // Yeni ölçüm eskisini supersede eder — mevcut karşılaştırma (varsa) artık
    // ESKİ ölçümü yansıtıyor olabilir; durumu tazele (kullanıcı "Karşılaştır"
    // ile yeni bir karşılaştırma üretebilir, eski tarihsel artefakt kalır).
    if (criticalServiceId) await karsilastirmayiYukle();
  }

  return (
    <div className="mt-3 flex flex-col gap-2 rounded-md border border-dashed p-2" data-testid={`kurtarma-olcumu-${testRunId}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium">Kurtarma Ölçümü</p>
        <Button size="sm" variant="outline" onClick={() => setAcik((a) => !a)}>
          {acik ? "Kapat" : "Ölçüm Ekle"}
        </Button>
      </div>

      {acik ? (
        <>
          {olcumler.length === 0 ? (
            <p className="text-xs text-muted-foreground">Bu koşuya bağlı kurtarma ölçümü yok.</p>
          ) : (
            olcumler.map((o) => (
              <div key={o.id} data-testid={`olcum-satir-${o.id}`} className="flex flex-col gap-1 border-t pt-2 first:border-t-0 first:pt-0 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge durum={o.guncel ? "info" : "neutral"}>{o.guncel ? "Güncel" : "Süperseded (düzeltildi)"}</StatusBadge>
                  <StatusBadge durum="warning">Kullanıcı beyanı (otomatik ölçüm değil)</StatusBadge>
                </div>
                <p className="text-muted-foreground">
                  Kesinti süresi: {o.girdi_modu === "EVENT_TIMESTAMPS" ? saatMetni(o.olculen_kesinti_saat) : saatMetni(o.beyan_kesinti_saat)} · Veri kaybı:{" "}
                  {o.girdi_modu === "EVENT_TIMESTAMPS" ? saatMetni(o.olculen_veri_kaybi_saat) : saatMetni(o.beyan_veri_kaybi_saat)}
                </p>
                {/* Dikey F, F5 Karar D: measured_at (ölçüm anı) ile recorded_at
                    (sistem kayıt anı) AÇIKÇA AYRI gösterilir — aynı şey değildir. */}
                <p className="text-muted-foreground">
                  Ölçüm zamanı: {new Date(o.measured_at).toLocaleString("tr-TR")} · Kayıt zamanı: {new Date(o.recorded_at).toLocaleString("tr-TR")}
                </p>
              </div>
            ))
          )}

          {olcumler.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              Bu değerler kullanıcı beyanıdır; otomatik sistem ölçümü değildir.
              {!karsilastirma ? " Onaylı hedeflerle (RTO/RPO) nicel karşılaştırma yapılmamıştır." : null}
            </p>
          ) : null}

          {/* Dikey F, F5: onaylı hedefle (ölçüm anında yürürlükte olan tolerans
              sürümüyle) nicel karşılaştırma — RTO/RPO BAĞIMSIZ, kaynağa göre
              dil (beyan/ölçüm) ayrımı korunur. */}
          {criticalServiceId && olcumler.length > 0 ? (
            <div className="mt-1 flex flex-col gap-2 rounded-md border border-dashed p-2" data-testid={`kurtarma-karsilastirmasi-${testRunId}`}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium">Onaylı Hedefle Karşılaştırma</p>
                {olcumler.some((o) => o.guncel) ? (
                  <Button size="sm" variant="outline" onClick={() => void karsilastir()} disabled={karsilastiriliyor}>
                    {karsilastiriliyor ? "Karşılaştırılıyor…" : karsilastirma ? "Yeniden Karşılaştır" : "Karşılaştır"}
                  </Button>
                ) : null}
              </div>
              {karsilastirmaHata ? (
                <p className="text-xs text-destructive" data-testid={`karsilastirma-hata-${testRunId}`}>
                  {karsilastirmaHata}
                </p>
              ) : null}
              {karsilastirma ? (
                <div className="flex flex-col gap-2 text-xs" data-testid={`karsilastirma-sonuc-${testRunId}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-muted-foreground">RTO</span>
                    <StatusBadge durum={KARSILASTIRMA_SONUC_DURUM[karsilastirma.rto.sonuc] ?? "neutral"}>
                      {KARSILASTIRMA_SONUC_ETIKET[karsilastirma.rto.sonuc] ?? karsilastirma.rto.sonuc}
                    </StatusBadge>
                  </div>
                  <p className="text-muted-foreground">{karsilastirma.rto.aciklama}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-muted-foreground">RPO</span>
                    <StatusBadge durum={KARSILASTIRMA_SONUC_DURUM[karsilastirma.rpo.sonuc] ?? "neutral"}>
                      {KARSILASTIRMA_SONUC_ETIKET[karsilastirma.rpo.sonuc] ?? karsilastirma.rpo.sonuc}
                    </StatusBadge>
                  </div>
                  <p className="text-muted-foreground">{karsilastirma.rpo.aciklama}</p>
                  {karsilastirmaLedgerDurumu && karsilastirmaLedgerDurumu !== "ANCHORED" ? (
                    <p className="text-muted-foreground">Bütünlük kaydı henüz anchor edilmedi.</p>
                  ) : null}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Bu koşu için henüz bir karşılaştırma oluşturulmadı.</p>
              )}
            </div>
          ) : null}

          <div className="mt-1 flex flex-col gap-2 rounded-md border p-2">
          <div className="flex gap-2">
            <Button size="sm" variant={mod === "EVENT_TIMESTAMPS" ? "default" : "outline"} onClick={() => setMod("EVENT_TIMESTAMPS")}>
              Olay zamanları
            </Button>
            <Button size="sm" variant={mod === "DURATION_DECLARATION" ? "default" : "outline"} onClick={() => setMod("DURATION_DECLARATION")}>
              Süre beyanı
            </Button>
          </div>

          {mod === "EVENT_TIMESTAMPS" ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div>
                <Label htmlFor={`kb-${testRunId}`}>Kesinti başlangıcı</Label>
                <Input id={`kb-${testRunId}`} type="datetime-local" value={kesintiBaslangic} onChange={(e) => setKesintiBaslangic(e.target.value)} />
              </div>
              <div>
                <Label htmlFor={`hg-${testRunId}`}>Hizmet geri geldi</Label>
                <Input id={`hg-${testRunId}`} type="datetime-local" value={hizmetGeriGeldi} onChange={(e) => setHizmetGeriGeldi(e.target.value)} />
              </div>
              <div>
                <Label htmlFor={`sv-${testRunId}`}>Son tutarlı veri anı</Label>
                <Input id={`sv-${testRunId}`} type="datetime-local" value={sonTutarliVeri} onChange={(e) => setSonTutarliVeri(e.target.value)} />
              </div>
              <div>
                <Label htmlFor={`kn-${testRunId}`}>Kurtarma noktası</Label>
                <Input id={`kn-${testRunId}`} type="datetime-local" value={kurtarmaNoktasi} onChange={(e) => setKurtarmaNoktasi(e.target.value)} />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div>
                <Label htmlFor={`bk-${testRunId}`}>Beyan: kesinti süresi (saat)</Label>
                <Input id={`bk-${testRunId}`} type="number" min="0" step="0.1" value={beyanKesinti} onChange={(e) => setBeyanKesinti(e.target.value)} />
              </div>
              <div>
                <Label htmlFor={`bv-${testRunId}`}>Beyan: veri kaybı (saat)</Label>
                <Input id={`bv-${testRunId}`} type="number" min="0" step="0.1" value={beyanVeriKaybi} onChange={(e) => setBeyanVeriKaybi(e.target.value)} />
              </div>
            </div>
          )}

          {olcumZamaniTurendi ? (
            <p className="text-xs text-muted-foreground">
              Ölçüm zamanı, hizmetin geri geldiği an ile aynı alınır (ayrıca girmenize gerek yok).
            </p>
          ) : (
            <div>
              <Label htmlFor={`oz-${testRunId}`}>Ölçüm zamanı (zorunlu)</Label>
              <Input id={`oz-${testRunId}`} type="datetime-local" value={olcumZamani} onChange={(e) => setOlcumZamani(e.target.value)} />
              <p className="mt-1 text-xs text-muted-foreground">
                Bu, ölçümün GERÇEKLEŞTİĞİ andır — formu doldurduğunuz an değil.
              </p>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Girdiğiniz değerler kullanıcı beyanı olarak kaydedilir (otomatik ölçüm değil). Süreler sunucuda türetilir; birim SAAT.
          </p>
          {hata ? (
            <p className="text-xs text-destructive" data-testid={`olcum-hata-${testRunId}`}>
              {hata}
            </p>
          ) : null}
          <Button size="sm" onClick={() => void kaydet()} disabled={gonderiliyor}>
            {gonderiliyor ? "Kaydediliyor…" : "Beyanı Kaydet"}
          </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}
