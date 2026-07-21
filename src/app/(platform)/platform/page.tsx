"use client";

// Dikey G1: platform operatör konsolu — yeni pilot tenant açar + ilk kurum
// yöneticisini davet eder + mevcut provisioning kayıtlarını listeler. Bu bir
// billing/self-servis büyüme ekranı DEĞİLDİR (ADR §10) — yalnız kontrollü,
// operatör-başlatan bir provizyon akışı.
import { useCallback, useEffect, useState } from "react";
import { StatusBadge, type SemantikDurum } from "@/components/durum/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ProvisioningKaydi {
  id: string;
  tenant_id: string;
  durum: string;
  davet_edilen_eposta: string | null;
  pilot_baslangic: string | null;
  pilot_bitis: string | null;
  created_at: string;
  tenants: { name: string } | null;
}

const DURUM_ETIKET: Record<string, { metin: string; durum: SemantikDurum }> = {
  HAZIRLIK: { metin: "Hazırlık", durum: "neutral" },
  DAVET_GONDERILDI: { metin: "Davet gönderildi", durum: "warning" },
  ILK_GIRIS_TAMAMLANDI: { metin: "İlk giriş tamamlandı", durum: "warning" },
  KURULUM_DEVAM_EDIYOR: { metin: "Kurulum devam ediyor", durum: "warning" },
  KURULUM_INCELEMEDE: { metin: "Kurulum incelemede", durum: "warning" },
  PILOT_AKTIF: { metin: "Pilot aktif", durum: "success" },
  PILOT_DONDURULDU: { metin: "Pilot donduruldu", durum: "warning" },
  PILOT_SONA_ERDI: { metin: "Pilot sona erdi", durum: "neutral" },
};

export default function PlatformKonsolu() {
  const [kayitlar, setKayitlar] = useState<ProvisioningKaydi[]>([]);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [formAcik, setFormAcik] = useState(false);
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  const [kurumAdi, setKurumAdi] = useState("");
  const [segment, setSegment] = useState("araci_kurum");
  const [davetEposta, setDavetEposta] = useState("");
  const [pilotBaslangic, setPilotBaslangic] = useState("");
  const [pilotBitis, setPilotBitis] = useState("");

  const yukle = useCallback(async () => {
    setYukleniyor(true);
    const res = await fetch("/api/platform/tenants");
    if (res.ok) {
      const g = (await res.json()) as { kayitlar: ProvisioningKaydi[] };
      setKayitlar(g.kayitlar);
    }
    setYukleniyor(false);
  }, []);

  useEffect(() => {
    const calistir = async () => {
      await yukle();
    };
    void calistir();
  }, [yukle]);

  async function pilotOlustur(e: React.FormEvent) {
    e.preventDefault();
    setHata(null);
    setGonderiliyor(true);
    const res = await fetch("/api/platform/tenants", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        kurumAdi,
        segment,
        davetEdilenEposta: davetEposta,
        pilotBaslangic: pilotBaslangic || null,
        pilotBitis: pilotBitis || null,
      }),
    });
    setGonderiliyor(false);
    if (!res.ok) {
      const g = (await res.json().catch(() => ({}))) as { hata?: string };
      setHata(g.hata ?? "Pilot tenant oluşturulamadı.");
      return;
    }
    setKurumAdi("");
    setDavetEposta("");
    setPilotBaslangic("");
    setPilotBitis("");
    setFormAcik(false);
    await yukle();
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Platform Operatör Konsolu</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Yeni pilot kurum açma ve ilk kurum yöneticisini davet etme — kurumun iş verisi (kontrol, kanıt, bulgu) bu ekrandan
          hiç görünmez ve düzenlenemez.
        </p>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Pilot Kurumlar ({kayitlar.length})</CardTitle>
          <Button size="sm" onClick={() => setFormAcik((a) => !a)}>
            {formAcik ? "Kapat" : "+ Yeni Pilot Kurum"}
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {formAcik ? (
            <form onSubmit={(e) => void pilotOlustur(e)} className="flex flex-col gap-3 rounded-md border p-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="kurum-adi">Kurum adı</Label>
                  <Input id="kurum-adi" value={kurumAdi} onChange={(e) => setKurumAdi(e.target.value)} required />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="davet-eposta">İlk kurum yöneticisi e-posta</Label>
                  <Input id="davet-eposta" type="email" value={davetEposta} onChange={(e) => setDavetEposta(e.target.value)} required />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="segment">Segment</Label>
                  <select id="segment" className="h-9 rounded-md border px-2 text-sm" value={segment} onChange={(e) => setSegment(e.target.value)}>
                    <option value="araci_kurum">Aracı kurum</option>
                    <option value="pys">Portföy yönetim şirketi</option>
                    <option value="kvhs">Kolektif yatırım / saklama</option>
                    <option value="diger">Diğer</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="pilot-baslangic">Pilot başlangıç (opsiyonel)</Label>
                  <Input id="pilot-baslangic" type="date" value={pilotBaslangic} onChange={(e) => setPilotBaslangic(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="pilot-bitis">Pilot bitiş (opsiyonel)</Label>
                  <Input id="pilot-bitis" type="date" value={pilotBitis} onChange={(e) => setPilotBitis(e.target.value)} />
                </div>
              </div>
              {hata ? <p className="text-xs text-destructive">{hata}</p> : null}
              <Button type="submit" size="sm" disabled={gonderiliyor}>
                {gonderiliyor ? "Oluşturuluyor…" : "Pilot Oluştur ve Davet Gönder"}
              </Button>
            </form>
          ) : null}

          {yukleniyor ? (
            <p className="text-xs text-muted-foreground">Yükleniyor…</p>
          ) : kayitlar.length === 0 ? (
            <p className="text-xs text-muted-foreground">Henüz pilot kurum yok.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {kayitlar.map((k) => (
                <li key={k.id} data-testid={`pilot-satir-${k.tenant_id}`} className="flex flex-wrap items-center gap-2 rounded-md border p-2 text-xs">
                  <span className="font-medium">{k.tenants?.name ?? k.tenant_id}</span>
                  <StatusBadge durum={DURUM_ETIKET[k.durum]?.durum ?? "unknown"}>{DURUM_ETIKET[k.durum]?.metin ?? k.durum}</StatusBadge>
                  <span className="text-muted-foreground">{k.davet_edilen_eposta}</span>
                  {k.pilot_baslangic || k.pilot_bitis ? (
                    <span className="text-muted-foreground">
                      {k.pilot_baslangic ?? "—"} → {k.pilot_bitis ?? "—"}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
