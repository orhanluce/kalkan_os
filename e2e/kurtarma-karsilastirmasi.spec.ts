import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { girisYap } from "./helpers";

// Dikey F, F5: test tanımı (kritik hizmete BAĞLI) → PASSED koşu → kurtarma
// ölçümü (olay zamanları) → "Karşılaştır" → onaylı tolerans sürümüyle RTO/RPO
// BAĞIMSIZ sonuç + doğru dil (beyan) → tolerans sürüm değişse de bu
// karşılaştırma DONMUŞ kalır → anonim Proof Room'da minimize görünüm.
function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env eksik (.env.local).");
  return createClient(url, key, { auth: { persistSession: false } });
}

test("F5: kurtarma karşılaştırması → RTO/RPO bağımsız sonuç → anonim Proof Room", async ({ page }) => {
  test.setTimeout(90_000);
  await girisYap(page);
  const db = admin();
  const { data: kurum } = await db.from("tenants").select("id").eq("name", "E2E Test Kurumu A.Ş.").single();
  const { data: profil } = await db.from("profiles").select("id").eq("tenant_id", kurum!.id).limit(1).single();

  // 0) Bu spec'e özel, ADANMIŞ kritik hizmet + bilinen eşik değerli tolerans —
  // paylaşılan "E2E Kritik Hizmet" fixture'ına dokunmadan deterministik assert.
  const hizmetAdi = `F5 Karşılaştırma Testi Hizmeti ${Date.now()}`;
  const { data: hizmet } = await db
    .from("critical_business_services")
    .insert({ tenant_id: kurum!.id, ad: hizmetAdi })
    .select("id")
    .single();
  const hizmetId = hizmet!.id as string;
  await db.from("impact_tolerances").insert({
    tenant_id: kurum!.id,
    critical_service_id: hizmetId,
    surum: 1,
    max_kesinti_saat: 4,
    max_veri_kaybi_saat: 2,
    yonetim_onayi: true,
    onaylayan: profil!.id,
    onay_zamani: "2026-07-01T00:00:00.000Z",
    durum: "YURURLUKTE",
  });

  await page.goto("/controls");
  await page.getByRole("link", { name: "TODO-DOGRULA-01" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  // 1) Yeni test tanımı — YENİ kritik hizmete BAĞLI olarak oluştur.
  await page.getByRole("button", { name: "+ Yeni test tanımı" }).click();
  const testAdi = `F5-e2e: restore ${Date.now()}`;
  await page.getByLabel("Test adı").fill(testAdi);
  await page.getByLabel("Kritik hizmete bağlı (opsiyonel)").click();
  await page.getByRole("option", { name: hizmetAdi, exact: true }).click();
  await page.getByRole("button", { name: "Ekle", exact: true }).click();
  const testSatiri = page.locator("li").filter({ hasText: testAdi });
  await expect(testSatiri).toBeVisible({ timeout: 10_000 });
  await testSatiri.getByRole("combobox", { name: "Gözlem" }).click();
  await page.getByRole("option", { name: "İddia karşılandı" }).click();
  await testSatiri.getByRole("button", { name: "Çalıştır" }).click();
  await expect(testSatiri.getByText("Geçti", { exact: true }).first()).toBeVisible({ timeout: 10_000 });

  const { data: tanim } = await db.from("control_test_definitions").select("id").eq("tenant_id", kurum!.id).eq("ad", testAdi).single();
  const { data: run } = await db.from("test_runs").select("id").eq("test_definition_id", tanim!.id).order("calisti_at", { ascending: false }).limit(1).single();
  const runId = run!.id as string;

  // 2) Kurtarma ölçümü — olay zamanlarıyla, 3 saatlik kesinti (tolerans 4 saat → KARSILADI), veri kaybı yok (0 saat → tolerans 2 saat → KARSILADI).
  const olcumBolumu = page.locator(`[data-testid="kurtarma-olcumu-${runId}"]`);
  await expect(olcumBolumu).toBeVisible({ timeout: 10_000 });
  await olcumBolumu.getByRole("button", { name: "Ölçüm Ekle" }).click();
  await olcumBolumu.getByLabel("Kesinti başlangıcı").fill("2026-07-10T08:00");
  await olcumBolumu.getByLabel("Hizmet geri geldi").fill("2026-07-10T11:00");
  await olcumBolumu.getByLabel("Son tutarlı veri anı").fill("2026-07-10T11:00");
  await olcumBolumu.getByLabel("Kurtarma noktası").fill("2026-07-10T11:00");
  const [olcumYanit] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/kurtarma-olcumu") && r.request().method() === "POST" && r.ok()),
    olcumBolumu.getByRole("button", { name: "Beyanı Kaydet" }).click(),
  ]);
  await olcumYanit.json();

  // 3) "Onaylı Hedefle Karşılaştırma" kartı görünür — Karşılaştır'a tıkla.
  const karsilastirmaBolumu = page.locator(`[data-testid="kurtarma-karsilastirmasi-${runId}"]`);
  await expect(karsilastirmaBolumu).toBeVisible({ timeout: 10_000 });
  const [karsilastirmaYanit] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/kurtarma-karsilastirmasi") && r.request().method() === "POST" && r.ok()),
    karsilastirmaBolumu.getByRole("button", { name: "Karşılaştır" }).click(),
  ]);
  await karsilastirmaYanit.json();

  // 4) Sonuç: RTO=Karşıladı (3<=4), RPO=Karşıladı (0<=2) — BAĞIMSIZ rozetler.
  const sonuc = page.locator(`[data-testid="karsilastirma-sonuc-${runId}"]`);
  await expect(sonuc).toBeVisible({ timeout: 10_000 });
  await expect(sonuc.getByText("RTO")).toBeVisible();
  await expect(sonuc.getByText("RPO")).toBeVisible();
  await expect(sonuc.getByText("Karşıladı")).toHaveCount(2);

  // 5) Dil doğru: MANUEL_BEYAN → "beyan edilen değer" ifadesi; bare "RTO/RPO karşılandı" YOK.
  const uiMetin = await page.locator("main").innerText();
  expect(uiMetin).toContain("Beyan edilen");
  expect(uiMetin).not.toContain("RTO karşılandı");
  expect(uiMetin).not.toContain("RPO karşılandı");

  // 6) Toleransı YENİ (daha sıkı) bir sürüme geçir — eski karşılaştırma DONMUŞ kalmalı.
  const { data: eskiTolerans } = await db.from("impact_tolerances").select("id").eq("critical_service_id", hizmetId).eq("durum", "YURURLUKTE").single();
  await db.from("impact_tolerances").update({ durum: "SUPERSEDED" }).eq("id", eskiTolerans!.id);
  await db.from("impact_tolerances").insert({
    tenant_id: kurum!.id,
    critical_service_id: hizmetId,
    surum: 2,
    max_kesinti_saat: 1,
    max_veri_kaybi_saat: 1,
    yonetim_onayi: true,
    onaylayan: profil!.id,
    onay_zamani: new Date().toISOString(),
    durum: "YURURLUKTE",
  });
  await page.reload();
  const olcumBolumu2 = page.locator(`[data-testid="kurtarma-olcumu-${runId}"]`);
  await olcumBolumu2.getByRole("button", { name: "Ölçüm Ekle" }).click();
  // Panel yeniden AÇILDIĞINDA "Karşılaştır" ÇAĞRILMADI — mevcut GET, DONMUŞ
  // (v1 eşikli) karşılaştırmayı göstermeli; yeni v2 (1sa/1sa) tolerans
  // geçmiş sonucu SESSİZCE değiştirmemeli (sealed-threshold garantisi).
  const sonuc2 = page.locator(`[data-testid="karsilastirma-sonuc-${runId}"]`);
  await expect(sonuc2).toBeVisible({ timeout: 10_000 });
  await expect(sonuc2.getByText("Karşıladı")).toHaveCount(2);

  // 7) Anonim Proof Room: aynı özet, minimize (ham FK yok).
  const { data: link } = await db
    .from("proof_room_links")
    .insert({ tenant_id: kurum!.id, test_run_id: runId, son_gecerlilik: new Date(Date.now() + 86400000).toISOString() })
    .select("token")
    .single();
  const anonContext = await page.context().browser()!.newContext();
  const anonPage = await anonContext.newPage();
  await anonPage.goto(`/proof/${link!.token}`);
  await expect(anonPage.getByText("Onaylı Hedefle Karşılaştırma", { exact: true })).toBeVisible({ timeout: 10_000 });
  await expect(anonPage.getByText("v1")).toBeVisible();
  const anonMetin = await anonPage.locator("main").innerText();
  expect(anonMetin).not.toContain("RTO karşılandı");
  expect(anonMetin).not.toContain("RPO karşılandı");
  await anonContext.close();

  // Temizlik: proof linki kaldır (kirli-DB dostu; karşılaştırma/ölçüm/tolerans append-only kalır).
  await db.from("proof_room_links").delete().eq("token", link!.token);
});
