// Legal-basis guard'ın SUNUCU tarafı (V2 PR-4b adım 4, M23): koşu öncesi
// zincirin HAM MALZEMESİNİ toplar. Karar mantığı burada DEĞİL —
// `legal-basis.ts`'teki saf motorda (kural 11: SQL yalnız ham malzeme).
//
// RLS altında okur (kullanıcı oturumu): global hukuk verisi (mappings/
// obligations/provisions) authenticated'a açık; applicability_decisions ve
// organization_profiles zaten kiracıya kilitli — service_role GEREKMEZ.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/database.types";
import { applicabilityFactSnapshot, factSnapshotFingerprint } from "./applicability";
import type { DayanakEslemesi } from "./legal-basis";

interface EslemeSatiri {
  id: string;
  kapsam: string;
  dogrulama_durumu: string;
  obligations: {
    id: string;
    kod: string;
    nitelik: string;
    dogrulama_durumu: string;
    provisions: {
      provision_ref: string;
      effective_from: string;
      effective_to: string | null;
      system_to: string | null;
    };
  };
}

/**
 * Bir kontrolün güncel dayanak eşlemelerini motorun girdi biçiminde döndürür.
 * REJECTED eşleme DAHİL EDİLMEZ: reddedilmiş iddia, iddia değildir — koşuyu
 * kilitleyemez (SUPERSEDED dahil kalır: bayat iddia yeniden incelenene kadar
 * zorunluda bloklar, sessizce düşmez).
 */
export async function dayanakEslemeleriniTopla(
  db: SupabaseClient<Database>,
  controlId: string,
  tenantId: string,
): Promise<DayanakEslemesi[]> {
  const { data: satirlar, error } = await db
    .from("obligation_control_mappings")
    .select(
      `id, kapsam, dogrulama_durumu,
       obligations!inner (id, kod, nitelik, dogrulama_durumu,
         provisions!inner (provision_ref, effective_from, effective_to, system_to))`,
    )
    .eq("control_id", controlId)
    .neq("dogrulama_durumu", "REJECTED");
  if (error) throw new Error(`Dayanak eşlemeleri okunamadı: ${error.message}`);

  const eslemeler = (satirlar ?? []) as unknown as EslemeSatiri[];
  if (eslemeler.length === 0) return [];

  // Kiracının güncel applicability kararları (superseded_at null) — RLS kiracıyı
  // zaten sınırlar; tenant filtresi savunma amaçlı.
  const oblIds = eslemeler.map((m) => m.obligations.id);
  const { data: kararlar, error: kErr } = await db
    .from("applicability_decisions")
    .select("obligation_id, durum, kosul, fact_snapshot_fingerprint")
    .eq("tenant_id", tenantId)
    .in("obligation_id", oblIds)
    .is("superseded_at", null);
  if (kErr) throw new Error(`Uygulanabilirlik kararları okunamadı: ${kErr.message}`);

  // Güncel profil parmak izi: karar bugünkü profille mi verilmiş sorusu için.
  const { data: profil } = await db
    .from("organization_profiles")
    .select(
      "organization_type, regulated_entity_types, regulated_status, regulator_types, jurisdictions, operating_sectors, finance_department_enabled, employee_band, legal_entity_count",
    )
    .eq("tenant_id", tenantId)
    .maybeSingle();
  const guncelFingerprint = profil
    ? await factSnapshotFingerprint(applicabilityFactSnapshot(profil))
    : null;

  return eslemeler.map((m) => {
    const karar = (kararlar ?? []).find((k) => k.obligation_id === m.obligations.id) ?? null;
    return {
      mappingId: m.id,
      obligationKod: m.obligations.kod,
      nitelik: m.obligations.nitelik as DayanakEslemesi["nitelik"],
      kapsam: m.kapsam as DayanakEslemesi["kapsam"],
      obligationDogrulama: m.obligations.dogrulama_durumu as DayanakEslemesi["obligationDogrulama"],
      mappingDogrulama: m.dogrulama_durumu as DayanakEslemesi["mappingDogrulama"],
      hukum: {
        provisionRef: m.obligations.provisions.provision_ref,
        effectiveFrom: m.obligations.provisions.effective_from,
        effectiveTo: m.obligations.provisions.effective_to,
        guncelKayit: m.obligations.provisions.system_to === null,
      },
      applicability: {
        mevcut: karar !== null,
        durum: (karar?.durum ?? null) as DayanakEslemesi["applicability"]["durum"],
        kosul: karar?.kosul ?? null,
        fingerprintGuncel:
          karar === null || guncelFingerprint === null
            ? null
            : karar.fact_snapshot_fingerprint === guncelFingerprint,
      },
    };
  });
}
