// Kontrol testi/tatbikat koşusunun şeffaflık defteri manifesti (nihai talimat
// v3.3 §8.0 Dikey 2 — "M12 standart test ve tatbikat manifesti"). test_runs
// zaten append-only/immutable (M12) — koşu satırı nihai artefakttır.
//
// V2 (nihai v3.3): manifest artık ZENGİN immutable snapshot taşır — amaç/kapsam/
// hedef varlık/kritik hizmet/senaryo kimliği+sürümü (tanımdan) + başlangıç-bitiş/
// beklenen-gerçek/performans etkisi/FP-FN/log referans+hash/hazırlayan-sorumlu-
// bağımsız onaylayan (koşudan). HAM log/gözlem verisi GİRMEZ (kural 22) — yalnız
// referans + içerik-adresli hash. Manifest KENDİ hash'ini İÇERMEZ (kural 11).
//
// Bu, M24 sitasyon paketinin (citation-bundle.ts) YERİNE geçmez — sitasyon
// paketi hüküm/kaynak zincirinin görünümüdür; bu manifest koşunun kendi
// standart snapshot'ıdır. İki kanıt katmanı BAĞIMSIZ ve TAMAMLAYICI.

import { canonicalHash, type CanonicalDeger } from "./canonical";

export const CONTROL_TEST_RUN_MANIFEST_SCHEMA = "KALKAN_CONTROL_TEST_RUN_MANIFEST_V2" as const;
export const CONTROL_TEST_RUN_KIND = "CONTROL_TEST_RUN" as const;

export interface LogReferansi {
  ad: string;
  hash: string | null;
}

export interface ControlTestRunManifest {
  schema: typeof CONTROL_TEST_RUN_MANIFEST_SCHEMA;
  testRunId: string;
  controlId: string;
  testDefinitionId: string;
  tanimSurumu: number;
  // Sabit kapsam (tanımdan).
  amac: string | null;
  kapsam: string | null;
  hedefVarlik: string | null;
  kritikHizmetAdi: string | null;
  senaryoKimligi: string | null;
  senaryoSurumu: number | null;
  // Koşu-anı gözlem (koşudan).
  sonuc: string;
  gerekce: string;
  beklenenSonuc: string | null;
  performansEtkisi: string | null;
  yanlisPozitif: boolean | null;
  yanlisNegatif: boolean | null;
  baslangicAt: string | null;
  bitisAt: string | null;
  calistiAt: string;
  logReferanslari: LogReferansi[];
  hazirlayan: string | null;
  sorumlu: string | null;
  bagimsizOnaylayan: string | null;
  evidenceId: string | null;
}

export function controlTestRunManifestKur(args: Omit<ControlTestRunManifest, "schema" | "logReferanslari"> & {
  logReferanslari?: LogReferansi[];
}): ControlTestRunManifest {
  return {
    schema: CONTROL_TEST_RUN_MANIFEST_SCHEMA,
    ...args,
    // Log referansları deterministik sıra (kural 11 — girdi sırası önemsiz).
    logReferanslari: [...(args.logReferanslari ?? [])].sort((a, b) =>
      `${a.ad}|${a.hash ?? ""}`.localeCompare(`${b.ad}|${b.hash ?? ""}`),
    ),
  };
}

/** Manifestin kanonik SHA-256'sı — deftere statementHash olarak yazılır. */
export function controlTestRunManifestHash(m: ControlTestRunManifest): Promise<string> {
  return canonicalHash(m as unknown as CanonicalDeger);
}
