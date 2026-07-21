import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { girisYap } from "./helpers";

// Dikey F, F4: test tanımı → PASSED koşu → kurtarma ölçümü (olay zamanları) →
// "kullanıcı beyanı" rozeti + türetilmiş süreler → hiçbir yerde "RTO/RPO
// karşılandı" YOK → anonim Proof Room'da minimize ölçüm + "beyandır" uyarısı.
function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env eksik (.env.local).");
  return createClient(url, key, { auth: { persistSession: false } });
}

test("F4: kurtarma ölçümü yakalama → beyan rozeti → anonim Proof Room (karşılaştırma yok)", async ({ page }) => {
  test.setTimeout(90_000);
  await girisYap(page);
  const db = admin();
  const { data: kurum } = await db.from("tenants").select("id").eq("name", "E2E Test Kurumu A.Ş.").single();

  await page.goto("/controls");
  await page.getByRole("link", { name: "TODO-DOGRULA-01" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  // 1) Yeni test tanımı + PASSED koşu.
  await page.getByRole("button", { name: "+ Yeni test tanımı" }).click();
  const testAdi = `F4-e2e: restore ${Date.now()}`;
  await page.getByLabel("Test adı").fill(testAdi);
  await page.getByRole("button", { name: "Ekle", exact: true }).click();
  const testSatiri = page.locator("li").filter({ hasText: testAdi });
  await expect(testSatiri).toBeVisible({ timeout: 10_000 });
  await testSatiri.getByRole("combobox", { name: "Gözlem" }).click();
  await page.getByRole("option", { name: "İddia karşılandı" }).click();
  await testSatiri.getByRole("button", { name: "Çalıştır" }).click();
  await expect(testSatiri.getByText("Geçti", { exact: true }).first()).toBeVisible({ timeout: 10_000 });

  // Koşu id'sini DB'den al (data-testid ile scope için).
  const { data: tanim } = await db.from("control_test_definitions").select("id").eq("tenant_id", kurum!.id).eq("ad", testAdi).single();
  const { data: run } = await db.from("test_runs").select("id").eq("test_definition_id", tanim!.id).order("calisti_at", { ascending: false }).limit(1).single();
  const runId = run!.id as string;

  // 2) Kurtarma ölçümü bölümü — olay zamanlarıyla beyan gir.
  const olcumBolumu = page.locator(`[data-testid="kurtarma-olcumu-${runId}"]`);
  await expect(olcumBolumu).toBeVisible({ timeout: 10_000 });
  await olcumBolumu.getByRole("button", { name: "Ölçüm Ekle" }).click();
  await olcumBolumu.getByLabel("Kesinti başlangıcı").fill("2026-07-10T08:00");
  await olcumBolumu.getByLabel("Hizmet geri geldi").fill("2026-07-10T12:00");
  const [yanit] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/kurtarma-olcumu") && r.request().method() === "POST" && r.ok()),
    olcumBolumu.getByRole("button", { name: "Beyanı Kaydet" }).click(),
  ]);
  const govde = (await yanit.json()) as { id: string };

  // 3) Ölçüm satırı: "kullanıcı beyanı" + 4 saat kesinti süresi.
  const satir = page.locator(`[data-testid="olcum-satir-${govde.id}"]`);
  await expect(satir).toBeVisible({ timeout: 10_000 });
  await expect(satir.getByText("Kullanıcı beyanı (otomatik ölçüm değil)")).toBeVisible();
  await expect(satir.getByText(/Kesinti süresi: 4 saat/)).toBeVisible();

  // 4) Yasak ifadeler UI'da YOK.
  const uiMetin = await page.locator("main").innerText();
  expect(uiMetin).not.toContain("RTO karşılandı");
  expect(uiMetin).not.toContain("RPO karşılandı");
  expect(uiMetin).not.toContain("tolerans içinde");

  // 5) Proof Room linki (admin client) → anonim görünüm.
  const { data: link } = await db
    .from("proof_room_links")
    .insert({ tenant_id: kurum!.id, test_run_id: runId, son_gecerlilik: new Date(Date.now() + 86400000).toISOString() })
    .select("token")
    .single();
  const anonContext = await page.context().browser()!.newContext();
  const anonPage = await anonContext.newPage();
  await anonPage.goto(`/proof/${link!.token}`);
  await expect(anonPage.getByText("Kurtarma Ölçümü", { exact: true })).toBeVisible({ timeout: 10_000 });
  await expect(anonPage.getByText("Kullanıcı beyanı (otomatik ölçüm değil)")).toBeVisible();
  await expect(anonPage.getByText(/nicel karşılaştırma\s+yapılmamıştır/)).toBeVisible();
  const anonMetin = await anonPage.locator("main").innerText();
  expect(anonMetin).not.toContain("RTO karşılandı");
  expect(anonMetin).not.toContain("RPO karşılandı");
  await anonContext.close();

  // Temizlik: bu koşunun proof linkini kaldır (kirli-DB dostu; ölçüm append-only kalır).
  await db.from("proof_room_links").delete().eq("token", link!.token);
});
