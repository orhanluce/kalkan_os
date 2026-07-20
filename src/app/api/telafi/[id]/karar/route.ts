// Dikey E, E2, Kapı 2: telafi edici kontrol kararı — AKTIF (onay) veya
// REDDEDILDI. Maker-checker: talep eden kendi kararını veremez — DB guard'ı
// (assessment_finding_cc_durum_guard) service_role atlasa bile zorlar; burada
// erken 403 daha iyi bir hata mesajı için. Session client (RLS altında),
// reviewed_by İSTEMCİDEN OKUNMAZ — her zaman oturum sahibine sabitlenir
// (guard'ın kendi kimlik atfı kontrolüyle AYNI ilke).
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
    return NextResponse.json({ hata: "Karar admin veya uyum rolünün işidir." }, { status: 403 });
  }

  let body: { karar?: string; redGerekcesi?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ hata: "Geçersiz istek gövdesi." }, { status: 400 });
  }
  if (body.karar !== "AKTIF" && body.karar !== "REDDEDILDI") {
    return NextResponse.json({ hata: "karar 'AKTIF' veya 'REDDEDILDI' olmalı." }, { status: 400 });
  }
  if (body.karar === "REDDEDILDI" && !body.redGerekcesi?.trim()) {
    return NextResponse.json({ hata: "Red gerekçesi zorunlu." }, { status: 400 });
  }

  const { data: kayit } = await db
    .from("assessment_finding_compensating_controls")
    .select("id, durum, submitted_by")
    .eq("id", id)
    .maybeSingle();
  if (!kayit) return NextResponse.json({ hata: "Telafi edici kontrol kaydı bulunamadı." }, { status: 404 });
  if (kayit.durum !== "INCELEMEDE") {
    return NextResponse.json({ hata: `Bu kayıt İNCELEMEDE durumunda değil (${kayit.durum}).` }, { status: 409 });
  }
  if (kayit.submitted_by === user.id) {
    return NextResponse.json(
      { hata: "Hazırlayan kendi telafi edici kontrolünü karara bağlayamaz (maker-checker)." },
      { status: 403 },
    );
  }

  const { error } = await db
    .from("assessment_finding_compensating_controls")
    .update({
      durum: body.karar,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      red_gerekcesi: body.karar === "REDDEDILDI" ? body.redGerekcesi!.trim() : null,
    })
    .eq("id", id);
  if (error) return NextResponse.json({ hata: error.message }, { status: 409 });

  return NextResponse.json({ id, durum: body.karar });
}
