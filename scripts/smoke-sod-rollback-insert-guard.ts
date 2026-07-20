// Tek seferlik canlı smoke: sod_import_rollbacklari INSERT-anı maker-checker
// bypass'ının kapandığını doğrular (20260720140000). service_role RLS'i
// atlar ama trigger her rolde çalışır — bu yüzden guard'ı service_role ile
// de test etmek geçerlidir (bug zaten RLS değil trigger eksikliğiydi).
import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal, requireEnv } from "./env";

async function main() {
  const env = loadEnvLocal();
  requireEnv(env, ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { data: manifest, error: mErr } = await db
    .from("sod_import_manifestleri")
    .select("id, tenant_id")
    .limit(1)
    .maybeSingle();
  if (mErr || !manifest) {
    console.error("YOK  test icin mevcut sod_import_manifestleri kaydi bulunamadi:", mErr?.message);
    process.exit(1);
  }
  const { data: profile, error: pErr } = await db
    .from("profiles")
    .select("id")
    .eq("tenant_id", manifest.tenant_id)
    .limit(1)
    .maybeSingle();
  if (pErr || !profile) {
    console.error("YOK  test icin mevcut profil bulunamadi:", pErr?.message);
    process.exit(1);
  }

  let basarisiz = 0;

  // Saldiri 1: dogrudan UYGULANDI + kendini onaylayan olarak INSERT.
  const r1 = await db.from("sod_import_rollbacklari").insert({
    tenant_id: manifest.tenant_id,
    manifest_id: manifest.id,
    gerekce: "smoke-test-bypass-denemesi",
    talep_eden: profile.id,
    onaylayan: profile.id,
    durum: "UYGULANDI",
    uygulandi_at: new Date().toISOString(),
  });
  if (r1.error && /TALEP_EDILDI/.test(r1.error.message)) {
    console.log("  OK   durum=UYGULANDI ile dogrudan INSERT reddedildi:", r1.error.message);
  } else {
    console.error("  FAIL durum=UYGULANDI INSERT reddedilmedi!", r1.error?.message ?? "(hata yok, satir yazildi)");
    basarisiz++;
  }

  // Saldiri 2: REDDEDILDI ile dogrudan INSERT.
  const r2 = await db.from("sod_import_rollbacklari").insert({
    tenant_id: manifest.tenant_id,
    manifest_id: manifest.id,
    gerekce: "smoke-test-bypass-denemesi-2",
    talep_eden: profile.id,
    durum: "REDDEDILDI",
  });
  if (r2.error && /TALEP_EDILDI/.test(r2.error.message)) {
    console.log("  OK   durum=REDDEDILDI ile dogrudan INSERT reddedildi:", r2.error.message);
  } else {
    console.error("  FAIL durum=REDDEDILDI INSERT reddedilmedi!", r2.error?.message ?? "(hata yok, satir yazildi)");
    basarisiz++;
  }

  // Saldiri 3: TALEP_EDILDI ama onaylayan onceden dolu.
  const r3 = await db.from("sod_import_rollbacklari").insert({
    tenant_id: manifest.tenant_id,
    manifest_id: manifest.id,
    gerekce: "smoke-test-bypass-denemesi-3",
    talep_eden: profile.id,
    onaylayan: profile.id,
  });
  if (r3.error && /Karar alanlari/.test(r3.error.message)) {
    console.log("  OK   onceden dolu onaylayan ile INSERT reddedildi:", r3.error.message);
  } else {
    console.error("  FAIL onceden dolu onaylayan INSERT reddedilmedi!", r3.error?.message ?? "(hata yok, satir yazildi)");
    basarisiz++;
    // Temizlik: yanlislikla yazildiysa sil (append-only degil, bu tablo icin karar UPDATE ile yazilir; guvenlik icin sil).
  }

  // Meşru yol hala çalışıyor mu (rejection'ın aşırı katı olmadığını doğrula).
  const r4 = await db
    .from("sod_import_rollbacklari")
    .insert({
      tenant_id: manifest.tenant_id,
      manifest_id: manifest.id,
      gerekce: "smoke-test-mesru-talep",
      talep_eden: profile.id,
    })
    .select("id")
    .maybeSingle();
  if (r4.error) {
    console.error("  FAIL mesru TALEP_EDILDI INSERT'i de reddedildi (asiri katilik):", r4.error.message);
    basarisiz++;
  } else {
    console.log("  OK   mesru TALEP_EDILDI INSERT'i basarili, id=", r4.data?.id);
    // Temizlik: smoke test kalintisini sil (bu satir hicbir zaman UPDATE
    // edilmedigi icin partial-unique index'i kirletmesin diye kaldiriyoruz).
    if (r4.data?.id) {
      await db.from("sod_import_rollbacklari").delete().eq("id", r4.data.id);
    }
  }

  if (basarisiz > 0) {
    console.error(`\n${basarisiz} saldiri senaryosu hala GECIYOR. Guard calismiyor.`);
    process.exit(1);
  }
  console.log("\nTum senaryolar beklendigi gibi: bypass denemeleri reddedildi, mesru yol acik.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
