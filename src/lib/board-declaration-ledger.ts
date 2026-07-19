// Yönetim Kurulu Beyanı (M10) sunum mühürü — "M40 board karar/attestation
// paketi" (nihai talimat v3.3 §8.0 Dikey 1, madde 3). Mevcut outbox/defter
// mekanizması (ledger-outbox.ts) BU manifesti kullanarak mühürler.
//
// NEDEN board_declarations (risk_appetites DEĞİL): board_declarations zaten
// "SUNULDUKTAN SONRA IMMUTABLE" bir formal karardır (TTK m.369 özen
// yükümlülüğü, M10 migration'ı) — G8/M40'ın "board decision/attestation
// receipt" maddesinin tam karşılığı budur. risk_appetites YÖNETİM (yonetim_
// onayi) onaylı bir eşiktir, YK'nın kendisi değil.
//
// NE MÜHÜRLENİR: beyanın kimliği + sunan/sunulduAt + o ANDA verilmiş TÜM
// cevapların kanonik içeriği (soru bazlı beyan/açıklama/tarih, questionId'ye
// göre sıralı — kural 11: sıra bağımsız). Cevaplar sunulduktan sonra zaten
// immutable (DB guard'ı); manifest bu donmuş içeriği KANITLAR.

import { canonicalHash, type CanonicalDeger } from "./canonical";

export const BOARD_DECLARATION_ATTESTATION_SCHEMA = "KALKAN_BOARD_DECLARATION_ATTESTATION_MANIFEST_V1" as const;
export const BOARD_DECLARATION_ATTESTATION_KIND = "BOARD_DECLARATION_ATTESTATION" as const;

export interface BoardDeclarationCevap {
  questionId: string;
  beyan: string;
  aciklama: string | null;
  tarih: string | null;
}

export interface BoardDeclarationAttestationManifest {
  schema: typeof BOARD_DECLARATION_ATTESTATION_SCHEMA;
  declarationId: string;
  donemEtiketi: string;
  sunan: string;
  sunulduAt: string;
  cevaplar: BoardDeclarationCevap[];
}

export function boardDeclarationAttestationManifestKur(args: {
  declarationId: string;
  donemEtiketi: string;
  sunan: string;
  sunulduAt: string;
  cevaplar: BoardDeclarationCevap[];
}): BoardDeclarationAttestationManifest {
  return {
    schema: BOARD_DECLARATION_ATTESTATION_SCHEMA,
    declarationId: args.declarationId,
    donemEtiketi: args.donemEtiketi,
    sunan: args.sunan,
    sunulduAt: args.sunulduAt,
    // Sıra bağımsızlık (kural 11): questionId'ye göre deterministik sıralanır.
    cevaplar: [...args.cevaplar].sort((a, b) => a.questionId.localeCompare(b.questionId)),
  };
}

export function boardDeclarationAttestationManifestHash(m: BoardDeclarationAttestationManifest): Promise<string> {
  return canonicalHash(m as unknown as CanonicalDeger);
}
