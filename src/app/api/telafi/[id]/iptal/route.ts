// Dikey E, E2, Kapı 2: telafi edici kontrolü iptal et (TASLAK/İNCELEMEDE/
// AKTIF → IPTAL_EDILDI). Yeniden yürürlüğe koymanın tek yolu YENİ bir kayıt
// açmak (onceki_id ile zincirlenir) — bu route mevcut kaydı MUTASYONA
// UĞRATMAZ, terminal donuk yapar (DB guard'ı zaten zorunlu kılıyor).
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return NextResponse.json({ hata: "Oturum gerekli." }, { status: 401 });
  const { data: profilRow } = await db.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profilRow?.role !== "admin" && profilRow?.role !== "uyum") {
    return NextResponse.json({ hata: "İptal admin veya uyum rolünün işidir." }, { status: 403 });
  }

  let body: { revocationReason?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ hata: "Geçersiz istek gövdesi." }, { status: 400 });
  }
  if (!body.revocationReason?.trim()) {
    return NextResponse.json({ hata: "İptal nedeni zorunlu." }, { status: 400 });
  }

  const { data: kayit } = await db
    .from("assessment_finding_compensating_controls")
    .select("id, durum")
    .eq("id", id)
    .maybeSingle();
  if (!kayit) return NextResponse.json({ hata: "Telafi edici kontrol kaydı bulunamadı." }, { status: 404 });
  if (!["TASLAK", "INCELEMEDE", "AKTIF"].includes(kayit.durum)) {
    return NextResponse.json({ hata: `Bu kayıt zaten terminal durumda (${kayit.durum}).` }, { status: 409 });
  }

  const { error } = await db
    .from("assessment_finding_compensating_controls")
    .update({
      durum: "IPTAL_EDILDI",
      revoked_by: user.id,
      revoked_at: new Date().toISOString(),
      revocation_reason: body.revocationReason.trim(),
    })
    .eq("id", id);
  if (error) return NextResponse.json({ hata: error.message }, { status: 409 });

  return NextResponse.json({ id, durum: "IPTAL_EDILDI" });
}
