import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { E2E_KURUM_ADI, girisYap } from "./helpers";

// V2 PR-4a (M19): kaynak sicili salt-okur; REGULATED org-type'ta Regülasyon
// nav grubu görünür. Gerçek Chromium + gerçek Supabase.

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env eksik (.env.local).");
  return createClient(url, key, { auth: { persistSession: false } });
}

test("kaynak sicili: REGULATED nav + seed'li kaynaklar salt-okur listelenir", async ({ page }) => {
  test.setTimeout(90_000);
  const db = admin();
  const { data: kurum } = await db.from("tenants").select("id").eq("name", E2E_KURUM_ADI).single();
  await db
    .from("organization_profiles")
    .upsert({ tenant_id: kurum!.id, organization_type: "REGULATED_FINANCIAL_INSTITUTION" }, { onConflict: "tenant_id" });

  await girisYap(page);
  await page.reload(); // org profili store'a gelsin
  // REGULATED nav: Regülasyon > Kaynaklar.
  await expect(page.getByRole("link", { name: "Kaynaklar" })).toBeVisible({ timeout: 15_000 });

  await page.goto("/regulasyon/kaynaklar");
  await expect(page.getByRole("heading", { name: "Resmî Kaynak Sicili" })).toBeVisible();
  // Seed'li gerçek kaynaklar (küratör script'i ile eklendi).
  await expect(page.getByRole("link", { name: "SPK Mevzuat Sistemi" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "EUR-Lex", exact: true })).toBeVisible();
  // Erişim politikası rozeti (connector onay bekliyor — kural 3/§13).
  await expect(page.getByText("Politika onayı bekliyor").first()).toBeVisible();
  // PR-Q1' kural 8: hiç çekim olmayan kaynak "güncel" DEĞİL — dürüst mesaj.
  await expect(page.getByText("Hiç çekim yok — güncellik iddia edilemez").first()).toBeVisible();

  // Temizlik.
  await db.from("organization_profiles").delete().eq("tenant_id", kurum!.id);
});

test("PR-Q1': ingest edilen artifact + çekim koşusu tazelik ve nüsha listesinde görünür", async ({ page }) => {
  test.setTimeout(90_000);
  const db = admin();
  const { data: kurum } = await db.from("tenants").select("id").eq("name", E2E_KURUM_ADI).single();
  await db
    .from("organization_profiles")
    .upsert({ tenant_id: kurum!.id, organization_type: "REGULATED_FINANCIAL_INSTITUTION" }, { onConflict: "tenant_id" });

  // Sentetik e2e artifact'ı (kural 3: E2E etiketli, TODO_DOGRULA; sonda silinir).
  const { data: kaynak } = await db.from("regulatory_sources").select("id").eq("ad", "SPK Mevzuat Sistemi").single();
  const sha = [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, "0")).join("");
  const { data: art } = await db
    .from("source_artifacts")
    .insert({ source_id: kaynak!.id, baslik: "E2E sentetik nüsha (silinecek)", sha256: sha, fetched_at: new Date().toISOString() })
    .select("id").single();
  const { data: kosu } = await db
    .from("source_fetch_runs")
    .insert({ source_id: kaynak!.id, durum: "BASARILI", artifact_id: art!.id })
    .select("id").single();

  try {
    await girisYap(page);
    await page.goto("/regulasyon/kaynaklar");
    await expect(page.getByRole("heading", { name: "Resmî Kaynak Sicili" })).toBeVisible();
    // Tazelik: bugünkü başarılı çekim → "Son çekim: bugün".
    await expect(page.getByText("Son çekim: bugün").first()).toBeVisible();
    // Nüsha listesi: <details> aç → başlık + kısaltılmış hash + doğrulama rozeti.
    await page.getByText("nüsha", { exact: false }).first().click();
    await expect(page.getByText("E2E sentetik nüsha (silinecek)")).toBeVisible();
    await expect(page.getByText(`${sha.slice(0, 12)}…`)).toBeVisible();
    await expect(page.getByText("Doğrulanmadı").first()).toBeVisible(); // TODO_DOGRULA doğar (kural 3)
  } finally {
    await db.from("source_fetch_runs").delete().eq("id", kosu!.id);
    await db.from("source_artifacts").delete().eq("id", art!.id);
    await db.from("organization_profiles").delete().eq("tenant_id", kurum!.id);
  }
});
