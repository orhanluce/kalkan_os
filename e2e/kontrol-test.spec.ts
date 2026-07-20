import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { girisYap } from "./helpers";

// M12 kabul: başarısız kontrol testi → bulgu önerisi → kabul → gerçek bulgu →
// verified closure (retest olmadan kapanamaz) (docs/ROADMAP.md M12, kural
// 11 + 13 + 14). Gerçek Chromium + gerçek Supabase.
//
// UI henüz yok; rotalar API olarak sürülüyor (page.request oturum çerezini
// taşır). DB durumu Node tarafında service client ile doğrulanır — fixture bir
// MANUAL_PROCEDURE test tanımı seed eder.

/** Node tarafı service client — id bulma ve DB durumu doğrulama için. */
function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env eksik (.env.local).");
  return createClient(url, key, { auth: { persistSession: false } });
}

test("başarısız test → öneri → kabul → bulgu; retest olmadan kapanamaz", async ({ page }) => {
  test.setTimeout(60_000);
  await girisYap(page);

  const db = admin();

  // E2E kiracısının seed edilen test tanımını ADIYLA bul: yalnız `tur` filtresi
  // kırılgan — diğer spec'ler (ör. kontrol-test-f1.spec.ts, bu dosyanın kendi
  // ikinci testi) aynı kiracıda KENDİ MANUAL_PROCEDURE tanımlarını yaratıyor;
  // `.single()` o zaman "birden fazla satır" ile patlar (legal-basis.spec.ts/
  // proof-room.spec.ts'te zaten aynı isimle düzeltilmişti, bu dosya unutulmuştu).
  const { data: kurum } = await db.from("tenants").select("id").eq("name", "E2E Test Kurumu A.Ş.").single();
  const { data: tanim } = await db
    .from("control_test_definitions")
    .select("id")
    .eq("tenant_id", kurum!.id)
    .eq("ad", "E2E: MFA tüm ayrıcalıklı hesaplarda zorunlu")
    .single();
  const tanimId = tanim!.id as string;

  // 1) Testi BAŞARISIZ gözlemle çalıştır — iddia karşılanmadı.
  const calistir = await page.request.post(`/api/kontrol-test/${tanimId}/calistir`, {
    data: { iddiaKarsilandi: false, gozlemZamani: new Date().toISOString() },
  });
  expect(calistir.ok()).toBeTruthy();
  const cSonuc = await calistir.json();
  expect(cSonuc.sonuc).toBe("FAILED");
  expect(cSonuc.oneriId).toBeTruthy(); // FAILED → öneri doğdu

  // 2) TOPLAMA ARIZASI gözlemi UNKNOWN üretmeli, öneri DOĞMAMALI (kural 13).
  const unknownRun = await page.request.post(`/api/kontrol-test/${tanimId}/calistir`, {
    data: { toplamaBasarisiz: true, toplamaHatasi: "connector timeout" },
  });
  const uSonuc = await unknownRun.json();
  expect(uSonuc.sonuc).toBe("UNKNOWN");
  expect(uSonuc.oneriId).toBeNull(); // "ölçemedik" bulgu üretmez

  // 3) Öneriyi KABUL et → gerçek bulgu.
  const kabul = await page.request.post(`/api/kontrol-test/oneri/${cSonuc.oneriId}`, {
    data: { karar: "KABUL" },
  });
  expect(kabul.ok()).toBeTruthy();
  const kSonuc = await kabul.json();
  expect(kSonuc.findingId).toBeTruthy();

  // Bulgu retest_gerekli + kaynak_test_definition_id taşımalı (kural 14 zemini).
  const { data: bulgu } = await db
    .from("findings")
    .select("durum, kaynak, retest_gerekli, kaynak_test_definition_id")
    .eq("id", kSonuc.findingId)
    .single();
  expect(bulgu!.kaynak).toBe("kontrol_testi");
  expect(bulgu!.retest_gerekli).toBe(true);
  expect(bulgu!.kaynak_test_definition_id).toBe(tanimId);

  // 4) Bulgu /findings'te görünür.
  await page.goto("/findings");
  await expect(page.getByText(/MFA tüm ayrıcalıklı hesaplarda zorunlu/).first()).toBeVisible({
    timeout: 10_000,
  });

  // 5) VERIFIED CLOSURE (kural 14): retest bağlanmadan kapatma reddedilmeli.
  const { error: retestsizHata } = await db
    .from("findings")
    .update({ durum: "kapali" })
    .eq("id", kSonuc.findingId);
  expect(retestsizHata?.message ?? "").toMatch(/retest gerekli/i);

  // 6) Başarılı RETEST koş (aynı tanım, bulgudan sonra) → şimdi kapanabilir.
  const retest = await page.request.post(`/api/kontrol-test/${tanimId}/calistir`, {
    data: { iddiaKarsilandi: true, gozlemZamani: new Date().toISOString() },
  });
  const rSonuc = await retest.json();
  expect(rSonuc.sonuc).toBe("PASSED");

  const { data: uid } = await db.from("profiles").select("id").eq("tenant_id", kurum!.id).limit(1).single();
  const { data: kapali, error: kapatmaHata } = await db
    .from("findings")
    .update({
      durum: "kapali",
      kapatma_retest_run_id: rSonuc.testRunId,
      kapatan: uid!.id,
      kapatma_onay_at: new Date().toISOString(),
    })
    .eq("id", kSonuc.findingId)
    .select("durum")
    .single();
  expect(kapatmaHata).toBeNull();
  expect(kapali!.durum).toBe("kapali");
});

// M12 UI kabul: "Kontrol Testleri" bölümü gerçekten tıklanabilir mi? Yukarıdaki
// test motor+rotaları API üzerinden kanıtlıyor; bu test UI'ın kendisini —
// yeni tanım formu, Gözlem select'i, Çalıştır ve Kabul Et butonlarını —
// gerçek Chromium'da sürüyor. Kendi test tanımını kurup kullanıyor, mevcut
// fixture tanımının durumunu bozmuyor.
test("UI: yeni test tanımı oluştur, çalıştır, öneriyi kabul et", async ({ page }) => {
  test.setTimeout(60_000);
  await girisYap(page);

  await page.goto("/controls");
  await page.getByRole("link", { name: "TODO-DOGRULA-01" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  // 1) Yeni test tanımı — UI üzerinden.
  await page.getByRole("button", { name: "+ Yeni test tanımı" }).click();
  const testAdi = `UI-e2e: erişim incelemesi ${Date.now()}`;
  await page.getByLabel("Test adı").fill(testAdi);
  await page.getByRole("button", { name: "Ekle", exact: true }).click();

  const testSatiri = page.locator("li").filter({ hasText: testAdi });
  await expect(testSatiri).toBeVisible({ timeout: 10_000 });

  // 2) Gözlemi "İddia karşılanmadı" yap ve çalıştır.
  await testSatiri.getByRole("combobox", { name: "Gözlem" }).click();
  await page.getByRole("option", { name: "İddia karşılanmadı" }).click();
  await testSatiri.getByRole("button", { name: "Çalıştır" }).click();

  // Motor FAILED döndürmeli ve rozet bunu göstermeli.
  await expect(testSatiri.getByText("Kaldı", { exact: true })).toBeVisible({ timeout: 10_000 });

  // 3) Bulgu önerisi kartı görünmeli ve kabul edilebilmeli.
  const oneriKarti = testSatiri.locator("div").filter({ hasText: "Bulgu önerisi:" }).first();
  await expect(oneriKarti).toBeVisible();
  await oneriKarti.getByRole("button", { name: "Kabul Et (bulgu oluştur)" }).click();

  // Kabul sonrası öneri kartı kaybolmalı (artık PROPOSED değil).
  await expect(page.getByText("Bulgu önerisi:")).not.toBeVisible({ timeout: 10_000 });

  // 4) Gerçek bulgu /findings'te görünür.
  await page.goto("/findings");
  await expect(page.getByText(testAdi).first()).toBeVisible({ timeout: 10_000 });
});
