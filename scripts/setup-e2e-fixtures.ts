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
  for (const tablo of ["evidences", "findings", "share_links", "audit_log"]) {
    await db.from(tablo).delete().eq("tenant_id", tenant.id);
  }

  console.log(`E2E fiksturu hazir: ${controls.length} kontrol atandi, veriler sifirlandi.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
