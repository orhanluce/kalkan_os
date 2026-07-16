import type { Durum } from "./types";

// supabase/config.toml [storage] file_size_limit ile tutarlı — o limit
// gerçek projeye bağlanınca de bu değeri güncelle.
export const MAX_EVIDENCE_FILE_SIZE_BYTES = 20 * 1024 * 1024;

// Uyum kanıtı olarak tipik belge/görsel türleri. Yürütülebilir dosya
// tipleri (exe, script, vs.) bilinçli olarak dışarıda bırakıldı.
export const ALLOWED_EVIDENCE_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/png",
  "image/jpeg",
  "text/plain",
];

export interface EvidenceFileValidation {
  valid: boolean;
  error: string | null;
}

export function validateEvidenceFile(file: Pick<File, "type" | "size">): EvidenceFileValidation {
  if (file.size > MAX_EVIDENCE_FILE_SIZE_BYTES) {
    return { valid: false, error: "Dosya 20 MB sınırını aşıyor." };
  }
  if (!ALLOWED_EVIDENCE_MIME_TYPES.includes(file.type)) {
    return { valid: false, error: "Bu dosya tipi desteklenmiyor (PDF, Word, Excel, PNG, JPG veya düz metin yükleyin)." };
  }
  return { valid: true, error: null };
}

export async function sha256Hex(data: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function isEvidenceExpired(gecerlilikBitis: string | null, asOf: Date): boolean {
  if (!gecerlilikBitis) return false;
  return new Date(gecerlilikBitis).getTime() < asOf.getTime();
}

/**
 * M2 kuralı: süresi dolmuş kanıta dayanan bir kontrol "karşılanıyor"da
 * kalamaz, "kısmi"ye düşer. kapsam_disi/acik durumları etkilenmez —
 * zaten kanıta dayanmıyorlar.
 */
export function deriveDurumFromEvidenceExpiry(
  currentDurum: Durum,
  gecerlilikBitis: string | null,
  asOf: Date,
): Durum {
  if (currentDurum !== "karsilaniyor") return currentDurum;
  return isEvidenceExpired(gecerlilikBitis, asOf) ? "kismi" : currentDurum;
}
