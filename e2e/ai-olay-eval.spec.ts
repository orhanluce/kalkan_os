import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { E2E_KURUM_ADI, girisYap } from "./helpers";

// M37 sonraki dilim: AI olay (kural 14 kapanış) + eval (kural 13 UNKNOWN).
const SYS = "E2E AI Olay Sistemi";

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env eksik (.env.local).");
  return createClient(url, key, { auth: { persistSession: false } });
}
async function temizle(db: ReturnType<typeof admin>, tenantId: string) {
  await db.from("ai_systems").delete().eq("tenant_id", tenantId).eq("ad", SYS);
}

test("ai: olay kanıtla kapanır (kural 14) + eval UNKNOWN dürüstlüğü (kural 13)", async ({ page }) => {
  test.setTimeout(120_000);
  const db = admin();
  const { data: kurum } = await db.from("tenants").select("id").eq("name", E2E_KURUM_ADI).single();
  await temizle(db, kurum!.id);
  const { data: sys } = await db
    .from("ai_systems")
    .insert({ tenant_id: kurum!.id, ad: SYS, risk_sinifi: "HIGH" })
    .select("id")
    .single();
  const sysId = sys!.id as string;

  try {
    await girisYap(page);
    await page.goto("/ai-guvence");

    // Sistemi seç.
    await page.getByLabel("Olay/eval sistemi").selectOption(sysId);

    // KRİTİK olay ekle.
    await page.getByLabel("Olay özeti").fill("Model çıktısında yanlılık tespit edildi");
    await page.getByLabel("Olay ciddiyeti").selectOption("KRITIK");
    await page.getByRole("button", { name: "Olay Ekle" }).click();
    await expect(page.getByText("Açık ciddi olay")).toBeVisible();

    // Olayı kanıtla kapat (kural 14).
    const { data: inc } = await db.from("ai_incidents").select("id").eq("ai_system_id", sysId).single();
    await page.getByLabel(`${inc!.id} olay kanıtı`).fill("Model yeniden eğitildi, doğrulama #77");
    await page.getByRole("button", { name: "Kapat" }).click();
    await expect(page.getByText("KAPANDI")).toBeVisible();

    // Eval ekle: UNKNOWN (ölçülmedi) — kural 13.
    await page.getByLabel("Eval türü").selectOption("ROBUSTLUK");
    await page.getByLabel("Eval sonucu").selectOption("UNKNOWN");
    await page.getByRole("button", { name: "Eval Ekle" }).click();
    // Eval satırı göründü (exact: option "Robustluk" ile karışmasın).
    await expect(page.getByText("ROBUSTLUK", { exact: true })).toBeVisible();

    // DB: olay KAPANDI + kapatan; eval UNKNOWN.
    const { data: incSon } = await db.from("ai_incidents").select("durum, kapatan, kapanis_kanit").eq("id", inc!.id).single();
    expect(incSon!.durum).toBe("KAPANDI");
    expect(incSon!.kapatan).not.toBeNull();
    const { data: ev } = await db.from("ai_evaluations").select("sonuc").eq("ai_system_id", sysId).single();
    expect(ev!.sonuc).toBe("UNKNOWN");
  } finally {
    await temizle(db, kurum!.id);
  }
});
