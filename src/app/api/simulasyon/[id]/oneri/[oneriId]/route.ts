// Bulgu önerisine karar verir: KABUL gerçek bir bulgu oluşturur, RET yalnızca
// önerinin durumunu günceller (docs/ROADMAP.md M8, kural 11: "Simülasyon
// bulgusu PROPOSED doğar, insan onaylamadan gerçek bulgu olmaz").
//
// İKİ FARKLI YETKİ YOLU KASITLI:
//   - Bulgu INSERT'i kullanıcının KENDİ oturumuyla (RLS altında) yapılır —
//     böylece audit_log trigger'ı auth.uid()'i doğru yakalar ve bulguyu
//     "Sistem" değil onaylayan kişiye atfeder. Bu bir insan kararıdır,
//     otomatik bir eylem değil.
//   - Öneri UPDATE'i yalnızca service_role ile mümkündür — istemci rolleri
//     için simulation_finding_proposals'ta UPDATE politikası yoktur (RLS
//     varsayılan ret). Yetki kontrolü burada, route'ta yapılır.
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string; oneriId: string }> },
) {
  const { id: runId, oneriId } = await ctx.params;
  const { karar } = (await req.json()) as { karar?: string };

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

  const { data: katilim } = await db
    .from("simulation_participants")
    .select("katilim_tipi")
    .eq("run_id", runId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (katilim?.katilim_tipi !== "yonetici" && katilim?.katilim_tipi !== "gozlemci") {
    return NextResponse.json(
      { hata: "Öneriye yalnızca tatbikat yöneticisi veya gözlemci karar verebilir." },
      { status: 403 },
    );
  }

  // RLS altında oku: başka kiracının önerisi burada zaten görünmez.
  const { data: oneri } = await db
    .from("simulation_finding_proposals")
    .select("id, tenant_id, run_id, control_id, baslik, gerekce, onem, durum")
    .eq("id", oneriId)
    .eq("run_id", runId)
    .maybeSingle();

  if (!oneri) {
    return NextResponse.json({ hata: "Öneri bulunamadı." }, { status: 404 });
  }
  if (oneri.durum !== "PROPOSED") {
    return NextResponse.json(
      { hata: `Bu öneri zaten karara bağlanmış (${oneri.durum}).` },
      { status: 409 },
    );
  }

  let findingId: string | null = null;

  if (karar === "KABUL") {
    // Kullanıcının KENDİ oturumuyla: audit_log bu bulguyu gerçek onaylayana
    // atfetsin, "Sistem"e değil.
    const { data: finding, error: findingErr } = await db
      .from("findings")
      .insert({
        tenant_id: oneri.tenant_id,
        kaynak: "simulasyon",
        onem: oneri.onem,
        baslik: oneri.baslik,
        aksiyon_plani: null,
        durum: "acik",
      })
      .select("id")
      .single();

    if (findingErr || !finding) {
      return NextResponse.json(
        { hata: findingErr?.message ?? "Bulgu oluşturulamadı." },
        { status: 500 },
      );
    }
    findingId = finding.id;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ hata: "Sunucu yapılandırması eksik." }, { status: 500 });
  }
  const admin = createServiceClient<Database>(url, serviceKey, { auth: { persistSession: false } });

  const { error: updateErr } = await admin
    .from("simulation_finding_proposals")
    .update({
      durum: karar,
      finding_id: findingId,
      karar_veren: user.id,
      karar_at: new Date().toISOString(),
    })
    .eq("id", oneriId);

  if (updateErr) {
    return NextResponse.json({ hata: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ durum: karar, findingId });
}
