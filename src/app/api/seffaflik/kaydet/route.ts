// Şeffaflık defterine imzalı ifade kaydı (G3, M5.5). Bir artefakt özetini
// (statementHash) ES256 ile imzalar, kanonik yaprağı SUNUCUDA hesaplar ve
// append-only kütüğe yazar. leaf_index + hash zinciri DB seal trigger'ında.
// Tenant tablosu — service_role YOK, RLS admin/uyum yazmayı sınırlar.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { LocalDevSigner } from "@/lib/manifest-signature";
import { ifadeYaprakHash, imzaliIfadeOlustur } from "@/lib/transparency";

const HEX64 = /^[0-9a-f]{64}$/;

export async function POST(req: Request) {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) {
    return NextResponse.json({ hata: "Oturum gerekli." }, { status: 401 });
  }

  const govde = (await req.json().catch(() => ({}))) as { kind?: string; statementHash?: string };
  const kind = (govde.kind ?? "").trim();
  const statementHash = (govde.statementHash ?? "").trim().toLowerCase();
  if (!kind || !HEX64.test(statementHash)) {
    return NextResponse.json({ hata: "kind ve 64-hex statementHash zorunlu." }, { status: 400 });
  }

  const { data: prof } = await db.from("profiles").select("tenant_id").eq("id", user.id).single();
  if (!prof?.tenant_id) {
    return NextResponse.json({ hata: "Profil bulunamadı." }, { status: 403 });
  }

  // Ephemeral imzalayıcı; publicJwk imzalı ifadeyle saklanır → doğrulama
  // anahtar kaybolsa bile çalışır (manifest imza modeli). Production'da KMS.
  const signer = await LocalDevSigner.olustur();
  const ifade = await imzaliIfadeOlustur(kind, statementHash, signer);
  const leafHash = await ifadeYaprakHash(ifade);

  const { data, error } = await db
    .from("transparency_ledger_entries")
    .insert({
      tenant_id: prof.tenant_id,
      statement_kind: kind,
      statement_hash: statementHash,
      signed_statement: JSON.parse(JSON.stringify(ifade)),
      leaf_hash: leafHash,
    })
    .select("id, leaf_index")
    .single();

  if (error) {
    return NextResponse.json({ hata: error.message }, { status: 409 });
  }
  return NextResponse.json({ kaydedildi: true, id: data.id, leafIndex: Number(data.leaf_index) });
}
