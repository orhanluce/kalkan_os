// Dikey F, F4: bir test koşusuna ölçülen kurtarma verisini KAYDEDER (MANUEL_
// BEYAN). Karşılaştırma YOK — yalnız kaydeder ve mühürler.
//
// NEDEN OTOMATIK_OLCUM BURADAN GELMEZ: kullanıcı formu yalnız MANUEL_BEYAN
// üretir; measurementSource sunucuda 'MANUEL_BEYAN'a SABİTLENİR (istemci başka
// değer gönderse de yok sayılır). OTOMATIK_OLCUM yalnız güvenilir sunucu
// entegrasyonu (service_role) ile oluşur; DB guard'ı ayrıca zorlar.
//
// GET: bu koşuya ait ölçüm zincirini döndürür (güncel + supersede geçmişi).
import { NextResponse } from "next/server";
import { canonicalHash, type CanonicalDeger } from "@/lib/canonical";
import { kurtarmaOlcumuOlustur, KurtarmaOlcumuHatasi, type GirdiModu } from "@/lib/recovery-measurement";
import { ledgerOutboxDrain } from "@/lib/ledger-outbox";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";

// randomUUID: Node/Edge Web Crypto (Date.now değil — deterministik motor dışı).
function yeniId(): string {
  return crypto.randomUUID();
}

export async function GET(_req: Request, ctx: { params: Promise<{ runId: string }> }) {
  const { runId } = await ctx.params;
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return NextResponse.json({ hata: "Oturum gerekli." }, { status: 401 });

  const { data: profil } = await db.from("profiles").select("tenant_id").eq("id", user.id).maybeSingle();
  if (!profil?.tenant_id) return NextResponse.json({ hata: "Kurum bağlamı çözülemedi." }, { status: 400 });

  const { data: olcumler } = await db
    .from("test_run_recovery_measurements")
    .select(
      "id, test_run_id, olcum_kaynagi, girdi_modu, kesinti_baslangic_at, hizmet_geri_geldi_at, son_tutarli_veri_at, kurtarma_noktasi_at, beyan_kesinti_saat, beyan_veri_kaybi_saat, olculen_kesinti_saat, olculen_veri_kaybi_saat, source_system, declarant_present, supersedes_measurement_id, olcum_hash, measured_at, recorded_at, created_at",
    )
    .eq("test_run_id", runId)
    .order("created_at", { ascending: false });

  // Dikey F, F5 Karar B: "güncel" TEK merkezi DB fonksiyonundan çözülür —
  // burada AYRICA yeniden hesaplanmaz (tek sözleşme, iki yerde tekrar yok).
  // Anomali (BIRDEN_FAZLA_GUNCEL_KAYIT/ZINCIR_HATASI) durumunda hiçbir satır
  // "güncel" işaretlenmez — rastgele seçim yapılmaz, durum İSTEMCİYE taşınır.
  const { data: guncelSonuc } = await db
    .rpc("test_run_kurtarma_olcumu_guncel", { p_test_run_id: runId, p_tenant_id: profil.tenant_id })
    .single();
  const guncelId = guncelSonuc?.durum === "GUNCEL_KAYIT_VAR" ? guncelSonuc.id : null;

  const liste = olcumler ?? [];
  const zenginlestirilmis = liste.map((o) => ({ ...o, guncel: o.id === guncelId }));
  return NextResponse.json({ olcumler: zenginlestirilmis, guncelDurum: guncelSonuc?.durum ?? "KAYIT_YOK" });
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
    return NextResponse.json({ hata: "Kurtarma ölçümü kaydetmek admin veya uyum rolünün işidir." }, { status: 403 });
  }
  if (!profil.tenant_id) return NextResponse.json({ hata: "Kurum bağlamı çözülemedi." }, { status: 400 });

  // RLS altında oku: başka kiracının koşusu görünmez.
  const { data: kosu } = await db.from("test_runs").select("id, tenant_id").eq("id", runId).maybeSingle();
  if (!kosu) return NextResponse.json({ hata: "Test koşusu bulunamadı." }, { status: 404 });

  const govde = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const inputMode = govde.inputMode as GirdiModu;
  if (inputMode !== "EVENT_TIMESTAMPS" && inputMode !== "DURATION_DECLARATION") {
    return NextResponse.json({ hata: "girdi modu geçersiz." }, { status: 400 });
  }

  const num = (v: unknown): number | null => (typeof v === "number" ? v : v == null || v === "" ? null : Number(v));
  const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);

  const measurementId = yeniId();
  const recordedAt = new Date().toISOString();

  // Dikey F, F5 hazırlık — Karar D: measured_at ASLA sessizce recorded_at'e
  // düşürülmez. Kesinti olay zamanları varsa (hizmet_geri_geldi_at dolu)
  // ölçüm zamanı SUNUCU tarafında ondan türetilir (tek kaynak, istemci
  // değeri yok sayılır); aksi halde (yalnız veri-kaybı penceresi veya
  // süre-yalnız beyan) kullanıcının AÇIKÇA girdiği bir zaman ZORUNLUDUR.
  const hizmetGeriGeldiAt = str(govde.hizmetGeriGeldiAt);
  let measuredAt: string;
  if (inputMode === "EVENT_TIMESTAMPS" && hizmetGeriGeldiAt !== null) {
    measuredAt = hizmetGeriGeldiAt;
  } else {
    const kullaniciGirdisi = str(govde.measuredAt);
    if (kullaniciGirdisi === null) {
      return NextResponse.json(
        { hata: "Ölçüm zamanı (measured_at) bu girdi için zorunludur.", kod: "MEASURED_AT_EKSIK" },
        { status: 400 },
      );
    }
    measuredAt = kullaniciGirdisi;
  }

  let payload;
  try {
    payload = kurtarmaOlcumuOlustur({
      testRunId: runId,
      measurementId,
      // SABİT: kullanıcı formu yalnız beyan üretir (OTOMATIK yükseltme reddi).
      measurementSource: "MANUEL_BEYAN",
      inputMode,
      outage: {
        startedAt: str(govde.kesintiBaslangicAt),
        restoredAt: hizmetGeriGeldiAt,
        declaredHours: num(govde.beyanKesintiSaat),
      },
      dataLoss: {
        lastConsistentDataAt: str(govde.sonTutarliVeriAt),
        recoveryPointAt: str(govde.kurtarmaNoktasiAt),
        declaredHours: num(govde.beyanVeriKaybiSaat),
      },
      provenance: {
        evidenceId: str(govde.evidenceId),
        sourceSystem: null,
        sourceEventId: null,
        sourcePayloadHash: null,
        declarantPresent: govde.declarantPresent === true,
      },
      supersedesMeasurementId: str(govde.supersedesMeasurementId),
      measuredAt,
      recordedAt,
    });
  } catch (e) {
    if (e instanceof KurtarmaOlcumuHatasi) {
      return NextResponse.json({ hata: e.message, kod: e.kod }, { status: 400 });
    }
    throw e;
  }

  const olcumHash = await canonicalHash(payload as unknown as CanonicalDeger);

  const { data: kayit, error } = await db
    .from("test_run_recovery_measurements")
    .insert({
      id: measurementId,
      tenant_id: profil.tenant_id,
      test_run_id: runId,
      olcum_kaynagi: "MANUEL_BEYAN",
      girdi_modu: inputMode,
      kesinti_baslangic_at: payload.outage.startedAt,
      hizmet_geri_geldi_at: payload.outage.restoredAt,
      son_tutarli_veri_at: payload.dataLoss.lastConsistentDataAt,
      kurtarma_noktasi_at: payload.dataLoss.recoveryPointAt,
      beyan_kesinti_saat: payload.outage.declaredHours,
      beyan_veri_kaybi_saat: payload.dataLoss.declaredHours,
      evidence_id: payload.provenance.evidenceId,
      declarant_present: payload.provenance.declarantPresent,
      supersedes_measurement_id: payload.supersedesMeasurementId,
      olcum: payload as unknown as Json,
      olcum_hash: olcumHash,
      measured_at: measuredAt,
      recorded_at: recordedAt,
    })
    .select("id, olcum_hash, created_at")
    .single();
  if (error || !kayit) {
    return NextResponse.json({ hata: error?.message ?? "Kurtarma ölçümü kaydedilemedi." }, { status: 400 });
  }

  // Şeffaflık defterine mühür (asenkron outbox; başarısızlık kaydı düşürmez).
  await ledgerOutboxDrain(db).catch(() => undefined);

  return NextResponse.json({ id: kayit.id, olcumHash: kayit.olcum_hash, olusturulmaZamani: kayit.created_at, olcum: payload });
}
