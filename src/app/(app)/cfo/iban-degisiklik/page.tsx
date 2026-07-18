"use client";

// Tedarikçi IBAN değişikliği doğrulama (V2 PR-3a, ADR-V2-4). CFO Kalkanı imza
// kontrolü: IBAN/ana veri değişikliği out-of-band doğrulanır, maker-checker
// kaydı tutulur. KALKAN_OS IBAN'ı DEĞİŞTİRMEZ, ödeme başlatmaz (V2 §5.1).
//
// VERİ MİNİMİZASYONU: tam IBAN sunucuya GİTMEZ — tarayıcıda maske + hash
// hesaplanır, yalnız o gönderilir (src/lib/iban.ts).
import { useCallback, useEffect, useState } from "react";
import { StatusBadge } from "@/components/durum/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { ibanBicimGecerliMi, ibanHash, ibanMaskele } from "@/lib/iban";
import { createClient } from "@/lib/supabase/client";

interface Kayit {
  id: string;
  tedarikci_ad: string;
  yeni_iban_maskeli: string;
  eski_iban_maskeli: string | null;
  out_of_band_kanal: string;
  durum: string;
  talep_eden: string;
  dogrulama_notu: string | null;
  created_at: string;
}

const DURUM: Record<string, { etiket: string; semantik: "info" | "success" | "danger" }> = {
  TALEP_EDILDI: { etiket: "Doğrulama bekliyor", semantik: "info" },
  DOGRULANDI: { etiket: "Doğrulandı", semantik: "success" },
  REDDEDILDI: { etiket: "Reddedildi", semantik: "danger" },
};

export default function IbanDegisiklikPage() {
  const { currentUser } = useAuth();
  const [kayitlar, setKayitlar] = useState<Kayit[]>([]);
  const [tedarikci, setTedarikci] = useState("");
  const [yeniIban, setYeniIban] = useState("");
  const [eskiIban, setEskiIban] = useState("");
  const [kanal, setKanal] = useState("");
  const [notlar, setNotlar] = useState<Record<string, string>>({});
  const [hata, setHata] = useState<string | null>(null);
  const [mesaj, setMesaj] = useState<string | null>(null);
  const [suruyor, setSuruyor] = useState(false);

  const yenile = useCallback(async () => {
    const db = createClient();
    const { data } = await db
      .from("supplier_bank_change_verifications")
      .select("id, tedarikci_ad, yeni_iban_maskeli, eski_iban_maskeli, out_of_band_kanal, durum, talep_eden, dogrulama_notu, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    setKayitlar((data ?? []) as Kayit[]);
  }, []);

  useEffect(() => {
    const c = async () => {
      await yenile();
    };
    void c();
  }, [yenile]);

  async function talepEt() {
    setHata(null);
    setMesaj(null);
    if (!tedarikci.trim() || !yeniIban.trim() || !kanal.trim()) {
      setHata("Tedarikçi, yeni IBAN ve doğrulama kanalı zorunlu.");
      return;
    }
    if (!ibanBicimGecerliMi(yeniIban) || (eskiIban.trim() && !ibanBicimGecerliMi(eskiIban))) {
      setHata("IBAN biçimi geçersiz (ör. TR33 0006 1005 1978 6457 8413 26).");
      return;
    }
    setSuruyor(true);
    try {
      // TAM IBAN sunucuya gitmez — maske + hash tarayıcıda hesaplanır.
      const res = await fetch("/api/cfo/iban-degisiklik", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tedarikciAd: tedarikci.trim(),
          yeniIbanMaskeli: ibanMaskele(yeniIban),
          yeniIbanHash: await ibanHash(yeniIban),
          eskiIbanMaskeli: eskiIban.trim() ? ibanMaskele(eskiIban) : null,
          eskiIbanHash: eskiIban.trim() ? await ibanHash(eskiIban) : null,
          outOfBandKanal: kanal.trim(),
        }),
      });
      const veri = await res.json();
      if (!res.ok) {
        setHata(veri.hata ?? "Talep başarısız.");
        return;
      }
      setMesaj("Değişiklik kaydı açıldı — farklı bir yetkili out-of-band doğrulamalı.");
      setTedarikci("");
      setYeniIban("");
      setEskiIban("");
      setKanal("");
      await yenile();
    } finally {
      setSuruyor(false);
    }
  }

  async function karar(id: string, k: "DOGRULA" | "REDDET") {
    const notu = (notlar[id] ?? "").trim();
    if (!notu) {
      setHata("Karar notu (out-of-band doğrulama özeti) zorunlu.");
      return;
    }
    setSuruyor(true);
    setHata(null);
    setMesaj(null);
    try {
      const res = await fetch(`/api/cfo/iban-degisiklik/${id}/karar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ karar: k, notu }),
      });
      const veri = await res.json();
      if (!res.ok) {
        setHata(veri.hata ?? "Karar başarısız.");
        return;
      }
      setMesaj(k === "DOGRULA" ? "Değişiklik doğrulandı." : "Değişiklik reddedildi.");
      await yenile();
    } finally {
      setSuruyor(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Tedarikçi IBAN Değişikliği Doğrulama</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          IBAN/ana veri değişikliği en yaygın ödeme dolandırıcılığı vektörüdür. KALKAN_OS IBAN&apos;ı
          değiştirmez, ödeme başlatmaz — yalnız değişikliğin bağımsız (out-of-band) doğrulandığını
          kayıt altına alır. <strong>Tam IBAN saklanmaz</strong>; yalnız maskeli değer ve
          geri-döndürülemez referans hash&apos;i tutulur.
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
          <CardTitle>Yeni Değişiklik Talebi</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tedarikci">Tedarikçi</Label>
              <Input id="tedarikci" value={tedarikci} onChange={(e) => setTedarikci(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="kanal">Out-of-band doğrulama kanalı</Label>
              <Input id="kanal" value={kanal} onChange={(e) => setKanal(e.target.value)} placeholder="ör. bilinen yetkiliyle telefon" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="yeni-iban">Yeni IBAN (yalnız maske+hash saklanır)</Label>
              <Input id="yeni-iban" value={yeniIban} onChange={(e) => setYeniIban(e.target.value)} placeholder="TR.." autoComplete="off" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="eski-iban">Eski IBAN (opsiyonel)</Label>
              <Input id="eski-iban" value={eskiIban} onChange={(e) => setEskiIban(e.target.value)} placeholder="TR.." autoComplete="off" />
            </div>
          </div>
          <div>
            <Button onClick={talepEt} disabled={suruyor}>
              Değişiklik Kaydı Aç
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Kayıtlar</CardTitle>
        </CardHeader>
        <CardContent>
          {kayitlar.length === 0 ? (
            <p className="text-sm text-muted-foreground">Henüz kayıt yok.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tedarikçi</TableHead>
                    <TableHead>Yeni IBAN (maskeli)</TableHead>
                    <TableHead>Kanal</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead>Karar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {kayitlar.map((k) => (
                    <TableRow key={k.id}>
                      <TableCell>{k.tedarikci_ad}</TableCell>
                      <TableCell className="font-mono text-xs">{k.yeni_iban_maskeli}</TableCell>
                      <TableCell className="text-xs">{k.out_of_band_kanal}</TableCell>
                      <TableCell>
                        <StatusBadge durum={DURUM[k.durum]?.semantik ?? "info"}>
                          {DURUM[k.durum]?.etiket ?? k.durum}
                        </StatusBadge>
                      </TableCell>
                      <TableCell>
                        {k.durum !== "TALEP_EDILDI" ? (
                          <span className="text-xs text-muted-foreground">{k.dogrulama_notu}</span>
                        ) : k.talep_eden === currentUser?.id ? (
                          <span className="text-xs text-muted-foreground">
                            Kendi talebinizi doğrulayamazsınız (maker-checker).
                          </span>
                        ) : (
                          <div className="flex flex-col gap-1.5">
                            <Textarea
                              aria-label="Karar notu"
                              placeholder="Out-of-band doğrulama özeti (zorunlu)"
                              value={notlar[k.id] ?? ""}
                              onChange={(e) => setNotlar((n) => ({ ...n, [k.id]: e.target.value }))}
                              rows={2}
                            />
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => karar(k.id, "DOGRULA")} disabled={suruyor}>
                                Doğrula
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => karar(k.id, "REDDET")} disabled={suruyor}>
                                Reddet
                              </Button>
                            </div>
                          </div>
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
