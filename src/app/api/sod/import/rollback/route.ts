// SoD import rollback TALEBİ (docs/ROADMAP.md M16 PR-3C).
//
// Talep yalnızca kayıt açar — HİÇBİR atamayı değiştirmez. Uygulama, FARKLI
// bir yetkilinin kararıyla (maker-checker) karar rotasında olur. INSERT
// kullanıcının KENDİ oturumuyla (RLS: talep_eden = auth.uid()) — audit atfı
// ve "maker" kimliği DB'de sabitlenir.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const { manifestId, gerekce } = (await req.json().catch(() => ({}))) as {
    manifestId?: string;
    gerekce?: string;
  };
  if (!manifestId) {
    return NextResponse.json({ hata: "manifestId zorunlu." }, { status: 400 });
  }
  if (!gerekce || !gerekce.trim()) {
    return NextResponse.json({ hata: "Rollback gerekçesi zorunlu." }, { status: 400 });
  }

  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) {
    return NextResponse.json({ hata: "Oturum gerekli." }, { status: 401 });
  }
  const { data: profil } = await db.from("profiles").select("role, tenant_id").eq("id", user.id).maybeSingle();
  if (profil?.role !== "admin" && profil?.role !== "uyum") {
    return NextResponse.json(
      { hata: "Rollback talebi yalnızca admin veya uyum rolünün işidir." },
      { status: 403 },
    );
  }

  // RLS altında oku: başka kiracının manifesti burada zaten görünmez (IDOR yok).
  const { data: manifest } = await db
    .from("sod_import_manifestleri")
    .select("id, ters_degisiklik")
    .eq("id", manifestId)
    .maybeSingle();
  if (!manifest) {
    return NextResponse.json({ hata: "Manifest bulunamadı." }, { status: 404 });
  }
  // Legacy manifest (bu özellikten önce uygulanmış): ters seti yok — uydurulmaz.
  if (manifest.ters_degisiklik === null) {
    return NextResponse.json(
      { hata: "Bu manifest ters değişiklik seti taşımıyor (rollback öncesi uygulanmış).", kod: "ROLLBACK_DESTEKLENMIYOR" },
      { status: 409 },
    );
  }

  const { data: talep, error: insErr } = await db
    .from("sod_import_rollbacklari")
    .insert({
      tenant_id: profil.tenant_id,
      manifest_id: manifestId,
      gerekce: gerekce.trim(),
      talep_eden: user.id,
    })
    .select("id")
    .single();
  if (insErr) {
    // Partial unique: aynı manifest için aktif talep / uygulanmış rollback var.
    if (insErr.code === "23505") {
      return NextResponse.json(
        { hata: "Bu manifest için zaten aktif bir rollback talebi veya uygulanmış rollback var.", kod: "ROLLBACK_ZATEN_VAR" },
        { status: 409 },
      );
    }
    return NextResponse.json({ hata: insErr.message }, { status: 500 });
  }

  return NextResponse.json({ talepId: talep.id, durum: "TALEP_EDILDI" });
}
