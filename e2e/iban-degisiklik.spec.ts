import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { E2E_KURUM_ADI, girisYap, ikinciKullaniciGirisYap } from "./helpers";

// V2 PR-3a (ADR-V2-4): tedarikçi IBAN değişikliği — talep → maker-checker
// (kendi doğrulayamaz) → farklı kullanıcı doğrular. TAM IBAN saklanmaz.
// Gerçek Chromium + gerçek Supabase.

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env eksik (.env.local).");
  return createClient(url, key, { auth: { persistSession: false } });
}

test("IBAN değişikliği: talep → maker-checker → ikinci kullanıcı doğrular; tam IBAN yok", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const db = admin();
  const damga = Date.now();
  const tedarikci = `Acme-${damga}`;
  const tamIban = "TR330006100519786457841326";

  await girisYap(page);
  await page.goto("/cfo/iban-degisiklik");
  await expect(page.getByRole("heading", { name: /IBAN Değişikliği/i })).toBeVisible({ timeout: 15_000 });

  await page.getByLabel("Tedarikçi").fill(tedarikci);
  await page.getByLabel("Out-of-band doğrulama kanalı").fill("bilinen yetkiliyle telefon");
  await page.getByLabel(/Yeni IBAN/).fill(tamIban);
  await page.getByRole("button", { name: "Değişiklik Kaydı Aç" }).click();
  await expect(page.getByRole("status")).toContainText("farklı bir yetkili", { timeout: 15_000 });

  // Talep eden kendi kaydını doğrulayamaz (UI).
  const satir = page.locator("tr").filter({ hasText: tedarikci });
  await expect(satir.getByText("Kendi talebinizi doğrulayamazsınız")).toBeVisible();

  // DB: maskeli + hash saklandı, tam IBAN YOK.
  const { data: kurum } = await db.from("tenants").select("id").eq("name", E2E_KURUM_ADI).single();
  const { data: kayit } = await db
    .from("supplier_bank_change_verifications")
    .select("yeni_iban_maskeli, yeni_iban_hash, durum")
    .eq("tenant_id", kurum!.id)
    .eq("tedarikci_ad", tedarikci)
    .single();
  expect(kayit!.yeni_iban_maskeli).toContain("*");
  expect(kayit!.yeni_iban_maskeli).not.toContain(tamIban); // tam değer maskede yok
  expect(kayit!.yeni_iban_hash).toMatch(/^[0-9a-f]{64}$/);
  expect(kayit!.yeni_iban_hash).not.toContain("6457"); // ham hane hash'te yok
  expect(kayit!.durum).toBe("TALEP_EDILDI");

  // Farklı kullanıcı doğrular.
  await page.getByRole("button", { name: "Çıkış" }).click();
  await page.waitForURL("**/giris");
  await ikinciKullaniciGirisYap(page);
  await page.goto("/cfo/iban-degisiklik");
  const satir2 = page.locator("tr").filter({ hasText: tedarikci });
  await satir2.getByLabel("Karar notu").fill("Tedarikçi mali müdürüyle telefonla teyit edildi.");
  await satir2.getByRole("button", { name: "Doğrula" }).click();
  await expect(page.getByRole("status")).toContainText("doğrulandı", { timeout: 15_000 });

  const { data: son } = await db
    .from("supplier_bank_change_verifications")
    .select("durum, dogrulayan")
    .eq("tenant_id", kurum!.id)
    .eq("tedarikci_ad", tedarikci)
    .single();
  expect(son!.durum).toBe("DOGRULANDI");
  expect(son!.dogrulayan).not.toBeNull();
});
