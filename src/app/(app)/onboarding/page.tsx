"use client";

// Dikey G1: pilot kurumun ilk kurulumu — KVKK/şartlar kabulü → veri içe
// aktarma (kritik hizmet) → mevzuat kapsamı seçimi → kurulumu incelemeye
// gönder. Bilinçli olarak TEK sayfa (ADR'nin 9 adımlı sihirbaz taslağının
// işlevsel karşılığı, ayrı adım ekranları değil — bkz. final rapor).
import { useCallback, useEffect, useState } from "react";
import { StatusBadge, type SemantikDurum } from "@/components/durum/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";

interface Provisioning {
  id: string;
  durum: string;
  pilot_baslangic: string | null;
  pilot_bitis: string | null;
}
interface RegulationPackage {
  id: string;
  kod: string;
  ad: string;
  hukuk_dogrulama_durumu: string;
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

export default function OnboardingSayfasi() {
  const { currentUser } = useAuth();
  const [provisioning, setProvisioning] = useState<Provisioning | null>(null);
  const [paketler, setPaketler] = useState<RegulationPackage[]>([]);
  const [hata, setHata] = useState<string | null>(null);
  const [islemSuruyor, setIslemSuruyor] = useState(false);

  const [kvkkKabul, setKvkkKabul] = useState(false);
  const [sartlarKabul, setSartlarKabul] = useState(false);
  const [csvMetni, setCsvMetni] = useState("");
  const [importSonuc, setImportSonuc] = useState<{ id: string; kayitSayisi: number; satirHatalari: unknown[] } | null>(null);
  const [secilenPaketId, setSecilenPaketId] = useState("");

  const yukle = useCallback(async () => {
    const [dRes, pRes] = await Promise.all([fetch("/api/onboarding/durum"), fetch("/api/onboarding/regulation-packages")]);
    if (dRes.ok) {
      const g = (await dRes.json()) as { provisioning: Provisioning };
      setProvisioning(g.provisioning);
    }
    if (pRes.ok) {
      const g = (await pRes.json()) as { paketler: RegulationPackage[] };
      setPaketler(g.paketler);
    }
  }, []);

  useEffect(() => {
    const calistir = async () => {
      await yukle();
    };
    void calistir();
  }, [yukle]);

  async function ilkGirisiTamamla() {
    setHata(null);
    setIslemSuruyor(true);
    const res = await fetch("/api/onboarding/ilk-giris-tamamla", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kvkkKabul, sartlarKabul }),
    });
    setIslemSuruyor(false);
    if (!res.ok) {
      const g = (await res.json().catch(() => ({}))) as { hata?: string };
      setHata(g.hata ?? "Tamamlanamadı.");
      return;
    }
    await yukle();
  }

  async function durumIlerlet(hedefDurum: string) {
    setHata(null);
    setIslemSuruyor(true);
    const res = await fetch("/api/onboarding/durum", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ hedefDurum }),
    });
    setIslemSuruyor(false);
    if (!res.ok) {
      const g = (await res.json().catch(() => ({}))) as { hata?: string };
      setHata(g.hata ?? "Durum güncellenemedi.");
      return;
    }
    await yukle();
  }

  async function kritikHizmetIceAktar() {
    setHata(null);
    setIslemSuruyor(true);
    const res = await fetch("/api/onboarding/import/KRITIK_HIZMET/onizle", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ csvMetni, kaynak: "csv" }),
    });
    setIslemSuruyor(false);
    if (!res.ok) {
      const g = (await res.json().catch(() => ({}))) as { hata?: string };
      setHata(g.hata ?? "İçe aktarma önizlemesi oluşturulamadı.");
      return;
    }
    const g = (await res.json()) as { onizleme: { id: string; kayit_sayisi: number; satir_hatalari: unknown[] } };
    setImportSonuc({ id: g.onizleme.id, kayitSayisi: g.onizleme.kayit_sayisi, satirHatalari: g.onizleme.satir_hatalari });
  }

  async function paketSec() {
    if (!secilenPaketId) return;
    setHata(null);
    setIslemSuruyor(true);
    const res = await fetch("/api/onboarding/regulation-scope", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ regulationPackageId: secilenPaketId }),
    });
    setIslemSuruyor(false);
    if (!res.ok) {
      const g = (await res.json().catch(() => ({}))) as { hata?: string };
      setHata(g.hata ?? "Kapsam seçilemedi.");
      return;
    }
    setSecilenPaketId("");
  }

  if (!provisioning) {
    return (
      <main className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">Bu kurum için bir pilot kurulum kaydı bulunamadı.</p>
      </main>
    );
  }

  return (
    <main className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Pilot Kurulumu</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Hoş geldiniz{currentUser ? `, ${currentUser.fullName}` : ""}. Kurumunuzun temel verilerini girin ve mevzuat
          kapsamınızı seçin.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Kurulum Durumu</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm" data-testid="onboarding-durum-karti">
          <StatusBadge durum={DURUM_ETIKET[provisioning.durum]?.durum ?? "unknown"}>
            {DURUM_ETIKET[provisioning.durum]?.metin ?? provisioning.durum}
          </StatusBadge>
          {hata ? <p className="text-xs text-destructive">{hata}</p> : null}

          {provisioning.durum === "DAVET_GONDERILDI" ? (
            <div className="flex flex-col gap-2 rounded-md border p-3">
              <p className="text-xs text-muted-foreground">
                Devam etmeden önce KVKK aydınlatma metnini ve pilot kullanım şartlarını kabul etmeniz gerekir.
              </p>
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={kvkkKabul} onChange={(e) => setKvkkKabul(e.target.checked)} />
                KVKK aydınlatma metnini okudum, kabul ediyorum.
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={sartlarKabul} onChange={(e) => setSartlarKabul(e.target.checked)} />
                Pilot kullanım şartlarını kabul ediyorum.
              </label>
              <Button size="sm" disabled={!kvkkKabul || !sartlarKabul || islemSuruyor} onClick={() => void ilkGirisiTamamla()}>
                Devam Et
              </Button>
            </div>
          ) : null}

          {provisioning.durum === "ILK_GIRIS_TAMAMLANDI" ? (
            <Button size="sm" disabled={islemSuruyor} onClick={() => void durumIlerlet("KURULUM_DEVAM_EDIYOR")}>
              Kuruluma Başla
            </Button>
          ) : null}

          {provisioning.durum === "KURULUM_DEVAM_EDIYOR" ? (
            <Button size="sm" disabled={islemSuruyor} onClick={() => void durumIlerlet("KURULUM_INCELEMEDE")}>
              Kurulumu İncelemeye Gönder
            </Button>
          ) : null}
        </CardContent>
      </Card>

      {provisioning.durum === "KURULUM_DEVAM_EDIYOR" ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Kritik Hizmetlerinizi İçe Aktarın</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              <p className="text-xs text-muted-foreground">
                CSV formatı: <code>ad,durum</code> — yalnız <code>ad</code> zorunludur. WardProof&apos;un hazır kontrol
                şablonu bir başlangıç materyalidir; kurumunuzun gerçek yapısının yerine geçmez.
              </p>
              <textarea
                className="min-h-24 rounded-md border p-2 font-mono text-xs"
                value={csvMetni}
                onChange={(e) => setCsvMetni(e.target.value)}
                placeholder={"ad,durum\nÖdeme Sistemi,AKTIF"}
              />
              <Button size="sm" disabled={!csvMetni || islemSuruyor} onClick={() => void kritikHizmetIceAktar()}>
                Önizle
              </Button>
              {importSonuc ? (
                <p className="text-xs text-muted-foreground" data-testid="import-onizleme-sonuc">
                  {importSonuc.kayitSayisi} kayıt ayrıştırıldı, {importSonuc.satirHatalari.length} satır hatası. Uygulamak
                  için bağımsız bir kurum yöneticisi onayı gerekir (bkz. içe aktarma geçmişi).
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Mevzuat Kapsamı</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              <p className="text-xs text-muted-foreground">Yalnız hukukça doğrulanmış paketler seçilebilir.</p>
              <div className="flex flex-wrap gap-2">
                {paketler.map((p) => (
                  <label key={p.id} className="flex items-center gap-1.5 text-xs">
                    <input
                      type="radio"
                      name="paket"
                      value={p.id}
                      disabled={p.hukuk_dogrulama_durumu !== "VERIFIED"}
                      checked={secilenPaketId === p.id}
                      onChange={() => setSecilenPaketId(p.id)}
                    />
                    {p.ad}
                    <StatusBadge durum={p.hukuk_dogrulama_durumu === "VERIFIED" ? "success" : "neutral"}>
                      {p.hukuk_dogrulama_durumu === "VERIFIED" ? "Doğrulanmış" : "Onay bekliyor"}
                    </StatusBadge>
                  </label>
                ))}
              </div>
              <Button size="sm" disabled={!secilenPaketId || islemSuruyor} onClick={() => void paketSec()}>
                Kapsamı Seç
              </Button>
            </CardContent>
          </Card>
        </>
      ) : null}
    </main>
  );
}
