// Dış erişim token üretimi (37 Tez Dikey A invariant'ı): token TAMAMEN
// istemcide üretilir, yalnız hash'i DB'ye yazılır — düz değer hiçbir zaman
// bir tabloya/audit'e girmez. Postgres tarafı `encode(digest(p_token,
// 'sha256'), 'hex')` ile AYNI hesabı yapar (bkz. 20260719300000 migration) —
// bu yüzden token UTF-8 hex string olarak üretilip AYNEN o metin hash'lenir.
import { sha256Hex } from "@/lib/evidence";

export interface DisErisimTokeni {
  token: string;
  tokenHash: string;
}

export async function disErisimTokenUret(): Promise<DisErisimTokeni> {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const tokenHash = await sha256Hex(new TextEncoder().encode(token).buffer as ArrayBuffer);
  return { token, tokenHash };
}
