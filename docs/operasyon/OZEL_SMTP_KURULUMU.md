# Özel SMTP Kurulumu (Dikey G1.1 — kurucunun 22 Temmuz 2026 kararı)

**Durum: HENÜZ YAPILMADI.** İlk gerçek pilot davetinden önce ZORUNLU
bloklayıcı çıkış kapısı. Bu bir kod görevi DEĞİLDİR — Supabase proje
panelinde, bir e-posta sağlayıcısı hesabında ve `wardproof.com`'un DNS
kayıtlarında yapılan bir yapılandırmadır; Claude bu adımları YÜRÜTEMEZ
(harici sağlayıcı hesabı/kimlik bilgisi/DNS erişimi gerektirir), yalnız
doğrulama scripti/checklist hazırlayabilir.

## 1. Neden zorunlu (kanıtlanmış gerçek)

Dikey G1'in canlı testleri sırasında Supabase'in varsayılan e-posta
servisinin ÇOK DÜŞÜK bir hız sınırına sahip olduğu doğrudan doğrulandı:
birkaç ardışık `inviteUserByEmail` denemesi "email rate limit exceeded"
döndürdü (bkz. `docs/adr/PR0-dikeyG-g1-pilot-provisioning-onboarding-
2026-07-22.md`). Bu, Supabase'in kendi belgelerinde de "yalnız test/geliştirme
içindir" diye işaretlenen bir sınırdır — gerçek pilot davetleri için
kullanılamaz.

## 2. Kabul kriterleri (kurucunun listesi — hepsi geçmeden kapı AÇILMAZ)

- [ ] Özel SMTP sağlayıcısı Supabase projesine bağlanmış (Authentication →
      Email Templates / SMTP Settings).
- [ ] SPF kaydı `wardproof.com` DNS'inde yapılandırılmış.
- [ ] DKIM kaydı yapılandırılmış.
- [ ] DMARC kaydı yapılandırılmış (tercihen — kurucunun notu: "tercihen"
      diyor, SPF/DKIM'den farklı olarak zorunlu değil ama önerilir).
- [ ] Davet e-postası (`inviteUserByEmail`) gerçek bir alıcıya test edilmiş.
- [ ] Parola sıfırlama e-postası (`resetPasswordForEmail` / recovery)
      gerçek bir alıcıya test edilmiş.
- [ ] E-posta doğrulama (signup confirmation — bu dilimde kullanılmıyor ama
      şablon olarak var; ileride açılırsa aynı kapıdan geçmeli) test edilmiş.
- [ ] Gönderim HATALARI loglanıyor (SMTP sağlayıcısının kendi dashboard'u
      veya webhook'u üzerinden — Supabase'in kendisi gönderim başarısızlığını
      uygulamaya sessizce bildirir, `inviteUserByEmail`'in dönüş değeri
      yalnız "kabul edildi mi" der, "gerçekten teslim oldu mu" demez).
- [ ] Bounce (geri dönen) ve rate-limit davranışı izleniyor (sağlayıcının
      kendi panelinden — WardProof tarafında ayrı bir izleme kurulmadı,
      bu bilinçli bir kapsam sınırı, gerekirse ayrı bir iş).
- [ ] Davet bağlantılarının (`redirectTo`) doğru PRODUCTION domaine
      (`https://wardproof.com/ilk-giris`) yönlendiği doğrulanmış — dev/
      staging URL'i production e-postasına SIZMAMALI.
- [ ] Test e-postalarında eski Hostinger geçici domaini
      (`blue-yak-865668.hostingersite.com`) veya eski ürün adı
      ("Wardproof" değil "WardProof", "KALKAN-OS" hiç) GEÇMİYOR.

## 3. Doğrulama script'i (hazır, çalıştırılabilir)

Aşağıdaki adımlar Supabase panelinden SMTP bağlandıktan SONRA çalıştırılır
— gerçek bir e-posta adresine (kurucunun kendi test kutusu) davet gönderip
sonucu raporlar. Script GEÇİCİDİR (F5/F5.1/G1'in smoke script'leri gibi —
bir kez çalıştırılır, gerçek e-posta adresi/parola asla commit edilmez).

```ts
// scripts/smoke-ozel-smtp.ts (ÖRNEK ISKELET — gerçek çalıştırma öncesi
// kurucunun kendi test e-posta adresini elle girmesi gerekir)
import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal, requireEnv } from "./env";

async function main() {
  const env = loadEnvLocal();
  requireEnv(env, ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  const gercekTestEpostasi = process.argv[2];
  if (!gercekTestEpostasi) {
    console.error("Kullanım: pnpm exec tsx scripts/smoke-ozel-smtp.ts <gerçek-test-e-postası>");
    process.exit(1);
  }

  const t0 = Date.now();
  const { data, error } = await db.auth.admin.inviteUserByEmail(gercekTestEpostasi, {
    redirectTo: "https://wardproof.com/ilk-giris",
  });
  console.log(`inviteUserByEmail: ${Date.now() - t0}ms`, error ? `HATA: ${error.message}` : `OK, user=${data.user?.id}`);
  console.log("Şimdi gelen kutunuzu kontrol edin: gönderen adresi, marka adı (WardProof), ve /ilk-giris'e yönlenen linki doğrulayın.");
  console.log("Doğruladıktan sonra test kullanıcısını silin:");
  if (data?.user?.id) console.log(`  await db.auth.admin.deleteUser("${data.user.id}")`);
}
main().catch((e) => { console.error(e); process.exit(1); });
```

## 4. Kapı geçince

Bu belgeye bir "Doğrulandı" bölümü + tarih + kurucunun onayı eklenir; G1.1
bu kapı olmadan "bitti" sayılmaz. Kapı geçtikten sonra §2'deki checklist bu
dosyada kalıcı kanıt olarak saklanır (silinmez).
