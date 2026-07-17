// Tatbikat raporu PDF'i (docs/ROADMAP.md M9).
//
// NEDEN MÜHÜRLENMİŞ VERİDEN RENDER EDİYORUZ: rapor, canlı tablolardan
// yeniden toplansaydı o tablolar sonradan değiştiğinde (kurum adı
// güncellenir, kontrol eşlemesi düzeltilir) rapor sessizce başka bir şey
// söylemeye başlardı — ama üstünde hâlâ aynı mühür yazardı. Rapor, mühürlendiği
// AN'ın kaydıdır; kaynağı da o an dondurulmuş veridir (rapor_verisi kolonu).
//
// KENDİ KENDİNİ DOĞRULAR: render etmeden önce saklanan verinin hash'ini
// yeniden hesaplayıp mühürdeki rapor_hash ile karşılaştırıyoruz. Uyuşmuyorsa
// PDF ÜRETİLMEZ. Uyuşmayan bir veriden rapor basmak, üstünde "doğrulanabilir"
// yazan sahte bir belge üretmek olurdu — hiç basmamak daha dürüst.
import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { renderSimulasyonRaporuHtml } from "@/lib/simulasyon-raporu";
import { reportDataHash, type ReportData } from "@/lib/simulation-manifest";
import { createClient } from "@/lib/supabase/server";

// Playwright Node API'si gerektirir — Edge runtime'da Chromium başlatılamaz.
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

  // RLS altında oku: başka kiracının manifesti burada zaten görünmez.
  // Rapor, kiracının kendi verisidir — yetki sınırı RLS'in kendisi.
  const { data: m } = await db
    .from("simulation_result_manifests")
    .select("id, core_manifest_hash, report_data_hash, report_data, signature_kid, signer_ad")
    .eq("run_id", runId)
    .maybeSingle();

  if (!m) {
    return NextResponse.json(
      { hata: "Bu tatbikatın mühürlenmiş sonucu yok. Rapor yalnızca puanlanmış tatbikat için üretilir." },
      { status: 404 },
    );
  }

  if (!m.report_data) {
    // report_data kolonundan ÖNCE mühürlenmiş manifestler (bkz. 20260717181000).
    // Uydurma veriyle rapor basmaktansa açıkça söylemek doğru.
    return NextResponse.json(
      { hata: "Bu manifest, rapor verisi saklanmadan önce mühürlenmiş; raporu yeniden üretilemez." },
      { status: 409 },
    );
  }

  const veri = m.report_data as unknown as ReportData;

  // Kendi kendini doğrula — bkz. dosya başlığı.
  const yenidenHesaplanan = await reportDataHash(veri);
  if (yenidenHesaplanan !== m.report_data_hash) {
    return NextResponse.json(
      {
        hata: "Saklanan rapor verisi mühürle uyuşmuyor; rapor üretilmedi.",
        beklenen: m.report_data_hash,
        hesaplanan: yenidenHesaplanan,
      },
      { status: 409 },
    );
  }

  const { data: makbuz } = await db
    .from("simulation_manifest_receipts")
    .select("saglayici")
    .eq("manifest_id", m.id)
    .order("seq", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Doğrulama adresi isteğin kendi origin'inden türetilir: ortam değiştiğinde
  // (yerel, staging, canlı) QR yanlış yeri göstermesin.
  const dogrulamaUrl = new URL(`/dogrula/${m.core_manifest_hash}`, req.url).toString();
  const qrDataUrl = await QRCode.toDataURL(dogrulamaUrl, { margin: 1, width: 232 });

  // PDF yalnızca reportDataHash + coreManifestHash taşır. pdfFileHash ve
  // packageManifestHash BASILMAZ: ikisi de PDF üretildikten SONRA doğar
  // (bkz. simulation-manifest.ts'teki üretim sırası).
  const html = renderSimulasyonRaporuHtml({
    veri,
    coreManifestHash: m.core_manifest_hash,
    reportDataHash: m.report_data_hash,
    qrDataUrl,
    dogrulamaUrl,
    muhurDurumu: makbuz ? "sabitlendi" : "beklemede",
    anchorSaglayici: makbuz?.saglayici ?? null,
    imzaKid: m.signature_kid,
    imzalayici: m.signer_ad,
  });

  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    const pdf = await page.pdf({ format: "A4", printBackground: true });

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `inline; filename="tatbikat-${veri.senaryoKodu}-${m.core_manifest_hash.slice(0, 12)}.pdf"`,
        // Rapor kiracıya özel: ara katmanlar önbelleğe almasın.
        "cache-control": "private, no-store",
      },
    });
  } finally {
    await browser.close();
  }
}
