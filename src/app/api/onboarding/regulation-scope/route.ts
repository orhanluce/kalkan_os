// Dikey G1: tenant'ın mevzuat kapsamını seçmesi. DB guard (tenant_regulation_
// scope_guard) yalnız hukukça VERIFIED paketleri kabul eder — "taslak paket
// varsayılan seçim olamaz" kuralı sunucu tarafında, UI gizlemesi değil.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return NextResponse.json({ hata: "Oturum gerekli." }, { status: 401 });
  const { data: profil } = await db.from("profiles").select("tenant_id").eq("id", user.id).maybeSingle();
  if (!profil?.tenant_id) return NextResponse.json({ hata: "Kurum bağlamı çözülemedi." }, { status: 400 });

  const { data: secimler } = await db
    .from("tenant_regulation_scope")
    .select("id, regulation_package_id, secim_zamani, regulation_packages(kod, ad)")
    .order("secim_zamani", { ascending: false });

  return NextResponse.json({ secimler: secimler ?? [] });
}

export async function POST(req: Request) {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return NextResponse.json({ hata: "Oturum gerekli." }, { status: 401 });

  const { data: profil } = await db.from("profiles").select("role, tenant_id").eq("id", user.id).maybeSingle();
  if (profil?.role !== "admin" && profil?.role !== "uyum") {
    return NextResponse.json({ hata: "Mevzuat kapsamı seçmek yalnız admin veya uyum rolünün işidir." }, { status: 403 });
  }
  if (!profil.tenant_id) return NextResponse.json({ hata: "Kurum bağlamı çözülemedi." }, { status: 400 });

  const govde = (await req.json().catch(() => ({}))) as { regulationPackageId?: string };
  if (!govde.regulationPackageId) return NextResponse.json({ hata: "regulationPackageId zorunludur." }, { status: 400 });

  const { data, error } = await db
    .from("tenant_regulation_scope")
    .insert({ tenant_id: profil.tenant_id, regulation_package_id: govde.regulationPackageId, secen: user.id })
    .select("id")
    .single();
  if (error || !data) {
    return NextResponse.json({ hata: error?.message ?? "Kapsam seçilemedi.", kod: "SECIM_REDDEDILDI" }, { status: 400 });
  }

  return NextResponse.json({ id: data.id });
}
