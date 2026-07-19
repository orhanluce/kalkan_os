import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { E2E_KURUM_ADI, girisYap, ikinciKullaniciGirisYap } from "./helpers";

// Dikey 5 (nihai talimat v3.3 §8.0): M13 kritik hizmet grafının kontrol
// kenarıyla genişlemesi (critical_service_controls) + M21/M42 dayanıklılık
// taksonomisi dört-göz akışı (control_resilience_domains, regulasyon/dogrulama
// deseninin aynısı: uyum sunar, admin karar verir; incelemeye alan kendi
// sunumunu doğrulayamaz). Gerçek Chromium, iki kullanıcı.

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env eksik (.env.local).");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function temizle(db: ReturnType<typeof admin>, tenantId: string, controlIds: string[]) {
  await db.from("critical_business_services").delete().eq("tenant_id", tenantId).like("ad", "E2E-DY%");
  await db.from("control_resilience_domains").delete().in("control_id", controlIds);
}

test("dayanıklılık etki grafiği: kontrol kenarı (M13 genişlemesi) + M21/M42 dört-göz sınıflandırma", async ({ browser }) => {
  test.setTimeout(120_000);
  const db = admin();
  const { data: kurum } = await db.from("tenants").select("id").eq("name", E2E_KURUM_ADI).single();
  const { data: kontroller } = await db.from("controls").select("id, madde_ref").in("madde_ref", ["TODO-DOGRULA-01", "TODO-DOGRULA-02"]);
  const k1 = kontroller!.find((k) => k.madde_ref === "TODO-DOGRULA-01")!;
  const k2 = kontroller!.find((k) => k.madde_ref === "TODO-DOGRULA-02")!;
  await temizle(db, kurum!.id, [k1.id, k2.id]);

  const uyumCtx = await browser.newContext();
  const uyumPage = await uyumCtx.newPage();
  const adminCtx = await browser.newContext();
  const adminPage = await adminCtx.newPage();

  try {
    // --- Kontrol kenarı: M13 kritik hizmet grafının genişlemesi ---
    await girisYap(adminPage);
    await adminPage.goto("/kritik-hizmetler");
    await adminPage.getByLabel("Ad").fill("E2E-DY Ödeme");
    await adminPage.getByRole("button", { name: "Oluştur" }).click();
    await adminPage.getByRole("link", { name: "E2E-DY Ödeme" }).click();
    await expect(adminPage.getByRole("heading", { name: "E2E-DY Ödeme" })).toBeVisible();

    await adminPage.getByLabel("Kontrol").selectOption({ label: k1.madde_ref });
    await adminPage.getByRole("button", { name: "Kontrol Bağla" }).click();
    await expect(adminPage.getByText(k1.madde_ref).first()).toBeVisible();

    await adminPage.goto("/dayaniklilik");
    const etkiSatiri = adminPage.getByRole("row", { name: new RegExp(k1.madde_ref) });
    await expect(etkiSatiri).toContainText("1");
    await expect(etkiSatiri).toContainText("E2E-DY Ödeme");

    // --- M21/M42 dört-göz: UYUM sunar (k1), ADMIN onaylar → VERIFIED ---
    await ikinciKullaniciGirisYap(uyumPage);
    await uyumPage.goto("/dayaniklilik");
    await uyumPage.getByLabel("Kontrol", { exact: true }).selectOption({ label: k1.madde_ref });
    await uyumPage.getByLabel("Dayanıklılık alanı").selectOption({ label: "Kurtarma" });
    await uyumPage.getByRole("button", { name: "Sınıflandırma Öner (TODO_DOĞRULA)" }).click();
    const uyumSatir1 = uyumPage.getByTestId(`siniflandirma-${k1.id}`);
    await uyumSatir1.getByRole("button", { name: "İncelemeye Al" }).click();
    await expect(uyumSatir1.getByText("LEGAL_REVIEW")).toBeVisible();

    // UYUM onaylamaya çalışır → rol kapısı (karar admin'de — K8 açık karar).
    await uyumSatir1.getByRole("button", { name: "Onayla" }).click();
    await expect(uyumPage.getByRole("alert").filter({ hasText: "admin" })).toBeVisible();

    // ADMIN aynı kaydı onaylar → dört göz sağlanır (sunan uyum ≠ onaylayan admin).
    await adminPage.goto("/dayaniklilik");
    const adminSatir1 = adminPage.getByTestId(`siniflandirma-${k1.id}`);
    await adminSatir1.getByRole("button", { name: "Onayla" }).click();
    await expect(adminSatir1.getByText("VERIFIED")).toBeVisible();
    const kurtarmaSatiri = adminPage.getByRole("row", { name: /Kurtarma/ });
    await expect(kurtarmaSatiri).toContainText("Kapsanıyor");

    // --- DB dört-göz guard: ADMIN k2'yi hem sunar hem onaylamaya çalışır → red ---
    await adminPage.getByLabel("Kontrol", { exact: true }).selectOption({ label: k2.madde_ref });
    await adminPage.getByLabel("Dayanıklılık alanı").selectOption({ label: "Müdahale" });
    await adminPage.getByRole("button", { name: "Sınıflandırma Öner (TODO_DOĞRULA)" }).click();
    const adminSatir2 = adminPage.getByTestId(`siniflandirma-${k2.id}`);
    await adminSatir2.getByRole("button", { name: "İncelemeye Al" }).click();
    await expect(adminSatir2.getByText("LEGAL_REVIEW")).toBeVisible();
    await adminSatir2.getByRole("button", { name: "Onayla" }).click();
    await expect(adminPage.getByRole("alert").filter({ hasText: "dort goz" })).toBeVisible();
    await expect(adminSatir2.getByText("LEGAL_REVIEW")).toBeVisible();

    // DB doğrulaması: k1 VERIFIED + dört-göz atfı ayrı kişiler; k2 hâlâ LEGAL_REVIEW.
    const { data: sinif1 } = await db
      .from("control_resilience_domains")
      .select("dogrulama_durumu, incelemeye_alan, dogrulayan")
      .eq("control_id", k1.id)
      .single();
    expect(sinif1!.dogrulama_durumu).toBe("VERIFIED");
    expect(sinif1!.incelemeye_alan).not.toBe(sinif1!.dogrulayan);
    const { data: sinif2 } = await db.from("control_resilience_domains").select("dogrulama_durumu").eq("control_id", k2.id).single();
    expect(sinif2!.dogrulama_durumu).toBe("LEGAL_REVIEW");
  } finally {
    await uyumCtx.close();
    await adminCtx.close();
    await temizle(db, kurum!.id, [k1.id, k2.id]);
  }
});
