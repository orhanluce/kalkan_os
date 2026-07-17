// Canlı veritabanında şemanın gerçekten var olduğunu doğrular.
//
// NEDEN AYRI BİR KONTROL: `supabase db push` yalnızca migration KAYIT
// tablosunun güncel olduğunu söyler. Kaydın güncel olması, tabloların
// gerçekten orada ve beklenen halde olduğunu kanıtlamaz — bir migration
// kısmen uygulanmış ya da sonradan elle değiştirilmiş olabilir. Bu script
// tablolara fiilen dokunur.
//
// service_role kullanır (RLS bypass): amaç RLS'i sınamak değil (o iş
// PGlite testlerinde), şemanın varlığını görmek.
import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal, requireEnv } from "./env";

const BEKLENEN_TABLOLAR = [
  "tenants",
  "profiles",
  "frameworks",
  "controls",
  "control_mappings",
  "tenant_controls",
  "evidences",
  "findings",
  "audit_log",
  "share_links",
  "evidence_reviews",
  "anchor_batches",
  "anchor_batch_leaves",
  "anchor_receipts",
  "simulation_result_manifests",
  "simulation_manifest_receipts",
];

// Migration'larla gelen fonksiyonlar: tablo var ama fonksiyon yoksa şema
// yarım demektir ve bunu ancak çağırınca anlarız.
const BEKLENEN_FONKSIYONLAR: { ad: string; args: Record<string, unknown> }[] = [
  { ad: "verify_audit_chain", args: { target_tenant_id: "00000000-0000-0000-0000-000000000000" } },
  { ad: "evidence_durumu", args: { target_evidence_id: "00000000-0000-0000-0000-000000000000" } },
  { ad: "anchor_batch_durumu", args: { target_batch_id: "00000000-0000-0000-0000-000000000000" } },
  {
    ad: "evidence_anchor_bilgisi",
    args: { target_evidence_id: "00000000-0000-0000-0000-000000000000" },
  },
  {
    ad: "simulation_manifest_durumu",
    args: { target_manifest_id: "00000000-0000-0000-0000-000000000000" },
  },
  // QR doğrulamasının herkese açık giriş noktası (M9).
  { ad: "manifest_dogrula", args: { target_hash: "0".repeat(64) } },
];

async function main() {
  const env = loadEnvLocal();
  requireEnv(env, ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);

  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  let hata = 0;

  for (const tablo of BEKLENEN_TABLOLAR) {
    // limit(0): veri çekmeden yalnızca tablonun sorgulanabilir olduğunu sına.
    const { error } = await db.from(tablo).select("*").limit(0);
    if (error) {
      console.error(`  YOK  ${tablo} — ${error.message}`);
      hata++;
    } else {
      console.log(`  var  ${tablo}`);
    }
  }

  for (const fn of BEKLENEN_FONKSIYONLAR) {
    const { error } = await db.rpc(fn.ad, fn.args);
    if (error) {
      console.error(`  YOK  ${fn.ad}() — ${error.message}`);
      hata++;
    } else {
      console.log(`  var  ${fn.ad}()`);
    }
  }

  if (hata > 0) {
    console.error(`\n${hata} eksik. Sema canli veritabaninda TAM DEGIL.`);
    process.exit(1);
  }
  console.log(`\n${BEKLENEN_TABLOLAR.length} tablo, ${BEKLENEN_FONKSIYONLAR.length} fonksiyon dogrulandi.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
