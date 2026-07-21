// Dikey G1: hukukça VERIFIED mevzuat paketleri kataloğu — salt okur. Taslak
// paketler DE görünür (UI "onay bekliyor" olarak gösterir) ama seçim rotası
// (regulation-scope) yalnız VERIFIED olanı kabul eder (DB guard).
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return NextResponse.json({ hata: "Oturum gerekli." }, { status: 401 });

  const { data: paketler } = await db
    .from("regulation_packages")
    .select("id, kod, ad, hukuk_dogrulama_durumu, kaynak_url, yayim_tarihi, surum")
    .order("ad", { ascending: true });

  return NextResponse.json({ paketler: paketler ?? [] });
}
