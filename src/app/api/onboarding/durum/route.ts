// Dikey G1: onboarding durum makinesi geçişleri. DB trigger'ı (tenant_
// provisioning_durum_guard) hangi geçişlerin İZİNLİ olduğunu zaten zorluyor
// (ADR §7) — bu rota yalnız KİM'in hangi hedefe geçiş İSTEYEBİLECEĞİNİ
// zorlar (tenant admin kendi sihirbazını ilerletir; PILOT_AKTIF/DONDURULDU/
// SONA_ERDI yalnız platform_operator kararıdır).
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const TENANT_ADMIN_HEDEFLERI = ["KURULUM_DEVAM_EDIYOR", "KURULUM_INCELEMEDE"] as const;
const PLATFORM_OPERATOR_HEDEFLERI = ["PILOT_AKTIF", "PILOT_DONDURULDU", "PILOT_SONA_ERDI"] as const;

export async function GET() {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return NextResponse.json({ hata: "Oturum gerekli." }, { status: 401 });

  const { data: profil } = await db.from("profiles").select("role, tenant_id").eq("id", user.id).maybeSingle();
  if (!profil?.tenant_id) return NextResponse.json({ hata: "Kurum bağlamı çözülemedi." }, { status: 400 });

  const { data: provizyon } = await db
    .from("tenant_provisioning")
    .select("id, durum, pilot_baslangic, pilot_bitis, mfa_zorunlu")
    .eq("tenant_id", profil.tenant_id)
    .maybeSingle();
  if (!provizyon) return NextResponse.json({ hata: "Provisioning kaydı bulunamadı." }, { status: 404 });

  return NextResponse.json({ provisioning: provizyon });
}

export async function POST(req: Request) {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return NextResponse.json({ hata: "Oturum gerekli." }, { status: 401 });

  const { data: profil } = await db.from("profiles").select("role, tenant_id").eq("id", user.id).maybeSingle();
  const govde = (await req.json().catch(() => ({}))) as { tenantId?: string; hedefDurum?: string };
  const hedefDurum = govde.hedefDurum;

  let tenantId: string;
  if (profil?.role === "platform_operator") {
    if (!govde.tenantId) return NextResponse.json({ hata: "tenantId zorunludur." }, { status: 400 });
    if (!PLATFORM_OPERATOR_HEDEFLERI.includes(hedefDurum as (typeof PLATFORM_OPERATOR_HEDEFLERI)[number])) {
      return NextResponse.json({ hata: `Platform operatörü yalnız şu hedeflere geçebilir: ${PLATFORM_OPERATOR_HEDEFLERI.join(", ")}` }, { status: 403 });
    }
    tenantId = govde.tenantId;
  } else if (profil?.role === "admin" || profil?.role === "uyum") {
    if (!profil.tenant_id) return NextResponse.json({ hata: "Kurum bağlamı çözülemedi." }, { status: 400 });
    if (!TENANT_ADMIN_HEDEFLERI.includes(hedefDurum as (typeof TENANT_ADMIN_HEDEFLERI)[number])) {
      return NextResponse.json({ hata: `Bu rol yalnız şu hedeflere geçebilir: ${TENANT_ADMIN_HEDEFLERI.join(", ")}` }, { status: 403 });
    }
    tenantId = profil.tenant_id;
  } else {
    return NextResponse.json({ hata: "Bu işlem için yetkiniz yok." }, { status: 403 });
  }

  const { data: provizyon } = await db.from("tenant_provisioning").select("id").eq("tenant_id", tenantId).maybeSingle();
  if (!provizyon) return NextResponse.json({ hata: "Provisioning kaydı bulunamadı." }, { status: 404 });

  const { error } = await db.from("tenant_provisioning").update({ durum: hedefDurum }).eq("id", provizyon.id);
  if (error) {
    // DB guard'ı izinsiz geçişi reddetti (ör. sıra dışı atlama) — kural 14.
    return NextResponse.json({ hata: error.message, kod: "GECIS_REDDEDILDI" }, { status: 409 });
  }

  return NextResponse.json({ durum: hedefDurum });
}
