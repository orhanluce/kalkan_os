// data/scenarios/*.yaml dosyalarını senaryo şablonu tablolarına yükler.
//
//   pnpm seed:scenarios
//
// seed-controls.ts ile aynı disiplin (kural 12: senaryo içeriği de mevzuat
// içeriği gibidir): içerik ASLA burada üretilmez, yalnızca insan yazımı
// YAML'dan okunur ve UNVERIFIED_SAMPLE olarak işaretlenir.
//
// Service role kullanır: senaryo tablolarına istemci yazamaz (migration
// 20260717110000'de insert/update/delete revoke edildi).
//
// YAYINLANMIŞ SÜRÜM IMMUTABLE (kural 10): script, yayınlanmış bir sürümü
// güncellemeye ÇALIŞMAZ. Aynı sürüm zaten yayınlanmışsa dokunmadan geçer.
// İçerik değiştiyse YAML'da `surum` artırılmalıdır — sessizce üzerine yazmak,
// geçmiş bir tatbikatın neye göre puanlandığını geriye dönük değiştirirdi.
import { createClient } from "@supabase/supabase-js";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { load as parseYaml } from "js-yaml";
import { loadEnvLocal, requireEnv } from "./env";

interface InjectYaml {
  sira: number;
  t_dakika: number;
  baslik: string;
  icerik: string;
  beklenen_davranis?: string;
  gorunur_roller?: string[];
}

interface KararYaml {
  kod: string;
  inject_sira?: number;
  soru: string;
  tip: string;
  secenekler?: string[];
  sure_limiti_dakika?: number;
}

interface AksiyonYaml {
  kod: string;
  aciklama: string;
  hedef_dakika?: number;
  kontrol_kodlari?: string[];
}

interface PuanlamaYaml {
  kod: string;
  tip: string;
  bilesen: string;
  agirlik: number;
  beklenen_aksiyon?: string;
  parametreler?: Record<string, unknown>;
  aciklama: string;
}

interface SenaryoYaml {
  kod: string;
  ad: string;
  aciklama: string;
  tehdit_kategorisi: string;
  surum: number;
  tahmini_dakika: number;
  hedef_roller: string[];
  on_kosullar?: string;
  injects: InjectYaml[];
  karar_noktalari: KararYaml[];
  beklenen_aksiyonlar: AksiyonYaml[];
  puanlama: PuanlamaYaml[];
}

const SCENARIOS_DIR = join(process.cwd(), "data", "scenarios");

function yamlDosyalari(): SenaryoYaml[] {
  return readdirSync(SCENARIOS_DIR)
    .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"))
    .sort()
    .map((f) => parseYaml(readFileSync(join(SCENARIOS_DIR, f), "utf8")) as SenaryoYaml);
}

async function main() {
  const env = loadEnvLocal();
  requireEnv(env, ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);

  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // Kontrol kodu -> id: senaryonun ana ürüne bağlandığı yer.
  const { data: controls, error: ctrlErr } = await db.from("controls").select("id, madde_ref");
  if (ctrlErr) throw ctrlErr;
  const controlIdByRef = new Map((controls ?? []).map((c) => [c.madde_ref, c.id]));

  let eklenen = 0;
  let atlanan = 0;
  const eksikKontroller = new Set<string>();

  for (const s of yamlDosyalari()) {
    const { data: template, error: tErr } = await db
      .from("scenario_templates")
      .upsert(
        {
          kod: s.kod,
          ad: s.ad,
          aciklama: s.aciklama,
          tehdit_kategorisi: s.tehdit_kategorisi,
          icerik_durumu: "UNVERIFIED_SAMPLE",
        },
        { onConflict: "kod" },
      )
      .select("id")
      .single();
    if (tErr || !template) throw tErr ?? new Error(`Sablon yazilamadi: ${s.kod}`);

    const { data: mevcut } = await db
      .from("scenario_template_versions")
      .select("id, durum")
      .eq("template_id", template.id)
      .eq("surum", s.surum)
      .maybeSingle();

    if (mevcut?.durum === "yayinlandi") {
      console.log(`  ${s.kod} v${s.surum}: zaten yayinlanmis, dokunulmadi.`);
      atlanan++;
      continue;
    }

    // Taslak sürüm varsa içeriğini tazelemek için sil: yayınlanmamış sürüm
    // üzerinde çalışmak serbesttir (trigger yalnızca yayınlanmışı korur).
    if (mevcut) {
      await db.from("scenario_template_versions").delete().eq("id", mevcut.id);
    }

    const { data: version, error: vErr } = await db
      .from("scenario_template_versions")
      .insert({
        template_id: template.id,
        surum: s.surum,
        durum: "taslak",
        tahmini_dakika: s.tahmini_dakika,
        hedef_roller: s.hedef_roller,
        on_kosullar: s.on_kosullar ?? null,
      })
      .select("id")
      .single();
    if (vErr || !version) throw vErr ?? new Error(`Surum yazilamadi: ${s.kod}`);

    const { data: injects, error: iErr } = await db
      .from("scenario_injects")
      .insert(
        s.injects.map((i) => ({
          version_id: version.id,
          sira: i.sira,
          t_dakika: i.t_dakika,
          baslik: i.baslik,
          icerik: i.icerik,
          beklenen_davranis: i.beklenen_davranis ?? null,
          gorunur_roller: i.gorunur_roller ?? [],
        })),
      )
      .select("id, sira");
    if (iErr) throw iErr;

    const injectIdBySira = new Map((injects ?? []).map((i) => [i.sira, i.id]));

    await db.from("scenario_decision_points").insert(
      s.karar_noktalari.map((k) => ({
        version_id: version.id,
        inject_id: k.inject_sira ? (injectIdBySira.get(k.inject_sira) ?? null) : null,
        kod: k.kod,
        soru: k.soru,
        tip: k.tip,
        secenekler: k.secenekler ?? null,
        sure_limiti_dakika: k.sure_limiti_dakika ?? null,
      })),
    );

    const { data: aksiyonlar, error: aErr } = await db
      .from("scenario_expected_actions")
      .insert(
        s.beklenen_aksiyonlar.map((a) => ({
          version_id: version.id,
          kod: a.kod,
          aciklama: a.aciklama,
          hedef_dakika: a.hedef_dakika ?? null,
        })),
      )
      .select("id, kod");
    if (aErr) throw aErr;

    const aksiyonIdByKod = new Map((aksiyonlar ?? []).map((a) => [a.kod, a.id]));

    // Beklenen aksiyon -> kontrol: simülasyonu ana ürüne bağlayan bağ.
    for (const a of s.beklenen_aksiyonlar) {
      for (const ref of a.kontrol_kodlari ?? []) {
        const controlId = controlIdByRef.get(ref);
        if (!controlId) {
          // Sessizce geçme: eşleşmeyen kontrol, simülasyonun ana ürüne
          // bağlanmadığı anlamına gelir ve bu senaryonun değerini yok eder.
          eksikKontroller.add(`${s.kod}/${a.kod} -> ${ref}`);
          continue;
        }
        await db
          .from("scenario_control_mappings")
          .upsert(
            { expected_action_id: aksiyonIdByKod.get(a.kod)!, control_id: controlId },
            { onConflict: "expected_action_id,control_id" },
          );
      }
    }

    await db.from("scenario_scoring_rules").insert(
      s.puanlama.map((p) => ({
        version_id: version.id,
        kod: p.kod,
        tip: p.tip,
        bilesen: p.bilesen,
        agirlik: p.agirlik,
        parametreler: p.parametreler ?? {},
        aciklama: p.aciklama,
        expected_action_id: p.beklenen_aksiyon
          ? (aksiyonIdByKod.get(p.beklenen_aksiyon) ?? null)
          : null,
      })),
    );

    // Yayınla: bu andan sonra sürüm ve içeriği donar.
    const { error: pubErr } = await db
      .from("scenario_template_versions")
      .update({ durum: "yayinlandi", yayinlandi_at: new Date().toISOString() })
      .eq("id", version.id);
    if (pubErr) throw pubErr;

    console.log(
      `  ${s.kod} v${s.surum}: ${s.injects.length} inject, ${s.karar_noktalari.length} karar, ` +
        `${s.beklenen_aksiyonlar.length} aksiyon, ${s.puanlama.length} kural — yayinlandi.`,
    );
    eklenen++;
  }

  console.log(`\n${eklenen} surum yayinlandi, ${atlanan} atlandi.`);

  if (eksikKontroller.size > 0) {
    console.error(`\nUYARI — eslesmeyen kontrol referanslari:`);
    for (const e of eksikKontroller) console.error(`  ${e}`);
    console.error(
      `Bu aksiyonlar hicbir kontrole bagli degil: simulasyon sonucu kontrol\n` +
        `degerlendirmesine yansimaz. Once 'pnpm seed:controls' calistirin.`,
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
