// SoD istisnasına karar verir: ONAYLA veya REDDET (docs/ROADMAP.md M16).
//
// NEDEN ROUTE (client-side Supabase update değil): "talep eden kendi
// istisnasını onaylayamaz" kuralı DB guard'ında zaten var (sod_istisna_onay_
// guard), ama route burada AYRICA "kim onaylayabilir" yetkisini (admin/uyum)
// kontrol ediyor — guard yalnızca talep=onaylayan çakışmasını yakalar, rolü
// yakalamaz.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: istisnaId } = await ctx.params;
  const { karar, notu } = (await req.json().catch(() => ({}))) as { karar?: string; notu?: string };

  if (karar !== "ONAYLA" && karar !== "REDDET") {
    return NextResponse.json({ hata: "Karar 'ONAYLA' veya 'REDDET' olmalı." }, { status: 400 });
  }
  // Onay/red gerekçesi zorunlu (kurucu talimatı) — DB'de zorlanmıyor çünkü
  // otomatik süre-dolma bir insan kararı değildir; burada, insan kararı
  // veren bu rotada zorlanıyor.
  if (!notu || !notu.trim()) {
    return NextResponse.json({ hata: "Karar gerekçesi (notu) zorunlu." }, { status: 400 });
  }

  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) {
    return NextResponse.json({ hata: "Oturum gerekli." }, { status: 401 });
  }

  const { data: profil } = await db.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profil?.role !== "admin" && profil?.role !== "uyum") {
    return NextResponse.json(
      { hata: "İstisna kararı yalnızca admin veya uyum rolünün işidir." },
      { status: 403 },
    );
  }

  // RLS altında oku: başka kiracının istisnası burada zaten görünmez.
  const { data: istisna } = await db
    .from("sod_istisnalari")
    .select("id, conflict_id, talep_eden_id, durum")
    .eq("id", istisnaId)
    .maybeSingle();
  if (!istisna) {
    return NextResponse.json({ hata: "İstisna bulunamadı." }, { status: 404 });
  }
  if (istisna.durum !== "talep_edildi") {
    return NextResponse.json({ hata: `Bu istisna zaten karara bağlanmış (${istisna.durum}).` }, { status: 409 });
  }
  // DB guard'ı da bunu zorluyor; burada erken ve anlaşılır hata veriyoruz.
  if (istisna.talep_eden_id === user.id) {
    return NextResponse.json({ hata: "Talep eden kişi kendi istisnasını onaylayamaz." }, { status: 403 });
  }

  const yeniDurum = karar === "ONAYLA" ? "onaylandi" : "reddedildi";
  const { error: updErr } = await db
    .from("sod_istisnalari")
    .update({ durum: yeniDurum, onaylayan_id: user.id, karar_notu: notu.trim() })
    .eq("id", istisnaId);
  if (updErr) {
    return NextResponse.json({ hata: updErr.message }, { status: 500 });
  }

  // Onaylandıysa çatışmayı EXCEPTION_APPROVED'a taşı — guard bunun
  // gerçekten onaylanmış bir istisnaya dayandığını yeniden doğrular.
  if (karar === "ONAYLA") {
    const { error: catismaErr } = await db
      .from("sod_catismalari")
      .update({ durum: "EXCEPTION_APPROVED" })
      .eq("id", istisna.conflict_id);
    if (catismaErr) {
      return NextResponse.json({ hata: catismaErr.message }, { status: 500 });
    }
  }

  return NextResponse.json({ karar, durum: yeniDurum });
}
