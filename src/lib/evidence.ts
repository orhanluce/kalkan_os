import type { Durum } from "./types";

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
