// data/dora_roi/ict_service_types.yaml dosyasını public.ict_service_types
// tablosuna yükler (DORA RoI Annex III "Type of ICT services" kapalı kümesi,
// CIR 2024/2956).
//
//   pnpm seed:dora-roi
//
// Service role key kullanır (RLS'i bypass eder) — seed-controls.ts'in aynı
// deseni. Her satır TODO_DOGRULA doğar (guard zaten VERIFIED seed'i
// reddeder, kural 3); insan dört-göz onayı olmadan içerik VERIFIED olamaz.
// upsert kullanır: YAML güncellenip yeniden çalıştırıldığında içerik
// tazelenir (yalnız DRAFT_RESEARCH/TODO_DOGRULA satırlarda — VERIFIED
// donmuş satırı guard zaten değiştirtmez), kopya satır oluşmaz.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { load as parseYaml } from "js-yaml";
import { loadEnvLocal, requireEnv } from "./env";

interface HizmetTuruYaml {
  kod: string;
  ad: string;
  aciklama: string;
  kaynak_turu: "EUR_LEX_BIREBIR" | "IKINCIL";
}

interface KatalogYaml {
  kaynak_url: string;
  hizmet_turleri: HizmetTuruYaml[];
}

const DOSYA = join(__dirname, "..", "data", "dora_roi", "ict_service_types.yaml");

async function main() {
  const env = loadEnvLocal();
  requireEnv(env, ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const dosya = parseYaml(readFileSync(DOSYA, "utf8")) as KatalogYaml;

  let yazilan = 0;
  for (const hizmet of dosya.hizmet_turleri) {
    const { error } = await supabase.from("ict_service_types").upsert(
      {
        kod: hizmet.kod,
        ad: hizmet.ad,
        aciklama: hizmet.aciklama,
        kaynak_url: dosya.kaynak_url,
        kaynak_turu: hizmet.kaynak_turu,
        dogrulama_durumu: "TODO_DOGRULA",
      },
      { onConflict: "kod", ignoreDuplicates: false },
    );
    // VERIFIED donmuş bir satırı guard reddeder (içerik değişmez) — bu
    // beklenen davranış, script'i durdurmaz, yalnız bilgi verir.
    if (error) {
      if (error.message.includes("VERIFIED")) {
        console.log(`Atlandı (VERIFIED, donuk): ${hizmet.kod}`);
        continue;
      }
      throw error;
    }
    yazilan++;
  }

  console.log(`Seed tamamlandı: ${yazilan}/${dosya.hizmet_turleri.length} ICT hizmet türü yazıldı.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
