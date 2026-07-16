// data/controls/*.yaml dosyalarını public.frameworks / public.controls /
// public.control_mappings tablolarına yükler.
//
// DURUM: yazıldı ama ÇALIŞTIRILMADI — bu makinede canlı bir Supabase
// projesi (SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY) bağlı değil (bkz.
// docs/ROADMAP.md §5.1, CLAUDE.md "Mevcut aşama"). .env.local dolduktan
// sonra `pnpm tsx scripts/seed-controls.ts` ile çalıştırılabilir hale gelir.
//
// Service role key kullanır (RLS'i bypass eder) çünkü controls/frameworks
// tabloları için client rollerine insert/update policy'si YOKTUR (bkz.
// supabase/migrations/20260716120004_frameworks_controls.sql) — bilinçli
// tasarım: mevzuat içeriği yalnız bu script üzerinden, insan onayından
// geçmiş YAML'dan yazılabilir.
import { createClient } from "@supabase/supabase-js";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { load as parseYaml } from "js-yaml";

interface ControlYaml {
  madde_ref: string;
  baslik: string;
  aciklama: string;
  kanit_tipi: string[];
  periyot: "yillik" | "surekli" | "olay_bazli";
  kritiklik: 1 | 2 | 3 | 4 | 5;
  esdeger_vii128_madde_ref?: string;
}

interface FrameworkYaml {
  framework: {
    code: string;
    name: string;
    version: string;
    yururluk_tarihi: string | null;
  };
  controls: ControlYaml[];
}

const CONTROLS_DIR = join(__dirname, "..", "data", "controls");

function loadYamlFiles(): FrameworkYaml[] {
  return readdirSync(CONTROLS_DIR)
    .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"))
    .map((f) => parseYaml(readFileSync(join(CONTROLS_DIR, f), "utf8")) as FrameworkYaml);
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY .env.local içinde yok — " +
        "gerçek bir Supabase projesi bağlanmadan bu script çalıştırılamaz.",
    );
  }

  const supabase = createClient(url, serviceKey);
  const files = loadYamlFiles();
  const equivalences: Array<{ a: string; frameworkCode: string; b: string }> = [];

  for (const file of files) {
    const { data: framework, error: fwError } = await supabase
      .from("frameworks")
      .upsert(
        {
          code: file.framework.code,
          name: file.framework.name,
          version: file.framework.version,
          yururluk_tarihi: file.framework.yururluk_tarihi,
        },
        { onConflict: "code" },
      )
      .select()
      .single();
    if (fwError) throw fwError;

    for (const control of file.controls) {
      const { error: controlError } = await supabase.from("controls").upsert(
        {
          framework_id: framework.id,
          madde_ref: control.madde_ref,
          baslik: control.baslik,
          aciklama: control.aciklama,
          kanit_tipi: control.kanit_tipi,
          periyot: control.periyot,
          kritiklik: control.kritiklik,
        },
        { onConflict: "framework_id,madde_ref" },
      );
      if (controlError) throw controlError;

      if (control.esdeger_vii128_madde_ref) {
        equivalences.push({
          a: control.madde_ref,
          frameworkCode: file.framework.code,
          b: control.esdeger_vii128_madde_ref,
        });
      }
    }
  }

  // control_mappings ikinci geçişte yazılır (her iki taraf da DB'de olmalı).
  for (const eq of equivalences) {
    const [{ data: a }, { data: b }] = await Promise.all([
      supabase
        .from("controls")
        .select("id, frameworks!inner(code)")
        .eq("madde_ref", eq.a)
        .eq("frameworks.code", eq.frameworkCode)
        .single(),
      supabase
        .from("controls")
        .select("id, frameworks!inner(code)")
        .eq("madde_ref", eq.b)
        .eq("frameworks.code", "VII-128.10")
        .single(),
    ]);
    if (!a || !b) continue;

    const { error } = await supabase
      .from("control_mappings")
      .upsert(
        { control_id_a: a.id, control_id_b: b.id, iliski: "esdeger" },
        { onConflict: "control_id_a,control_id_b" },
      );
    if (error) throw error;
  }

  console.log(`Seed tamamlandı: ${files.length} çerçeve, ${equivalences.length} eşleme.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
