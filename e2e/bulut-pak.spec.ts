import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { E2E_KURUM_ADI, girisYap } from "./helpers";

// Nihai v3.3 §8.0 Dikey 3: bulut güvence paketi — pak maddesi kaynak künyesiyle
// TODO_DOGRULA doğar (kural 6: auto-VERIFIED yok), insan doğrulayıcı VERIFIED
// yapar, değerlendirmeye kopyalanınca künye taşınır. Gerçek Chromium.

const SORU = "E2E: Bulut sağlayıcı olay bildirim süresi sözleşmede tanımlı mı?";
const VENDOR = "E2E Bulut Pak Vendor A.Ş.";

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env eksik (.env.local).");
  return createClient(url, key, { auth: { persistSession: false } });
}
async function temizle(db: ReturnType<typeof admin>, tenantId: string) {
  await db.from("assessment_questions").delete().eq("tenant_id", tenantId).eq("soru", SORU);
  await db.from("assessment_question_templates").delete().eq("tenant_id", tenantId).eq("soru", SORU);
  await db.from("third_party_assessments").delete().eq("tenant_id", tenantId);
  await db.from("third_parties").delete().eq("tenant_id", tenantId).eq("ad", VENDOR);
}

test("bulut pak: madde TODO_DOGRULA doğar → VERIFIED → değerlendirmeye künyeyle kopyalanır", async ({ page }) => {
  test.setTimeout(120_000);
  const db = admin();
  const { data: kurum } = await db.from("tenants").select("id").eq("name", E2E_KURUM_ADI).single();
  await temizle(db, kurum!.id);
  const { data: vendor } = await db.from("third_parties").insert({ tenant_id: kurum!.id, ad: VENDOR, tier: "KRITIK" }).select("id").single();
  const vendorId = vendor!.id as string;

  try {
    await girisYap(page);

    // 1) Pak maddesi ekle (kategori + kaynak künyesi).
    await page.goto("/tedarikciler");
    await page.getByLabel("Değerlendirme türü").selectOption("DORA");
    await page.getByLabel("Soru").fill(SORU);
    await page.getByLabel("Bulut alanı (opsiyonel)").selectOption("OLAY_BILDIRIM");
    await page.getByLabel("Kaynak künyesi (opsiyonel)").fill("DORA md.28");
    await page.getByLabel("Kaynak sürümü (opsiyonel)").fill("RTS-2024");
    await page.getByRole("button", { name: "Şablona Ekle" }).click();
    await expect(page.getByText(SORU)).toBeVisible();
    // Kural 6: TODO_DOGRULA doğar, "Doğrulanmadı" gösterilir.
    await expect(page.getByText("Doğrulanmadı")).toBeVisible();
    await expect(page.getByText("[DORA md.28 · RTS-2024]")).toBeVisible();

    // DB: TODO_DOGRULA + kategori.
    const { data: tmpl } = await db
      .from("assessment_question_templates")
      .select("id, dogrulama_durumu, kategori, kaynak_citation")
      .eq("soru", SORU)
      .single();
    expect(tmpl!.dogrulama_durumu).toBe("TODO_DOGRULA");
    expect(tmpl!.kategori).toBe("OLAY_BILDIRIM");

    // 2) İnsan doğrulayıcı VERIFIED yapar.
    await page.getByRole("button", { name: "Doğrula (VERIFIED)" }).click();
    await expect(page.getByText("Doğrulandı")).toBeVisible();
    const { data: tmpl2 } = await db.from("assessment_question_templates").select("dogrulama_durumu, dogrulayan").eq("id", tmpl!.id).single();
    expect(tmpl2!.dogrulama_durumu).toBe("VERIFIED");
    expect(tmpl2!.dogrulayan).not.toBeNull();

    // 3) Değerlendirmeye kopyala — künye taşınır, uygulanabilirlik UNKNOWN.
    await page.goto(`/tedarikciler/${vendorId}`);
    await page.getByRole("button", { name: "Yeni Değerlendirme (DORA)" }).click();
    await expect(page.getByText("TASLAK")).toBeVisible();
    await page.getByRole("button", { name: "Şablondan Soru Kopyala" }).click();
    await expect(page.getByText(`• ${SORU}`)).toBeVisible();

    const { data: asmt } = await db.from("third_party_assessments").select("id").eq("third_party_id", vendorId).single();
    const { data: kopya } = await db.from("assessment_questions").select("kaynak_citation, uygulanabilirlik").eq("assessment_id", asmt!.id).single();
    expect(kopya!.kaynak_citation).toBe("DORA md.28");
    expect(kopya!.uygulanabilirlik).toBe("UNKNOWN");
  } finally {
    await temizle(db, kurum!.id);
  }
});
