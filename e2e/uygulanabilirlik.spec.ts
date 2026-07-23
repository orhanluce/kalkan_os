import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { E2E_KURUM_ADI, girisYap } from "./helpers";

// PR-Q2b' (M22): uygulanabilirlik değerlendirmesi — tam profilde insan kararı
// (gerekçe + oturum-sahibi onayı), eksik profilde YALNIZ UNKNOWN (yeşil yok,
// /kurulum'a yönlendirme); yeniden değerlendirme append-only (supersede).
// Gerçek Chromium + gerçek Supabase.

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env eksik (.env.local).");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function temizle(db: ReturnType<typeof admin>) {
  const { data: eski } = await db.from("obligations").select("id").like("kod", "E2E-UW%");
  const ids = (eski ?? []).map((o) => o.id);
  if (ids.length > 0) {
    await db.from("applicability_decisions").delete().in("obligation_id", ids);
    await db.from("obligations").delete().in("id", ids);
  }
  const { data: src } = await db.from("regulatory_sources").select("id").eq("ad", "E2E Uygulanabilirlik Kaynağı (sentetik)");
  for (const s of src ?? []) {
    const { data: arts } = await db.from("source_artifacts").select("id").eq("source_id", s.id);
    const artIds = (arts ?? []).map((a) => a.id);
    if (artIds.length > 0) {
      await db.from("provisions").delete().in("source_artifact_id", artIds);
      await db.from("source_artifacts").delete().in("id", artIds);
    }
    await db.from("regulatory_sources").delete().eq("id", s.id);
  }
}

test("uygulanabilirlik: tam profilde APPLICABLE kararı; eksik profilde yalnız UNKNOWN", async ({ page }) => {
  test.setTimeout(120_000);
  const db = admin();
  await temizle(db);

  const { data: kurum } = await db.from("tenants").select("id").eq("name", E2E_KURUM_ADI).single();
  // TAM profil: kritik olguların hepsi dolu (organizationType/regulatedStatus/
  // jurisdictions/regulatedEntityTypes — sonuncusu organizasyon-farkında
  // regülasyon kapsam motorunun (e559faf) eksikProfilAlanlari()'ye eklediği
  // kritik olgu; eksik bırakılırsa "Uygulanır" tüm test boyunca disabled
  // kalır — 2026-07-23'te bulunan root-cause).
  await db.from("organization_profiles").upsert(
    {
      tenant_id: kurum!.id,
      organization_type: "REGULATED_FINANCIAL_INSTITUTION",
      regulated_status: "REGULATED",
      jurisdictions: ["TR"],
      regulator_types: ["SPK"],
      regulated_entity_types: ["ARACI_KURUM"],
    },
    { onConflict: "tenant_id" },
  );

  // Sentetik zincir (kural 3: E2E etiketli, sonda silinir).
  const { data: src } = await db
    .from("regulatory_sources")
    .insert({ authority: "SPK", jurisdiction: "TR", kaynak_seviyesi: "A", ad: "E2E Uygulanabilirlik Kaynağı (sentetik)", erisim_politikasi_durumu: "manuel" })
    .select("id").single();
  const sha = [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, "0")).join("");
  const { data: art } = await db
    .from("source_artifacts")
    .insert({ source_id: src!.id, baslik: "E2E artifact", sha256: sha })
    .select("id").single();
  const { data: prov } = await db
    .from("provisions")
    .insert({ source_artifact_id: art!.id, provision_ref: "E2E-UW md. 1", metin: "Sentetik", effective_from: "2020-01-01" })
    .select("id").single();
  const { data: obl } = await db
    .from("obligations")
    .insert({ provision_id: prov!.id, kod: "E2E-UW-1", baslik: "Sentetik yükümlülük", amac: "e2e" })
    .select("id").single();

  try {
    // 1) TAM profil: APPLICABLE kararı gerekçeyle verilebilir.
    await girisYap(page);
    await page.goto("/regulasyon/uygulanabilirlik");
    const satir = page.getByRole("row").filter({ hasText: "E2E-UW-1" });
    await expect(satir.getByText("Karar yok")).toBeVisible();
    await satir.getByRole("button", { name: "Değerlendir" }).click();
    await satir.getByRole("button", { name: "Uygulanır", exact: true }).click();
    await satir.getByLabel("Gerekçe (zorunlu)").fill("E2E: SPK lisanslı aracı kurum, TR yargı alanı");
    await satir.getByRole("button", { name: "Kaydet" }).click();
    // Form kapanmadan (kayıt commit olmadan) devam etme — rozet metni form
    // içindeki seçim butonuyla karışabilir (yarış).
    await expect(satir.getByRole("button", { name: "Kaydet" })).toBeHidden();
    await expect(satir.getByText("Uygulanır", { exact: true })).toBeVisible();

    // DB: karar APPLICABLE + onay atfı + 64-hex fingerprint (kural 15).
    const { data: karar } = await db
      .from("applicability_decisions")
      .select("durum, onaylayan, fact_snapshot_fingerprint")
      .eq("obligation_id", obl!.id).is("superseded_at", null).single();
    expect(karar!.durum).toBe("APPLICABLE");
    expect(karar!.onaylayan).not.toBeNull();
    expect(karar!.fact_snapshot_fingerprint).toMatch(/^[0-9a-f]{64}$/);

    // 2) Profili EKSİLT → yalnız UNKNOWN seçilebilir, /kurulum yönlendirmesi.
    await db.from("organization_profiles").update({ regulated_status: null, jurisdictions: [] }).eq("tenant_id", kurum!.id);
    await page.reload();
    await expect(page.getByText("Kurum profilini tamamla")).toBeVisible();
    const satir2 = page.getByRole("row").filter({ hasText: "E2E-UW-1" });
    await satir2.getByRole("button", { name: "Değerlendir" }).click();
    await expect(satir2.getByRole("button", { name: "Uygulanır", exact: true })).toBeDisabled();
    await expect(satir2.getByRole("button", { name: "Uygulanmaz", exact: true })).toBeDisabled();
    await satir2.getByRole("button", { name: "Değerlendirilemiyor" }).click();
    await satir2.getByRole("button", { name: "Kaydet" }).click();
    await expect(satir2.getByRole("button", { name: "Kaydet" })).toBeHidden();
    await expect(satir2.getByText("Değerlendirilemiyor", { exact: true }).first()).toBeVisible();

    // DB: append-only zincir — 2 kayıt, GÜNCEL olan UNKNOWN.
    const { data: hepsi } = await db
      .from("applicability_decisions")
      .select("durum, superseded_at")
      .eq("obligation_id", obl!.id)
      .order("created_at");
    expect(hepsi).toHaveLength(2);
    expect(hepsi![0].durum).toBe("APPLICABLE");
    expect(hepsi![0].superseded_at).not.toBeNull(); // silinmedi, kapatıldı
    expect(hepsi![1].durum).toBe("UNKNOWN");
    expect(hepsi![1].superseded_at).toBeNull();
  } finally {
    await temizle(db);
    await db.from("organization_profiles").delete().eq("tenant_id", kurum!.id);
  }
});
