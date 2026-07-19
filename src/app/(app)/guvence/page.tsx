"use client";

// İddia Güvencesi (Model/Compliance Claim Guard, 37 Tez Dikey C). Dar kapsam
// (talimat kural 10: "UI yalnızca gerekli kapsamda değiştirilmeli"): oluştur +
// listele + dört-göz aksiyonları (incelemeye al / onayla / reddet) + çatışma
// görünürlüğü. Gösterim durumu ve VERIFIED ön-koşulu src/lib/claim-guard.ts'in
// saf fonksiyonlarından türetilir — DB guard'ıyla BİREBİR aynı mantık.
import { useCallback, useEffect, useMemo, useState } from "react";
import { StatusBadge, type SemantikDurum } from "@/components/durum/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  catismaTespitEt,
  iddiaGosterimDurumuHesapla,
  verifiedOnKosulDegerlendir,
  type DogrulamaDurumu,
  type IddiaOzet,
  type IddiaSonucu,
  type IddiaTuru,
} from "@/lib/claim-guard";
import { createClient } from "@/lib/supabase/client";

interface Iddia {
  id: string;
  iddia_turu: IddiaTuru;
  hedef_tablo: string | null;
  hedef_id: string | null;
  iddia_metni: string;
  sonuc: IddiaSonucu;
  guven_seviyesi: string;
  guven_gerekcesi: string;
  kaynak_obligation_id: string | null;
  kaynak_durumu_anlik: DogrulamaDurumu | null;
  kanit_referanslari: unknown;
  dogrulama_durumu: DogrulamaDurumu;
  incelemeye_alan: string | null;
  dogrulayan: string | null;
  yururluk_tarihi: string | null;
  yeniden_inceleme_gerekli: boolean;
}

interface Yukumluluk {
  id: string;
  kod: string;
  baslik: string;
}

const GOSTERIM_ROZET: Record<string, SemantikDurum> = {
  VERIFIED: "success",
  LEGAL_REVIEW_REQUIRED: "legal-review",
  UNVERIFIED: "warning",
  SURESI_GECMIS_INCELEME_GEREKLI: "danger",
  REDDEDILDI: "neutral",
};

function bugun(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function GuvencePage() {
  const [iddialar, setIddialar] = useState<Iddia[]>([]);
  const [yukumlulukler, setYukumlulukler] = useState<Yukumluluk[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState<string | null>(null);

  const [tur, setTur] = useState<IddiaTuru>("UYUM");
  const [metin, setMetin] = useState("");
  const [sonuc, setSonuc] = useState<IddiaSonucu>("OLUMLU");
  const [guven, setGuven] = useState("ORTA");
  const [gerekce, setGerekce] = useState("");
  const [kaynakId, setKaynakId] = useState("");
  const [kanit, setKanit] = useState("");
  const [hedefTablo, setHedefTablo] = useState("");
  const [hedefId, setHedefId] = useState("");
  const asOf = useMemo(() => bugun(), []);

  const yukle = useCallback(async () => {
    const db = createClient();
    const [{ data: is_ }, { data: obs }] = await Promise.all([
      db
        .from("assurance_claims")
        .select(
          "id, iddia_turu, hedef_tablo, hedef_id, iddia_metni, sonuc, guven_seviyesi, guven_gerekcesi, kaynak_obligation_id, kaynak_durumu_anlik, kanit_referanslari, dogrulama_durumu, incelemeye_alan, dogrulayan, yururluk_tarihi, yeniden_inceleme_gerekli",
        )
        .order("created_at", { ascending: false }),
      db.from("obligations").select("id, kod, baslik").eq("dogrulama_durumu", "VERIFIED").order("kod"),
    ]);
    setIddialar((is_ ?? []) as Iddia[]);
    setYukumlulukler((obs ?? []) as Yukumluluk[]);
    setYukleniyor(false);
  }, []);

  useEffect(() => {
    const c = async () => {
      const db = createClient();
      const {
        data: { user },
      } = await db.auth.getUser();
      setUserId(user?.id ?? null);
      await yukle();
    };
    void c();
  }, [yukle]);

  const iddiaOlustur = useCallback(async () => {
    setHata(null);
    if (!metin.trim() || !gerekce.trim()) return;
    const db = createClient();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) return;
    const { data: profil } = await db.from("profiles").select("tenant_id").eq("id", user.id).maybeSingle();
    if (!profil?.tenant_id) return setHata("Kurum bağlamı çözülemedi.");
    const kanitRef = kanit.trim() ? [{ referans: kanit.trim() }] : [];
    const { error } = await db.from("assurance_claims").insert({
      tenant_id: profil.tenant_id,
      iddia_turu: tur,
      hedef_tablo: hedefTablo.trim() || null,
      hedef_id: hedefId.trim() || null,
      iddia_metni: metin.trim(),
      sonuc,
      guven_seviyesi: guven,
      guven_gerekcesi: gerekce.trim(),
      kaynak_obligation_id: kaynakId || null,
      kanit_referanslari: kanitRef,
    });
    if (error) return setHata(error.message);
    setMetin("");
    setGerekce("");
    setKanit("");
    setHedefTablo("");
    setHedefId("");
    await yukle();
  }, [tur, metin, sonuc, guven, gerekce, kaynakId, kanit, hedefTablo, hedefId, yukle]);

  const incelemeyeAl = useCallback(
    async (id: string) => {
      setHata(null);
      if (!userId) return;
      const db = createClient();
      const { error } = await db
        .from("assurance_claims")
        .update({ dogrulama_durumu: "LEGAL_REVIEW", incelemeye_alan: userId, incelemeye_alinma_zamani: new Date().toISOString() })
        .eq("id", id);
      if (error) setHata(error.message);
      await yukle();
    },
    [userId, yukle],
  );

  const karaVer = useCallback(
    async (id: string, karar: "VERIFIED" | "REJECTED") => {
      setHata(null);
      if (!userId) return;
      const db = createClient();
      const { error } = await db
        .from("assurance_claims")
        .update({ dogrulama_durumu: karar, dogrulayan: userId, dogrulama_zamani: new Date().toISOString() })
        .eq("id", id);
      if (error) {
        setHata(
          error.message.includes("Incelemeye alan")
            ? "İncelemeye alan kişi kendi sunumunu doğrulayamaz (dört göz)."
            : error.message,
        );
        return;
      }
      await yukle();
    },
    [userId, yukle],
  );

  const catismalar = useMemo(() => {
    const ozet: IddiaOzet[] = iddialar.map((i) => ({
      id: i.id,
      hedefTablo: i.hedef_tablo,
      hedefId: i.hedef_id,
      iddiaTuru: i.iddia_turu,
      sonuc: i.sonuc,
      dogrulamaDurumu: i.dogrulama_durumu,
    }));
    return catismaTespitEt(ozet);
  }, [iddialar]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">İddia Güvencesi</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          AI veya kural motorunun ürettiği uyum/risk/kontrol/mevzuat iddiaları doğrulanmış kaynak,
          kanıt ve dört-göz onayı olmadan &quot;kesin&quot; gösterilmez. Kaynak yükümlülük VERIFIED
          değilse ya da kanıt yoksa VERIFIED&apos;e geçemez; incelemeyi alan kişi kendi sunumunu
          doğrulayamaz.
        </p>
      </div>

      {hata ? (
        <p role="alert" className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {hata}
        </p>
      ) : null}

      {catismalar.length > 0 ? (
        <Card className="border-danger/40">
          <CardHeader>
            <CardTitle className="text-danger">Çatışan iddialar ({catismalar.length})</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm">
            <p className="text-xs text-muted-foreground">
              Aynı hedef için farklı sonuç bildiren iddialar — sistem sessizce birini seçmez, karar insanda kalır.
            </p>
            {catismalar.map((c) => (
              <div key={`${c.hedefTablo}::${c.hedefId}::${c.iddiaTuru}`} className="border-t pt-1 text-xs first:border-t-0">
                {c.hedefTablo}:{c.hedefId} ({c.iddiaTuru}) — sonuçlar: {c.farkliSonuclar.join(", ")}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Yeni iddia</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="g-tur">Tür</Label>
              <select id="g-tur" value={tur} onChange={(e) => setTur(e.target.value as IddiaTuru)} className="h-9 rounded-md border bg-background px-2 text-sm">
                <option value="UYUM">Uyum</option>
                <option value="RISK">Risk</option>
                <option value="KONTROL">Kontrol</option>
                <option value="MEVZUAT">Mevzuat</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="g-sonuc">Sonuç</Label>
              <select id="g-sonuc" value={sonuc} onChange={(e) => setSonuc(e.target.value as IddiaSonucu)} className="h-9 rounded-md border bg-background px-2 text-sm">
                <option value="OLUMLU">Olumlu</option>
                <option value="OLUMSUZ">Olumsuz</option>
                <option value="KOSULLU">Koşullu</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="g-guven">Güven seviyesi</Label>
              <select id="g-guven" value={guven} onChange={(e) => setGuven(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm">
                <option value="DUSUK">Düşük</option>
                <option value="ORTA">Orta</option>
                <option value="YUKSEK">Yüksek</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="g-kaynak">Kaynak yükümlülük (opsiyonel)</Label>
              <select id="g-kaynak" value={kaynakId} onChange={(e) => setKaynakId(e.target.value)} className="h-9 w-56 rounded-md border bg-background px-2 text-sm">
                <option value="">— kaynak yok —</option>
                {yukumlulukler.map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.kod} — {y.baslik}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="g-metin">İddia metni</Label>
            <Input id="g-metin" value={metin} onChange={(e) => setMetin(e.target.value)} placeholder="Kontrol X, Yükümlülük Y'yi karşılıyor" className="w-full" />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="g-gerekce">Güven gerekçesi (zorunlu)</Label>
            <Input id="g-gerekce" value={gerekce} onChange={(e) => setGerekce(e.target.value)} placeholder="Neden bu güven seviyesi — sayısal kesinlik puanı DEĞİL" className="w-full" />
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="g-kanit">Kanıt referansı (opsiyonel)</Label>
              <Input id="g-kanit" value={kanit} onChange={(e) => setKanit(e.target.value)} placeholder="evidences:uuid" className="w-56" />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="g-hedef-tablo">Hedef tablo (opsiyonel)</Label>
              <Input id="g-hedef-tablo" value={hedefTablo} onChange={(e) => setHedefTablo(e.target.value)} placeholder="controls" className="w-36" />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="g-hedef-id">Hedef ID (opsiyonel)</Label>
              <Input id="g-hedef-id" value={hedefId} onChange={(e) => setHedefId(e.target.value)} placeholder="uuid" className="w-56" />
            </div>
            <Button size="sm" onClick={() => void iddiaOlustur()} disabled={!metin.trim() || !gerekce.trim()}>
              İddia Oluştur
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>İddialar ({iddialar.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {yukleniyor ? (
            <p className="text-sm text-muted-foreground">Yükleniyor…</p>
          ) : iddialar.length === 0 ? (
            <p className="text-sm text-muted-foreground">Henüz iddia yok.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tür</TableHead>
                    <TableHead>İddia</TableHead>
                    <TableHead>Sonuç</TableHead>
                    <TableHead>Gösterim durumu</TableHead>
                    <TableHead>Eylem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {iddialar.map((i) => {
                    const gosterim = iddiaGosterimDurumuHesapla({
                      dogrulamaDurumu: i.dogrulama_durumu,
                      yururlukTarihi: i.yururluk_tarihi,
                      yenidenIncelemeGerekli: i.yeniden_inceleme_gerekli,
                      asOf,
                    });
                    const kanitSayisi = Array.isArray(i.kanit_referanslari) ? i.kanit_referanslari.length : 0;
                    const onKosul = verifiedOnKosulDegerlendir({
                      kaynakVarMi: i.kaynak_obligation_id !== null,
                      kaynakDurumu: i.kaynak_durumu_anlik,
                      kanitSayisi,
                    });
                    const kendiIncelemesi = i.incelemeye_alan !== null && i.incelemeye_alan === userId;
                    return (
                      <TableRow key={i.id}>
                        <TableCell className="text-xs">{i.iddia_turu}</TableCell>
                        <TableCell className="max-w-xs text-sm">
                          <div>{i.iddia_metni}</div>
                          {i.yeniden_inceleme_gerekli ? (
                            <span className="text-xs text-danger">Süre dolumu — yeniden inceleme gerekli</span>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-xs">{i.sonuc}</TableCell>
                        <TableCell>
                          <StatusBadge durum={GOSTERIM_ROZET[gosterim.gosterimDurumu] ?? "neutral"}>{gosterim.gosterimDurumu}</StatusBadge>
                        </TableCell>
                        <TableCell>
                          {i.dogrulama_durumu === "DRAFT_RESEARCH" || i.dogrulama_durumu === "TODO_DOGRULA" ? (
                            <Button size="sm" variant="outline" onClick={() => void incelemeyeAl(i.id)}>
                              İncelemeye Al
                            </Button>
                          ) : i.dogrulama_durumu === "LEGAL_REVIEW" ? (
                            <div className="flex flex-col gap-1">
                              <div className="flex gap-1">
                                <Button size="sm" onClick={() => void karaVer(i.id, "VERIFIED")} disabled={kendiIncelemesi || !onKosul.uygun}>
                                  Doğrula
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => void karaVer(i.id, "REJECTED")} disabled={kendiIncelemesi}>
                                  Reddet
                                </Button>
                              </div>
                              {kendiIncelemesi ? (
                                <span className="text-xs text-warning">İncelemeyi siz aldınız — başka biri doğrulamalı (dört göz).</span>
                              ) : !onKosul.uygun ? (
                                <span className="text-xs text-muted-foreground">{onKosul.eksikSebepler[0]?.mesaj}</span>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">Karara bağlandı</span>
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
