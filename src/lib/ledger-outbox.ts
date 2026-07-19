// Transactional outbox drenajı — genel artefakt→şeffaflık defteri köprüsü
// (nihai talimat v3.2 §8.0). Domain trigger'ları (test_runs, dsar_fulfillment_
// packages) AYNI transaction'da `ledger_outbox`'a olay yazar; bu modül o
// olayları RACE-SAFE claim eder (RPC: ledger_outbox_claim, FOR UPDATE SKIP
// LOCKED), her biri için artefakta özgü kanonik manifesti kurar, G3'ün
// imzalama+defter mekanizmasını (transparency.ts, YENİDEN KULLANILIR — hiçbir
// kripto burada tekrar yazılmaz) çağırıp mühürler ve olayı PROCESSED'e taşır.
//
// NEDEN TS'TE (kural 4 + kural 11): imzalama Web Crypto ister, plpgsql'de
// yapılamaz; manifest kuralları (hangi alanlar, nasıl kanonikleşir) tek
// yerde kalmalı — sod-kosu.ts ile aynı "tek motor" ilkesi.
//
// DÜRÜSTLÜK: bir artefakt türü ARTIFACT_MANIFEST_BUILDERS'ta yoksa (henüz
// wiring yapılmamış) olay FAILED'e düşürülür — sessizce yutulmaz, görünür
// kalır (reconciliation).
import type { SupabaseClient } from "@supabase/supabase-js";
import { canonicalHash, type CanonicalDeger } from "./canonical";
import { controlTestRunManifestHash, controlTestRunManifestKur, CONTROL_TEST_RUN_KIND } from "./kontrol-test-ledger";
import { dsarManifestHash, DSAR_FULFILLMENT_KIND, type DsarManifest } from "./gizlilik";
import { LocalDevSigner } from "./manifest-signature";
import { ifadeYaprakHash, imzaliIfadeOlustur } from "./transparency";
import type { Database } from "./supabase/database.types";

export interface ManifestSonucu {
  kind: string;
  hash: string;
}

type Db = SupabaseClient<Database>;

/** Artefakt türüne göre kanonik manifest + hash kurar. Bulunamayan tür → null. */
async function manifestKur(db: Db, artifactTable: string, artifactId: string): Promise<ManifestSonucu | null> {
  if (artifactTable === "test_runs") {
    const { data: run } = await db
      .from("test_runs")
      .select("id, control_id, test_definition_id, sonuc, gerekce, tanim_surumu, calisti_at, evidence_id")
      .eq("id", artifactId)
      .maybeSingle();
    if (!run) return null;
    const manifest = controlTestRunManifestKur({
      testRunId: run.id,
      controlId: run.control_id,
      testDefinitionId: run.test_definition_id,
      sonuc: run.sonuc,
      gerekce: run.gerekce,
      tanimSurumu: run.tanim_surumu,
      calistiAt: run.calisti_at,
      evidenceId: run.evidence_id,
    });
    return { kind: CONTROL_TEST_RUN_KIND, hash: await controlTestRunManifestHash(manifest) };
  }

  if (artifactTable === "dsar_fulfillment_packages") {
    const { data: pkg } = await db
      .from("dsar_fulfillment_packages")
      .select("id, manifest, manifest_hash")
      .eq("id", artifactId)
      .maybeSingle();
    if (!pkg) return null;
    // Savunma derinliği: domain satırının kendi hash'ini KÖRLEMESİNE
    // GÜVENMEK yerine kanonik manifestten YENİDEN hesapla ve karşılaştır —
    // ikisi ayrışırsa (bir hata/kurcalama) burada yakalanır, sessizce
    // yanlış hash mühürlenmez.
    const yenidenHesap = await dsarManifestHash(pkg.manifest as unknown as DsarManifest);
    if (yenidenHesap !== pkg.manifest_hash) {
      throw new Error(
        `DSAR paketi ${artifactId}: kayıtlı manifest_hash yeniden hesaplanan ile uyuşmuyor (${pkg.manifest_hash} != ${yenidenHesap})`,
      );
    }
    return { kind: DSAR_FULFILLMENT_KIND, hash: pkg.manifest_hash };
  }

  return null;
}

export interface DrenajSonucu {
  islenen: number;
  basarisiz: number;
}

/**
 * Bekleyen olayları claim eder (RPC, race-safe), her birini imzalayıp
 * deftere yazar ve mark_processed/mark_failed ile kapatır. `db` çağıranın
 * oturumlu client'ı (RLS + audit atıfı doğru kişiye işler — sod-kosu.ts ile
 * aynı desen). Bir olayın başarısızlığı diğerlerini durdurmaz.
 */
export async function ledgerOutboxDrain(db: Db, limit = 10): Promise<DrenajSonucu> {
  const { data: claimed, error: claimErr } = await db.rpc("ledger_outbox_claim", { p_limit: limit });
  if (claimErr || !claimed) {
    return { islenen: 0, basarisiz: 0 };
  }

  let islenen = 0;
  let basarisiz = 0;

  for (const olay of claimed) {
    try {
      const manifestSonuc = await manifestKur(db, olay.artifact_table, olay.artifact_id);
      if (!manifestSonuc) {
        throw new Error(`Artefakt turu icin manifest kurulamadi: ${olay.artifact_table} (${olay.artifact_id})`);
      }

      const signer = await LocalDevSigner.olustur();
      const ifade = await imzaliIfadeOlustur(manifestSonuc.kind, manifestSonuc.hash, signer);
      const leafHash = await ifadeYaprakHash(ifade);

      const { data: entry, error: entryErr } = await db
        .from("transparency_ledger_entries")
        .insert({
          tenant_id: olay.tenant_id,
          statement_kind: manifestSonuc.kind,
          statement_hash: manifestSonuc.hash,
          signed_statement: JSON.parse(JSON.stringify(ifade)),
          leaf_hash: leafHash,
        })
        .select("id")
        .single();
      if (entryErr || !entry) {
        throw new Error(entryErr?.message ?? "Defter kaydi olusturulamadi");
      }

      const { error: markErr } = await db.rpc("ledger_outbox_mark_processed", {
        p_id: olay.id,
        p_ledger_entry_id: entry.id,
      });
      if (markErr) {
        throw new Error(markErr.message);
      }
      islenen++;
    } catch (e) {
      basarisiz++;
      const mesaj = e instanceof Error ? e.message : String(e);
      await db.rpc("ledger_outbox_mark_failed", { p_id: olay.id, p_hata: mesaj });
    }
  }

  return { islenen, basarisiz };
}

/** İç kullanım: test/tanılama için kanonik hash yardımcı (dispatch'siz). */
export function genelKanonikHash(value: CanonicalDeger): Promise<string> {
  return canonicalHash(value);
}
