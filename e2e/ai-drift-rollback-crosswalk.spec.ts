import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { E2E_KURUM_ADI, girisYap, ikinciKullaniciGirisYap } from "./helpers";

// Nihai talimat v3.3 §8.0 Dikey 4 KALANI (ROADMAP §1.47): segment-bazlı drift
// sonucu + insan override gerekçesi + model rollback/son test + ISO
// 42001↔27001 crosswalk (regulasyon-dogrulama.spec.ts'in dört-göz deseniyle).
const SYS = "E2E AI Dikey4 Kalan Sistemi";
const ISO_42001 = "E2E.6.1.2";
const ISO_27001 = "E2E.A.5.1";

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env eksik (.env.local).");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function temizle(db: ReturnType<typeof admin>, tenantId: string) {
  await db.from("ai_systems").delete().eq("tenant_id", tenantId).eq("ad", SYS);
  await db.from("iso_42001_27001_crosswalk").delete().eq("iso42001_ref", ISO_42001).eq("iso27001_ref", ISO_27001);
}

test("AI güvence Dikey 4 kalanı: segment drift + insan override + rollback/son test + ISO crosswalk dört-göz", async ({ browser }) => {
  test.setTimeout(120_000);
  const db = admin();
  const { data: kurum } = await db.from("tenants").select("id").eq("name", E2E_KURUM_ADI).single();
  await temizle(db, kurum!.id);
  const { data: sys } = await db.from("ai_systems").insert({ tenant_id: kurum!.id, ad: SYS, risk_sinifi: "HIGH" }).select("id").single();
  const sysId = sys!.id as string;

  const uyumCtx = await browser.newContext();
  const uyumPage = await uyumCtx.newPage();
  const adminCtx = await browser.newContext();
  const adminPage = await adminCtx.newPage();

  try {
    await girisYap(adminPage);
    await adminPage.goto("/ai-guvence");
    await adminPage.getByLabel("Olay/eval sistemi").selectOption(sysId);

    // --- Segment-bazlı drift + insan override gerekçesi ---
    await adminPage.getByLabel("Drift metriği").fill("accuracy");
    await adminPage.getByLabel("Drift değeri").fill("0.5");
    await adminPage.getByLabel("Drift baseline").fill("0.9");
    await adminPage.getByLabel("Drift eşiği").fill("0.1");
    await adminPage.getByLabel("Drift eşik kaynağı").fill("E2E Model Politikası v1");
    await adminPage.getByLabel("Drift segmenti").fill("bolge:istanbul");
    await adminPage.getByRole("button", { name: "Drift Okuması Ekle" }).click();
    await expect(adminPage.getByText("accuracy [bolge:istanbul]: Aşıldı", { exact: false })).toBeVisible();

    const { data: drift } = await db.from("ai_drift_readings").select("id").eq("ai_system_id", sysId).single();
    await adminPage.getByLabel(`${drift!.id} override gerekçesi`).fill("E2E: bilinen mevsimsel sapma");
    await adminPage.getByRole("button", { name: "İnsan Override Et" }).click();
    await expect(adminPage.getByText("Aşıldı (override)", { exact: false })).toBeVisible();
    await expect(adminPage.getByText("Override: E2E: bilinen mevsimsel sapma")).toBeVisible();

    // DB doğrulaması: override insan atfı + zaman taşır.
    const { data: driftAfter } = await db.from("ai_drift_readings").select("override_edildi, override_eden").eq("id", drift!.id).single();
    expect(driftAfter!.override_edildi).toBe(true);
    expect(driftAfter!.override_eden).not.toBeNull();

    // --- Model rollback + son test kanıtı (kanıtsız "tamamlandı" yok) ---
    await adminPage.getByLabel("Rollback önceki sürüm").fill("v2");
    await adminPage.getByLabel("Rollback yeni sürüm").fill("v1");
    await adminPage.getByLabel("Rollback sebebi").fill("E2E: drift eşiği aşıldı");
    await adminPage.getByRole("button", { name: "Rollback Kaydı Ekle" }).click();
    await expect(adminPage.getByText("v2 → v1: E2E: drift eşiği aşıldı")).toBeVisible();
    await expect(adminPage.getByText("TASLAK")).toBeVisible();

    const { data: rollback } = await db.from("ai_model_rollbacks").select("id").eq("ai_system_id", sysId).single();
    await adminPage.getByLabel(`${rollback!.id} son test kanıtı`).fill("E2E regresyon paketi #42");
    await adminPage.getByRole("button", { name: "Son Test Kanıtıyla Tamamla" }).click();
    await expect(adminPage.getByText("TAMAMLANDI")).toBeVisible();

    const { data: rollbackAfter } = await db.from("ai_model_rollbacks").select("durum, son_test_kaniti, karar_veren").eq("id", rollback!.id).single();
    expect(rollbackAfter!.durum).toBe("TAMAMLANDI");
    expect(rollbackAfter!.son_test_kaniti).toBe("E2E regresyon paketi #42");
    expect(rollbackAfter!.karar_veren).not.toBeNull();

    // --- ISO 42001↔27001 crosswalk: UYUM sunar → ADMIN onaylar (dört-göz) ---
    await ikinciKullaniciGirisYap(uyumPage);
    await uyumPage.goto("/ai-guvence");
    await uyumPage.getByLabel("ISO 42001 referansı").fill(ISO_42001);
    await uyumPage.getByLabel("ISO 27001 referansı").fill(ISO_27001);
    await uyumPage.getByRole("button", { name: "Crosswalk Öner (TODO_DOĞRULA)" }).click();
    await expect(uyumPage.getByText(`42001 §${ISO_42001} ↔ 27001 §${ISO_27001}`)).toBeVisible();
    const { data: cwRow } = await db.from("iso_42001_27001_crosswalk").select("id").eq("iso42001_ref", ISO_42001).eq("iso27001_ref", ISO_27001).single();
    const uyumSatir = uyumPage.getByTestId(`crosswalk-${cwRow!.id}`);
    await uyumSatir.getByRole("button", { name: "İncelemeye Al" }).click();
    await expect(uyumSatir.getByText("LEGAL_REVIEW")).toBeVisible();

    // UYUM onaylamaya çalışır → rol kapısı (karar admin'de).
    await uyumSatir.getByRole("button", { name: "Onayla" }).click();
    await expect(uyumPage.getByRole("alert").filter({ hasText: "admin" })).toBeVisible();

    // ADMIN onaylar → VERIFIED (dört göz: sunan uyum ≠ onaylayan admin).
    await adminPage.goto("/ai-guvence");
    const adminSatir = adminPage.getByTestId(`crosswalk-${cwRow!.id}`);
    await adminSatir.getByRole("button", { name: "Onayla" }).click();
    await expect(adminSatir.getByText("VERIFIED")).toBeVisible();

    const { data: cw } = await db.from("iso_42001_27001_crosswalk").select("dogrulama_durumu, incelemeye_alan, dogrulayan").eq("iso42001_ref", ISO_42001).eq("iso27001_ref", ISO_27001).single();
    expect(cw!.dogrulama_durumu).toBe("VERIFIED");
    expect(cw!.incelemeye_alan).not.toBe(cw!.dogrulayan);
  } finally {
    await uyumCtx.close();
    await adminCtx.close();
    await temizle(db, kurum!.id);
  }
});
