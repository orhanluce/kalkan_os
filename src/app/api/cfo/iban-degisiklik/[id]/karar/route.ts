// IBAN değişikliği KARARI: DOGRULA veya REDDET (V2 PR-3a, ADR-V2-4).
//
// MAKER-CHECKER: talep eden kendi değişikliğini doğrulayamaz — DB guard'ı
// (supplier_bank_change_guard) service_role'de bile zorlar; burada erken 403.
// Karar service_role ile yazılır (istemci UPDATE revoke'lu).
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { karar, notu } = (await req.json().catch(() => ({}))) as { karar?: string; notu?: string };
  if (karar !== "DOGRULA" && karar !== "REDDET") {
    return NextResponse.json({ hata: "Karar 'DOGRULA' veya 'REDDET' olmalı." }, { status: 400 });
  }
  if (!notu || !notu.trim()) {
    return NextResponse.json({ hata: "Karar notu (out-of-band doğrulama özeti) zorunlu." }, { status: 400 });
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
    return NextResponse.json({ hata: "Karar yalnızca admin veya uyum rolünün işidir." }, { status: 403 });
  }

  const { data: kayit } = await db
    .from("supplier_bank_change_verifications")
    .select("id, talep_eden, durum")
    .eq("id", id)
    .maybeSingle();
  if (!kayit) {
    return NextResponse.json({ hata: "Kayıt bulunamadı." }, { status: 404 });
  }
  if (kayit.durum !== "TALEP_EDILDI") {
    return NextResponse.json({ hata: `Bu kayıt zaten karara bağlanmış (${kayit.durum}).` }, { status: 409 });
  }
  if (kayit.talep_eden === user.id) {
    return NextResponse.json(
      { hata: "Talep eden kendi IBAN değişikliğini doğrulayamaz (maker-checker)." },
      { status: 403 },
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ hata: "Sunucu yapılandırması eksik." }, { status: 500 });
  }
  const admin = createServiceClient<Database>(url, serviceKey, { auth: { persistSession: false } });

  const yeniDurum = karar === "DOGRULA" ? "DOGRULANDI" : "REDDEDILDI";
  const { error } = await admin
    .from("supplier_bank_change_verifications")
    .update({ durum: yeniDurum, dogrulayan: user.id, dogrulama_notu: notu.trim(), dogrulandi_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    return NextResponse.json({ hata: error.message }, { status: 500 });
  }
  return NextResponse.json({ karar, durum: yeniDurum });
}
