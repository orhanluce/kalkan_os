// Dikey F, F5 (docs/adr/PR0-dikeyF-f5-kurtarma-karsilastirmasi-2026-07-21.md):
// belirli bir F4 ölçüm kaydı ile ölçüm anında yürürlükte olan onaylı F3
// tolerans sürümü arasında karşılaştırma üretir + mühürler. F2/F3 paketine
// SIZMAZ (F5.1 bekliyor).
//
// KRİTİK HİZMET AÇIKÇA GİRDİ: bu rota kritik hizmeti OTOMATİK ÇÖZMEZ —
// çağıran (UI) hangi kritik hizmetin toleransıyla karşılaştırma yapılacağını
// AÇIKÇA belirtir; DB guard'ı (trrc_tenant_guard) bu eşleşmenin gerçekten
// DIRECT/VIA bağlı olduğunu ayrıca doğrular.
import { NextResponse } from "next/server";
import { canonicalHash, type CanonicalDeger } from "@/lib/canonical";
import { kurtarmaKarsilastirmasiOlustur, type RecoveryComparisonGirdisi } from "@/lib/recovery-comparison";
import { ledgerOutboxDrain } from "@/lib/ledger-outbox";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";

export async function GET(_req: Request, ctx: { params: Promise<{ runId: string }> }) {
  const { runId } = await ctx.params;
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return NextResponse.json({ hata: "Oturum gerekli." }, { status: 401 });

  const { data: profil } = await db.from("profiles").select("tenant_id").eq("id", user.id).maybeSingle();
  if (!profil?.tenant_id) return NextResponse.json({ hata: "Kurum bağlamı çözülemedi." }, { status: 400 });

  const { data: guncel } = await db
    .rpc("test_run_kurtarma_karsilastirmasi_guncel", { p_test_run_id: runId, p_tenant_id: profil.tenant_id })
    .single();

  if (!guncel || guncel.durum !== "GUNCEL_KAYIT_VAR") {
    return NextResponse.json({ karsilastirma: null, durum: guncel?.durum ?? "KAYIT_YOK" });
  }

  // RPC yalnız özet/skaler kolonları döner (kural 13: birleştirilmez sözleşme
  // taşıyıcısı). UI, mühürlenmiş TAM payload'daki (rto/rpo.aciklama dahil)
  // insan-okunur dili gösterir — Proof Room'un (proof_room_goruntule) aynı
  // ikinci-select desenini burada da izliyoruz.
  const { data: sealed } = await db.from("test_run_recovery_comparisons").select("karsilastirma").eq("id", guncel.id).single();

  const { data: ledgerDurum } = await db.rpc("artifact_ledger_durumu", {
    p_artifact_table: "test_run_recovery_comparisons",
    p_artifact_id: guncel.id,
  });

  return NextResponse.json({
    karsilastirma: sealed?.karsilastirma ?? null,
    durum: guncel.durum,
    ledgerDurumu: ledgerDurum ?? "KAYITSIZ",
  });
}

export async function POST(req: Request, ctx: { params: Promise<{ runId: string }> }) {
  const { runId } = await ctx.params;
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return NextResponse.json({ hata: "Oturum gerekli." }, { status: 401 });

  const { data: profil } = await db.from("profiles").select("role, tenant_id").eq("id", user.id).maybeSingle();
  if (profil?.role !== "admin" && profil?.role !== "uyum") {
    return NextResponse.json({ hata: "Kurtarma karşılaştırması oluşturmak admin veya uyum rolünün işidir." }, { status: 403 });
  }
  if (!profil.tenant_id) return NextResponse.json({ hata: "Kurum bağlamı çözülemedi." }, { status: 400 });

  const govde = (await req.json().catch(() => ({}))) as { criticalServiceId?: string };
  const criticalServiceId = govde.criticalServiceId;
  if (!criticalServiceId) {
    return NextResponse.json({ hata: "criticalServiceId zorunludur." }, { status: 400 });
  }

  // RLS altında oku: başka kiracının koşusu görünmez.
  const { data: kosu } = await db.from("test_runs").select("id, tenant_id").eq("id", runId).maybeSingle();
  if (!kosu) return NextResponse.json({ hata: "Test koşusu bulunamadı." }, { status: 404 });

  // 1) GÜNCEL ölçümü merkezi fonksiyondan çöz (rastgele seçim yok).
  const { data: guncelOlcum } = await db
    .rpc("test_run_kurtarma_olcumu_guncel", { p_test_run_id: runId, p_tenant_id: profil.tenant_id })
    .single();
  if (!guncelOlcum || guncelOlcum.durum !== "GUNCEL_KAYIT_VAR") {
    return NextResponse.json(
      { hata: "Bu koşu için tek/güncel bir kurtarma ölçümü bulunamadı.", kod: guncelOlcum?.durum ?? "KAYIT_YOK" },
      { status: 400 },
    );
  }

  // 2) Ölçüm ANINDA yürürlükte olan tolerans sürümünü as-of ile çöz.
  //    (Skaler/tekil değer döndüren fonksiyon — PostgREST bunu bir dizi
  //    olarak SARMAZ; .single()/.maybeSingle() burada YANLIŞ olur.)
  const { data: tolerans } = await db.rpc("impact_tolerance_asof", {
    p_critical_service_id: criticalServiceId,
    p_as_of: guncelOlcum.measured_at,
  });
  if (!tolerans || !tolerans.id) {
    return NextResponse.json(
      { hata: "Ölçüm anında yürürlükte, onaylı bir tolerans sürümü bulunamadı; karşılaştırma oluşturulamaz.", kod: "TOLERANS_COZULEMEDI" },
      { status: 400 },
    );
  }

  // 3) Bu koşu için GÜNCEL karşılaştırma varsa (supersede zinciri) id'sini al.
  const { data: mevcutGuncel } = await db
    .rpc("test_run_kurtarma_karsilastirmasi_guncel", { p_test_run_id: runId, p_tenant_id: profil.tenant_id })
    .single();
  const supersedesComparisonId = mevcutGuncel?.durum === "GUNCEL_KAYIT_VAR" ? mevcutGuncel.id : null;

  const comparisonId = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  const girdi: RecoveryComparisonGirdisi = {
    testRunId: runId,
    comparisonId,
    measurement: {
      id: guncelOlcum.id!,
      olcumKaynagi: guncelOlcum.olcum_kaynagi as "MANUEL_BEYAN" | "OTOMATIK_OLCUM",
      olculenKesintiSaat: guncelOlcum.olculen_kesinti_saat,
      olculenVeriKaybiSaat: guncelOlcum.olculen_veri_kaybi_saat,
      beyanKesintiSaat: guncelOlcum.beyan_kesinti_saat,
      beyanVeriKaybiSaat: guncelOlcum.beyan_veri_kaybi_saat,
    },
    tolerance: {
      id: tolerans.id,
      surum: tolerans.surum,
      yonetimOnayi: tolerans.yonetim_onayi,
      onayZamani: tolerans.onay_zamani,
      maxKesintiSaat: tolerans.max_kesinti_saat,
      maxVeriKaybiSaat: tolerans.max_veri_kaybi_saat,
    },
    criticalServiceId,
    supersedesComparisonId,
    createdAt,
  };

  const payload = kurtarmaKarsilastirmasiOlustur(girdi);
  const karsilastirmaHash = await canonicalHash(payload as unknown as CanonicalDeger);

  const { data: kayit, error } = await db
    .from("test_run_recovery_comparisons")
    .insert({
      id: comparisonId,
      tenant_id: profil.tenant_id,
      test_run_id: runId,
      recovery_measurement_id: guncelOlcum.id!,
      impact_tolerance_id: tolerans.id,
      critical_service_id: criticalServiceId,
      tolerans_max_kesinti_saat: payload.toleransMaxKesintiSaat,
      tolerans_max_veri_kaybi_saat: payload.toleransMaxVeriKaybiSaat,
      tolerans_surumu: payload.toleransSurumu,
      rto_sonucu: payload.rto.sonuc,
      rpo_sonucu: payload.rpo.sonuc,
      olcum_kaynagi: payload.olcumKaynagi,
      supersedes_comparison_id: supersedesComparisonId,
      karsilastirma: payload as unknown as Json,
      karsilastirma_hash: karsilastirmaHash,
    })
    .select("id, karsilastirma_hash, created_at")
    .single();
  if (error || !kayit) {
    return NextResponse.json({ hata: error?.message ?? "Kurtarma karşılaştırması kaydedilemedi." }, { status: 400 });
  }

  await ledgerOutboxDrain(db).catch(() => undefined);

  return NextResponse.json({
    id: kayit.id,
    karsilastirmaHash: kayit.karsilastirma_hash,
    olusturulmaZamani: kayit.created_at,
    karsilastirma: payload,
  });
}
