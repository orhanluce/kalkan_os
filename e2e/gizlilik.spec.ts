import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { E2E_KURUM_ADI, girisYap } from "./helpers";

// M36 (G6): PrivacyOps — ROPA oluştur; DSAR aç → kimlik doğrulanmadan tamamlama
// reddi → doğrula → tamamla; ihlal kaydet → otorite bildirim saati. Veri sahibi
// maskeli+hash (tam kimlik saklanmaz). Gerçek Chromium + gerçek Supabase.

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env eksik (.env.local).");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function temizle(db: ReturnType<typeof admin>, tenantId: string) {
  await db.from("processing_activities").delete().eq("tenant_id", tenantId).like("ad", "E2E-%");
  await db.from("data_subject_requests").delete().eq("tenant_id", tenantId).like("veri_sahibi_maskeli", "e***%");
  await db.from("privacy_incidents").delete().eq("tenant_id", tenantId).like("ozet", "E2E-%");
}

test("gizlilik: ROPA + DSAR kimlik-doğrulama şartı + ihlal saati; kimlik maskeli+hash", async ({ page }) => {
  test.setTimeout(120_000);
  const db = admin();
  const { data: kurum } = await db.from("tenants").select("id").eq("name", E2E_KURUM_ADI).single();
  await temizle(db, kurum!.id);

  try {
    await girisYap(page);
    await page.goto("/gizlilik");

    // 1) ROPA oluştur.
    await page.getByLabel("Ad").fill("E2E-Bordro");
    await page.getByLabel("Amaç").fill("Maaş ödemesi");
    await page.getByRole("button", { name: "ROPA Ekle" }).click();
    await expect(page.getByText("E2E-Bordro")).toBeVisible();

    // 2) DSAR aç (e-posta → maskeli + hash).
    await page.getByLabel("Veri sahibi (e-posta/kimlik)").fill("e2e-veri@example.com");
    await page.getByRole("button", { name: "DSAR Aç" }).click();
    const dsarSatir = page.getByRole("row").filter({ hasText: "e***@example.com" });
    await expect(dsarSatir).toBeVisible();

    // 3) Kimlik doğrulanmadan Tamamla → DB reddi (hata banner).
    await dsarSatir.getByRole("button", { name: "Tamamla" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Kimlik doğrulanmadan" })).toBeVisible();

    // 4) Kimlik doğrula → Tamamla → TAMAMLANDI.
    await dsarSatir.getByRole("button", { name: "Kimlik Doğrula" }).click();
    await page.getByRole("row").filter({ hasText: "e***@example.com" }).getByRole("button", { name: "Tamamla" }).click();
    await expect(page.getByRole("row").filter({ hasText: "e***@example.com" }).getByText("TAMAMLANDI")).toBeVisible();

    // 5) İhlal kaydet → otorite bildirim saati görünür → bildir.
    await page.getByLabel("Özet").fill("E2E-veri sızıntısı");
    await page.getByRole("button", { name: "İhlal Kaydet" }).click();
    const ihlalSatir = page.getByRole("row").filter({ hasText: "E2E-veri sızıntısı" });
    await expect(ihlalSatir.getByText(/Otorite bildirimine|saat/)).toBeVisible();
    await ihlalSatir.getByRole("button", { name: "Otoriteye Bildirildi" }).click();
    await expect(page.getByRole("row").filter({ hasText: "E2E-veri sızıntısı" }).getByText("BILDIRILDI")).toBeVisible();

    // DB: veri sahibinin TAM e-postası SAKLANMADI (maskeli + 64-hex hash).
    const { data: dsar } = await db
      .from("data_subject_requests")
      .select("veri_sahibi_maskeli, veri_sahibi_hash, kimlik_dogrulandi, durum")
      .eq("tenant_id", kurum!.id)
      .eq("veri_sahibi_maskeli", "e***@example.com")
      .single();
    expect(dsar!.veri_sahibi_maskeli).not.toContain("e2e-veri@example.com");
    expect(dsar!.veri_sahibi_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(dsar!.kimlik_dogrulandi).toBe(true);
    expect(dsar!.durum).toBe("TAMAMLANDI");
  } finally {
    await temizle(db, kurum!.id);
  }
});
