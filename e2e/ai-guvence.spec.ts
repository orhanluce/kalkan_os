import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { E2E_KURUM_ADI, girisYap } from "./helpers";

// M37 (G5): AI governance — sistem ekle/aktifleştir; PROHIBITED aktif reddi;
// yazma-yetkili ajan (insan onayı) + kill/disable; AI Decision Receipt
// SUGGESTED → İNSAN kabul (AI karar veremez). Gerçek Chromium + Supabase.

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env eksik (.env.local).");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function temizle(db: ReturnType<typeof admin>, tenantId: string) {
  const { data: sy } = await db.from("ai_systems").select("id").eq("tenant_id", tenantId).like("ad", "E2E-AI%");
  for (const s of sy ?? []) {
    // receipts ai_system_id ON DELETE RESTRICT → önce receipt+ajan sil (FK sırası).
    await db.from("ai_execution_receipts").delete().eq("ai_system_id", s.id);
    await db.from("ai_agents").delete().eq("ai_system_id", s.id);
    await db.from("ai_systems").delete().eq("id", s.id);
  }
}

test("ai governance: sistem/PROHIBITED reddi/ajan kill + receipt SUGGESTED→insan kabul", async ({ page }) => {
  test.setTimeout(120_000);
  const db = admin();
  const { data: kurum } = await db.from("tenants").select("id").eq("name", E2E_KURUM_ADI).single();
  await temizle(db, kurum!.id);

  try {
    await girisYap(page);
    await page.goto("/ai-guvence");

    // 1) HIGH sistem ekle → aktifleştir.
    await page.getByLabel("Sistem adı").fill("E2E-AI Copilot");
    await page.getByLabel("Risk sınıfı").selectOption("HIGH");
    await page.getByRole("button", { name: "AI Sistemi Ekle" }).click();
    const sysSatir = page.getByRole("row").filter({ hasText: "E2E-AI Copilot" });
    await expect(sysSatir).toBeVisible();
    await sysSatir.getByRole("button", { name: "Aktifleştir" }).click();
    await expect(page.getByRole("row").filter({ hasText: "E2E-AI Copilot" }).getByText("AKTIF")).toBeVisible();

    // 2) PROHIBITED sistem → aktifleştir reddi.
    await page.getByLabel("Sistem adı").fill("E2E-AI Yasak");
    await page.getByLabel("Risk sınıfı").selectOption("PROHIBITED");
    await page.getByRole("button", { name: "AI Sistemi Ekle" }).click();
    const yasakSatir = page.getByRole("row").filter({ hasText: "E2E-AI Yasak" });
    await yasakSatir.getByRole("button", { name: "Aktifleştir" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "yasak uygulama" })).toBeVisible();

    // 3) Yazma yetkili ajan → insan onayı zorunlu; kill/disable.
    await page.getByLabel("Ajan adı").fill("E2E-Ajan");
    await page.getByLabel("Sistem", { exact: true }).selectOption({ label: "E2E-AI Copilot" });
    await page.getByText("Yazma yetkisi").locator("input").check();
    await page.getByRole("button", { name: "Ajan Ekle" }).click();
    const ajanSatir = page.getByRole("row").filter({ hasText: "E2E-Ajan" });
    await expect(ajanSatir.getByText("Evet (onaylı)")).toBeVisible();
    await ajanSatir.getByRole("button", { name: "Devre Dışı Bırak" }).click();
    await expect(page.getByRole("row").filter({ hasText: "E2E-Ajan" }).getByText("DEVRE_DISI")).toBeVisible();

    // 4) AI Decision Receipt: SUGGESTED oluştur → İNSAN kabul → ACCEPTED.
    await page.getByRole("button", { name: /Örnek AI önerisi/ }).click();
    const rSatir = page.getByRole("row").filter({ hasText: "yükümlülük çıkarımı önerisi" });
    await expect(rSatir.getByText("SUGGESTED")).toBeVisible();
    await rSatir.getByRole("button", { name: "Kabul Et" }).click();
    await expect(page.getByRole("row").filter({ hasText: "yükümlülük çıkarımı önerisi" }).getByText("ACCEPTED")).toBeVisible();

    // DB: receipt ACCEPTED + reviewer (insan) dolu; fingerprint 64-hex.
    const { data: rec } = await db
      .from("ai_execution_receipts")
      .select("karar, reviewer, fingerprint")
      .eq("tenant_id", kurum!.id)
      .eq("amac", "yükümlülük çıkarımı önerisi")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    expect(rec!.karar).toBe("ACCEPTED");
    expect(rec!.reviewer).not.toBeNull();
    expect(rec!.fingerprint).toMatch(/^[0-9a-f]{64}$/);
  } finally {
    await temizle(db, kurum!.id);
  }
});
