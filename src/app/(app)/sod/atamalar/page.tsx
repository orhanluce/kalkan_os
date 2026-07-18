"use client";

// SoD atama yönetimi — DAR sürüm (docs/ROADMAP.md M16 #6): liste + filtre.
//
// BİLİNÇLİ SALT-OKUR: atamalar bu ekrandan ELLE girilmez/düzenlenmez — giriş
// yolu CSV import'tur (dry-run + apply + rollback + manifest izi ile) ya da
// ileride IAM/PAM connector. Elle düzenleme yolu açmak, import'un bütünlük
// zincirini (manifest/ters-set) baypas ederdi. Sona erdirme de import
// (SNAPSHOT modu) üzerinden yapılır.
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { StatusBadge } from "@/components/durum/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useLocalStore } from "@/lib/store";
import { createClient } from "@/lib/supabase/client";

interface AtamaSatiri {
  id: string;
  kullanici_id: string | null;
  harici_kullanici_id: string | null;
  aktivite_kodu: string;
  rol_kodu: string | null;
  sistem_kapsami: string;
  kaynak_sistem: string;
  source_record_id: string | null;
  gecerlilik_baslangic: string;
  gecerlilik_bitis: string | null;
  display_name: string | null;
}

const TUMU = "TUMU";

const DURUM_FILTRE_LABEL: Record<string, string> = {
  [TUMU]: "Tümü",
  AKTIF: "Aktif",
  SONA_ERMIS: "Sona ermiş",
};

/** Sunucu tarafında sınır: dar sürümde sayfalama yok, sınır DÜRÜSTÇE görünür. */
const LISTE_SINIRI = 500;

export default function SodAtamalarPage() {
  const { kurum } = useLocalStore();
  const [atamalar, setAtamalar] = useState<AtamaSatiri[]>([]);
  const [toplam, setToplam] = useState(0);
  const [yukleniyor, setYukleniyor] = useState(true);

  const [kaynakFiltre, setKaynakFiltre] = useState(TUMU);
  const [durumFiltre, setDurumFiltre] = useState(TUMU);
  const [arama, setArama] = useState("");

  const yukle = useCallback(async () => {
    const db = createClient();
    const { data, count } = await db
      .from("sod_atamalari")
      .select(
        "id, kullanici_id, harici_kullanici_id, aktivite_kodu, rol_kodu, sistem_kapsami, kaynak_sistem, source_record_id, gecerlilik_baslangic, gecerlilik_bitis, display_name",
        { count: "exact" },
      )
      .order("gecerlilik_baslangic", { ascending: false })
      .limit(LISTE_SINIRI);
    setAtamalar(data ?? []);
    setToplam(count ?? 0);
    setYukleniyor(false);
  }, []);

  useEffect(() => {
    const calistir = async () => {
      await yukle();
    };
    void calistir();
  }, [yukle]);

  const profilAdlari = useMemo(
    () => new Map(kurum.profiller.map((p) => [p.id, p.fullName])),
    [kurum.profiller],
  );

  const kaynaklar = useMemo(
    () => [...new Set(atamalar.map((a) => a.kaynak_sistem))].sort(),
    [atamalar],
  );
  const kaynakItems = useMemo<Record<string, string>>(
    () => ({ [TUMU]: "Tümü", ...Object.fromEntries(kaynaklar.map((k) => [k, k])) }),
    [kaynaklar],
  );

  const simdi = useMemo(() => new Date(), []);
  const aktifMi = useCallback(
    (a: AtamaSatiri) => a.gecerlilik_bitis === null || new Date(a.gecerlilik_bitis) >= simdi,
    [simdi],
  );

  const kisiEtiketi = useCallback(
    (a: AtamaSatiri) =>
      a.kullanici_id
        ? (profilAdlari.get(a.kullanici_id) ?? a.kullanici_id)
        : (a.display_name ?? a.harici_kullanici_id ?? "—"),
    [profilAdlari],
  );

  const gorunen = atamalar.filter((a) => {
    if (kaynakFiltre !== TUMU && a.kaynak_sistem !== kaynakFiltre) return false;
    if (durumFiltre === "AKTIF" && !aktifMi(a)) return false;
    if (durumFiltre === "SONA_ERMIS" && aktifMi(a)) return false;
    if (arama.trim()) {
      const hedef =
        `${kisiEtiketi(a)} ${a.harici_kullanici_id ?? ""} ${a.aktivite_kodu} ${a.rol_kodu ?? ""} ${a.sistem_kapsami}`.toLowerCase();
      if (!hedef.includes(arama.trim().toLowerCase())) return false;
    }
    return true;
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/sod" className="text-sm text-muted-foreground hover:underline">
            ← Görevler Ayrılığı
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Atamalar</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Salt-okur liste: atamalar CSV içe aktarma (dry-run + manifest izi) ile girer/sona erer —
            elle düzenleme yolu bilinçli olarak yok (bütünlük zinciri baypas edilemez).
          </p>
        </div>
        <Link href="/sod/import" className={buttonVariants({ variant: "outline" })}>
          CSV İçe Aktar
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            Atama Listesi ({gorunen.length}
            {toplam > LISTE_SINIRI ? ` / ilk ${LISTE_SINIRI} kayıt — toplam ${toplam}` : ""})
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="kaynak-filtre">Kaynak</Label>
              <Select items={kaynakItems} value={kaynakFiltre} onValueChange={(v) => setKaynakFiltre(v as string)}>
                <SelectTrigger id="kaynak-filtre">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.keys(kaynakItems).map((k) => (
                    <SelectItem key={k} value={k}>
                      {kaynakItems[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="durum-filtre">Geçerlilik</Label>
              <Select
                items={DURUM_FILTRE_LABEL}
                value={durumFiltre}
                onValueChange={(v) => setDurumFiltre(v as string)}
              >
                <SelectTrigger id="durum-filtre">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.keys(DURUM_FILTRE_LABEL).map((d) => (
                    <SelectItem key={d} value={d}>
                      {DURUM_FILTRE_LABEL[d]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="arama">Ara (kişi / aktivite / rol / kapsam)</Label>
              <Input id="arama" value={arama} onChange={(e) => setArama(e.target.value)} placeholder="ör. KANIT_YUKLE" />
            </div>
          </div>

          {yukleniyor ? (
            <p className="text-sm text-muted-foreground">Yükleniyor…</p>
          ) : gorunen.length === 0 ? (
            <p className="text-sm text-muted-foreground">Filtreyle eşleşen atama yok.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kişi</TableHead>
                    <TableHead>Aktivite</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Kapsam</TableHead>
                    <TableHead>Kaynak</TableHead>
                    <TableHead>Geçerlilik</TableHead>
                    <TableHead>Durum</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gorunen.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>
                        {kisiEtiketi(a)}
                        {a.harici_kullanici_id && (
                          <span className="block text-xs text-muted-foreground">{a.harici_kullanici_id}</span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{a.aktivite_kodu}</TableCell>
                      <TableCell className="font-mono text-xs">{a.rol_kodu ?? "—"}</TableCell>
                      <TableCell className="text-xs">{a.sistem_kapsami}</TableCell>
                      <TableCell className="text-xs">
                        {a.kaynak_sistem}
                        {a.source_record_id && (
                          <span className="block text-muted-foreground">{a.source_record_id}</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs tabular-nums">
                        {a.gecerlilik_baslangic} → {a.gecerlilik_bitis ?? "süresiz"}
                      </TableCell>
                      <TableCell>
                        {aktifMi(a) ? (
                          <StatusBadge durum="success">Aktif</StatusBadge>
                        ) : (
                          <StatusBadge durum="neutral">Sona ermiş</StatusBadge>
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
