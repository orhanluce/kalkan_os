// Özel SMTP (Resend) canlı doğrulama scripti — GEÇİCİ, tek seferlik.
// Gerçek e-posta adresi commit'e/log'a yazılmaz (argv'den okunur).
// bkz. docs/operasyon/OZEL_SMTP_KURULUMU.md §3 / §3.5.3 test matrisi.
import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal, requireEnv } from "./env";

const REDIRECT_TO = "https://wardproof.com/ilk-giris";

async function main() {
  const env = loadEnvLocal();
  requireEnv(env, ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const gercekTestEpostasi = process.argv[2];
  if (!gercekTestEpostasi) {
    console.error("Kullanım: pnpm exec tsx scripts/smoke-ozel-smtp.ts <gerçek-test-e-postası>");
    process.exit(1);
  }

  const skipInvite = process.argv[3] === "--skip-invite";
  let inviteData: { user?: { id: string } } | undefined;
  if (!skipInvite) {
    console.log(`[1/2] inviteUserByEmail -> ${REDIRECT_TO}`);
    const t0 = Date.now();
    const { data, error: inviteError } = await db.auth.admin.inviteUserByEmail(gercekTestEpostasi, {
      redirectTo: REDIRECT_TO,
    });
    inviteData = data ?? undefined;
    const inviteMs = Date.now() - t0;
    if (inviteError) {
      console.log(`  HATA (${inviteMs}ms): ${inviteError.message}`);
      console.log(`  detay: name=${inviteError.name} status=${inviteError.status} code=${inviteError.code}`);
    } else {
      console.log(`  OK (${inviteMs}ms) — user=${inviteData?.user?.id}, gönderim zamanı=${new Date().toISOString()}`);
      console.log(`  Konu (Supabase Auth invite şablonunun varsayılan konusu, panelde özelleştirilmemişse): "You have been invited"`);
    }
  } else {
    console.log("[1/2] inviteUserByEmail ATLANDI (--skip-invite) — e-posta zaten kayıtlı kullanıcı.");
  }

  console.log(`\n[2/2] resetPasswordForEmail -> ${REDIRECT_TO}`);
  const t1 = Date.now();
  const { error: resetError } = await db.auth.resetPasswordForEmail(gercekTestEpostasi, {
    redirectTo: REDIRECT_TO,
  });
  const resetMs = Date.now() - t1;
  if (resetError) {
    console.log(`  HATA (${resetMs}ms): ${resetError.message}`);
    console.log(`  detay: name=${resetError.name} status=${resetError.status} code=${resetError.code}`);
    console.log(`  detay(json): ${JSON.stringify(resetError, Object.getOwnPropertyNames(resetError))}`);
  } else {
    console.log(`  OK (${resetMs}ms) — gönderim zamanı=${new Date().toISOString()}`);
    console.log(`  Konu (Supabase Auth recovery şablonunun varsayılan konusu, panelde özelleştirilmemişse): "Reset Password"`);
  }

  console.log("\n--- Şimdi manuel kontrol edin ---");
  console.log("1) Gelen kutunuzda İKİ e-posta olmalı: davet + parola sıfırlama.");
  console.log('2) Gönderen: "WardProof <info@wardproof.com>" mi?');
  console.log(`3) İkisindeki de link "${REDIRECT_TO}" ile mi başlıyor?`);
  console.log("4) İçerikte eski Hostinger domaini, eski marka adı veya localhost geçiyor mu (GEÇMEMELİ)?");
  console.log("5) Resend dashboard -> Logs: yukarıdaki zaman damgalarına yakın iki gönderim accepted/delivered mi?");
  console.log("6) Supabase Dashboard -> Logs -> Auth: bu iki istekle ilgili SMTP/redirect hatası var mı?");

  if (inviteData?.user?.id) {
    console.log(`\nDoğruladıktan sonra test kullanıcısını silin — şimdi otomatik siliniyor: ${inviteData.user.id}`);
    const { error: deleteError } = await db.auth.admin.deleteUser(inviteData.user.id);
    if (deleteError) {
      console.log(`  Silme HATASI: ${deleteError.message} — manuel silmeniz gerekebilir.`);
    } else {
      console.log("  Silindi.");
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
