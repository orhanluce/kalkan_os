import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { E2E_KURUM_ADI, girisYap, ikinciKullaniciGirisYap } from "./helpers";

// G2 (M34 v2) kurucunun dar-ama-çalışan akışı: politika oluştur → madde yaz →
// kontrole bağla → incelemeye gönder → farklı kullanıcıyla onayla (hazırlayan
// onaylayamaz — dört göz) → yürürlüğe al → salt-okur effective + audit zinciri.
// Gerçek Chromium, iki kullanıcı.

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env eksik (.env.local).");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function temizle(db: ReturnType<typeof admin>, tenantId: string) {
  const { data: docs } = await db.from("policy_documents").select("id").eq("tenant_id", tenantId).like("kod", "E2E-POL%");
  for (const d of docs ?? []) await db.from("policy_documents").delete().eq("id", d.id);
}

test("politika: madde → bağla → incele → dört-göz onay → yürürlük → salt-okur + audit", async ({ browser }) => {
  test.setTimeout(150_000);
  const db = admin();
  const { data: kurum } = await db.from("tenants").select("id").eq("name", E2E_KURUM_ADI).single();
  await temizle(db, kurum!.id);

  const adminCtx = await browser.newContext();
  const adminPage = await adminCtx.newPage();
  const uyumCtx = await browser.newContext();
  const uyumPage = await uyumCtx.newPage();
  const kod = "E2E-POL-1";

  try {
    // 1) ADMIN politika oluşturur (liste).
    await girisYap(adminPage);
    await adminPage.goto("/politikalar");
    await adminPage.getByLabel("Kod").fill(kod);
    await adminPage.getByLabel("Başlık").fill("E2E Bilgi Güvenliği Politikası");
    await adminPage.getByRole("button", { name: "Oluştur (v1 taslak)" }).click();
    await expect(adminPage.getByRole("link", { name: kod })).toBeVisible();

    const { data: doc } = await db.from("policy_documents").select("id").eq("tenant_id", kurum!.id).eq("kod", kod).single();
    const detayUrl = `/politikalar/${doc!.id}`;

    // 2-3) ADMIN detaya gider, madde yazar ve KONTROLE bağlar.
    await adminPage.goto(detayUrl);
    await adminPage.getByLabel("Madde referansı").fill("md. 1");
    await adminPage.getByLabel("Metin").fill("Ayrıcalıklı hesaplar MFA ile korunur.");
    await adminPage.getByRole("button", { name: "Madde Ekle" }).click();
    await expect(adminPage.getByText("md. 1", { exact: true })).toBeVisible();
    await adminPage.getByLabel(/kontrole bağla/i).first().selectOption({ index: 1 });
    await expect(adminPage.getByText(/Kontrol:/)).toBeVisible();

    // 4) İncelemeye gönder → IN_REVIEW.
    await adminPage.getByRole("button", { name: "İncelemeye Gönder" }).click();
    await expect(adminPage.getByText("İncelemede", { exact: false }).first()).toBeVisible();

    // 5a) ADMIN (hazırlayan) onaylamaya çalışır → DÖRT GÖZ reddi (409 guard).
    await adminPage.getByRole("button", { name: "Onayla" }).click();
    await expect(adminPage.getByRole("alert").filter({ hasText: "dort goz" })).toBeVisible();

    // 5b) UYUM kullanıcısı onaylar → APPROVED.
    await ikinciKullaniciGirisYap(uyumPage);
    await uyumPage.goto(detayUrl);
    await uyumPage.getByRole("button", { name: "Onayla" }).click();
    await expect(uyumPage.getByText("Onaylandı", { exact: false }).first()).toBeVisible();

    // 6) ADMIN yürürlüğe alır → EFFECTIVE.
    await adminPage.reload();
    await adminPage.getByRole("button", { name: "Yürürlüğe Al" }).click();
    await expect(adminPage.getByText("Yürürlükte", { exact: false }).first()).toBeVisible();

    // 7) Salt-okur (madde formu yok) + audit zinciri görünür.
    await expect(adminPage.getByText("salt-okunur", { exact: false })).toBeVisible();
    await expect(adminPage.getByRole("button", { name: "Madde Ekle" })).toHaveCount(0);
    await expect(adminPage.getByText(/Denetim izi/)).toBeVisible();
    await expect(adminPage.getByText("policy_surum_durum_degisti").first()).toBeVisible();

    // DB doğrulaması: EFFECTIVE + bağ + onay + audit.
    const { data: ver } = await db.from("policy_versions").select("id, durum").eq("policy_document_id", doc!.id).single();
    expect(ver!.durum).toBe("EFFECTIVE");
    const { data: cs } = await db.from("policy_clauses").select("id").eq("policy_version_id", ver!.id);
    const { data: links } = await db.from("policy_clause_links").select("id, control_id").in("policy_clause_id", (cs ?? []).map((c) => c.id));
    expect((links ?? []).some((l) => l.control_id)).toBe(true);
    const { data: aps } = await db.from("policy_approvals").select("id, karar").eq("policy_version_id", ver!.id);
    expect((aps ?? []).length).toBe(1);
  } finally {
    await adminCtx.close();
    await uyumCtx.close();
    await temizle(db, kurum!.id);
  }
});
