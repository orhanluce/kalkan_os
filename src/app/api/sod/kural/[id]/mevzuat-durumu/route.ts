// SoD kuralının mevzuat_durumu geçişi: TODO_DOGRULA -> VERIFIED (docs/
// ROADMAP.md M16, kural 3'ün genişletilmiş hali).
//
// NEDEN AYRI ROUTE VE AYRI YETKİ: SPK notlarından türetilen bir kuralı
// "doğrulandı" işaretlemek hukuki bir karardır, genel kural düzenleme
// yetkisiyle KARIŞTIRILAMAZ (kurucu talimatı — "genel edit yetkisiyle
// yapılamaz, ayrı uyum/hukuk yetkisi gerekir"). Bu turda ayrı bir "hukuk"
// rolü YOK (ROADMAP M16 "açık kurucu kararı #1"); geçici olarak yalnızca
// `admin` rolüne sıkıştırıldı — `uyum` rolü bile bu geçişi YAPAMAZ, çünkü
// kural yayımlama/düzenleme yetkisi `uyum`'da ama doğrulama onayı değil.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: kuralId } = await ctx.params;
  const { durum } = (await req.json().catch(() => ({}))) as { durum?: string };

  if (durum !== "VERIFIED" && durum !== "TODO_DOGRULA") {
    return NextResponse.json({ hata: "Durum 'VERIFIED' veya 'TODO_DOGRULA' olmalı." }, { status: 400 });
  }

  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) {
    return NextResponse.json({ hata: "Oturum gerekli." }, { status: 401 });
  }

  const { data: profil } = await db.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profil?.role !== "admin") {
    return NextResponse.json(
      { hata: "TODO_DOGRULA -> VERIFIED geçişi yalnızca ayrı hukuk/uyum onayı yetkisiyle yapılabilir (bu ortamda: admin)." },
      { status: 403 },
    );
  }

  // RLS altında oku: başka kiracının kuralı burada zaten görünmez.
  const { data: kural } = await db.from("sod_kurallari").select("id, mevzuat_durumu").eq("id", kuralId).maybeSingle();
  if (!kural) {
    return NextResponse.json({ hata: "Kural bulunamadı." }, { status: 404 });
  }

  const { error } = await db
    .from("sod_kurallari")
    .update({
      mevzuat_durumu: durum,
      // VERIFIED'e giderken onaylayan zorunlu (DB guard'ı da zorluyor);
      // TODO_DOGRULA'ya dönüşte onaylayan'ı temizlemiyoruz — geçmiş kaydı.
      ...(durum === "VERIFIED" ? { onaylayan: user.id } : {}),
    })
    .eq("id", kuralId);
  if (error) {
    return NextResponse.json({ hata: error.message }, { status: 500 });
  }

  return NextResponse.json({ durum });
}
