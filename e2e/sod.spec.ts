import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { girisYap, ikinciKullaniciGirisYap } from "./helpers";

// M16 kabul: SoD kuralı → çatışma tespiti → istisna talebi → farklı yetkili
// onayı → telafi edici kontrol (M12) → başarısız/başarılı test → durum
// (docs/ROADMAP.md M16, kural 1 + 3 + 11 + 14'ün SoD'a uyarlanmış hali).
// Gerçek Chromium + gerçek Supabase.
//
// Atamalar UI'DAN DEĞİL fixture (service client) ile eklenir — atama
// yönetimi UI'ı bu turun kapsamı dışında (ROADMAP M16 "kapsam dışı": harici
// IAM/PAM connector'ları henüz yok, atamalar bu turda ya fixture ya da
// ileride bir entegrasyonla girer). Kuralın kendisi ve akışın geri kalanı
// gerçek UI üzerinden, koordinat değil erişilebilir rol/label ile sürülür.

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env eksik (.env.local).");
  return createClient(url, key, { auth: { persistSession: false } });
}

test("kural→çatışma→istisna→onay→telafi edici kontrol→durum", async ({ page }) => {
  test.setTimeout(90_000);
  const db = admin();
  const damga = Date.now();
  const kod = `SOD-E2E-${damga}`;
  const tarafA = `E2E_TARAF_A_${damga}`;
  const tarafB = `E2E_TARAF_B_${damga}`;

  await girisYap(page);

  // 1) SoD kuralı oluştur — UI üzerinden.
  await page.goto("/sod");
  await page.getByRole("button", { name: "+ Yeni kural" }).click();
  await page.getByLabel("Kod", { exact: true }).fill(kod);
  await page.getByLabel("Ad", { exact: true }).fill(`E2E kuralı ${damga}`);
  await page.getByLabel("Taraf A — aktivite kodu").fill(tarafA);
  await page.getByLabel("Taraf B — aktivite kodu").fill(tarafB);
  await page.getByRole("button", { name: "Ekle", exact: true }).click();
  await expect(page.getByText(kod)).toBeVisible({ timeout: 10_000 });

  // 2) Çatışan iki atama — fixture (aynı kişi, iki tarafa da eşleşen atama).
  const { data: kurum } = await db.from("tenants").select("id").eq("name", "E2E Test Kurumu A.Ş.").single();
  const { data: kullanici } = await db
    .from("profiles")
    .select("id")
    .eq("tenant_id", kurum!.id)
    .eq("full_name", "Ayşe Yılmaz")
    .single();
  await db.from("sod_atamalari").insert([
    { tenant_id: kurum!.id, kullanici_id: kullanici!.id, aktivite_kodu: tarafA },
    { tenant_id: kurum!.id, kullanici_id: kullanici!.id, aktivite_kodu: tarafB },
  ]);

  // 3) Değerlendirmeyi çalıştır.
  await page.getByRole("button", { name: "Değerlendirmeyi Çalıştır" }).click();

  // 4) Çatışmayı UI'da gör.
  const catismaSatiri = page.locator("tr").filter({ hasText: `E2E kuralı ${damga}` });
  await expect(catismaSatiri).toBeVisible({ timeout: 15_000 });
  await catismaSatiri.getByRole("link", { name: "Detay" }).click();
  await expect(page.getByRole("heading", { name: `E2E kuralı ${damga}` })).toBeVisible();

  // 5) İstisna talep et.
  await page.getByRole("button", { name: "İstisna Talep Et" }).click();
  await page.getByLabel("Gerekçe").fill("E2E test istisnası");
  const yarinTarih = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  await page.getByLabel(/Bitiş tarihi/).fill(yarinTarih);
  await page.getByRole("button", { name: "Talep Et" }).click();
  await expect(page.getByText("Talep edildi", { exact: true })).toBeVisible({ timeout: 10_000 });

  // Talep eden kendi istisnasını onaylayamaz — UI bunu açıkça söylemeli.
  await expect(page.getByText(/kendi talebinizi onaylayamazsınız/i)).toBeVisible();

  const catismaUrl = page.url();

  // 6) Farklı bir yetkili (ikinci kullanıcı, rol=uyum) onaylar — AYRI bir
  // browser context, iki oturum birbirini etkilemesin diye.
  const ikinciContext = await page.context().browser()!.newContext();
  const ikinciPage = await ikinciContext.newPage();
  await ikinciKullaniciGirisYap(ikinciPage);
  await ikinciPage.goto(catismaUrl);
  await ikinciPage.getByPlaceholder("Karar gerekçesi (zorunlu)").fill("Uygun, onaylandı");
  await ikinciPage.getByRole("button", { name: "Onayla" }).click();
  await expect(ikinciPage.getByText("Onaylandı").first()).toBeVisible({ timeout: 10_000 });
  await expect(ikinciPage.getByText("İstisna onaylandı")).toBeVisible({ timeout: 10_000 });
  await ikinciContext.close();

  // 7) M12 kontrol testi bağla — birinci kullanıcının sayfasına dön.
  await page.reload();
  await expect(page.getByText("İstisna onaylandı")).toBeVisible({ timeout: 10_000 });
  await page.getByRole("combobox", { name: "Kontrol testi seç" }).click();
  await page.getByRole("option", { name: /MFA tüm ayrıcalıklı hesaplarda zorunlu/ }).click();
  await page.getByRole("button", { name: "Bağla" }).click();
  // Telafi edici kontrol kartı eklendi — "Başarısız/Başarılı çalıştır"
  // butonlarının görünmesi kartın var olduğunun kanıtıdır.
  await expect(page.getByRole("button", { name: "Başarısız çalıştır" })).toBeVisible({ timeout: 10_000 });

  // 8) BAŞARISIZ çalıştır → çatışma MITIGATED OLMAZ (İstisna onaylandı kalır).
  await page.getByRole("button", { name: "Başarısız çalıştır" }).click();
  await expect(page.getByText("Kaldı", { exact: true })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("İstisna onaylandı")).toBeVisible();
  await expect(page.getByText("Telafi edildi")).not.toBeVisible();

  // 9) BAŞARILI çalıştır → çatışma MITIGATED olur.
  await page.getByRole("button", { name: "Başarılı çalıştır" }).click();
  await expect(page.getByText("Telafi edildi")).toBeVisible({ timeout: 10_000 });

  // 10) Audit zaman çizelgesi: en az bir kayıt görünür (denetim izi boş değil).
  await expect(page.getByText("SoD çatışması tespit edildi")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("SoD istisnası karara bağlandı").first()).toBeVisible();
});

// M16 tamamlama — Senaryo A (kurucu talimatı): süresi dolan istisna otomatik
// olarak çatışmayı yeniden açmalı. Bu "gerçek kontrol boşluğu"nun kapandığının
// kanıtı. Onaylı istisna + geçmiş bitiş service client ile kurulur (gerçekte
// zamanla oluşur), süre-dolumu İŞİ çağrılır, ve çatışmanın UI'da yeniden AÇIK
// göründüğü doğrulanır.
test("üretim panosu (M16 #8): kapsama, doğrulama, yaşam döngüsü ve izleme sinyalleri görünür", async ({
  page,
}) => {
  await girisYap(page);
  await page.goto("/sod");
  // Dört pano kartı da render olur; sayılar ortam durumuna bağlı olduğundan
  // varlık + payda görünürlüğü assert edilir (tek birleşik skor YOK).
  await expect(page.getByText("Kapsama", { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("aktif kural")).toBeVisible();
  await expect(page.getByText("Kural Doğrulama (kural 3)")).toBeVisible();
  await expect(page.getByText(/Doğrulanmış: \d+/)).toBeVisible();
  await expect(page.getByText("Çatışma Yaşam Döngüsü")).toBeVisible();
  await expect(page.getByText(/Açık: \d+/)).toBeVisible();
  await expect(page.getByText("İzleme Sinyalleri")).toBeVisible();
  await expect(page.getByText(/Süresi yaklaşan istisna: \d+/)).toBeVisible();
  // Import geçmişi olan ortamda "son import sonrası" sinyali; olmayanda
  // dürüst "Henüz içe aktarma yok" — ikisinden biri MUTLAKA görünür.
  await expect(
    page.getByText(/Son import sonrası yeni çatışma: \d+|Henüz içe aktarma yok/),
  ).toBeVisible();
});

test("süresi dolan istisna çatışmayı yeniden açar (REOPENED)", async ({ page }) => {
  test.setTimeout(60_000);
  const db = admin();
  const damga = Date.now();

  const { data: kurum } = await db.from("tenants").select("id").eq("name", "E2E Test Kurumu A.Ş.").single();
  const { data: talepEden } = await db
    .from("profiles").select("id").eq("tenant_id", kurum!.id).eq("full_name", "Ayşe Yılmaz").single();
  const { data: onaylayan } = await db
    .from("profiles").select("id").eq("tenant_id", kurum!.id).eq("full_name", "Mehmet Kaya").single();

  // Kural + EXCEPTION_APPROVED çatışma + onaylı istisna (geçmiş bitiş).
  const { data: kural } = await db
    .from("sod_kurallari")
    .insert({ tenant_id: kurum!.id, kod: `SOD-EXP-${damga}`, ad: `Süre dolumu ${damga}`, onem: "kritik" })
    .select("id").single();
  const { data: catisma } = await db
    .from("sod_catismalari")
    .insert({
      tenant_id: kurum!.id, rule_id: kural!.id, kullanici_id: talepEden!.id,
      sistem_kapsami: "kalkan_os", onem: "kritik", fingerprint: `fp-exp-${damga}`, durum: "OPEN",
    })
    .select("id").single();
  const altmisGunOnce = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const dun = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  await db.from("sod_istisnalari").insert({
    conflict_id: catisma!.id, tenant_id: kurum!.id, gerekce: "e2e süre dolumu",
    talep_eden_id: talepEden!.id, onaylayan_id: onaylayan!.id,
    baslangic: altmisGunOnce, bitis: dun, durum: "onaylandi",
  });
  await db.from("sod_catismalari").update({ durum: "EXCEPTION_APPROVED" }).eq("id", catisma!.id);

  // Süre-dolumu işini çalıştır (pg_cron'un günlük yaptığı).
  const { data: islenen, error } = await db.rpc("sod_istisna_suresi_dolanlari_isle");
  expect(error).toBeNull();
  expect(Number(islenen)).toBeGreaterThanOrEqual(1);

  // Çatışma REOPENED, istisna suresi_doldu — DB'de.
  const { data: c2 } = await db.from("sod_catismalari").select("durum").eq("id", catisma!.id).single();
  expect(c2!.durum).toBe("REOPENED");

  // UI: çatışma detayında "Yeniden açıldı" durumu görünür.
  await girisYap(page);
  await page.goto(`/sod/${catisma!.id}`);
  await expect(page.getByText("Yeniden açıldı").first()).toBeVisible({ timeout: 10_000 });

  // --- UZATMA AKIŞI (M16 #3): dolmuş istisnadan yeni talep, bağımsız onay ---
  // Dolmuş kayıt DEĞİŞTİRİLMEZ (kilit guard'ı); UI yeni gerekçe + İLERİ
  // tarihli yeni bir talep açar (onceki_istisna_id zinciriyle).
  await page.getByRole("button", { name: "Uzatma Talep Et" }).click();
  await expect(page.getByText("Uzatma talebi:", { exact: false })).toBeVisible();
  await page.getByLabel("Uzatma gerekçesi (yeni)").fill(`e2e uzatma ${damga} — risk yeniden değerlendirildi`);
  const otuzGunSonra = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  await page.getByLabel("Bitiş tarihi (zorunlu — süresiz istisna olamaz)").fill(otuzGunSonra);
  await page.getByRole("button", { name: "Talep Et", exact: true }).click();
  // Yeni kayıt "Uzatma" rozetiyle listelenir; talep eden karar veremez.
  await expect(page.getByText("Uzatma", { exact: true })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Kendi talebinizi onaylayamazsınız", { exact: false })).toBeVisible();

  // Bağımsız onay: İKİNCİ kullanıcı (Mehmet) onaylar.
  await page.getByRole("button", { name: "Çıkış" }).click();
  await page.waitForURL("**/giris");
  await ikinciKullaniciGirisYap(page);
  await page.goto(`/sod/${catisma!.id}`);
  await page.getByPlaceholder("Karar gerekçesi (zorunlu)").fill("e2e uzatma onayı");
  await page.getByRole("button", { name: "Onayla", exact: true }).click();
  // Çatışma yeniden istisna altına girer; geçmiş silinmedi (dolmuş kayıt durur).
  await expect(page.getByText("İstisna onaylandı").first()).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Süresi doldu").first()).toBeVisible();

  // DB doğrulaması: iki istisna kaydı yan yana, uzatma zincirli.
  const { data: kayitlar } = await db
    .from("sod_istisnalari")
    .select("durum, onceki_istisna_id")
    .eq("conflict_id", catisma!.id)
    .order("created_at");
  expect(kayitlar).toHaveLength(2);
  expect(kayitlar![0].durum).toBe("suresi_doldu");
  expect(kayitlar![1].durum).toBe("onaylandi");
  expect(kayitlar![1].onceki_istisna_id).not.toBeNull();
});
