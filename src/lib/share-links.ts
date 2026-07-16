import type { ShareLink } from "./types";

export function isShareLinkValid(shareLink: ShareLink | undefined, asOf: Date): boolean {
  if (!shareLink) return false;
  return new Date(shareLink.sonGecerlilik).getTime() >= asOf.getTime();
}

/** supabase/migrations'taki share_links.token default'una (gen_random_bytes(32) hex) paralel. */
export function generateShareToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
