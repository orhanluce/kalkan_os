// Dikey F, F2 (docs/adr/PR0-dikeyF-f2-kritik-hizmet-test-paketi-2026-07-21.md):
// kritik hizmet test paketi — GET önizler (mühürlemez), POST mühürler
// (kritik_hizmet_test_paketi_snapshots). Session client RLS altında okur;
// snapshot INSERT'i de session client'la (tablonun kendi RLS policy'si admin/
// uyum yazabilir — impact_graph_snapshots/cloud_assurance_profile_snapshots'ın
// AYNI deseni, service_role gerekmez, kimlik/cross-tenant guard'lar zaten DB
// trigger'ında).
import { NextResponse } from "next/server";
import { canonicalHash, type CanonicalDeger } from "@/lib/canonical";
import { kritikHizmetTestPaketiOlustur, type KritikHizmetTestPaketiGirdisi } from "@/lib/kritik-hizmet-test-paketi";
import type { KarsilastirmaSonucu } from "@/lib/recovery-comparison";
import type { TestSonuc } from "@/lib/control-test";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";

/**
 * Dikey F, F5.1: YENİ bir karşılaştırma motoru YOK — F5'in ZATEN VAR olan
 * merkezi sözleşmelerini (test_run_kurtarma_olcumu_guncel + test_run_
 * kurtarma_karsilastirmasi_guncel) her koşu için İLİŞKİSEL çağırır. "Güncel
 * koşu" seçimi burada YENİDEN HESAPLANMAZ — çağıran, saf motorun (`kosular`
 * girdisinden) zaten belirlediği `enGuncelKosu.testRunId`'leri geçirir; bu
 * fonksiyon yalnız O koşular için ölçüm/karşılaştırma durumunu okur.
 */
async function recoveryComparisonlariCoz(
  db: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  testRunIds: string[],
): Promise<NonNullable<KritikHizmetTestPaketiGirdisi["recoveryComparisons"]>> {
  const sonuclar = await Promise.all(
    testRunIds.map(async (testRunId) => {
      const { data: guncelOlcum } = await db
        .rpc("test_run_kurtarma_olcumu_guncel", { p_test_run_id: testRunId, p_tenant_id: tenantId })
        .single();
      if (!guncelOlcum || guncelOlcum.durum !== "GUNCEL_KAYIT_VAR") {
        return { testRunId, olcumVar: false, olcumKaynagi: null, karsilastirma: null };
      }

      const { data: guncelKarsilastirma } = await db
        .rpc("test_run_kurtarma_karsilastirmasi_guncel", { p_test_run_id: testRunId, p_tenant_id: tenantId })
        .single();
      if (!guncelKarsilastirma || guncelKarsilastirma.durum !== "GUNCEL_KAYIT_VAR") {
        return {
          testRunId,
          olcumVar: true,
          olcumKaynagi: guncelOlcum.olcum_kaynagi as "MANUEL_BEYAN" | "OTOMATIK_OLCUM",
          karsilastirma: null,
        };
      }

      // Mühürlü TAM payload'dan rto/rpo.aciklama — F5'in kendi metni AYNEN
      // taşınır (Proof Room/kurtarma-karsilastirmasi GET rotasındaki AYNI
      // "ikinci select" deseni).
      const { data: sealed } = await db
        .from("test_run_recovery_comparisons")
        .select("karsilastirma")
        .eq("id", guncelKarsilastirma.id)
        .single();
      const karsilastirma = sealed?.karsilastirma as
        | { rto: { sonuc: KarsilastirmaSonucu; aciklama: string }; rpo: { sonuc: KarsilastirmaSonucu; aciklama: string } }
        | undefined;

      return {
        testRunId,
        olcumVar: true,
        olcumKaynagi: guncelOlcum.olcum_kaynagi as "MANUEL_BEYAN" | "OTOMATIK_OLCUM",
        karsilastirma: karsilastirma
          ? { rto: { sonuc: karsilastirma.rto.sonuc, aciklama: karsilastirma.rto.aciklama }, rpo: { sonuc: karsilastirma.rpo.sonuc, aciklama: karsilastirma.rpo.aciklama } }
          : null,
      };
    }),
  );
  return sonuclar;
}

async function girdiOlustur(
  db: Awaited<ReturnType<typeof createClient>>,
  criticalServiceId: string,
): Promise<KritikHizmetTestPaketiGirdisi | null> {
  const { data: hizmet } = await db
    .from("critical_business_services")
    .select("id, ad, durum")
    .eq("id", criticalServiceId)
    .maybeSingle();
  if (!hizmet) return null;

  const [{ data: serviceControls }, { data: tanimlar }] = await Promise.all([
    db.from("critical_service_controls").select("control_id").eq("critical_service_id", criticalServiceId),
    // Kapsam çözümleme motorun işi (kural 11) — bu yüzden TÜM tenant tanımları
    // çekilir, DIRECT/VIA/BOTH filtrelemesi src/lib/kritik-hizmet-test-paketi.ts'te.
    db.from("control_test_definitions").select("id, control_id, tur, ad, tazelik_gun, critical_service_id"),
  ]);

  const serviceControlIds = (serviceControls ?? []).map((s) => s.control_id);
  const tanimIdListesi = (tanimlar ?? []).map((t) => t.id);

  const [{ data: kosular }, { data: bulgular }] = await Promise.all([
    tanimIdListesi.length > 0
      ? db
          .from("test_runs")
          .select("id, test_definition_id, seq, sonuc, calisti_at, evidence_id")
          .in("test_definition_id", tanimIdListesi)
      : Promise.resolve({ data: [] as { id: string; test_definition_id: string; seq: number; sonuc: string; calisti_at: string; evidence_id: string | null }[] }),
    tanimIdListesi.length > 0
      ? db
          .from("findings")
          .select("id, kaynak_test_definition_id, durum, onem, kapatma_retest_run_id, kapatan")
          .eq("kaynak", "kontrol_testi")
          .in("kaynak_test_definition_id", tanimIdListesi)
      : Promise.resolve({ data: [] as { id: string; kaynak_test_definition_id: string | null; durum: string; onem: string; kapatma_retest_run_id: string | null; kapatan: string | null }[] }),
  ]);

  const evidenceIdSeti = [...new Set((kosular ?? []).map((k) => k.evidence_id).filter((x): x is string => !!x))];
  const { data: kanitlar } =
    evidenceIdSeti.length > 0
      ? await db.from("evidences").select("id, hash_sha256, gecerlilik_bitis").in("id", evidenceIdSeti)
      : { data: [] as { id: string; hash_sha256: string | null; gecerlilik_bitis: string | null }[] };

  // Dikey F, F3: bu kritik hizmetin TÜM tolerans sürümleri (TASLAK/YURURLUKTE/
  // SUPERSEDED). İstemciden tolerans id'sine güvenilmez — aktif/onaylı kaydı
  // saf motor deterministik çözer. RLS aynı tenant'a kapar; ayrıca
  // critical_service_id ile daraltılır (başka hizmetin toleransı sızmaz).
  const { data: tolerablar } = await db
    .from("impact_tolerances")
    .select("id, surum, durum, max_kesinti_saat, max_veri_kaybi_saat, yonetim_onayi, onaylayan, onay_zamani")
    .eq("critical_service_id", criticalServiceId);

  return {
    criticalService: { id: hizmet.id, ad: hizmet.ad, durum: hizmet.durum },
    asOf: new Date().toISOString(),
    testTanimlari: (tanimlar ?? []).map((t) => ({
      id: t.id,
      controlId: t.control_id,
      tur: t.tur,
      ad: t.ad,
      tazelikGun: t.tazelik_gun,
      criticalServiceId: t.critical_service_id,
    })),
    serviceControlIds,
    kosular: (kosular ?? []).map((k) => ({
      id: k.id,
      testDefinitionId: k.test_definition_id,
      seq: k.seq,
      sonuc: k.sonuc as TestSonuc,
      calistiAt: k.calisti_at,
      evidenceId: k.evidence_id,
    })),
    kanitlar: (kanitlar ?? []).map((k) => ({ id: k.id, hashSha256: k.hash_sha256, gecerlilikBitis: k.gecerlilik_bitis })),
    bulgular: (bulgular ?? []).map((b) => ({
      id: b.id,
      testDefinitionId: b.kaynak_test_definition_id,
      durum: b.durum as "acik" | "kapali",
      onem: b.onem as "acil" | "kritik" | "yuksek" | "orta" | "dusuk",
      kapatmaRetestRunId: b.kapatma_retest_run_id,
      kapatanBelirtildi: b.kapatan !== null,
    })),
    impactTolerances: (tolerablar ?? []).map((t) => ({
      id: t.id,
      version: t.surum,
      durum: t.durum as "TASLAK" | "YURURLUKTE" | "SUPERSEDED",
      maxKesintiSaat: t.max_kesinti_saat,
      maxVeriKaybiSaat: t.max_veri_kaybi_saat,
      yonetimOnayi: t.yonetim_onayi,
      // Ham kimlik motora GİRMEZ — yalnız "atanmış mı" (Proof Room'a mühürlenen
      // paket zaten kimlik taşımamalı, ADR §5).
      onaylayanBelirtildi: t.onaylayan !== null,
      onayZamani: t.onay_zamani,
    })),
  };
}

/**
 * İKİ GEÇİŞLİ çözümleme (Dikey F, F5.1): birinci geçiş recoveryComparisons
 * OLMADAN çalışır — saf motorun kendi `enGuncelKosu` seçimini (test başına en
 * güncel koşu) BİR KEZ hesaplatıp OKUR. Bu "güncel koşu" mantığı burada
 * YENİDEN YAZILMAZ (kural: üçüncü bir kopya yok) — yalnız motorun ürettiği
 * sonuçtan test_run_id'ler çıkarılır, o id'ler için (yalnız o id'ler için,
 * tüm tarihsel koşular için DEĞİL) F5'in merkezi RPC'leri çağrılır, ikinci
 * geçişte aynı girdi + recoveryComparisons ile paket NİHAİ olarak üretilir.
 */
async function paketOlustur(
  db: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  criticalServiceId: string,
): Promise<{ paket: ReturnType<typeof kritikHizmetTestPaketiOlustur> } | null> {
  const girdi = await girdiOlustur(db, criticalServiceId);
  if (!girdi) return null;

  const onizleme = kritikHizmetTestPaketiOlustur(girdi);
  const guncelRunIds = [...new Set(onizleme.testler.map((t) => t.enGuncelKosu?.testRunId).filter((x): x is string => !!x))];
  const recoveryComparisons = guncelRunIds.length > 0 ? await recoveryComparisonlariCoz(db, tenantId, guncelRunIds) : [];

  const paket = kritikHizmetTestPaketiOlustur({ ...girdi, recoveryComparisons });
  return { paket };
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: criticalServiceId } = await params;
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return NextResponse.json({ hata: "Oturum gerekli." }, { status: 401 });

  const { data: profil } = await db.from("profiles").select("tenant_id").eq("id", user.id).maybeSingle();
  if (!profil?.tenant_id) return NextResponse.json({ hata: "Kurum bağlamı çözülemedi." }, { status: 400 });

  const sonuc = await paketOlustur(db, profil.tenant_id, criticalServiceId);
  if (!sonuc) return NextResponse.json({ hata: "Kritik hizmet bulunamadı." }, { status: 404 });

  return NextResponse.json({ onizleme: true, paket: sonuc.paket });
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: criticalServiceId } = await params;
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return NextResponse.json({ hata: "Oturum gerekli." }, { status: 401 });
  const { data: profilRow } = await db.from("profiles").select("role, tenant_id").eq("id", user.id).maybeSingle();
  if (profilRow?.role !== "admin" && profilRow?.role !== "uyum") {
    return NextResponse.json({ hata: "Test paketi mühürlemek admin veya uyum rolünün işidir." }, { status: 403 });
  }
  if (!profilRow.tenant_id) return NextResponse.json({ hata: "Kurum bağlamı çözülemedi." }, { status: 400 });

  const sonuc = await paketOlustur(db, profilRow.tenant_id, criticalServiceId);
  if (!sonuc) return NextResponse.json({ hata: "Kritik hizmet bulunamadı." }, { status: 404 });
  const { paket } = sonuc;
  const paketHash = await canonicalHash(paket as unknown as CanonicalDeger);

  const { data: kayit, error } = await db
    .from("kritik_hizmet_test_paketi_snapshots")
    .insert({
      tenant_id: profilRow.tenant_id,
      critical_service_id: criticalServiceId,
      paket: paket as unknown as Json,
      paket_hash: paketHash,
      hesaplama_yontemi: paket.hesaplamaYontemi as unknown as Json,
    })
    .select("id, paket_hash, created_at")
    .single();
  if (error || !kayit) {
    return NextResponse.json({ hata: error?.message ?? "Test paketi mühürlenemedi." }, { status: 403 });
  }

  return NextResponse.json({
    id: kayit.id,
    paketHash: kayit.paket_hash,
    olusturulmaZamani: kayit.created_at,
    paket,
  });
}
