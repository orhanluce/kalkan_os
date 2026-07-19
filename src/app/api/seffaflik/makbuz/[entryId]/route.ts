// Kapsama (inclusion) makbuzu üretir (G3). Mantık src/lib/makbuz-server.ts'te
// (DSAR kanıt zarfı rotasıyla PAYLAŞILIR — sod-kosu.ts ile aynı "tek motor"
// ilkesi); burası yalnız oturum kontrolü + HTTP durumu.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { makbuzKurEntryIcin } from "@/lib/makbuz-server";

export async function GET(_req: Request, ctx: { params: Promise<{ entryId: string }> }) {
  const { entryId } = await ctx.params;
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) {
    return NextResponse.json({ hata: "Oturum gerekli." }, { status: 401 });
  }

  const sonuc = await makbuzKurEntryIcin(db, entryId);
  if (!sonuc.ok) {
    return NextResponse.json({ hata: sonuc.hata }, { status: sonuc.status });
  }
  return NextResponse.json(sonuc.makbuz);
}
