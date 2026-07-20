import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { girisYap, ikinciKullaniciGirisYap } from "./helpers";

// Dikey F, F1: kritik hizmet/senaryo GERÇEK referansı + bağımsız bulgu
// kapanışı + bulgu/retest zinciri görünürlüğü + Proof Room. Gerçek Chromium +
// gerçek Supabase; kendi test tanımını kurar, mevcut fixture'a dokunmaz.
//
// Bulgu KAPANIŞININ kendisi (kapatma_retest_run_id/kapatan) için hiçbir UI/rota
// yok (M12'den beri, kontrol-test.spec.ts'teki emsal test de aynı şekilde
// doğrudan DB üzerinden kapatıyor) — bu BİLİNÇLİ bir F1 kapsam dışı, yeni bir
// kapanış UI'ı EKLEMEK bu dilimin işi değildi. Bu yüzden bağımsızlık guard'ı
// burada da (emsal desende) service_role client ile doğrudan denenir; UI
// kısmı (tanım oluşturma + seçiciler + çalıştırma + zincir gösterimi + Proof
// Room) gerçek Chromium tıklamalarıyla sürülür.
function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env eksik (.env.local).");
  return createClient(url, key, { auth: { persistSession: false } });
}

test("F1: kritik hizmet/senaryo bağlı test → FAILED → kabul → bağımsız kapanış → Proof Room + impact graph", async ({ page }) => {
  test.setTimeout(90_000);
  await girisYap(page);

  const db = admin();
  const { data: kurum } = await db.from("tenants").select("id").eq("name", "E2E Test Kurumu A.Ş.").single();
  const { data: profil1 } = await db.from("profiles").select("id").eq("tenant_id", kurum!.id).eq("full_name", "Ayşe Yılmaz").single();
  const { data: profil2 } = await db.from("profiles").select("id").eq("tenant_id", kurum!.id).eq("full_name", "Mehmet Kaya").single();

  await page.goto("/controls");
  await page.getByRole("link", { name: "TODO-DOGRULA-01" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  // 1) Yeni test tanımı — kritik hizmete VE senaryo şablonuna GERÇEK referansla.
  await page.getByRole("button", { name: "+ Yeni test tanımı" }).click();
  const testAdi = `F1-e2e: erişim incelemesi ${Date.now()}`;
  await page.getByLabel("Test adı").fill(testAdi);

  await page.getByRole("combobox", { name: "Kritik hizmete bağlı (opsiyonel)" }).click();
  await page.getByRole("option", { name: "E2E Kritik Hizmet" }).click();
  await page.getByRole("combobox", { name: "Senaryo şablonuna bağlı (opsiyonel)" }).click();
  // Global senaryo kataloğunun ilk gerçek satırı — "— (bağlama)" placeholder değil.
  await page.getByRole("option", { name: /^S\d/ }).first().click();

  await page.getByRole("button", { name: "Ekle", exact: true }).click();
  const testSatiri = page.locator("li").filter({ hasText: testAdi });
  await expect(testSatiri).toBeVisible({ timeout: 10_000 });

  // Seçilen GERÇEK referanslar rozet olarak görünmeli (serbest metin uyarısı DEĞİL).
  await expect(testSatiri.getByText("Kritik hizmete bağlı", { exact: true })).toBeVisible();
  await expect(testSatiri.getByText("Senaryo şablonuna bağlı", { exact: true })).toBeVisible();

  // 2) FAILED çalıştır → öneri → KABUL (user1'in kendi oturumu).
  await testSatiri.getByRole("combobox", { name: "Gözlem" }).click();
  await page.getByRole("option", { name: "İddia karşılanmadı" }).click();
  await testSatiri.getByRole("button", { name: "Çalıştır" }).click();
  await expect(testSatiri.getByText("Kaldı", { exact: true })).toBeVisible({ timeout: 10_000 });

  const oneriKarti = testSatiri.locator("div").filter({ hasText: "Bulgu önerisi:" }).first();
  await expect(oneriKarti).toBeVisible();
  await oneriKarti.getByRole("button", { name: "Kabul Et (bulgu oluştur)" }).click();
  await expect(testSatiri.getByText("Bulgu önerisi:")).not.toBeVisible({ timeout: 10_000 });

  // Zincir: kabul edilmiş bulgu görünür, kapanış retest'i henüz yok.
  await expect(testSatiri.getByText("Açık — kabul edilmiş bulgu")).toBeVisible({ timeout: 10_000 });
  await expect(testSatiri.getByText("Kapanış retest'i henüz yok.")).toBeVisible();

  const { data: tanim } = await db.from("control_test_definitions").select("id").eq("tenant_id", kurum!.id).eq("ad", testAdi).single();
  const { data: bulgu } = await db.from("findings").select("id").eq("kaynak_test_definition_id", tanim!.id).eq("durum", "acik").single();
  const findingId = bulgu!.id as string;

  // 3) Retest niyeti seçilerek PASSED koştur (aynı tanıma karşı).
  await testSatiri.getByRole("combobox", { name: /Bu koşu bir retest ise/ }).click();
  await page.getByRole("option", { name: new RegExp(testAdi.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) }).click();
  await testSatiri.getByRole("combobox", { name: "Gözlem" }).click();
  await page.getByRole("option", { name: "İddia karşılandı" }).click();
  await testSatiri.getByRole("button", { name: "Çalıştır" }).click();
  await expect(testSatiri.getByText("Geçti", { exact: true }).first()).toBeVisible({ timeout: 10_000 });

  const { data: retestRun } = await db
    .from("test_runs")
    .select("id, retest_of_finding_id, sonuc")
    .eq("test_definition_id", tanim!.id)
    .eq("sonuc", "PASSED")
    .order("seq", { ascending: false })
    .limit(1)
    .single();
  expect(retestRun!.retest_of_finding_id).toBe(findingId);

  // 4) BAĞIMSIZLIK GUARD'I — user1 (öneriyi kabul eden) KENDİ bulgusunu kapatamaz.
  const { error: selfCloseErr } = await db
    .from("findings")
    .update({ durum: "kapali", kapatan: profil1!.id, kapatma_retest_run_id: retestRun!.id, kapatma_onay_at: new Date().toISOString() })
    .eq("id", findingId);
  expect(selfCloseErr?.message ?? "").toMatch(/kendi bulgusunu kapatamaz/i);

  const { data: hala } = await db.from("findings").select("durum").eq("id", findingId).single();
  expect(hala!.durum).toBe("acik");

  // Farklı kişi (user2) kapatabilir.
  const { error: validCloseErr } = await db
    .from("findings")
    .update({ durum: "kapali", kapatan: profil2!.id, kapatma_retest_run_id: retestRun!.id, kapatma_onay_at: new Date().toISOString() })
    .eq("id", findingId);
  expect(validCloseErr).toBeNull();

  // 5) UI'da zincir güncellensin: "Kapandı" + bağımsız kapatan görünür.
  await page.reload();
  const testSatiriYenile = page.locator("li").filter({ hasText: testAdi });
  await expect(testSatiriYenile.getByText("Kapandı", { exact: true })).toBeVisible({ timeout: 10_000 });
  await expect(testSatiriYenile.getByText(/bağımsız kapatan: Mehmet Kaya/)).toBeVisible();

  // 6) Proof Room — orijinal (FAILED) koşu linki oluştur, ANONİM (oturumsuz)
  //    ikinci context'te aç, kritik hizmet/senaryo rozetleri + kabul edilmiş
  //    bulgu görünsün. run1 = ilk (FAILED) koşu — seq en küçük.
  const { data: run1 } = await db
    .from("test_runs")
    .select("id")
    .eq("test_definition_id", tanim!.id)
    .order("seq", { ascending: true })
    .limit(1)
    .single();
  const linkRes = await page.request.post("/api/proof-room", { data: { testRunId: run1!.id } });
  expect(linkRes.ok()).toBeTruthy();
  const { url: proofUrl } = await linkRes.json();

  const anonContext = await page.context().browser()!.newContext();
  const anonPage = await anonContext.newPage();
  await anonPage.goto(proofUrl);
  await expect(anonPage.getByRole("heading", { name: /Proof Room/ })).toBeVisible({ timeout: 10_000 });
  await expect(anonPage.getByText("Kritik hizmete bağlı", { exact: true })).toBeVisible();
  await expect(anonPage.getByText("Senaryo şablonuna bağlı", { exact: true })).toBeVisible();
  await expect(anonPage.getByText(/kabul edilmiş bulgu var/)).toBeVisible();
  // Kullanıcı kimlikleri (isim) Proof Room'da ham dönmemeli.
  const anonMetin = await anonPage.locator("main").innerText();
  expect(anonMetin).not.toContain("Mehmet Kaya");
  expect(anonMetin).not.toContain("Ayşe Yılmaz");
  await anonContext.close();

  // İkinci kullanıcı (uyum rolü) da normal oturumda aynı ekranı görebilmeli —
  // ikinciKullaniciGirisYap'in fixture'daki rolünü fiilen kullandığını kanıtlar.
  const ikinciContext = await page.context().browser()!.newContext();
  const ikinciPage = await ikinciContext.newPage();
  await ikinciKullaniciGirisYap(ikinciPage);
  await ikinciPage.goto("/controls");
  await ikinciPage.getByRole("link", { name: "TODO-DOGRULA-01" }).click();
  await expect(ikinciPage.locator("li").filter({ hasText: testAdi }).getByText("Kapandı", { exact: true })).toBeVisible({ timeout: 10_000 });
  await ikinciContext.close();
});
