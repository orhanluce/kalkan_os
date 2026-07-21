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
  guncel: boolean;
}

type Mod = "EVENT_TIMESTAMPS" | "DURATION_DECLARATION";

function saatMetni(v: number | null): string {
  return v === null ? "—" : `${Number(v)} saat`;
}

export function KurtarmaOlcumuBolumu({ testRunId }: { testRunId: string }) {
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

  const yukle = useCallback(async () => {
    const res = await fetch(`/api/kontrol-test/run/${testRunId}/kurtarma-olcumu`);
    if (res.ok) {
      const g = (await res.json()) as { olcumler: Olcum[] };
      setOlcumler(g.olcumler);
    }
  }, [testRunId]);

  // TEMBEL YÜKLEME: bölüm KAPALIYKEN hiç fetch YAPILMAZ. Bir kontrolün onlarca
  // test tanımı olabilir; her koşu için mount anında fetch etmek Session Pooler
  // bağlantı havuzunu tüketirdi. Yalnız kullanıcı bölümü AÇTIĞINDA veri gelir.
  useEffect(() => {
    if (!acik) return;
    const calistir = async () => {
      await yukle();
    };
    void calistir();
  }, [acik, yukle]);

  async function kaydet() {
    setHata(null);
    setGonderiliyor(true);
    const iso = (v: string) => (v ? new Date(v).toISOString() : null);
    const govde =
      mod === "EVENT_TIMESTAMPS"
        ? { inputMode: mod, kesintiBaslangicAt: iso(kesintiBaslangic), hizmetGeriGeldiAt: iso(hizmetGeriGeldi), sonTutarliVeriAt: iso(sonTutarliVeri), kurtarmaNoktasiAt: iso(kurtarmaNoktasi), declarantPresent: true }
        : { inputMode: mod, beyanKesintiSaat: beyanKesinti === "" ? null : Number(beyanKesinti), beyanVeriKaybiSaat: beyanVeriKaybi === "" ? null : Number(beyanVeriKaybi), declarantPresent: true };
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
    await yukle();
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
                  <span className="text-muted-foreground">{new Date(o.measured_at).toLocaleString("tr-TR")}</span>
                </div>
                <p className="text-muted-foreground">
                  Kesinti süresi: {o.girdi_modu === "EVENT_TIMESTAMPS" ? saatMetni(o.olculen_kesinti_saat) : saatMetni(o.beyan_kesinti_saat)} · Veri kaybı:{" "}
                  {o.girdi_modu === "EVENT_TIMESTAMPS" ? saatMetni(o.olculen_veri_kaybi_saat) : saatMetni(o.beyan_veri_kaybi_saat)}
                </p>
              </div>
            ))
          )}

          {olcumler.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              Bu değerler kullanıcı beyanıdır; otomatik sistem ölçümü değildir. Onaylı hedeflerle (RTO/RPO) nicel karşılaştırma yapılmamıştır.
            </p>
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
