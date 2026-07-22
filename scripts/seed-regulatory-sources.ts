// WARDPROOF resmî kaynak sicili seed'i.
//
// TEK DOSYA KAYNAĞI: docs/mevzuat/wardproof/2026-07-22/source_inventory.csv
// Hashler: aynı paketteki SHA256SUMS.csv. Script önce dosyaların boyut/hash
// bütünlüğünü doğrular; sonra global regulatory_sources/source_artifacts
// siciline idempotent yazar. Hiçbir artifact VERIFIED doğmaz (kural 3).
//
//   pnpm seed:regulatory-sources -- --dry-run
//   pnpm seed:regulatory-sources
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  WARDPROOF_KAYNAK_KESIM_TARIHI,
  wardproofKontrolZinciriOlustur,
  wardproofKaynakKataloguOlustur,
  type WardproofKaynakKaydi,
} from "../src/lib/wardproof-source-catalog";
import { loadEnvLocal, requireEnv } from "./env";

const PAKET_DIR = join(
  __dirname,
  "..",
  "docs",
  "mevzuat",
  "wardproof",
  WARDPROOF_KAYNAK_KESIM_TARIHI,
);
const ENVANTER = join(PAKET_DIR, "source_inventory.csv");
const HASH_MANIFESTI = join(PAKET_DIR, "SHA256SUMS.csv");
const KONTROL_ZINCIRI = join(PAKET_DIR, "control_chain.csv");
const FETCHED_AT = `${WARDPROOF_KAYNAK_KESIM_TARIHI}T00:00:00.000Z`;

function dosyalariDogrula(katalog: WardproofKaynakKaydi[]): void {
  for (const kaynak of katalog) {
    const mutlakYol = join(PAKET_DIR, ...kaynak.localFile.split("/"));
    if (!existsSync(mutlakYol)) throw new Error(`Kaynak dosyası bulunamadı: ${kaynak.localFile}`);
    const gercekBoyut = statSync(mutlakYol).size;
    if (gercekBoyut !== kaynak.bytes)
      throw new Error(`Dosya boyutu uyuşmuyor: ${kaynak.localFile}`);
    const gercekHash = createHash("sha256").update(readFileSync(mutlakYol)).digest("hex");
    if (gercekHash !== kaynak.sha256) throw new Error(`SHA-256 uyuşmuyor: ${kaynak.localFile}`);
  }
}

async function main() {
  const katalog = wardproofKaynakKataloguOlustur(
    readFileSync(ENVANTER, "utf8"),
    readFileSync(HASH_MANIFESTI, "utf8"),
  );
  const kontrolZinciri = wardproofKontrolZinciriOlustur(
    readFileSync(KONTROL_ZINCIRI, "utf8"),
    katalog,
  );
  dosyalariDogrula(katalog);

  if (process.argv.includes("--dry-run")) {
    const dogrulanacak = katalog.filter(
      (kaynak) => kaynak.artifactDogrulamaDurumu === "TODO_DOGRULA",
    ).length;
    const taslak = katalog.length - dogrulanacak;
    console.log(
      `DRY-RUN: ${katalog.length} kaynak ve ${katalog.length} hash'li artifact doğrulandı.`,
    );
    console.log(
      `${kontrolZinciri.length} DRAFT_RESEARCH hüküm/yükümlülük doğrulandı; kontrol eşlemesi=0.`,
    );
    console.log(`TODO_DOGRULA=${dogrulanacak}, DRAFT_RESEARCH=${taslak}, VERIFIED=0`);
    console.log("DB/Storage değişikliği yapılmadı.");
    return;
  }

  const env = loadEnvLocal();
  requireEnv(env, ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  let kaynakEklenen = 0;
  let artifactEklenen = 0;
  let cekimEklenen = 0;
  let hukumEklenen = 0;
  let yukumlulukEklenen = 0;
  const artifactBySourceId = new Map<string, string>();

  for (const kaynak of katalog) {
    // Önce kalıcı WARDPROOF source_id'sini artifact.external_id üzerinden ara.
    // Böylece ileride başlık/sürüm metni değişse de aynı mevzuat kaynağı altında
    // yeni artifact sürümü doğar; başlık değişimi kopya kaynak üretmez.
    const { data: oncekiSurum, error: oncekiSurumHatasi } = await db
      .from("source_artifacts")
      .select("source_id")
      .eq("external_id", kaynak.sourceId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (oncekiSurumHatasi) throw oncekiSurumHatasi;

    const { data: mevcutKaynak, error: kaynakOkuHatasi } = await db
      .from("regulatory_sources")
      .select("id")
      .eq("authority", kaynak.authority)
      .eq("ad", kaynak.ad)
      .limit(1)
      .maybeSingle();
    if (kaynakOkuHatasi) throw kaynakOkuHatasi;

    let sourceDbId = oncekiSurum?.source_id ?? mevcutKaynak?.id;
    const kaynakKunye = {
      authority: kaynak.authority,
      jurisdiction: kaynak.jurisdiction,
      kaynak_seviyesi: kaynak.kaynakSeviyesi,
      ad: kaynak.ad,
      canonical_url: kaynak.canonicalUrl,
      erisim_politikasi_durumu: "manuel" as const,
      aktif: true,
    };
    if (sourceDbId) {
      const { error } = await db
        .from("regulatory_sources")
        .update(kaynakKunye)
        .eq("id", sourceDbId);
      if (error) throw error;
    } else {
      const { data: yeni, error } = await db
        .from("regulatory_sources")
        .insert(kaynakKunye)
        .select("id")
        .single();
      if (error || !yeni) throw error ?? new Error(`Kaynak eklenemedi: ${kaynak.sourceId}`);
      sourceDbId = yeni.id;
      kaynakEklenen++;
    }

    const { data: mevcutArtifact, error: artifactOkuHatasi } = await db
      .from("source_artifacts")
      .select("id")
      .eq("source_id", sourceDbId)
      .eq("sha256", kaynak.sha256)
      .maybeSingle();
    if (artifactOkuHatasi) throw artifactOkuHatasi;

    let artifactId = mevcutArtifact?.id;
    if (!artifactId) {
      const artifactBaslik = [
        kaynak.sourceId,
        kaynak.officialIssue,
        `sürüm/yayım: ${kaynak.publicationOrVersionDate}`,
        `yürürlük: ${kaynak.effectiveDateText}`,
      ].join(" — ");
      const { data: yeni, error } = await db
        .from("source_artifacts")
        .insert({
          source_id: sourceDbId,
          external_id: kaynak.sourceId,
          baslik: artifactBaslik,
          media_type: kaynak.mediaType,
          sha256: kaynak.sha256,
          raw_object_path: null,
          fetched_at: FETCHED_AT,
          issued_at: kaynak.issuedAt,
          effective_from: kaynak.effectiveFrom,
          language: kaynak.jurisdiction === "TR" ? "tr" : "en",
          parser_version: "wardproof-source-inventory-v1",
          dogrulama_durumu: kaynak.artifactDogrulamaDurumu,
          eklenme_kaynagi: "manuel",
        })
        .select("id")
        .single();
      if (error || !yeni) throw error ?? new Error(`Artifact eklenemedi: ${kaynak.sourceId}`);
      artifactId = yeni.id;
      artifactEklenen++;
    }

    const { data: mevcutCekim, error: cekimOkuHatasi } = await db
      .from("source_fetch_runs")
      .select("id")
      .eq("artifact_id", artifactId)
      .eq("durum", "BASARILI")
      .limit(1)
      .maybeSingle();
    if (cekimOkuHatasi) throw cekimOkuHatasi;
    if (!mevcutCekim) {
      const { error } = await db.from("source_fetch_runs").insert({
        source_id: sourceDbId,
        durum: "BASARILI",
        yontem: "manuel",
        artifact_id: artifactId,
        fetched_at: FETCHED_AT,
      });
      if (error) throw error;
      cekimEklenen++;
    }
    artifactBySourceId.set(kaynak.sourceId, artifactId);
  }

  for (const zincir of kontrolZinciri) {
    const artifactId = artifactBySourceId.get(zincir.sourceId);
    if (!artifactId) throw new Error(`Zincir için artifact bulunamadı: ${zincir.chainId}`);

    const { data: mevcutHukum, error: hukumOkuHatasi } = await db
      .from("provisions")
      .select("id, baslik, metin")
      .eq("source_artifact_id", artifactId)
      .eq("provision_ref", zincir.provisionRef)
      .eq("effective_from", zincir.effectiveFrom)
      .is("system_to", null)
      .maybeSingle();
    if (hukumOkuHatasi) throw hukumOkuHatasi;

    let provisionId = mevcutHukum?.id;
    if (mevcutHukum) {
      if (
        mevcutHukum.baslik !== zincir.provisionBaslik ||
        mevcutHukum.metin !== zincir.provisionMetni
      ) {
        throw new Error(
          `Mevcut hüküm araştırma paketiyle farklı; sessizce üzerine yazılmadı: ${zincir.chainId}`,
        );
      }
    } else {
      const { data: yeniHukum, error } = await db
        .from("provisions")
        .insert({
          source_artifact_id: artifactId,
          provision_ref: zincir.provisionRef,
          baslik: zincir.provisionBaslik,
          metin: zincir.provisionMetni,
          effective_from: zincir.effectiveFrom,
          dogrulama_durumu: zincir.dogrulamaDurumu,
          eklenme_kaynagi: "manuel",
        })
        .select("id")
        .single();
      if (error || !yeniHukum) throw error ?? new Error(`Hüküm eklenemedi: ${zincir.chainId}`);
      provisionId = yeniHukum.id;
      hukumEklenen++;
    }

    if (!provisionId) throw new Error(`Hüküm kimliği bulunamadı: ${zincir.chainId}`);
    const { data: mevcutYukumluluk, error: yukumlulukOkuHatasi } = await db
      .from("obligations")
      .select("id, baslik, amac, kanit_gereksinimi")
      .eq("provision_id", provisionId)
      .eq("kod", zincir.chainId)
      .maybeSingle();
    if (yukumlulukOkuHatasi) throw yukumlulukOkuHatasi;

    if (mevcutYukumluluk) {
      if (
        mevcutYukumluluk.baslik !== zincir.obligationBaslik ||
        mevcutYukumluluk.amac !== zincir.obligationAmac ||
        mevcutYukumluluk.kanit_gereksinimi !== zincir.evidenceRequirement
      ) {
        throw new Error(
          `Mevcut yükümlülük araştırma paketiyle farklı; sessizce üzerine yazılmadı: ${zincir.chainId}`,
        );
      }
    } else {
      const { error } = await db.from("obligations").insert({
        provision_id: provisionId,
        kod: zincir.chainId,
        baslik: zincir.obligationBaslik,
        amac: zincir.obligationAmac,
        nitelik: "zorunlu",
        kanit_gereksinimi: zincir.evidenceRequirement,
        dogrulama_durumu: zincir.dogrulamaDurumu,
        eklenme_kaynagi: "manuel",
      });
      if (error) throw error;
      yukumlulukEklenen++;
    }
  }

  console.log(
    `TAMAM: ${katalog.length} kaynak ve ${kontrolZinciri.length} araştırma zinciri işlendi; yeni kaynak=${kaynakEklenen}, artifact=${artifactEklenen}, çekim=${cekimEklenen}, hüküm=${hukumEklenen}, yükümlülük=${yukumlulukEklenen}, kontrol eşlemesi=0. VERIFIED=0.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
