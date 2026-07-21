"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge, type SemantikDurum } from "@/components/durum/status-badge";
import {
  sitasyonPaketiOlustur,
  type SitasyonGirdisi,
  type SitasyonPaketi,
} from "@/lib/citation-bundle";
import type { CanonicalDeger } from "@/lib/canonical";
import { makbuzUret, STH_SCHEMA, type AgacBasi, type SeffaflikMakbuzu, type SignedStatement } from "@/lib/transparency";
import type { DetachedImza } from "@/lib/manifest-signature";
import { createClient } from "@/lib/supabase/client";
import { roiSablonCsvYap, roiSablonXlsxYap, ROI_EXPORT_UYARI_METNI } from "@/lib/roi-export-serialize";
import type { RoiSablonPaketi } from "@/lib/roi-export";
import type { EtkiGrafi, TekNoktaTespitSonucu, EtkiYayilimSonucu, DugumTuru } from "@/lib/impact-graph";
import { KAYNAK_TURU_TR_ETIKET, type CloudAssuranceHesaplamaYontemi, type GuvenceProfiliSonucu, type KaynakTuru } from "@/lib/cloud-assurance";
import type { KritikHizmetTestPaketi } from "@/lib/kritik-hizmet-test-paketi";

// Proof Room — OTURUMSUZ denetçi/regülatör görünümü (G1; nihai §8).
//
// paylasim/[token] deseninin devamı: kapsam, süre ve iptal İSTEMCİDE DEĞİL
// veritabanında (proof_room_goruntule RPC) uygulanır; bu sayfa yalnızca
// görüntüleyicidir. Geçersiz/dolmuş/iptal token aynı "geçersiz" ekranını
// görür. Sayfa ayrıca sunucu verisinden sitasyon paketini TARAYICIDA üretir
// ve indirtir — denetçi paketi `npx tsx scripts/verify-sitasyon.ts` ile
// KALKAN_OS'a erişmeden doğrular (paket İMZASIZ_HASH_BUTUNLUKLU'dur; sahte
// "signed" iddiası yok).

interface ProofZincirSatiri {
  obligationKod: string;
  nitelik: string;
  obligationDogrulama: string;
  mappingDogrulama: string;
  kapsam: string;
  provisionRef: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  provisionDogrulama: string;
  snippet: string;
  artifactBaslik: string;
  artifactSha256: string;
  authority: string;
  kaynakAd: string;
  jurisdiction: string;
  kaynakSeviyesi: string;
  canonicalUrl: string | null;
}

interface ProofVerisi {
  kurumAdi: string;
  sonGecerlilik: string;
  kosu?: {
    id: string;
    sonuc: string;
    gerekce: string;
    calistiAt: string;
    tanimAd: string;
    kontrolMaddeRef: string;
    kontrolBaslik: string;
  };
  /** Dikey F, F1: V3 manifest özeti — manifest ALANI (mühürlenmiş, DEĞİŞMEZ). */
  manifestOzeti?: {
    semaSurumu: string;
    kritikHizmetAdi: string | null;
    kritikHizmetIdDogrulanmis: boolean;
    senaryoKimligi: string | null;
    senaryoSurumu: string | null;
    senaryoIdDogrulanmis: boolean;
    beklenenSonuc: string | null;
    performansEtkisi: string | null;
    yanlisPozitif: boolean | null;
    yanlisNegatif: boolean | null;
    hazirlayanBelirtildi: boolean;
    sorumluBelirtildi: boolean;
    bagimsizOnaylayanBelirtildi: boolean;
  } | null;
  /** Dikey F, F1: bu koşu bir retest NİYETİYLE mi çalıştırıldı — manifest ALANI. */
  retestNiyeti?: { findingId: string } | null;
  /** Dikey F, F1: İLİŞKİSEL (manifest DEĞİL) — bu koşudan doğan kabul edilmiş bulgu, varsa. */
  iliskiselBaglantilar?: { kabulEdilmisBulgu: { findingId: string; onem: string; durum: string } | null };
  /** Dikey F, F1: İLİŞKİSEL, TARİHSEL (manifest DEĞİL) — bu koşuyla GERÇEKTEN kapanmış bulgu(lar). */
  kapanisBaglantisi?: { kapananBulgular: { findingId: string; kapaninZamani: string | null }[] };
  legalSnapshot?: { karar: string; snapshot: CanonicalDeger } | null;
  kaynakZinciri?: ProofZincirSatiri[];
  applicability?: {
    obligationKod: string;
    durum: string;
    gerekce: string | null;
    factSnapshotFingerprint: string;
    kararKaynagi: string;
  }[];
  kanit?: { evidenceId: string; dosyaHashSha256: string | null } | null;
  /** G3 şeffaflık defteri durumu (nihai §8.0) — PENDING/ANCHORED/FAILED/KAYITSIZ. */
  ledgerDurumu?: string;
  /** 37 Tez Dikey B, Faz 3: DORA RoI export bağlantısı — kosu ile AYRIK dal. */
  roiExport?: {
    id: string;
    paket: RoiSablonPaketi;
    paketHash: string;
    onKontrolRaporu: { sorunlar: { kod: string; seviye: string; mesaj: string }[]; engelleyiciSayisi: number };
    yayinlanmaZamani: string;
    ledgerDurumu?: string;
    /** 37 Tez Dikey B, Faz 4: alan bazlı, MİNİMİZE provenance özeti — ham iddia/kanıt içeriği YOK. */
    provenanceOzeti?: { alanKodu: string; kaynakDurumu: string; genelDurum: string; iddiaSayisi: number }[] | null;
  };
  /** Dikey D, ilk dilim: kurumsal dayanıklılık etki grafı anlık görüntüsü — kosu/roiExport ile AYRIK dal. */
  graphSnapshot?: {
    id: string;
    graf: EtkiGrafi;
    grafHash: string;
    spofRaporu: TekNoktaTespitSonucu;
    yayilimRaporu: { baslangicKontrolDugumIdleri: string[]; geri: EtkiYayilimSonucu | null; ileri: EtkiYayilimSonucu | null };
    hesaplamaYontemi: { motorSurumu: string; spofYontemi: string; yayilimYontemi: string; varsayimlar: string[] };
    iliskiliRoiExportId: string | null;
    olusturulmaZamani: string;
  };
  /** Dikey E, E1: bulut/tedarikçi güvence profili anlık görüntüsü — diğer üç dalla AYRIK. */
  cloudAssuranceProfile?: {
    id: string;
    profil: GuvenceProfiliSonucu;
    profilHash: string;
    hesaplamaYontemi: CloudAssuranceHesaplamaYontemi;
    iliskiliRoiExportId: string | null;
    olusturulmaZamani: string;
  };
  /** Dikey F, F2: kritik hizmet test paketi — diğer dört dalla AYRIK (BEŞİNCİ hedef). */
  kritikHizmetTestPaketi?: {
    id: string;
    paket: KritikHizmetTestPaketi;
    paketHash: string;
    hesaplamaYontemi: KritikHizmetTestPaketi["hesaplamaYontemi"];
    olusturulmaZamani: string;
  };
}

/** proof_room_ledger_malzeme RPC'sinin ham dönüşü — yalnız ANCHORED iken leaves/signedStatement/sth dolu. */
interface LedgerMalzemesi {
  durum: string;
  leafIndex?: number;
  signedStatement?: SignedStatement;
  sth?: { treeSize: number; rootHash: string };
  sthImza?: DetachedImza;
  leaves?: string[];
}

const SONUC_SEMANTIK: Record<string, SemantikDurum> = {
  PASSED: "success",
  FAILED: "danger",
  UNKNOWN: "unknown",
  STALE: "warning",
  EXCEPTION: "neutral",
};

const KARAR_SEMANTIK: Record<string, SemantikDurum> = {
  ALLOW: "success",
  ALLOW_WITH_WARNING: "warning",
  BLOCK: "danger",
};

const DOGRULAMA_ETIKET: Record<string, string> = {
  DRAFT_RESEARCH: "Araştırma taslağı",
  TODO_DOGRULA: "Doğrulanmadı",
  LEGAL_REVIEW: "Hukuk incelemesinde",
  VERIFIED: "Doğrulandı",
  SUPERSEDED: "Yerini yeni sürüm aldı",
  REJECTED: "Reddedildi",
};

const LEDGER_DURUM_SEMANTIK: Record<string, SemantikDurum> = {
  ANCHORED: "success",
  PENDING: "warning",
  DEFTERDE_STH_BEKLIYOR: "warning",
  FAILED: "danger",
  KAYITSIZ: "unknown",
};
const LEDGER_DURUM_ETIKET: Record<string, string> = {
  ANCHORED: "Şeffaflık defterinde mühürlü",
  PENDING: "Mühür bekleniyor (PENDING)",
  DEFTERDE_STH_BEKLIYOR: "Defterde — ağaç başı bekleniyor",
  FAILED: "Mühürleme başarısız",
  KAYITSIZ: "Bu koşu deftere bağlı değil",
};

// 37 Tez Dikey B, Faz 4: roiExport.provenanceOzeti'nin genelDurum alanı için.
const PROVENANCE_ROZET: Record<string, SemantikDurum> = {
  VERIFIED: "success",
  LEGAL_REVIEW_REQUIRED: "legal-review",
  UNVERIFIED: "neutral",
  SURESI_GECMIS_INCELEME_GEREKLI: "warning",
  REDDEDILDI: "danger",
  KAYNAK_YOK: "unknown",
};
const DUGUM_TUR_ETIKET: Record<DugumTuru, string> = {
  KRITIK_HIZMET: "Kritik hizmet",
  BAGIMLILIK: "Bağımlılık",
  UCUNCU_TARAF: "Üçüncü taraf",
  ALT_YUKLENICI: "Alt yüklenici",
  ICT_HIZMETI: "ICT hizmeti",
  KONTROL: "Kontrol",
  MEVZUAT: "Mevzuat",
  TEST: "Test",
  BULGU: "Bulgu",
  KANIT: "Kanıt",
  TEDARIKCI_BULGUSU: "Tedarikçi bulgusu",
};

// Dikey E1: 11 bulut alanı — tedarikciler/page.tsx'teki BULUT_KATEGORI ile
// AYNI etiketler (route grubu ayrı, küçük etiket haritası kasıtlı yinelenir —
// DUGUM_TUR_ETIKET'in bu sayfada zaten kurulu deseni).
const BULUT_KATEGORI: Record<string, string> = {
  BULUT_ENVANTERI: "Bulut envanteri",
  SHARED_RESPONSIBILITY: "Shared responsibility",
  SLA_GUVENLIK: "SLA / güvenlik",
  DORDUNCU_TARAF: "Dördüncü taraf",
  VERI_LOKASYON: "Veri lokasyonu",
  IAM_LOG: "IAM / merkezi log",
  OLAY_BILDIRIM: "Olay bildirim süresi",
  YEDEKLEME_KURTARMA: "Yedekleme / kurtarma",
  VERI_IMHA: "Güvenli imha",
  CIKIS_PLANI: "Çıkış / ikame",
  DDOS_KAPASITE: "DDoS / kapasite",
};
const GENEL_GUVENCE_DURUM_ETIKET: Record<string, { etiket: string; semantik: SemantikDurum }> = {
  DOGRULANMIS_PROFIL: { etiket: "Doğrulanmış profil", semantik: "success" },
  INCELEME_GEREKLI: { etiket: "İnceleme gerekli", semantik: "warning" },
  EKSIK: { etiket: "Eksik — henüz değerlendirilemiyor", semantik: "unknown" },
  ENGELLENDI: { etiket: "Kritik bulgu nedeniyle engellendi", semantik: "danger" },
  // Dikey E, E2, Kapı 2: bulgu AÇIK kalır — "çözüldü"/"uygun" DEĞİL, yalnız
  // doğrulanmış telafi edici kontrolle yönetildiğini bildirir.
  KRITIK_BULGU_TELAFI_ALTINDA: { etiket: "Kritik bulgu açık — telafi edici kontrol altında", semantik: "warning" },
};
// Dikey F, F2: kritik-hizmetler/[id]/page.tsx'teki GENEL_DURUM_ETIKET ile AYNI
// etiketler (kasıtlı yineleme — bu sayfanın kendi deseni, kesin "tamamen
// dayanıklıdır" iddiası ÜRETİLMEZ).
const KRITIK_HIZMET_GENEL_DURUM_ETIKET: Record<string, { etiket: string; semantik: SemantikDurum }> = {
  DOGRULANMIS: { etiket: "Doğrulanmış güncel test görünümü", semantik: "success" },
  INCELEME_GEREKLI: { etiket: "İnceleme gerekli", semantik: "warning" },
  ENGELLENDI: { etiket: "Başarısız test nedeniyle engellendi", semantik: "danger" },
  VERI_EKSIK: { etiket: "Güncel test bulunamadı", semantik: "unknown" },
  TEST_YOK: { etiket: "Kapsamda test tanımı yok", semantik: "neutral" },
};
// Dikey F, F3: onaylı etki toleransının VARLIĞI — "RTO/RPO karşılandı" ASLA üretilmez.
const ETKI_TOLERANSI_PROOF_ETIKET: Record<string, { etiket: string; semantik: SemantikDurum }> = {
  TOLERANS_TANIMLI_VE_ONAYLI: { etiket: "Onaylı etki toleransı mevcut", semantik: "success" },
  TOLERANS_TANIMLI_FAKAT_ONAYSIZ: { etiket: "Etki toleransı onay bekliyor", semantik: "warning" },
  TOLERANS_BULUNAMADI: { etiket: "Etki toleransı tanımlanmamış", semantik: "neutral" },
  TOLERANS_VERISI_EKSIK: { etiket: "Etki toleransı verisi eksik", semantik: "unknown" },
  BIRDEN_FAZLA_AKTIF_TOLERANS: { etiket: "Birden fazla yürürlükte tolerans kaydı bulundu", semantik: "warning" },
};
const KATEGORI_DURUM_SEMANTIK: Record<string, SemantikDurum> = {
  DOGRULANMIS: "success",
  UYGULANMAZ: "neutral",
  INCELEME_GEREKLI: "warning",
  CEVAPSIZ: "unknown",
};

const PROVENANCE_ETIKET: Record<string, string> = {
  VERIFIED: "Doğrulanmış",
  LEGAL_REVIEW_REQUIRED: "Hukuki inceleme gerekli",
  UNVERIFIED: "Doğrulanmamış",
  SURESI_GECMIS_INCELEME_GEREKLI: "Süresi geçmiş",
  REDDEDILDI: "Reddedilmiş",
  KAYNAK_YOK: "Kaynak yok",
};

export default function ProofRoomPage() {
  const params = useParams<{ token: string }>();
  const [veri, setVeri] = useState<ProofVerisi | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [paket, setPaket] = useState<SitasyonPaketi | null>(null);
  const [ledgerMalzeme, setLedgerMalzeme] = useState<LedgerMalzemesi | null>(null);
  const [makbuz, setMakbuz] = useState<SeffaflikMakbuzu | null>(null);

  useEffect(() => {
    let iptal = false;
    const yukle = async () => {
      const db = createClient();
      const [{ data }, { data: malzeme }] = await Promise.all([
        db.rpc("proof_room_goruntule", { p_token: params.token }),
        db.rpc("proof_room_ledger_malzeme", { p_token: params.token }),
      ]);
      if (iptal) return;
      setVeri((data as unknown as ProofVerisi | null) ?? null);
      setLedgerMalzeme((malzeme as unknown as LedgerMalzemesi | null) ?? null);
      setYukleniyor(false);
    };
    void yukle();
    return () => {
      iptal = true;
    };
  }, [params.token]);

  // ANCHORED ise makbuzu TARAYICIDA kur (transparency.ts makbuzUret,
  // G3'ten YENİDEN KULLANILIR — Merkle proof burada yeniden yazılmaz).
  useEffect(() => {
    if (!ledgerMalzeme || ledgerMalzeme.durum !== "ANCHORED") return;
    if (!ledgerMalzeme.leaves || ledgerMalzeme.leafIndex === undefined || !ledgerMalzeme.sth || !ledgerMalzeme.sthImza || !ledgerMalzeme.signedStatement) return;
    let iptal = false;
    const kur = async () => {
      const sth: AgacBasi = { schema: STH_SCHEMA, treeSize: ledgerMalzeme.sth!.treeSize, rootHash: ledgerMalzeme.sth!.rootHash };
      const m = await makbuzUret(
        ledgerMalzeme.leaves!,
        ledgerMalzeme.leafIndex!,
        sth,
        ledgerMalzeme.sthImza!,
        ledgerMalzeme.signedStatement!,
      );
      if (!iptal) setMakbuz(m);
    };
    void kur();
    return () => {
      iptal = true;
    };
  }, [ledgerMalzeme]);

  const makbuzIndirmeUrl = useMemo(() => {
    if (!makbuz) return null;
    return URL.createObjectURL(new Blob([JSON.stringify(makbuz, null, 2)], { type: "application/json" }));
  }, [makbuz]);

  // Sitasyon paketi tarayıcıda, sunucudan gelen veriyle üretilir (RFC 8785
  // hash'leri dahil) — indirme sonrası bağımsız CLI doğrulaması için.
  useEffect(() => {
    if (!veri || veri.roiExport || !veri.kosu) return;
    let iptal = false;
    const uret = async () => {
      const girdi: SitasyonGirdisi = {
        testRun: veri.kosu!,
        legalSnapshot: veri.legalSnapshot ?? null,
        kaynakZinciri: (veri.kaynakZinciri ?? []).map((z) => ({
          authority: z.authority,
          kaynakAd: z.kaynakAd,
          jurisdiction: z.jurisdiction,
          kaynakSeviyesi: z.kaynakSeviyesi,
          canonicalUrl: z.canonicalUrl,
          artifactBaslik: z.artifactBaslik,
          artifactSha256: z.artifactSha256,
          provisionRef: z.provisionRef,
          effectiveFrom: z.effectiveFrom,
          effectiveTo: z.effectiveTo,
          provisionDogrulama: z.provisionDogrulama,
          snippet: z.snippet,
          obligationKod: z.obligationKod,
          obligationDogrulama: z.obligationDogrulama,
          mappingDogrulama: z.mappingDogrulama,
          kapsam: z.kapsam,
        })),
        applicability: (veri.applicability ?? []).map((a) => ({
          obligationKod: a.obligationKod,
          durum: a.durum,
          gerekce: a.gerekce,
          factSnapshotFingerprint: a.factSnapshotFingerprint,
          kararKaynagi: a.kararKaynagi,
        })),
        kanit: veri.kanit ?? null,
        auditOlaylari: [],
        aktor: { id: "proof-room", ad: null },
        olusturmaZamani: new Date().toISOString(),
      };
      const p = await sitasyonPaketiOlustur(girdi);
      if (!iptal) setPaket(p);
    };
    void uret();
    return () => {
      iptal = true;
    };
  }, [veri]);

  const indirmeUrl = useMemo(() => {
    if (!paket) return null;
    return URL.createObjectURL(new Blob([JSON.stringify(paket, null, 2)], { type: "application/json" }));
  }, [paket]);

  // DORA RoI export dalı: CSV/XLSX TARAYICIDA, sunucudan gelen paketten
  // üretilir (roi-export-serialize.ts — sitasyon paketinin AYNI deseni).
  // CSV senkron olduğundan useMemo (indirmeUrl'in aynı deseni); XLSX async
  // olduğundan (jszip) useEffect + state gerekiyor.
  const roiCsvUrl = useMemo(() => {
    if (!veri?.roiExport) return null;
    const csv = roiSablonCsvYap(veri.roiExport.paket);
    return URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  }, [veri]);
  const [roiXlsxUrl, setRoiXlsxUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!veri?.roiExport) return;
    let iptal = false;
    const uret = async () => {
      const bayt = await roiSablonXlsxYap(veri.roiExport!.paket);
      if (!iptal) {
        const arabellek = bayt.buffer.slice(bayt.byteOffset, bayt.byteOffset + bayt.byteLength) as ArrayBuffer;
        setRoiXlsxUrl(URL.createObjectURL(new Blob([arabellek], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })));
      }
    };
    void uret();
    return () => {
      iptal = true;
    };
  }, [veri]);

  if (yukleniyor) {
    return <main className="mx-auto max-w-4xl p-6 text-sm text-muted-foreground">Yükleniyor…</main>;
  }
  if (!veri) {
    // Geçersiz/dolmuş/iptal — hepsi AYNI mesaj (ayrım bilgi sızdırır).
    return (
      <main className="mx-auto max-w-4xl p-6">
        <h1 className="text-xl font-semibold">Proof Room</h1>
        <p className="mt-2 text-sm text-muted-foreground">Link geçersiz veya süresi dolmuş.</p>
      </main>
    );
  }

  if (veri.kritikHizmetTestPaketi) {
    const { kritikHizmetTestPaketi } = veri;
    const { paket } = kritikHizmetTestPaketi;
    const durumEtiket = KRITIK_HIZMET_GENEL_DURUM_ETIKET[paket.genelDurum] ?? { etiket: paket.genelDurum, semantik: "unknown" as SemantikDurum };
    return (
      <main className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Proof Room — {veri.kurumAdi}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Kritik Hizmet Test Paketi. Erişim süresi: {new Date(veri.sonGecerlilik).toLocaleString("tr-TR")} · Bu görüntüleme denetim
            izine kaydedildi.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>{paket.criticalService.ad}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <p role="note" className="text-xs text-muted-foreground">
              Bu bir kesin uyum kararı değildir — mevcut test sonuçlarının yapısal bir dökümüdür. Mühürlendiği andan
              sonra bu görünüm asla değişmez; güncel durum için yeni bir paket gerekir.
            </p>
            <StatusBadge durum={durumEtiket.semantik}>{durumEtiket.etiket}</StatusBadge>
            <p>Mühürlenme zamanı: {new Date(kritikHizmetTestPaketi.olusturulmaZamani).toLocaleString("tr-TR")}</p>
            <p className="text-xs text-muted-foreground" title={kritikHizmetTestPaketi.paketHash}>
              Paket hash&apos;i (SHA-256): {kritikHizmetTestPaketi.paketHash}
            </p>
            <p className="text-xs text-muted-foreground">Şema sürümü: {paket.schema}</p>
            <p className="text-xs text-muted-foreground">
              {paket.kapsam.testTanimiSayisi} test tanımı · {paket.kapsam.kontrolSayisi} kontrol · {paket.kapsam.dogrudanBagliSayisi} doğrudan ·{" "}
              {paket.kapsam.kontrolUzerindenBagliSayisi} kontrol üzerinden bağlı
            </p>
            {paket.gerekceler.length > 0 ? (
              <ul className="list-inside list-disc text-xs text-muted-foreground">
                {paket.gerekceler.map((g, i) => (
                  <li key={i}>{g}</li>
                ))}
              </ul>
            ) : null}
          </CardContent>
        </Card>

        {/* Dikey F, F3: Etki Toleransı — mühürlü paketin İÇİNDEKİ minimize özet. V1 snapshot'ta bu alan YOKtur. */}
        <Card>
          <CardHeader>
            <CardTitle>Etki Toleransı</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {paket.etkiToleransiOzeti ? (
              <>
                <StatusBadge durum={ETKI_TOLERANSI_PROOF_ETIKET[paket.etkiToleransiOzeti.durum]?.semantik ?? "unknown"}>
                  {ETKI_TOLERANSI_PROOF_ETIKET[paket.etkiToleransiOzeti.durum]?.etiket ?? paket.etkiToleransiOzeti.durum}
                </StatusBadge>
                {paket.etkiToleransiOzeti.durum === "TOLERANS_TANIMLI_VE_ONAYLI" ||
                paket.etkiToleransiOzeti.durum === "TOLERANS_TANIMLI_FAKAT_ONAYSIZ" ? (
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <dt>Azami kesinti süresi (RTO)</dt>
                    <dd>{paket.etkiToleransiOzeti.maxKesintiSaat === null ? "Tanımlanmamış" : `${paket.etkiToleransiOzeti.maxKesintiSaat} saat`}</dd>
                    <dt>Azami veri kaybı (RPO)</dt>
                    <dd>{paket.etkiToleransiOzeti.maxVeriKaybiSaat === null ? "Tanımlanmamış" : `${paket.etkiToleransiOzeti.maxVeriKaybiSaat} saat`}</dd>
                    <dt>Sürüm</dt>
                    <dd>{paket.etkiToleransiOzeti.version ?? "—"}</dd>
                    <dt>Onay durumu</dt>
                    <dd>{paket.etkiToleransiOzeti.onayDurumu ?? "—"}</dd>
                  </dl>
                ) : null}
                <p role="note" className="text-xs text-muted-foreground">
                  Bu değerler kurumun onaylı hedeflerini gösterir. Test koşularında yapılandırılmış gerçek kesinti ve veri kaybı ölçümü
                  bulunmadığından hedeflerle nicel karşılaştırma yapılmamıştır.
                </p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">Bu snapshot sürümünde etki toleransı bilgisi bulunmamaktadır.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Test tanımları ({paket.testler.length})</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            {paket.testler.length === 0 ? (
              <p className="text-muted-foreground">Kapsamda test tanımı yok.</p>
            ) : (
              paket.testler.map((t) => (
                <div key={t.testDefinitionId} className="flex flex-col gap-1.5 border-b pb-3 last:border-0 last:pb-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{t.ad}</span>
                    <StatusBadge durum="neutral">
                      {t.bagTuru === "DIRECT" ? "Doğrudan bağlı" : t.bagTuru === "BOTH" ? "Doğrudan + kontrol üzerinden" : "Kontrol üzerinden bağlı"}
                    </StatusBadge>
                  </div>
                  {t.enGuncelKosu ? (
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <StatusBadge durum={t.enGuncelKosu.sonuc === "PASSED" ? "success" : t.enGuncelKosu.sonuc === "FAILED" ? "danger" : "unknown"}>
                        {t.enGuncelKosu.sonuc}
                      </StatusBadge>
                      {t.enGuncelKosu.tazelikDurumu === "BAYAT" ? <StatusBadge durum="warning">Test sonucu süresi dolmuş</StatusBadge> : null}
                      <span className="text-muted-foreground">{new Date(t.enGuncelKosu.calistiAt).toLocaleString("tr-TR")}</span>
                    </div>
                  ) : (
                    <StatusBadge durum="unknown">Güncel test bulunamadı</StatusBadge>
                  )}
                  {t.bulguOzeti.acikBulguIdleri.length > 0 ? (
                    <StatusBadge durum="warning">Açık bulgu mevcut ({t.bulguOzeti.acikBulguIdleri.length})</StatusBadge>
                  ) : null}
                  {t.bulguOzeti.kapanisRetestRunIdleri.length > 0 ? (
                    <StatusBadge durum="success">Kapanış retest&apos;i doğrulandı</StatusBadge>
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    Tarihsel sonuç özeti: {t.tarihselOzet.toplamKosu} koşu (PASSED {t.tarihselOzet.sonucDagilimi.PASSED} · FAILED{" "}
                    {t.tarihselOzet.sonucDagilimi.FAILED} · UNKNOWN {t.tarihselOzet.sonucDagilimi.UNKNOWN} · STALE {t.tarihselOzet.sonucDagilimi.STALE} ·
                    EXCEPTION {t.tarihselOzet.sonucDagilimi.EXCEPTION})
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Hesaplama yöntemi</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-xs text-muted-foreground">
            <p>{paket.hesaplamaYontemi.kapsamCozumleme}</p>
            <p>{paket.hesaplamaYontemi.guncelKosuSecimi}</p>
            <p>{paket.hesaplamaYontemi.worstOfKurali}</p>
            <p>{paket.hesaplamaYontemi.tarihselIzKurali}</p>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (veri.cloudAssuranceProfile) {
    const { cloudAssuranceProfile } = veri;
    const { profil } = cloudAssuranceProfile;
    const durumEtiket = GENEL_GUVENCE_DURUM_ETIKET[profil.genelDurum] ?? { etiket: profil.genelDurum, semantik: "unknown" as SemantikDurum };
    return (
      <main className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Proof Room — {veri.kurumAdi}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Bulut / tedarikçi güvence profili anlık görüntüsü. Erişim süresi: {new Date(veri.sonGecerlilik).toLocaleString("tr-TR")} · Bu
            görüntüleme denetim izine kaydedildi.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Profil özeti</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <p role="note" className="text-xs text-muted-foreground">
              Bu bir kesin uyum kararı değildir — mevcut yanıtların ve açık kritik bulguların yapısal
              bir dökümüdür. Mühürlendiği andan sonra bu görünüm asla değişmez; güncel durum için yeni
              bir anlık görüntü gerekir.
            </p>
            <StatusBadge durum={durumEtiket.semantik}>{durumEtiket.etiket}</StatusBadge>
            <p>Oluşturulma zamanı: {new Date(cloudAssuranceProfile.olusturulmaZamani).toLocaleString("tr-TR")}</p>
            <p className="text-xs text-muted-foreground" title={cloudAssuranceProfile.profilHash}>
              Profil hash&apos;i (SHA-256): {cloudAssuranceProfile.profilHash}
            </p>
            <p className="text-xs text-muted-foreground">Şema sürümü: {profil.semaSurumu}</p>
            {cloudAssuranceProfile.iliskiliRoiExportId ? (
              <p className="text-xs text-muted-foreground">İlişkili DORA RoI export: {cloudAssuranceProfile.iliskiliRoiExportId}</p>
            ) : null}
            {profil.acikKritikBulgular.length > 0 ? (
              <div>
                <p className="text-xs font-medium text-muted-foreground">Açık KRİTİK bulgu(lar):</p>
                <ul className="list-inside list-disc text-xs">
                  {profil.acikKritikBulgular.map((b) => {
                    const ozet = profil.telafiOzetleri?.find((o) => o.bulguId === b.id);
                    return (
                      <li key={b.id}>
                        {b.baslik}
                        {ozet ? (
                          <span className="block text-muted-foreground">
                            Bulgu AÇIK kalmaktadır; doğrulanmış telafi edici kontrol ({ozet.controlMaddeRef ?? "kontrol"}, geçerlilik bitişi{" "}
                            {ozet.validUntil}) nedeniyle belirli süreyle yönetilmektedir. Bu, bulgunun kapandığı veya kök nedenin ortadan
                            kalktığı anlamına gelmez.
                          </span>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Kategori durumları ({profil.kategoriler.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {profil.kategoriler.length === 0 ? (
              <p className="text-sm text-muted-foreground">Bu profilde hiç Cloud Pack kategorisi yok.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {profil.kategoriler.map((k) => (
                  <StatusBadge key={k.kategori} durum={KATEGORI_DURUM_SEMANTIK[k.durum] ?? "unknown"}>
                    {BULUT_KATEGORI[k.kategori] ?? k.kategori}: {k.durum}
                  </StatusBadge>
                ))}
              </div>
            )}
            {profil.kategorisizSoruSayisi > 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">
                {profil.kategorisizSoruSayisi} soru şablon bağlantısı olmadığı için kategorisiz — kaybolmadı, yalnız
                bir kategoriye uydurulmadı.
              </p>
            ) : null}
            <p className="mt-2 text-xs text-muted-foreground">
              Genel kaynak türü dağılımı:{" "}
              {Object.entries(profil.kaynakTuruDagilimi)
                .map(([k, n]) => `${KAYNAK_TURU_TR_ETIKET[k as KaynakTuru] ?? k} (${n})`)
                .join(", ") || "—"}
            </p>
          </CardContent>
        </Card>

        {profil.engelGerekceleri.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Engel/uyarı gerekçeleri ({profil.engelGerekceleri.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-inside list-disc text-sm">
                {profil.engelGerekceleri.map((e, i) => (
                  <li key={i}>
                    {e.kategori ? `${BULUT_KATEGORI[e.kategori] ?? e.kategori} — ` : ""}
                    {e.aciklama}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Hesaplama yöntemi</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-xs text-muted-foreground">
            <p>Şema: {cloudAssuranceProfile.hesaplamaYontemi.sema}</p>
            <p>{cloudAssuranceProfile.hesaplamaYontemi.worstOfKurali}</p>
            <p>{cloudAssuranceProfile.hesaplamaYontemi.acikBulguKurali}</p>
            <p>{cloudAssuranceProfile.hesaplamaYontemi.kaynakTuruYaklasimi}</p>
            <p>{cloudAssuranceProfile.hesaplamaYontemi.bagimsizDogrulamaYaklasimi}</p>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (veri.graphSnapshot) {
    const { graphSnapshot } = veri;
    return (
      <main className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Proof Room — {veri.kurumAdi}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Dayanıklılık etki grafı anlık görüntüsü. Erişim süresi: {new Date(veri.sonGecerlilik).toLocaleString("tr-TR")} · Bu görüntüleme
            denetim izine kaydedildi.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Anlık görüntü özeti</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <p>Oluşturulma zamanı: {new Date(graphSnapshot.olusturulmaZamani).toLocaleString("tr-TR")}</p>
            <p className="text-xs text-muted-foreground" title={graphSnapshot.grafHash}>
              Graf hash&apos;i (SHA-256): {graphSnapshot.grafHash}
            </p>
            <p className="text-xs text-muted-foreground">
              Düğüm sayısı: {graphSnapshot.graf.dugumler.length} · Kenar sayısı: {graphSnapshot.graf.kenarlar.length}
            </p>
            {graphSnapshot.iliskiliRoiExportId ? (
              <p className="text-xs text-muted-foreground">İlişkili DORA RoI export: {graphSnapshot.iliskiliRoiExportId}</p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Hesaplama yöntemi ve varsayımlar</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-xs text-muted-foreground">
            <p role="note">
              Bu sayfadaki bulgular yapısal bir hesaplamanın sonucudur, kesin/doğrulanmış bir gerçek DEĞİLDİR — aşağıdaki yöntem ve
              varsayımlarla birlikte okunmalıdır.
            </p>
            <p>Motor sürümü: {graphSnapshot.hesaplamaYontemi.motorSurumu}</p>
            <p>{graphSnapshot.hesaplamaYontemi.spofYontemi}</p>
            <p>{graphSnapshot.hesaplamaYontemi.yayilimYontemi}</p>
            <ul className="list-inside list-disc">
              {graphSnapshot.hesaplamaYontemi.varsayimlar.map((v, i) => (
                <li key={i}>{v}</li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sistemik tekil noktalar ({graphSnapshot.spofRaporu.sistemikNoktalar.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {graphSnapshot.spofRaporu.sistemikNoktalar.length === 0 ? (
              <p className="text-sm text-muted-foreground">Grafta paylaşılan (≥2 kritik hizmeti etkileyen) düğüm bulunamadı.</p>
            ) : (
              <div className="flex flex-col gap-2 text-sm">
                {graphSnapshot.spofRaporu.sistemikNoktalar.map((s) => (
                  <div key={s.dugumId} className="flex flex-wrap items-center gap-2 border-b pb-2 last:border-0">
                    <StatusBadge durum="warning">{DUGUM_TUR_ETIKET[s.tur]}</StatusBadge>
                    <span>{s.etiket}</span>
                    <span className="text-xs text-muted-foreground">{s.etkilenenKritikHizmetIdleri.length} kritik hizmeti etkiliyor</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {graphSnapshot.yayilimRaporu.baslangicKontrolDugumIdleri.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Açık kritik/yüksek bulgulu kontrollerin etki yayılımı</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Bu kontroller bozulursa etkilenecek düğümler (yukarı yönde):</p>
                {graphSnapshot.yayilimRaporu.geri?.etkilenenler.length ? (
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {graphSnapshot.yayilimRaporu.geri.etkilenenler.map((e) => (
                      <StatusBadge key={e.dugumId} durum="danger">
                        {DUGUM_TUR_ETIKET[e.tur]}: {e.etiket}
                      </StatusBadge>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Yukarı yönde etkilenen düğüm bulunamadı.</p>
                )}
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Kanıt/test zinciri (aşağı yönde):</p>
                {graphSnapshot.yayilimRaporu.ileri?.etkilenenler.length ? (
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {graphSnapshot.yayilimRaporu.ileri.etkilenenler.map((e) => (
                      <StatusBadge key={e.dugumId} durum="info">
                        {DUGUM_TUR_ETIKET[e.tur]}: {e.etiket}
                      </StatusBadge>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Aşağı yönde bağlı düğüm bulunamadı.</p>
                )}
              </div>
            </CardContent>
          </Card>
        ) : null}
      </main>
    );
  }

  if (veri.roiExport) {
    const { roiExport } = veri;
    return (
      <main className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Proof Room — {veri.kurumAdi}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            DORA RoI export görünümü. Erişim süresi: {new Date(veri.sonGecerlilik).toLocaleString("tr-TR")} · Bu
            görüntüleme denetim izine kaydedildi.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Export özeti</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <p className="text-xs text-muted-foreground">{ROI_EXPORT_UYARI_METNI}</p>
            <p>
              Yayınlanma zamanı: {new Date(roiExport.yayinlanmaZamani).toLocaleString("tr-TR")}
            </p>
            <p className="text-xs text-muted-foreground" title={roiExport.paketHash}>
              Snapshot hash&apos;i (SHA-256): {roiExport.paketHash}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {roiExport.onKontrolRaporu.sorunlar.length === 0 ? (
                <StatusBadge durum="success">Ön-kontrol: sorun yok</StatusBadge>
              ) : (
                roiExport.onKontrolRaporu.sorunlar.map((s, i) => (
                  <StatusBadge key={`${s.kod}-${i}`} durum={s.seviye === "blok" ? "danger" : "warning"}>
                    {s.mesaj}
                  </StatusBadge>
                ))
              )}
              <StatusBadge durum={LEDGER_DURUM_SEMANTIK[roiExport.ledgerDurumu ?? "KAYITSIZ"] ?? "unknown"}>
                {LEDGER_DURUM_ETIKET[roiExport.ledgerDurumu ?? "KAYITSIZ"] ?? roiExport.ledgerDurumu}
              </StatusBadge>
            </div>
            {roiExport.provenanceOzeti && roiExport.provenanceOzeti.length > 0 ? (
              <div className="mt-2 flex flex-col gap-1.5">
                <p className="text-xs font-medium text-muted-foreground">
                  Alan bazlı kanıt zinciri (yalnız durum özeti — kaynak/iddia gerekçe metni gösterilmez):
                </p>
                <div className="flex flex-wrap items-center gap-1.5">
                  {roiExport.provenanceOzeti.map((s, i) => (
                    <StatusBadge key={`${s.alanKodu}-${i}`} durum={PROVENANCE_ROZET[s.genelDurum] ?? "unknown"}>
                      {s.alanKodu}: {PROVENANCE_ETIKET[s.genelDurum] ?? s.genelDurum} ({s.iddiaSayisi} iddia)
                    </StatusBadge>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {roiCsvUrl ? (
                <a href={roiCsvUrl} download={`kalkan-dora-roi-${roiExport.id}.csv`} className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                  CSV indir
                </a>
              ) : null}
              {roiXlsxUrl ? (
                <a href={roiXlsxUrl} download={`kalkan-dora-roi-${roiExport.id}.xlsx`} className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                  XLSX indir
                </a>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!veri.kosu) {
    // RPC ya roiExport ya kosu döner (yukarıda ele alındı) — ikisi de yoksa gösterilecek bir şey yok.
    return (
      <main className="mx-auto max-w-4xl p-6">
        <h1 className="text-xl font-semibold">Proof Room</h1>
        <p className="mt-2 text-sm text-muted-foreground">Link geçersiz veya süresi dolmuş.</p>
      </main>
    );
  }

  const kosu = veri.kosu;
  const kaynakZinciri = veri.kaynakZinciri ?? [];
  const applicability = veri.applicability ?? [];
  const ledgerDurumu = veri.ledgerDurumu ?? "KAYITSIZ";

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Proof Room — {veri.kurumAdi}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Salt-okur kanıt görünümü. Erişim süresi:{" "}
          {new Date(veri.sonGecerlilik).toLocaleString("tr-TR")} · Bu görüntüleme denetim izine
          kaydedildi.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Kontrol testi koşusu</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <p>
            <strong>{kosu.kontrolMaddeRef}</strong> — {kosu.kontrolBaslik} ·{" "}
            {kosu.tanimAd}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge durum={SONUC_SEMANTIK[kosu.sonuc] ?? "neutral"}>
              Sonuç: {kosu.sonuc}
            </StatusBadge>
            {veri.legalSnapshot ? (
              <StatusBadge durum={KARAR_SEMANTIK[veri.legalSnapshot.karar] ?? "neutral"}>
                Yasal dayanak: {veri.legalSnapshot.karar}
              </StatusBadge>
            ) : (
              <StatusBadge durum="unknown">Dayanak fotoğrafı yok (eski koşu)</StatusBadge>
            )}
            <StatusBadge durum={LEDGER_DURUM_SEMANTIK[ledgerDurumu] ?? "neutral"}>
              {LEDGER_DURUM_ETIKET[ledgerDurumu] ?? ledgerDurumu}
            </StatusBadge>
          </div>
          <p className="text-muted-foreground">{kosu.gerekce}</p>
          <p className="text-xs text-muted-foreground">
            Koşu zamanı: {new Date(kosu.calistiAt).toLocaleString("tr-TR")}
            {veri.kanit ? ` · Kanıt dosya hash'i: ${veri.kanit.dosyaHashSha256 ?? "—"}` : ""}
          </p>
        </CardContent>
      </Card>

      {veri.manifestOzeti ? (
        <Card>
          <CardHeader>
            <CardTitle>Kritik hizmet, senaryo ve bulgu/retest zinciri</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <p role="note" className="text-xs text-muted-foreground">
              Aşağıdaki üç grup FARKLI kaynaklardan gelir ve karıştırılmaz: manifest alanları (bu koşu
              mühürlendiği anda sabitlendi, hiçbir zaman değişmez), ilişkisel bağlantılar (canlı sorgu,
              manifestin İÇİNDE değil) ve tarihsel kapanış bağlantısı.
            </p>
            <div className="flex flex-wrap gap-2">
              {veri.manifestOzeti.kritikHizmetIdDogrulanmis ? (
                <StatusBadge durum="info">Kritik hizmete bağlı</StatusBadge>
              ) : veri.manifestOzeti.kritikHizmetAdi ? (
                <StatusBadge durum="warning">Serbest metin kapsamı: {veri.manifestOzeti.kritikHizmetAdi}</StatusBadge>
              ) : null}
              {veri.manifestOzeti.senaryoIdDogrulanmis ? (
                <StatusBadge durum="info">Senaryo şablonuna bağlı</StatusBadge>
              ) : veri.manifestOzeti.senaryoKimligi ? (
                <StatusBadge durum="warning">Doğrulanmamış senaryo kimliği: {veri.manifestOzeti.senaryoKimligi}</StatusBadge>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">Manifest şeması: {veri.manifestOzeti.semaSurumu}</p>
            {veri.retestNiyeti ? (
              <p className="text-xs text-muted-foreground">
                Bu koşu, bir bulguyu kapatma NİYETİYLE (retest) çalıştırıldı — manifeste koşu anında yazılan alan.
              </p>
            ) : null}
            {veri.iliskiselBaglantilar?.kabulEdilmisBulgu ? (
              <p className="text-xs text-muted-foreground">
                Bu koşudan İLİŞKİSEL olarak doğan kabul edilmiş bulgu var (önem: {veri.iliskiselBaglantilar.kabulEdilmisBulgu.onem},
                durum: {veri.iliskiselBaglantilar.kabulEdilmisBulgu.durum}) — bu bağlantı canlı sorgudur, manifestin bir alanı değildir.
              </p>
            ) : null}
            {veri.kapanisBaglantisi && veri.kapanisBaglantisi.kapananBulgular.length > 0 ? (
              <p className="text-xs text-muted-foreground">
                Bu koşu, {veri.kapanisBaglantisi.kapananBulgular.length} bulguyu TARİHSEL olarak kapatmıştır (bağımsız onayla) —
                bu da manifestin değil, bulgunun kendi kapanış kaydının bir yansımasıdır.
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Kaynak zinciri ({kaynakZinciri.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {kaynakZinciri.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Bu kontrol için yasal dayanak eşlemesi yok — koşu dayanak iddiası taşımıyor.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kaynak</TableHead>
                    <TableHead>Hüküm</TableHead>
                    <TableHead>Yükümlülük</TableHead>
                    <TableHead>Doğrulama</TableHead>
                    <TableHead>Artifact SHA-256</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {kaynakZinciri.map((z) => (
                    <TableRow key={`${z.obligationKod}-${z.provisionRef}`}>
                      <TableCell className="text-xs">
                        {z.authority} · {z.kaynakAd} ({z.kaynakSeviyesi})
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{z.provisionRef}</span>
                        <p className="max-w-xs text-xs text-muted-foreground">{z.snippet}</p>
                      </TableCell>
                      <TableCell className="text-sm">
                        {z.obligationKod} ({z.nitelik})
                      </TableCell>
                      <TableCell>
                        <StatusBadge
                          durum={z.obligationDogrulama === "VERIFIED" && z.mappingDogrulama === "VERIFIED" ? "success" : "warning"}
                        >
                          {DOGRULAMA_ETIKET[z.mappingDogrulama] ?? z.mappingDogrulama}
                        </StatusBadge>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs" title={z.artifactSha256}>
                          {z.artifactSha256.slice(0, 16)}…
                        </code>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Uygulanabilirlik kararları ({applicability.length})</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {applicability.length === 0 ? (
            <p className="text-sm text-muted-foreground">Güncel uygulanabilirlik kararı yok.</p>
          ) : (
            applicability.map((a) => (
              <div key={a.obligationKod} className="flex flex-wrap items-center gap-2 text-sm">
                <span>{a.obligationKod}</span>
                <StatusBadge durum={a.durum === "APPLICABLE" ? "info" : a.durum === "UNKNOWN" ? "unknown" : "neutral"}>
                  {a.durum}
                </StatusBadge>
                {a.gerekce ? <span className="text-xs text-muted-foreground">{a.gerekce}</span> : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sitasyon paketi</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <p className="text-muted-foreground">
            Paket bu sayfada, sunucudan gelen veriyle üretildi (hash&apos;ler RFC 8785 kanonik
            JSON&apos;dan). Bağımsız doğrulama: paketi indirin ve KALKAN_OS&apos;a erişmeden{" "}
            <code>npx tsx scripts/verify-sitasyon.ts paket.json</code> çalıştırın. Paket imzasız,
            hash-bütünlüklüdür.
          </p>
          {paket && indirmeUrl ? (
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={indirmeUrl}
                download={`kalkan-sitasyon-${kosu.id}.json`}
                className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Paketi indir (JSON)
              </a>
              <code className="text-xs text-muted-foreground" title={paket.sourceBundleHash}>
                sourceBundleHash: {paket.sourceBundleHash.slice(0, 16)}…
              </code>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Paket hazırlanıyor…</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Şeffaflık Defteri Mührü (G3)</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <p className="text-muted-foreground">
            Bu koşu, append-only bir Merkle defterine (SCITT tarzı) imzalı ifade olarak eklendi.
            Aşağıdaki kapsama makbuzu, KALKAN-OS&apos;a erişmeden{" "}
            <code>npx tsx scripts/verify-seffaflik.ts makbuz.json</code> ile bağımsız
            doğrulanabilir — mühür DÜRÜST bir durum taşır: henüz mühürlenmediyse{" "}
            <em>bekliyor</em> denir, sahte &quot;doğrulandı&quot; iddiası üretilmez.
          </p>
          {!ledgerMalzeme || ledgerMalzeme.durum !== "ANCHORED" ? (
            <StatusBadge durum={LEDGER_DURUM_SEMANTIK[ledgerMalzeme?.durum ?? "KAYITSIZ"] ?? "unknown"}>
              {LEDGER_DURUM_ETIKET[ledgerMalzeme?.durum ?? "KAYITSIZ"] ?? "Bilinmiyor"}
            </StatusBadge>
          ) : makbuz && makbuzIndirmeUrl ? (
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={makbuzIndirmeUrl}
                download={`kalkan-makbuz-${kosu.id}.json`}
                className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Kapsama makbuzunu indir (JSON)
              </a>
              <code className="text-xs text-muted-foreground" title={makbuz.sth.rootHash}>
                kök: {makbuz.sth.rootHash.slice(0, 16)}… · yaprak #{makbuz.leafIndex}
              </code>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Makbuz hazırlanıyor…</p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
