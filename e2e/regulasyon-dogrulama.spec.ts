import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { E2E_KURUM_ADI, girisYap, ikinciKullaniciGirisYap } from "./helpers";

// PR-Q2a' (M21 dört-göz): hukuk doğrulama kuyruğu — uyum sunar, admin karar
// verir; incelemeye alan kendi sunumunu DOĞRULAYAMAZ (DB guard'ı); doğrulama
// kararı rol kapısında (bugün admin — K8 açık). Gerçek Chromium, iki kullanıcı.

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env eksik (.env.local).");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function temizle(db: ReturnType<typeof admin>) {
  const { data: eski } = await db.from("obligations").select("id").like("kod", "E2E-DG%");
  const ids = (eski ?? []).map((o) => o.id);
  if (ids.length > 0) {
    await db.from("obligation_control_mappings").delete().in("obligation_id", ids);
    await db.from("obligations").delete().in("id", ids);
  }
  const { data: src } = await db.from("regulatory_sources").select("id").eq("ad", "E2E Doğrulama Kaynağı (sentetik)");
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

test("dört-göz: uyum sunar → admin onaylar; kendi sunumu ve rol kapısı reddedilir", async ({ browser }) => {
  test.setTimeout(120_000);
  const db = admin();
  await temizle(db);

  const { data: kurum } = await db.from("tenants").select("id").eq("name", E2E_KURUM_ADI).single();
  await db
    .from("organization_profiles")
    .upsert({ tenant_id: kurum!.id, organization_type: "REGULATED_FINANCIAL_INSTITUTION" }, { onConflict: "tenant_id" });

  // Sentetik zincir: kaynak → artifact → hüküm → 2 yükümlülük (kural 3: E2E
  // etiketli, TODO_DOGRULA doğar, sonda silinir).
  const { data: src } = await db
    .from("regulatory_sources")
    .insert({ authority: "SPK", jurisdiction: "TR", kaynak_seviyesi: "A", ad: "E2E Doğrulama Kaynağı (sentetik)", erisim_politikasi_durumu: "manuel" })
    .select("id").single();
  const sha = [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, "0")).join("");
  const { data: art } = await db
    .from("source_artifacts")
    .insert({ source_id: src!.id, baslik: "E2E sentetik artifact", sha256: sha })
    .select("id").single();
  const { data: prov } = await db
    .from("provisions")
    .insert({ source_artifact_id: art!.id, provision_ref: "E2E-DG md. 1", metin: "Sentetik", effective_from: "2020-01-01" })
    .select("id").single();
  for (const kod of ["E2E-DG-1", "E2E-DG-2"]) {
    await db.from("obligations").insert({ provision_id: prov!.id, kod, baslik: `Sentetik ${kod}`, amac: "e2e" });
  }

  const uyumCtx = await browser.newContext();
  const uyumPage = await uyumCtx.newPage();
  const adminCtx = await browser.newContext();
  const adminPage = await adminCtx.newPage();

  try {
    // 1) UYUM kullanıcısı E2E-DG-1'i incelemeye alır.
    await ikinciKullaniciGirisYap(uyumPage);
    await uyumPage.goto("/regulasyon/dogrulama");
    const uyumSatir = uyumPage.getByRole("row").filter({ hasText: "E2E-DG-1" });
    await uyumSatir.getByRole("button", { name: "İncelemeye Al" }).click();
    await expect(uyumSatir.getByText("Hukuk incelemesinde")).toBeVisible();

    // 2) UYUM onaylamaya çalışır → rol kapısı (karar admin'de — K8).
    await uyumSatir.getByRole("button", { name: "Onayla (VERIFIED)" }).click();
    await expect(uyumPage.getByRole("alert").filter({ hasText: "admin" })).toBeVisible();

    // 3) ADMIN aynı kaydı onaylar → dört göz sağlanır (sunan uyum ≠ onaylayan admin).
    await girisYap(adminPage);
    await adminPage.goto("/regulasyon/dogrulama");
    const adminSatir1 = adminPage.getByRole("row").filter({ hasText: "E2E-DG-1" });
    await adminSatir1.getByRole("button", { name: "Onayla (VERIFIED)" }).click();
    await expect(adminSatir1.getByText("Doğrulandı", { exact: true })).toBeVisible();

    // 4) ADMIN E2E-DG-2'yi hem sunar hem onaylamaya çalışır → DB dört-göz reddi.
    const adminSatir2 = adminPage.getByRole("row").filter({ hasText: "E2E-DG-2" });
    await adminSatir2.getByRole("button", { name: "İncelemeye Al" }).click();
    await expect(adminSatir2.getByText("Hukuk incelemesinde")).toBeVisible();
    await adminSatir2.getByRole("button", { name: "Onayla (VERIFIED)" }).click();
    await expect(adminPage.getByRole("alert").filter({ hasText: "dort goz" })).toBeVisible();
    // Kayıt VERIFIED OLMADI — hâlâ incelemede.
    await expect(adminSatir2.getByText("Hukuk incelemesinde")).toBeVisible();
  } finally {
    await uyumCtx.close();
    await adminCtx.close();
    await temizle(db);
    await db.from("organization_profiles").delete().eq("tenant_id", kurum!.id);
  }
});
