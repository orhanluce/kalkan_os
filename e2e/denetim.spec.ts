import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { E2E_KURUM_ADI, girisYap, ikinciKullaniciGirisYap } from "./helpers";

// M17 (G8): denetim işi + tekrarlanabilir örnekleme (seed) + çalışma kağıdı
// bağımsızlık sign-off (hazırlayan onaylayamaz). Gerçek Chromium, iki kullanıcı.

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env eksik (.env.local).");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function temizle(db: ReturnType<typeof admin>, tenantId: string) {
  await db.from("audit_engagements").delete().eq("tenant_id", tenantId).like("ad", "E2E-DN%");
}

test("denetim: tekrarlanabilir örnekleme + çalışma kağıdı bağımsızlık sign-off", async ({ browser }) => {
  test.setTimeout(150_000);
  const db = admin();
  const { data: kurum } = await db.from("tenants").select("id").eq("name", E2E_KURUM_ADI).single();
  await temizle(db, kurum!.id);

  const adminCtx = await browser.newContext();
  const adminPage = await adminCtx.newPage();
  const uyumCtx = await browser.newContext();
  const uyumPage = await uyumCtx.newPage();

  try {
    // 1) ADMIN denetim işi oluşturur.
    await girisYap(adminPage);
    await adminPage.goto("/denetim");
    await adminPage.getByLabel("Ad").fill("E2E-DN BS denetimi");
    await adminPage.getByRole("button", { name: "Oluştur" }).click();
    await expect(adminPage.getByRole("link", { name: "E2E-DN BS denetimi" })).toBeVisible();
    await adminPage.getByRole("link", { name: "E2E-DN BS denetimi" }).click();

    // 2) Tekrarlanabilir örnekleme (seed) + yeniden üret doğrula.
    await adminPage.getByLabel("Popülasyon").fill("100");
    await adminPage.getByLabel("Örnek boyutu").fill("10");
    await adminPage.getByLabel("Seed").fill("e2e-seed-1");
    await adminPage.getByRole("button", { name: "Örnek Seç" }).click();
    await expect(adminPage.getByText("e2e-seed-1")).toBeVisible();
    await adminPage.getByRole("button", { name: "Yeniden Üret (doğrula)" }).click();
    await expect(adminPage.getByText(/yeniden üretildi: birebir aynı/)).toBeVisible();

    // 3) ADMIN çalışma kağıdı (hazırlayan) → kendisi onaylayamaz (bağımsızlık).
    await adminPage.getByLabel("Başlık").fill("Erişim testleri");
    await adminPage.getByLabel("İçerik").fill("MFA örneklem sonuçları.");
    await adminPage.getByRole("button", { name: "Çalışma Kağıdı Ekle" }).click();
    await expect(adminPage.getByText("Erişim testleri")).toBeVisible();
    await adminPage.getByRole("button", { name: "Sign-off (onayla)" }).click();
    await expect(adminPage.getByRole("alert").filter({ hasText: "bağımsızlık" })).toBeVisible();

    // 4) UYUM (farklı reviewer) sign-off → ONAYLANDI.
    const { data: eng } = await db.from("audit_engagements").select("id").eq("tenant_id", kurum!.id).eq("ad", "E2E-DN BS denetimi").single();
    await ikinciKullaniciGirisYap(uyumPage);
    await uyumPage.goto(`/denetim/${eng!.id}`);
    await uyumPage.getByRole("button", { name: "Sign-off (onayla)" }).click();
    await expect(uyumPage.getByText("ONAYLANDI")).toBeVisible();

    // DB: workpaper ONAYLANDI + reviewer≠hazırlayan; örnek seed'li seçim saklı.
    const { data: wp } = await db.from("audit_workpapers").select("durum, hazirlayan, reviewer").eq("engagement_id", eng!.id).single();
    expect(wp!.durum).toBe("ONAYLANDI");
    expect(wp!.reviewer).not.toBe(wp!.hazirlayan);
    const { data: s } = await db.from("audit_samples").select("seed, secilen_indeksler").eq("engagement_id", eng!.id).single();
    expect(s!.seed).toBe("e2e-seed-1");
    expect((s!.secilen_indeksler as number[]).length).toBe(10);
  } finally {
    await adminCtx.close();
    await uyumCtx.close();
    await temizle(db, kurum!.id);
  }
});
