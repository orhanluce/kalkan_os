import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { E2E_KURUM_ADI, girisYap } from "./helpers";

// M35 sonraki dilim (nihai v3.2 §8.0 sonu öncelik #3): doğrulanmış anket
// şablonu — bir kez yazılır, her değerlendirmede tekrar yazılmadan kopyalanır.
const VENDOR = "E2E Anket Şablonu Vendor A.Ş.";
const SORU = "E2E: Alt yüklenici sözleşmesi denetim hakkı içeriyor mu?";

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

test("tedarikçi: anket şablonu bir kez yazılır, değerlendirmeye kopyalanır", async ({ page }) => {
  test.setTimeout(120_000);
  const db = admin();
  const { data: kurum } = await db.from("tenants").select("id").eq("name", E2E_KURUM_ADI).single();
  await temizle(db, kurum!.id);
  const { data: vendor } = await db
    .from("third_parties")
    .insert({ tenant_id: kurum!.id, ad: VENDOR, tier: "ONEMLI" })
    .select("id")
    .single();
  const vendorId = vendor!.id as string;

  try {
    await girisYap(page);

    // 1) Ana sayfada şablona bir soru ekle (bir kez yazılır).
    await page.goto("/tedarikciler");
    await page.getByLabel("Değerlendirme türü").selectOption("DORA");
    await page.getByLabel("Soru").fill(SORU);
    await page.getByRole("button", { name: "Şablona Ekle" }).click();
    await expect(page.getByText(SORU)).toBeVisible();

    // 2) Vendor detayında yeni değerlendirme aç, şablondan kopyala.
    await page.goto(`/tedarikciler/${vendorId}`);
    await page.getByRole("button", { name: "Yeni Değerlendirme (DORA)" }).click();
    await expect(page.getByText("TASLAK")).toBeVisible();
    await page.getByRole("button", { name: "Şablondan Soru Kopyala" }).click();
    await expect(page.getByText(`• ${SORU}`)).toBeVisible();

    // DB: assessment_questions'a kopyalandı; ŞABLON değişmedi (bağımsız kayıt).
    const { data: asmt } = await db.from("third_party_assessments").select("id").eq("third_party_id", vendorId).single();
    const { data: kopya } = await db.from("assessment_questions").select("soru").eq("assessment_id", asmt!.id).single();
    expect(kopya!.soru).toBe(SORU);
    const { data: sablonSonra } = await db
      .from("assessment_question_templates")
      .select("soru")
      .eq("tenant_id", kurum!.id)
      .eq("tur", "DORA")
      .single();
    expect(sablonSonra!.soru).toBe(SORU);
  } finally {
    await temizle(db, kurum!.id);
  }
});
