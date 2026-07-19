import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { E2E_KURUM_ADI, girisYap } from "./helpers";

// M35 sonraki dilim: tedarikçi değerlendirme + bulgu. Açık KRİTİK bulgu varken
// TAMAMLA engellenir (kural: çözülmemiş kritik riskle sign-off yok); bulgu
// kanıtla kapanınca (kural 14) değerlendirme tamamlanır. Gerçek Chromium.

const VENDOR = "E2E Değerlendirme Vendor A.Ş.";

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env eksik (.env.local).");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function temizle(db: ReturnType<typeof admin>, tenantId: string) {
  await db.from("assessment_findings").delete().eq("tenant_id", tenantId);
  await db.from("third_party_assessments").delete().eq("tenant_id", tenantId);
  await db.from("third_parties").delete().eq("tenant_id", tenantId).eq("ad", VENDOR);
}

test("tedarikçi: değerlendirme + KRİTİK bulgu tamamlamayı engeller, kapanınca tamamlanır", async ({ page }) => {
  test.setTimeout(120_000);
  const db = admin();
  const { data: kurum } = await db.from("tenants").select("id").eq("name", E2E_KURUM_ADI).single();
  await temizle(db, kurum!.id);
  const { data: vendor } = await db
    .from("third_parties")
    .insert({ tenant_id: kurum!.id, ad: VENDOR, tier: "KRITIK" })
    .select("id")
    .single();
  const vendorId = vendor!.id as string;

  try {
    await girisYap(page);
    await page.goto(`/tedarikciler/${vendorId}`);

    // Değerlendirme aç.
    await page.getByRole("button", { name: "Yeni Değerlendirme (DORA)" }).click();
    await expect(page.getByText("TASLAK")).toBeVisible();

    // Assessment id'yi al (dinamik aria-label için).
    const { data: asmt } = await db
      .from("third_party_assessments")
      .select("id")
      .eq("third_party_id", vendorId)
      .single();
    const aId = asmt!.id as string;

    // KRİTİK bulgu ekle.
    await page.getByLabel(`${aId} bulgu başlık`).fill("Şifreleme eksikliği");
    await page.getByLabel(`${aId} ciddiyet`).selectOption("KRITIK");
    await page.getByRole("button", { name: "Bulgu Ekle" }).click();
    await expect(page.getByText("Açık KRİTİK bulgu")).toBeVisible();

    // Açık KRİTİK varken Tamamla DISABLED.
    await expect(page.getByRole("button", { name: "Değerlendirmeyi Tamamla" })).toBeDisabled();

    // Bulguyu kanıtla kapat (kural 14).
    const { data: finding } = await db
      .from("assessment_findings")
      .select("id")
      .eq("assessment_id", aId)
      .single();
    const fId = finding!.id as string;
    await page.getByLabel(`${fId} kapanış kanıtı`).fill("HSM devreye alındı, kanıt #123");
    await page.getByRole("button", { name: "Kapat" }).click();
    await expect(page.getByText("KAPANDI")).toBeVisible();

    // Artık tamamlanabilir.
    await page.getByRole("button", { name: "Değerlendirmeyi Tamamla" }).click();
    await expect(page.getByText("TAMAMLANDI")).toBeVisible();

    // DB: TAMAMLANDI + degerlendiren + tamamlandi_at.
    const { data: son } = await db
      .from("third_party_assessments")
      .select("durum, degerlendiren, tamamlandi_at")
      .eq("id", aId)
      .single();
    expect(son!.durum).toBe("TAMAMLANDI");
    expect(son!.degerlendiren).not.toBeNull();
    expect(son!.tamamlandi_at).not.toBeNull();
  } finally {
    await temizle(db, kurum!.id);
  }
});
