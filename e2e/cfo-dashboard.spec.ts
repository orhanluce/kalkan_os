import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { E2E_KURUM_ADI, girisYap } from "./helpers";

// V2 PR-3b: CFO onboarding → CFO odaklı nav (Finans grubu) → CFO dashboard
// (Finans Güvence Özeti) + TTV. Gerçek Chromium + gerçek Supabase.

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env eksik (.env.local).");
  return createClient(url, key, { auth: { persistSession: false } });
}

test("CFO: onboarding CORPORATE_FINANCE → Finans nav + dashboard + TTV", async ({ page }) => {
  test.setTimeout(90_000);
  const db = admin();
  const { data: kurum } = await db.from("tenants").select("id").eq("name", E2E_KURUM_ADI).single();
  await db.from("organization_profiles").delete().eq("tenant_id", kurum!.id);
  await db.from("activation_events").delete().eq("tenant_id", kurum!.id);

  await girisYap(page);

  // CFO tipini seç → PROFILE_COMPLETED aktivasyon olayı düşer.
  await page.goto("/kurulum");
  await page.getByText("Kurum finans / hazine departmanı").first().click();
  await page.getByRole("button", { name: "Kur ve devam et" }).click();
  await page.waitForURL((u) => u.pathname === "/", { timeout: 15_000 });

  // Nav'da Finans grubu belirir (CFO odaklı) — Finans Güvence Özeti linki.
  await expect(page.getByRole("link", { name: "Finans Güvence Özeti" })).toBeVisible({ timeout: 15_000 });

  // CFO dashboard: dört kart + TTV; PROFILE_COMPLETED sonrası ölçüm başladı.
  await page.goto("/cfo");
  await expect(page.getByRole("heading", { name: "Finans Güvence Özeti" })).toBeVisible();
  await expect(page.getByText("Açık SoD çatışması")).toBeVisible();
  await expect(page.getByText("Bekleyen IBAN doğrulaması")).toBeVisible();
  await expect(page.getByText("Değer Süresi (Time-to-Value)")).toBeVisible();
  // Profil tamamlandı ama başka kilometre taşı yok → "henüz yok" görünür.
  await expect(page.getByText(/İlk kanıt: henüz yok/)).toBeVisible();

  // Aktivasyon olayı DB'de.
  const { data: olay } = await db
    .from("activation_events")
    .select("event_type")
    .eq("tenant_id", kurum!.id)
    .eq("event_type", "PROFILE_COMPLETED");
  expect((olay ?? []).length).toBeGreaterThanOrEqual(1);

  // Temizlik: profili kaldır (diğer testler nötr başlasın).
  await db.from("organization_profiles").delete().eq("tenant_id", kurum!.id);
  await db.from("activation_events").delete().eq("tenant_id", kurum!.id);
});
