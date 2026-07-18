"use client";

// Tedarikçi / ICT tedarik zinciri riski — İNDEKS (M35, G4). Oluştur + listele +
// yoğunlaşma özeti. Detay (hizmet/dördüncü-taraf/sözleşme/çıkış planı/karar/
// RoI) /tedarikciler/[id]'de.
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { StatusBadge, type SemantikDurum } from "@/components/durum/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { konsantrasyonAnalizi, type TedarikciGraf } from "@/lib/tedarikci";
import { createClient } from "@/lib/supabase/client";

export const TIER: Record<string, { etiket: string; semantik: SemantikDurum }> = {
  KRITIK: { etiket: "Kritik", semantik: "danger" },
  ONEMLI: { etiket: "Önemli", semantik: "warning" },
  DUSUK: { etiket: "Düşük", semantik: "neutral" },
};
export const KARAR: Record<string, { etiket: string; semantik: SemantikDurum }> = {
  INCELEME: { etiket: "İncelemede", semantik: "legal-review" },
  ONAYLANDI: { etiket: "Onaylandı", semantik: "success" },
  REDDEDILDI: { etiket: "Reddedildi", semantik: "danger" },
};

interface Tedarikci {
  id: string;
  ad: string;
  tier: string;
  karar: string;
  durum: string;
}

export default function TedariklerPage() {
  const [liste, setListe] = useState<Tedarikci[]>([]);
  const [konsantrasyon, setKonsantrasyon] = useState<ReturnType<typeof konsantrasyonAnalizi> | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState<string | null>(null);
  const [yeniAd, setYeniAd] = useState("");
  const [yeniTier, setYeniTier] = useState("DUSUK");

  const yukle = useCallback(async () => {
    const db = createClient();
    const { data: tps } = await db
      .from("third_parties")
      .select("id, ad, tier, karar, durum, third_party_services (kritik), fourth_parties (id, ad, bilinmiyor)")
      .order("ad");
    const rows = (tps ?? []) as unknown as (Tedarikci & {
      third_party_services: { kritik: boolean }[];
      fourth_parties: { id: string; ad: string | null; bilinmiyor: boolean }[];
    })[];
    setListe(rows.map((t) => ({ id: t.id, ad: t.ad, tier: t.tier, karar: t.karar, durum: t.durum })));
    const graf: TedarikciGraf[] = rows.map((t) => ({
      id: t.id,
      ad: t.ad,
      tier: t.tier as TedarikciGraf["tier"],
      kritikHizmetVar: (t.third_party_services ?? []).some((s) => s.kritik),
      dorduncuTaraflar: (t.fourth_parties ?? []).map((f) => ({ id: f.id, ad: f.ad, bilinmiyor: f.bilinmiyor })),
    }));
    setKonsantrasyon(konsantrasyonAnalizi(graf));
    setYukleniyor(false);
  }, []);

  useEffect(() => {
    const c = async () => {
      await yukle();
    };
    void c();
  }, [yukle]);

  const olustur = useCallback(async () => {
    setHata(null);
    if (!yeniAd.trim()) return;
    const db = createClient();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) return;
    const { data: profil } = await db.from("profiles").select("tenant_id").eq("id", user.id).maybeSingle();
    if (!profil?.tenant_id) {
      setHata("Kurum bağlamı çözülemedi.");
      return;
    }
    const { error } = await db.from("third_parties").insert({ tenant_id: profil.tenant_id, ad: yeniAd.trim(), tier: yeniTier });
    if (error) {
      setHata(error.message);
      return;
    }
    setYeniAd("");
    await yukle();
  }, [yeniAd, yeniTier, yukle]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Tedarikçiler</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Üçüncü/dördüncü taraf ICT tedarik zinciri riski. Vendor kararı yalnız insana aittir (dış
          rating otomatik karar değildir); çıkış planı tatbikat kanıtı olmadan &quot;test edildi&quot;
          işaretlenemez; bilinmeyen alt-bağımlılık düşük risk sayılmaz.
        </p>
      </div>

      {hata ? (
        <p role="alert" className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {hata}
        </p>
      ) : null}

      {konsantrasyon && (konsantrasyon.yogunlasmaNoktalari.length > 0 || konsantrasyon.bilinmeyenBagimliligiOlanlar.length > 0) ? (
        <Card>
          <CardHeader>
            <CardTitle>Yoğunlaşma sinyalleri</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {konsantrasyon.yogunlasmaNoktalari.map((y) => (
              <div key={y.dorduncuTarafAd} className="flex flex-wrap items-center gap-2">
                <StatusBadge durum="warning">Yoğunlaşma</StatusBadge>
                <span>
                  <strong>{y.dorduncuTarafAd}</strong> — {y.bagimliTedarikciler.join(", ")}
                </span>
              </div>
            ))}
            {konsantrasyon.bilinmeyenBagimliligiOlanlar.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge durum="unknown">Bilinmeyen bağımlılık</StatusBadge>
                <span>{konsantrasyon.bilinmeyenBagimliligiOlanlar.join(", ")} (düşük risk varsayılmaz)</span>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Yeni tedarikçi</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="tp-ad">Ad</Label>
              <Input id="tp-ad" value={yeniAd} onChange={(e) => setYeniAd(e.target.value)} placeholder="Bulut Sağlayıcı A.Ş." className="w-72" />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="tp-tier">Kritiklik</Label>
              <select id="tp-tier" value={yeniTier} onChange={(e) => setYeniTier(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm">
                <option value="KRITIK">Kritik</option>
                <option value="ONEMLI">Önemli</option>
                <option value="DUSUK">Düşük</option>
              </select>
            </div>
            <Button onClick={() => void olustur()} disabled={!yeniAd.trim()}>
              Oluştur
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tedarikçiler ({liste.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {yukleniyor ? (
            <p className="text-sm text-muted-foreground">Yükleniyor…</p>
          ) : liste.length === 0 ? (
            <p className="text-sm text-muted-foreground">Henüz tedarikçi yok.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ad</TableHead>
                    <TableHead>Kritiklik</TableHead>
                    <TableHead>Karar</TableHead>
                    <TableHead>Durum</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {liste.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">
                        <Link href={`/tedarikciler/${t.id}`} className="text-primary hover:underline">
                          {t.ad}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <StatusBadge durum={TIER[t.tier]?.semantik ?? "neutral"}>{TIER[t.tier]?.etiket ?? t.tier}</StatusBadge>
                      </TableCell>
                      <TableCell>
                        <StatusBadge durum={KARAR[t.karar]?.semantik ?? "neutral"}>{KARAR[t.karar]?.etiket ?? t.karar}</StatusBadge>
                      </TableCell>
                      <TableCell className="text-xs">{t.durum}</TableCell>
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
