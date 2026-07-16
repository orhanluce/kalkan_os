// İlk kiracıyı ve ilk yöneticiyi kurar.
//
//   pnpm bootstrap:tenant "<e-posta>" "<Kurum Adı>" [segment]
//
// ÖN KOŞUL: auth kullanıcısı ZATEN var olmalı (Supabase paneli →
// Authentication → Users → Add user). Bu script şifreye dokunmaz ve
// kullanıcı oluşturmaz; yalnızca var olan kimliği bir kuruma ve role
// bağlar.
//
// NEDEN KAYIT FORMU DEĞİL: şartname §5.1 kullanıcıların davetle geldiğini
// söyler — public signup yoktur. Ama ilk yöneticiyi davet edecek bir
// yönetici de henüz yoktur; bu script o yumurta-tavuk sorununu çözen tek
// seferlik bootstrap'tir. İlk yönetici kurulduktan sonra kalan kullanıcılar
// ürün içindeki davet akışıyla eklenmelidir.
//
// service_role kullanır (RLS bypass): profiles_insert_self politikası
// kullanıcının KENDİ profilini boş bir kiracıya yazmasına izin verir, ama
// bu script kullanıcı adına değil sistem adına çalışır.
import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal, requireEnv } from "./env";

const GECERLI_SEGMENTLER = ["araci_kurum", "pys", "kvhs"] as const;
type Segment = (typeof GECERLI_SEGMENTLER)[number];

async function main() {
  const [email, kurumAdi, segmentArg = "araci_kurum"] = process.argv.slice(2);

  if (!email || !kurumAdi) {
    console.error(
      `Kullanim: pnpm bootstrap:tenant "<e-posta>" "<Kurum Adi>" [${GECERLI_SEGMENTLER.join("|")}]`,
    );
    process.exit(1);
  }

  if (!GECERLI_SEGMENTLER.includes(segmentArg as Segment)) {
    console.error(`Gecersiz segment: ${segmentArg}. Secenekler: ${GECERLI_SEGMENTLER.join(", ")}`);
    process.exit(1);
  }

  const env = loadEnvLocal();
  requireEnv(env, ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);

  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // 1) Auth kullanıcısını bul. Oluşturmuyoruz: parola kullanıcının kendi
  //    bilgisidir ve bu script'ten geçmemelidir.
  const { data: userList, error: userErr } = await db.auth.admin.listUsers();
  if (userErr) {
    console.error(`Auth kullanicilari okunamadi: ${userErr.message}`);
    process.exit(1);
  }

  const user = userList.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!user) {
    console.error(
      `Auth kullanicisi bulunamadi: ${email}\n` +
        `Once Supabase panelinden olusturun: Authentication -> Users -> Add user.`,
    );
    process.exit(1);
  }

  // 2) Zaten bir profili var mı? Varsa dokunma — bu script tekrar
  //    calistirilabilir olmali (idempotent), ama var olan bir rolu sessizce
  //    degistirmemeli.
  const { data: mevcutProfil } = await db
    .from("profiles")
    .select("id, tenant_id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (mevcutProfil) {
    console.log(
      `Bu kullanicinin profili zaten var (tenant ${mevcutProfil.tenant_id}, rol ${mevcutProfil.role}).\n` +
        `Degisiklik yapilmadi.`,
    );
    return;
  }

  // 3) Kurumu oluştur.
  const { data: tenant, error: tenantErr } = await db
    .from("tenants")
    .insert({ name: kurumAdi, segment: segmentArg })
    .select("id")
    .single();

  if (tenantErr || !tenant) {
    console.error(`Kurum olusturulamadi: ${tenantErr?.message}`);
    process.exit(1);
  }

  // 4) Profili admin olarak bağla.
  const { error: profilErr } = await db.from("profiles").insert({
    id: user.id,
    tenant_id: tenant.id,
    role: "admin",
    full_name: email.split("@")[0],
  });

  if (profilErr) {
    // Kurum oluştu ama profil oluşmadı: yarım kalmış durumu bildir, sessizce
    // geçme. Kurumu silmiyoruz — silme yolu açmak, append-only disiplinini
    // bir script'in hata yolunda delmek olurdu.
    console.error(
      `Profil olusturulamadi: ${profilErr.message}\n` +
        `DIKKAT: ${tenant.id} kimlikli kurum olusturuldu ama profil baglanmadi.`,
    );
    process.exit(1);
  }

  console.log(`Kurum olusturuldu: ${kurumAdi} (${tenant.id})`);
  console.log(`Yonetici baglandi: ${email} -> admin`);
  console.log(`\nArtik /giris sayfasindan bu e-posta ve panelde belirlediginiz sifreyle girebilirsiniz.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
