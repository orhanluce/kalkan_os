// DSAR karşılanma kanıt paketi mühürler (M36 sonraki dilim). TAMAMLANDI bir
// DSAR için: ne açıklandığını mühürleyen kanonik manifesti imzalar, şeffaflık
// defterine (G3) yazar ve paketi DSAR'a bağlar. Tenant tablosu — RLS admin/uyum;
// TAMAMLANDI şartı + tenant tutarlılığı DB guard'ında (savunma derinliği burada da).
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { LocalDevSigner } from "@/lib/manifest-signature";
import { ifadeYaprakHash, imzaliIfadeOlustur } from "@/lib/transparency";
import { DSAR_FULFILLMENT_KIND, DSAR_PACKAGE_SCHEMA, dsarManifestHash, dsarManifestKur } from "@/lib/gizlilik";

// Mühürlenmiş paketi yeniden indir (çevrimdışı doğrulanabilir JSON).
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: dsarId } = await ctx.params;
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) {
    return NextResponse.json({ hata: "Oturum gerekli." }, { status: 401 });
  }
  const { data: pkg } = await db
    .from("dsar_fulfillment_packages")
    .select("manifest, manifest_hash, signed_statement, ledger_entry_id, leaf_index")
    .eq("dsar_id", dsarId)
    .maybeSingle();
  if (!pkg) {
    return NextResponse.json({ hata: "Bu DSAR için kanıt paketi yok." }, { status: 404 });
  }
  return NextResponse.json({
    schema: DSAR_PACKAGE_SCHEMA,
    manifest: pkg.manifest,
    manifestHash: pkg.manifest_hash,
    signedStatement: pkg.signed_statement,
    ledgerEntryId: pkg.ledger_entry_id,
    leafIndex: Number(pkg.leaf_index),
  });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: dsarId } = await ctx.params;
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) {
    return NextResponse.json({ hata: "Oturum gerekli." }, { status: 401 });
  }

  const govde = (await req.json().catch(() => ({}))) as { aciklananKategoriler?: unknown };
  const kategoriler = Array.isArray(govde.aciklananKategoriler)
    ? govde.aciklananKategoriler.filter((x): x is string => typeof x === "string" && x.trim() !== "")
    : [];

  const { data: prof } = await db.from("profiles").select("tenant_id").eq("id", user.id).single();
  if (!prof?.tenant_id) {
    return NextResponse.json({ hata: "Profil bulunamadı." }, { status: 403 });
  }

  // DSAR'ı RLS altında oku (IDOR yok).
  const { data: dsar } = await db
    .from("data_subject_requests")
    .select("id, tur, veri_sahibi_hash, tamamlandi_at, durum")
    .eq("id", dsarId)
    .maybeSingle();
  if (!dsar) {
    return NextResponse.json({ hata: "DSAR bulunamadı." }, { status: 404 });
  }
  if (dsar.durum !== "TAMAMLANDI" || !dsar.tamamlandi_at) {
    return NextResponse.json({ hata: "Kanıt paketi yalnız TAMAMLANDI DSAR için mühürlenebilir." }, { status: 409 });
  }

  // Kanonik manifest (ne açıklandı) → hash → imzalı ifade → defter.
  const manifest = dsarManifestKur({
    dsarId: dsar.id,
    tur: dsar.tur,
    veriSahibiHash: dsar.veri_sahibi_hash,
    tamamlandiAt: dsar.tamamlandi_at,
    aciklananKategoriler: kategoriler,
  });
  const manifestHash = await dsarManifestHash(manifest);

  const signer = await LocalDevSigner.olustur();
  const ifade = await imzaliIfadeOlustur(DSAR_FULFILLMENT_KIND, manifestHash, signer);
  const leafHash = await ifadeYaprakHash(ifade);

  const { data: entry, error: entryErr } = await db
    .from("transparency_ledger_entries")
    .insert({
      tenant_id: prof.tenant_id,
      statement_kind: DSAR_FULFILLMENT_KIND,
      statement_hash: manifestHash,
      signed_statement: JSON.parse(JSON.stringify(ifade)),
      leaf_hash: leafHash,
    })
    .select("id, leaf_index")
    .single();
  if (entryErr) {
    return NextResponse.json({ hata: entryErr.message }, { status: 409 });
  }

  const { error: pkgErr } = await db.from("dsar_fulfillment_packages").insert({
    tenant_id: prof.tenant_id,
    dsar_id: dsar.id,
    manifest: JSON.parse(JSON.stringify(manifest)),
    manifest_hash: manifestHash,
    aciklanan_kategoriler: manifest.aciklananKategoriler,
    signed_statement: JSON.parse(JSON.stringify(ifade)),
    ledger_entry_id: entry.id,
    leaf_index: Number(entry.leaf_index),
  });
  if (pkgErr) {
    // Zaten paket varsa (unique dsar_id) 409 — defter kaydı zararsız kalır.
    return NextResponse.json({ hata: pkgErr.message }, { status: 409 });
  }

  return NextResponse.json({
    muhurlendi: true,
    schema: DSAR_PACKAGE_SCHEMA,
    manifest,
    manifestHash,
    signedStatement: ifade,
    ledgerEntryId: entry.id,
    leafIndex: Number(entry.leaf_index),
  });
}
