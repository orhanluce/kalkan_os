import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { E2E_KURUM_ADI, girisYap } from "./helpers";

// M13 (G8): kritik hizmet + etki toleransı (yönetim onaylı yürürlük) +
// bağımlılık (tekil nokta) + sistemik tekil-nokta sinyali. Gerçek Chromium.

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env eksik (.env.local).");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function temizle(db: ReturnType<typeof admin>, tenantId: string) {
  await db.from("critical_business_services").delete().eq("tenant_id", tenantId).like("ad", "E2E-KH%");
}

test("kritik hizmet: tolerans yönetim onayı + bağımlılık + sistemik tekil nokta", async ({ page }) => {
  test.setTimeout(120_000);
  const db = admin();
  const { data: kurum } = await db.from("tenants").select("id").eq("name", E2E_KURUM_ADI).single();
  await temizle(db, kurum!.id);

  try {
    await girisYap(page);
    await page.goto("/kritik-hizmetler");

    // 1) İki kritik hizmet oluştur (sistemik tekil-nokta için).
    await page.getByLabel("Ad").fill("E2E-KH Ödeme");
    await page.getByRole("button", { name: "Oluştur" }).click();
    await expect(page.getByRole("link", { name: "E2E-KH Ödeme" })).toBeVisible();
    await page.getByLabel("Ad").fill("E2E-KH Emir");
    await page.getByRole("button", { name: "Oluştur" }).click();
    await expect(page.getByRole("link", { name: "E2E-KH Emir" })).toBeVisible();

    // 2) Ödeme detayı: tolerans sürümü + yönetim onayıyla yürürlük.
    await page.getByRole("link", { name: "E2E-KH Ödeme" }).click();
    await expect(page.getByRole("heading", { name: "E2E-KH Ödeme" })).toBeVisible();
    await page.getByLabel("Maks. kesinti (saat)").fill("4");
    await page.getByRole("button", { name: "Tolerans Sürümü Ekle" }).click();
    await expect(page.getByText("Maks. kesinti: 4 saat")).toBeVisible();
    await page.getByRole("button", { name: "Yönetim Onayıyla Yürürlüğe Al" }).click();
    await expect(page.getByText("YURURLUKTE")).toBeVisible();

    // 3) Bağımlılık: IAM (tekil nokta) — paylaşılan.
    await page.getByLabel("Bağımlılık adı").fill("IAM");
    await page.getByText("Tekil nokta").locator("input").check();
    await page.getByRole("button", { name: "Bağımlılık Ekle" }).click();
    await expect(page.getByText("IAM")).toBeVisible();

    // 4) Emir'e de IAM ekle → listede sistemik tekil nokta.
    const { data: emir } = await db.from("critical_business_services").select("id").eq("tenant_id", kurum!.id).eq("ad", "E2E-KH Emir").single();
    await db.from("service_dependencies").insert({ tenant_id: kurum!.id, critical_service_id: emir!.id, bagimlilik_turu: "SISTEM", ad: "IAM" });
    await page.goto("/kritik-hizmetler");
    await expect(page.getByText("Sistemik").first()).toBeVisible();
    await expect(page.getByText(/E2E-KH Emir, E2E-KH Ödeme/)).toBeVisible();

    // DB: tolerans YURURLUKTE + yönetim onaylı.
    const { data: odeme } = await db.from("critical_business_services").select("id").eq("tenant_id", kurum!.id).eq("ad", "E2E-KH Ödeme").single();
    const { data: tol } = await db.from("impact_tolerances").select("durum, yonetim_onayi, onaylayan").eq("critical_service_id", odeme!.id).eq("durum", "YURURLUKTE").single();
    expect(tol!.yonetim_onayi).toBe(true);
    expect(tol!.onaylayan).not.toBeNull();
  } finally {
    await temizle(db, kurum!.id);
  }
});
