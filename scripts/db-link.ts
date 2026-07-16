// Projeyi uzak Supabase'e bağlar (supabase link). Anahtarlar .env.local'den
// okunur ve CLI'a ortam değişkeni olarak geçirilir — komut satırına
// yazılmaz (ps/history'de görünmesin diye).
import { spawnSync } from "node:child_process";
import { loadEnvLocal, projectRefFromUrl, requireEnv } from "./env";

const env = loadEnvLocal();
requireEnv(env, ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_ACCESS_TOKEN", "SUPABASE_DB_PASSWORD"]);

const ref = projectRefFromUrl(env.NEXT_PUBLIC_SUPABASE_URL);
console.log(`Bağlanılıyor: ${ref}`);

const result = spawnSync("supabase", ["link", "--project-ref", ref], {
  stdio: "inherit",
  shell: true,
  env: {
    ...process.env,
    SUPABASE_ACCESS_TOKEN: env.SUPABASE_ACCESS_TOKEN,
    SUPABASE_DB_PASSWORD: env.SUPABASE_DB_PASSWORD,
  },
});

process.exit(result.status ?? 1);
