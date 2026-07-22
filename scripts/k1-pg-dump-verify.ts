// K1 — production'a karşı bağımsız, açık şema kapsamlı pg_dump (Yöntem B,
// PR0-K1 ADR §6/§15 karar 2). Salt-okur: yalnız dump alır, restore/silme
// YAPMAZ. db-push.ts'teki AYNI dbUrl kurma deseni (session pooler,
// postgres.<ref> kullanıcı adı) kullanılır — URL asla loglanmaz.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { loadEnvLocal, projectRefFromUrl, requireEnv } from "./env";

const env = loadEnvLocal();
requireEnv(env, ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_DB_PASSWORD", "SUPABASE_DB_POOLER_HOST"]);

const ref = projectRefFromUrl(env.NEXT_PUBLIC_SUPABASE_URL);
const user = `postgres.${ref}`;
const dbUrl = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(env.SUPABASE_DB_PASSWORD)}@${env.SUPABASE_DB_POOLER_HOST}:5432/postgres`;

const outFile = `k1-prova-dump-${new Date().toISOString().slice(0, 10)}.sql`;

console.log(`Dump alınıyor (proje: ${ref}, şema: public,auth,cron) -> ${outFile}`);
const result = spawnSync(
  "npx",
  ["--yes", "supabase@latest", "db", "dump", "--db-url", dbUrl, "--schema", "public,auth,cron", "-f", outFile],
  { stdio: ["ignore", "pipe", "pipe"], shell: true },
);

if (result.status !== 0) {
  console.error("HATA:", result.stderr?.toString().slice(0, 2000));
  process.exit(result.status ?? 1);
}

const bytes = readFileSync(outFile);
const sha256 = createHash("sha256").update(bytes).digest("hex");
console.log(`OK — ${bytes.length} bayt, sha256=${sha256}`);
