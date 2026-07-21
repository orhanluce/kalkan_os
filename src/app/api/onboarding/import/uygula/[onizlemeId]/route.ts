// Dikey G1: içe aktarma UYGULA — RLS altında okunan önizlemenin id'sini
// merkezi RPC'ye (onboarding_import_uygula) geçirir. RPC kendi içinde
// maker-checker'ı (yükleyen ≠ uygulayan) ZATEN zorluyor (defense-in-depth) —
// bu rota yalnız oturum/rol/kiracı sınırını netleştirir.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(_req: Request, ctx: { params: Promise<{ onizlemeId: string }> }) {
  const { onizlemeId } = await ctx.params;
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return NextResponse.json({ hata: "Oturum gerekli." }, { status: 401 });

  const { data: profil } = await db.from("profiles").select("role, tenant_id").eq("id", user.id).maybeSingle();
  if (profil?.role !== "admin" && profil?.role !== "uyum") {
    return NextResponse.json({ hata: "İçe aktarma uygulamak yalnız admin veya uyum rolünün işidir." }, { status: 403 });
  }

  // RLS altında oku: başka kiracının önizlemesi burada zaten görünmez (IDOR yok).
  const { data: onizleme } = await db.from("onboarding_import_onizlemeleri").select("id").eq("id", onizlemeId).maybeSingle();
  if (!onizleme) return NextResponse.json({ hata: "Önizleme bulunamadı." }, { status: 404 });

  const { data, error } = await db.rpc("onboarding_import_uygula", { p_onizleme_id: onizlemeId, p_uygulayan: user.id }).single();
  if (error) {
    return NextResponse.json({ hata: error.message, kod: "UYGULAMA_REDDEDILDI" }, { status: 409 });
  }

  return NextResponse.json({ uygulananKayitSayisi: data?.uygulanan_kayit_sayisi ?? 0 });
}
