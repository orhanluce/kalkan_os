"use client";

// Uygulanabilirlik değerlendirmesi (QRegu PR-Q2b', M22; master §9.7).
//
// DÜRÜSTLÜK KURALLARI (DB guard'larıyla birebir):
//   * Kritik profil olgusu EKSİKSE tek seçilebilir sonuç UNKNOWN'dur —
//     "değerlendiremiyoruz" der, kullanıcıyı /kurulum'a yönlendirir; yeşil
//     GÖSTERMEZ (master §9.7: Unknown eksik veriyi tamamlamaya yönlendirir).
//   * NOT_APPLICABLE bir İDDİADIR: gerekçe + oturum sahibinin onayı olmadan
//     kaydedilemez (UNKNOWN ≠ NOT_APPLICABLE, DB invariant'ı).
//   * Yeniden değerlendirme eski kararı DÜZENLEMEZ: supersede + yeni satır
//     (append-only karar zinciri).
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { StatusBadge, type SemantikDurum } from "@/components/durum/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  APPLICABILITY_DURUM_LABEL,
  applicabilityFactSnapshot,
  eksikProfilAlanlari,
  factSnapshotFingerprint,
  type ApplicabilityDurum,
  type ApplicabilityFactSnapshot,
} from "@/lib/applicability";
import { createClient } from "@/lib/supabase/client";

interface Yukumluluk {
  id: string;
  kod: string;
  baslik: string;
  dogrulama_durumu: string;
  provision_ref: string;
}

interface GuncelKarar {
  id: string;
  obligation_id: string;
  durum: ApplicabilityDurum;
}

const KARAR_SEMANTIK: Record<ApplicabilityDurum, SemantikDurum> = {
  APPLICABLE: "info",
  NOT_APPLICABLE: "neutral",
  CONDITIONAL: "warning",
  UNKNOWN: "unknown",
};

const DURUM_SECENEKLERI: ApplicabilityDurum[] = ["APPLICABLE", "CONDITIONAL", "NOT_APPLICABLE", "UNKNOWN"];

export default function UygulanabilirlikPage() {
  const [yukumlulukler, setYukumlulukler] = useState<Yukumluluk[]>([]);
  const [kararlar, setKararlar] = useState<GuncelKarar[]>([]);
  const [snapshot, setSnapshot] = useState<ApplicabilityFactSnapshot | null>(null);
  const [profilVar, setProfilVar] = useState(false);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState<string | null>(null);
  // Aktif değerlendirme formu (tek satır açık).
  const [aktif, setAktif] = useState<string | null>(null);
  const [secim, setSecim] = useState<ApplicabilityDurum>("UNKNOWN");
  const [gerekce, setGerekce] = useState("");
  const [kosul, setKosul] = useState("");

  const yukle = useCallback(async () => {
    const db = createClient();
    const [{ data: obls }, { data: cars }, { data: profil }] = await Promise.all([
      db
        .from("obligations")
        .select("id, kod, baslik, dogrulama_durumu, provisions!inner (provision_ref)")
        .order("created_at", { ascending: false }),
      db.from("applicability_decisions").select("id, obligation_id, durum").is("superseded_at", null),
      db
        .from("organization_profiles")
        .select(
          "organization_type, regulated_status, regulator_types, jurisdictions, operating_sectors, finance_department_enabled, employee_band, legal_entity_count",
        )
        .maybeSingle(),
    ]);
    setYukumlulukler(
      ((obls ?? []) as unknown as (Omit<Yukumluluk, "provision_ref"> & { provisions: { provision_ref: string } })[]).map(
        (o) => ({ ...o, provision_ref: o.provisions.provision_ref }),
      ),
    );
    setKararlar((cars ?? []) as GuncelKarar[]);
    setProfilVar(!!profil);
    setSnapshot(profil ? applicabilityFactSnapshot(profil) : null);
    setYukleniyor(false);
  }, []);

  useEffect(() => {
    const c = async () => {
      await yukle();
    };
    void c();
  }, [yukle]);

  const eksikler = snapshot ? eksikProfilAlanlari(snapshot) : ["profil"];
  const yalnizUnknown = !profilVar || eksikler.length > 0;

  const kaydet = useCallback(
    async (yukumluluk: Yukumluluk) => {
      setHata(null);
      if (!snapshot) return;
      const db = createClient();
      const {
        data: { user },
      } = await db.auth.getUser();
      if (!user) return;

      // Append-only zincir: mevcut güncel karar önce kapatılır.
      const mevcut = kararlar.find((k) => k.obligation_id === yukumluluk.id);
      if (mevcut) {
        const { error: supErr } = await db
          .from("applicability_decisions")
          .update({ superseded_at: new Date().toISOString() })
          .eq("id", mevcut.id);
        if (supErr) {
          setHata(supErr.message);
          return;
        }
      }

      const { error } = await db.from("applicability_decisions").insert({
        tenant_id: (await db.from("profiles").select("tenant_id").eq("id", user.id).single()).data!.tenant_id,
        obligation_id: yukumluluk.id,
        durum: secim,
        fact_snapshot: JSON.parse(JSON.stringify(snapshot)),
        fact_snapshot_fingerprint: await factSnapshotFingerprint(snapshot),
        gerekce: gerekce || null,
        kosul: secim === "CONDITIONAL" ? kosul || null : null,
        karar_kaynagi: "manuel",
        // Kimlik atfı: onay yalnız oturum sahibi adına (DB guard'ı da zorlar).
        onaylayan: secim === "UNKNOWN" ? null : user.id,
        onay_zamani: secim === "UNKNOWN" ? null : new Date().toISOString(),
      });
      if (error) {
        setHata(error.message);
        return;
      }
      setAktif(null);
      setGerekce("");
      setKosul("");
      setSecim("UNKNOWN");
      await yukle();
    },
    [snapshot, kararlar, secim, gerekce, kosul, yukle],
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Uygulanabilirlik</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Hangi yükümlülük bu kuruma uygulanır? Karar, kurum profili olgularının kopyası ve parmak
          iziyle mühürlenir; yeniden değerlendirme eski kararı silmez, yenisini açar.
        </p>
      </div>

      {yalnizUnknown ? (
        <p className="max-w-2xl rounded-md border border-unknown/40 bg-unknown/10 px-3 py-2 text-sm">
          Kritik profil olguları eksik{snapshot ? ` (${eksikler.join(", ")})` : ""} — bu durumda tek
          dürüst sonuç <strong>Değerlendirilemiyor</strong>tur; &quot;uygulanmaz&quot; sayılmaz.{" "}
          <Link href="/kurulum" className="text-primary underline">
            Kurum profilini tamamla
          </Link>
        </p>
      ) : null}

      {hata ? (
        <p role="alert" className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {hata}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Yükümlülükler ({yukumlulukler.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {yukleniyor ? (
            <p className="text-sm text-muted-foreground">Yükleniyor…</p>
          ) : yukumlulukler.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Henüz yükümlülük kaydı yok — içerik küratör aracıyla eklenir (kural 3: uydurulmaz).
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Yükümlülük</TableHead>
                    <TableHead>Hüküm</TableHead>
                    <TableHead>Karar</TableHead>
                    <TableHead>Eylem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {yukumlulukler.map((y) => {
                    const karar = kararlar.find((k) => k.obligation_id === y.id);
                    return (
                      <TableRow key={y.id}>
                        <TableCell>
                          {y.kod} — {y.baslik}
                        </TableCell>
                        <TableCell className="text-xs">{y.provision_ref}</TableCell>
                        <TableCell>
                          {karar ? (
                            <StatusBadge durum={KARAR_SEMANTIK[karar.durum]}>
                              {APPLICABILITY_DURUM_LABEL[karar.durum]}
                            </StatusBadge>
                          ) : (
                            <span className="text-xs text-muted-foreground">Karar yok</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {aktif === y.id ? (
                            <div className="flex max-w-md flex-col gap-2 py-1">
                              <div className="flex flex-wrap gap-1" role="group" aria-label="Karar seçimi">
                                {DURUM_SECENEKLERI.map((d) => (
                                  <Button
                                    key={d}
                                    size="sm"
                                    variant={secim === d ? "default" : "outline"}
                                    disabled={yalnizUnknown && d !== "UNKNOWN"}
                                    onClick={() => setSecim(d)}
                                  >
                                    {APPLICABILITY_DURUM_LABEL[d]}
                                  </Button>
                                ))}
                              </div>
                              {secim !== "UNKNOWN" ? (
                                <div className="flex flex-col gap-1">
                                  <Label htmlFor={`gerekce-${y.id}`}>Gerekçe (zorunlu)</Label>
                                  <Textarea
                                    id={`gerekce-${y.id}`}
                                    value={gerekce}
                                    onChange={(e) => setGerekce(e.target.value)}
                                    rows={2}
                                  />
                                </div>
                              ) : null}
                              {secim === "CONDITIONAL" ? (
                                <div className="flex flex-col gap-1">
                                  <Label htmlFor={`kosul-${y.id}`}>Şart (zorunlu)</Label>
                                  <Textarea
                                    id={`kosul-${y.id}`}
                                    value={kosul}
                                    onChange={(e) => setKosul(e.target.value)}
                                    rows={2}
                                  />
                                </div>
                              ) : null}
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  disabled={
                                    (secim !== "UNKNOWN" && gerekce.trim() === "") ||
                                    (secim === "CONDITIONAL" && kosul.trim() === "")
                                  }
                                  onClick={() => void kaydet(y)}
                                >
                                  Kaydet
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => setAktif(null)}>
                                  Vazgeç
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => setAktif(y.id)}>
                              Değerlendir
                            </Button>
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
    </div>
  );
}
