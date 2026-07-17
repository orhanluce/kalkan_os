// Kontrol testi bulgu önerisine karar verir: KABUL gerçek bir bulgu oluşturur,
// RET yalnızca önerinin durumunu günceller (docs/ROADMAP.md M12, kural 11 + 14).
//
// M8'in simülasyon öneri rotasının aynı deseni:
//   - Bulgu INSERT'i kullanıcının KENDİ oturumuyla (RLS altında) — audit_log
//     trigger'ı auth.uid()'i doğru yakalayıp bulguyu "Sistem" değil onaylayana
//     atfetsin. Bu bir insan kararıdır.
//   - Öneri UPDATE'i yalnızca service_role ile — istemci rolleri için
//     control_test_finding_proposals'ta UPDATE politikası yok (revoke edildi).
//
// KURAL 14 BURADA BAŞLAR: kontrol testinden doğan bulgu `retest_gerekli`
// taşır (tanımdan gelir). Kapanışı verified closure guard'ı zorlar — başarılı
// retest + onay olmadan kapanamaz (bkz. 20260717240000).
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request, ctx: { params: Promise<{ oneriId: string }> }) {
  const { oneriId } = await ctx.params;
  const { karar } = (await req.json().catch(() => ({}))) as { karar?: string };

  if (karar !== "KABUL" && karar !== "RET") {
    return NextResponse.json({ hata: "Karar 'KABUL' veya 'RET' olmalı." }, { status: 400 });
  }

  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) {
    return NextResponse.json({ hata: "Oturum gerekli." }, { status: 401 });
  }

  const { data: profil } = await db
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profil?.role !== "admin" && profil?.role !== "uyum") {
    return NextResponse.json(
      { hata: "Öneriye yalnızca admin veya uyum rolü karar verebilir." },
      { status: 403 },
    );
  }

  // RLS altında oku: başka kiracının önerisi burada zaten görünmez.
  const { data: oneri } = await db
    .from("control_test_finding_proposals")
    .select("id, tenant_id, control_id, test_definition_id, baslik, gerekce, onem, durum")
    .eq("id", oneriId)
    .maybeSingle();
  if (!oneri) {
    return NextResponse.json({ hata: "Öneri bulunamadı." }, { status: 404 });
  }
  if (oneri.durum !== "PROPOSED") {
    return NextResponse.json({ hata: `Bu öneri zaten karara bağlanmış (${oneri.durum}).` }, { status: 409 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ hata: "Sunucu yapılandırması eksik." }, { status: 500 });
  }
  const admin = createServiceClient<Database>(url, serviceKey, { auth: { persistSession: false } });

  let findingId: string | null = null;

  if (karar === "KABUL") {
    // Kapanış retest ister mi — tanımdan gelir (kural 14).
    const { data: tanim } = await db
      .from("control_test_definitions")
      .select("retest_gerekli")
      .eq("id", oneri.test_definition_id)
      .maybeSingle();

    // Kullanıcının KENDİ oturumuyla: audit_log bulguyu gerçek onaylayana atfetsin.
    const { data: finding, error: findingErr } = await db
      .from("findings")
      .insert({
        tenant_id: oneri.tenant_id,
        kaynak: "kontrol_testi",
        onem: oneri.onem,
        baslik: oneri.baslik,
        durum: "acik",
        retest_gerekli: tanim?.retest_gerekli ?? true,
        kaynak_test_definition_id: oneri.test_definition_id,
      })
      .select("id")
      .single();
    if (findingErr) {
      return NextResponse.json({ hata: findingErr.message }, { status: 500 });
    }
    findingId = finding.id;
  }

  const { error: updErr } = await admin
    .from("control_test_finding_proposals")
    .update({
      durum: karar,
      finding_id: findingId,
      karar_veren: user.id,
      karar_at: new Date().toISOString(),
    })
    .eq("id", oneriId);
  if (updErr) {
    return NextResponse.json({ hata: updErr.message }, { status: 500 });
  }

  return NextResponse.json({ karar, findingId });
}
