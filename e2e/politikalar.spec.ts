import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { E2E_KURUM_ADI, girisYap, ikinciKullaniciGirisYap } from "./helpers";

// G2 (M34): Politika yaşam döngüsü — DRAFT→REVIEW→APPROVED→EFFECTIVE, dört-göz
// (hazırlayan kendi sürümünü onaylayamaz, DB guard'ı) ve EFFECTIVE sürüm
// attestation'ı. Gerçek Chromium, iki kullanıcı.

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env eksik (.env.local).");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function temizle(db: ReturnType<typeof admin>, tenantId: string) {
  const { data: docs } = await db.from("policy_documents").select("id").eq("tenant_id", tenantId).like("kod", "E2E-POL%");
  for (const d of docs ?? []) await db.from("policy_documents").delete().eq("id", d.id); // cascade sürüm/madde/attest
}

test("politika: taslak → inceleme → dört-göz onay → yürürlük → attestation", async ({ browser }) => {
  test.setTimeout(120_000);
  const db = admin();
  const { data: kurum } = await db.from("tenants").select("id").eq("name", E2E_KURUM_ADI).single();
  await temizle(db, kurum!.id);

  const adminCtx = await browser.newContext();
  const adminPage = await adminCtx.newPage();
  const uyumCtx = await browser.newContext();
  const uyumPage = await uyumCtx.newPage();
  const kod = "E2E-POL-1";

  try {
    // 1) ADMIN politika oluşturur (v1 taslak) ve incelemeye alır (hazırlayan olur).
    await girisYap(adminPage);
    await adminPage.goto("/politikalar");
    await adminPage.getByLabel("Kod").fill(kod);
    await adminPage.getByLabel("Başlık").fill("E2E Bilgi Güvenliği Politikası");
    await adminPage.getByRole("button", { name: "Oluştur (v1 taslak)" }).click();
    const satir = adminPage.getByRole("row").filter({ hasText: kod });
    await expect(satir.getByText("Taslak")).toBeVisible();
    await satir.getByRole("button", { name: "İncelemeye Al" }).click();
    await expect(satir.getByText("İncelemede")).toBeVisible();

    // 2) ADMIN kendi sürümünü onaylamaya çalışır → DÖRT GÖZ reddi (409 guard).
    await satir.getByRole("button", { name: "Onayla" }).click();
    await expect(adminPage.getByRole("alert").filter({ hasText: "dort goz" })).toBeVisible();
    await expect(satir.getByText("İncelemede")).toBeVisible(); // hâlâ REVIEW

    // 3) UYUM kullanıcısı onaylar → APPROVED (hazırlayan ≠ onaylayan).
    await ikinciKullaniciGirisYap(uyumPage);
    await uyumPage.goto("/politikalar");
    const uyumSatir = uyumPage.getByRole("row").filter({ hasText: kod });
    await uyumSatir.getByRole("button", { name: "Onayla" }).click();
    await expect(uyumSatir.getByText("Onaylandı")).toBeVisible();

    // 4) ADMIN yürürlüğe alır → EFFECTIVE.
    await adminPage.reload();
    const satir2 = adminPage.getByRole("row").filter({ hasText: kod });
    await satir2.getByRole("button", { name: "Yürürlüğe Al" }).click();
    await expect(satir2.getByText("Yürürlükte")).toBeVisible();

    // 5) UYUM kullanıcısı "okudum, anladım" → attestation.
    await uyumPage.reload();
    const uyumSatir2 = uyumPage.getByRole("row").filter({ hasText: kod });
    await uyumSatir2.getByRole("button", { name: "Okudum, anladım" }).click();
    await expect(uyumSatir2.getByRole("button", { name: "Okundu ✓" })).toBeVisible();

    // DB doğrulaması: EFFECTIVE sürüm + attestation kaydı.
    const { data: doc } = await db.from("policy_documents").select("id").eq("tenant_id", kurum!.id).eq("kod", kod).single();
    const { data: ver } = await db.from("policy_versions").select("id, durum").eq("policy_document_id", doc!.id).single();
    expect(ver!.durum).toBe("EFFECTIVE");
    const { data: att } = await db.from("policy_attestations").select("id").eq("policy_version_id", ver!.id);
    expect((att ?? []).length).toBe(1);
  } finally {
    await adminCtx.close();
    await uyumCtx.close();
    await temizle(db, kurum!.id);
  }
});
