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

  // Temizlik.
  await db.from("organization_profiles").delete().eq("tenant_id", kurum!.id);
});
