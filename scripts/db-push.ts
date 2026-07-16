// supabase/migrations/*.sql dosyalarını bağlı uzak projeye uygular.
//
// Session pooler üzerinden bağlanır (--db-url), direct connection değil:
// Supabase'in direct DB host'u (db.<ref>.supabase.co) artık IPv6-only ve
// çoğu yerel ağ (IPv4-only) buna erişemiyor — "hostname resolving error"
// ile karşılaşırsan bu yüzdendir. Session pooler IPv4 uyumlu.
// Ayrıca --db-url, `supabase db push` (linked mod)'un cwd'deki .env*
// dosyalarını otomatik tarayıp migration placeholder'larını doldurmaya
// çalışmasını da atlar — bu projede o tarama, ilgisiz/geçersiz adlı
// değişkenler yüzünden başarısız oluyordu.
//
// DİKKAT: bu, gerçek bir veritabanına yazar. Migration'lar PGlite ile
// (src/lib/__tests__/rls-*.test.ts) zaten test edildi — buraya gelmeden
// önce `pnpm test` yeşil olmalı.
import { spawnSync } from "node:child_process";
import { loadEnvLocal, projectRefFromUrl, requireEnv } from "./env";

const env = loadEnvLocal();
requireEnv(env, [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_DB_PASSWORD",
  "SUPABASE_DB_POOLER_HOST",
]);

const ref = projectRefFromUrl(env.NEXT_PUBLIC_SUPABASE_URL);
// Session pooler'da kullanıcı adı "postgres.<proje-ref>" biçiminde olmalı.
const user = `postgres.${ref}`;
const dbUrl = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(env.SUPABASE_DB_PASSWORD)}@${env.SUPABASE_DB_POOLER_HOST}:5432/postgres`;

const dryRun = process.argv.includes("--dry-run");
const args = ["db", "push", "--db-url", dbUrl];
if (dryRun) args.push("--dry-run");

const result = spawnSync("supabase", args, {
  stdio: "inherit",
  shell: true,
  env: process.env,
});

process.exit(result.status ?? 1);
