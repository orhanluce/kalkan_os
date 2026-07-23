import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { E2E_KURUM_ADI, girisYap } from "./helpers";

// V2 PR-2 (ADR-V2-1): onboarding — "hangi amaçla?" seçimi organization_profiles'a
// yazılır (RLS), context header'da görünür, değişiklik scope-recalc olayı üretir.
// Gerçek Chromium + gerçek Supabase.

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env eksik (.env.local).");
  return createClient(url, key, { auth: { persistSession: false } });
}

test("onboarding: kurum türü seç → kaydet → header'da görünür → değiştir → scope olayı", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const db = admin();
  const { data: kurum } = await db.from("tenants").select("id").eq("name", E2E_KURUM_ADI).single();
  // Temiz başlangıç: bu tenant'ın profilini + eski scope olaylarını sil.
  await db.from("organization_profiles").delete().eq("tenant_id", kurum!.id);
  await db.from("sod_outbox").delete().eq("tenant_id", kurum!.id).eq("event_type", "ORGANIZATION_SCOPE_DEGISTI");

  await girisYap(page);

  // Kurulum ekranı: üç seçenek.
  await page.goto("/kurulum");
  await expect(page.getByRole("heading", { name: /hangi amaçla/i })).toBeVisible({ timeout: 15_000 });
  await page.getByText("Kurum finans / hazine departmanı").first().click();
  await page.getByRole("button", { name: "Kur ve devam et" }).click();
  await page.waitForURL((u) => u.pathname === "/", { timeout: 15_000 });

  // DB: profil CORPORATE_FINANCE, finance açık (varsayılan), tamamlandı işaretli.
  const { data: prof1 } = await db
    .from("organization_profiles")
    .select("organization_type, finance_department_enabled, profil_tamamlandi_at")
    .eq("tenant_id", kurum!.id)
    .single();
  expect(prof1!.organization_type).toBe("CORPORATE_FINANCE");
  expect(prof1!.finance_department_enabled).toBe(true);
  expect(prof1!.profil_tamamlandi_at).not.toBeNull();

  // Header'da tür rozeti (lg görünür — geniş viewport'ta).
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.getByRole("link", { name: /Kurum finans/ })).toBeVisible();

  // Değiştir: MIXED_GROUP → scope-recalc olayı düşer. MIXED_GROUP (organizasyon-
  // farkında regülasyon kapsam motoru, e559faf) "Düzenlemeye tabi kuruluş türü"
  // seçimini ZORUNLU kılıyor — regulatedEntitySelectionRequired(MIXED_GROUP)
  // true döner, en az bir tür seçilmeden "Değiştir" disabled kalır.
  await page.goto("/kurulum");
  await page.getByText("Karma şirketler grubu").first().click();
  // "Aracı kurum" ismi bazı kart açıklama metinlerinde de (alt string olarak)
  // geçiyor — grup içine daralt (role="group" aria-label="Kuruluş türleri").
  await page.getByRole("group", { name: "Kuruluş türleri" }).getByRole("button", { name: "Aracı kurum" }).click();
  await page.getByRole("button", { name: "Değiştir" }).click();
  await page.waitForURL((u) => u.pathname === "/", { timeout: 15_000 });

  const { data: prof2 } = await db
    .from("organization_profiles")
    .select("organization_type, regulated_entity_types")
    .eq("tenant_id", kurum!.id)
    .single();
  expect(prof2!.organization_type).toBe("MIXED_GROUP");
  expect(prof2!.regulated_entity_types).toContain("ARACI_KURUM");

  const { data: olaylar } = await db
    .from("sod_outbox")
    .select("payload")
    .eq("tenant_id", kurum!.id)
    .eq("event_type", "ORGANIZATION_SCOPE_DEGISTI");
  expect((olaylar ?? []).length).toBeGreaterThanOrEqual(1);
});
