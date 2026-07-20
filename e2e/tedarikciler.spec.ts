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
    await page.getByLabel("Ad", { exact: true }).fill("E2E-TP Bulut A");
    await page.getByLabel("Kritiklik").selectOption("KRITIK");
    await page.getByRole("button", { name: "Oluştur" }).click();
    await expect(page.getByRole("link", { name: "E2E-TP Bulut A" })).toBeVisible();
    await page.getByLabel("Ad", { exact: true }).fill("E2E-TP Bulut B");
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

// 37 Tez Nihai Uygulama Talimatı — Dikey A (KOS-8 tamamlama): tedarikçi
// portalında anket YANITLAMA. Kurum davet açar → misafir tedarikçi cevaplar/
// gönderir → kurum inceler/değişiklik ister → tedarikçi revizyon gönderir →
// kurum kabul eder → yanlış token aynı reddi verir. Gerçek Chromium, iki
// context (kurum + misafir tedarikçi).
test("vendor-portal anket yanıtlama: cevapla → gönder → kurum değişiklik ister → revize → kabul", async ({ page, browser }) => {
  test.setTimeout(120_000);
  const db = admin();
  const { data: kurum } = await db.from("tenants").select("id").eq("name", E2E_KURUM_ADI).single();
  await temizle(db, kurum!.id);

  const misafirCtx = await browser.newContext();
  const misafirPage = await misafirCtx.newPage();

  try {
    await girisYap(page);
    await page.goto("/tedarikciler");
    await page.getByLabel("Ad", { exact: true }).fill("E2E-TP Anket");
    await page.getByLabel("Kritiklik").selectOption("KRITIK");
    await page.getByRole("button", { name: "Oluştur" }).click();
    await page.getByRole("link", { name: "E2E-TP Anket" }).click();
    await expect(page.getByRole("heading", { name: "E2E-TP Anket" })).toBeVisible();

    // 1) Değerlendirme oluştur (TASLAK) + soru (bu ekranda manuel soru formu
    // yok — anket şablonu ayrı bir teste ait; burada tek soruyu DB'den ekliyoruz).
    await page.getByRole("button", { name: "Yeni Değerlendirme (DORA)" }).click();
    // Butonun tıklanması, insert'in commit olduğunun kanıtı DEĞİLDİR — sonraki
    // admin sorgusu düğmeye değil, ekranda yeni değerlendirmenin GERÇEKTEN
    // göründüğü "TASLAK" rozetine bağlanır (dikeyE1/E2 e2e'lerinin AYNI
    // deseni: bu, yükle()'nin veriyi tazeleyip yeniden render ettiğinin
    // görünür kanıtıdır).
    await expect(page.getByText("TASLAK", { exact: true })).toBeVisible({ timeout: 10_000 });
    const { data: tp } = await db.from("third_parties").select("id").eq("tenant_id", kurum!.id).eq("ad", "E2E-TP Anket").single();
    const { data: assessment } = await db
      .from("third_party_assessments")
      .select("id")
      .eq("third_party_id", tp!.id)
      .eq("durum", "TASLAK")
      .single();
    await db.from("assessment_questions").insert({ tenant_id: kurum!.id, assessment_id: assessment!.id, soru: "E2E: Verileriniz şifreleniyor mu?", sira: 1 });

    // 2) Yayınla (TASLAK -> DEVAM, yayın kapısı guard'ı en az 1 soru ister).
    await page.reload();
    await page.getByRole("button", { name: "Tedarikçiye Yayınla" }).click();
    await expect(page.getByText("DEVAM", { exact: true }).first()).toBeVisible({ timeout: 10_000 });

    // 3) Dış erişim aç.
    await page.getByLabel("Dış e-posta").fill("vendor-anket@example.com");
    await page.getByRole("button", { name: "Erişim Aç" }).click();
    const link = page.getByRole("link", { name: /\/tedarikci-erisim\// });
    await expect(link).toBeVisible();
    const href = (await link.getAttribute("href")) as string;

    // 4) OTURUMSUZ tedarikçi görünümü -> Anketi Aç.
    await misafirPage.goto(href);
    await expect(misafirPage.getByText("Anketler (1)")).toBeVisible({ timeout: 10_000 });
    await misafirPage.getByRole("button", { name: "Anketi Aç" }).click();
    await expect(misafirPage).toHaveURL(/\/tedarikci-erisim\/.+\/anket\/.+/);
    await expect(misafirPage.getByText("E2E: Verileriniz şifreleniyor mu?")).toBeVisible();
    const anketUrl = misafirPage.url();

    // 5) Cevapla + taslak kaydet.
    await misafirPage.getByLabel("E2E: Verileriniz şifreleniyor mu?").fill("Evet, AES-256 kullanıyoruz.");
    await misafirPage.getByRole("button", { name: "Taslak Kaydet" }).click();
    await expect(misafirPage.getByText(/Son kaydedildi:/)).toBeVisible({ timeout: 10_000 });

    // 6) Gönder (onay adımıyla).
    await misafirPage.getByRole("button", { name: "Gönder", exact: true }).click();
    await misafirPage.getByRole("button", { name: "Evet, Gönder" }).click();
    await expect(misafirPage.getByText(/GONDERILDI · revizyon 1/)).toBeVisible({ timeout: 10_000 });
    await expect(misafirPage.getByLabel("E2E: Verileriniz şifreleniyor mu?")).toBeDisabled();

    // 7) DB kanıtı: revizyon 1 GONDERILDI + cevap doğru + audit.
    const { data: rev1 } = await db.from("assessment_response_revisions").select("id, durum, gonderen_email").eq("assessment_id", assessment!.id).eq("surum", 1).single();
    expect(rev1!.durum).toBe("GONDERILDI");
    expect(rev1!.gonderen_email).toBe("vendor-anket@example.com");
    const { data: audit1 } = await db.from("audit_log").select("id").eq("tenant_id", kurum!.id).eq("eylem", "tedarikci_anket_gonderildi");
    expect((audit1 ?? []).length).toBeGreaterThan(0);

    // 8) Yanlış token aynı reddi verir (kapsam/token karışıklığı sızdırmaz).
    const yanlisUrl = href.replace(/\/tedarikci-erisim\/[0-9a-f]+/, "/tedarikci-erisim/0000000000000000000000000000000000000000000000000000000000000000") + `/anket/${assessment!.id}`;
    await misafirPage.goto(yanlisUrl);
    await expect(misafirPage.getByText(/Link geçersiz/)).toBeVisible({ timeout: 10_000 });

    // 9) Kurum inceler: GÖNDERİLDİ yanıtı görür, gerekçesiz reddedilir davranışını
    // UI zaten gerekçe olmadan buton aktif bırakır ama DB guard'ı reddeder — burada
    // doğrudan mutlu yolu izliyoruz: gerekçeyle Değişiklik İste.
    await page.reload();
    await expect(page.getByText(/Tedarikçi yanıtı · revizyon 1/)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Evet, AES-256 kullanıyoruz.")).toBeVisible();
    await page.getByLabel(`${assessment!.id} inceleme gerekçesi`).fill("Şifreleme algoritması versiyonunu da belirtin.");
    await page.getByRole("button", { name: "Değişiklik İste" }).click();
    await expect(page.getByText("DEGISIKLIK_ISTENDI").first()).toBeVisible({ timeout: 10_000 });

    // 10) Tedarikçi: gerekçeyi görür, revize eder, tekrar gönderir (revizyon 2).
    // (misafirPage şu an 8. adımın YANLIŞ token URL'inde — gerçek ankete geri dön.)
    await misafirPage.goto(anketUrl);
    await expect(misafirPage.getByText(/Kurum değişiklik istedi: Şifreleme algoritması versiyonunu da belirtin\./)).toBeVisible({ timeout: 10_000 });
    const cevapKutusu = misafirPage.getByLabel("E2E: Verileriniz şifreleniyor mu?");
    await expect(cevapKutusu).toBeEnabled();
    await expect(cevapKutusu).toHaveValue("Evet, AES-256 kullanıyoruz.");
    await cevapKutusu.fill("Evet, AES-256-GCM kullanıyoruz, anahtarlar 90 günde bir rotasyona giriyor.");
    // Kaydetmeden önce DOM'un gerçekten güncellendiğini doğrula — React state
    // henüz commit olmadan tıklamak, RPC'ye eski cevabı gönderirdi.
    await expect(cevapKutusu).toHaveValue("Evet, AES-256-GCM kullanıyoruz, anahtarlar 90 günde bir rotasyona giriyor.");
    await misafirPage.getByRole("button", { name: "Taslak Kaydet" }).click();
    await expect(misafirPage.getByText(/Son kaydedildi:/)).toBeVisible({ timeout: 10_000 });
    await misafirPage.getByRole("button", { name: "Gönder", exact: true }).click();
    await misafirPage.getByRole("button", { name: "Evet, Gönder" }).click();
    await expect(misafirPage.getByText(/GONDERILDI · revizyon 2/)).toBeVisible({ timeout: 10_000 });

    // 11) Kurum kabul eder (gerekçesiz).
    await page.reload();
    await expect(page.getByText(/Tedarikçi yanıtı · revizyon 2/)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/anahtarlar 90 günde bir rotasyona giriyor/)).toBeVisible();
    await page.getByRole("button", { name: "Kabul Et" }).click();
    await expect(page.getByText("KABUL_EDILDI").first()).toBeVisible({ timeout: 10_000 });

    // DB kanıtı: v1 DONUK (DEGISIKLIK_ISTENDI kaldı), v2 KABUL_EDILDI + inceleyen dolu.
    const { data: rev1Final } = await db.from("assessment_response_revisions").select("durum").eq("assessment_id", assessment!.id).eq("surum", 1).single();
    expect(rev1Final!.durum).toBe("DEGISIKLIK_ISTENDI");
    const { data: rev2Final } = await db.from("assessment_response_revisions").select("durum, inceleyen").eq("assessment_id", assessment!.id).eq("surum", 2).single();
    expect(rev2Final!.durum).toBe("KABUL_EDILDI");
    expect(rev2Final!.inceleyen).not.toBeNull();
  } finally {
    await misafirCtx.close();
    await temizle(db, kurum!.id);
  }
});
