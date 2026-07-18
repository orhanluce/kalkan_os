import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { E2E_KURUM_ADI, girisYap, ikinciKullaniciGirisYap } from "./helpers";

// M38+M41 (G7): matter → talep (son tarih) → yanıt taslak → dört-göz onay
// (hazırlayan onaylayamaz) → gönder (makbuz) → bağımsızlık beyanlı dış erişim
// → oturumsuz denetçi görünümü. Gerçek Chromium, iki kullanıcı + misafir.

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env eksik (.env.local).");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function temizle(db: ReturnType<typeof admin>, tenantId: string) {
  const { data: ms } = await db.from("regulatory_matters").select("id").eq("tenant_id", tenantId).like("konu", "E2E-%");
  for (const m of ms ?? []) await db.from("regulatory_matters").delete().eq("id", m.id);
}

test("regülatör: talep → yanıt → dört-göz onay → gönder(makbuz) → beyanlı dış erişim", async ({ browser }) => {
  test.setTimeout(150_000);
  const db = admin();
  const { data: kurum } = await db.from("tenants").select("id").eq("name", E2E_KURUM_ADI).single();
  await temizle(db, kurum!.id);

  const adminCtx = await browser.newContext();
  const adminPage = await adminCtx.newPage();
  const uyumCtx = await browser.newContext();
  const uyumPage = await uyumCtx.newPage();
  const misafirCtx = await browser.newContext();
  const misafirPage = await misafirCtx.newPage();

  try {
    // 1) ADMIN matter oluşturur.
    await girisYap(adminPage);
    await adminPage.goto("/regulator");
    await adminPage.getByLabel("Otorite").fill("SPK");
    await adminPage.getByLabel("Konu").fill("E2E-BS incelemesi");
    await adminPage.getByRole("button", { name: "Oluştur" }).click();
    await expect(adminPage.getByRole("link", { name: "E2E-BS incelemesi" })).toBeVisible();
    const { data: m } = await db.from("regulatory_matters").select("id").eq("tenant_id", kurum!.id).eq("konu", "E2E-BS incelemesi").single();
    const detay = `/regulator/${m!.id}`;

    // 2) Talep + yanıt taslağı.
    await adminPage.goto(detay);
    await adminPage.getByLabel("Talep").fill("Erişim listesi");
    await adminPage.getByLabel("Son tarih").fill("2026-12-31");
    await adminPage.getByRole("button", { name: "Talep Ekle" }).click();
    await expect(adminPage.getByText("Erişim listesi")).toBeVisible();
    await adminPage.getByLabel("Yanıt (yeni sürüm)").fill("İşte erişim listesi yanıtı.");
    await adminPage.getByRole("button", { name: "Yanıt Ekle" }).click();
    await expect(adminPage.getByText("İşte erişim listesi yanıtı.")).toBeVisible();

    // 3) ADMIN (hazırlayan) onaylamaya çalışır → dört göz reddi.
    await adminPage.getByRole("button", { name: "Onayla" }).click();
    await expect(adminPage.getByRole("alert").filter({ hasText: "dört göz" })).toBeVisible();

    // 4) UYUM onaylar.
    await ikinciKullaniciGirisYap(uyumPage);
    await uyumPage.goto(detay);
    await uyumPage.getByRole("button", { name: "Onayla" }).click();
    await expect(uyumPage.getByText("ONAYLANDI")).toBeVisible();

    // 5) ADMIN gönderir (makbuz).
    await adminPage.reload();
    await adminPage.getByRole("button", { name: "Gönder (makbuz)" }).click();
    await expect(adminPage.getByText("GONDERILDI")).toBeVisible();

    // 6) Bağımsızlık beyanlı dış erişim aç.
    await adminPage.getByLabel("Dış e-posta").fill("denetci@firma.com");
    await adminPage.getByRole("button", { name: "Erişim Aç (beyanlı)" }).click();
    const link = adminPage.getByRole("link", { name: /\/matter\// });
    await expect(link).toBeVisible();
    const href = await link.getAttribute("href");

    // 7) OTURUMSUZ denetçi görünümü.
    await misafirPage.goto(href!);
    await expect(misafirPage.getByRole("heading", { name: /SPK — E2E-BS incelemesi/ })).toBeVisible();
    await expect(misafirPage.getByText("Erişim listesi")).toBeVisible();
    await expect(misafirPage.getByText("v1")).toBeVisible(); // gönderilen sürüm

    // DB: yanıt GONDERILDI + makbuz 64-hex; dış görüntüleme audit'te.
    const { data: y } = await db
      .from("regulatory_responses")
      .select("durum, gonderim_receipt")
      .eq("tenant_id", kurum!.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    expect(y!.durum).toBe("GONDERILDI");
    expect(y!.gonderim_receipt).toMatch(/^[0-9a-f]{64}$/);
    const { data: audit } = await db.from("audit_log").select("id").eq("tenant_id", kurum!.id).eq("eylem", "matter_dis_goruntulendi");
    expect((audit ?? []).length).toBeGreaterThan(0);
  } finally {
    await adminCtx.close();
    await uyumCtx.close();
    await misafirCtx.close();
    await temizle(db, kurum!.id);
  }
});
