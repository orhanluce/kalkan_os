// .env.local'i okur. Değerler asla loglanmaz — yalnızca "var/yok" bilgisi
// raporlanır (CLAUDE.md kural 7: gizli anahtarlar yalnızca .env).
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ENV_PATH = join(process.cwd(), ".env.local");

export function loadEnvLocal(): Record<string, string> {
  if (!existsSync(ENV_PATH)) {
    throw new Error(
      ".env.local bulunamadı. `cp .env.example .env.local` yapıp değerleri doldurun.",
    );
  }

  const env: Record<string, string> = {};
  for (const line of readFileSync(ENV_PATH, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    // Değer tırnaklıysa tırnakları soy.
    const value = trimmed
      .slice(eq + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    if (value) env[key] = value;
  }
  return env;
}

/** İstenen anahtarların dolu olduğunu doğrular; DEĞERLERİ yazdırmaz. */
export function requireEnv(env: Record<string, string>, keys: string[]): void {
  const eksik = keys.filter((k) => !env[k]);
  if (eksik.length > 0) {
    throw new Error(
      `.env.local içinde şu değerler eksik veya boş: ${eksik.join(", ")}\n` +
        `Nereden alınır için .env.example dosyasındaki açıklamalara bakın.`,
    );
  }
}

/** Proje URL'inden ref'i çıkarır: https://abc123.supabase.co -> abc123 */
export function projectRefFromUrl(url: string): string {
  const match = url.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/i);
  if (!match) {
    throw new Error(
      `NEXT_PUBLIC_SUPABASE_URL beklenen biçimde değil (https://<ref>.supabase.co): ${url}`,
    );
  }
  return match[1];
}
