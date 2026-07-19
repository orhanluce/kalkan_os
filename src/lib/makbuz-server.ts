// Bir şeffaflık defteri kaydı için kapsama (inclusion) makbuzu kurar — oturumlu
// (RLS) DB erişimi + G3'ün saf `makbuzUret`ini (transparency.ts) SARMALAR.
//
// NEDEN AYRI DOSYA: bu mantık iki yerden çağrılır — (1) /api/seffaflik/makbuz/
// [entryId] (doğrudan defter kaydı), (2) DSAR kanıt zarfı GET rotası (artifact_
// ledger_links üzerinden dolaylı). İki kopya iki gerçek demek olurdu (sod-kosu.ts
// ile aynı "tek motor" ilkesi).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DetachedImza } from "./manifest-signature";
import { makbuzUret, STH_SCHEMA, type AgacBasi, type SeffaflikMakbuzu, type SignedStatement } from "./transparency";
import type { Database } from "./supabase/database.types";

export type MakbuzKurSonucu =
  | { ok: true; makbuz: SeffaflikMakbuzu }
  | { ok: false; status: number; hata: string };

/**
 * `entryId`'nin kapsama makbuzunu kurar. Kaydı kapsayan en güncel STH'yi
 * bulur, o boydaki yaprakları toplar, Merkle proof'unu üretir. `db` çağıranın
 * oturumlu client'ıdır — RLS okuma kendi kiracısına sınırlar (IDOR yok).
 */
export async function makbuzKurEntryIcin(
  db: SupabaseClient<Database>,
  entryId: string,
): Promise<MakbuzKurSonucu> {
  const { data: entry } = await db
    .from("transparency_ledger_entries")
    .select("tenant_id, leaf_index, signed_statement")
    .eq("id", entryId)
    .maybeSingle();
  if (!entry) {
    return { ok: false, status: 404, hata: "Kayıt bulunamadı." };
  }
  const leafIndex = Number(entry.leaf_index);

  const { data: cp } = await db
    .from("transparency_checkpoints")
    .select("tree_size, root_hash, sth_jws, sth_kid, sth_public_jwk")
    .eq("tenant_id", entry.tenant_id)
    .gt("tree_size", leafIndex)
    .order("tree_size", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!cp) {
    return {
      ok: false,
      status: 409,
      hata: "Bu kaydı kapsayan ağaç başı (STH) henüz yok. Önce checkpoint oluşturun.",
    };
  }
  const treeSize = Number(cp.tree_size);

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
  return { ok: true, makbuz };
}
