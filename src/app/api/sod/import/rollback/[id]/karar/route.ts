// SoD import rollback KARARI: ONAYLA (atomik geri alma) veya REDDET
// (docs/ROADMAP.md M16 PR-3C).
//
// MAKER-CHECKER: talep eden kendi rollback'ini karara BAĞLAYAMAZ — DB guard
// (sod_import_rollback_guard) service_role'de bile zorlar; burada erken ve
// anlaşılır 403 veriyoruz. ONAYLA gerçek geri almayı sod_import_geri_al
// RPC'siyle tek transaction'da yapar (ters seti uygula + outbox + UYGULANDI);
// REDDET yalnız durumu kapatır. Her iki karar da service_role ile yazılır —
// istemcinin rollback tablosunda UPDATE yetkisi yok.
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: talepId } = await ctx.params;
  const { karar, notu } = (await req.json().catch(() => ({}))) as { karar?: string; notu?: string };

  if (karar !== "ONAYLA" && karar !== "REDDET") {
    return NextResponse.json({ hata: "Karar 'ONAYLA' veya 'REDDET' olmalı." }, { status: 400 });
  }
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
      { hata: "Rollback kararı yalnızca admin veya uyum rolünün işidir." },
      { status: 403 },
    );
  }

  // RLS altında oku: başka kiracının talebi burada zaten görünmez.
  const { data: talep } = await db
    .from("sod_import_rollbacklari")
    .select("id, talep_eden, durum")
    .eq("id", talepId)
    .maybeSingle();
  if (!talep) {
    return NextResponse.json({ hata: "Rollback talebi bulunamadı." }, { status: 404 });
  }
  if (talep.durum !== "TALEP_EDILDI") {
    return NextResponse.json(
      { hata: `Bu talep zaten karara bağlanmış (${talep.durum}).` },
      { status: 409 },
    );
  }
  // DB guard'ı da bunu zorluyor; burada erken ve anlaşılır hata veriyoruz.
  if (talep.talep_eden === user.id) {
    return NextResponse.json(
      { hata: "Talep eden kişi kendi rollback'ini karara bağlayamaz (maker-checker)." },
      { status: 403 },
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ hata: "Sunucu yapılandırması eksik." }, { status: 500 });
  }
  const admin = createServiceClient<Database>(url, serviceKey, { auth: { persistSession: false } });

  if (karar === "REDDET") {
    const { error: updErr } = await admin
      .from("sod_import_rollbacklari")
      .update({ durum: "REDDEDILDI", onaylayan: user.id, karar_notu: notu.trim() })
      .eq("id", talepId);
    if (updErr) {
      return NextResponse.json({ hata: updErr.message }, { status: 500 });
    }
    return NextResponse.json({ karar, durum: "REDDEDILDI" });
  }

  // ONAYLA → atomik geri alma (tek transaction: ters set + outbox + UYGULANDI).
  const { data: sonuc, error: rpcErr } = await admin.rpc("sod_import_geri_al", {
    p_rollback_id: talepId,
    p_actor: user.id,
    p_karar_notu: notu.trim(),
  });
  if (rpcErr) {
    const mesaj = rpcErr.message ?? "";
    if (mesaj.includes("ROLLBACK_UYGULANAMAZ") || mesaj.includes("ROLLBACK_DESTEKLENMIYOR")) {
      return NextResponse.json({ hata: mesaj }, { status: 409 });
    }
    return NextResponse.json({ hata: mesaj || "Rollback uygulanamadı." }, { status: 500 });
  }

  const ozet = (sonuc ?? {}) as { sona_erdirilen?: number; geri_yuklenen?: number; yeniden_acilan?: number };
  return NextResponse.json({
    karar,
    durum: "UYGULANDI",
    ozet: {
      sonaErdirilen: ozet.sona_erdirilen ?? 0,
      geriYuklenen: ozet.geri_yuklenen ?? 0,
      yenidenAcilan: ozet.yeniden_acilan ?? 0,
    },
    // Outbox olayı yazıldı; değerlendirme drenajla koşar.
    degerlendirmeBeklemede: true,
  });
}
