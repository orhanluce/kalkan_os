import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { E2E_KURUM_ADI, girisYap, ikinciKullaniciGirisYap } from "./helpers";

// M16 PR-3D kabul e2e'si (master talimat §30): gerçek Chromium + gerçek
// Supabase, UI üzerinden. Senaryolar:
//   A) CSV yükle → dry-run → diff → uygula → geçmişte manifest
//   B) idempotency: aynı dosya ikinci dry-run'da 0 eklenecek / N değişmeyecek
//   C) stale: dry-run sonrası atama değişir → uygulama 409 IMPORT_PREVIEW_STALE
//   D) rollback maker-checker: talep eden karar VEREMEZ; farklı kullanıcı
//      onaylar → atamalar geri döner
//   E) apply → outbox → değerlendirme: drenaj çatışmayı gerçekten üretir

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env eksik (.env.local).");
  return createClient(url, key, { auth: { persistSession: false } });
}

const BASLIK =
  "external_subject_id,subject_type,display_name,email,role_code,activity_code,system_code,valid_from,valid_to,source,source_record_id";

function csvOlustur(kaynak: string, aktA: string, aktB: string): Buffer {
  return Buffer.from(
    [
      BASLIK,
      `ext-1,USER,E2E Kişi,e2e@x.test,,${aktA},kalkan_os,2026-01-01,,${kaynak},r1`,
      `ext-1,USER,E2E Kişi,e2e@x.test,,${aktB},kalkan_os,2026-01-01,,${kaynak},r2`,
    ].join("\n"),
    "utf8",
  );
}

async function dosyaYukleVeDryRun(page: Page, csv: Buffer, kaynak: string) {
  await page.goto("/sod/import");
  await page.locator("#csv-dosya").setInputFiles({ name: "atamalar.csv", mimeType: "text/csv", buffer: csv });
  await page.getByLabel("Kaynak sistem").fill(kaynak);
  await page.getByRole("button", { name: "Dry-Run Önizleme" }).click();
  await expect(page.getByText("Önizleme Sonucu")).toBeVisible({ timeout: 15_000 });
}

test("A+B+C: import → idempotency → stale 409", async ({ page }) => {
  test.setTimeout(120_000);
  const db = admin();
  const damga = Date.now();
  const kaynak = `e2e-imp-${damga}`;
  const csv = csvOlustur(kaynak, `AKT_A_${damga}`, `AKT_B_${damga}`);

  await girisYap(page);

  // A) dry-run: 2 eklenecek; uygula; geçmişte manifest.
  await dosyaYukleVeDryRun(page, csv, kaynak);
  await expect(page.getByText("Eklenecek: 2")).toBeVisible();
  await page.getByRole("button", { name: "Uygula", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("İçe aktarma uygulandı: 2 eklendi", {
    timeout: 15_000,
  });
  await expect(page.getByRole("cell", { name: kaynak })).toBeVisible();

  // DB'de gerçekten yazıldı mı (UI iddiası yeterli değil).
  const { data: kurum } = await db.from("tenants").select("id").eq("name", E2E_KURUM_ADI).single();
  const { data: atamalar } = await db
    .from("sod_atamalari")
    .select("harici_kullanici_id")
    .eq("tenant_id", kurum!.id)
    .eq("kaynak_sistem", kaynak);
  expect(atamalar).toHaveLength(2);
  expect(atamalar![0].harici_kullanici_id).toBe(`${kaynak}:ext-1`);

  // B) idempotency: aynı dosya ikinci dry-run → 0 eklenecek, 2 değişmeyecek.
  await dosyaYukleVeDryRun(page, csv, kaynak);
  await expect(page.getByText("Eklenecek: 0")).toBeVisible();
  await expect(page.getByText("Değişmeyecek: 2")).toBeVisible();

  // C) stale: bu önizleme dururken atamalar DEĞİŞİR → uygulama 409.
  await db.from("sod_atamalari").insert({
    tenant_id: kurum!.id,
    harici_kullanici_id: `stale-${damga}`,
    aktivite_kodu: `STALE_${damga}`,
    kaynak_sistem: "e2e-stale",
  });
  await page.getByRole("button", { name: "Uygula", exact: true }).click();
  // Next.js route-announcer'ı da role=alert taşır — metinle hedefle.
  await expect(page.getByText("IMPORT_PREVIEW_STALE")).toBeVisible({ timeout: 15_000 });
});

test("D+E: rollback maker-checker + outbox→değerlendirme çatışma üretir", async ({ page }) => {
  test.setTimeout(180_000);
  const db = admin();
  const damga = Date.now();
  const kaynak = `e2e-rb-${damga}`;
  const aktA = `AKT_A_${damga}`;
  const aktB = `AKT_B_${damga}`;

  // Çatışma kuralı: A ve B aktiviteleri aynı kişide birleşemez (E için).
  const { data: kurum } = await db.from("tenants").select("id").eq("name", E2E_KURUM_ADI).single();
  const { data: kural } = await db
    .from("sod_kurallari")
    .insert({ tenant_id: kurum!.id, kod: `SOD-IMP-${damga}`, ad: `Import e2e ${damga}`, durum: "aktif", onem: "kritik" })
    .select("id")
    .single();
  await db.from("sod_kural_taraflari").insert([
    { rule_id: kural!.id, taraf: "A", aktivite_kodu: aktA },
    { rule_id: kural!.id, taraf: "B", aktivite_kodu: aktB },
  ]);

  await girisYap(page);
  await dosyaYukleVeDryRun(page, csvOlustur(kaynak, aktA, aktB), kaynak);
  // Projeksiyon TAHMİNİ dry-run'da EN AZ bizim çatışmamızı göstermeli (PR-3A).
  // Tam sayı assert edilmez: önceki koşulardan kalan RESOLVED çatışmalar açık
  // filtresinin dışında kaldığı için projeksiyon onları "yeniden doğabilir"
  // diye sayabilir — bu motorun doğru davranışıdır, testin sabitleyeceği bir
  // sayı değil.
  await expect(page.getByText(/Beklenen yeni çatışma: [1-9]/)).toBeVisible();
  await page.getByRole("button", { name: "Uygula", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("İçe aktarma uygulandı", { timeout: 15_000 });

  // E) outbox drenajı: değerlendirme koşar ve çatışma GERÇEKTEN doğar.
  await page.getByRole("button", { name: "Değerlendirmeyi Şimdi Çalıştır" }).click();
  await expect(page.getByRole("status")).toContainText("olay işlendi", { timeout: 20_000 });
  const { data: catisma } = await db
    .from("sod_catismalari")
    .select("id, durum")
    .eq("tenant_id", kurum!.id)
    .eq("rule_id", kural!.id)
    .eq("harici_kullanici_id", `${kaynak}:ext-1`);
  expect(catisma).toHaveLength(1);
  expect(catisma![0].durum).toBe("OPEN");

  // D) rollback talebi (talep eden: birinci kullanıcı). Önceki koşulardan
  // kalan talepler de listede olabilir — HER etkileşim bu koşunun kaynak
  // satırıyla kapsamlanır (strict-mode + izolasyon).
  const satir = () => page.locator("tr").filter({ hasText: kaynak });
  await satir().locator('input[aria-label^="Rollback gerekçesi"]').fill(`e2e rollback ${damga}`);
  await satir().getByRole("button", { name: "Rollback Talep Et" }).click();
  await expect(page.getByRole("status").first()).toContainText("farklı bir yetkili", { timeout: 15_000 });
  // Talep eden kendi talebinde karar butonu GÖRMEZ (asıl sınır DB'de).
  await expect(satir().getByText("Kendi talebinizi karara bağlayamazsınız")).toBeVisible();

  // Farklı kullanıcı (checker) onaylar — önce çıkış (proxy, oturumlu
  // kullanıcıyı /giris'ten panoya geri yollar).
  await page.getByRole("button", { name: "Çıkış" }).click();
  await page.waitForURL("**/giris");
  await ikinciKullaniciGirisYap(page);
  await page.goto("/sod/import");
  await expect(satir().getByText("Talep edildi")).toBeVisible({ timeout: 15_000 });
  await satir().getByLabel("Karar gerekçesi").fill("e2e onayı");
  await satir().getByRole("button", { name: "Geri Almayı Onayla" }).click();
  await expect(page.getByRole("status").first()).toContainText("Rollback uygulandı", { timeout: 20_000 });

  // Atamalar FİZİKSEL SİLİNMEDİ, sona erdirildi.
  const { data: sonAtamalar } = await db
    .from("sod_atamalari")
    .select("gecerlilik_bitis")
    .eq("tenant_id", kurum!.id)
    .eq("kaynak_sistem", kaynak);
  expect(sonAtamalar).toHaveLength(2);
  for (const a of sonAtamalar!) expect(a.gecerlilik_bitis).not.toBeNull();
});
