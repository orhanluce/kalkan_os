// İki ağaç başı (STH) arası append-only tutarlılık kanıtı üretir (G3 sonraki
// dilim). ?from=<eski tree_size>&to=<yeni tree_size>. Denetçi bunu DB'siz
// doğrular (verify-seffaflik.ts): kütük iki checkpoint arasında yalnız ekledi.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CONSISTENCY_SCHEMA, STH_SCHEMA, type AgacBasi, type TutarlilikKanidi } from "@/lib/transparency";
import type { DetachedImza } from "@/lib/manifest-signature";

function sthKur(row: {
  tree_size: number;
  root_hash: string;
  sth_jws: string;
  sth_kid: string;
  sth_public_jwk: unknown;
}): { sth: AgacBasi; imza: DetachedImza } {
  return {
    sth: { schema: STH_SCHEMA, treeSize: Number(row.tree_size), rootHash: row.root_hash },
    imza: { jws: row.sth_jws, kid: row.sth_kid, publicJwk: row.sth_public_jwk } as unknown as DetachedImza,
  };
}

export async function GET(req: Request) {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) {
    return NextResponse.json({ hata: "Oturum gerekli." }, { status: 401 });
  }

  const url = new URL(req.url);
  const from = Number(url.searchParams.get("from"));
  const to = Number(url.searchParams.get("to"));
  if (!Number.isInteger(from) || !Number.isInteger(to) || from <= 0 || to <= from) {
    return NextResponse.json({ hata: "0 < from < to tamsayıları zorunlu." }, { status: 400 });
  }

  const { data: prof } = await db.from("profiles").select("tenant_id").eq("id", user.id).single();
  if (!prof?.tenant_id) {
    return NextResponse.json({ hata: "Profil bulunamadı." }, { status: 403 });
  }

  const kolonlar = "tree_size, root_hash, sth_jws, sth_kid, sth_public_jwk";
  const [{ data: eski }, { data: yeni }] = await Promise.all([
    db.from("transparency_checkpoints").select(kolonlar).eq("tenant_id", prof.tenant_id).eq("tree_size", from).order("seq", { ascending: false }).limit(1).maybeSingle(),
    db.from("transparency_checkpoints").select(kolonlar).eq("tenant_id", prof.tenant_id).eq("tree_size", to).order("seq", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (!eski || !yeni) {
    return NextResponse.json({ hata: "Belirtilen boyutlarda ağaç başı bulunamadı." }, { status: 404 });
  }

  const { data: leaves } = await db
    .from("transparency_ledger_entries")
    .select("leaf_hash, leaf_index")
    .eq("tenant_id", prof.tenant_id)
    .lt("leaf_index", to)
    .order("leaf_index", { ascending: true });

  const kanit: TutarlilikKanidi = {
    schema: CONSISTENCY_SCHEMA,
    eski: sthKur(eski),
    yeni: sthKur(yeni),
    leaves: (leaves ?? []).map((l) => l.leaf_hash),
  };
  return NextResponse.json(kanit);
}
