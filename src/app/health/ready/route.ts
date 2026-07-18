// Readiness (master talimat §26): bağımlılıklar (Supabase) erişilebilir mi.
//
// Sorgu bilinçli en ucuz: tenants'a limit(0) HEAD benzeri dokunuş — veri
// çekmez, RLS altında (anon) koşar; amaç yalnız "DB'ye ulaşabiliyor muyuz".
// Yanıtta iç hata metni SIZDIRILMAZ (kural 7) — yalnız durum.
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAyarlari } from "@/lib/supabase/env";

export const dynamic = "force-dynamic"; // cache'lenmiş "hazır" yanıtı yalan olur

export async function GET() {
  try {
    const { url, anonKey } = supabaseAyarlari();
    const db = createClient(url, anonKey, { auth: { persistSession: false } });
    const { error } = await db.from("tenants").select("id").limit(0);
    if (error) throw error;
    return NextResponse.json({ durum: "hazir", supabase: "erisilebilir" });
  } catch {
    return NextResponse.json({ durum: "hazir_degil", supabase: "erisilemiyor" }, { status: 503 });
  }
}
