// Kontrol testi koşusunun şeffaflık defteri manifesti (nihai talimat §8.0,
// "İlk kapsam" madde 1). test_runs zaten append-only/immutable (M12) — koşu
// satırının kendisi nihai artefakttır, ayrı bir "paket" tablosu gerekmez.
//
// NE MÜHÜRLENİR: koşunun kimlik + sonuç alanları (RFC 8785 kanonik). Bu, M24
// sitasyon paketinin (citation-bundle.ts) YERİNE geçmez — sitasyon paketi
// hüküm/kaynak zincirinin tam görünümüdür; bu manifest yalnız "bu koşu, bu
// sonuçla, bu anda vardı ve deftere eklendi" der. İki kanıt katmanı BAĞIMSIZ
// ve TAMAMLAYICIDIR (nihai §10: canonicalization+hash+imza+TSA+offline
// verifier+SCITT önceliği — SCITT, M24'ün ÜSTÜNE eklenen bir katmandır).

import { canonicalHash, type CanonicalDeger } from "./canonical";

export const CONTROL_TEST_RUN_MANIFEST_SCHEMA = "KALKAN_CONTROL_TEST_RUN_MANIFEST_V1" as const;
export const CONTROL_TEST_RUN_KIND = "CONTROL_TEST_RUN" as const;

export interface ControlTestRunManifest {
  schema: typeof CONTROL_TEST_RUN_MANIFEST_SCHEMA;
  testRunId: string;
  controlId: string;
  testDefinitionId: string;
  sonuc: string;
  gerekce: string;
  tanimSurumu: number;
  calistiAt: string;
  evidenceId: string | null;
}

export function controlTestRunManifestKur(args: {
  testRunId: string;
  controlId: string;
  testDefinitionId: string;
  sonuc: string;
  gerekce: string;
  tanimSurumu: number;
  calistiAt: string;
  evidenceId: string | null;
}): ControlTestRunManifest {
  return { schema: CONTROL_TEST_RUN_MANIFEST_SCHEMA, ...args };
}

/** Manifestin kanonik SHA-256'sı — deftere statementHash olarak yazılır. */
export function controlTestRunManifestHash(m: ControlTestRunManifest): Promise<string> {
  return canonicalHash(m as unknown as CanonicalDeger);
}
