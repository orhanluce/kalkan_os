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

    // Bildirim eşiği: KALKAN_OS bir sayı UYDURMAZ (kural 3) — belirlenmeden
    // dürüstçe "belirlenmedi" der.
    await expect(page.getByText("Bildirim eşiği belirlenmedi")).toBeVisible();
    const { data: inc } = await db.from("ai_incidents").select("id, bildirim_esik_saat").eq("ai_system_id", sysId).single();
    expect(inc!.bildirim_esik_saat).toBeNull();

    // Eşiği kurum kendi hukuk danışmanlığıyla belirler (360 saat = 15 gün örneği).
    await page.getByLabel(`${inc!.id} bildirim eşiği saat`).fill("360");
    await page.getByRole("button", { name: "Eşiği Kaydet" }).click();
    await expect(page.getByText(/Otorite bildirimine \d+ saat/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Otoriteye Bildirildi İşaretle" })).toBeVisible();

    // Otoriteye bildir → saat "süresinde bildirildi" der; sonra olayı kanıtla kapat (kural 14).
    await page.getByRole("button", { name: "Otoriteye Bildirildi İşaretle" }).click();
    await expect(page.getByText("Süresinde bildirildi")).toBeVisible();
    const { data: incBildirim } = await db
      .from("ai_incidents")
      .select("bildirim_esik_saat, otorite_bildirildi_at")
      .eq("id", inc!.id)
      .single();
    expect(Number(incBildirim!.bildirim_esik_saat)).toBe(360);
    expect(incBildirim!.otorite_bildirildi_at).not.toBeNull();

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
    const { data: ev } = await db.from("ai_evaluations").select("id, sonuc").eq("ai_system_id", sysId).single();
    expect(ev!.sonuc).toBe("UNKNOWN");

    // Veri soyağacı (§8.0 sonu öncelik #2): eval önce "yok" der (uydurulmaz).
    await expect(page.getByText("yok")).toBeVisible();
    await page.getByLabel(`${ev!.id} soyağacı türü`).selectOption("MODEL_SURUMU");
    await page.getByLabel(`${ev!.id} soyağacı adı`).fill("model-v3-2026-07");
    await page.getByLabel(`${ev!.id} lisans`).fill("CC-BY");
    await page.getByLabel(`${ev!.id} sentetik oran`).fill("25");
    await page.getByRole("button", { name: "Soyağacı Ekle" }).click();
    // poisoning BİLİNMİYOR doğar (Dikey 4: değerlendirilmedi ≠ düşük).
    await expect(page.getByText(/poisoning: BILINMIYOR/)).toBeVisible();
    const { data: soyagaci } = await db
      .from("ai_data_lineage")
      .select("tur, ad, lisans, sentetik_oran, poisoning_riski")
      .eq("ai_evaluation_id", ev!.id)
      .single();
    expect(soyagaci!.tur).toBe("MODEL_SURUMU");
    expect(soyagaci!.lisans).toBe("CC-BY");
    expect(Number(soyagaci!.sentetik_oran)).toBe(25);
    expect(soyagaci!.poisoning_riski).toBe("BILINMIYOR");

    // Drift (Dikey 4): eşiksiz "Değerlendirilemedi"; eşik kaynaksız kabul edilmez;
    // eşik+kaynak ile Tolerans/Eşik aşıldı.
    await page.getByLabel("Drift metriği").fill("accuracy");
    await page.getByLabel("Drift değeri").fill("0.70");
    await page.getByLabel("Drift baseline").fill("0.82");
    await page.getByLabel("Drift eşiği").fill("0.05");
    // Kaynak boş → guard reddi (hata banner'ı).
    await page.getByRole("button", { name: "Drift Okuması Ekle" }).click();
    await expect(page.getByText(/Eşik verildiyse kaynağı zorunlu/)).toBeVisible();
    // Kaynak ile → eşik aşıldı (|0.70-0.82|=0.12 > 0.05).
    await page.getByLabel("Drift eşik kaynağı").fill("Model Politikası v2 §4");
    await page.getByRole("button", { name: "Drift Okuması Ekle" }).click();
    await expect(page.getByText("Eşik aşıldı")).toBeVisible();
    const { data: drift } = await db.from("ai_drift_readings").select("esik_kaynagi, metrik").eq("ai_system_id", sysId).single();
    expect(drift!.esik_kaynagi).toBe("Model Politikası v2 §4");
  } finally {
    await temizle(db, kurum!.id);
  }
});
