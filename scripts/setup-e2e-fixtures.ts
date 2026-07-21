// Playwright e2e testleri için ayrı bir kiracı + test kullanıcıları hazırlar.
//
//   pnpm exec tsx scripts/setup-e2e-fixtures.ts
//
// NEDEN AYRI KİRACI: e2e testleri kontrol durumu değiştirir, kanıt yükler,
// sorumlu atar — bunu kurucunun gerçek "Pilot Kurum A.Ş." verisine karşı
// yapmak, test çalıştırması her seferinde gerçek uyum kayıtlarını bozardı.
// "E2E Test Kurumu A.Ş." adlı ayrı bir kiracı, sil-baştan sıfırlanabilir bir
// alan sağlar.
//
// NEDEN GERÇEK BİR HESAP AMA GERÇEK BİR KULLANICI DEĞİL: bu script bir
// insanın kimlik bilgilerini ASLA görmez veya üretmez. E-postalar sabit
// (`e2e-*@kalkan-os.test`), şifre kriptografik olarak rastgele üretilir ve
// yalnızca .env.local'e yazılır — hiçbir zaman konsola/loga basılmaz. Bu,
// CI'ın kendi kontrolündeki bir test fikstürüdür, kurucunun hesabı değil.
//
// IDEMPOTENT VE SIFIRLAYICI: her çalıştırma (a) kullanıcı/kiracı yoksa
// oluşturur, varsa dokunmaz (şifre kalıcı kalsın diye); (b) kontrol
// durumlarını/sorumlularını 'acik'/atanmadı'ya SIFIRLAR ve bu kiracının
// kanıt/bulgu/paylaşım/audit_log kayıtlarını SİLER — böylece her `pnpm e2e`
// koşusu aynı temiz durumdan başlar. Bu silme yalnızca e2e kiracısının
// tenant_id'siyle sınırlıdır; append-only kuralı (CLAUDE.md kural 2) gerçek
// kiracı verisi için geçerlidir, atılabilir test fikstürü için değil.
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadEnvLocal, requireEnv } from "./env";

const TENANT_ADI = "E2E Test Kurumu A.Ş.";
const KULLANICILAR = [
  { email: "e2e-admin@kalkan-os.test", fullName: "Ayşe Yılmaz", role: "admin" as const },
  { email: "e2e-ikinci@kalkan-os.test", fullName: "Mehmet Kaya", role: "uyum" as const },
];

function rastgeleSifre(): string {
  return randomBytes(24).toString("base64url");
}

/** .env.local'e yalnızca eksik anahtarları ekler; mevcut satırlara dokunmaz. */
function envLocalEksikleriEkle(yeniSatirlar: string[]): void {
  const yol = join(process.cwd(), ".env.local");
  const mevcut = readFileSync(yol, "utf8");
  const eklenecek = yeniSatirlar.filter((satir) => {
    const anahtar = satir.split("=")[0];
    return !mevcut.includes(`${anahtar}=`);
  });
  if (eklenecek.length === 0) return;
  writeFileSync(yol, mevcut.replace(/\n*$/, "\n") + eklenecek.join("\n") + "\n");
}

async function main() {
  const env = loadEnvLocal();
  requireEnv(env, ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);

  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // 1) Kiracı: varsa reuse et, yoksa oluştur.
  let { data: tenant } = await db.from("tenants").select("id").eq("name", TENANT_ADI).maybeSingle();
  if (!tenant) {
    const { data, error } = await db
      .from("tenants")
      .insert({ name: TENANT_ADI, segment: "araci_kurum" })
      .select("id")
      .single();
    if (error || !data) throw error ?? new Error("E2E kiracisi olusturulamadi.");
    tenant = data;
    console.log(`E2E kiracisi olusturuldu: ${tenant.id}`);
  }

  // 2) Kullanıcılar: varsa reuse (şifre değişmez), yoksa oluştur + rastgele
  //    şifre üret + .env.local'e yaz.
  const { data: authList } = await db.auth.admin.listUsers();
  const envSatirlari: string[] = [];
  const kullaniciIdByEmail = new Map<string, string>();

  for (const [i, k] of KULLANICILAR.entries()) {
    let user = authList?.users.find((u) => u.email?.toLowerCase() === k.email);
    if (!user) {
      const sifre = rastgeleSifre();
      const { data, error } = await db.auth.admin.createUser({
        email: k.email,
        password: sifre,
        email_confirm: true,
      });
      if (error || !data.user) throw error ?? new Error(`Kullanici olusturulamadi: ${k.email}`);
      user = data.user;
      console.log(`Test kullanicisi olusturuldu: ${k.email}`);
      // Şifre yalnızca .env.local'e yazılır, asla konsola basılmaz.
      const anahtarOnEki = i === 0 ? "E2E_USER" : "E2E_USER2";
      envSatirlari.push(`${anahtarOnEki}_EMAIL=${k.email}`, `${anahtarOnEki}_PASSWORD=${sifre}`);
    }
    kullaniciIdByEmail.set(k.email, user.id);

    const { data: profil } = await db.from("profiles").select("id").eq("id", user.id).maybeSingle();
    if (!profil) {
      const { error } = await db.from("profiles").insert({
        id: user.id,
        tenant_id: tenant.id,
        role: k.role,
        full_name: k.fullName,
      });
      if (error) throw error;
    }
  }

  if (envSatirlari.length > 0) {
    envLocalEksikleriEkle(envSatirlari);
    console.log(".env.local guncellendi (E2E_USER*_EMAIL/PASSWORD).");
  }

  // 3) Kontrol kütüphanesini bu kiracıya ata, DURUMLARI SIFIRLA.
  const { data: controls } = await db.from("controls").select("id");
  if (!controls?.length) throw new Error("Kontrol kutuphanesi bos. Once: pnpm seed:controls");

  await db.from("tenant_controls").delete().eq("tenant_id", tenant.id);
  await db.from("tenant_controls").insert(
    controls.map((c) => ({
      tenant_id: tenant.id,
      control_id: c.id,
      durum: "acik" as const,
      sorumlu_user_id: null,
    })),
  );

  // 4) Önceki e2e koşularının bıraktığı verileri temizle — YALNIZCA bu
  //    kiracının verisi (tenant_id filtresi). Gerçek kiracı verisine
  //    dokunulmaz.
  //
  //    simulation_runs silinince participants/inject_deliveries/decisions/
  //    observations/finding_proposals/action_results/scores CASCADE ile
  //    kendiliğinden temizlenir (bkz. 20260717120000/130000/140000
  //    migration'larındaki "on delete cascade") — ayrı ayrı silmiyoruz.
  //    control_test_definitions silinince test_runs + finding_proposals
  //    CASCADE ile gider.
  //
  //    SIRA ÖNEMLİ (M16 borcu): sod_telafi_edici_kontroller.test_definition_id
  //    control_test_definitions'a ON DELETE RESTRICT ile bağlı — SoD verisi
  //    ONDAN ÖNCE silinmezse control_test_definitions silme İSTEĞİ SESSİZCE
  //    BAŞARISIZ OLUR (bu script hata kontrolü yapmıyor) ve script YİNE DE
  //    yeni bir tanım ekler; sonuçta aynı isimde İKİ tanım birikir ve e2e
  //    testleri ".single()" sorgusunda "birden fazla satır" hatasıyla patlar.
  //    sod_catismalari silinince istisnalar + telafi kontroller CASCADE ile
  //    gider; sod_kurallari silinince taraflar CASCADE ile gider.
  //
  //    AYNI SINIF BAŞKA BİR AÇIK (Dikey F, F1 doğrulaması sırasında
  //    bulundu): `policy_exceptions.telafi_test_definition_id` de
  //    control_test_definitions'a ON DELETE RESTRICT ile bağlı
  //    (20260718240000_policy_lifecycle_v2.sql) ve bu tablo listede HİÇ
  //    yoktu — sod.spec.ts'in "telafi edici kontrol" testi bir istisnayı bu
  //    tanıma bağladığında, sonraki her fixture reset'i control_test_
  //    definitions silmeyi SESSİZCE başaramıyor, aynı isimli tanım
  //    (E2E: MFA tüm ayrıcalıklı hesaplarda zorunlu) her koşuda birikip
  //    ".single()" varsayan üç ayrı e2e testini (kontrol-test/legal-basis/
  //    proof-room) ve sod.spec.ts'in kendi dropdown'ını patlatıyordu.
  //    ÜÇÜNCÜ AYNI SINIF AÇIK (Dikey F, F4): `test_run_recovery_measurements.
  //    test_run_id` → test_runs ON DELETE RESTRICT. control_test_definitions
  //    silinince test_runs CASCADE ile gitmeli, ama bir koşuya kurtarma ölçümü
  //    bağlandıysa (kurtarma-olcumu.spec) restrict bu CASCADE'i bloklar →
  //    control_test_definitions silme SESSİZCE başarısız → aynı 4 test patlar.
  //    O yüzden ölçümler control_test_definitions'tan ÖNCE silinir.
  //    DÖRDÜNCÜ AYNI SINIF AÇIK (Dikey F, F5 — tam regresyon SIRASINDA
  //    yakalandı): `test_run_recovery_comparisons`ın test_run_id/recovery_
  //    measurement_id/critical_service_id'si de RESTRICT — listede HİÇ
  //    yoktu. Bir karşılaştırma var olduğu sürece hem measurements'ın hem
  //    critical_business_services'ın toplu DELETE'i (tüm kiracı için TEK
  //    transaction) SESSİZCE başarısız oluyor, aynı "E2E: MFA..." + "E2E
  //    Kritik Hizmet" birikme sınıfını yeniden tetikliyordu. Karşılaştırmalar
  //    ikisinden de ÖNCE silinir.
  //    BEŞİNCİ AYNI SINIF (aynı regresyon koşusunda, F5'ten BAĞIMSIZ, F2
  //    borcu): `kritik_hizmet_test_paketi_snapshots.critical_service_id` de
  //    RESTRICT — bir mühürlü paket ("E2E Kritik Hizmet"e bağlı) var olduğu
  //    sürece critical_business_services toplu DELETE'i başarısız oluyor,
  //    "E2E Kritik Hizmet" birikiyordu (F2/F3 spec'i her çalıştığında bir
  //    snapshot mühürlüyor). critical_business_services'tan ÖNCE silinir.
  for (const tablo of [
    "evidences",
    "findings",
    "share_links",
    "audit_log",
    "simulation_runs",
    "sod_catismalari",
    "sod_kurallari",
    "sod_atamalari",
    "sod_degerlendirme_calistirmalari",
    "policy_exceptions",
    "test_run_recovery_comparisons",
    "test_run_recovery_measurements",
    "control_test_definitions",
    "kritik_hizmet_test_paketi_snapshots",
    "critical_business_services",
  ]) {
    await db.from(tablo).delete().eq("tenant_id", tenant.id);
  }

  // 5) Kontrol test motoru (M12) için bir test tanımı seed et — UI henüz yok,
  //    e2e rotaları bu tanıma karşı koşuyor. MANUAL_PROCEDURE: sonuç sinyali
  //    (iddiaKarsilandi) gözlemde gelir, connector gerekmez.
  await db.from("control_test_definitions").insert({
    tenant_id: tenant.id,
    control_id: controls[0].id,
    tur: "MANUAL_PROCEDURE",
    ad: "E2E: MFA tüm ayrıcalıklı hesaplarda zorunlu",
    tazelik_gun: 90,
    basarisizlik_onem: "kritik",
    otomatik_bulgu: true,
    retest_gerekli: true,
  });

  // 6) Dikey F, F1: bir kritik hizmet seed et — e2e'nin, test tanımı formundaki
  //    opsiyonel "Kritik hizmete bağlı" seçiciyi GERÇEKTEN tıklayabilmesi için.
  //    Senaryo şablonu ayrıca seed edilmiyor: global kataloktur (pnpm seed:scenarios).
  await db.from("critical_business_services").insert({
    tenant_id: tenant.id,
    ad: "E2E Kritik Hizmet",
    durum: "AKTIF",
  });

  console.log(`E2E fiksturu hazir: ${controls.length} kontrol atandi, veriler sifirlandi.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
