// ISO 42001↔27001 crosswalk dört-göz rotası (Dikey 4 kalanı) —
// /api/dayaniklilik/siniflandirma ve /api/regulasyon/dogrulama ile AYNI desen:
// GLOBAL katalog, istemci yazma politikası bilinçli olarak yok, service_role
// rol kapısından geçen kullanıcının kimliğiyle atıf alanlarını doldurup yazar.
//
// KURAL 3 + TELİF: bu rota standart METNİ yazmaz — yalnız kısa madde referans
// kodu + ilişki türü + küratörün kendi gerekçe metni.
import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) {
    return NextResponse.json({ hata: "Oturum gerekli." }, { status: 401 });
  }
  const { data: profil } = await db.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const rol = profil?.role;

  const govde = (await req.json().catch(() => ({}))) as {
    eylem?: "olustur" | "incelemeye_al" | "onayla" | "reddet";
    id?: string;
    iso42001Ref?: string;
    iso27001Ref?: string;
    iliskiTuru?: string;
    gerekce?: string;
  };

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ hata: "Sunucu yapılandırması eksik." }, { status: 500 });
  }
  const service = createServiceClient<Database>(url, serviceKey, { auth: { persistSession: false } });
  const simdi = new Date().toISOString();

  if (govde.eylem === "olustur") {
    if (rol !== "admin" && rol !== "uyum") {
      return NextResponse.json({ hata: "Crosswalk önerisi admin veya uyum rolünün işidir." }, { status: 403 });
    }
    if (!govde.iso42001Ref?.trim() || !govde.iso27001Ref?.trim()) {
      return NextResponse.json({ hata: "iso42001Ref ve iso27001Ref zorunlu." }, { status: 400 });
    }
    const { data, error } = await service
      .from("iso_42001_27001_crosswalk")
      .insert({
        iso42001_ref: govde.iso42001Ref.trim(),
        iso27001_ref: govde.iso27001Ref.trim(),
        iliski_turu: govde.iliskiTuru ?? "KISMEN_ORTUSUYOR",
        gerekce: govde.gerekce ?? null,
      })
      .select("id, dogrulama_durumu")
      .single();
    if (error) return NextResponse.json({ hata: error.message }, { status: 409 });
    return NextResponse.json({ id: data.id, dogrulamaDurumu: data.dogrulama_durumu });
  }

  if (!govde.id || !govde.eylem) {
    return NextResponse.json({ hata: "id ve eylem zorunlu." }, { status: 400 });
  }

  if (govde.eylem === "incelemeye_al") {
    if (rol !== "admin" && rol !== "uyum") {
      return NextResponse.json({ hata: "İncelemeye alma admin veya uyum rolünün işidir." }, { status: 403 });
    }
  } else if (rol !== "admin") {
    return NextResponse.json({ hata: "Doğrulama kararı bugün yalnızca admin rolünün işidir (K8 açık karar)." }, { status: 403 });
  }

  const guncelleme =
    govde.eylem === "incelemeye_al"
      ? { dogrulama_durumu: "LEGAL_REVIEW", incelemeye_alan: user.id, incelemeye_alinma_zamani: simdi }
      : govde.eylem === "onayla"
        ? { dogrulama_durumu: "VERIFIED", dogrulayan: user.id, dogrulama_zamani: simdi }
        : { dogrulama_durumu: "REJECTED", dogrulayan: user.id, dogrulama_zamani: simdi };

  const beklenenDurumlar = govde.eylem === "incelemeye_al" ? ["DRAFT_RESEARCH", "TODO_DOGRULA"] : ["LEGAL_REVIEW"];

  const { data: satir, error } = await service
    .from("iso_42001_27001_crosswalk")
    .update(guncelleme)
    .eq("id", govde.id)
    .in("dogrulama_durumu", beklenenDurumlar)
    .select("id, dogrulama_durumu")
    .maybeSingle();

  if (error) return NextResponse.json({ hata: error.message }, { status: 409 });
  if (!satir) {
    return NextResponse.json({ hata: "Kayıt bulunamadı ya da bu eylem için uygun durumda değil." }, { status: 409 });
  }
  return NextResponse.json({ id: satir.id, dogrulamaDurumu: satir.dogrulama_durumu });
}
