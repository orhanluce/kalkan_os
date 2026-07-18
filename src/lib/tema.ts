// Tema (light/dark/system) yardımcıları (master talimat §6, ADR-T2).
//
// PAKETSİZ: next-themes yerine ~30 satır kendi kodumuz — davranışı tümüyle
// anladığımız, taşınabilir bir çözüm (kural 4'ün ruhu). İki yarısı var:
//   1. layout.tsx'teki INLINE script (TEMA_INLINE_SCRIPT): ilk paint'ten ÖNCE
//      cookie'yi okuyup <html>'e .dark basar — hydration flash'ı böyle önlenir.
//   2. Bu modül: client tarafında tercihi uygulama/saklama.
//
// TERCİH SIRASI (belge §6): oturum yokken cookie → sistem; oturum açılınca
// profildeki tema_tercihi üstün gelir (auth.tsx uygular, cookie'yi senkronlar).

export type TemaTercihi = "light" | "dark" | "system";

export const TEMA_COOKIE = "kalkan-tema";

/** Cookie 1 yıl yaşar; SameSite=Lax — üçüncü taraf bağlamında gönderilmez. */
export function temaCookieYaz(tercih: TemaTercihi): void {
  document.cookie = `${TEMA_COOKIE}=${tercih}; path=/; max-age=31536000; samesite=lax`;
}

export function temaCookieOku(): TemaTercihi | null {
  const eslesme = document.cookie.match(new RegExp(`(?:^|; )${TEMA_COOKIE}=(light|dark|system)`));
  return (eslesme?.[1] as TemaTercihi) ?? null;
}

/** Tercihi DOM'a uygular: .dark class + color-scheme (browser'a bildirim). */
export function temayiUygula(tercih: TemaTercihi): void {
  const koyu =
    tercih === "dark" ||
    (tercih === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", koyu);
  document.documentElement.style.colorScheme = koyu ? "dark" : "light";
}

/**
 * İlk paint'ten önce koşan inline script (layout.tsx <head> içinde).
 * temayiUygula ile AYNI mantık — ikisi ayrışırsa flash geri gelir; bu yüzden
 * mantık bilinçli olarak kısa ve tek yerde yorumlanmış.
 */
export const TEMA_INLINE_SCRIPT = `(function(){try{var m=document.cookie.match(/(?:^|; )${TEMA_COOKIE}=(light|dark|system)/);var t=m?m[1]:"system";var k=t==="dark"||(t==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",k);document.documentElement.style.colorScheme=k?"dark":"light";}catch(e){}})()`;
