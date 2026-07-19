import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { E2E_KURUM_ADI, girisYap } from "./helpers";

// M35 (G4): tedarikçi riski — oluştur → hizmet/dördüncü-taraf/sözleşme/çıkış
// planı → insan kararı → yoğunlaşma sinyali → tested-exit kanıt şartı → RoI.
// Gerçek Chromium + gerçek Supabase.

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env eksik (.env.local).");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function temizle(db: ReturnType<typeof admin>, tenantId: string) {
  const { data: tps } = await db.from("third_parties").select("id").eq("tenant_id", tenantId).like("ad", "E2E-TP%");
  for (const t of tps ?? []) await db.from("third_parties").delete().eq("id", t.id);
}

test("tedarikçi: hizmet/dördüncü-taraf/sözleşme/çıkış planı → insan kararı → yoğunlaşma → RoI", async ({ page }) => {
  test.setTimeout(150_000);
  const db = admin();
  const { data: kurum } = await db.from("tenants").select("id").eq("name", E2E_KURUM_ADI).single();
  await temizle(db, kurum!.id);

  try {
    await girisYap(page);
    await page.goto("/tedarikciler");

    // 1) İki tedarikçi oluştur (yoğunlaşma için).
    await page.getByLabel("Ad").fill("E2E-TP Bulut A");
    await page.getByLabel("Kritiklik").selectOption("KRITIK");
    await page.getByRole("button", { name: "Oluştur" }).click();
    await expect(page.getByRole("link", { name: "E2E-TP Bulut A" })).toBeVisible();
    await page.getByLabel("Ad").fill("E2E-TP Bulut B");
    await page.getByRole("button", { name: "Oluştur" }).click();
    await expect(page.getByRole("link", { name: "E2E-TP Bulut B" })).toBeVisible();

    // 2) A detayına git: hizmet + dördüncü taraf (AWS) + sözleşme + çıkış planı.
    await page.getByRole("link", { name: "E2E-TP Bulut A" }).click();
    await expect(page.getByRole("heading", { name: "E2E-TP Bulut A" })).toBeVisible();

    // Hizmet (kritik)
    await page.getByLabel("Hizmet", { exact: true }).fill("Bulut altyapı");
    await page.getByText("Kritik hizmet").locator("input").check();
    await page.getByRole("button", { name: "Hizmet Ekle" }).click();
    await expect(page.getByText("Bulut altyapı")).toBeVisible();

    // Dördüncü taraf: AWS (paylaşılan)
    await page.getByLabel("Alt yüklenici").fill("AWS");
    await page.getByRole("button", { name: "Dördüncü Taraf Ekle" }).click();
    await expect(page.getByText("AWS").first()).toBeVisible();

    // Sözleşme
    await page.getByLabel("Sözleşme ref").fill("S-2026-1");
    await page.getByLabel("Bitiş").fill("2027-06-30");
    await page.getByRole("button", { name: "Sözleşme Ekle" }).click();
    await expect(page.getByText("S-2026-1")).toBeVisible();

    // 3) Çıkış planı: kanıtsız "test edildi" → DB reddi (hata banner).
    await page.getByLabel("Özet").fill("Çıkış tatbikatı planı");
    await page.getByText("Test edildi").locator("input").check();
    // Kanıt alanı boş bırak → Ekle → hata.
    await page.getByRole("button", { name: "Çıkış Planı Ekle" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "tatbikat kanıtı zorunlu" })).toBeVisible();
    // Kanıt gir → geçer.
    await page.getByLabel("Tatbikat kanıtı").fill("Tatbikat-2026-Q2");
    await page.getByRole("button", { name: "Çıkış Planı Ekle" }).click();
    await expect(page.getByText(/Test edildi \(Tatbikat-2026-Q2\)/)).toBeVisible();

    // 4) İnsan kararı → ONAYLANDI.
    await page.getByRole("button", { name: "Onayla" }).click();
    await expect(page.getByText("Onaylandı").first()).toBeVisible();

    // 5) RoI indir görünür.
    await expect(page.getByText("RoI kaydını indir (JSON)")).toBeVisible();

    // 6) B'ye de AWS ekle → listede yoğunlaşma sinyali.
    const { data: tpB } = await db.from("third_parties").select("id").eq("tenant_id", kurum!.id).eq("ad", "E2E-TP Bulut B").single();
    await db.from("fourth_parties").insert({ tenant_id: kurum!.id, third_party_id: tpB!.id, ad: "AWS" });
    await page.goto("/tedarikciler");
    await expect(page.getByText("Yoğunlaşma").first()).toBeVisible();
    await expect(page.getByText(/E2E-TP Bulut A, E2E-TP Bulut B/)).toBeVisible();

    // DB doğrulaması: karar ONAYLANDI + karar_veren dolu (insan).
    const { data: tpA } = await db.from("third_parties").select("karar, karar_veren").eq("tenant_id", kurum!.id).eq("ad", "E2E-TP Bulut A").single();
    expect(tpA!.karar).toBe("ONAYLANDI");
    expect(tpA!.karar_veren).not.toBeNull();
  } finally {
    await temizle(db, kurum!.id);
  }
});

// M35 sonraki dilim (ROADMAP §1.24 sonu, G7 M41 partner modeli): tedarikçi
// hesapsız, süreli/iptal edilebilir bir token'la kendi değerlendirme
// durumunu ve açık bulgularını görür — matter_goruntule deseninin aynısı.
test("vendor-portal dış erişim: tedarikçi hesapsız kendi durumunu/açık bulgusunu görür", async ({ page, browser }) => {
  test.setTimeout(90_000);
  const db = admin();
  const { data: kurum } = await db.from("tenants").select("id").eq("name", E2E_KURUM_ADI).single();
  await temizle(db, kurum!.id);

  const misafirCtx = await browser.newContext();
  const misafirPage = await misafirCtx.newPage();

  try {
    const { data: authList } = await db.auth.admin.listUsers();
    const adminUserId = authList?.users.find((u) => u.email?.toLowerCase() === "e2e-admin@kalkan-os.test")?.id;
    if (!adminUserId) throw new Error("e2e-admin kullanıcısı bulunamadı.");

    const { data: tp } = await db
      .from("third_parties")
      .insert({ tenant_id: kurum!.id, ad: "E2E-TP Dış Erişim", tier: "KRITIK" })
      .select("id")
      .single();
    const { data: a } = await db
      .from("third_party_assessments")
      .insert({ tenant_id: kurum!.id, third_party_id: tp!.id, tur: "DORA", durum: "DEVAM" })
      .select("id")
      .single();
    await db.from("assessment_findings").insert({
      tenant_id: kurum!.id,
      assessment_id: a!.id,
      third_party_id: tp!.id,
      baslik: "E2E şifreleme eksikliği",
      ciddiyet: "YUKSEK",
    });
    // Kapanmış bulgu dış görünümde GÖRÜNMEMELİ.
    await db.from("assessment_findings").insert({
      tenant_id: kurum!.id,
      assessment_id: a!.id,
      third_party_id: tp!.id,
      baslik: "E2E kapanmış bulgu",
      durum: "KAPANDI",
      kapanis_kanit: "kanit",
      kapatan: adminUserId,
      kapanis_zamani: new Date().toISOString(),
    });

    await girisYap(page);
    await page.goto(`/tedarikciler/${tp!.id}`);
    await page.getByLabel("Dış e-posta").fill("vendor@example.com");
    await page.getByRole("button", { name: "Erişim Aç" }).click();
    const link = page.getByRole("link", { name: /\/tedarikci-erisim\// });
    await expect(link).toBeVisible();
    const href = await link.getAttribute("href");

    // OTURUMSUZ tedarikçi görünümü.
    await misafirPage.goto(href!);
    await expect(misafirPage.getByRole("heading", { name: "E2E-TP Dış Erişim" })).toBeVisible();
    await expect(misafirPage.getByText("E2E şifreleme eksikliği")).toBeVisible();
    await expect(misafirPage.getByText("E2E kapanmış bulgu")).toHaveCount(0);

    const { data: audit } = await db
      .from("audit_log")
      .select("id, actor_id")
      .eq("tenant_id", kurum!.id)
      .eq("eylem", "tedarikci_dis_goruntulendi");
    expect((audit ?? []).length).toBeGreaterThan(0);
    expect(audit![0].actor_id).toBeNull();
  } finally {
    await misafirCtx.close();
    await temizle(db, kurum!.id);
  }
});
