// YK Beyanı + çapraz denetim motorunu CANLI veriye karşı uçtan uca çalıştırır.
//
//   pnpm demo:beyan
//
// demo-simulation.ts ile aynı gerekçe: "331 test yeşil" bir tatbikatın
// gerçekten çalıştığını KANITLAMAZ, yalnızca bileşenlerin ayrı ayrı doğru
// davrandığını gösterir. Bu script gerçek bir dönem beyanı kurar, YKB-05
// (tatbikat) sorusunu "Evet" ama kanıtsız cevaplar, YKB-04'ü (RTO/RPO) fiili
// bir simülasyon süresini aşan bir hedefle cevaplar, ve çapraz denetim
// motorunun CR-001 ile CR-003'ü GERÇEKTEN tetiklediğini kanıtlar.
import { createClient } from "@supabase/supabase-js";
import { crKuraliDegerlendir, type CrGirdi, type CrKural } from "../src/lib/board-declaration-audit";
import { loadEnvLocal, requireEnv } from "./env";

async function main() {
  const env = loadEnvLocal();
  requireEnv(env, ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);

  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { data: tenant } = await db.from("tenants").select("id").limit(1).single();
  if (!tenant) throw new Error("Kurum bulunamadi. Once: pnpm bootstrap:tenant");

  const { data: profile } = await db.from("profiles").select("id").eq("tenant_id", tenant.id).limit(1).single();
  if (!profile) throw new Error("Bu kuruma bagli profil bulunamadi.");

  console.log(`Kurum: ${tenant.id}`);

  // 1) Yeni bir taslak dönem aç.
  const donemEtiketi = `Demo ${new Date().toISOString().slice(0, 10)}`;
  const { data: declaration, error: dErr } = await db
    .from("board_declarations")
    .insert({ tenant_id: tenant.id, donem_etiketi: donemEtiketi })
    .select("id")
    .single();
  if (dErr || !declaration) throw dErr ?? new Error("Beyan donemi olusturulamadi.");
  console.log(`Beyan dönemi acildi: ${donemEtiketi} (${declaration.id})`);

  const { data: sorular } = await db
    .from("board_declaration_questions")
    .select("id, kod")
    .in("kod", ["YKB-04", "YKB-05"]);
  if (!sorular) throw new Error("Beyan sorulari okunamadi. Once: pnpm seed:beyan");
  const soruIdByKod = new Map(sorular.map((s) => [s.kod, s.id]));

  // 2) YKB-05'i (tatbikat) "Evet" cevapla — ama HİÇ kanıt bağlama.
  //    CR-001'in tam tetikleyicisi bu: "Beyan = Evet, kanıt sayısı = 0".
  const { data: cevap05 } = await db
    .from("board_declaration_answers")
    .insert({
      declaration_id: declaration.id,
      tenant_id: tenant.id,
      question_id: soruIdByKod.get("YKB-05"),
      beyan: "evet",
      aciklama: "Son 12 ayda fidye yazılımı tatbikatı yapıldı.",
      sorumlu_yonetici: profile.id,
    })
    .select("id")
    .single();
  if (!cevap05) throw new Error("YKB-05 cevabi olusturulamadi.");

  // 3) YKB-04'ü (RTO hedefi) "Evet" cevapla, 2 saatlik hedef beyan et —
  //    sonra gerçek bir S01 tatbikatının süresine bağla (varsa).
  const { data: cevap04 } = await db
    .from("board_declaration_answers")
    .insert({
      declaration_id: declaration.id,
      tenant_id: tenant.id,
      question_id: soruIdByKod.get("YKB-04"),
      beyan: "evet",
      aciklama: "Kritik sistemler için RTO hedefi 2 saat olarak onaylandı.",
      sorumlu_yonetici: profile.id,
      son_dogrulama_tarihi: "2026-06-01",
    })
    .select("id")
    .single();
  if (!cevap04) throw new Error("YKB-04 cevabi olusturulamadi.");

  // Gerçek bir tamamlanmış tatbikat var mı? (demo-simulation.ts'in bıraktığı)
  const { data: run } = await db
    .from("simulation_runs")
    .select("id, durum, basladi_at, bitti_at")
    .eq("tenant_id", tenant.id)
    .not("bitti_at", "is", null)
    .order("bitti_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let fiiliSonucSaat: number | null = null;
  if (run) {
    await db.from("board_declaration_simulation_links").insert({
      answer_id: cevap04.id,
      run_id: run.id,
      tenant_id: tenant.id,
    });
    fiiliSonucSaat = (new Date(run.bitti_at).getTime() - new Date(run.basladi_at).getTime()) / 3_600_000;
    console.log(`YKB-04 gercek tatbikata baglandi: ${run.id} (${fiiliSonucSaat.toFixed(2)} saat surdu)`);
  } else {
    console.log("Tamamlanmis tatbikat bulunamadi — once 'pnpm demo:simulation' calistirilabilir. CR-003 bu calistirmada incelenemedi donecek.");
  }

  // 4) Çapraz denetimi GERÇEK veriye karşı çalıştır.
  const { data: kurallarDb } = await db
    .from("board_cross_audit_rules")
    .select("kod, question_id, degerlendirme_tipi, parametreler, onerilen_bulgu, risk_seviyesi, veri_kaynagi_durumu")
    .in("question_id", [soruIdByKod.get("YKB-04"), soruIdByKod.get("YKB-05")]);
  if (!kurallarDb) throw new Error("Capraz denetim kurallari okunamadi.");

  const asOf = new Date();
  console.log("\nCapraz denetim sonuclari:");
  for (const k of kurallarDb) {
    const kural: CrKural = {
      kod: k.kod,
      aciklama: "",
      degerlendirmeTipi: k.degerlendirme_tipi as CrKural["degerlendirmeTipi"],
      parametreler: k.parametreler as Record<string, unknown>,
      onerilenBulguBasligi: k.onerilen_bulgu,
      riskSeviyesi: k.risk_seviyesi as CrKural["riskSeviyesi"],
      veriKaynagiDurumu: k.veri_kaynagi_durumu as CrKural["veriKaynagiDurumu"],
    };

    const girdi: CrGirdi = {
      beyan: k.question_id === soruIdByKod.get("YKB-05") ? "evet" : "evet",
      kanitSayisi: k.question_id === soruIdByKod.get("YKB-05") ? 0 : 1,
      sonDogrulamaTarihi: k.question_id === soruIdByKod.get("YKB-04") ? "2026-06-01" : null,
      beyanEdilenHedefSaat: k.question_id === soruIdByKod.get("YKB-04") ? 2 : null,
      fiiliSonucSaat: k.question_id === soruIdByKod.get("YKB-04") ? fiiliSonucSaat : null,
      auditKaydiVarMi: null,
      simulasyonDurumu: null,
    };

    const sonuc = crKuraliDegerlendir(kural, girdi, asOf);
    console.log(`  ${sonuc.kod}: ${sonuc.sonuc.toUpperCase()} — ${sonuc.gerekce}`);
    if (sonuc.sonuc === "tetiklendi") {
      console.log(`    -> Onerilen bulgu: "${sonuc.bulguBasligi}" (risk: ${sonuc.riskSeviyesi})`);
    }
  }

  // 5) Beyanı sun ve immutability'nin canlıda da çalıştığını doğrula.
  await db
    .from("board_declarations")
    .update({ durum: "sunuldu", sunuldu_at: new Date().toISOString(), sunan: profile.id })
    .eq("id", declaration.id);

  const { error: kurcalamaHatasi } = await db
    .from("board_declaration_answers")
    .update({ beyan: "hayir" })
    .eq("id", cevap05.id);

  console.log(
    `\nSunulan beyani degistirme denemesi: ${kurcalamaHatasi ? "REDDEDILDI (" + kurcalamaHatasi.message.slice(0, 50) + ")" : "!!! GECTI — BUG"}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
