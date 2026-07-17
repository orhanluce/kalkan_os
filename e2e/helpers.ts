import { expect, type Page } from "@playwright/test";

// E2E fikstürü scripts/setup-e2e-fixtures.ts tarafından kurulur — bir
// insanın kimlik bilgileri değil, ayrı bir "E2E Test Kurumu A.Ş." kiracısına
// bağlı atılabilir test hesabıdır (bkz. o script'in başındaki not).
export const E2E_KURUM_ADI = "E2E Test Kurumu A.Ş.";
export const E2E_KULLANICI_ADI = "Ayşe Yılmaz";
export const E2E_IKINCI_KULLANICI_ADI = "Mehmet Kaya";

function ortamDegeri(anahtar: string): string {
  const deger = process.env[anahtar];
  if (!deger) {
    throw new Error(
      `${anahtar} tanımlı değil. Önce çalıştırın: pnpm exec tsx scripts/setup-e2e-fixtures.ts`,
    );
  }
  return deger;
}

/** Birincil test kullanıcısıyla (admin) giriş yapar. */
export async function girisYap(page: Page): Promise<void> {
  await page.goto("/giris");
  await page.getByLabel("E-posta").fill(ortamDegeri("E2E_USER_EMAIL"));
  await page.getByLabel("Şifre").fill(ortamDegeri("E2E_USER_PASSWORD"));
  await page.getByRole("button", { name: "Giriş Yap" }).click();
  // Giriş sonrası pano, auth + üç paralel Supabase sorgusunun (store,
  // kütüphane, kurum) hepsini bekler. Varsayılan 5sn zaman aşımı bazen
  // gerçek ağ gecikmesini yakalamaya yetmiyor — bu bir UI hatası değil,
  // gerçek bir round-trip süresi, o yüzden yalnızca burada uzatılıyor.
  await expect(page.getByRole("heading", { name: E2E_KURUM_ADI })).toBeVisible({ timeout: 15_000 });
}

/**
 * Kontrol kütüphanesinden `maddeRef`'e sahip kontrolü bulup detay sayfasına
 * gider. Mock döneminde olduğu gibi sabit bir UUID hardcode ETMEYİZ — id'ler
 * artık gerçek, ortamdan ortama değişebilen UUID'ler; madde_ref ise seed
 * verisinin kararlı kimliğidir.
 */
export async function kontrolAc(page: Page, maddeRef: string): Promise<void> {
  await page.goto("/controls");
  // madde_ref metni bir <Link> içinde (satırın kendisi tıklanabilir değil).
  await page.getByRole("link", { name: maddeRef }).click();
  await expect(page.getByText(maddeRef).first()).toBeVisible();
}
