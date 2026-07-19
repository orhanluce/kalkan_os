// Dayanıklılık taksonomisi sınıflandırma rotası (Dikey 5, M21/M42) —
// regulasyon/dogrulama rotasının aynı deseni: control_resilience_domains
// GLOBAL katalogtur (obligations gibi), istemci yazma politikası bilinçli
// olarak yok. Rota, rol kapısından geçen kullanıcının kimliğiyle atıf
// alanlarını doldurup service_role ile yazar. Dört-göz DB'de zorlanır
// (resilience_dogrulama_guard); rota yalnız kimlik atfını sabitler.
//
// ROL KAPISI (K8 açık kararı uydurmadan, obligations rotasıyla aynı):
//   * oluşturma + incelemeye alma: admin veya uyum;
//   * VERIFIED/REJECTED KARARI: yalnız admin.
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
    controlId?: string;
    kategori?: string;
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
      return NextResponse.json({ hata: "Sınıflandırma önerisi admin veya uyum rolünün işidir." }, { status: 403 });
    }
    if (!govde.controlId || !govde.kategori) {
      return NextResponse.json({ hata: "controlId ve kategori zorunlu." }, { status: 400 });
    }
    const { data, error } = await service
      .from("control_resilience_domains")
      .insert({ control_id: govde.controlId, kategori: govde.kategori, gerekce: govde.gerekce ?? null })
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
    .from("control_resilience_domains")
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
