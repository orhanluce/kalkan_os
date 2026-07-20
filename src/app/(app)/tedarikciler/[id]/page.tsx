"use client";

// Tedarikçi detayı (M35, G4): karar (insan) + hizmet + dördüncü taraf +
// sözleşme + çıkış planı + DORA RoI iskele indirme. İnvariant'lar DB'de:
// insan-karar, bilinmeyen dördüncü taraf, tested-exit kanıt şartı, süresiz
// sözleşme yasağı.
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { StatusBadge } from "@/components/durum/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { disErisimTokenUret } from "@/lib/dis-erisim-token";
import {
  CLOUD_PACK_KATEGORILERI,
  GUVENCE_ENGEL_ACIKLAMALARI,
  KAYNAK_TURLERI,
  KAYNAK_TURU_TR_ETIKET,
  type GuvenceProfiliSonucu,
  type KaynakTuru,
} from "@/lib/cloud-assurance";
import { bulguOzeti, roiKaydiUret, sozlesmeYakinligi, type Bulgu } from "@/lib/tedarikci";
import { createClient } from "@/lib/supabase/client";
import { BULUT_KATEGORI, KARAR, TIER } from "../page";

const GENEL_DURUM_ETIKET: Record<string, { etiket: string; semantik: "success" | "warning" | "danger" | "unknown" }> = {
  DOGRULANMIS_PROFIL: { etiket: "Doğrulanmış profil", semantik: "success" },
  INCELEME_GEREKLI: { etiket: "İnceleme gerekli", semantik: "warning" },
  EKSIK: { etiket: "Eksik — henüz değerlendirilemiyor", semantik: "unknown" },
  ENGELLENDI: { etiket: "Kritik bulgu nedeniyle engellendi", semantik: "danger" },
  // Dikey E, E2, Kapı 2: bulgu AÇIK kalır — bu asla "çözüldü"/"uygun" anlamına
  // gelmez, yalnız doğrulanmış telafi edici kontrolle YÖNETİLDİĞİNİ bildirir.
  KRITIK_BULGU_TELAFI_ALTINDA: { etiket: "Kritik bulgu açık — telafi edici kontrol altında", semantik: "warning" },
};

interface Tedarikci {
  ad: string;
  ulke: string | null;
  tier: string;
  karar: string;
  dis_rating: string | null;
  dis_rating_kaynagi: string | null;
}
interface Hizmet {
  id: string;
  hizmet_adi: string;
  kritik: boolean;
  veri_siniflari: string[];
}
interface Dorduncu {
  id: string;
  ad: string | null;
  bilinmiyor: boolean;
  ulke: string | null;
}
interface Sozlesme {
  id: string;
  sozlesme_ref: string;
  baslangic: string;
  bitis: string;
  denetim_hakki: boolean;
  cikis_maddesi: boolean;
  durum: string;
}
interface CikisPlani {
  id: string;
  ozet: string;
  test_edildi: boolean;
  test_tarihi: string | null;
  test_kaniti: string | null;
}

interface Degerlendirme {
  id: string;
  tur: string;
  durum: string;
  tamamlandi_at: string | null;
}
interface BulguRow {
  id: string;
  assessment_id: string;
  baslik: string;
  ciddiyet: string;
  durum: string;
  sahibi: string | null;
}
interface ProfilRow {
  id: string;
  full_name: string | null;
}
interface SoruRow {
  id: string;
  assessment_id: string;
  soru: string;
}
interface RevizyonRow {
  id: string;
  assessment_id: string;
  surum: number;
  durum: string;
  gonderen_email: string | null;
  gonderildi_at: string | null;
  inceleme_gerekcesi: string | null;
  inceleme_zamani: string | null;
}
interface RevizyonCevapRow {
  revizyon_id: string;
  question_id: string;
  cevap: string | null;
  kanit_metni: string | null;
}
interface BulutSoruRow {
  id: string;
  assessment_id: string;
  soru: string;
  cevap: string | null;
  uygulanabilirlik: string;
  kaynak_turu: string;
  kaynak_citation: string | null;
  template_id: string | null;
  assessment_question_templates: { kategori: string | null; dogrulama_durumu: string; dogrulayan: string | null; dogrulama_zamani: string | null } | null;
}

// Dikey E, E2, Kapı 2: telafi edici kontrol — bulguyu KAPATMAZ, yalnız
// yönetim durumunu bildirir (ADR §4-5).
interface TelafiRow {
  id: string;
  durum: string;
  controlId: string;
  controlMaddeRef: string | null;
  testRunId: string;
  testSonucu: string | null;
  gerekce: string;
  validFrom: string;
  validUntil: string;
  submittedBy: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  redGerekcesi: string | null;
  revokedBy: string | null;
  revokedAt: string | null;
  revocationReason: string | null;
  oncekiId: string | null;
  createdAt: string;
}
interface UygunTestKosu {
  id: string;
  controlId: string;
  controlMaddeRef: string | null;
  calistiAt: string;
  kanitVarMi: boolean;
  kanitGuncel: boolean;
}
const TELAFI_DURUM_ETIKET: Record<string, { etiket: string; semantik: "success" | "warning" | "danger" | "neutral" }> = {
  TASLAK: { etiket: "Taslak", semantik: "neutral" },
  INCELEMEDE: { etiket: "İncelemede", semantik: "warning" },
  AKTIF: { etiket: "Telafi ile yönetiliyor (bulgu AÇIK)", semantik: "warning" },
  REDDEDILDI: { etiket: "Reddedildi", semantik: "danger" },
  SURESI_DOLDU: { etiket: "Süresi doldu", semantik: "danger" },
  IPTAL_EDILDI: { etiket: "İptal edildi", semantik: "neutral" },
};

export default function TedarikciDetayPage() {
  const params = useParams<{ id: string }>();
  const [t, setT] = useState<Tedarikci | null>(null);
  const [hizmetler, setHizmetler] = useState<Hizmet[]>([]);
  const [dorduncular, setDorduncular] = useState<Dorduncu[]>([]);
  const [sozlesmeler, setSozlesmeler] = useState<Sozlesme[]>([]);
  const [cikis, setCikis] = useState<CikisPlani[]>([]);
  const [degerlendirmeler, setDegerlendirmeler] = useState<Degerlendirme[]>([]);
  const [bulgular, setBulgular] = useState<BulguRow[]>([]);
  const [sorular, setSorular] = useState<SoruRow[]>([]);
  const [sonRevizyon, setSonRevizyon] = useState<Record<string, RevizyonRow>>({});
  const [revizyonCevaplari, setRevizyonCevaplari] = useState<Record<string, RevizyonCevapRow[]>>({});
  const [incelemeGerekce, setIncelemeGerekce] = useState<Record<string, string>>({});
  const [ledgerDurum, setLedgerDurum] = useState<Record<string, string>>({});
  const [bBaslik, setBBaslik] = useState<Record<string, string>>({});
  const [bCiddiyet, setBCiddiyet] = useState<Record<string, string>>({});
  const [bSahibi, setBSahibi] = useState<Record<string, string>>({});
  const [bKanit, setBKanit] = useState<Record<string, string>>({});
  const [profiller, setProfiller] = useState<ProfilRow[]>([]);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [kullaniciId, setKullaniciId] = useState<string | null>(null);
  const [hata, setHata] = useState<string | null>(null);

  // Form state
  const [hizmetAd, setHizmetAd] = useState("");
  const [hizmetKritik, setHizmetKritik] = useState(false);
  const [dtAd, setDtAd] = useState("");
  const [dtBilinmiyor, setDtBilinmiyor] = useState(false);
  const [szRef, setSzRef] = useState("");
  const [szBitis, setSzBitis] = useState("");
  const [cpOzet, setCpOzet] = useState("");
  const [cpTest, setCpTest] = useState(false);
  const [cpKanit, setCpKanit] = useState("");
  const [disEmail, setDisEmail] = useState("");
  const [grantUrl, setGrantUrl] = useState<string | null>(null);

  // Dikey E, E1: Cloud Pack soruları + güvence profili + Proof Room.
  const [bulutSorular, setBulutSorular] = useState<BulutSoruRow[]>([]);
  const [bCevap, setBCevap] = useState<Record<string, string>>({});
  const [guvenceProfili, setGuvenceProfili] = useState<GuvenceProfiliSonucu | null>(null);
  const [guvenceYukleniyor, setGuvenceYukleniyor] = useState(false);
  const [sonSnapshot, setSonSnapshot] = useState<{ id: string; profil_hash: string; created_at: string } | null>(null);
  const [proofLinkUrl, setProofLinkUrl] = useState<string | null>(null);

  // Dikey E, E2, Kapı 2: telafi edici kontrol.
  const [telafiler, setTelafiler] = useState<Record<string, TelafiRow[]>>({});
  const [uygunTestKosulari, setUygunTestKosulari] = useState<UygunTestKosu[]>([]);
  const [telafiForm, setTelafiForm] = useState<
    Record<string, { controlId: string; testRunId: string; gerekce: string; validFrom: string; validUntil: string }>
  >({});
  const [telafiRedNeden, setTelafiRedNeden] = useState<Record<string, string>>({});
  const [telafiIptalNeden, setTelafiIptalNeden] = useState<Record<string, string>>({});

  const bugun = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const yukle = useCallback(async () => {
    const db = createClient();
    const {
      data: { user },
    } = await db.auth.getUser();
    setKullaniciId(user?.id ?? null);
    if (user) {
      const { data: p } = await db.from("profiles").select("tenant_id").eq("id", user.id).maybeSingle();
      setTenantId(p?.tenant_id ?? null);
      if (p?.tenant_id) {
        const { data: pr } = await db.from("profiles").select("id, full_name").eq("tenant_id", p.tenant_id).order("full_name");
        setProfiller((pr ?? []) as ProfilRow[]);
      }
    }
    const { data: tp } = await db
      .from("third_parties")
      .select("ad, ulke, tier, karar, dis_rating, dis_rating_kaynagi")
      .eq("id", params.id)
      .maybeSingle();
    setT(tp as Tedarikci | null);
    const [{ data: hs }, { data: ds }, { data: ss }, { data: cs }] = await Promise.all([
      db.from("third_party_services").select("id, hizmet_adi, kritik, veri_siniflari").eq("third_party_id", params.id),
      db.from("fourth_parties").select("id, ad, bilinmiyor, ulke").eq("third_party_id", params.id),
      db.from("third_party_contracts").select("id, sozlesme_ref, baslangic, bitis, denetim_hakki, cikis_maddesi, durum").eq("third_party_id", params.id),
      db.from("exit_plans").select("id, ozet, test_edildi, test_tarihi, test_kaniti").eq("third_party_id", params.id),
    ]);
    setHizmetler((hs ?? []) as Hizmet[]);
    setDorduncular((ds ?? []) as Dorduncu[]);
    setSozlesmeler((ss ?? []) as Sozlesme[]);
    setCikis((cs ?? []) as CikisPlani[]);
    const [{ data: as_ }, { data: fs }] = await Promise.all([
      db.from("third_party_assessments").select("id, tur, durum, tamamlandi_at").eq("third_party_id", params.id).order("baslangic_at", { ascending: false }),
      db.from("assessment_findings").select("id, assessment_id, baslik, ciddiyet, durum, sahibi").eq("third_party_id", params.id),
    ]);
    setDegerlendirmeler((as_ ?? []) as Degerlendirme[]);
    setBulgular((fs ?? []) as BulguRow[]);

    // Dikey E, E2, Kapı 2: telafi edici kontroller — yalnız açık KRİTİK/YÜKSEK
    // bulgular için (dar/yeterli, motorun genelDurum'a dahil ettiği tek
    // ciddiyet KRİTİK'tir; YÜKSEK burada yalnız GÖRÜNÜRLÜK içindir, engeli
    // etkilemez — ADR §5). Tek toplu sorgu (N+1 yok).
    const acikYuksekVeUstuIdler = (fs ?? [])
      .filter((f) => (f.ciddiyet === "KRITIK" || f.ciddiyet === "YUKSEK") && f.durum !== "KAPANDI")
      .map((f) => f.id);
    if (acikYuksekVeUstuIdler.length > 0) {
      const { data: tk } = await db
        .from("assessment_finding_compensating_controls")
        .select(
          "id, assessment_finding_id, durum, control_id, test_run_id, gerekce, valid_from, valid_until, submitted_by, reviewed_by, reviewed_at, red_gerekcesi, revoked_by, revoked_at, revocation_reason, onceki_id, created_at, controls (madde_ref), test_runs (sonuc)",
        )
        .in("assessment_finding_id", acikYuksekVeUstuIdler)
        .order("created_at", { ascending: false });
      const grouped: Record<string, TelafiRow[]> = {};
      for (const t of (tk ?? []) as unknown as Array<Record<string, unknown>>) {
        const row: TelafiRow = {
          id: t.id as string,
          durum: t.durum as string,
          controlId: t.control_id as string,
          controlMaddeRef: (t.controls as { madde_ref: string } | null)?.madde_ref ?? null,
          testRunId: t.test_run_id as string,
          testSonucu: (t.test_runs as { sonuc: string } | null)?.sonuc ?? null,
          gerekce: t.gerekce as string,
          validFrom: t.valid_from as string,
          validUntil: t.valid_until as string,
          submittedBy: t.submitted_by as string | null,
          reviewedBy: t.reviewed_by as string | null,
          reviewedAt: t.reviewed_at as string | null,
          redGerekcesi: t.red_gerekcesi as string | null,
          revokedBy: t.revoked_by as string | null,
          revokedAt: t.revoked_at as string | null,
          revocationReason: t.revocation_reason as string | null,
          oncekiId: t.onceki_id as string | null,
          createdAt: t.created_at as string,
        };
        const fid = t.assessment_finding_id as string;
        grouped[fid] = [...(grouped[fid] ?? []), row];
      }
      setTelafiler(grouped);

      const { data: pk } = await db
        .from("test_runs")
        .select("id, control_id, sonuc, calisti_at, evidence_id, controls (madde_ref), evidences (gecerlilik_bitis)")
        .eq("sonuc", "PASSED")
        .order("calisti_at", { ascending: false });
      const bugunIso = new Date().toISOString().slice(0, 10);
      setUygunTestKosulari(
        ((pk ?? []) as unknown as Array<Record<string, unknown>>).map((t) => {
          const kanitBitis = (t.evidences as { gecerlilik_bitis: string | null } | null)?.gecerlilik_bitis ?? null;
          return {
            id: t.id as string,
            controlId: t.control_id as string,
            controlMaddeRef: (t.controls as { madde_ref: string } | null)?.madde_ref ?? null,
            calistiAt: t.calisti_at as string,
            kanitVarMi: t.evidence_id !== null,
            kanitGuncel: kanitBitis === null || kanitBitis >= bugunIso,
          };
        }),
      );
    } else {
      setTelafiler({});
      setUygunTestKosulari([]);
    }

    const assessmentIds = (as_ ?? []).map((a) => a.id);
    if (assessmentIds.length > 0) {
      const { data: qs } = await db.from("assessment_questions").select("id, assessment_id, soru").in("assessment_id", assessmentIds);
      setSorular((qs ?? []) as SoruRow[]);

      // 37 Tez Dikey A: tedarikçi yanıt revizyonları — assessment başına EN
      // SON (surum en yüksek) satır gösterilir; geçmiş revizyonlar donuk
      // append-only kayıttır, burada yalnız "güncel durum" gösteriliyor.
      const { data: revs } = await db
        .from("assessment_response_revisions")
        .select("id, assessment_id, surum, durum, gonderen_email, gonderildi_at, inceleme_gerekcesi, inceleme_zamani")
        .in("assessment_id", assessmentIds)
        .order("surum", { ascending: false });
      const sonRev: Record<string, RevizyonRow> = {};
      for (const r of (revs ?? []) as RevizyonRow[]) {
        if (!sonRev[r.assessment_id]) sonRev[r.assessment_id] = r;
      }
      setSonRevizyon(sonRev);

      const revizyonIds = Object.values(sonRev).map((r) => r.id);
      if (revizyonIds.length > 0) {
        const { data: cevaplar } = await db
          .from("assessment_response_answers")
          .select("revizyon_id, question_id, cevap, kanit_metni")
          .in("revizyon_id", revizyonIds);
        const grouped: Record<string, RevizyonCevapRow[]> = {};
        for (const c of (cevaplar ?? []) as RevizyonCevapRow[]) {
          grouped[c.revizyon_id] = [...(grouped[c.revizyon_id] ?? []), c];
        }
        setRevizyonCevaplari(grouped);
      } else {
        setRevizyonCevaplari({});
      }
    } else {
      setSorular([]);
      setSonRevizyon({});
      setRevizyonCevaplari({});
    }
    if (assessmentIds.length > 0) {
      const { data: bs } = await db
        .from("assessment_questions")
        .select(
          "id, assessment_id, soru, cevap, uygulanabilirlik, kaynak_turu, kaynak_citation, template_id, assessment_question_templates (kategori, dogrulama_durumu, dogrulayan, dogrulama_zamani)",
        )
        .in("assessment_id", assessmentIds)
        .not("template_id", "is", null);
      setBulutSorular(((bs ?? []) as unknown as BulutSoruRow[]).filter((s) => s.assessment_question_templates?.kategori));
    } else {
      setBulutSorular([]);
    }
    const { data: snap } = await db
      .from("cloud_assurance_profile_snapshots")
      .select("id, profil_hash, created_at")
      .eq("third_party_id", params.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setSonSnapshot(snap ?? null);
    // TAMAMLANDI değerlendirmelerin defter mühür durumu (§8.0 Dikey 1).
    const tamamlandiIds = (as_ ?? []).filter((a) => a.durum === "TAMAMLANDI").map((a) => a.id);
    const durumlar: Record<string, string> = {};
    await Promise.all(
      tamamlandiIds.map(async (aid) => {
        const { data: d } = await db.rpc("artifact_ledger_durumu", { p_artifact_table: "third_party_assessments", p_artifact_id: aid });
        durumlar[aid] = (d as string | null) ?? "KAYITSIZ";
      }),
    );
    setLedgerDurum(durumlar);
  }, [params.id]);

  useEffect(() => {
    const c = async () => {
      await yukle();
    };
    void c();
  }, [yukle]);

  const kararVer = useCallback(
    async (karar: "ONAYLANDI" | "REDDEDILDI") => {
      setHata(null);
      if (!kullaniciId) return;
      const db = createClient();
      const { error } = await db
        .from("third_parties")
        .update({ karar, karar_veren: kullaniciId, karar_zamani: new Date().toISOString() })
        .eq("id", params.id);
      if (error) setHata(error.message);
      await yukle();
    },
    [kullaniciId, params.id, yukle],
  );

  const degerlendirmeOlustur = useCallback(async () => {
    setHata(null);
    if (!tenantId) return;
    const db = createClient();
    const { error } = await db.from("third_party_assessments").insert({ tenant_id: tenantId, third_party_id: params.id, tur: "DORA" });
    if (error) setHata(error.message);
    await yukle();
  }, [tenantId, params.id, yukle]);

  // Doğrulanmış anket şablonu (M35 sonraki dilim, §8.0 sonu öncelik #3): aktif
  // şablon sorularını bu değerlendirmeye KOPYALAR (assessment_questions'a düz
  // insert) — şablonun kendisi değişmez, kopyalanan soru artık bağımsız kayıt.
  const sablondanKopyala = useCallback(
    async (assessmentId: string, tur: string) => {
      setHata(null);
      if (!tenantId) return;
      const db = createClient();
      const { data: sablonlar, error: selErr } = await db
        .from("assessment_question_templates")
        .select("id, soru, sira, kaynak_citation, kaynak_turu")
        .eq("tenant_id", tenantId)
        .eq("tur", tur)
        .eq("aktif", true)
        .order("sira");
      if (selErr) return setHata(selErr.message);
      if (!sablonlar || sablonlar.length === 0) {
        return setHata(`"${tur}" türü için aktif şablon sorusu yok (Tedarikçiler ana sayfasında ekleyin).`);
      }
      // Kopyalanan soru kaynak künyesini + BAŞLANGIÇ kaynak_turu'nu taşır
      // (kopya şablondan bağımsız — sonradan ayrı ayrı değiştirilebilir,
      // uygulanabilirlik UNKNOWN doğar — kural 7). template_id CANLI bağlanır
      // (ADR §1, Dikey E1): şablonun güncel dogrulama_durumu'nu hesap anında
      // okumak için — kopyalama anında DONDURULMAZ.
      const { error } = await db.from("assessment_questions").insert(
        sablonlar.map((s) => ({
          tenant_id: tenantId,
          assessment_id: assessmentId,
          soru: s.soru,
          sira: s.sira,
          kaynak_citation: s.kaynak_citation,
          kaynak_turu: s.kaynak_turu,
          template_id: s.id,
        })),
      );
      if (error) setHata(error.message);
      await yukle();
    },
    [tenantId, yukle],
  );

  const bulguEkle = useCallback(
    async (assessmentId: string) => {
      setHata(null);
      const baslik = (bBaslik[assessmentId] ?? "").trim();
      const sahibi = bSahibi[assessmentId];
      // Bağımsız kapanış invaryantı (Dikey E, kural: kendi işini kendi
      // kapatamaz) sahibi'nin baştan atanmasını GEREKTİRİR — sahibisiz bulgu
      // hiçbir zaman kapatılamaz (DB guard). UI'da uydurmadan zorunlu tutulur.
      if (!baslik || !tenantId || !sahibi) return;
      const db = createClient();
      const { error } = await db.from("assessment_findings").insert({
        tenant_id: tenantId,
        assessment_id: assessmentId,
        third_party_id: params.id,
        baslik,
        ciddiyet: bCiddiyet[assessmentId] ?? "ORTA",
        sahibi,
      });
      if (error) setHata(error.message);
      setBBaslik((m) => ({ ...m, [assessmentId]: "" }));
      setBSahibi((m) => ({ ...m, [assessmentId]: "" }));
      await yukle();
    },
    [bBaslik, bCiddiyet, bSahibi, tenantId, params.id, yukle],
  );

  const bulguKapat = useCallback(
    async (findingId: string) => {
      setHata(null);
      const kanit = (bKanit[findingId] ?? "").trim();
      if (!kanit || !kullaniciId) return setHata("Kapanış kanıtı zorunlu (kural 14).");
      const db = createClient();
      const { error } = await db
        .from("assessment_findings")
        .update({ durum: "KAPANDI", kapanis_kanit: kanit, kapatan: kullaniciId, kapanis_zamani: new Date().toISOString() })
        .eq("id", findingId);
      if (error) setHata(error.message);
      setBKanit((m) => ({ ...m, [findingId]: "" }));
      // Kritik bulgu kapanışı ledger_outbox'a olay yazdı (trigger, aynı
      // transaction) — mühürü otomatik tetikle (§8.0 Dikey 1).
      await fetch("/api/seffaflik/outbox/isle", { method: "POST" }).catch(() => {});
      await yukle();
    },
    [bKanit, kullaniciId, yukle],
  );

  const telafiOner = useCallback(
    async (findingId: string) => {
      setHata(null);
      const form = telafiForm[findingId];
      if (!form?.controlId || !form.testRunId || !form.gerekce?.trim() || !form.validFrom || !form.validUntil) return;
      const res = await fetch(`/api/tedarikciler/${params.id}/bulgular/${findingId}/telafi`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const govde = await res.json();
      if (!res.ok) return setHata(govde.hata ?? "Telafi edici kontrol önerilemedi.");
      setTelafiForm((m) => ({ ...m, [findingId]: { controlId: "", testRunId: "", gerekce: "", validFrom: "", validUntil: "" } }));
      await yukle();
    },
    [telafiForm, params.id, yukle],
  );

  const telafiKararVer = useCallback(
    async (telafiId: string, karar: "AKTIF" | "REDDEDILDI") => {
      setHata(null);
      const gov: { karar: string; redGerekcesi?: string } = { karar };
      if (karar === "REDDEDILDI") gov.redGerekcesi = telafiRedNeden[telafiId] ?? "";
      const res = await fetch(`/api/telafi/${telafiId}/karar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(gov),
      });
      const govde = await res.json();
      if (!res.ok) return setHata(govde.hata ?? "Karar kaydedilemedi.");
      setTelafiRedNeden((m) => ({ ...m, [telafiId]: "" }));
      await yukle();
    },
    [telafiRedNeden, yukle],
  );

  const telafiIptalEt = useCallback(
    async (telafiId: string) => {
      setHata(null);
      const neden = (telafiIptalNeden[telafiId] ?? "").trim();
      if (!neden) return setHata("İptal nedeni zorunlu.");
      const res = await fetch(`/api/telafi/${telafiId}/iptal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revocationReason: neden }),
      });
      const govde = await res.json();
      if (!res.ok) return setHata(govde.hata ?? "İptal edilemedi.");
      setTelafiIptalNeden((m) => ({ ...m, [telafiId]: "" }));
      await yukle();
    },
    [telafiIptalNeden, yukle],
  );

  const bulutCevapKaydet = useCallback(
    async (id: string) => {
      const db = createClient();
      const { error } = await db.from("assessment_questions").update({ cevap: bCevap[id] ?? "" }).eq("id", id);
      if (error) setHata(error.message);
      await yukle();
    },
    [bCevap, yukle],
  );
  const bulutUygulanabilirlikGuncelle = useCallback(
    async (id: string, deger: string) => {
      const db = createClient();
      const { error } = await db.from("assessment_questions").update({ uygulanabilirlik: deger }).eq("id", id);
      if (error) setHata(error.message);
      await yukle();
    },
    [yukle],
  );
  const bulutKaynakTuruGuncelle = useCallback(
    async (id: string, deger: KaynakTuru) => {
      const db = createClient();
      const { error } = await db.from("assessment_questions").update({ kaynak_turu: deger }).eq("id", id);
      if (error) setHata(error.message);
      await yukle();
    },
    [yukle],
  );

  // Güvence profili: GET önizler (mühürlemez), POST mühürler (sealed snapshot).
  const guvenceOnizle = useCallback(async () => {
    setGuvenceYukleniyor(true);
    setHata(null);
    try {
      const res = await fetch(`/api/tedarikciler/${params.id}/guvence-profili`);
      const govde = await res.json();
      if (!res.ok) return setHata(govde.hata ?? "Güvence profili hesaplanamadı.");
      setGuvenceProfili(govde.profil as GuvenceProfiliSonucu);
    } finally {
      setGuvenceYukleniyor(false);
    }
  }, [params.id]);

  const guvenceMuhurle = useCallback(async () => {
    setGuvenceYukleniyor(true);
    setHata(null);
    try {
      const res = await fetch(`/api/tedarikciler/${params.id}/guvence-profili`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const govde = await res.json();
      if (!res.ok) return setHata(govde.hata ?? "Güvence profili mühürlenemedi.");
      setGuvenceProfili(govde.profil as GuvenceProfiliSonucu);
      await yukle();
    } finally {
      setGuvenceYukleniyor(false);
    }
  }, [params.id, yukle]);

  const proofLinkiOlustur = useCallback(async () => {
    setHata(null);
    if (!sonSnapshot) return;
    const res = await fetch("/api/proof-room", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cloudAssuranceProfileId: sonSnapshot.id }),
    });
    const govde = await res.json();
    if (!res.ok || !govde.url) return setHata(govde.hata ?? "Proof Room linki oluşturulamadı.");
    setProofLinkUrl(govde.url);
  }, [sonSnapshot]);

  useEffect(() => {
    let iptal = false;
    void (async () => {
      const res = await fetch(`/api/tedarikciler/${params.id}/guvence-profili`);
      const govde = await res.json();
      if (!iptal && res.ok) setGuvenceProfili(govde.profil as GuvenceProfiliSonucu);
    })();
    return () => {
      iptal = true;
    };
  }, [params.id]);

  // Vendor-portal dış erişim (M35 sonraki dilim, G7 M41 partner modeli):
  // matter_access_grants/matter_goruntule deseninin AYNISI, bağımsızlık beyanı
  // ön koşulu olmadan (o kavram regülatör bağlamına özgüydü).
  //
  // TOKEN SERTLEŞTİRME (37 Tez Dikey A): token tamamen İSTEMCİDE üretilir,
  // yalnız hash'i insert edilir — DB düz token'ı HİÇ görmez.
  const disErisimAc = useCallback(async () => {
    setHata(null);
    if (!disEmail.trim() || !tenantId) return;
    const db = createClient();
    const son = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const { token, tokenHash } = await disErisimTokenUret();
    const { error } = await db
      .from("third_party_access_grants")
      .insert({ tenant_id: tenantId, third_party_id: params.id, external_email: disEmail.trim(), token_hash: tokenHash, son_gecerlilik: son, olusturan: kullaniciId });
    if (error) {
      setHata(error.message);
      return;
    }
    setGrantUrl(`/tedarikci-erisim/${token}`);
    setDisEmail("");
  }, [disEmail, tenantId, kullaniciId, params.id]);

  const degerlendirmeTamamla = useCallback(
    async (assessmentId: string) => {
      setHata(null);
      if (!kullaniciId) return;
      const db = createClient();
      const { error } = await db
        .from("third_party_assessments")
        .update({ durum: "TAMAMLANDI", degerlendiren: kullaniciId })
        .eq("id", assessmentId);
      if (error) setHata(error.message.includes("KRITIK") ? "Açık KRİTİK bulgu varken tamamlanamaz." : error.message);
      // Sign-off ledger_outbox'a olay yazdı (trigger) — mühürü otomatik tetikle.
      if (!error) await fetch("/api/seffaflik/outbox/isle", { method: "POST" }).catch(() => {});
      await yukle();
    },
    [kullaniciId, yukle],
  );

  // 37 Tez Dikey A: TASLAK -> DEVAM (yayın kapısı guard'ı en az 1 soru ister).
  const tedarikciyeYayinla = useCallback(
    async (assessmentId: string) => {
      setHata(null);
      const db = createClient();
      const { error } = await db.from("third_party_assessments").update({ durum: "DEVAM" }).eq("id", assessmentId);
      if (error) setHata(error.message.includes("en az bir soru") ? "Yayınlamadan önce en az bir soru ekleyin." : error.message);
      await yukle();
    },
    [yukle],
  );

  // İnceleme kararı: RLS yalnız durum='GONDERILDI' satırlarına UPDATE izni
  // verir; DB guard'ı (assessment_response_revision_guard) gerekçe/kimlik
  // atfını zorunlu kılar — burada yalnız isteği yolluyoruz.
  const incelemeKarariVer = useCallback(
    async (revizyonId: string, durum: "DEGISIKLIK_ISTENDI" | "KABUL_EDILDI" | "REDDEDILDI") => {
      setHata(null);
      if (!kullaniciId) return;
      const gerekce = (incelemeGerekce[revizyonId] ?? "").trim();
      if ((durum === "DEGISIKLIK_ISTENDI" || durum === "REDDEDILDI") && !gerekce) {
        setHata("Değişiklik isteği/red gerekçe ister.");
        return;
      }
      const db = createClient();
      const { error } = await db
        .from("assessment_response_revisions")
        .update({ durum, inceleyen: kullaniciId, inceleme_gerekcesi: gerekce || null, inceleme_zamani: new Date().toISOString() })
        .eq("id", revizyonId);
      if (error) setHata(error.message);
      setIncelemeGerekce((m) => ({ ...m, [revizyonId]: "" }));
      await yukle();
    },
    [kullaniciId, incelemeGerekce, yukle],
  );

  const hizmetEkle = useCallback(async () => {
    setHata(null);
    if (!hizmetAd.trim() || !tenantId) return;
    const db = createClient();
    const { error } = await db.from("third_party_services").insert({ tenant_id: tenantId, third_party_id: params.id, hizmet_adi: hizmetAd.trim(), kritik: hizmetKritik });
    if (error) setHata(error.message);
    setHizmetAd("");
    setHizmetKritik(false);
    await yukle();
  }, [hizmetAd, hizmetKritik, tenantId, params.id, yukle]);

  const dtEkle = useCallback(async () => {
    setHata(null);
    if (!tenantId) return;
    if (!dtBilinmiyor && !dtAd.trim()) {
      setHata("Bilinen dördüncü taraf için ad zorunlu (ya da bilinmiyor işaretleyin).");
      return;
    }
    const db = createClient();
    const { error } = await db.from("fourth_parties").insert({ tenant_id: tenantId, third_party_id: params.id, ad: dtBilinmiyor ? null : dtAd.trim(), bilinmiyor: dtBilinmiyor });
    if (error) setHata(error.message);
    setDtAd("");
    setDtBilinmiyor(false);
    await yukle();
  }, [dtAd, dtBilinmiyor, tenantId, params.id, yukle]);

  const szEkle = useCallback(async () => {
    setHata(null);
    if (!szRef.trim() || !szBitis || !tenantId) return;
    const db = createClient();
    const { error } = await db.from("third_party_contracts").insert({ tenant_id: tenantId, third_party_id: params.id, sozlesme_ref: szRef.trim(), baslangic: bugun, bitis: szBitis });
    if (error) setHata(error.message);
    setSzRef("");
    setSzBitis("");
    await yukle();
  }, [szRef, szBitis, tenantId, params.id, bugun, yukle]);

  const cpEkle = useCallback(async () => {
    setHata(null);
    if (!cpOzet.trim() || !tenantId) return;
    const db = createClient();
    // test_edildi=true ise kanıt+tarih DB'de zorunlu; kanıtsız işaretlersek DB reddeder.
    const { error } = await db.from("exit_plans").insert({
      tenant_id: tenantId,
      third_party_id: params.id,
      ozet: cpOzet.trim(),
      test_edildi: cpTest,
      test_tarihi: cpTest ? bugun : null,
      test_kaniti: cpTest ? (cpKanit.trim() || null) : null,
    });
    if (error) {
      setHata(error.message.includes("exit_plans_test_kaniti") ? "Test edildi işaretlendiyse tatbikat kanıtı zorunlu." : error.message);
      return;
    }
    setCpOzet("");
    setCpTest(false);
    setCpKanit("");
    await yukle();
  }, [cpOzet, cpTest, cpKanit, tenantId, params.id, bugun, yukle]);

  const roiUrl = useMemo(() => {
    if (!t) return null;
    const kayit = roiKaydiUret({
      tedarikci: { ad: t.ad, ulke: t.ulke, tier: t.tier as "KRITIK" | "ONEMLI" | "DUSUK", karar: t.karar },
      hizmetler: hizmetler.map((h) => ({ hizmet_adi: h.hizmet_adi, kritik: h.kritik, veri_siniflari: h.veri_siniflari })),
      sozlesmeler: sozlesmeler.map((s) => ({ sozlesme_ref: s.sozlesme_ref, baslangic: s.baslangic, bitis: s.bitis, denetim_hakki: s.denetim_hakki, cikis_maddesi: s.cikis_maddesi })),
      dorduncuTaraflar: dorduncular.map((d) => ({ ad: d.ad, bilinmiyor: d.bilinmiyor, ulke: d.ulke })),
    });
    return URL.createObjectURL(new Blob([JSON.stringify(kayit, null, 2)], { type: "application/json" }));
  }, [t, hizmetler, sozlesmeler, dorduncular]);

  if (!t) return <div className="p-2 text-sm text-muted-foreground">Yükleniyor…</div>;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/tedarikciler" className="text-sm text-muted-foreground hover:underline">
          ← Tedarikçiler
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{t.ad}</h1>
          <StatusBadge durum={TIER[t.tier]?.semantik ?? "neutral"}>{TIER[t.tier]?.etiket ?? t.tier}</StatusBadge>
          <StatusBadge durum={KARAR[t.karar]?.semantik ?? "neutral"}>{KARAR[t.karar]?.etiket ?? t.karar}</StatusBadge>
        </div>
      </div>

      {hata ? (
        <p role="alert" className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {hata}
        </p>
      ) : null}

      {/* Karar (insan) */}
      <Card>
        <CardHeader>
          <CardTitle>Vendor kararı</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <p className="text-muted-foreground">
            Dış rating {t.dis_rating ? `(${t.dis_rating}, ${t.dis_rating_kaynagi ?? "?"})` : "yok"} — salt bilgi; karar
            insana aittir.
          </p>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => void kararVer("ONAYLANDI")} disabled={t.karar === "ONAYLANDI"}>
              Onayla
            </Button>
            <Button size="sm" variant="outline" onClick={() => void kararVer("REDDEDILDI")} disabled={t.karar === "REDDEDILDI"}>
              Reddet
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Hizmetler */}
      <Card>
        <CardHeader>
          <CardTitle>Hizmetler ({hizmetler.length})</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          {hizmetler.map((h) => (
            <div key={h.id} className="flex flex-wrap items-center gap-2">
              <span>{h.hizmet_adi}</span>
              {h.kritik ? <StatusBadge durum="danger">Kritik</StatusBadge> : null}
            </div>
          ))}
          <div className="flex flex-wrap items-end gap-2 border-t pt-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="hz-ad">Hizmet</Label>
              <Input id="hz-ad" value={hizmetAd} onChange={(e) => setHizmetAd(e.target.value)} className="w-56" />
            </div>
            <label className="flex items-center gap-1 text-xs">
              <input type="checkbox" checked={hizmetKritik} onChange={(e) => setHizmetKritik(e.target.checked)} /> Kritik hizmet
            </label>
            <Button size="sm" onClick={() => void hizmetEkle()} disabled={!hizmetAd.trim()}>
              Hizmet Ekle
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Dördüncü taraflar */}
      <Card>
        <CardHeader>
          <CardTitle>Dördüncü taraflar ({dorduncular.length})</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          {dorduncular.map((d) => (
            <div key={d.id} className="flex flex-wrap items-center gap-2">
              {d.bilinmiyor ? <StatusBadge durum="unknown">Bilinmiyor</StatusBadge> : <span>{d.ad}</span>}
            </div>
          ))}
          <div className="flex flex-wrap items-end gap-2 border-t pt-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="dt-ad">Alt yüklenici</Label>
              <Input id="dt-ad" value={dtAd} onChange={(e) => setDtAd(e.target.value)} disabled={dtBilinmiyor} className="w-56" />
            </div>
            <label className="flex items-center gap-1 text-xs">
              <input type="checkbox" checked={dtBilinmiyor} onChange={(e) => setDtBilinmiyor(e.target.checked)} /> Bilinmiyor
            </label>
            <Button size="sm" onClick={() => void dtEkle()}>
              Dördüncü Taraf Ekle
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Sözleşmeler */}
      <Card>
        <CardHeader>
          <CardTitle>Sözleşmeler ({sozlesmeler.length})</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          {sozlesmeler.map((s) => {
            const y = sozlesmeYakinligi(s.bitis, new Date());
            return (
              <div key={s.id} className="flex flex-wrap items-center gap-2">
                <span>{s.sozlesme_ref}</span>
                <StatusBadge durum={s.durum === "SURESI_DOLDU" || y.gecmis ? "danger" : y.yaklasiyor ? "warning" : "success"}>
                  {s.durum === "SURESI_DOLDU" ? "Süresi doldu" : y.mesaj}
                </StatusBadge>
              </div>
            );
          })}
          <div className="flex flex-wrap items-end gap-2 border-t pt-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="sz-ref">Sözleşme ref</Label>
              <Input id="sz-ref" value={szRef} onChange={(e) => setSzRef(e.target.value)} className="w-40" />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="sz-bitis">Bitiş</Label>
              <Input id="sz-bitis" type="date" value={szBitis} onChange={(e) => setSzBitis(e.target.value)} />
            </div>
            <Button size="sm" onClick={() => void szEkle()} disabled={!szRef.trim() || !szBitis}>
              Sözleşme Ekle
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Çıkış planı */}
      <Card>
        <CardHeader>
          <CardTitle>Çıkış planı ({cikis.length})</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          {cikis.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center gap-2">
              <span>{c.ozet}</span>
              <StatusBadge durum={c.test_edildi ? "success" : "warning"}>
                {c.test_edildi ? `Test edildi (${c.test_kaniti})` : "Test edilmedi"}
              </StatusBadge>
            </div>
          ))}
          <div className="flex flex-wrap items-end gap-2 border-t pt-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="cp-ozet">Özet</Label>
              <Input id="cp-ozet" value={cpOzet} onChange={(e) => setCpOzet(e.target.value)} className="w-56" />
            </div>
            <label className="flex items-center gap-1 text-xs">
              <input type="checkbox" checked={cpTest} onChange={(e) => setCpTest(e.target.checked)} /> Test edildi
            </label>
            {cpTest ? (
              <div className="flex flex-col gap-1">
                <Label htmlFor="cp-kanit">Tatbikat kanıtı</Label>
                <Input id="cp-kanit" value={cpKanit} onChange={(e) => setCpKanit(e.target.value)} className="w-48" />
              </div>
            ) : null}
            <Button size="sm" onClick={() => void cpEkle()} disabled={!cpOzet.trim()}>
              Çıkış Planı Ekle
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* RoI export */}
      <Card>
        <CardHeader>
          <CardTitle>DORA Register of Information (iskele)</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <p className="text-muted-foreground">
            MVP iskele — resmî DORA RTS şeması açık karardır; tedarikçi grafından türetilir.
          </p>
          {roiUrl ? (
            <a
              href={roiUrl}
              download={`kalkan-roi-${t.ad}.json`}
              className="inline-flex h-8 w-fit items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              RoI kaydını indir (JSON)
            </a>
          ) : null}
        </CardContent>
      </Card>

      {/* Değerlendirmeler (DORA due-diligence) */}
      <Card>
        <CardHeader>
          <CardTitle>Değerlendirmeler ({degerlendirmeler.length})</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <Button size="sm" variant="outline" className="w-fit" onClick={() => void degerlendirmeOlustur()}>
            Yeni Değerlendirme (DORA)
          </Button>
          {degerlendirmeler.map((a) => {
            const aBulgular = bulgular.filter((b) => b.assessment_id === a.id);
            const ozet = bulguOzeti(aBulgular as unknown as Bulgu[]);
            return (
              <div key={a.id} className="flex flex-col gap-2 rounded-md border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{a.tur}</span>
                  <StatusBadge durum={a.durum === "TAMAMLANDI" ? "success" : a.durum === "DEVAM" ? "legal-review" : "neutral"}>
                    {a.durum}
                  </StatusBadge>
                  {ozet.acikKritikVar ? <StatusBadge durum="danger">Açık KRİTİK bulgu</StatusBadge> : null}
                  {a.durum === "TASLAK" ? (
                    <Button size="sm" onClick={() => void tedarikciyeYayinla(a.id)}>
                      Tedarikçiye Yayınla
                    </Button>
                  ) : null}
                  {a.durum !== "TAMAMLANDI" ? (
                    <Button size="sm" onClick={() => void degerlendirmeTamamla(a.id)} disabled={!ozet.tamamlanabilir}>
                      Değerlendirmeyi Tamamla
                    </Button>
                  ) : null}
                  {a.durum !== "TAMAMLANDI" ? (
                    <Button size="sm" variant="outline" onClick={() => void sablondanKopyala(a.id, a.tur)}>
                      Şablondan Soru Kopyala
                    </Button>
                  ) : null}
                  {a.durum === "TAMAMLANDI" && ledgerDurum[a.id] ? (
                    <StatusBadge durum={ledgerDurum[a.id] === "ANCHORED" ? "success" : ledgerDurum[a.id] === "FAILED" ? "danger" : "warning"}>
                      {ledgerDurum[a.id] === "ANCHORED"
                        ? "Sign-off deftere mühürlü"
                        : ledgerDurum[a.id] === "FAILED"
                          ? "Mühürleme başarısız"
                          : "Mühür bekleniyor"}
                    </StatusBadge>
                  ) : null}
                </div>

                {sorular.filter((s) => s.assessment_id === a.id).length > 0 ? (
                  <div className="flex flex-col gap-1 border-t pt-2 text-xs">
                    <span className="font-medium">Anket soruları</span>
                    {sorular
                      .filter((s) => s.assessment_id === a.id)
                      .map((s) => (
                        <span key={s.id}>• {s.soru}</span>
                      ))}
                  </div>
                ) : null}

                {/* 37 Tez Dikey A: tedarikçi yanıtı — en son revizyon. Kabul
                    edilen cevap otomatik olarak kontrolü/tedarikçiyi "uyumlu"
                    yapmaz; bu yalnızca bir inceleme kararıdır. */}
                {sonRevizyon[a.id] ? (
                  <div className="flex flex-col gap-2 border-t pt-2 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">
                        Tedarikçi yanıtı · revizyon {sonRevizyon[a.id].surum} · {sonRevizyon[a.id].gonderen_email ?? "—"}
                      </span>
                      <StatusBadge
                        durum={
                          sonRevizyon[a.id].durum === "KABUL_EDILDI"
                            ? "success"
                            : sonRevizyon[a.id].durum === "REDDEDILDI" || sonRevizyon[a.id].durum === "SURESI_DOLDU"
                              ? "danger"
                              : "warning"
                        }
                      >
                        {sonRevizyon[a.id].durum}
                      </StatusBadge>
                    </div>
                    {(revizyonCevaplari[sonRevizyon[a.id].id] ?? []).map((c) => {
                      const s = sorular.find((sr) => sr.id === c.question_id);
                      return (
                        <div key={c.question_id} className="rounded border p-1.5">
                          <div className="text-muted-foreground">{s?.soru ?? c.question_id}</div>
                          <div>{c.cevap || "—"}</div>
                          {c.kanit_metni ? <div className="text-muted-foreground">Kanıt: {c.kanit_metni}</div> : null}
                        </div>
                      );
                    })}
                    {sonRevizyon[a.id].inceleme_gerekcesi ? (
                      <div className="text-muted-foreground">İnceleme notu: {sonRevizyon[a.id].inceleme_gerekcesi}</div>
                    ) : null}
                    {sonRevizyon[a.id].durum === "GONDERILDI" ? (
                      <div className="flex flex-wrap items-end gap-2">
                        <Input
                          value={incelemeGerekce[sonRevizyon[a.id].id] ?? ""}
                          onChange={(e) => setIncelemeGerekce((m) => ({ ...m, [sonRevizyon[a.id].id]: e.target.value }))}
                          placeholder="Gerekçe (değişiklik/red için zorunlu)"
                          aria-label={`${a.id} inceleme gerekçesi`}
                          className="h-7 w-56 text-xs"
                        />
                        <Button size="sm" onClick={() => void incelemeKarariVer(sonRevizyon[a.id].id, "KABUL_EDILDI")}>
                          Kabul Et
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => void incelemeKarariVer(sonRevizyon[a.id].id, "DEGISIKLIK_ISTENDI")}>
                          Değişiklik İste
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => void incelemeKarariVer(sonRevizyon[a.id].id, "REDDEDILDI")}>
                          Reddet
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {aBulgular.map((f) => {
                  const buBulgununTelafileri = telafiler[f.id] ?? [];
                  const telafiUygun = (f.ciddiyet === "KRITIK" || f.ciddiyet === "YUKSEK") && f.durum !== "KAPANDI";
                  const acikTeklifVarMi = buBulgununTelafileri.some((t) => t.durum === "TASLAK" || t.durum === "INCELEMEDE" || t.durum === "AKTIF");
                  const form = telafiForm[f.id] ?? { controlId: "", testRunId: "", gerekce: "", validFrom: "", validUntil: "" };
                  const seciliKontrolTestleri = uygunTestKosulari.filter((tk) => tk.controlId === form.controlId);
                  const kontrolSecenekleri = [...new Map(uygunTestKosulari.map((tk) => [tk.controlId, tk.controlMaddeRef])).entries()];
                  return (
                    <div key={f.id} className="flex flex-col gap-2 border-t pt-2 text-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        <span>{f.baslik}</span>
                        <StatusBadge durum={f.ciddiyet === "KRITIK" ? "danger" : f.ciddiyet === "YUKSEK" ? "warning" : "neutral"}>{f.ciddiyet}</StatusBadge>
                        <StatusBadge durum={f.durum === "KAPANDI" ? "success" : "warning"}>{f.durum}</StatusBadge>
                        <span className="text-muted-foreground">Sahip: {profiller.find((p) => p.id === f.sahibi)?.full_name ?? "—"}</span>
                        {f.durum !== "KAPANDI" && f.sahibi && f.sahibi === kullaniciId ? (
                          <span className="text-muted-foreground">
                            Bu bulgunun sahibisiniz — bağımsız kapanış gereği kendi bulgunuzu kapatamazsınız (kural 14, Dikey E).
                          </span>
                        ) : null}
                        {f.durum !== "KAPANDI" && f.sahibi && f.sahibi !== kullaniciId ? (
                          <>
                            <Input
                              value={bKanit[f.id] ?? ""}
                              onChange={(e) => setBKanit((m) => ({ ...m, [f.id]: e.target.value }))}
                              placeholder="kapanış kanıtı"
                              aria-label={`${f.id} kapanış kanıtı`}
                              className="h-7 w-44 text-xs"
                            />
                            <Button size="sm" variant="outline" onClick={() => void bulguKapat(f.id)}>
                              Kapat
                            </Button>
                          </>
                        ) : null}
                      </div>

                      {/* Dikey E, E2, Kapı 2: telafi edici kontrol — bulguyu
                          KAPATMAZ, yalnız yönetim durumunu bildirir. */}
                      {telafiUygun ? (
                        <div className="flex flex-col gap-2 rounded-md border border-dashed p-2" data-testid={`telafi-blok-${f.id}`}>
                          <span className="font-medium">Telafi Edici Kontrol</span>
                          {buBulgununTelafileri.map((t) => {
                            const etiket = TELAFI_DURUM_ETIKET[t.durum] ?? { etiket: t.durum, semantik: "neutral" as const };
                            const benimTeklifim = t.submittedBy === kullaniciId;
                            return (
                              <div key={t.id} className="flex flex-col gap-1 rounded border p-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <StatusBadge durum={etiket.semantik}>{etiket.etiket}</StatusBadge>
                                  <span className="text-muted-foreground">
                                    Kontrol {t.controlMaddeRef ?? t.controlId} · Test sonucu {t.testSonucu ?? "—"} · {t.validFrom} → {t.validUntil}
                                  </span>
                                </div>
                                {t.durum === "AKTIF" ? (
                                  <p className="text-muted-foreground">{GUVENCE_ENGEL_ACIKLAMALARI.AKTIF_TELAFI_EDICI_KONTROL}</p>
                                ) : null}
                                {t.gerekce ? <span className="text-muted-foreground">Gerekçe: {t.gerekce}</span> : null}
                                {t.durum === "REDDEDILDI" && t.redGerekcesi ? (
                                  <span className="text-muted-foreground">Red gerekçesi: {t.redGerekcesi}</span>
                                ) : null}
                                {t.durum === "IPTAL_EDILDI" && t.revocationReason ? (
                                  <span className="text-muted-foreground">İptal nedeni: {t.revocationReason}</span>
                                ) : null}

                                {t.durum === "INCELEMEDE" && benimTeklifim ? (
                                  <span className="text-muted-foreground">
                                    Bu öneriyi siz hazırladınız — bağımsız inceleme gereği kendi teklifinizi karara bağlayamazsınız (maker-checker).
                                  </span>
                                ) : null}
                                {t.durum === "INCELEMEDE" && !benimTeklifim ? (
                                  <div className="flex flex-wrap items-end gap-2">
                                    <Button size="sm" onClick={() => void telafiKararVer(t.id, "AKTIF")}>
                                      Onayla (Aktive Et)
                                    </Button>
                                    <Input
                                      value={telafiRedNeden[t.id] ?? ""}
                                      onChange={(e) => setTelafiRedNeden((m) => ({ ...m, [t.id]: e.target.value }))}
                                      placeholder="Red gerekçesi"
                                      aria-label={`${t.id} red gerekçesi`}
                                      className="h-7 w-44 text-xs"
                                    />
                                    <Button size="sm" variant="outline" onClick={() => void telafiKararVer(t.id, "REDDEDILDI")}>
                                      Reddet
                                    </Button>
                                  </div>
                                ) : null}
                                {["TASLAK", "INCELEMEDE", "AKTIF"].includes(t.durum) ? (
                                  <div className="flex flex-wrap items-end gap-2">
                                    <Input
                                      value={telafiIptalNeden[t.id] ?? ""}
                                      onChange={(e) => setTelafiIptalNeden((m) => ({ ...m, [t.id]: e.target.value }))}
                                      placeholder="İptal nedeni"
                                      aria-label={`${t.id} iptal nedeni`}
                                      className="h-7 w-44 text-xs"
                                    />
                                    <Button size="sm" variant="outline" onClick={() => void telafiIptalEt(t.id)}>
                                      İptal Et
                                    </Button>
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}

                          {!acikTeklifVarMi ? (
                            <div className="flex flex-wrap items-end gap-2">
                              <select
                                value={form.controlId}
                                onChange={(e) => setTelafiForm((m) => ({ ...m, [f.id]: { ...form, controlId: e.target.value, testRunId: "" } }))}
                                aria-label={`${f.id} telafi kontrol seç`}
                                className="h-8 rounded-md border bg-background px-2 text-xs"
                              >
                                <option value="">Kontrol seçin…</option>
                                {kontrolSecenekleri.map(([cid, ref]) => (
                                  <option key={cid} value={cid}>
                                    {ref ?? cid}
                                  </option>
                                ))}
                              </select>
                              <select
                                value={form.testRunId}
                                onChange={(e) => setTelafiForm((m) => ({ ...m, [f.id]: { ...form, testRunId: e.target.value } }))}
                                aria-label={`${f.id} telafi test koşusu seç`}
                                disabled={!form.controlId}
                                className="h-8 rounded-md border bg-background px-2 text-xs"
                              >
                                <option value="">PASSED test koşusu seçin…</option>
                                {seciliKontrolTestleri.map((tk) => (
                                  <option key={tk.id} value={tk.id}>
                                    {new Date(tk.calistiAt).toLocaleDateString("tr-TR")} {tk.kanitGuncel ? "· kanıt güncel" : "· kanıt güncel değil"}
                                  </option>
                                ))}
                              </select>
                              <Input
                                value={form.gerekce}
                                onChange={(e) => setTelafiForm((m) => ({ ...m, [f.id]: { ...form, gerekce: e.target.value } }))}
                                placeholder="Gerekçe"
                                aria-label={`${f.id} telafi gerekçesi`}
                                className="h-8 w-40 text-xs"
                              />
                              <Input
                                type="date"
                                value={form.validFrom}
                                onChange={(e) => setTelafiForm((m) => ({ ...m, [f.id]: { ...form, validFrom: e.target.value } }))}
                                aria-label={`${f.id} telafi geçerlilik başlangıcı`}
                                className="h-8 w-36 text-xs"
                              />
                              <Input
                                type="date"
                                value={form.validUntil}
                                onChange={(e) => setTelafiForm((m) => ({ ...m, [f.id]: { ...form, validUntil: e.target.value } }))}
                                aria-label={`${f.id} telafi geçerlilik bitişi`}
                                className="h-8 w-36 text-xs"
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => void telafiOner(f.id)}
                                disabled={!form.controlId || !form.testRunId || !form.gerekce.trim() || !form.validFrom || !form.validUntil}
                              >
                                Öner ve İncelemeye Gönder
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  );
                })}

                {a.durum !== "TAMAMLANDI" ? (
                  <div className="flex flex-wrap items-end gap-2 border-t pt-2">
                    <Input
                      value={bBaslik[a.id] ?? ""}
                      onChange={(e) => setBBaslik((m) => ({ ...m, [a.id]: e.target.value }))}
                      placeholder="Bulgu başlığı"
                      aria-label={`${a.id} bulgu başlık`}
                      className="h-8 w-56 text-xs"
                    />
                    <select
                      value={bCiddiyet[a.id] ?? "ORTA"}
                      onChange={(e) => setBCiddiyet((m) => ({ ...m, [a.id]: e.target.value }))}
                      aria-label={`${a.id} ciddiyet`}
                      className="h-8 rounded-md border bg-background px-2 text-xs"
                    >
                      <option value="DUSUK">Düşük</option>
                      <option value="ORTA">Orta</option>
                      <option value="YUKSEK">Yüksek</option>
                      <option value="KRITIK">Kritik</option>
                    </select>
                    <select
                      value={bSahibi[a.id] ?? ""}
                      onChange={(e) => setBSahibi((m) => ({ ...m, [a.id]: e.target.value }))}
                      aria-label={`${a.id} bulgu sahibi`}
                      className="h-8 rounded-md border bg-background px-2 text-xs"
                    >
                      <option value="">Sahip seçin…</option>
                      {profiller.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.full_name ?? p.id}
                        </option>
                      ))}
                    </select>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void bulguEkle(a.id)}
                      disabled={!(bBaslik[a.id] ?? "").trim() || !bSahibi[a.id]}
                    >
                      Bulgu Ekle
                    </Button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Cloud Pack (Dikey E1): 11 bulut alanı, kaynak_turu ↔ dogrulama_durumu AYRI boyutlar. */}
      <Card data-testid="cloud-pack-karti">
        <CardHeader>
          <CardTitle>Bulut / kritik tedarikçi güvence paketi</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <p className="text-muted-foreground">
            Kaynak türü (bu iddia NEYE dayanıyor) ile doğrulama durumu (soru künyesi insan tarafından
            doğrulandı mı) BAĞIMSIZ iki boyuttur — biri diğerini otomatik olarak yükseltmez. Sağlayıcı
            beyanı tek başına bağımsız doğrulama SAYILMAZ.
          </p>
          {bulutSorular.length === 0 ? (
            <p className="text-muted-foreground">
              Bu tedarikçinin hiçbir değerlendirmesinde Cloud Pack sorusu yok. Şablondan kopyalayın
              (yukarıdaki değerlendirme kartı) — şablonları{" "}
              <Link href="/tedarikciler" className="text-primary underline">
                Tedarikçiler ana sayfasında
              </Link>{" "}
              yönetin.
            </p>
          ) : (
            Object.entries(
              bulutSorular.reduce<Record<string, BulutSoruRow[]>>((acc, s) => {
                const k = s.assessment_question_templates?.kategori ?? "BILINMIYOR";
                (acc[k] ??= []).push(s);
                return acc;
              }, {}),
            ).map(([kategori, sorular]) => (
              <div key={kategori} className="flex flex-col gap-2 border-t pt-2">
                <span className="font-medium">{BULUT_KATEGORI[kategori] ?? kategori}</span>
                {sorular.map((s) => {
                  const sablon = s.assessment_question_templates;
                  return (
                    <div key={s.id} className="flex flex-col gap-1 rounded border p-2 text-xs">
                      <span>{s.soru}</span>
                      <div className="flex flex-wrap items-center gap-2">
                        <Input
                          value={bCevap[s.id] ?? s.cevap ?? ""}
                          onChange={(e) => setBCevap((m) => ({ ...m, [s.id]: e.target.value }))}
                          placeholder="Cevap"
                          aria-label={`${s.id} cevap`}
                          className="h-7 w-56 text-xs"
                        />
                        <Button size="sm" variant="outline" onClick={() => void bulutCevapKaydet(s.id)}>
                          Kaydet
                        </Button>
                        <select
                          value={s.uygulanabilirlik}
                          onChange={(e) => void bulutUygulanabilirlikGuncelle(s.id, e.target.value)}
                          aria-label={`${s.id} uygulanabilirlik`}
                          className="h-7 rounded-md border bg-background px-1 text-xs"
                        >
                          <option value="UNKNOWN">Uygulanabilirlik: bilinmiyor</option>
                          <option value="APPLICABLE">Uygulanabilir</option>
                          <option value="NOT_APPLICABLE">Uygulanamaz</option>
                        </select>
                        <select
                          value={s.kaynak_turu}
                          onChange={(e) => void bulutKaynakTuruGuncelle(s.id, e.target.value as KaynakTuru)}
                          aria-label={`${s.id} kaynak türü`}
                          className="h-7 rounded-md border bg-background px-1 text-xs"
                        >
                          {KAYNAK_TURLERI.map((k) => (
                            <option key={k} value={k}>
                              {KAYNAK_TURU_TR_ETIKET[k]}
                            </option>
                          ))}
                        </select>
                      </div>
                      {s.kaynak_turu === "PROVIDER_ATTESTATION" ? (
                        <span className="text-muted-foreground">Sağlayıcı beyanı — bağımsız doğrulama değil.</span>
                      ) : null}
                      {s.kaynak_citation ? <span className="text-muted-foreground">Künye: {s.kaynak_citation}</span> : null}
                      <StatusBadge durum={sablon?.dogrulama_durumu === "VERIFIED" ? "success" : "warning"}>
                        Soru künyesi: {sablon?.dogrulama_durumu === "VERIFIED" ? "Doğrulandı" : "Doğrulanmadı"}
                      </StatusBadge>
                      {sablon?.dogrulama_durumu === "VERIFIED" && sablon.dogrulama_zamani ? (
                        <span className="text-muted-foreground">
                          {new Date(sablon.dogrulama_zamani).toLocaleString("tr-TR")} tarihinde doğrulandı.
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Güvence profili (Dikey E1): saf motor önizler, mühürleme sealed snapshot yaratır. */}
      <Card>
        <CardHeader>
          <CardTitle>Bulut / tedarikçi güvence profili</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <p className="text-muted-foreground">
            Bu bir kesin uyum kararı değildir — mevcut Cloud Pack yanıtlarının + açık KRİTİK bulguların
            yapısal bir dökümüdür. &quot;Mühürle&quot;, o anki durumun DEĞİŞMEZ bir fotoğrafını
            oluşturur; eski anlık görüntüler asla güncellenmez, yeni bir durum yeni bir anlık görüntü
            ister.
          </p>
          {guvenceYukleniyor ? <p className="text-muted-foreground">Hesaplanıyor…</p> : null}
          {guvenceProfili ? (
            <div className="flex flex-col gap-2">
              <StatusBadge durum={GENEL_DURUM_ETIKET[guvenceProfili.genelDurum]?.semantik ?? "unknown"}>
                {GENEL_DURUM_ETIKET[guvenceProfili.genelDurum]?.etiket ?? guvenceProfili.genelDurum}
              </StatusBadge>
              {guvenceProfili.acikKritikBulgular.length > 0 ? (
                <p className="text-danger">
                  Açık KRİTİK bulgu(lar): {guvenceProfili.acikKritikBulgular.map((b) => b.baslik).join(", ")}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                {CLOUD_PACK_KATEGORILERI.map((k) => {
                  const kat = guvenceProfili.kategoriler.find((c) => c.kategori === k);
                  if (!kat) return null;
                  return (
                    <StatusBadge
                      key={k}
                      durum={kat.durum === "DOGRULANMIS" ? "success" : kat.durum === "UYGULANMAZ" ? "neutral" : kat.durum === "INCELEME_GEREKLI" ? "warning" : "unknown"}
                    >
                      {BULUT_KATEGORI[k]}: {kat.durum}
                    </StatusBadge>
                  );
                })}
              </div>
              {guvenceProfili.engelGerekceleri.length > 0 ? (
                <ul className="list-disc pl-4 text-xs text-muted-foreground">
                  {guvenceProfili.engelGerekceleri.map((e, i) => (
                    <li key={i}>{e.aciklama}</li>
                  ))}
                </ul>
              ) : null}
              {guvenceProfili.kategorisizSoruSayisi > 0 ? (
                <p className="text-muted-foreground">
                  {guvenceProfili.kategorisizSoruSayisi} soru şablon bağlantısı olmadığı için kategorisiz —
                  kaybolmadı, yalnız bir kategoriye uydurulmadı.
                </p>
              ) : null}
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-2 border-t pt-2">
            <Button size="sm" variant="outline" onClick={() => void guvenceOnizle()} disabled={guvenceYukleniyor}>
              Yeniden Önizle
            </Button>
            <Button size="sm" onClick={() => void guvenceMuhurle()} disabled={guvenceYukleniyor}>
              Profili Mühürle (sealed snapshot)
            </Button>
          </div>
          {sonSnapshot ? (
            <div className="flex flex-wrap items-center gap-2 border-t pt-2 text-xs">
              <span className="text-muted-foreground">
                Son mühürlü profil: {sonSnapshot.profil_hash.slice(0, 16)}… ·{" "}
                {new Date(sonSnapshot.created_at).toLocaleString("tr-TR")}
              </span>
              <Button size="sm" variant="outline" onClick={() => void proofLinkiOlustur()}>
                Proof Room Bağlantısı Oluştur
              </Button>
              {proofLinkUrl ? (
                <Link href={proofLinkUrl} className="text-primary underline">
                  {proofLinkUrl}
                </Link>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Dış erişim (tedarikçi portalı, M35 sonraki dilim) */}
      <Card>
        <CardHeader>
          <CardTitle>Dış erişim (tedarikçi portalı)</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <p className="text-muted-foreground">
            Süreli, oturumsuz erişim — tedarikçi hesabı olmadan kendi durumunu/açık bulgularını görür.
            Her görüntüleme denetim izine yazılır.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="dis-email-td">Dış e-posta</Label>
              <Input id="dis-email-td" value={disEmail} onChange={(e) => setDisEmail(e.target.value)} placeholder="tedarikci@firma.com" className="w-64" />
            </div>
            <Button size="sm" onClick={() => void disErisimAc()} disabled={!disEmail.trim()}>
              Erişim Aç
            </Button>
          </div>
          {grantUrl ? (
            <p className="text-xs">
              Erişim linki:{" "}
              <Link href={grantUrl} className="text-primary underline">
                {grantUrl}
              </Link>
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
