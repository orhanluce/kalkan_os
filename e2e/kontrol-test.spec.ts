import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { girisYap } from "./helpers";

// M12 kabul: başarısız kontrol testi → bulgu önerisi → kabul → gerçek bulgu →
// verified closure (retest olmadan kapanamaz) (docs/ROADMAP.md M12, kural
// 11 + 13 + 14). Gerçek Chromium + gerçek Supabase.
//
// UI henüz yok; rotalar API olarak sürülüyor (page.request oturum çerezini
// taşır). DB durumu Node tarafında service client ile doğrulanır — fixture bir
// MANUAL_PROCEDURE test tanımı seed eder.

/** Node tarafı service client — id bulma ve DB durumu doğrulama için. */
function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env eksik (.env.local).");
  return createClient(url, key, { auth: { persistSession: false } });
}

test("başarısız test → öneri → kabul → bulgu; retest olmadan kapanamaz", async ({ page }) => {
  test.setTimeout(60_000);
  await girisYap(page);

  const db = admin();

  // E2E kiracısının seed edilen test tanımını bul.
  const { data: kurum } = await db.from("tenants").select("id").eq("name", "E2E Test Kurumu A.Ş.").single();
  const { data: tanim } = await db
    .from("control_test_definitions")
    .select("id")
    .eq("tenant_id", kurum!.id)
    .eq("tur", "MANUAL_PROCEDURE")
    .single();
  const tanimId = tanim!.id as string;

  // 1) Testi BAŞARISIZ gözlemle çalıştır — iddia karşılanmadı.
  const calistir = await page.request.post(`/api/kontrol-test/${tanimId}/calistir`, {
    data: { iddiaKarsilandi: false, gozlemZamani: new Date().toISOString() },
  });
  expect(calistir.ok()).toBeTruthy();
  const cSonuc = await calistir.json();
  expect(cSonuc.sonuc).toBe("FAILED");
  expect(cSonuc.oneriId).toBeTruthy(); // FAILED → öneri doğdu

  // 2) TOPLAMA ARIZASI gözlemi UNKNOWN üretmeli, öneri DOĞMAMALI (kural 13).
  const unknownRun = await page.request.post(`/api/kontrol-test/${tanimId}/calistir`, {
    data: { toplamaBasarisiz: true, toplamaHatasi: "connector timeout" },
  });
  const uSonuc = await unknownRun.json();
  expect(uSonuc.sonuc).toBe("UNKNOWN");
  expect(uSonuc.oneriId).toBeNull(); // "ölçemedik" bulgu üretmez

  // 3) Öneriyi KABUL et → gerçek bulgu.
  const kabul = await page.request.post(`/api/kontrol-test/oneri/${cSonuc.oneriId}`, {
    data: { karar: "KABUL" },
  });
  expect(kabul.ok()).toBeTruthy();
  const kSonuc = await kabul.json();
  expect(kSonuc.findingId).toBeTruthy();

  // Bulgu retest_gerekli + kaynak_test_definition_id taşımalı (kural 14 zemini).
  const { data: bulgu } = await db
    .from("findings")
    .select("durum, kaynak, retest_gerekli, kaynak_test_definition_id")
    .eq("id", kSonuc.findingId)
    .single();
  expect(bulgu!.kaynak).toBe("kontrol_testi");
  expect(bulgu!.retest_gerekli).toBe(true);
  expect(bulgu!.kaynak_test_definition_id).toBe(tanimId);

  // 4) Bulgu /findings'te görünür.
  await page.goto("/findings");
  await expect(page.getByText(/MFA tüm ayrıcalıklı hesaplarda zorunlu/).first()).toBeVisible({
    timeout: 10_000,
  });

  // 5) VERIFIED CLOSURE (kural 14): retest bağlanmadan kapatma reddedilmeli.
  const { error: retestsizHata } = await db
    .from("findings")
    .update({ durum: "kapali" })
    .eq("id", kSonuc.findingId);
  expect(retestsizHata?.message ?? "").toMatch(/retest gerekli/i);

  // 6) Başarılı RETEST koş (aynı tanım, bulgudan sonra) → şimdi kapanabilir.
  const retest = await page.request.post(`/api/kontrol-test/${tanimId}/calistir`, {
    data: { iddiaKarsilandi: true, gozlemZamani: new Date().toISOString() },
  });
  const rSonuc = await retest.json();
  expect(rSonuc.sonuc).toBe("PASSED");

  const { data: uid } = await db.from("profiles").select("id").eq("tenant_id", kurum!.id).limit(1).single();
  const { data: kapali, error: kapatmaHata } = await db
    .from("findings")
    .update({
      durum: "kapali",
      kapatma_retest_run_id: rSonuc.testRunId,
      kapatan: uid!.id,
      kapatma_onay_at: new Date().toISOString(),
    })
    .eq("id", kSonuc.findingId)
    .select("durum")
    .single();
  expect(kapatmaHata).toBeNull();
  expect(kapali!.durum).toBe("kapali");
});
