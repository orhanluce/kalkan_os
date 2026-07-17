// Kanıt zarfı (Evidence Envelope) — şartname §2.4, docs/ROADMAP.md M5.5 + M9.
//
// Zarf, kanıt DOSYASININ değil, kanıtın KİMLİĞİNİN kaydıdır: hangi dosya
// (hash), nereden geldi, ne zaman yakalandı, kim yükledi, hangi kontrollere
// dayanıyor, ne kadar saklanacak, hangi gizlilik sınıfında. Merkle ağacının
// hash'lediği yapraklar bu zarfların hash'leridir — dosyaların değil.
//
// NEDEN DOSYA DEĞİL DE ZARF: dosyanın hash'ini sabitlemek yalnızca "bu bayt
// dizisi vardı" der. Zarfı sabitlemek "bu dosya, şu kaynaktan, şu tarihte,
// şu kontrol için sunulmuştu" der. Denetimde kanıt değeri olan ikincisidir —
// bir sızma testi raporunun değişmediğini göstermek, onun HANGİ TARİHTE ve
// HANGİ kontrol için sunulduğunu göstermeden yarım kalır.
//
// ADLANDIRMA — M9'da düzeltildi: eski `previousVersionHash` alanı, adına
// rağmen önceki versiyonun ZARF hash'ini tutuyordu (kendi yorumu söylüyordu).
// Ad, tuttuğu şeyi gizliyordu. Artık iki alan var ve ikisi de ne olduğunu
// söylüyor:
//   previousFileHash     -> önceki sürümün DOSYASI neydi
//   previousEnvelopeHash -> önceki sürümün KÖKEN İDDİASI neydi
// Yalnızca dosya zincirini tutmak, "dosya değişti ama kaynağı/sınıfı da mı
// değişti" sorusunu cevapsız bırakırdı.

import {
  EVIDENCE_ENVELOPE_SCHEMA,
  canonicalHash,
  kanonikZaman,
  type CanonicalDeger,
} from "./canonical";

/** Şartname §2.4'teki zarf yapısı (M9'da genişletildi). */
export interface EvidenceEnvelope {
  /** Hash şema sürümü — doğrulayan taraf hangi kuralla hesaplayacağını bilmeli. */
  sema: string;
  /**
   * Bu SÜRÜMÜN kimliği.
   *
   * `evidences` tablosu append-only (kural 2): UPDATE yolu yok, yani her satır
   * bir sürümdür ve satırın id'si sürümün id'sidir. Ayrı bir "version" tablosu
   * açmak, aynı olguyu iki yerde tutmak olurdu.
   */
  evidenceVersionId: string;
  tenantId: string;
  versionNo: number;
  /** Dosyanın hash'i. link/beyan tipi kanıtta dosya yoktur: null. */
  fileHash: string | null;
  hashAlgorithm: string;
  fileSize: number | null;
  mimeType: string | null;
  /** Storage'daki nesne anahtarı ve sürüm kimliği. Bkz. 20260717190000: bugün boş. */
  storageObjectKey: string | null;
  storageVersionId: string | null;
  /** `evidences.tip`: dosya | link | beyan. */
  sourceType: string;
  sourceSystem: string | null;
  capturedAt: string | null;
  uploadedAt: string;
  uploadedBy: string | null;
  retentionClass: string;
  classification: string;
  previousFileHash: string | null;
  previousEnvelopeHash: string | null;
  controlRefs: string[];
  legalHold: boolean;
}

export { canonicalJson, type CanonicalDeger } from "./canonical";

/** Zarfın kanonik (RFC 8785) temsilinin SHA-256'sı. Merkle yaprağı budur. */
export function envelopeHash(envelope: EvidenceEnvelope): Promise<string> {
  return canonicalHash(envelope as unknown as CanonicalDeger);
}

/** `evidences` satırının zarfa giren alanları. */
export interface EvidenceRow {
  id: string;
  tenant_id: string;
  tip: string;
  hash_sha256: string | null;
  hash_algorithm: string;
  version_no: number;
  file_size: number | null;
  mime_type: string | null;
  storage_object_key: string | null;
  storage_version_id: string | null;
  source_system: string | null;
  captured_at: string | null;
  created_at: string;
  yukleyen: string | null;
  retention_class: string | null;
  classification: string | null;
  previous_file_hash: string | null;
  previous_envelope_hash: string | null;
  legal_hold: boolean;
  envelope_schema_version: string | null;
}

/**
 * DB satırından zarf kurar.
 *
 * NULL DÖNER, UYDURMAZ: `envelope_schema_version` boşsa bu kayıt zarf
 * alanları olmadan yazılmış (M9 öncesi). Eksik alanlara varsayılan atayıp
 * zarf üretmek, olmayan bir köken iddiasını hash'lemek olurdu — ve o hash,
 * kanıt değeri olmayan bir sayı olarak denetim raporuna girerdi. Çağıran bu
 * kaydı LEGACY_FILE_HASH_ONLY olarak taşımalı.
 */
export function zarfOlustur(row: EvidenceRow, controlRefs: string[]): EvidenceEnvelope | null {
  if (row.envelope_schema_version === null) return null;
  if (row.retention_class === null || row.classification === null) return null;

  return {
    sema: row.envelope_schema_version,
    evidenceVersionId: row.id,
    tenantId: row.tenant_id,
    versionNo: row.version_no,
    fileHash: row.hash_sha256,
    hashAlgorithm: row.hash_algorithm,
    fileSize: row.file_size,
    mimeType: row.mime_type,
    storageObjectKey: row.storage_object_key,
    storageVersionId: row.storage_version_id,
    sourceType: row.tip,
    sourceSystem: row.source_system,
    capturedAt: kanonikZaman(row.captured_at),
    uploadedAt: kanonikZaman(row.created_at) as string,
    uploadedBy: row.yukleyen,
    retentionClass: row.retention_class,
    classification: row.classification,
    previousFileHash: row.previous_file_hash,
    previousEnvelopeHash: row.previous_envelope_hash,
    // Sıra mührün parçası olmamalı: aynı kontrol kümesi aynı hash'i vermeli.
    controlRefs: [...controlRefs].sort(),
    legalHold: row.legal_hold,
  };
}

export { EVIDENCE_ENVELOPE_SCHEMA };
