// Kapsama (inclusion) makbuzu üretir (G3). Kaydı kapsayan en güncel STH'yi
// bulur, o boydaki yaprakları toplar, Merkle proof'unu üretir ve imzalı ifade
// + imzalı STH ile birlikte ÇEVRİMDIŞI doğrulanabilir makbuzu döndürür
// (scripts/verify-seffaflik.ts DB'siz doğrular). RLS okuma kendi kiracısı.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { makbuzUret, STH_SCHEMA, type AgacBasi, type SignedStatement } from "@/lib/transparency";
import type { DetachedImza } from "@/lib/manifest-signature";

export async function GET(_req: Request, ctx: { params: Promise<{ entryId: string }> }) {
  const { entryId } = await ctx.params;
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) {
    return NextResponse.json({ hata: "Oturum gerekli." }, { status: 401 });
  }

  // RLS kendi kiracısına sınırlar (IDOR yok).
  const { data: entry } = await db
    .from("transparency_ledger_entries")
    .select("tenant_id, leaf_index, signed_statement")
    .eq("id", entryId)
    .maybeSingle();
  if (!entry) {
    return NextResponse.json({ hata: "Kayıt bulunamadı." }, { status: 404 });
  }
  const leafIndex = Number(entry.leaf_index);

  // Kaydı kapsayan en büyük STH (tree_size > leaf_index).
  const { data: cp } = await db
    .from("transparency_checkpoints")
    .select("tree_size, root_hash, sth_jws, sth_kid, sth_public_jwk")
    .eq("tenant_id", entry.tenant_id)
    .gt("tree_size", leafIndex)
    .order("tree_size", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!cp) {
    return NextResponse.json(
      { hata: "Bu kaydı kapsayan ağaç başı (STH) henüz yok. Önce checkpoint oluşturun." },
      { status: 409 },
    );
  }
  const treeSize = Number(cp.tree_size);

  // STH boyundaki yapraklar, leaf_index sırasıyla (proof bu kümeye göre).
  const { data: leaves } = await db
    .from("transparency_ledger_entries")
    .select("leaf_hash, leaf_index")
    .eq("tenant_id", entry.tenant_id)
    .lt("leaf_index", treeSize)
    .order("leaf_index", { ascending: true });
  const yapraklar = (leaves ?? []).map((l) => l.leaf_hash);

  const sth: AgacBasi = { schema: STH_SCHEMA, treeSize, rootHash: cp.root_hash };
  const sthImza = {
    jws: cp.sth_jws,
    kid: cp.sth_kid,
    publicJwk: cp.sth_public_jwk,
  } as unknown as DetachedImza;

  const makbuz = await makbuzUret(
    yapraklar,
    leafIndex,
    sth,
    sthImza,
    entry.signed_statement as unknown as SignedStatement,
  );
  return NextResponse.json(makbuz);
}
