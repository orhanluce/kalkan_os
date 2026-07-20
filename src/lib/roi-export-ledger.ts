// DORA RoI export yayın mühürü — 37 Tez Dikey B, Faz 4 (docs/adr/PR0-37-tez-
// dikeyB-faz4-kanit-zinciri-2026-07-20.md §3). Mevcut outbox/defter
// mekanizması (ledger-outbox.ts) BU manifesti kullanarak mühürler — ikinci
// bir imzalama/defter yolu İCAT EDİLMEDİ (board-declaration-ledger.ts'in
// AYNI şablonu).
//
// NE MÜHÜRLENİR: export kimliği + iki hash (paket_hash/provenance_hash,
// kural 15 — ayrı adlı, ayrı doğrulanan) + yayınlanma anı. HAM İÇERİK
// (paket satırları, provenance detayları) DEFTERE GİRMEZ — defter yalnız
// "bu export bu içerikle bu anda yayınlandı" iddiasını taşır.

import { canonicalHash, type CanonicalDeger } from "./canonical";

export const ROI_EXPORT_PUBLISHED_SCHEMA = "KALKAN_ROI_EXPORT_PUBLISHED_MANIFEST_V1" as const;
export const ROI_EXPORT_PUBLISHED_KIND = "ROI_EXPORT_PUBLISHED" as const;

export interface RoiExportPublishedManifest {
  schema: typeof ROI_EXPORT_PUBLISHED_SCHEMA;
  exportId: string;
  tenantId: string;
  paketHash: string;
  provenanceHash: string | null;
  yayinlanmaZamani: string;
}

export function roiExportPublishedManifestKur(args: {
  exportId: string;
  tenantId: string;
  paketHash: string;
  provenanceHash: string | null;
  yayinlanmaZamani: string;
}): RoiExportPublishedManifest {
  return {
    schema: ROI_EXPORT_PUBLISHED_SCHEMA,
    exportId: args.exportId,
    tenantId: args.tenantId,
    paketHash: args.paketHash,
    provenanceHash: args.provenanceHash,
    yayinlanmaZamani: args.yayinlanmaZamani,
  };
}

export function roiExportPublishedManifestHash(m: RoiExportPublishedManifest): Promise<string> {
  return canonicalHash(m as unknown as CanonicalDeger);
}
