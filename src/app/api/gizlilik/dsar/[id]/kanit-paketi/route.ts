// DSAR karşılanma kanıt paketi (M36 sonraki dilim; nihai talimat v3.2 §8.0).
// TAMAMLANDI bir DSAR için ne açıklandığını mühürleyen kanonik manifesti
// yazar — İMZALAMA/MÜHÜRLEME artık SENKRON DEĞİL: domain satırı (manifest +
// hash) AYNI transaction'da bir transactional-outbox olayı doğurur (DB
// trigger), drenaj (ledger-outbox.ts, G3'ün imza+defter mekanizmasını
// YENİDEN KULLANIR) sonradan mühürler. Bu rota, hızlı UX için drenajı AYNI
// istekte de tetikler ("otomatik" — kullanıcı ayrı bir "mühürle" adımı
// beklemez) ama mühür gecikirse durum PENDING olarak DÜRÜSTÇE döner.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ledgerOutboxDrain } from "@/lib/ledger-outbox";
import { makbuzKurEntryIcin } from "@/lib/makbuz-server";
import {
  DSAR_PACKAGE_SCHEMA,
  dsarManifestHash,
  dsarManifestKur,
  type DsarLedgerDurumu,
} from "@/lib/gizlilik";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { SeffaflikMakbuzu } from "@/lib/transparency";

/** Paketin defter durumu + (ANCHORED ise) kapsama makbuzu. Tek yerde — GET ve POST aynı mantığı kullanır. */
async function paketDurumuVeMakbuz(
  db: SupabaseClient<Database>,
  pkgId: string,
): Promise<{ durum: DsarLedgerDurumu; makbuz: SeffaflikMakbuzu | null }> {
  const { data: durum } = await db.rpc("artifact_ledger_durumu", {
    p_artifact_table: "dsar_fulfillment_packages",
    p_artifact_id: pkgId,
  });
  const d = (durum as DsarLedgerDurumu | null) ?? "KAYITSIZ";
  if (d !== "ANCHORED") {
    return { durum: d, makbuz: null };
  }
  const { data: link } = await db
    .from("artifact_ledger_links")
    .select("ledger_entry_id")
    .eq("artifact_table", "dsar_fulfillment_packages")
    .eq("artifact_id", pkgId)
    .maybeSingle();
  if (!link) {
    // Savunma: durum ANCHORED dedi ama link henüz görünmedi — dürüstçe PENDING.
    return { durum: "PENDING", makbuz: null };
  }
  const sonuc = await makbuzKurEntryIcin(db, link.ledger_entry_id);
  if (!sonuc.ok) {
    return { durum: d, makbuz: null };
  }
  return { durum: d, makbuz: sonuc.makbuz };
}

// Mühürlenmiş (veya PENDING) paket zarfını yeniden indir.
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
    .select("id, manifest, manifest_hash")
    .eq("dsar_id", dsarId)
    .maybeSingle();
  if (!pkg) {
    return NextResponse.json({ hata: "Bu DSAR için kanıt paketi yok." }, { status: 404 });
  }

  const { durum, makbuz } = await paketDurumuVeMakbuz(db, pkg.id);
  return NextResponse.json({
    schema: DSAR_PACKAGE_SCHEMA,
    manifest: pkg.manifest,
    manifestHash: pkg.manifest_hash,
    durum,
    makbuz,
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

  // Kanonik manifest (ne açıklandı) → hash. İMZALAMA YOK burada — outbox+drenaj işi.
  const manifest = dsarManifestKur({
    dsarId: dsar.id,
    tur: dsar.tur,
    veriSahibiHash: dsar.veri_sahibi_hash,
    tamamlandiAt: dsar.tamamlandi_at,
    aciklananKategoriler: kategoriler,
  });
  const manifestHash = await dsarManifestHash(manifest);

  const { data: pkg, error: pkgErr } = await db
    .from("dsar_fulfillment_packages")
    .insert({
      tenant_id: prof.tenant_id,
      dsar_id: dsar.id,
      manifest: JSON.parse(JSON.stringify(manifest)),
      manifest_hash: manifestHash,
      aciklanan_kategoriler: manifest.aciklananKategoriler,
    })
    .select("id")
    .single();
  if (pkgErr || !pkg) {
    // Zaten paket varsa (unique dsar_id) 409.
    return NextResponse.json({ hata: pkgErr?.message ?? "Paket oluşturulamadı." }, { status: 409 });
  }

  // Trigger AYNI transaction'da ledger_outbox'a olay yazdı. Hızlı UX için
  // drenajı hemen tetikle — "otomatik" (ayrı bir mühürleme adımı beklemez).
  // Başarısız olursa domain kaydı KAYBOLMAZ: durum PENDING/FAILED döner.
  await ledgerOutboxDrain(db, 5);

  const { durum, makbuz } = await paketDurumuVeMakbuz(db, pkg.id);
  return NextResponse.json({
    muhurlendi: true,
    schema: DSAR_PACKAGE_SCHEMA,
    manifest,
    manifestHash,
    durum,
    makbuz,
  });
}
