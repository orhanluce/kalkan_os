// DORA RoI export karar rotası (37 Tez Dikey B, Faz 3 ilk dilim):
// ONAY_TALEP_EDILDI → YAYINLANDI/REDDEDILDI (maker-checker: talep_eden ≠
// onaylayan, DB guard'ı zaten zorluyor — rota yalnız dürüst hata döner).
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) {
    return NextResponse.json({ hata: "Oturum gerekli." }, { status: 401 });
  }

  const govde = (await req.json().catch(() => ({}))) as { eylem?: "talep_et" | "onayla" | "reddet"; redNotu?: string };

  if (govde.eylem === "talep_et") {
    const { data, error } = await db
      .from("roi_export_runs")
      .update({ durum: "ONAY_TALEP_EDILDI" })
      .eq("id", id)
      .select("id, durum")
      .maybeSingle();
    if (error || !data) {
      return NextResponse.json({ hata: error?.message ?? "Onay talebi açılamadı." }, { status: 409 });
    }
    return NextResponse.json({ id: data.id, durum: data.durum });
  }

  if (govde.eylem === "onayla" || govde.eylem === "reddet") {
    const { data, error } = await db
      .from("roi_export_runs")
      .update({
        durum: govde.eylem === "onayla" ? "YAYINLANDI" : "REDDEDILDI",
        onaylayan: user.id,
        onay_zamani: new Date().toISOString(),
        red_notu: govde.eylem === "reddet" ? (govde.redNotu ?? null) : null,
      })
      .eq("id", id)
      .select("id, durum")
      .maybeSingle();
    if (error || !data) {
      // Maker-checker reddi (talep_eden = onaylayan) de DB guard'ından burada gelir.
      return NextResponse.json({ hata: error?.message ?? "Karar verilemedi." }, { status: 409 });
    }
    return NextResponse.json({ id: data.id, durum: data.durum });
  }

  return NextResponse.json({ hata: "Geçersiz eylem." }, { status: 400 });
}
