// S01 fidye tatbikatını baştan sona oynar ve puanlar.
//
//   pnpm demo:simulation "<yonetici-e-postasi>"
//
// NEDEN VAR: belge §14 örnek kurum verisinde "tamamlanmış simülasyon: 1"
// istiyor. Ama asıl değeri doğrulama: şema, durum makinesi ve puanlama
// motorunun GERÇEK Postgres'te birlikte çalıştığını gösterir. PGlite testleri
// bunu kanıtlamaz — pgcrypto/search_path olayı (20260717093000) tam olarak
// bu farkın canlıyı bozabildiğini gösterdi.
//
// SENARYO BİLİNÇLİ OLARAK KISMEN BAŞARISIZ oynanır: eskalasyon geciktirilir
// ve delil toplanmaz. Böylece hem zaman hedefi ihlali hem de CRITICAL_FAILURE
// yolu fiilen görülür — hepsi başarılı bir demo, puanlamanın çalıştığını
// kanıtlamazdı.
import { createClient } from "@supabase/supabase-js";
import { bulguOnerileriUret, puanla, type PuanlamaKurali } from "../src/lib/scoring";
import { loadEnvLocal, requireEnv } from "./env";

/** Tatbikatta neyin ne zaman yapıldığı — belge §8.5'teki örneğe yakın. */
const AKSIYON_SENARYOSU: Record<string, { tamamlandi: boolean; dakika: number | null }> = {
  OLAY_SINIFLANDIRILDI: { tamamlandi: true, dakika: 8 },
  // Belge §8.5 örneği: beklenen 15 dk, gerçekleşen 42 dk.
  ESKALASYON_YAPILDI: { tamamlandi: true, dakika: 42 },
  BCP_DEVREDE: { tamamlandi: true, dakika: 28 },
  // Delil toplanmadı: MANDATORY_FAIL_IF tetiklenmeli.
  DELIL_TOPLANDI: { tamamlandi: false, dakika: null },
  BILDIRIM_DEGERLENDIRILDI: { tamamlandi: true, dakika: 70 },
  YEDEKTEN_DONULDU: { tamamlandi: true, dakika: 95 },
};

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error(`Kullanim: pnpm demo:simulation "<yonetici-e-postasi>"`);
    process.exit(1);
  }

  const env = loadEnvLocal();
  requireEnv(env, ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { data: users } = await db.auth.admin.listUsers();
  const user = users.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!user) {
    console.error(`Auth kullanicisi bulunamadi: ${email}`);
    process.exit(1);
  }

  const { data: profile } = await db
    .from("profiles")
    .select("id, tenant_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) {
    console.error(`Profil yok. Once: pnpm bootstrap:tenant "${email}" "<Kurum>"`);
    process.exit(1);
  }

  const { data: version } = await db
    .from("scenario_template_versions")
    .select("id, surum, scenario_templates!inner(kod, ad)")
    .eq("scenario_templates.kod", "S01")
    .eq("durum", "yayinlandi")
    .maybeSingle();
  if (!version) {
    console.error(`S01 senaryosunun yayinlanmis surumu yok. Once: pnpm seed:scenarios`);
    process.exit(1);
  }

  // 1) Tatbikat oluştur
  const { data: run, error: runErr } = await db
    .from("simulation_runs")
    .insert({
      tenant_id: profile.tenant_id,
      version_id: version.id,
      ad: "Fidye yazılımı tatbikatı (demo)",
      mod: "hizlandirilmis",
      zaman_olcegi: 6,
    })
    .select("id")
    .single();
  if (runErr || !run) throw runErr;
  console.log(`Tatbikat olusturuldu: ${run.id.slice(0, 8)} (S01 v${version.surum}, 6x hizlandirilmis)`);

  await db
    .from("simulation_participants")
    .insert({
      run_id: run.id,
      tenant_id: profile.tenant_id,
      user_id: profile.id,
      senaryo_rolu: "yonetici",
      katilim_tipi: "yonetici",
    });

  // 2) Başlat
  await db.from("simulation_runs").update({ durum: "hazir" }).eq("id", run.id);
  const { error: startErr } = await db
    .from("simulation_runs")
    .update({ durum: "calisiyor" })
    .eq("id", run.id);
  if (startErr) throw startErr;
  console.log(`Baslatildi.`);

  // 3) Tüm gelişmeleri yayınla
  const { data: injects } = await db
    .from("scenario_injects")
    .select("id, sira, baslik")
    .eq("version_id", version.id)
    .order("sira");

  for (const i of injects ?? []) {
    const { error } = await db.from("simulation_inject_deliveries").insert({
      run_id: run.id,
      tenant_id: profile.tenant_id,
      inject_id: i.id,
      yayinlayan: profile.id,
    });
    if (error) throw error;
  }
  console.log(`${injects?.length} gelisme yayinlandi.`);

  // 4) Kararlar (yayınlanmış gelişmelere)
  const { data: kararNoktalari } = await db
    .from("scenario_decision_points")
    .select("id, kod")
    .eq("version_id", version.id);

  // Bildirim kararı VERİLİR (puanlamada DECISION_SELECTED geçsin).
  const verilecek = ["KRITIK_SINIFLANDIRMA", "IZOLASYON", "BCP_AKTIVASYON", "BILDIRIM_KARARI"];
  let kararSayisi = 0;
  for (const dp of kararNoktalari ?? []) {
    if (!verilecek.includes(dp.kod)) continue;
    const { error } = await db.from("simulation_decisions").insert({
      run_id: run.id,
      tenant_id: profile.tenant_id,
      decision_point_id: dp.id,
      katilimci_id: profile.id,
      cevap: "Evet",
      senaryo_dakika: 10,
    });
    if (error) throw error;
    kararSayisi++;
  }
  console.log(`${kararSayisi} karar verildi.`);

  // 5) Aksiyon sonuçlarını işaretle
  const { data: aksiyonlar } = await db
    .from("scenario_expected_actions")
    .select("id, kod")
    .eq("version_id", version.id);

  for (const a of aksiyonlar ?? []) {
    const s = AKSIYON_SENARYOSU[a.kod];
    if (!s) continue;
    const { error } = await db.from("simulation_action_results").insert({
      run_id: run.id,
      tenant_id: profile.tenant_id,
      expected_action_id: a.id,
      tamamlandi: s.tamamlandi,
      senaryo_dakika: s.dakika,
      isaretleyen: profile.id,
    });
    if (error) throw error;
  }
  console.log(`${aksiyonlar?.length} aksiyon isaretlendi (delil TOPLANMADI — kritik yol sinaniyor).`);

  // 6) Tamamla
  await db.from("simulation_runs").update({ durum: "tamamlandi" }).eq("id", run.id);
  console.log(`Tamamlandi.\n`);

  // 7) Puanla — route handler ile AYNI mantık (src/lib/scoring.ts)
  const { data: kurallarRow } = await db
    .from("scenario_scoring_rules")
    .select("kod, tip, bilesen, agirlik, aciklama, parametreler, expected_action_id")
    .eq("version_id", version.id);

  const aksiyonKodById = new Map((aksiyonlar ?? []).map((a) => [a.id, a.kod]));

  const kurallar: PuanlamaKurali[] = (kurallarRow ?? []).map((k) => ({
    kod: k.kod,
    tip: k.tip as PuanlamaKurali["tip"],
    bilesen: k.bilesen as PuanlamaKurali["bilesen"],
    agirlik: Number(k.agirlik),
    aciklama: k.aciklama,
    beklenenAksiyon: k.expected_action_id ? (aksiyonKodById.get(k.expected_action_id) ?? null) : null,
    parametreler: (k.parametreler as Record<string, unknown>) ?? {},
  }));

  const sonuc = puanla({
    kurallar,
    aksiyonlar: (aksiyonlar ?? []).map((a) => ({
      kod: a.kod,
      tamamlandi: AKSIYON_SENARYOSU[a.kod]?.tamamlandi ?? false,
      dakika: AKSIYON_SENARYOSU[a.kod]?.dakika ?? null,
    })),
    verilenKararlar: verilecek,
    gozlemciPuani: null,
  });

  console.log(`PUAN: ${sonuc.puan}/100 — ${sonuc.durum}`);
  for (const s of sonuc.satirlar) {
    const im = s.sonuc === "gecti" ? "+" : s.sonuc === "kaldi" ? "-" : "·";
    console.log(`  ${im} ${s.kod}: ${s.gerekce}`);
  }

  await db.from("simulation_scores").upsert(
    {
      run_id: run.id,
      tenant_id: profile.tenant_id,
      puan: sonuc.puan,
      durum: sonuc.durum,
      satirlar: sonuc.satirlar as never,
      kritik_basarisizliklar: sonuc.kritikBasarisizliklar as never,
    },
    { onConflict: "run_id" },
  );

  // 8) Bulgu önerileri
  const { data: mappings } = await db
    .from("scenario_control_mappings")
    .select("control_id, expected_action_id");

  const aksiyonKontrolleri = new Map<string, string[]>();
  for (const m of mappings ?? []) {
    const kod = aksiyonKodById.get(m.expected_action_id);
    if (!kod) continue;
    aksiyonKontrolleri.set(kod, [...(aksiyonKontrolleri.get(kod) ?? []), m.control_id]);
  }

  const oneriler = bulguOnerileriUret(sonuc, kurallar, aksiyonKontrolleri);
  if (oneriler.length > 0) {
    const { error } = await db.from("simulation_finding_proposals").insert(
      oneriler.map((o) => ({
        run_id: run.id,
        tenant_id: profile.tenant_id,
        control_id: o.controlId,
        baslik: o.baslik,
        gerekce: o.gerekce,
        onem: o.onem,
      })),
    );
    if (error) throw error;
  }

  await db.from("simulation_runs").update({ durum: "puanlaniyor" }).eq("id", run.id);
  await db.from("simulation_runs").update({ durum: "incelendi" }).eq("id", run.id);

  console.log(`\n${oneriler.length} bulgu onerisi uretildi (PROPOSED — insan onayi bekliyor):`);
  for (const o of oneriler) console.log(`  [${o.onem}] ${o.baslik}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
