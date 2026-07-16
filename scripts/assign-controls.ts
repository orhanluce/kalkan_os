// Bir kuruma kontrol paketini atar (tenant_controls satırlarını oluşturur).
//
//   pnpm assign:controls "<yonetici-e-postasi>"
//
// NEDEN AYRI ADIM: şartname §5.1 onboarding'i "kurum oluşturulur → yönetici
// davet edilir → kapsam seçilir → ilgili kontrol paketi atanır" diye
// tanımlar. Kontroller kuruma otomatik/sessizce bağlanmaz; hangi kontrolün
// kapsamda olduğu bir uyum kararıdır.
//
// ŞU ANKİ SINIR — DÜRÜSTÇE: bu script kütüphanedeki TÜM kontrolleri atar.
// Gerçek kapsam belirleme (uygulanabilirlik kriterleri, §3.1 "Uygulanabilirlik
// kriteri") henüz yok; o gelene kadar kurum tüm kontrolleri görür ve
// kapsam dışı olanları elle "kapsam_disi" yapar. Bu, eksik kontrolü
// gizlemekten iyidir: fazladan gösterilen kontrol fark edilir, atlanan
// kontrol edilmez.
//
// Idempotent: zaten atanmış kontrole dokunmaz (durumu SIFIRLAMAZ — aksi
// halde tekrar çalıştırmak kurumun tüm ilerlemesini silerdi).
import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal, requireEnv } from "./env";

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error(`Kullanim: pnpm assign:controls "<yonetici-e-postasi>"`);
    process.exit(1);
  }

  const env = loadEnvLocal();
  requireEnv(env, ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);

  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { data: userList, error: userErr } = await db.auth.admin.listUsers();
  if (userErr) {
    console.error(`Auth kullanicilari okunamadi: ${userErr.message}`);
    process.exit(1);
  }

  const user = userList.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!user) {
    console.error(`Auth kullanicisi bulunamadi: ${email}`);
    process.exit(1);
  }

  const { data: profile } = await db
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    console.error(`Bu kullanicinin profili yok. Once: pnpm bootstrap:tenant "${email}" "<Kurum>"`);
    process.exit(1);
  }

  const { data: controls, error: ctrlErr } = await db.from("controls").select("id, madde_ref");
  if (ctrlErr || !controls?.length) {
    console.error(`Kontrol kutuphanesi bos veya okunamadi: ${ctrlErr?.message ?? "kayit yok"}`);
    console.error(`Once: pnpm seed:controls`);
    process.exit(1);
  }

  const { data: mevcut } = await db
    .from("tenant_controls")
    .select("control_id")
    .eq("tenant_id", profile.tenant_id);

  const atanmis = new Set((mevcut ?? []).map((r) => r.control_id));
  const yeni = controls.filter((c) => !atanmis.has(c.id));

  if (yeni.length === 0) {
    console.log(`Tum kontroller zaten atanmis (${atanmis.size}). Degisiklik yapilmadi.`);
    return;
  }

  const { error: insertErr } = await db.from("tenant_controls").insert(
    yeni.map((c) => ({
      tenant_id: profile.tenant_id,
      control_id: c.id,
      // Yeni atanan kontrol "acik" başlar: henüz değerlendirilmemiş demektir.
      // "karsilaniyor" varsaymak, kanıtsız uyum iddiası üretirdi.
      durum: "acik" as const,
    })),
  );

  if (insertErr) {
    console.error(`Atama basarisiz: ${insertErr.message}`);
    process.exit(1);
  }

  console.log(`${yeni.length} kontrol atandi (${atanmis.size} zaten vardi).`);
  console.log(`Kurum: ${profile.tenant_id}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
