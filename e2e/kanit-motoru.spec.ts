import { test, expect, type Page } from "@playwright/test";

// docs/ROADMAP.md M2 kabul kriteri:
//   "kanıt yükle → kontrol 'karşılanıyor' olur → geçerliliği geçmişe çek →
//    'kısmi'ye düşer; audit_log'da iki kayıt görünür"
//
// UYARLAMA: kriterdeki "geçerliliği geçmişe çek" adımı, var olan bir kanıdı
// UPDATE etmeyi ima ediyor — ama evidences append-only (CLAUDE.md kural 2,
// kabul kriterinden önce gelir). Bu yüzden aynı son durum, süresi geçmiş
// yeni bir kanıt yükleyerek doğrulanıyor: sonuç aynı ("kısmi"ye düşüş),
// değişmez kural çiğnenmiyor.

async function girisYap(page: Page) {
  await page.goto("/giris");
  await page.getByLabel("E-posta").fill("ayse@demo.com");
  await page.getByRole("button", { name: "Giriş Yap" }).click();
  await expect(page.getByRole("heading", { name: "Demo Aracı Kurum A.Ş." })).toBeVisible();
}

async function beyanKanitiYukle(page: Page, metin: string, gecerlilikBitis?: string) {
  await page.getByLabel("Tip").click();
  await page.getByRole("option", { name: "Beyan" }).click();
  await page.getByLabel("Beyan metni").fill(metin);
  if (gecerlilikBitis) {
    await page.getByLabel("Geçerlilik bitiş (opsiyonel)").fill(gecerlilikBitis);
  }
  await page.getByRole("button", { name: "Kanıt Ekle" }).click();
}

test("M2: kanıt yükle → karşılanıyor; süresi geçmiş kanıt → kısmi; audit_log kayıtları görünür", async ({
  page,
}) => {
  await girisYap(page);

  // c-06 mock'ta "acik" durumda başlar.
  await page.goto("/controls/c-06");
  const durumTrigger = page.getByRole("combobox").first();
  await expect(durumTrigger).toContainText("Açık");

  // 1) Geçerli kanıt yükle → "Karşılanıyor" olmalı.
  await beyanKanitiYukle(page, "Sızma testi raporu teslim edildi", "2030-01-01");
  await expect(durumTrigger).toContainText("Karşılanıyor");
  await expect(page.getByText("Yüklenen Kanıtlar (1)")).toBeVisible();

  // 2) Süresi geçmiş kanıt yükle → "Kısmi"ye düşmeli.
  await beyanKanitiYukle(page, "Süresi dolmuş eski rapor", "2020-01-01");
  await expect(durumTrigger).toContainText("Kısmi");

  // 3) audit_log'da kayıtlar görünmeli. ("Denetim İzi" hem nav linkinde hem
  //    kart başlığında geçiyor — main'e kapsıyoruz.)
  const main = page.getByRole("main");
  await expect(main.getByText("Denetim İzi")).toBeVisible();
  await expect(main.getByText("Kanıt eklendi").first()).toBeVisible();
  expect(await main.getByText("Kanıt eklendi").count()).toBeGreaterThanOrEqual(2);
});

test("denetim izi sayfası kim/ne/ne zaman gösterir ve sayfa yenilenince kalıcıdır", async ({
  page,
}) => {
  await girisYap(page);

  await page.goto("/controls/c-01");
  const durumTrigger = page.getByRole("combobox").first();
  await durumTrigger.click();
  await page.getByRole("option", { name: "Kısmi" }).click();
  await expect(durumTrigger).toContainText("Kısmi");

  await page.goto("/denetim-izi");
  await expect(page.getByText("Durum değişti")).toBeVisible();
  // Eylemi yapan kullanıcı adıyla yazılmalı (aktör atfı).
  await expect(page.getByText("Ayşe Yılmaz").first()).toBeVisible();

  // localStorage'a yazıldığı için yenilemeden sonra da durmalı.
  await page.reload();
  await expect(page.getByText("Durum değişti")).toBeVisible();
});

test("otomatik süre-dolma kaydı kullanıcıya değil Sistem'e atfedilir", async ({ page }) => {
  await girisYap(page);

  // Geçerli kanıt yükle → karşılanıyor.
  await page.goto("/controls/c-07");
  await beyanKanitiYukle(page, "Geçerli tatbikat raporu", "2030-01-01");
  await expect(page.getByRole("combobox").first()).toContainText("Karşılanıyor");

  // Kanıdın süresini geçmişe çekmek için localStorage'daki kaydı doğrudan
  // değiştiriyoruz — bu, "zaman geçti" senaryosunu (gerçekte cron/sorgu-anı
  // hesabının yakalayacağı durumu) tarayıcıda simüle etmenin tek yolu.
  await page.evaluate(() => {
    const key = "kalkan-os-local-store-v1";
    const state = JSON.parse(localStorage.getItem(key)!);
    for (const ev of state.evidencesByControl["c-07"]) {
      ev.gecerlilikBitis = "2020-01-01";
    }
    localStorage.setItem(key, JSON.stringify(state));
  });

  // Yeniden yükleme, applyExpiryDowngrades'i tetikler.
  await page.reload();
  await expect(page.getByRole("combobox").first()).toContainText("Kısmi");

  await page.goto("/denetim-izi");
  await expect(page.getByText("Kanıt süresi doldu")).toBeVisible();
  await expect(page.getByText("Sistem").first()).toBeVisible();
});
