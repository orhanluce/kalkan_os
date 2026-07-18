"use client";

// PrivacyOps hub (M36, G6): ROPA + DSAR (kimlik doğrulama + süre saati) +
// ihlal (otorite bildirim saati). Süre saatleri istemcide türetilir (kural 11
// saf yardımcı); kimlik-doğrulama şartı DB guard'ında.
import { useCallback, useEffect, useMemo, useState } from "react";
import { StatusBadge, type SemantikDurum } from "@/components/durum/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { sha256Hex } from "@/lib/evidence";
import { dsarSonTarih, ihlalBildirimSaati, maskele } from "@/lib/gizlilik";
import { createClient } from "@/lib/supabase/client";

interface Ropa {
  id: string;
  ad: string;
  amac: string;
  hukuki_dayanak: string;
  durum: string;
}
interface Dsar {
  id: string;
  tur: string;
  veri_sahibi_maskeli: string;
  kimlik_dogrulandi: boolean;
  durum: string;
  alindi_at: string;
  yasal_sure_gun: number;
}
interface Ihlal {
  id: string;
  ozet: string;
  tespit_at: string;
  siniflandirma: string;
  otorite_bildirildi_at: string | null;
  durum: string;
}

const DSAR_DURUM: Record<string, SemantikDurum> = {
  ALINDI: "info",
  KIMLIK_BEKLIYOR: "warning",
  ISLENIYOR: "legal-review",
  TAMAMLANDI: "success",
  REDDEDILDI: "danger",
};

export default function GizlilikPage() {
  const [ropalar, setRopalar] = useState<Ropa[]>([]);
  const [dsarlar, setDsarlar] = useState<Dsar[]>([]);
  const [ihlaller, setIhlaller] = useState<Ihlal[]>([]);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [hata, setHata] = useState<string | null>(null);

  const [rAd, setRAd] = useState("");
  const [rAmac, setRAmac] = useState("");
  const [rDayanak, setRDayanak] = useState("HUKUKI_YUKUMLULUK");
  const [dTur, setDTur] = useState("ERISIM");
  const [dKimlik, setDKimlik] = useState("");
  const [iOzet, setIOzet] = useState("");

  const simdi = useMemo(() => new Date(), []);

  // tenant_id'yi state yarışına bırakmadan çöz (ilk yüklemede henüz null olabilir).
  const tenantCoz = useCallback(async (): Promise<string | null> => {
    if (tenantId) return tenantId;
    const db = createClient();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) return null;
    const { data: p } = await db.from("profiles").select("tenant_id").eq("id", user.id).maybeSingle();
    return p?.tenant_id ?? null;
  }, [tenantId]);

  const yukle = useCallback(async () => {
    const db = createClient();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (user) {
      const { data: p } = await db.from("profiles").select("tenant_id").eq("id", user.id).maybeSingle();
      setTenantId(p?.tenant_id ?? null);
    }
    const [{ data: rs }, { data: ds }, { data: is }] = await Promise.all([
      db.from("processing_activities").select("id, ad, amac, hukuki_dayanak, durum").order("ad"),
      db.from("data_subject_requests").select("id, tur, veri_sahibi_maskeli, kimlik_dogrulandi, durum, alindi_at, yasal_sure_gun").order("alindi_at", { ascending: false }),
      db.from("privacy_incidents").select("id, ozet, tespit_at, siniflandirma, otorite_bildirildi_at, durum").order("tespit_at", { ascending: false }),
    ]);
    setRopalar((rs ?? []) as Ropa[]);
    setDsarlar((ds ?? []) as Dsar[]);
    setIhlaller((is ?? []) as Ihlal[]);
  }, []);

  useEffect(() => {
    const c = async () => {
      await yukle();
    };
    void c();
  }, [yukle]);

  const ropaEkle = useCallback(async () => {
    setHata(null);
    if (!rAd.trim() || !rAmac.trim()) return;
    const tid = await tenantCoz();
    if (!tid) {
      setHata("Kurum bağlamı çözülemedi.");
      return;
    }
    const db = createClient();
    const { error } = await db.from("processing_activities").insert({ tenant_id: tid, ad: rAd.trim(), amac: rAmac.trim(), hukuki_dayanak: rDayanak });
    if (error) {
      setHata(error.message);
      return;
    }
    setRAd("");
    setRAmac("");
    await yukle();
  }, [rAd, rAmac, rDayanak, tenantCoz, yukle]);

  const dsarEkle = useCallback(async () => {
    setHata(null);
    if (!dKimlik.trim()) return;
    const tid = await tenantCoz();
    if (!tid) {
      setHata("Kurum bağlamı çözülemedi.");
      return;
    }
    const db = createClient();
    // Veri minimizasyonu: TAM kimlik SAKLANMAZ — maskeli + hash.
    const hash = await sha256Hex(new TextEncoder().encode(dKimlik.trim().toLowerCase()).buffer as ArrayBuffer);
    const { error } = await db.from("data_subject_requests").insert({
      tenant_id: tid,
      tur: dTur,
      veri_sahibi_maskeli: maskele(dKimlik.trim()),
      veri_sahibi_hash: hash,
    });
    if (error) {
      setHata(error.message);
      return;
    }
    setDKimlik("");
    await yukle();
  }, [dKimlik, dTur, tenantCoz, yukle]);

  const dsarGuncelle = useCallback(
    async (id: string, alan: Partial<Dsar> & { durum?: string }) => {
      setHata(null);
      const db = createClient();
      const { error } = await db.from("data_subject_requests").update(alan).eq("id", id);
      if (error) setHata(error.message.includes("kimlik dogrulama") ? "Kimlik doğrulanmadan tamamlanamaz." : error.message);
      await yukle();
    },
    [yukle],
  );

  const ihlalEkle = useCallback(async () => {
    setHata(null);
    if (!iOzet.trim()) return;
    const tid = await tenantCoz();
    if (!tid) {
      setHata("Kurum bağlamı çözülemedi.");
      return;
    }
    const db = createClient();
    const { error } = await db.from("privacy_incidents").insert({ tenant_id: tid, ozet: iOzet.trim(), tespit_at: new Date().toISOString(), siniflandirma: "YUKSEK" });
    if (error) {
      setHata(error.message);
      return;
    }
    setIOzet("");
    await yukle();
  }, [iOzet, tenantCoz, yukle]);

  const ihlalBildir = useCallback(
    async (id: string) => {
      setHata(null);
      const db = createClient();
      const { error } = await db.from("privacy_incidents").update({ otorite_bildirildi_at: new Date().toISOString(), durum: "BILDIRILDI" }).eq("id", id);
      if (error) setHata(error.message);
      await yukle();
    },
    [yukle],
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">KVKK / Gizlilik</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          İşleme envanteri (ROPA), veri sahibi başvuruları (DSAR — kimlik doğrulanmadan tamamlanamaz)
          ve ihlal yönetimi (otorite bildirim saati). Veri sahibi kimliği maskelenir ve hash&apos;lenir
          (tam kimlik saklanmaz).
        </p>
      </div>

      {hata ? (
        <p role="alert" className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {hata}
        </p>
      ) : null}

      {/* ROPA */}
      <Card>
        <CardHeader>
          <CardTitle>İşleme faaliyetleri — ROPA ({ropalar.length})</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="r-ad">Ad</Label>
              <Input id="r-ad" value={rAd} onChange={(e) => setRAd(e.target.value)} className="w-48" />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="r-amac">Amaç</Label>
              <Input id="r-amac" value={rAmac} onChange={(e) => setRAmac(e.target.value)} className="w-56" />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="r-dayanak">Hukuki dayanak</Label>
              <select id="r-dayanak" value={rDayanak} onChange={(e) => setRDayanak(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm">
                <option value="RIZA">Rıza</option>
                <option value="SOZLESME">Sözleşme</option>
                <option value="HUKUKI_YUKUMLULUK">Hukuki yükümlülük</option>
                <option value="MESRU_MENFAAT">Meşru menfaat</option>
                <option value="KAMU_GOREVI">Kamu görevi</option>
                <option value="HAYATI_MENFAAT">Hayati menfaat</option>
              </select>
            </div>
            <Button size="sm" onClick={() => void ropaEkle()} disabled={!rAd.trim() || !rAmac.trim()}>
              ROPA Ekle
            </Button>
          </div>
          {ropalar.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ad</TableHead>
                    <TableHead>Amaç</TableHead>
                    <TableHead>Dayanak</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ropalar.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.ad}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.amac}</TableCell>
                      <TableCell className="text-xs">{r.hukuki_dayanak}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* DSAR */}
      <Card>
        <CardHeader>
          <CardTitle>Veri sahibi başvuruları — DSAR ({dsarlar.length})</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="d-tur">Tür</Label>
              <select id="d-tur" value={dTur} onChange={(e) => setDTur(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm">
                <option value="ERISIM">Erişim</option>
                <option value="SILME">Silme</option>
                <option value="DUZELTME">Düzeltme</option>
                <option value="ITIRAZ">İtiraz</option>
                <option value="TASIMA">Taşıma</option>
                <option value="KISITLAMA">Kısıtlama</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="d-kimlik">Veri sahibi (e-posta/kimlik)</Label>
              <Input id="d-kimlik" value={dKimlik} onChange={(e) => setDKimlik(e.target.value)} placeholder="ayse@example.com" className="w-64" />
            </div>
            <Button size="sm" onClick={() => void dsarEkle()} disabled={!dKimlik.trim()}>
              DSAR Aç
            </Button>
          </div>
          {dsarlar.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tür</TableHead>
                    <TableHead>Veri sahibi</TableHead>
                    <TableHead>Süre</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead>Eylem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dsarlar.map((d) => {
                    const saat = dsarSonTarih(d.alindi_at, d.yasal_sure_gun, simdi);
                    return (
                      <TableRow key={d.id}>
                        <TableCell className="text-xs">{d.tur}</TableCell>
                        <TableCell className="text-xs">{d.veri_sahibi_maskeli}</TableCell>
                        <TableCell>
                          <StatusBadge durum={saat.gecikti ? "danger" : saat.kalanSaat < 7 * 24 ? "warning" : "success"}>
                            {saat.mesaj}
                          </StatusBadge>
                        </TableCell>
                        <TableCell>
                          <StatusBadge durum={DSAR_DURUM[d.durum] ?? "neutral"}>
                            {d.kimlik_dogrulandi ? "✓ " : ""}
                            {d.durum}
                          </StatusBadge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {!d.kimlik_dogrulandi ? (
                              <Button size="sm" variant="outline" onClick={() => void dsarGuncelle(d.id, { kimlik_dogrulandi: true, durum: "ISLENIYOR" })}>
                                Kimlik Doğrula
                              </Button>
                            ) : null}
                            {d.durum !== "TAMAMLANDI" && d.durum !== "REDDEDILDI" ? (
                              <Button size="sm" onClick={() => void dsarGuncelle(d.id, { durum: "TAMAMLANDI" })}>
                                Tamamla
                              </Button>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* İhlaller */}
      <Card>
        <CardHeader>
          <CardTitle>İhlaller ({ihlaller.length})</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="i-ozet">Özet</Label>
              <Input id="i-ozet" value={iOzet} onChange={(e) => setIOzet(e.target.value)} className="w-72" />
            </div>
            <Button size="sm" onClick={() => void ihlalEkle()} disabled={!iOzet.trim()}>
              İhlal Kaydet
            </Button>
          </div>
          {ihlaller.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Özet</TableHead>
                    <TableHead>Otorite bildirim saati</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead>Eylem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ihlaller.map((i) => {
                    const saat = ihlalBildirimSaati(i.tespit_at, simdi, i.otorite_bildirildi_at);
                    return (
                      <TableRow key={i.id}>
                        <TableCell className="text-sm">{i.ozet}</TableCell>
                        <TableCell>
                          <StatusBadge durum={saat.gecikti ? "danger" : "warning"}>{saat.mesaj}</StatusBadge>
                        </TableCell>
                        <TableCell className="text-xs">{i.durum}</TableCell>
                        <TableCell>
                          {!i.otorite_bildirildi_at ? (
                            <Button size="sm" variant="outline" onClick={() => void ihlalBildir(i.id)}>
                              Otoriteye Bildirildi
                            </Button>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
