import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

// Dikey G1 (docs/adr/PR0-dikeyG-g1-pilot-provisioning-onboarding-2026-07-22.md):
// platform operatör → pilot tenant + davet → ilk giriş (parola belirleme) →
// KVKK/şartlar kabulü → kritik hizmet içe aktarma önizleme → mevzuat kapsamı
// seçimi (yalnız VERIFIED paket) → incelemeye gönder → platform operatör
// onayı (PILOT_AKTIF). Kendi ADANMIŞ platform_operator + pilot tenant'ı
// kurar — paylaşılan e2e fixture'ına dokunmaz.
function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env eksik (.env.local).");
  return createClient(url, key, { auth: { persistSession: false } });
}

test("Dikey G1: platform operatör → pilot davet → ilk giriş → kurulum → mevzuat kapsamı → pilot aktif", async ({ page, baseURL }) => {
  test.setTimeout(120_000);
  const db = admin();
  const stamp = Date.now();
  const password = `G1-e2e-${stamp}-!Aa1`;

  // 0) Platform operatör hesabı (kalıcı fixture değil — bu spec'e özel).
  const opEmail = `g1-e2e-op-${stamp}@wardproof.test`;
  const { data: opUser } = await db.auth.admin.createUser({ email: opEmail, password, email_confirm: true });
  await db.from("profiles").insert({ id: opUser!.user!.id, tenant_id: null, role: "platform_operator", full_name: "G1 e2e Operatör" });

  // 1) Platform operatör /giris'ten oturum açar, /platform'a gider.
  await page.goto("/giris");
  await page.getByLabel("E-posta").fill(opEmail);
  await page.getByRole("textbox", { name: "Şifre" }).fill(password);
  await page.getByRole("button", { name: "Giriş Yap" }).click();
  // /giris platform_operator için kendi içinde router.push("/platform") yapar.
  await page.waitForURL("/platform", { timeout: 10_000 });
  await expect(page.getByRole("heading", { name: "Platform Operatör Konsolu" })).toBeVisible({ timeout: 10_000 });

  // 2) Yeni pilot tenant + ilk davet. Davet edilecek auth kullanıcısı ÖNCEDEN
  //    oluşturulur (createUser — e2e fixture'larının HER YERDE kullandığı
  //    desen, gerçek e-posta göndermez) — rota bunu `existingUser` dalında
  //    bulup gerçek inviteUserByEmail çağrısını ATLAR. Supabase projesinin
  //    varsayılan e-posta servisi çok düşük bir hız sınırına sahiptir (test
  //    sırasında GERÇEKTEN doğrulandı — üretim öncesi özel SMTP gerekir, bkz.
  //    final rapor); e2e bu sınıra çarpmadan rotanın GERİ KALANINI (tenant/
  //    profil/provisioning) test eder.
  const kurumAdi = `G1 e2e Pilot ${stamp}`;
  const davetEposta = `g1-e2e-admin-${stamp}@wardproof.test`;
  await db.auth.admin.createUser({ email: davetEposta, password, email_confirm: true });
  await page.getByRole("button", { name: "+ Yeni Pilot Kurum" }).click();
  await page.getByLabel("Kurum adı").fill(kurumAdi);
  await page.getByLabel("İlk kurum yöneticisi e-posta").fill(davetEposta);
  const [olusturYaniti] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/platform/tenants") && r.request().method() === "POST" && r.ok()),
    page.getByRole("button", { name: "Pilot Oluştur ve Davet Gönder" }).click(),
  ]);
  const { tenantId } = (await olusturYaniti.json()) as { tenantId: string };
  await expect(page.locator(`[data-testid="pilot-satir-${tenantId}"]`)).toBeVisible({ timeout: 10_000 });
  await expect(page.locator(`[data-testid="pilot-satir-${tenantId}"]`).getByText("Davet gönderildi")).toBeVisible();

  // 3) Davet edilen kullanıcı için gerçek e-posta gönderilemez (test ortamı)
  //    — Supabase Auth'un KENDİ action link üretimini kullanarak ilk girişi
  //    simüle ederiz (ADR §12). recovery: aynı "oturum kur + parola belirle"
  //    hedefine ulaşır, invite'ın kendisi zaten uygulanmıştı.
  const { data: linkData, error: linkErr } = await db.auth.admin.generateLink({
    type: "recovery",
    email: davetEposta,
    options: { redirectTo: `${baseURL}/ilk-giris` },
  });
  if (linkErr || !linkData) throw linkErr ?? new Error("action link üretilemedi");
  const actionLink = linkData.properties.action_link;

  // 4) Ayrı (oturumsuz) context — davet edilenin KENDİ ilk girişi.
  //
  // NEDEN actionLink'e DOĞRUDAN gidilmiyor: Supabase Auth Redirect URLs
  // allow-list'i (özel SMTP kapanışı, 2026-07-22) BİLİNÇLİ OLARAK yalnız
  // production (`https://wardproof.com/*`) içeriyor — `localhost` GERÇEK bir
  // davet e-postasına yerel bağlantı sızdırmasını önlemek için allow-list'ten
  // ÇIKARILDI (docs/operasyon/OZEL_SMTP_KURULUMU.md §3.6). Bu doğru ve
  // KORUNMASI gereken bir güvenlik kararı — buradaki test onu GEVŞETMEZ.
  // Sonuç: Supabase `redirectTo`yu reddedip Site URL'e (`wardproof.com`)
  // düşer; oturum jetonları (access_token/refresh_token) YİNE hash'te
  // gelir, yalnız YANLIŞ (production) alan adında ve YANLIŞ yolda (`/ilk-
  // giris` değil, kök) — kökte hash'i işleyen bir istemci kod yok, proxy
  // oturumsuz görüp /tanitim'e düşürür (2026-07-23 root-cause bulgusu).
  // Çözüm: gerçek jetonları NEREYE düşerse düşsün hash'ten AL, sonra AYNI
  // jetonlarla LOKAL /ilk-giris'e git — jetonların kendisi domain'e bağlı
  // değil (bearer token), yalnızca hangi sayfanın onları OKUDUĞU önemli.
  const adminContext = await page.context().browser()!.newContext();
  const adminPage = await adminContext.newPage();
  await adminPage.goto(actionLink);
  await adminPage.waitForURL((u) => u.hash.includes("access_token"), { timeout: 10_000 });
  const jetonHash = new URL(adminPage.url()).hash;
  await adminPage.goto(`${baseURL}/ilk-giris${jetonHash}`);
  await expect(adminPage.getByRole("heading", { name: "Parolanızı Belirleyin" })).toBeVisible({ timeout: 10_000 });
  // Supabase, YENİ parolanın eski (createUser'da verilen geçici) paroladan
  // FARKLI olmasını zorunlu kılıyor — gerçek ilk-giriş akışında da böyledir.
  const yeniParola = `${password}-yeni`;
  await adminPage.getByLabel("Parola", { exact: true }).fill(yeniParola);
  await adminPage.getByLabel("Parola (tekrar)").fill(yeniParola);
  await adminPage.getByRole("button", { name: "Parolayı Kaydet ve Devam Et" }).click();

  // 5) /onboarding — KVKK + şartlar kabulü.
  await expect(adminPage.getByRole("heading", { name: "Pilot Kurulumu" })).toBeVisible({ timeout: 10_000 });
  const durumKarti = adminPage.locator('[data-testid="onboarding-durum-karti"]');
  await expect(durumKarti.getByText("Davet gönderildi")).toBeVisible({ timeout: 10_000 });
  await durumKarti.locator('input[type="checkbox"]').nth(0).check();
  await durumKarti.locator('input[type="checkbox"]').nth(1).check();
  await Promise.all([
    adminPage.waitForResponse((r) => r.url().includes("/ilk-giris-tamamla") && r.ok()),
    durumKarti.getByRole("button", { name: "Devam Et" }).click(),
  ]);
  await expect(durumKarti.getByText("İlk giriş tamamlandı")).toBeVisible({ timeout: 10_000 });

  // 6) Kuruluma başla.
  await durumKarti.getByRole("button", { name: "Kuruluma Başla" }).click();
  await expect(durumKarti.getByText("Kurulum devam ediyor")).toBeVisible({ timeout: 10_000 });

  // 7) Kritik hizmet CSV önizleme.
  await adminPage.locator("textarea").fill("ad,durum\nÖdeme Sistemi,AKTIF\n");
  await Promise.all([
    adminPage.waitForResponse((r) => r.url().includes("/import/KRITIK_HIZMET/onizle") && r.ok()),
    adminPage.getByRole("button", { name: "Önizle" }).click(),
  ]);
  await expect(adminPage.locator('[data-testid="import-onizleme-sonuc"]')).toContainText("1 kayıt ayrıştırıldı", { timeout: 10_000 });

  // 8) Mevzuat kapsamı — yalnız VERIFIED paket seçilebilir. Bu spec'e özel
  //    doğrulanmış bir paket hazırlanır (hukuki doğrulama akışı simüle edilir).
  const { data: kurum } = await db.from("tenants").select("id").eq("id", tenantId).single();
  const { data: legalProfil } = await db.from("profiles").select("id").eq("tenant_id", kurum!.id).limit(1).maybeSingle();
  const paketKodu = `G1_E2E_${stamp}`;
  const { data: paket } = await db.from("regulation_packages").insert({ kod: paketKodu, ad: `G1 e2e Doğrulanmış Paket ${stamp}` }).select("id").single();
  await db.from("regulation_packages").update({ hukuk_dogrulama_durumu: "LEGAL_REVIEW" }).eq("id", paket!.id);
  await db
    .from("regulation_packages")
    .update({ hukuk_dogrulama_durumu: "VERIFIED", dogrulayan: legalProfil!.id, dogrulama_zamani: new Date().toISOString() })
    .eq("id", paket!.id);

  await adminPage.reload();
  // Regülasyon kataloğu GLOBAL'dir (tenant-scoped değil) — önceki e2e
  // koşularının bıraktığı VERIFIED paketler de listede kalabilir (append-only,
  // silinmez). Bu yüzden "ilk işaretlenebilir radio" DEĞİL, bu koşuya özel
  // benzersiz paket adını taşıyan satırın radio'su seçilir.
  const paketSatiri = adminPage.locator("label").filter({ hasText: `G1 e2e Doğrulanmış Paket ${stamp}` });
  await expect(paketSatiri).toBeVisible({ timeout: 10_000 });
  await paketSatiri.getByRole("radio").check();
  await Promise.all([
    adminPage.waitForResponse((r) => r.url().includes("/regulation-scope") && r.request().method() === "POST" && r.ok()),
    adminPage.getByRole("button", { name: "Kapsamı Seç" }).click(),
  ]);
  const { data: secim } = await db.from("tenant_regulation_scope").select("id").eq("tenant_id", tenantId).eq("regulation_package_id", paket!.id);
  expect(secim).toHaveLength(1);

  // 9) İncelemeye gönder.
  await adminPage.getByRole("button", { name: "Kurulumu İncelemeye Gönder" }).click();
  await expect(durumKarti.getByText("Kurulum incelemede")).toBeVisible({ timeout: 10_000 });
  await adminContext.close();

  // 10) Platform operatör onayı — PILOT_AKTIF (dedike UI yok, doğrudan API;
  //     yetki/guard zaten route+DB katmanında test edildi).
  const onayYaniti = await page.request.post("/api/onboarding/durum", {
    data: { tenantId, hedefDurum: "PILOT_AKTIF" },
  });
  expect(onayYaniti.ok()).toBeTruthy();
  const { data: sonDurum } = await db.from("tenant_provisioning").select("durum").eq("tenant_id", tenantId).single();
  expect(sonDurum!.durum).toBe("PILOT_AKTIF");
});
