"use client";

// 37 Tez Dikey A: tedarikçi anket YANITLAMA (oturumsuz). Kapsam/süre/iptal/
// yayın-kapısı RPC'lerde (tedarikci_anket_getir/taslak_kaydet/gonder) —
// bu sayfa yalnız görüntüleyici+form. Durum makinesi: TASLAK → GONDERILDI →
// (inceleme) → DEGISIKLIK_ISTENDI → [yeni revizyon] → ... → KABUL_EDILDI |
// REDDEDILDI | SURESI_DOLDU.
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { StatusBadge } from "@/components/durum/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";

interface Soru {
  id: string;
  soru: string;
  sira: number;
}
interface Revizyon {
  surum: number;
  durum: string;
  gonderildiAt: string | null;
  incelemeGerekcesi: string | null;
  incelemeZamani: string | null;
}
interface Cevap {
  questionId: string;
  cevap: string | null;
  kanitMetni: string | null;
}
interface AnketDetay {
  assessmentId: string;
  tur: string;
  assessmentDurum: string;
  sorular: Soru[];
  revizyon: Revizyon | null;
  cevaplar: Cevap[];
}

const DURUM_SEM: Record<string, "neutral" | "warning" | "success" | "danger"> = {
  TASLAK: "neutral",
  GONDERILDI: "warning",
  DEGISIKLIK_ISTENDI: "warning",
  KABUL_EDILDI: "success",
  REDDEDILDI: "danger",
  SURESI_DOLDU: "danger",
};

// Düzenlenebilir durumlar: hiç revizyon yoksa (ilk kez), mevcut revizyon
// TASLAK'sa (kaydedilmiş ama gönderilmemiş) veya DEGISIKLIK_ISTENDI'yse (yeni
// revizyon henüz açılmadı, sıradaki kayıt onu açacak). GONDERILDI (inceleme
// bekliyor) ve terminal durumlar SALT-OKUR.
function duzenlenebilirMi(revizyon: Revizyon | null): boolean {
  return revizyon === null || revizyon.durum === "TASLAK" || revizyon.durum === "DEGISIKLIK_ISTENDI";
}

export default function TedarikciAnketPage() {
  const params = useParams<{ token: string; assessmentId: string }>();
  const [veri, setVeri] = useState<AnketDetay | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [cevaplar, setCevaplar] = useState<Record<string, { cevap: string; kanitMetni: string }>>({});
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [kaydHata, setKaydHata] = useState<string | null>(null);
  const [sonKayit, setSonKayit] = useState<Date | null>(null);
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [gonderHata, setGonderHata] = useState<string | null>(null);
  const [onayAcik, setOnayAcik] = useState(false);

  const yukle = useCallback(async () => {
    const db = createClient();
    const { data } = await db.rpc("tedarikci_anket_getir", { p_token: params.token, p_assessment_id: params.assessmentId });
    const d = (data as unknown as AnketDetay | null) ?? null;
    setVeri(d);
    if (d) {
      const bas: Record<string, { cevap: string; kanitMetni: string }> = {};
      for (const s of d.sorular) {
        const mevcut = d.cevaplar.find((c) => c.questionId === s.id);
        bas[s.id] = { cevap: mevcut?.cevap ?? "", kanitMetni: mevcut?.kanitMetni ?? "" };
      }
      setCevaplar(bas);
    }
    setYukleniyor(false);
  }, [params.token, params.assessmentId]);

  useEffect(() => {
    const c = async () => {
      await yukle();
    };
    void c();
  }, [yukle]);

  const taslakKaydet = useCallback(async () => {
    if (!veri) return;
    setKaydediliyor(true);
    setKaydHata(null);
    const db = createClient();
    const gonderilecek = veri.sorular.map((s) => ({
      questionId: s.id,
      cevap: cevaplar[s.id]?.cevap ?? "",
      kanitMetni: cevaplar[s.id]?.kanitMetni ?? "",
    }));
    const { data, error } = await db.rpc("tedarikci_anket_taslak_kaydet", {
      p_token: params.token,
      p_assessment_id: params.assessmentId,
      p_cevaplar: gonderilecek,
    });
    setKaydediliyor(false);
    const sonuc = data as unknown as { hata?: string } | null;
    if (error || !sonuc || sonuc.hata) {
      setKaydHata(error?.message ?? sonuc?.hata ?? "Kaydedilemedi.");
      return;
    }
    setSonKayit(new Date());
    await yukle();
  }, [veri, cevaplar, params.token, params.assessmentId, yukle]);

  const gonder = useCallback(async () => {
    setGonderiliyor(true);
    setGonderHata(null);
    const db = createClient();
    const { data, error } = await db.rpc("tedarikci_anket_gonder", { p_token: params.token, p_assessment_id: params.assessmentId });
    setGonderiliyor(false);
    setOnayAcik(false);
    const sonuc = data as unknown as { hata?: string } | null;
    if (error || !sonuc || sonuc.hata) {
      setGonderHata(error?.message ?? sonuc?.hata ?? "Gönderilemedi.");
      return;
    }
    await yukle();
  }, [params.token, params.assessmentId, yukle]);

  if (yukleniyor) {
    return <main className="mx-auto max-w-3xl p-6 text-sm text-muted-foreground">Yükleniyor…</main>;
  }
  if (!veri) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <h1 className="text-xl font-semibold">Anket Erişimi</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Link geçersiz, süresi dolmuş, iptal edilmiş veya bu anket henüz yayınlanmamış.
        </p>
      </main>
    );
  }

  const duzenlenebilir = duzenlenebilirMi(veri.revizyon);
  const cevaplananSayisi = Object.values(cevaplar).filter((c) => c.cevap.trim()).length;

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <div>
        <Link href={`/tedarikci-erisim/${params.token}`} className="text-sm text-muted-foreground hover:underline">
          ← Tedarikçi Görünümü
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Anket · {veri.tur}</h1>
          {veri.revizyon ? (
            <StatusBadge durum={DURUM_SEM[veri.revizyon.durum] ?? "neutral"}>
              {veri.revizyon.durum} · revizyon {veri.revizyon.surum}
            </StatusBadge>
          ) : (
            <StatusBadge durum="neutral">Henüz gönderilmedi</StatusBadge>
          )}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Kurumun kabul kararı ayrı bir inceleme kararıdır — bu ekrandaki bir cevap, otomatik olarak bir kontrolü
          &quot;geçti&quot; yapmaz.
        </p>
      </div>

      {veri.revizyon?.durum === "DEGISIKLIK_ISTENDI" ? (
        <p role="alert" className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
          Kurum değişiklik istedi: {veri.revizyon.incelemeGerekcesi}
        </p>
      ) : null}
      {veri.revizyon?.durum === "REDDEDILDI" ? (
        <p role="alert" className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          Bu revizyon reddedildi{veri.revizyon.incelemeGerekcesi ? `: ${veri.revizyon.incelemeGerekcesi}` : "."}
        </p>
      ) : null}
      {veri.revizyon?.durum === "SURESI_DOLDU" ? (
        <p role="alert" className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          Bu revizyonun erişim süresi doldu. Yeni bir erişim linki için kurumla iletişime geçin.
        </p>
      ) : null}
      {veri.revizyon?.durum === "KABUL_EDILDI" ? (
        <p className="rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">Bu revizyon kabul edildi.</p>
      ) : null}
      {kaydHata ? (
        <p role="alert" className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {kaydHata}
        </p>
      ) : null}
      {gonderHata ? (
        <p role="alert" className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {gonderHata}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Sorular ({veri.sorular.length})</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {veri.sorular.length === 0 ? (
            <p className="text-sm text-muted-foreground">Bu ankette henüz soru yok.</p>
          ) : (
            veri.sorular.map((s) => (
              <div key={s.id} className="flex flex-col gap-1.5 border-b pb-3 last:border-b-0">
                <Label htmlFor={`cevap-${s.id}`}>{s.soru}</Label>
                <Textarea
                  id={`cevap-${s.id}`}
                  value={cevaplar[s.id]?.cevap ?? ""}
                  onChange={(e) => setCevaplar((m) => ({ ...m, [s.id]: { ...m[s.id], cevap: e.target.value } }))}
                  rows={3}
                  disabled={!duzenlenebilir}
                  placeholder="Cevabınız"
                />
                <Label htmlFor={`kanit-${s.id}`} className="text-xs text-muted-foreground">
                  Kanıt (metin/URL, opsiyonel)
                </Label>
                <Input
                  id={`kanit-${s.id}`}
                  value={cevaplar[s.id]?.kanitMetni ?? ""}
                  onChange={(e) => setCevaplar((m) => ({ ...m, [s.id]: { ...m[s.id], kanitMetni: e.target.value } }))}
                  disabled={!duzenlenebilir}
                  placeholder="https://… veya kısa açıklama"
                />
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {duzenlenebilir ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => void taslakKaydet()} disabled={kaydediliyor}>
            {kaydediliyor ? "Kaydediliyor…" : "Taslak Kaydet"}
          </Button>
          {sonKayit ? (
            <span className="text-xs text-muted-foreground">Son kaydedildi: {sonKayit.toLocaleTimeString("tr-TR")}</span>
          ) : null}
          <Button onClick={() => setOnayAcik(true)} disabled={cevaplananSayisi === 0} className="ml-auto">
            Gönder
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          {veri.revizyon?.durum === "GONDERILDI"
            ? "Gönderildi — kurum incelemesi bekleniyor. Cevaplar donuktur."
            : "Bu revizyon karara bağlandı — cevaplar donuktur."}
        </p>
      )}

      {onayAcik ? (
        <Card>
          <CardHeader>
            <CardTitle>Göndermeden önce onaylayın</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <p>
              {cevaplananSayisi}/{veri.sorular.length} soru cevaplandı. Gönderdikten sonra bu revizyonun cevapları
              DEĞİŞTİRİLEMEZ — kurum değişiklik isterse yeni bir revizyon açılır.
            </p>
            <div className="flex gap-2">
              <Button onClick={() => void gonder()} disabled={gonderiliyor}>
                {gonderiliyor ? "Gönderiliyor…" : "Evet, Gönder"}
              </Button>
              <Button variant="outline" onClick={() => setOnayAcik(false)} disabled={gonderiliyor}>
                Vazgeç
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}
