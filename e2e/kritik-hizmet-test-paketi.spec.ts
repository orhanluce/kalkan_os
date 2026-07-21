import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { girisYap } from "./helpers";

// Dikey F, F2: kritik hizmet → bağlı test tanımı (gerçek kritik hizmet
// seçiciyle) → geçmiş FAILED koşu → güncel PASSED koşu (retest) → açık
// bulgu/kapanış zinciri → paket önizleme → mühürlü paket → tarihsel özet →
// Proof Room oturumsuz görünüm. Gerçek Chromium + gerçek Supabase; kendi test
// tanımını kurar, mevcut fixture'a dokunmaz.
function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env eksik (.env.local).");
  return createClient(url, key, { auth: { persistSession: false } });
}

test("F2: kritik hizmet test paketi — önizleme → mühürleme → tarihsel özet → anonim Proof Room görünümü", async ({ page }) => {
  test.setTimeout(90_000);
  await girisYap(page);

  const db = admin();
  const { data: kurum } = await db.from("tenants").select("id").eq("name", "E2E Test Kurumu A.Ş.").single();
  const { data: hizmet } = await db.from("critical_business_services").select("id").eq("tenant_id", kurum!.id).eq("ad", "E2E Kritik Hizmet").single();
  const hizmetId = hizmet!.id as string;

  await page.goto("/controls");
  await page.getByRole("link", { name: "TODO-DOGRULA-01" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  // 1) Yeni test tanımı — E2E Kritik Hizmet'e GERÇEK referansla bağlı.
  await page.getByRole("button", { name: "+ Yeni test tanımı" }).click();
  const testAdi = `F2-e2e: erişim incelemesi ${Date.now()}`;
  await page.getByLabel("Test adı").fill(testAdi);
  await page.getByRole("combobox", { name: "Kritik hizmete bağlı (opsiyonel)" }).click();
  await page.getByRole("option", { name: "E2E Kritik Hizmet", exact: true }).click();
  await page.getByRole("button", { name: "Ekle", exact: true }).click();
  const testSatiri = page.locator("li").filter({ hasText: testAdi });
  await expect(testSatiri).toBeVisible({ timeout: 10_000 });

  // 2) Geçmiş FAILED koşu → öneri → kabul.
  await testSatiri.getByRole("combobox", { name: "Gözlem" }).click();
  await page.getByRole("option", { name: "İddia karşılanmadı" }).click();
  await testSatiri.getByRole("button", { name: "Çalıştır" }).click();
  await expect(testSatiri.getByText("Kaldı", { exact: true })).toBeVisible({ timeout: 10_000 });
  const oneriKarti = testSatiri.locator("div").filter({ hasText: "Bulgu önerisi:" }).first();
  await expect(oneriKarti).toBeVisible();
  await oneriKarti.getByRole("button", { name: "Kabul Et (bulgu oluştur)" }).click();
  await expect(testSatiri.getByText("Bulgu önerisi:")).not.toBeVisible({ timeout: 10_000 });

  // 3) Güncel PASSED koşu.
  await testSatiri.getByRole("combobox", { name: "Gözlem" }).click();
  await page.getByRole("option", { name: "İddia karşılandı" }).click();
  await testSatiri.getByRole("button", { name: "Çalıştır" }).click();
  await expect(testSatiri.getByText("Geçti", { exact: true }).first()).toBeVisible({ timeout: 10_000 });

  const { data: tanim } = await db.from("control_test_definitions").select("id").eq("tenant_id", kurum!.id).eq("ad", testAdi).single();
  const tanimId = tanim!.id as string;

  // 4) Kritik hizmet sayfasına git — Test Paketi Önizle. "E2E Kritik Hizmet"
  //    kiracı fixture'ının paylaşılan hizmeti — geçmiş e2e koşularından BAŞKA
  //    test tanımları BİRİKMİŞ olabilir (kirli DB'ye dayanıklı desen), bu
  //    yüzden tüm iddialar YALNIZ bu koşunun kendi satırına (data-testid) scope'lanır.
  await page.goto(`/kritik-hizmetler/${hizmetId}`);
  await expect(page.getByRole("heading", { name: "E2E Kritik Hizmet" })).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "Test Paketi Önizle" }).click();
  const paketSatiri = page.locator(`[data-testid="test-paketi-satir-${tanimId}"]`);
  await expect(paketSatiri).toBeVisible({ timeout: 10_000 });
  await expect(paketSatiri.getByText(testAdi)).toBeVisible();
  await expect(paketSatiri.getByText("Doğrudan bağlı")).toBeVisible();
  await expect(paketSatiri.getByText(/Tarihsel sonuç özeti/)).toBeVisible();
  await expect(paketSatiri.getByText("Açık bulgu mevcut", { exact: false })).toBeVisible();

  // 5) Mühürlü Paket Oluştur → geçmiş listesinde görünür. "Mühürlenmiş paket
  //    geçmişi" metni BİRİKMİŞ önceki koşulardan zaten görünür olabilir — bu
  //    yüzden gerçek POST yanıtını (ve paket hash'ini) bekliyoruz (Faz B
  //    dersi), metin görünürlüğüne körü körüne güvenmiyoruz.
  const [muhurlemeYaniti] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/test-paketi") && r.request().method() === "POST" && r.ok()),
    page.getByRole("button", { name: "Mühürlü Paket Oluştur" }).click(),
  ]);
  const muhurlemeGovde = (await muhurlemeYaniti.json()) as { id: string };

  // 6) Bu koşunun mühürlediği snapshot satırı — kendi kimliğiyle (data-testid)
  //    BİRİKMİŞ eski satırlardan ayırt edilir; "Proof Room Linki Oluştur" bu
  //    satırdan tıklanır (yalnız .first() değil).
  const snapshotSatiri = page.locator(`[data-testid="test-paketi-snapshot-${muhurlemeGovde.id}"]`);
  await expect(snapshotSatiri).toBeVisible({ timeout: 10_000 });
  await snapshotSatiri.getByRole("button", { name: "Proof Room Linki Oluştur" }).click();
  const proofLink = page.getByText(/Proof Room linki: /);
  await expect(proofLink).toBeVisible({ timeout: 10_000 });
  const proofHref = (await proofLink.textContent())!.replace("Proof Room linki: ", "").trim();

  // 7) Anonim (oturumsuz) görünüm — ayrı browser context.
  const anonContext = await page.context().browser()!.newContext();
  const anonPage = await anonContext.newPage();
  await anonPage.goto(proofHref);
  await expect(anonPage.getByRole("heading", { name: /Proof Room/ })).toBeVisible({ timeout: 10_000 });
  await expect(anonPage.getByText(testAdi)).toBeVisible();
  await expect(anonPage.getByText(/Tarihsel sonuç özeti/).first()).toBeVisible();
  const anonMetin = await anonPage.locator("main").innerText();
  expect(anonMetin).not.toContain("Ayşe Yılmaz");
  expect(anonMetin).not.toContain("Mehmet Kaya");
  await anonContext.close();
});

// Dikey F, F3: onaylı etki toleransı → paket önizlemesinde tolerans kartı +
// "karşılaştırma yapılmadı" uyarısı → mühürleme → anonim Proof Room → hiçbir
// yerde "RTO karşılandı"/"RPO karşılandı" YOK. Kirli-DB'ye dayanıklı: paylaşılan
// fixture hizmetinde YURURLUKTE tolerans zaten varsa yeniden kullanılır.
test("F3: onaylı etki toleransı test paketinde görünür — nicel karşılaştırma yok", async ({ page }) => {
  test.setTimeout(90_000);
  await girisYap(page);

  const db = admin();
  const { data: kurum } = await db.from("tenants").select("id").eq("name", "E2E Test Kurumu A.Ş.").single();
  const { data: hizmet } = await db.from("critical_business_services").select("id").eq("tenant_id", kurum!.id).eq("ad", "E2E Kritik Hizmet").single();
  const hizmetId = hizmet!.id as string;

  // Onaylı YURURLUKTE tolerans garanti et (idempotent — varsa dokunma).
  const { data: mevcut } = await db.from("impact_tolerances").select("id").eq("critical_service_id", hizmetId).eq("durum", "YURURLUKTE").maybeSingle();
  if (!mevcut) {
    const { data: profil } = await db.from("profiles").select("id").eq("tenant_id", kurum!.id).limit(1).single();
    const { data: sonSurum } = await db.from("impact_tolerances").select("surum").eq("critical_service_id", hizmetId).order("surum", { ascending: false }).limit(1).maybeSingle();
    await db.from("impact_tolerances").insert({
      tenant_id: kurum!.id, critical_service_id: hizmetId, surum: (sonSurum?.surum ?? 0) + 1,
      max_kesinti_saat: 4, max_veri_kaybi_saat: 1, yonetim_onayi: true, onaylayan: profil!.id, onay_zamani: new Date().toISOString(), durum: "YURURLUKTE",
    });
  }

  await page.goto(`/kritik-hizmetler/${hizmetId}`);
  await expect(page.getByRole("heading", { name: "E2E Kritik Hizmet" })).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "Test Paketi Önizle" }).click();

  // Tolerans kartı + onaylı hedefler + "karşılaştırma yapılmadı" uyarısı.
  const tolKarti = page.locator('[data-testid="etki-toleransi-karti"]');
  await expect(tolKarti).toBeVisible({ timeout: 10_000 });
  await expect(tolKarti.getByText("Onaylı etki toleransı mevcut")).toBeVisible();
  await expect(tolKarti.getByText(/Azami kesinti süresi \(RTO\)/)).toBeVisible();
  await expect(tolKarti.getByText(/nicel karşılaştırma yapılmamıştır/)).toBeVisible();

  // Yasak ifadeler önizlemede YOK.
  const onizlemeMetin = await page.locator("main").innerText();
  expect(onizlemeMetin).not.toContain("RTO karşılandı");
  expect(onizlemeMetin).not.toContain("RPO karşılandı");
  expect(onizlemeMetin).not.toContain("Tolerans içinde");

  // Mühürle → snapshot → anonim Proof Room.
  const [yanit] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/test-paketi") && r.request().method() === "POST" && r.ok()),
    page.getByRole("button", { name: "Mühürlü Paket Oluştur" }).click(),
  ]);
  const govde = (await yanit.json()) as { id: string };
  const snapshotSatiri = page.locator(`[data-testid="test-paketi-snapshot-${govde.id}"]`);
  await expect(snapshotSatiri).toBeVisible({ timeout: 10_000 });
  await snapshotSatiri.getByRole("button", { name: "Proof Room Linki Oluştur" }).click();
  const proofLink = page.getByText(/Proof Room linki: /);
  await expect(proofLink).toBeVisible({ timeout: 10_000 });
  const proofHref = (await proofLink.textContent())!.replace("Proof Room linki: ", "").trim();

  const anonContext = await page.context().browser()!.newContext();
  const anonPage = await anonContext.newPage();
  await anonPage.goto(proofHref);
  await expect(anonPage.getByText("Etki Toleransı", { exact: true })).toBeVisible({ timeout: 10_000 });
  await expect(anonPage.getByText("Onaylı etki toleransı mevcut")).toBeVisible();
  await expect(anonPage.getByText(/nicel karşılaştırma yapılmamıştır/)).toBeVisible();
  const anonMetin = await anonPage.locator("main").innerText();
  expect(anonMetin).not.toContain("RTO karşılandı");
  expect(anonMetin).not.toContain("RPO karşılandı");
  expect(anonMetin).not.toContain("Tolerans içinde");
  await anonContext.close();
});

// Dikey F, F5.1 (kurucunun 21 Temmuz 2026 kararı): F5'in kurtarma
// karşılaştırması, F2/F3 paketine İLİŞKİSEL projekte edilir — yeni motor yok.
// MANUEL_BEYAN + ASTI → paket en fazla INCELEME_GEREKLI (ENGELLENDI DEĞİL);
// ölçüm var ama karşılaştırma yoksa NÖTR bilgi (genelDurum ETKİLENMEZ);
// paket F5'in mühürlü "Beyan edilen..." metnini AYNEN taşır. ADANMIŞ kritik
// hizmet — paylaşılan "E2E Kritik Hizmet" fixture'ına dokunulmaz.
test("F5.1: kurtarma karşılaştırması test paketinde görünür — MANUEL_BEYAN ASTI en fazla İNCELEME_GEREKLI, ölçüm-yalnız NÖTR", async ({ page }) => {
  test.setTimeout(120_000);
  await girisYap(page);

  const db = admin();
  const { data: kurum } = await db.from("tenants").select("id").eq("name", "E2E Test Kurumu A.Ş.").single();
  const { data: profil } = await db.from("profiles").select("id").eq("tenant_id", kurum!.id).limit(1).single();

  const hizmetAdi = `F5.1 Paket Testi Hizmeti ${Date.now()}`;
  const { data: hizmet } = await db.from("critical_business_services").insert({ tenant_id: kurum!.id, ad: hizmetAdi }).select("id").single();
  const hizmetId = hizmet!.id as string;
  await db.from("impact_tolerances").insert({
    tenant_id: kurum!.id, critical_service_id: hizmetId, surum: 1,
    max_kesinti_saat: 4, max_veri_kaybi_saat: 2, yonetim_onayi: true, onaylayan: profil!.id, onay_zamani: "2026-07-01T00:00:00.000Z", durum: "YURURLUKTE",
  });

  await page.goto("/controls");
  await page.getByRole("link", { name: "TODO-DOGRULA-01" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  // Test A: 5 saatlik kesinti (tolerans 4sa → ASTI), veri kaybı yok (tolerans 2sa → KARSILADI).
  const testAAdi = `F5.1-e2e A: aşan ${Date.now()}`;
  await page.getByRole("button", { name: "+ Yeni test tanımı" }).click();
  await page.getByLabel("Test adı").fill(testAAdi);
  await page.getByRole("combobox", { name: "Kritik hizmete bağlı (opsiyonel)" }).click();
  await page.getByRole("option", { name: hizmetAdi, exact: true }).click();
  await page.getByRole("button", { name: "Ekle", exact: true }).click();
  const testASatiri = page.locator("li").filter({ hasText: testAAdi });
  await expect(testASatiri).toBeVisible({ timeout: 10_000 });
  await testASatiri.getByRole("combobox", { name: "Gözlem" }).click();
  await page.getByRole("option", { name: "İddia karşılandı" }).click();
  await testASatiri.getByRole("button", { name: "Çalıştır" }).click();
  await expect(testASatiri.getByText("Geçti", { exact: true }).first()).toBeVisible({ timeout: 10_000 });
  const { data: tanimA } = await db.from("control_test_definitions").select("id").eq("tenant_id", kurum!.id).eq("ad", testAAdi).single();
  const { data: runA } = await db.from("test_runs").select("id").eq("test_definition_id", tanimA!.id).order("calisti_at", { ascending: false }).limit(1).single();

  const olcumBolumuA = page.locator(`[data-testid="kurtarma-olcumu-${runA!.id}"]`);
  await expect(olcumBolumuA).toBeVisible({ timeout: 10_000 });
  await olcumBolumuA.getByRole("button", { name: "Ölçüm Ekle" }).click();
  await olcumBolumuA.getByLabel("Kesinti başlangıcı").fill("2026-07-10T08:00");
  await olcumBolumuA.getByLabel("Hizmet geri geldi").fill("2026-07-10T13:00");
  await olcumBolumuA.getByLabel("Son tutarlı veri anı").fill("2026-07-10T13:00");
  await olcumBolumuA.getByLabel("Kurtarma noktası").fill("2026-07-10T13:00");
  const [olcumYanitiA] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/kurtarma-olcumu") && r.request().method() === "POST" && r.ok()),
    olcumBolumuA.getByRole("button", { name: "Beyanı Kaydet" }).click(),
  ]);
  await olcumYanitiA.json();

  const karsilastirmaBolumuA = page.locator(`[data-testid="kurtarma-karsilastirmasi-${runA!.id}"]`);
  await expect(karsilastirmaBolumuA).toBeVisible({ timeout: 10_000 });
  const [karsilastirmaYanitiA] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/kurtarma-karsilastirmasi") && r.request().method() === "POST" && r.ok()),
    karsilastirmaBolumuA.getByRole("button", { name: "Karşılaştır" }).click(),
  ]);
  await karsilastirmaYanitiA.json();
  await expect(page.locator(`[data-testid="karsilastirma-sonuc-${runA!.id}"]`)).toBeVisible({ timeout: 10_000 });

  // Test B: yalnız ölçüm — karşılaştırma HİÇ tetiklenmez (opsiyonel kalır).
  const testBAdi = `F5.1-e2e B: yalniz olcum ${Date.now()}`;
  await page.getByRole("button", { name: "+ Yeni test tanımı" }).click();
  await page.getByLabel("Test adı").fill(testBAdi);
  await page.getByRole("combobox", { name: "Kritik hizmete bağlı (opsiyonel)" }).click();
  await page.getByRole("option", { name: hizmetAdi, exact: true }).click();
  await page.getByRole("button", { name: "Ekle", exact: true }).click();
  const testBSatiri = page.locator("li").filter({ hasText: testBAdi });
  await expect(testBSatiri).toBeVisible({ timeout: 10_000 });
  await testBSatiri.getByRole("combobox", { name: "Gözlem" }).click();
  await page.getByRole("option", { name: "İddia karşılandı" }).click();
  await testBSatiri.getByRole("button", { name: "Çalıştır" }).click();
  await expect(testBSatiri.getByText("Geçti", { exact: true }).first()).toBeVisible({ timeout: 10_000 });
  const { data: tanimB } = await db.from("control_test_definitions").select("id").eq("tenant_id", kurum!.id).eq("ad", testBAdi).single();
  const { data: runB } = await db.from("test_runs").select("id").eq("test_definition_id", tanimB!.id).order("calisti_at", { ascending: false }).limit(1).single();

  const olcumBolumuB = page.locator(`[data-testid="kurtarma-olcumu-${runB!.id}"]`);
  await expect(olcumBolumuB).toBeVisible({ timeout: 10_000 });
  await olcumBolumuB.getByRole("button", { name: "Ölçüm Ekle" }).click();
  await olcumBolumuB.getByLabel("Kesinti başlangıcı").fill("2026-07-10T08:00");
  await olcumBolumuB.getByLabel("Hizmet geri geldi").fill("2026-07-10T10:00");
  const [olcumYanitiB] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/kurtarma-olcumu") && r.request().method() === "POST" && r.ok()),
    olcumBolumuB.getByRole("button", { name: "Beyanı Kaydet" }).click(),
  ]);
  await olcumYanitiB.json();
  // "Karşılaştır"a HİÇ basılmaz — kartın kendisi görünür ama sonuç yok.
  await expect(page.locator(`[data-testid="kurtarma-karsilastirmasi-${runB!.id}"]`)).toBeVisible({ timeout: 10_000 });

  // Paket önizleme: A'nın satırında Aştı/Beyan edilen, B'nin satırında NÖTR bilgi.
  await page.goto(`/kritik-hizmetler/${hizmetId}`);
  await expect(page.getByRole("heading", { name: hizmetAdi })).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "Test Paketi Önizle" }).click();

  const paketSatiriA = page.locator(`[data-testid="test-paketi-satir-${tanimA!.id}"]`);
  await expect(paketSatiriA).toBeVisible({ timeout: 10_000 });
  const kkOzetiA = paketSatiriA.locator(`[data-testid="kurtarma-karsilastirma-ozeti-${tanimA!.id}"]`);
  await expect(kkOzetiA).toBeVisible({ timeout: 10_000 });
  await expect(kkOzetiA.getByText("Aştı")).toBeVisible();
  await expect(kkOzetiA.getByText(/Beyan edilen/).first()).toBeVisible();

  const paketSatiriB = page.locator(`[data-testid="test-paketi-satir-${tanimB!.id}"]`);
  await expect(paketSatiriB).toBeVisible({ timeout: 10_000 });
  const kkOzetiB = paketSatiriB.locator(`[data-testid="kurtarma-karsilastirma-ozeti-${tanimB!.id}"]`);
  await expect(kkOzetiB).toBeVisible({ timeout: 10_000 });
  await expect(kkOzetiB.getByText("Kurtarma ölçümü mevcut; tolerans karşılaştırması oluşturulmamış.")).toBeVisible();

  // Genel durum: MANUEL_BEYAN ASTI en fazla İNCELEME_GEREKLI — ENGELLENDI DEĞİL.
  await expect(page.getByText("İnceleme gerekli")).toBeVisible();
  const onizlemeMetin = await page.locator("main").innerText();
  expect(onizlemeMetin).not.toContain("RTO karşılandı");
  expect(onizlemeMetin).not.toContain("RPO karşılandı");
  expect(onizlemeMetin).not.toContain("Başarısız test nedeniyle engellendi");

  // Mühürle → Proof Room'da AYNI özet minimize görünür.
  const [muhurlemeYaniti] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/test-paketi") && r.request().method() === "POST" && r.ok()),
    page.getByRole("button", { name: "Mühürlü Paket Oluştur" }).click(),
  ]);
  const muhurlemeGovde = (await muhurlemeYaniti.json()) as { id: string };
  const snapshotSatiri = page.locator(`[data-testid="test-paketi-snapshot-${muhurlemeGovde.id}"]`);
  await expect(snapshotSatiri).toBeVisible({ timeout: 10_000 });
  await snapshotSatiri.getByRole("button", { name: "Proof Room Linki Oluştur" }).click();
  const proofLink = page.getByText(/Proof Room linki: /);
  await expect(proofLink).toBeVisible({ timeout: 10_000 });
  const proofHref = (await proofLink.textContent())!.replace("Proof Room linki: ", "").trim();

  const anonContext = await page.context().browser()!.newContext();
  const anonPage = await anonContext.newPage();
  await anonPage.goto(proofHref);
  await expect(anonPage.getByText(testAAdi)).toBeVisible({ timeout: 10_000 });
  await expect(anonPage.getByText("Aştı", { exact: true })).toBeVisible();
  await expect(anonPage.getByText(/Beyan edilen/).first()).toBeVisible();
  await expect(anonPage.getByText("Kurtarma ölçümü mevcut; tolerans karşılaştırması oluşturulmamış.")).toBeVisible();
  const anonMetin = await anonPage.locator("main").innerText();
  expect(anonMetin).not.toContain("RTO karşılandı");
  expect(anonMetin).not.toContain("RPO karşılandı");
  await anonContext.close();
});
