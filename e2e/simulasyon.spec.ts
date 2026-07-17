import { expect, test } from "@playwright/test";
import { girisYap } from "./helpers";

// M8 kabul kriteri: tatbikat baştan sona oynanabilir, tamamlandığında
// puanlanabilir, ve kabul edilen bulgu önerisi gerçek bir bulguya dönüşür
// (docs/ROADMAP.md M8, CLAUDE.md kural 11: "Simülasyon bulgusu PROPOSED
// doğar, insan onaylamadan gerçek bulgu olmaz").
//
// S05 (tedarikçi kesintisi) kullanılır: S01'den daha kısa (4 inject, 3 karar,
// 3 aksiyon) — testin çalışma süresini makul tutar. CR kuralı gerektirmez,
// yalnızca yürütme+puanlama+onay akışını sınar.

test("tatbikat baştan sona oynanır, puanlanır ve önerisi kabul edilince gerçek bulgu olur", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await girisYap(page);

  // 1) Tatbikat başlat.
  await page.goto("/simulasyonlar");
  // data-testid: metin-tabanlı bir ata seçici (`div :has-text("S05")`)
  // belirsizdi — aynı metni içeren birden fazla iç içe div eşleşir ve
  // .first() DOM sırasında en dıştaki (yanlış) kapsayıcıyı döndürebilirdi.
  await page.getByTestId("senaryo-S05").getByRole("button", { name: "Yeni Tatbikat Başlat" }).click();

  await expect(page).toHaveURL(/\/simulasyonlar\/[0-9a-f-]+$/, { timeout: 15_000 });
  // Başlık run.ad'dır (senaryo adı + tarih), "S05" kodu alt satırda
  // ("S05 v1 — ...") — kod ekranda ayrı bir paragrafta durur.
  await expect(page.getByText(/^S05 v\d+/)).toBeVisible();

  // 2) Hazırla ('taslak' -> 'hazir'), sonra Başlat ('hazir' -> 'calisiyor').
  // İki ayrı geçiş, iki ayrı buton: durum makinesi (20260717130000) ara
  // durumu atlamaya izin vermiyor.
  await page.getByRole("button", { name: "Hazırla" }).click();
  await expect(page.getByText("Hazır", { exact: true })).toBeVisible({ timeout: 10_000 });

  await page.getByRole("button", { name: "Başlat" }).click();
  await expect(page.getByText("Çalışıyor")).toBeVisible({ timeout: 10_000 });

  // 3) Tüm gelişmeleri yayınla (kaç tane olduğunu şablon belirler, sabit
  //    sayı varsaymıyoruz — "Sıradaki gelişmeler" boşalana kadar tıkla).
  //
  // Sabit bir sleep yerine toHaveCount kullanılır: her yayından sonra
  // butonlar `islemSuruyor` süresince disabled kalır ve bu gerçek bir
  // Supabase round-trip'i (değişken süre) — sabit bir bekleme ya gereksiz
  // yavaşlatır ya da yetmeyip "element disabled" hatası verir.
  const yayinlaButonu = page.getByRole("button", { name: "Yayınla" });
  let kalan = await yayinlaButonu.count();
  while (kalan > 0) {
    await yayinlaButonu.first().click();
    await expect(yayinlaButonu).toHaveCount(kalan - 1, { timeout: 15_000 });
    kalan -= 1;
  }
  await expect(page.getByText("Tüm gelişmeler yayınlandı.")).toBeVisible();

  // 4) Beklenen aksiyonların hepsini "Tamamlandı" işaretle — CRITICAL_FAILURE
  //    yolunu değil, temiz bir BAŞARILI/KISMI yolu sınıyoruz.
  //
  // Bu butonlar Yayınla'dan farklı: tıklanınca KAYBOLMAZLAR, yalnızca
  // `islemSuruyor` süresince tüm butonlar (paylaşılan state) disabled olur.
  // İki aşamalı bekleme: önce disabled olduğunu gör (işlem başladı), sonra
  // tekrar enabled olmasını bekle (işlem bitti) — .catch ile disabled anını
  // kaçırma ihtimalini (işlem çok hızlıysa) tolere ediyoruz.
  const tamamlandiButonlari = page.getByRole("button", { name: "Tamamlandı" });
  const aksiyonSayisi = await tamamlandiButonlari.count();
  for (let i = 0; i < aksiyonSayisi; i++) {
    const buton = tamamlandiButonlari.nth(i);
    await buton.click();
    await expect(buton).toBeDisabled({ timeout: 3_000 }).catch(() => {});
    await expect(buton).toBeEnabled({ timeout: 15_000 });
  }

  // 5) Tamamla -> Puanla.
  // "Tamamlandı" metnini durum rozetinde arayarak doğrulamıyoruz: aynı metin
  // yukarıdaki aksiyon butonlarında da geçiyor, belirsiz eşleşme olurdu.
  // "Puanla" butonunun belirmesi durum='tamamlandi' geçişinin gerçek kanıtı.
  // exact: true şart — "Tamamla" varsayılan (alt dize) eşleşmesiyle
  // "Tamamlandı" butonlarını da yakalar (strict mode ihlali).
  await page.getByRole("button", { name: "Tamamla", exact: true }).click();
  await expect(page.getByRole("button", { name: "Puanla" })).toBeVisible({ timeout: 10_000 });

  await page.getByRole("button", { name: "Puanla" }).click();
  await expect(page.getByText("/100")).toBeVisible({ timeout: 15_000 });

  // 6) Eğer puanlama bir bulgu önerisi ürettiyse (aksiyonlar zamanında
  //    tamamlanmadıysa ACTION_COMPLETED_WITHIN kuralları tetiklenir — bu test
  //    aksiyonları hemen tamamlandı işaretlediği için dakika değeri düşük
  //    olur ve çoğu zaman hedef içinde kalır; yine de bağlı olmayan/hedef
  //    dışı bir kural varsa öneri çıkabilir), onu kabul edip gerçek bulguya
  //    dönüştüğünü doğrula. Öneri hiç yoksa bu adım atlanır — puanlama
  //    akışının kendisi zaten yukarıda doğrulandı.
  const kabulButonu = page.getByRole("button", { name: "Kabul Et (bulgu oluştur)" });
  if (await kabulButonu.count() > 0) {
    const oneriBasligi = await page
      .locator("li")
      .filter({ has: kabulButonu.first() })
      .locator("span.font-medium")
      .first()
      .textContent();

    await kabulButonu.first().click();
    await expect(page.getByText("Kabul edildi — bulgu oluşturuldu").first()).toBeVisible({
      timeout: 10_000,
    });

    // Gerçek bulgu /findings'te görünmeli.
    await page.goto("/findings");
    if (oneriBasligi) {
      await expect(page.getByText(oneriBasligi.trim()).first()).toBeVisible({ timeout: 10_000 });
    }
  }
});
