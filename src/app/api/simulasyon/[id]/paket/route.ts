// Denetim paketi ZIP'i (docs/ROADMAP.md M11, belge M01).
//
// Denetçiye verilen indirilebilir paket: çekirdek manifest + rapor verisi +
// imza + PDF + paket manifesti + BENIOKU. İçeriği ve doğrulama mantığı
// src/lib/audit-package.ts'te; burası yalnız DB'den okuyup ZIP'liyor.
//
// KENDİ KENDİNİ DOĞRULAR: ZIP'lemeden önce hem rapor verisinin hem çekirdek
// manifestin saklanan hash'ini YENİDEN hesaplayıp karşılaştırıyoruz. jsonb
// round-trip'i teoride değeri korumalı ama VARSAYMIYORUZ: uyuşmuyorsa paket
// üretilmez. "Doğrulanabilir" etiketi taşıyan bir paketin kendisi
// doğrulanamıyorsa, onu üretmek sahtekârlıktır.
import JSZip from "jszip";
import { NextResponse } from "next/server";
import { paketOlustur } from "@/lib/audit-package";
import { canonicalHash, type CanonicalDeger } from "@/lib/canonical";
import { raporPdfUret } from "@/lib/rapor-pdf";
import { reportDataHash, type CoreManifest, type ReportData } from "@/lib/simulation-manifest";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: runId } = await ctx.params;

  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) {
    return NextResponse.json({ hata: "Oturum gerekli." }, { status: 401 });
  }

  // RLS altında oku: başka kiracının manifesti burada görünmez.
  const { data: m } = await db
    .from("simulation_result_manifests")
    .select(
      "id, core_manifest, core_manifest_hash, report_data, report_data_hash, signature_jws, signature_kid, signature_public_jwk, signer_ad",
    )
    .eq("run_id", runId)
    .maybeSingle();

  if (!m) {
    return NextResponse.json({ hata: "Bu tatbikatın mühürlenmiş sonucu yok." }, { status: 404 });
  }
  if (!m.report_data || !m.core_manifest) {
    return NextResponse.json(
      { hata: "Bu manifest, tam veri saklanmadan önce mühürlenmiş; paketi üretilemez." },
      { status: 409 },
    );
  }

  const veri = m.report_data as unknown as ReportData;
  const cekirdek = m.core_manifest as unknown as CoreManifest;

  // --- Kendi kendini doğrula: iki hash de tutmalı ---
  const raporHesap = await reportDataHash(veri);
  if (raporHesap !== m.report_data_hash) {
    return NextResponse.json(
      { hata: "Rapor verisi mühürle uyuşmuyor; paket üretilmedi.", beklenen: m.report_data_hash, hesaplanan: raporHesap },
      { status: 409 },
    );
  }
  const cekirdekHesap = await canonicalHash(cekirdek as unknown as CanonicalDeger);
  if (cekirdekHesap !== m.core_manifest_hash) {
    // jsonb round-trip değeri değiştirdiyse burada yakalanır (uydurma paket üretmeyiz).
    return NextResponse.json(
      { hata: "Çekirdek manifest mühürle uyuşmuyor; paket üretilmedi.", beklenen: m.core_manifest_hash, hesaplanan: cekirdekHesap },
      { status: 409 },
    );
  }

  const dogrulamaUrl = new URL(`/dogrula/${m.core_manifest_hash}`, req.url).toString();

  const { data: makbuz } = await db
    .from("simulation_manifest_receipts")
    .select("saglayici")
    .eq("manifest_id", m.id)
    .order("seq", { ascending: false })
    .limit(1)
    .maybeSingle();

  // PDF Chromium (Playwright) ister; olmayan ortamda net 503 (bkz. rapor route).
  // ZIP paketi PDF'i içerdiği için PDF üretilemezse paket de üretilemez —
  // ama sebebi dürüstçe söylenir, opak bir 500 değil.
  let pdf: Uint8Array;
  try {
    pdf = await raporPdfUret({
      veri,
      coreManifestHash: m.core_manifest_hash,
      reportDataHash: m.report_data_hash,
      dogrulamaUrl,
      muhurDurumu: makbuz ? "sabitlendi" : "beklemede",
      anchorSaglayici: makbuz?.saglayici ?? null,
      imzaKid: m.signature_kid,
      imzalayici: m.signer_ad,
    });
  } catch (e) {
    return NextResponse.json(
      {
        hata:
          "Denetim paketi bu sunucuda üretilemiyor: PDF için Chromium başlatılamadı. " +
          "Mühür ve JWS imza geçerli; paket için Chromium destekli bir ortam gerekiyor.",
        ayrinti: e instanceof Error ? e.message : String(e),
      },
      { status: 503 },
    );
  }

  const imza = m.signature_jws
    ? {
        jws: m.signature_jws,
        kid: m.signature_kid as string,
        publicJwk: m.signature_public_jwk as unknown as JsonWebKey,
      }
    : null;

  const { dosyalar } = await paketOlustur({
    coreManifest: cekirdek,
    coreManifestHash: m.core_manifest_hash,
    reportData: veri,
    imza,
    signerAd: m.signer_ad,
    pdf,
  });

  const zip = new JSZip();
  for (const d of dosyalar) zip.file(d.ad, d.icerik);
  const zipBytes = await zip.generateAsync({ type: "uint8array" });

  return new NextResponse(zipBytes as unknown as BodyInit, {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="kalkan-denetim-${veri.senaryoKodu}-${m.core_manifest_hash.slice(0, 12)}.zip"`,
      "cache-control": "private, no-store",
    },
  });
}
