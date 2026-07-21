// Dikey G1: davet edilen ilk kurum yöneticisinin İLK GİRİŞİ tamamlaması —
// KVKK + pilot kullanım şartları kabulü (hukuki delil, append-only) +
// DAVET_GONDERILDI -> ILK_GIRIS_TAMAMLANDI durum geçişi TEK çağrıda, atomik.
// Supabase'in kendi davet/parola-belirleme akışından SONRA çağrılır — bu
// rota kimlik doğrulamayı YAPMAZ, yalnız oturum sahibinin (zaten var olan)
// tenant'ında bu adımı bir KEZ işaretler (guard idempotent: zaten
// ILK_GIRIS_TAMAMLANDI ise no-op döner, hata değil).
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const BELGE_SURUMU = { KVKK: "v1", PILOT_KULLANIM_SARTLARI: "v1" } as const;

export async function POST(req: Request) {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return NextResponse.json({ hata: "Oturum gerekli." }, { status: 401 });

  const { data: profil } = await db.from("profiles").select("tenant_id").eq("id", user.id).maybeSingle();
  if (!profil?.tenant_id) return NextResponse.json({ hata: "Kurum bağlamı çözülemedi." }, { status: 400 });

  const govde = (await req.json().catch(() => ({}))) as { kvkkKabul?: boolean; sartlarKabul?: boolean };
  if (govde.kvkkKabul !== true || govde.sartlarKabul !== true) {
    return NextResponse.json({ hata: "KVKK ve pilot kullanım şartlarının kabulü zorunludur." }, { status: 400 });
  }

  const { data: provizyon } = await db
    .from("tenant_provisioning")
    .select("id, durum")
    .eq("tenant_id", profil.tenant_id)
    .maybeSingle();
  if (!provizyon) return NextResponse.json({ hata: "Provisioning kaydı bulunamadı." }, { status: 404 });

  // Zaten tamamlanmışsa idempotent no-op (çift tıklama/yeniden yükleme
  // gerçek bir hata değil — kayıt zaten bir kez üretildi).
  if (provizyon.durum !== "DAVET_GONDERILDI") {
    return NextResponse.json({ zatenTamamlandi: true, durum: provizyon.durum });
  }

  const { error: kvkkErr } = await db.from("tenant_onboarding_acceptances").insert({
    tenant_id: profil.tenant_id,
    profile_id: user.id,
    kabul_edilen_belge: "KVKK",
    belge_surumu: BELGE_SURUMU.KVKK,
  });
  if (kvkkErr) return NextResponse.json({ hata: kvkkErr.message }, { status: 400 });

  const { error: sartlarErr } = await db.from("tenant_onboarding_acceptances").insert({
    tenant_id: profil.tenant_id,
    profile_id: user.id,
    kabul_edilen_belge: "PILOT_KULLANIM_SARTLARI",
    belge_surumu: BELGE_SURUMU.PILOT_KULLANIM_SARTLARI,
  });
  if (sartlarErr) return NextResponse.json({ hata: sartlarErr.message }, { status: 400 });

  const { error: durumErr } = await db.from("tenant_provisioning").update({ durum: "ILK_GIRIS_TAMAMLANDI" }).eq("id", provizyon.id);
  if (durumErr) return NextResponse.json({ hata: durumErr.message }, { status: 400 });

  return NextResponse.json({ durum: "ILK_GIRIS_TAMAMLANDI" });
}
