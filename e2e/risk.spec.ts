import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { E2E_KURUM_ADI, girisYap } from "./helpers";

// M40 (G8): risk iştahı (yönetim onayı) + KRI ihlal + senaryo kayıp DAĞILIMI
// (varsayım zorunlu, tek puan değil). Gerçek Chromium.

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env eksik (.env.local).");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function temizle(db: ReturnType<typeof admin>, tenantId: string) {
  await db.from("risk_appetites").delete().eq("tenant_id", tenantId);
  await db.from("key_risk_indicators").delete().eq("tenant_id", tenantId).like("ad", "E2E-%");
  await db.from("risk_scenarios").delete().eq("tenant_id", tenantId).like("ad", "E2E-%");
}

test("risk: iştah yönetim onayı + KRI ihlal + senaryo dağılım (varsayım zorunlu)", async ({ page }) => {
  test.setTimeout(120_000);
  const db = admin();
  const { data: kurum } = await db.from("tenants").select("id").eq("name", E2E_KURUM_ADI).single();
  await temizle(db, kurum!.id);

  try {
    await girisYap(page);
    await page.goto("/risk");

    // 1) Risk iştahı → yönetim onayıyla yürürlük.
    await page.getByLabel("İştah eşiği").fill("5");
    await page.getByRole("button", { name: "İştah Ekle" }).click();
    await expect(page.getByText("YURURLUKTE").or(page.getByText("TASLAK"))).toBeVisible();
    await page.getByRole("button", { name: "Yönetim Onayıyla Yürürlüğe Al" }).click();
    await expect(page.getByText("YURURLUKTE")).toBeVisible();

    // 2) KRI + ihlal eden okuma (eşik 5, UST; okuma 8 → İHLAL).
    await page.getByLabel("KRI adı").fill("E2E-Açık kritik bulgu");
    await page.getByLabel("KRI eşiği").fill("5");
    await page.getByRole("button", { name: "KRI Ekle" }).click();
    const kriSatir = page.getByText("E2E-Açık kritik bulgu").locator("xpath=..");
    await kriSatir.getByLabel(/okuma/i).fill("8");
    await kriSatir.getByRole("button", { name: "Okuma Ekle" }).click();
    await expect(page.getByText(/son 8 · İHLAL/)).toBeVisible();

    // 3) Senaryo: varsayımsız → buton disabled; varsayımla dağılım özeti + uyarı.
    await page.getByLabel("Senaryo").fill("E2E-Fidye");
    await page.getByLabel("Min").fill("100");
    await page.getByLabel("Olası").fill("300");
    await page.getByLabel("Max").fill("1000");
    await page.getByLabel("Kontrol maliyeti").fill("5000");
    await page.getByLabel("Risk azaltımı").fill("20000");
    // Varsayım boşken buton disabled.
    await expect(page.getByRole("button", { name: "Senaryo Ekle" })).toBeDisabled();
    await page.getByLabel("Varsayımlar (zorunlu)").fill("Yıllık 1 olay, sektör kıyas verisi.");
    await page.getByRole("button", { name: "Senaryo Ekle" }).click();
    // Tek puan değil: beklenen + P90 + uyarı görünür.
    await expect(page.getByText(/beklenen ≈/)).toBeVisible();
    await expect(page.getByText(/tek kesin sayı değil/)).toBeVisible();
    await expect(page.getByText(/Kontrol fayda oranı: 4.00×/)).toBeVisible();

    // DB: senaryo dağılımı + varsayım saklı.
    const { data: s } = await db.from("risk_scenarios").select("kayip_min, kayip_olasi, kayip_max, varsayimlar").eq("tenant_id", kurum!.id).eq("ad", "E2E-Fidye").single();
    expect(Number(s!.kayip_min)).toBe(100);
    expect(s!.varsayimlar).toContain("sektör");
  } finally {
    await temizle(db, kurum!.id);
  }
});
