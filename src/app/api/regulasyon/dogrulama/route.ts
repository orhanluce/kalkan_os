// Hukuk doğrulama iş akışı rotası (QRegu PR-Q2a', M21 dört-göz).
//
// Üç eylem: incelemeye_al (DRAFT_RESEARCH/TODO_DOGRULA → LEGAL_REVIEW),
// onayla (LEGAL_REVIEW → VERIFIED), reddet (LEGAL_REVIEW → REJECTED).
//
// ROL KAPISI (K8 açık kararı uydurmadan, bugünkü kayıtlı durum):
//   * incelemeye alma: admin veya uyum;
//   * VERIFIED/REJECTED KARARI: yalnız admin ("VERIFIED ayrı hukuk yetkisi
//     ister — bugün admin"; hukuk-küratör rolü gelince buradaki tek satır
//     değişir).
// DÖRT GÖZ DB'DE: incelemeye alan kendi sunumunu doğrulayamaz — bu rota değil,
// `obligation_dogrulama_guard` trigger'ı zorlar (service_role bile atlayamaz);
// rota yalnız kimlik atfını oturum sahibine sabitler.
//
// NEDEN SERVICE_ROLE YAZIYOR: obligations/mappings GLOBAL referanstır ve
// istemci yazma politikası bilinçli olarak yok (bir kiracı ortak kataloğu
// değiştiremesin). Rota, rol kapısından geçen kullanıcının kimliğiyle atıf
// alanlarını doldurup service ile yazar (sod import apply deseni).
import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

const HEDEF_TABLO = {
  yukumluluk: "obligations",
  esleme: "obligation_control_mappings",
} as const;

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
    hedef?: keyof typeof HEDEF_TABLO;
    id?: string;
    eylem?: "incelemeye_al" | "onayla" | "reddet";
  };
  const tablo = govde.hedef ? HEDEF_TABLO[govde.hedef] : undefined;
  if (!tablo || !govde.id || !govde.eylem) {
    return NextResponse.json({ hata: "hedef (yukumluluk|esleme), id ve eylem zorunlu." }, { status: 400 });
  }

  if (govde.eylem === "incelemeye_al") {
    if (rol !== "admin" && rol !== "uyum") {
      return NextResponse.json({ hata: "İncelemeye alma admin veya uyum rolünün işidir." }, { status: 403 });
    }
  } else if (rol !== "admin") {
    // K8 açık: bugün hukuk doğrulama kararı admin'de.
    return NextResponse.json({ hata: "Doğrulama kararı bugün yalnızca admin rolünün işidir (K8 açık karar)." }, { status: 403 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ hata: "Sunucu yapılandırması eksik." }, { status: 500 });
  }
  const service = createServiceClient<Database>(url, serviceKey, { auth: { persistSession: false } });
  const simdi = new Date().toISOString();

  const guncelleme =
    govde.eylem === "incelemeye_al"
      ? { dogrulama_durumu: "LEGAL_REVIEW", incelemeye_alan: user.id, incelemeye_alinma_zamani: simdi }
      : govde.eylem === "onayla"
        ? { dogrulama_durumu: "VERIFIED", dogrulayan: user.id, dogrulama_zamani: simdi }
        : { dogrulama_durumu: "REJECTED", dogrulayan: user.id, dogrulama_zamani: simdi };

  const beklenenDurumlar =
    govde.eylem === "incelemeye_al" ? ["DRAFT_RESEARCH", "TODO_DOGRULA"] : ["LEGAL_REVIEW"];

  const { data: satir, error } = await service
    .from(tablo)
    .update(guncelleme)
    .eq("id", govde.id)
    .in("dogrulama_durumu", beklenenDurumlar)
    .select("id, dogrulama_durumu")
    .maybeSingle();

  if (error) {
    // Guard reddi (ör. dört-göz) iş kuralıdır: 409 + mesaj.
    return NextResponse.json({ hata: error.message }, { status: 409 });
  }
  if (!satir) {
    return NextResponse.json(
      { hata: "Kayıt bulunamadı ya da bu eylem için uygun durumda değil." },
      { status: 409 },
    );
  }
  return NextResponse.json({ id: satir.id, dogrulamaDurumu: satir.dogrulama_durumu });
}
