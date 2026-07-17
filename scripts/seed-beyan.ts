// data/beyan/*.yaml dosyalarını beyan sorusu ve çapraz denetim kuralı
// tablolarına yükler.
//
//   pnpm seed:beyan
//
// seed-controls.ts / seed-scenarios.ts ile aynı disiplin (kural 3/12):
// içerik ASLA burada üretilmez, yalnızca insan yazımı YAML'dan okunur.
// upsert kullanır: YAML güncellenip yeniden çalıştırıldığında içerik
// tazelenir, kopya satır oluşmaz. Sorular/kurallar seed-controls'teki
// frameworks/controls gibi ortak referans veridir — tenant_id yok.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { load as parseYaml } from "js-yaml";
import { loadEnvLocal, requireEnv } from "./env";

interface SoruYaml {
  kod: string;
  sira: number;
  soru: string;
  beklenen_kanit: string;
  mevzuat_notu?: string;
}

interface KuralYaml {
  kod: string;
  question_kod: string;
  aciklama: string;
  tetikleyici: string;
  degerlendirme_tipi: string;
  parametreler?: Record<string, unknown>;
  onerilen_bulgu: string;
  risk_seviyesi: string;
  veri_kaynagi_durumu: string;
}

const BEYAN_DIR = join(process.cwd(), "data", "beyan");

async function main() {
  const env = loadEnvLocal();
  requireEnv(env, ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);

  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const sorularYaml = parseYaml(
    readFileSync(join(BEYAN_DIR, "sorular.yaml"), "utf8"),
  ) as { sorular: SoruYaml[] };

  for (const s of sorularYaml.sorular) {
    const { error } = await db.from("board_declaration_questions").upsert(
      {
        kod: s.kod,
        soru: s.soru.trim(),
        beklenen_kanit: s.beklenen_kanit,
        mevzuat_notu: s.mevzuat_notu ?? null,
        sira: s.sira,
        icerik_durumu: "UNVERIFIED_SAMPLE",
      },
      { onConflict: "kod" },
    );
    if (error) throw error;
  }
  console.log(`${sorularYaml.sorular.length} beyan sorusu yazıldı.`);

  const { data: sorular, error: sErr } = await db
    .from("board_declaration_questions")
    .select("id, kod");
  if (sErr) throw sErr;
  const soruIdByKod = new Map((sorular ?? []).map((s) => [s.kod, s.id]));

  const kurallarYaml = parseYaml(
    readFileSync(join(BEYAN_DIR, "capraz-denetim.yaml"), "utf8"),
  ) as { kurallar: KuralYaml[] };

  let eksikSoru = 0;
  for (const k of kurallarYaml.kurallar) {
    const questionId = soruIdByKod.get(k.question_kod);
    if (!questionId) {
      console.error(`  ${k.kod}: eslesmeyen soru kodu -> ${k.question_kod}`);
      eksikSoru++;
      continue;
    }

    const { error } = await db.from("board_cross_audit_rules").upsert(
      {
        kod: k.kod,
        question_id: questionId,
        aciklama: k.aciklama.trim(),
        tetikleyici: k.tetikleyici,
        degerlendirme_tipi: k.degerlendirme_tipi,
        parametreler: k.parametreler ?? {},
        onerilen_bulgu: k.onerilen_bulgu,
        risk_seviyesi: k.risk_seviyesi,
        veri_kaynagi_durumu: k.veri_kaynagi_durumu,
        icerik_durumu: "UNVERIFIED_SAMPLE",
      },
      { onConflict: "kod" },
    );
    if (error) throw error;
  }

  const mevcutDegil = kurallarYaml.kurallar.filter((k) => k.veri_kaynagi_durumu !== "MEVCUT");
  console.log(
    `${kurallarYaml.kurallar.length} çapraz denetim kuralı yazıldı ` +
      `(${mevcutDegil.length} tanesi veri modeli eksik: ${mevcutDegil.map((k) => k.kod).join(", ")}).`,
  );

  if (eksikSoru > 0) {
    console.error(`\n${eksikSoru} kural eslesmeyen soru koduna isaret ediyor.`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
