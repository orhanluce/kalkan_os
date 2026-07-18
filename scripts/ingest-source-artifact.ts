// KÜRATÖR aracı: resmî kaynak nüshasını (artifact) güvenli biçimde alır
// (QRegu PR-Q1'; PR-4a kararı: tenant-facing yazma yolu YOK — global katalog
// yalnız bu script/connector ile yazılır; K8 hukuk-küratör rolü AÇIK KARAR).
//
//   pnpm tsx scripts/ingest-source-artifact.ts \
//     --source "SPK Mevzuat Sistemi" --file ./teblig.pdf --baslik "VII-128.10 Tebliğ" \
//     [--external-id ...] [--issued-at 2026-01-01] [--effective-from 2026-01-01] [--language tr]
//
// AKIŞ: dosya → boyut/tür kontrolü → sha256 → Storage `raw/{sha256}`
// (içerik-adresli, idempotent) → source_artifacts satırı (TODO_DOGRULA doğar,
// kural 3) → source_fetch_runs BASARILI. Hata → BASARISIZ koşu kaydı + exit 1.
// Kaynak İÇERİĞİ uydurulmaz: bu araç yalnız GERÇEK dosyayı kayıt altına alır.
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { extname } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal, requireEnv } from "./env";

const MAX_BOYUT = 52428800; // bucket limitiyle tutarlı (50 MiB)
const MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".html": "text/html",
  ".htm": "text/html",
  ".xml": "application/xml",
  ".txt": "text/plain",
};

function arg(ad: string): string | null {
  const i = process.argv.indexOf(`--${ad}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : null;
}

async function main() {
  const kaynakArg = arg("source");
  const dosyaYolu = arg("file");
  const baslik = arg("baslik");
  if (!kaynakArg || !dosyaYolu || !baslik) {
    console.error('Kullanım: --source "<ad|id>" --file <yol> --baslik "<başlık>" [--external-id] [--issued-at] [--effective-from] [--language]');
    process.exit(2);
  }

  const env = loadEnvLocal();
  requireEnv(env, ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // Kaynağı bul (UUID ise id, değilse ad).
  const uuidMi = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(kaynakArg);
  const { data: kaynak, error: kErr } = await db
    .from("regulatory_sources")
    .select("id, ad")
    .eq(uuidMi ? "id" : "ad", kaynakArg)
    .maybeSingle();
  if (kErr || !kaynak) {
    console.error(`Kaynak bulunamadı: ${kaynakArg}`);
    process.exit(1);
  }

  /** Başarısızlığı koşu siciline yazar (hata ÖZETİ — path/secret yazılmaz). */
  async function basarisiz(ozet: string): Promise<never> {
    await db.from("source_fetch_runs").insert({ source_id: kaynak!.id, durum: "BASARISIZ", hata_ozeti: ozet });
    console.error(`BASARISIZ: ${ozet}`);
    process.exit(1);
  }

  // Dosya sınırları (güvenilmeyen girdi: boyut + izinli tür).
  const uzanti = extname(dosyaYolu).toLowerCase();
  const mime = MIME[uzanti];
  if (!mime) await basarisiz(`izin verilmeyen dosya türü: ${uzanti || "(uzantısız)"}`);
  if (statSync(dosyaYolu).size > MAX_BOYUT) await basarisiz("dosya 50 MiB sınırını aşıyor");

  const bayt = readFileSync(dosyaYolu);
  const sha256 = createHash("sha256").update(bayt).digest("hex");
  const yol = `raw/${sha256}`;

  // Storage: içerik-adresli, idempotent (aynı bayt = aynı yol; 409 = zaten var).
  const { error: upErr } = await db.storage
    .from("regulatory-source-artifacts")
    .upload(yol, bayt, { contentType: mime, upsert: false });
  if (upErr && !/already exists|duplicate/i.test(upErr.message)) {
    await basarisiz(`storage yükleme hatası: ${upErr.message}`);
  }
  console.log(upErr ? `Nesne zaten vardı (içerik-adresli): ${yol}` : `Yüklendi: ${yol}`);

  // Artifact satırı — TODO_DOGRULA doğar (kural 3); (source, sha256) unique →
  // mevcutsa yeniden yazılmaz, raw_object_path boşsa tamamlanır.
  const { data: mevcut } = await db
    .from("source_artifacts")
    .select("id, raw_object_path")
    .eq("source_id", kaynak.id)
    .eq("sha256", sha256)
    .maybeSingle();

  let artifactId: string;
  if (mevcut) {
    artifactId = mevcut.id;
    if (!mevcut.raw_object_path) {
      await db.from("source_artifacts").update({ raw_object_path: yol, fetched_at: new Date().toISOString() }).eq("id", mevcut.id);
      console.log("Mevcut artifact kaydının raw_object_path'i tamamlandı.");
    } else {
      console.log("Artifact zaten kayıtlı (idempotent).");
    }
  } else {
    const { data: yeni, error: aErr } = await db
      .from("source_artifacts")
      .insert({
        source_id: kaynak.id,
        baslik,
        sha256,
        media_type: mime,
        raw_object_path: yol,
        fetched_at: new Date().toISOString(),
        external_id: arg("external-id"),
        issued_at: arg("issued-at"),
        effective_from: arg("effective-from"),
        language: arg("language") ?? "tr",
        eklenme_kaynagi: "manuel",
      })
      .select("id")
      .single();
    if (aErr || !yeni) await basarisiz(`artifact kaydı yazılamadı: ${aErr?.message ?? "?"}`);
    artifactId = yeni!.id;
    console.log(`Artifact kaydedildi: ${artifactId} (dogrulama_durumu TODO_DOGRULA — kural 3)`);
  }

  const { error: rErr } = await db
    .from("source_fetch_runs")
    .insert({ source_id: kaynak.id, durum: "BASARILI", yontem: "manuel", artifact_id: artifactId });
  if (rErr) await basarisiz(`çekim koşusu yazılamadı: ${rErr.message}`);

  console.log(`TAMAM — kaynak "${kaynak.ad}", sha256 ${sha256.slice(0, 12)}…, çekim kaydı düşüldü.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
