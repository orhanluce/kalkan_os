// Dikey E, E2, Kapı 2 (docs/adr/PR0-dikeyE2-telafi-edici-kontrol-proof-room-
// 2026-07-20.md §4): telafi edici kontrol önerisi. GET seçim listelerini
// (mevcut kayıtlar + tenant'ın PASSED test koşuları) döner; POST TASLAK
// oluşturur VE aynı istekte İNCELEMEDE'ye gönderir (öneri formu TEK adımda
// tüm alanları topluyor — kural 14/11: hiçbir alan sunucu tarafından
// UYDURULMAZ, hepsi istemciden gelir ama kimlik atfı submitted_by DB
// guard'ında oturum sahibine sabitlenir, istemci iddiası güvenilmez).
//
// Session client (RLS altında) — service_role YOK: afcc_write policy zaten
// admin/uyum + kendi tenant'ına yazma izni veriyor, kimlik/cross-tenant
// guard'ları DB trigger'ında (E1 guvence-profili route'unun AYNI deseni).
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function bulguYukle(db: Awaited<ReturnType<typeof createClient>>, thirdPartyId: string, findingId: string) {
  const { data: bulgu } = await db
    .from("assessment_findings")
    .select("id, third_party_id, baslik, ciddiyet, durum")
    .eq("id", findingId)
    .maybeSingle();
  if (!bulgu || bulgu.third_party_id !== thirdPartyId) return null;
  return bulgu;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; findingId: string }> }) {
  const { id: thirdPartyId, findingId } = await params;
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return NextResponse.json({ hata: "Oturum gerekli." }, { status: 401 });

  const bulgu = await bulguYukle(db, thirdPartyId, findingId);
  if (!bulgu) return NextResponse.json({ hata: "Bulgu bulunamadı." }, { status: 404 });

  const bugun = new Date().toISOString().slice(0, 10);

  const [{ data: mevcut }, { data: testKosulari }] = await Promise.all([
    db
      .from("assessment_finding_compensating_controls")
      .select(
        "id, durum, control_id, test_run_id, gerekce, valid_from, valid_until, submitted_by, reviewed_by, reviewed_at, red_gerekcesi, revoked_by, revoked_at, revocation_reason, onceki_id, created_at, controls (madde_ref), test_runs (sonuc, evidence_id)",
      )
      .eq("assessment_finding_id", findingId)
      .order("created_at", { ascending: false }),
    // Yalnız bu kiracının PASSED test koşuları — durum makinesi zaten AKTIF
    // için PASSED zorunlu tutuyor, seçilemeyecek bir koşuyu listede
    // GÖSTERMEMEK yanlış beklenti kurmaz (dar/dürüst seçim listesi).
    db
      .from("test_runs")
      .select("id, control_id, sonuc, calisti_at, evidence_id, controls (madde_ref), evidences (gecerlilik_bitis)")
      .eq("sonuc", "PASSED")
      .order("calisti_at", { ascending: false }),
  ]);

  return NextResponse.json({
    bulgu,
    telafiler: (mevcut ?? []).map((t) => ({
      id: t.id,
      durum: t.durum,
      controlId: t.control_id,
      controlMaddeRef: (t.controls as unknown as { madde_ref: string } | null)?.madde_ref ?? null,
      testRunId: t.test_run_id,
      testSonucu: (t.test_runs as unknown as { sonuc: string } | null)?.sonuc ?? null,
      gerekce: t.gerekce,
      validFrom: t.valid_from,
      validUntil: t.valid_until,
      submittedBy: t.submitted_by,
      reviewedBy: t.reviewed_by,
      reviewedAt: t.reviewed_at,
      redGerekcesi: t.red_gerekcesi,
      revokedBy: t.revoked_by,
      revokedAt: t.revoked_at,
      revocationReason: t.revocation_reason,
      oncekiId: t.onceki_id,
      createdAt: t.created_at,
    })),
    uygunTestKosulari: (testKosulari ?? []).map((t) => {
      const kanitBitis = (t.evidences as unknown as { gecerlilik_bitis: string | null } | null)?.gecerlilik_bitis ?? null;
      return {
        id: t.id,
        controlId: t.control_id,
        controlMaddeRef: (t.controls as unknown as { madde_ref: string } | null)?.madde_ref ?? null,
        calistiAt: t.calisti_at,
        kanitVarMi: t.evidence_id !== null,
        kanitGuncel: kanitBitis === null || kanitBitis >= bugun,
      };
    }),
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string; findingId: string }> }) {
  const { id: thirdPartyId, findingId } = await params;
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return NextResponse.json({ hata: "Oturum gerekli." }, { status: 401 });
  const { data: profilRow } = await db.from("profiles").select("role, tenant_id").eq("id", user.id).maybeSingle();
  if (profilRow?.role !== "admin" && profilRow?.role !== "uyum") {
    return NextResponse.json({ hata: "Telafi edici kontrol önermek admin veya uyum rolünün işidir." }, { status: 403 });
  }
  if (!profilRow.tenant_id) return NextResponse.json({ hata: "Kurum bağlamı çözülemedi." }, { status: 400 });

  const bulgu = await bulguYukle(db, thirdPartyId, findingId);
  if (!bulgu) return NextResponse.json({ hata: "Bulgu bulunamadı." }, { status: 404 });

  let body: { controlId?: string; testRunId?: string; gerekce?: string; validFrom?: string; validUntil?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ hata: "Geçersiz istek gövdesi." }, { status: 400 });
  }
  const { controlId, testRunId, gerekce, validFrom, validUntil } = body;
  if (!controlId || !testRunId || !gerekce?.trim() || !validFrom || !validUntil) {
    return NextResponse.json(
      { hata: "controlId, testRunId, gerekce, validFrom ve validUntil zorunlu." },
      { status: 400 },
    );
  }

  // TASLAK oluştur — kimlik atfı (submitted_by) DB guard'ında oturum sahibine
  // sabitlenir, buradaki değer güvenilmez ama guard yine de doğrular.
  const { data: taslak, error: insertHata } = await db
    .from("assessment_finding_compensating_controls")
    .insert({
      tenant_id: profilRow.tenant_id,
      assessment_finding_id: findingId,
      control_id: controlId,
      test_run_id: testRunId,
      gerekce: gerekce.trim(),
      valid_from: validFrom,
      valid_until: validUntil,
    })
    .select("id")
    .single();
  if (insertHata || !taslak) {
    return NextResponse.json({ hata: insertHata?.message ?? "Telafi edici kontrol oluşturulamadı." }, { status: 403 });
  }

  // Aynı istekte incelemeye gönder — TASLAK araya girmiş bir ekran adımı
  // değil, DB'nin "asla doğrudan onaylı doğmaz" invariant'ının gereği
  // (kural 11); öneri formu tüm alanları zaten topladığı için kullanıcıya
  // ayrı bir "gönder" tıklaması dayatmak dar kullanılabilirlik kazandırmaz.
  const { error: gonderHata } = await db
    .from("assessment_finding_compensating_controls")
    .update({ durum: "INCELEMEDE" })
    .eq("id", taslak.id);
  if (gonderHata) {
    return NextResponse.json(
      { hata: gonderHata.message, id: taslak.id, durum: "TASLAK" },
      { status: 207 },
    );
  }

  return NextResponse.json({ id: taslak.id, durum: "INCELEMEDE" });
}
