// Dikey G1 (docs/adr/PR0-dikeyG-g1-pilot-provisioning-onboarding-2026-07-22.md):
// yalnız platform_operator'ın işi — yeni pilot tenant açar + ilk kurum
// yöneticisini davet eder. Self-servis DEĞİL (kural: açık internetten "Kayıt
// Ol" yok — bu rota her zaman platform_operator oturumu ister).
//
// service_role YALNIZ Supabase Auth admin API için kullanılır (inviteUserByEmail
// — bunun bir session-client eşdeğeri yok, Admin API zorunlu). tenant/
// provisioning/profile yazmaları SESSION client'la (RLS altında, platform_
// operator'ın kendi yetkisiyle) yapılır — service_role doğrudan istemciden
// çağrılmaz, yalnız bu rotanın İÇİNDE ve yalnız invite adımında kullanılır.
import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

const GECERLI_SEGMENTLER = ["araci_kurum", "pys", "kvhs", "diger"] as const;

export async function POST(req: Request) {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return NextResponse.json({ hata: "Oturum gerekli." }, { status: 401 });

  const { data: profil } = await db.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profil?.role !== "platform_operator") {
    return NextResponse.json({ hata: "Pilot tenant oluşturmak yalnız platform operatörünün işidir." }, { status: 403 });
  }

  const govde = (await req.json().catch(() => ({}))) as {
    kurumAdi?: string;
    segment?: string;
    davetEdilenEposta?: string;
    pilotBaslangic?: string;
    pilotBitis?: string;
    mfaZorunlu?: boolean;
  };

  const kurumAdi = govde.kurumAdi?.trim();
  const davetEdilenEposta = govde.davetEdilenEposta?.trim().toLowerCase();
  const segment = govde.segment ?? "diger";
  if (!kurumAdi) return NextResponse.json({ hata: "Kurum adı zorunludur." }, { status: 400 });
  if (!davetEdilenEposta || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(davetEdilenEposta)) {
    return NextResponse.json({ hata: "Geçerli bir davet e-postası zorunludur." }, { status: 400 });
  }
  if (!GECERLI_SEGMENTLER.includes(segment as (typeof GECERLI_SEGMENTLER)[number])) {
    return NextResponse.json({ hata: "Geçersiz segment." }, { status: 400 });
  }

  // Kural (ADR §4): aynı e-posta BAŞKA bir tenant'ta zaten profile sahipse
  // AÇIKÇA reddedilir — sessizce üzerine yazılmaz, sessizce göz ardı edilmez.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return NextResponse.json({ hata: "Sunucu yapılandırması eksik." }, { status: 500 });
  const admin = createServiceClient<Database>(url, serviceKey, { auth: { persistSession: false } });

  const { data: existingUsers } = await admin.auth.admin.listUsers();
  const existingUser = existingUsers?.users.find((u) => u.email?.toLowerCase() === davetEdilenEposta);
  if (existingUser) {
    const { data: existingProfil } = await admin.from("profiles").select("tenant_id").eq("id", existingUser.id).maybeSingle();
    if (existingProfil?.tenant_id) {
      return NextResponse.json(
        { hata: "Bu e-posta zaten başka bir kurumda kayıtlı. Çoklu-tenant üyeliği bu dilimde desteklenmiyor.", kod: "EMAIL_BASKA_TENANTA_BAGLI" },
        { status: 409 },
      );
    }
  }

  // 1) Tenant — session client (platform_operator'ın kendi RLS yetkisi).
  const { data: tenant, error: tenantErr } = await db.from("tenants").insert({ name: kurumAdi, segment }).select("id").single();
  if (tenantErr || !tenant) {
    return NextResponse.json({ hata: tenantErr?.message ?? "Tenant oluşturulamadı." }, { status: 400 });
  }

  // 2) Davet — Supabase Auth'un KENDİ tek-kullanımlık/süreli/e-postaya-kilitli
  //    invite mekanizması (özel bir token tablosu yazılmıyor).
  const { data: invited, error: inviteErr } = existingUser
    ? { data: { user: existingUser }, error: null }
    : await admin.auth.admin.inviteUserByEmail(davetEdilenEposta, { redirectTo: `${new URL(req.url).origin}/ilk-giris` });
  if (inviteErr || !invited?.user) {
    return NextResponse.json({ hata: inviteErr?.message ?? "Davet gönderilemedi." }, { status: 400 });
  }

  // 3) İlk profil (TENANT_ADMIN = role: 'admin') — session client, platform_
  //    operator'ın kendi yetkisiyle (profiles_insert_platform_operator).
  const { error: profilErr } = await db.from("profiles").insert({
    id: invited.user.id,
    tenant_id: tenant.id,
    role: "admin",
    full_name: davetEdilenEposta.split("@")[0],
  });
  if (profilErr) {
    return NextResponse.json({ hata: `Kurum oluştu ama ilk profil bağlanamadı: ${profilErr.message}` }, { status: 400 });
  }

  // 4) Provisioning kaydı — HAZIRLIK olarak doğar, davet ile aynı anda
  //    DAVET_GONDERILDI'ye geçirilir (guard'lı tek adım geçişi).
  const { data: provizyon, error: provErr } = await db
    .from("tenant_provisioning")
    .insert({
      tenant_id: tenant.id,
      olusturan: user.id,
      davet_edilen_eposta: davetEdilenEposta,
      davet_edilen_kullanici_id: invited.user.id,
      pilot_baslangic: govde.pilotBaslangic ?? null,
      pilot_bitis: govde.pilotBitis ?? null,
      mfa_zorunlu: govde.mfaZorunlu ?? true,
    })
    .select("id")
    .single();
  if (provErr || !provizyon) {
    return NextResponse.json({ hata: provErr?.message ?? "Provisioning kaydı oluşturulamadı." }, { status: 400 });
  }
  const { error: durumErr } = await db.from("tenant_provisioning").update({ durum: "DAVET_GONDERILDI" }).eq("id", provizyon.id);
  if (durumErr) {
    return NextResponse.json({ hata: durumErr.message }, { status: 400 });
  }

  return NextResponse.json({
    tenantId: tenant.id,
    provisioningId: provizyon.id,
    davetEdilenKullaniciId: invited.user.id,
  });
}

export async function GET() {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return NextResponse.json({ hata: "Oturum gerekli." }, { status: 401 });
  const { data: profil } = await db.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profil?.role !== "platform_operator") {
    return NextResponse.json({ hata: "Yalnız platform operatörünün işidir." }, { status: 403 });
  }

  const { data: kayitlar } = await db
    .from("tenant_provisioning")
    .select("id, tenant_id, durum, davet_edilen_eposta, pilot_baslangic, pilot_bitis, created_at, tenants(name)")
    .order("created_at", { ascending: false });

  return NextResponse.json({ kayitlar: kayitlar ?? [] });
}
