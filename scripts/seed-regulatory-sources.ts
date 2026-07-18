// Resmî kaynak sicili KÜRATÖR seed'i (V2 PR-4a, M19).
//
// NEDEN SCRIPT (tenant-facing rota DEĞİL): regulatory_sources GLOBAL ortak
// referanstır — bir kiracının ortak kataloğu kirletmesi governance açığıdır
// (hukuk-küratör rolü açık karar K8). Global hukuk verisi yalnız küratör
// tarafından, service_role ile eklenir (frameworks/controls seed deseni).
//
// KURAL 3 + V1 §29: yalnız KAYNAK KÜNYESİ (kamuya açık gerçekler: otorite,
// yargı, URL) seed edilir. ARTIFACT (gerçek belge + hash) seed EDİLMEZ —
// gerçek dokümanı çekmeden hash uydurmak kural 3 ihlalidir; artifact'lar
// küratör/connector tarafından gerçek belgeyle eklenir. erisim_politikasi
// 'onay_bekliyor' — SourceAccessPolicy onaylanmadan connector üretime çıkmaz.
//
// İdempotent: aynı (authority, ad) tekrar eklenmez.
import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal, requireEnv } from "./env";

// Kamuya açık gerçekler (V1 §34 resmî kaynak sicili). İçerik değil, KÜNYE.
const KAYNAKLAR = [
  { authority: "SPK", jurisdiction: "TR", kaynak_seviyesi: "A", ad: "SPK Mevzuat Sistemi", canonical_url: "https://mevzuat.spk.gov.tr/" },
  { authority: "Resmî Gazete", jurisdiction: "TR", kaynak_seviyesi: "A", ad: "T.C. Resmî Gazete", canonical_url: "https://www.resmigazete.gov.tr/" },
  { authority: "Siber Güvenlik Başkanlığı", jurisdiction: "TR", kaynak_seviyesi: "B", ad: "T.C. Siber Güvenlik Başkanlığı", canonical_url: "https://siberguvenlik.gov.tr/" },
  { authority: "EUR-Lex", jurisdiction: "EU", kaynak_seviyesi: "A", ad: "EUR-Lex (AB resmî hukuk)", canonical_url: "https://eur-lex.europa.eu/" },
] as const;

async function main() {
  const env = loadEnvLocal();
  requireEnv(env, ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  let eklenen = 0;
  for (const k of KAYNAKLAR) {
    const { data: mevcut } = await db
      .from("regulatory_sources")
      .select("id")
      .eq("authority", k.authority)
      .eq("ad", k.ad)
      .maybeSingle();
    if (mevcut) {
      console.log(`  var  ${k.authority} — ${k.ad}`);
      continue;
    }
    const { error } = await db.from("regulatory_sources").insert({ ...k, erisim_politikasi_durumu: "onay_bekliyor" });
    if (error) {
      console.error(`  HATA ${k.ad}: ${error.message}`);
      process.exit(1);
    }
    console.log(`  +    ${k.authority} — ${k.ad}`);
    eklenen++;
  }
  console.log(`\n${eklenen} kaynak eklendi, ${KAYNAKLAR.length - eklenen} zaten vardı. Artifact seed EDİLMEDİ (kural 3).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
