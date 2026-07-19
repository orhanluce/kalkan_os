// İmzalı ağaç başı (STH / checkpoint) yayınlar (G3). Tenant'ın tüm defter
// yapraklarından Merkle kökünü üretir, ES256 ile imzalar ve append-only
// checkpoint tablosuna yazar. STH boyutu = kayıt sayısı (DB guard doğrular).
// Nitelikli RFC 3161 TSA damgası OPEN_DECISION #7 — bugün null (dürüst).
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { LocalDevSigner } from "@/lib/manifest-signature";
import { agacBasiImzala, defterKoku } from "@/lib/transparency";

export async function POST() {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) {
    return NextResponse.json({ hata: "Oturum gerekli." }, { status: 401 });
  }

  const { data: prof } = await db.from("profiles").select("tenant_id").eq("id", user.id).single();
  if (!prof?.tenant_id) {
    return NextResponse.json({ hata: "Profil bulunamadı." }, { status: 403 });
  }

  // Yapraklar leaf_index sırasıyla — Merkle kökü sıraya bağlı.
  const { data: entries } = await db
    .from("transparency_ledger_entries")
    .select("leaf_hash, leaf_index")
    .eq("tenant_id", prof.tenant_id)
    .order("leaf_index", { ascending: true });

  if (!entries || entries.length === 0) {
    return NextResponse.json({ hata: "Defterde kayıt yok; önce ifade kaydedin." }, { status: 400 });
  }

  const yapraklar = entries.map((e) => e.leaf_hash);
  const root = await defterKoku(yapraklar);
  const signer = await LocalDevSigner.olustur();
  const { imza } = await agacBasiImzala(yapraklar.length, root, signer);

  const { data, error } = await db
    .from("transparency_checkpoints")
    .insert({
      tenant_id: prof.tenant_id,
      tree_size: yapraklar.length,
      root_hash: root,
      sth_jws: imza.jws,
      sth_kid: imza.kid,
      sth_public_jwk: JSON.parse(JSON.stringify(imza.publicJwk)),
      signer_ad: signer.ad,
      timestamp_token: null,
      timestamp_saglayici: null,
    })
    .select("id, tree_size, root_hash")
    .single();

  if (error) {
    return NextResponse.json({ hata: error.message }, { status: 409 });
  }
  return NextResponse.json({
    olusturuldu: true,
    id: data.id,
    treeSize: Number(data.tree_size),
    root: data.root_hash,
  });
}
