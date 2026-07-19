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
import {
  TPR_ASSESSMENT_SIGNOFF_KIND,
  TPR_CRITICAL_FINDING_CLOSURE_KIND,
  tprAssessmentSignoffManifestHash,
  tprAssessmentSignoffManifestKur,
  tprCriticalFindingClosureManifestHash,
  tprCriticalFindingClosureManifestKur,
} from "./tedarikci-ledger";
import {
  AI_INCIDENT_CLOSURE_KIND,
  aiIncidentClosureManifestHash,
  aiIncidentClosureManifestKur,
  type OlayCiddiyet,
} from "./ai-olay";
import {
  AI_RECEIPT_DECISION_SCHEMA,
  aiReceiptDecisionManifestHash,
  aiReceiptDecisionManifestKur,
  aiReceiptFingerprint,
} from "./ai-receipt";
import {
  BOARD_DECLARATION_ATTESTATION_KIND,
  boardDeclarationAttestationManifestHash,
  boardDeclarationAttestationManifestKur,
} from "./board-declaration-ledger";
import { LocalDevSigner } from "./manifest-signature";
import { ifadeYaprakHash, imzaliIfadeOlustur } from "./transparency";
import type { Database } from "./supabase/database.types";

const AI_RECEIPT_DECISION_KIND = "AI_RECEIPT_DECISION" as const;
void AI_RECEIPT_DECISION_SCHEMA;

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
      .select(
        "id, control_id, test_definition_id, sonuc, gerekce, tanim_surumu, calisti_at, evidence_id, beklenen_sonuc, performans_etkisi, yanlis_pozitif, yanlis_negatif, baslangic_at, bitis_at, log_referanslari, hazirlayan, sorumlu, bagimsiz_onaylayan",
      )
      .eq("id", artifactId)
      .maybeSingle();
    if (!run) return null;
    // Sabit kapsam tanımdan gelir (V2 zengin snapshot).
    const { data: tanim } = await db
      .from("control_test_definitions")
      .select("amac, kapsam, hedef_varlik, kritik_hizmet_adi, senaryo_kimligi, senaryo_surumu")
      .eq("id", run.test_definition_id)
      .maybeSingle();
    const manifest = controlTestRunManifestKur({
      testRunId: run.id,
      controlId: run.control_id,
      testDefinitionId: run.test_definition_id,
      tanimSurumu: run.tanim_surumu,
      amac: tanim?.amac ?? null,
      kapsam: tanim?.kapsam ?? null,
      hedefVarlik: tanim?.hedef_varlik ?? null,
      kritikHizmetAdi: tanim?.kritik_hizmet_adi ?? null,
      senaryoKimligi: tanim?.senaryo_kimligi ?? null,
      senaryoSurumu: tanim?.senaryo_surumu ?? null,
      sonuc: run.sonuc,
      gerekce: run.gerekce,
      beklenenSonuc: run.beklenen_sonuc,
      performansEtkisi: run.performans_etkisi,
      yanlisPozitif: run.yanlis_pozitif,
      yanlisNegatif: run.yanlis_negatif,
      baslangicAt: run.baslangic_at,
      bitisAt: run.bitis_at,
      calistiAt: run.calisti_at,
      logReferanslari: (run.log_referanslari as { ad: string; hash: string | null }[] | null) ?? [],
      hazirlayan: run.hazirlayan,
      sorumlu: run.sorumlu,
      bagimsizOnaylayan: run.bagimsiz_onaylayan,
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

  if (artifactTable === "third_party_assessments") {
    const { data: a } = await db
      .from("third_party_assessments")
      .select("id, third_party_id, tur, degerlendiren, tamamlandi_at")
      .eq("id", artifactId)
      .maybeSingle();
    if (!a) return null;
    if (!a.degerlendiren || !a.tamamlandi_at) {
      throw new Error(`Assessment ${artifactId}: sign-off için degerlendiren + tamamlandi_at zorunlu (henüz TAMAMLANDI değil?)`);
    }
    const manifest = tprAssessmentSignoffManifestKur({
      assessmentId: a.id,
      thirdPartyId: a.third_party_id,
      tur: a.tur,
      degerlendiren: a.degerlendiren,
      tamamlandiAt: a.tamamlandi_at,
    });
    return { kind: TPR_ASSESSMENT_SIGNOFF_KIND, hash: await tprAssessmentSignoffManifestHash(manifest) };
  }

  if (artifactTable === "assessment_findings") {
    const { data: f } = await db
      .from("assessment_findings")
      .select("id, assessment_id, third_party_id, baslik, kapanis_kanit, kapatan, kapanis_zamani")
      .eq("id", artifactId)
      .maybeSingle();
    if (!f) return null;
    if (!f.kapanis_kanit || !f.kapatan || !f.kapanis_zamani) {
      throw new Error(`Finding ${artifactId}: kapanış manifesti için kanıt + kapatan + zaman zorunlu`);
    }
    const manifest = tprCriticalFindingClosureManifestKur({
      findingId: f.id,
      assessmentId: f.assessment_id,
      thirdPartyId: f.third_party_id,
      baslik: f.baslik,
      kapanisKanit: f.kapanis_kanit,
      kapatan: f.kapatan,
      kapanisZamani: f.kapanis_zamani,
    });
    return { kind: TPR_CRITICAL_FINDING_CLOSURE_KIND, hash: await tprCriticalFindingClosureManifestHash(manifest) };
  }

  if (artifactTable === "ai_incidents") {
    const { data: o } = await db
      .from("ai_incidents")
      .select("id, ai_system_id, ciddiyet, kapanis_kanit, kapatan, kapanis_zamani")
      .eq("id", artifactId)
      .maybeSingle();
    if (!o) return null;
    if (!o.kapanis_kanit || !o.kapatan || !o.kapanis_zamani) {
      throw new Error(`AI olay ${artifactId}: kapanış manifesti için kanıt + kapatan + zaman zorunlu`);
    }
    const manifest = aiIncidentClosureManifestKur({
      incidentId: o.id,
      aiSystemId: o.ai_system_id,
      ciddiyet: o.ciddiyet as OlayCiddiyet,
      kapanisKanit: o.kapanis_kanit,
      kapatan: o.kapatan,
      kapanisZamani: o.kapanis_zamani,
    });
    return { kind: AI_INCIDENT_CLOSURE_KIND, hash: await aiIncidentClosureManifestHash(manifest) };
  }

  if (artifactTable === "ai_execution_receipts") {
    const { data: r } = await db
      .from("ai_execution_receipts")
      .select("id, ai_system_id, ai_agent_id, amac, model_saglayici, model_id, model_surum, prompt_hash, kaynak_hash, confidence, fingerprint, karar, reviewer, reviewer_karar_zamani")
      .eq("id", artifactId)
      .maybeSingle();
    if (!r) return null;
    if ((r.karar !== "ACCEPTED" && r.karar !== "REJECTED") || !r.reviewer || !r.reviewer_karar_zamani) {
      throw new Error(`AI receipt ${artifactId}: karar manifesti için insan kararı (ACCEPTED/REJECTED) + reviewer + zaman zorunlu`);
    }
    // Fingerprint'i saklanan değere körlemesine güvenmek yerine kimlik
    // alanlarından YENİDEN hesapla ve karşılaştır (savunma derinliği).
    const yenidenFp = await aiReceiptFingerprint({
      aiSystemId: r.ai_system_id,
      aiAgentId: r.ai_agent_id,
      amac: r.amac,
      modelSaglayici: r.model_saglayici,
      modelId: r.model_id,
      modelSurum: r.model_surum,
      promptHash: r.prompt_hash,
      kaynakHash: r.kaynak_hash ?? [],
      confidence: r.confidence,
    });
    if (r.fingerprint && r.fingerprint !== yenidenFp) {
      throw new Error(`AI receipt ${artifactId}: kayıtlı fingerprint yeniden hesaplanan ile uyuşmuyor`);
    }
    const manifest = aiReceiptDecisionManifestKur({
      receiptId: r.id,
      receiptFingerprint: r.fingerprint ?? yenidenFp,
      karar: r.karar,
      reviewer: r.reviewer,
      reviewerKararZamani: r.reviewer_karar_zamani,
    });
    return { kind: AI_RECEIPT_DECISION_KIND, hash: await aiReceiptDecisionManifestHash(manifest) };
  }

  if (artifactTable === "board_declarations") {
    const { data: d } = await db
      .from("board_declarations")
      .select("id, donem_etiketi, sunan, sunuldu_at")
      .eq("id", artifactId)
      .maybeSingle();
    if (!d) return null;
    if (!d.sunan || !d.sunuldu_at) {
      throw new Error(`YK beyanı ${artifactId}: attestation manifesti için sunan + sunuldu_at zorunlu (henüz sunulmadı?)`);
    }
    const { data: cevaplar } = await db
      .from("board_declaration_answers")
      .select("question_id, beyan, aciklama, tarih")
      .eq("declaration_id", d.id);
    const manifest = boardDeclarationAttestationManifestKur({
      declarationId: d.id,
      donemEtiketi: d.donem_etiketi,
      sunan: d.sunan,
      sunulduAt: d.sunuldu_at,
      cevaplar: (cevaplar ?? []).map((c) => ({
        questionId: c.question_id,
        beyan: c.beyan,
        aciklama: c.aciklama,
        tarih: c.tarih,
      })),
    });
    return { kind: BOARD_DECLARATION_ATTESTATION_KIND, hash: await boardDeclarationAttestationManifestHash(manifest) };
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
