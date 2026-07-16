// Canlı şemadan TypeScript tiplerini üretir -> src/lib/supabase/database.types.ts
//
// NEDEN: tablo ve kolon adlarını elle yazmak, şema ile kodun sessizce
// ayrışmasına açık kapı bırakır — yanlış bir kolon adı ancak çalışma
// zamanında, üstelik boş sonuç olarak ortaya çıkar. Üretilen tiplerle
// şema değişikliği derlemeyi kırar.
//
// Üretilen dosya COMMIT EDİLİR: CI'ın ve yeni geliştiricinin canlı
// veritabanına erişmeden derleyebilmesi gerekir.
//
// --project-id kullanılır, --db-url DEĞİL: --db-url yerelde bir pg-meta
// container'ı (docker/podman) çalıştırmayı dener ve Docker'sız makinede
// başarısız olur. --project-id ise Management API üzerinden çalışır ve
// yalnızca SUPABASE_ACCESS_TOKEN ister.
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { loadEnvLocal, projectRefFromUrl, requireEnv } from "./env";

const HEDEF = "src/lib/supabase/database.types.ts";

const env = loadEnvLocal();
requireEnv(env, ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_ACCESS_TOKEN"]);

const ref = projectRefFromUrl(env.NEXT_PUBLIC_SUPABASE_URL);

const result = spawnSync("supabase", ["gen", "types", "typescript", "--project-id", ref], {
  encoding: "utf8",
  shell: true,
  // Token ortam değişkeniyle geçirilir, komut satırıyla değil (ps/history'de
  // görünmesin).
  env: { ...process.env, SUPABASE_ACCESS_TOKEN: env.SUPABASE_ACCESS_TOKEN },
});

if (result.status !== 0 || !result.stdout) {
  // DİKKAT: CLI'ın hata çıktısı bağlantı dizesini (dolayısıyla DB şifresini)
  // içerebilir — ham basmak sırrı loga yazar (CLAUDE.md kural 7). Yalnızca
  // ne yapılacağını söyle.
  console.error(
    `Tip uretimi basarisiz (cikis kodu ${result.status}). ` +
      `SUPABASE_ACCESS_TOKEN gecerli mi ve proje erisilebilir mi kontrol edin.`,
  );
  process.exit(1);
}

const banner = `// ÜRETİLMİŞ DOSYA — elle düzenlemeyin.\n// Yeniden üretmek için: pnpm db:types\n\n`;
writeFileSync(HEDEF, banner + result.stdout);
console.log(`Yazildi: ${HEDEF} (${result.stdout.length} bayt)`);
