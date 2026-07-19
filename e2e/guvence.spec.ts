import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { E2E_KURUM_ADI, girisYap, ikinciKullaniciGirisYap } from "./helpers";

// 37 Tez Dikey C (Model/Compliance Claim Guard): iddia oluştur → kaynaksız
// iddia VERIFIED'e geçemez (önizleme + guard) → kaynaklı+kanıtlı iddia
// GERÇEK dört-göz ile VERIFIED olur (incelemeyi alan kendi sunumunu
// doğrulayamaz) → çatışan iddialar (aynı hedef, farklı sonuç) görünür
// olur → reddedilen iddia REDDEDILDI gösterilir. Gerçek Chromium, iki
// kullanıcı, gerçek Supabase.

const HEDEF_ID = "00000000-0000-0000-0000-0000000000e2";

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env eksik (.env.local).");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function temizle(db: ReturnType<typeof admin>, tenantId: string) {
  await db.from("assurance_claims").delete().eq("tenant_id", tenantId).like("iddia_metni", "E2E-GUVENCE%");
  const { data: eskiObl } = await db.from("obligations").select("id").like("kod", "E2E-GUVENCE%");
  const oblIds = (eskiObl ?? []).map((o) => o.id);
  if (oblIds.length > 0) await db.from("obligations").delete().in("id", oblIds);
  const { data: eskiSrc } = await db.from("regulatory_sources").select("id").eq("ad", "E2E Guvence Kaynağı (sentetik)");
  for (const s of eskiSrc ?? []) {
    const { data: arts } = await db.from("source_artifacts").select("id").eq("source_id", s.id);
    const artIds = (arts ?? []).map((a) => a.id);
    if (artIds.length > 0) {
      await db.from("provisions").delete().in("source_artifact_id", artIds);
      await db.from("source_artifacts").delete().in("id", artIds);
    }
    await db.from("regulatory_sources").delete().eq("id", s.id);
  }
}

test("iddia güvencesi: kaynaksız VERIFIED olamaz, dört-göz onayla VERIFIED olur, çatışma görünür", async ({ browser }) => {
  test.setTimeout(150_000);
  const db = admin();
  const { data: kurum } = await db.from("tenants").select("id").eq("name", E2E_KURUM_ADI).single();
  await temizle(db, kurum!.id);

  // Kaynak zinciri: hüküm → yükümlülük, GERÇEK dört-göz ile VERIFIED.
  const { data: src } = await db
    .from("regulatory_sources")
    .insert({ authority: "SPK", jurisdiction: "TR", kaynak_seviyesi: "A", ad: "E2E Guvence Kaynağı (sentetik)", erisim_politikasi_durumu: "manuel" })
    .select("id").single();
  const sha = [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, "0")).join("");
  const { data: art } = await db.from("source_artifacts").insert({ source_id: src!.id, baslik: "E2E sentetik artifact", sha256: sha }).select("id").single();
  const { data: prov } = await db
    .from("provisions")
    .insert({ source_artifact_id: art!.id, provision_ref: "E2E-GUVENCE md. 1", metin: "Sentetik e2e hükmü", effective_from: "2020-01-01" })
    .select("id").single();
  const { data: obl } = await db
    .from("obligations")
    .insert({ provision_id: prov!.id, kod: "E2E-GUVENCE-1", baslik: "E2E sentetik yükümlülük", amac: "e2e" })
    .select("id").single();
  const { data: onaylayanProfil } = await db.from("profiles").select("id").eq("tenant_id", kurum!.id).eq("role", "admin").limit(1).single();
  const { data: sunanProfil } = await db.from("profiles").select("id").eq("tenant_id", kurum!.id).eq("role", "uyum").limit(1).single();
  await db.from("obligations").update({ dogrulama_durumu: "LEGAL_REVIEW", incelemeye_alan: sunanProfil!.id, incelemeye_alinma_zamani: new Date().toISOString() }).eq("id", obl!.id);
  await db.from("obligations").update({ dogrulama_durumu: "VERIFIED", dogrulayan: onaylayanProfil!.id, dogrulama_zamani: new Date().toISOString() }).eq("id", obl!.id);

  const adminCtx = await browser.newContext();
  const adminPage = await adminCtx.newPage();
  const uyumCtx = await browser.newContext();
  const uyumPage = await uyumCtx.newPage();

  try {
    await girisYap(adminPage);
    await adminPage.goto("/guvence");

    // 1) Kaynaklı+kanıtlı iddia oluştur.
    await adminPage.getByLabel("İddia metni").fill("E2E-GUVENCE claim1 kontrol karşılıyor");
    await adminPage.getByLabel("Güven gerekçesi (zorunlu)").fill("E2E test gerekçesi");
    await adminPage.getByLabel("Kaynak yükümlülük (opsiyonel)").selectOption({ value: obl!.id });
    await adminPage.getByLabel("Kanıt referansı (opsiyonel)").fill("evidences:e2e-1");
    await adminPage.getByLabel("Hedef tablo (opsiyonel)").fill("controls");
    await adminPage.getByLabel("Hedef ID (opsiyonel)").fill(HEDEF_ID);
    await adminPage.getByRole("button", { name: "İddia Oluştur" }).click();

    const satir1 = adminPage.getByRole("row").filter({ hasText: "E2E-GUVENCE claim1 kontrol karşılıyor" });
    await expect(satir1).toBeVisible();
    await expect(satir1.getByText("UNVERIFIED", { exact: true })).toBeVisible();

    // 2) İncelemeye al (admin) → LEGAL_REVIEW. Aynı kişi doğrulayamaz.
    await satir1.getByRole("button", { name: "İncelemeye Al" }).click();
    await expect(satir1.getByRole("button", { name: "Doğrula" })).toBeDisabled();
    await expect(satir1.getByText("İncelemeyi siz aldınız", { exact: false })).toBeVisible();

    // 3) Farklı kullanıcı (uyum) doğrular → VERIFIED (kaynak VERIFIED + kanıt var).
    await ikinciKullaniciGirisYap(uyumPage);
    await uyumPage.goto("/guvence");
    const satir1Uyum = uyumPage.getByRole("row").filter({ hasText: "E2E-GUVENCE claim1 kontrol karşılıyor" });
    await expect(satir1Uyum.getByRole("button", { name: "Doğrula" })).toBeEnabled();
    await satir1Uyum.getByRole("button", { name: "Doğrula" }).click();
    await expect(satir1Uyum.getByText("VERIFIED", { exact: true })).toBeVisible();

    const { data: claim1 } = await db.from("assurance_claims").select("dogrulama_durumu, dogrulayan, incelemeye_alan").eq("tenant_id", kurum!.id).eq("iddia_metni", "E2E-GUVENCE claim1 kontrol karşılıyor").single();
    expect(claim1!.dogrulama_durumu).toBe("VERIFIED");
    expect(claim1!.incelemeye_alan).not.toBeNull();
    expect(claim1!.dogrulayan).not.toBeNull();
    expect(claim1!.dogrulayan).not.toBe(claim1!.incelemeye_alan);

    // 4) Kaynaksız, aynı hedefe çelişen (OLUMSUZ) ikinci iddia — çatışma görünür olmalı.
    await adminPage.goto("/guvence");
    await adminPage.getByLabel("Sonuç").selectOption("OLUMSUZ");
    await adminPage.getByLabel("İddia metni").fill("E2E-GUVENCE claim2 celisen");
    await adminPage.getByLabel("Güven gerekçesi (zorunlu)").fill("E2E test gerekçesi 2");
    await adminPage.getByLabel("Hedef tablo (opsiyonel)").fill("controls");
    await adminPage.getByLabel("Hedef ID (opsiyonel)").fill(HEDEF_ID);
    await adminPage.getByRole("button", { name: "İddia Oluştur" }).click();

    await expect(adminPage.getByText("Çatışan iddialar", { exact: false })).toBeVisible();
    await expect(adminPage.getByText(`controls:${HEDEF_ID} (UYUM) — sonuçlar: OLUMLU, OLUMSUZ`)).toBeVisible();

    // 5) Kaynaksız iddia: incelemeye al → önizleme "kaynağı yok" der, Doğrula
    //    devre dışı kalır (guard'ın kendisiyle BİREBİR aynı önizleme).
    const satir2 = adminPage.getByRole("row").filter({ hasText: "E2E-GUVENCE claim2 celisen" });
    await satir2.getByRole("button", { name: "İncelemeye Al" }).click();
    await uyumPage.reload();
    const satir2Uyum = uyumPage.getByRole("row").filter({ hasText: "E2E-GUVENCE claim2 celisen" });
    await expect(satir2Uyum.getByRole("button", { name: "Doğrula" })).toBeDisabled();
    await expect(satir2Uyum.getByText("kaynağı yok", { exact: false })).toBeVisible();

    // 6) Uyum reddeder → REDDEDILDI gösterimi.
    await satir2Uyum.getByRole("button", { name: "Reddet" }).click();
    await expect(satir2Uyum.getByText("REDDEDILDI", { exact: true })).toBeVisible();

    const { data: claim2 } = await db.from("assurance_claims").select("dogrulama_durumu").eq("tenant_id", kurum!.id).eq("iddia_metni", "E2E-GUVENCE claim2 celisen").single();
    expect(claim2!.dogrulama_durumu).toBe("REJECTED");
  } finally {
    await adminCtx.close();
    await uyumCtx.close();
    await temizle(db, kurum!.id);
  }
});
