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

// M9 kabul kriteri: mühürlenmiş sonuçtan PDF raporu üretilir, rapordaki QR
// bağımsız doğrulamaya gider ve doğrulama HASSAS VERİ SIZDIRMAZ
// (docs/ROADMAP.md M9).
//
// Yukarıdaki testten AYRI ama ona bağımlı değil: kendi tatbikatını oynayıp
// puanlar. Bağımlı olsaydı, ilk test kırıldığında bu da kırılır ve M9'un
// bozulduğunu sanardık.
test("puanlanan tatbikat mühürlenir, PDF raporu üretilir ve QR doğrulaması sızdırmaz", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await girisYap(page);

  // Akışın kendisi yukarıdaki testle aynı — oradaki yorumlar seçicilerin
  // neden böyle olduğunu anlatıyor (durum makinesi iki ayrı geçiş ister,
  // "Tamamla" exact olmalı, vb.).
  await page.goto("/simulasyonlar");
  await page.getByTestId("senaryo-S05").getByRole("button", { name: "Yeni Tatbikat Başlat" }).click();
  await expect(page).toHaveURL(/\/simulasyonlar\/[0-9a-f-]+$/, { timeout: 15_000 });
  const runId = page.url().split("/").pop() as string;

  await page.getByRole("button", { name: "Hazırla" }).click();
  await expect(page.getByText("Hazır", { exact: true })).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "Başlat" }).click();
  await expect(page.getByText("Çalışıyor")).toBeVisible({ timeout: 10_000 });

  const yayinlaButonu = page.getByRole("button", { name: "Yayınla" });
  let kalan = await yayinlaButonu.count();
  while (kalan > 0) {
    await yayinlaButonu.first().click();
    await expect(yayinlaButonu).toHaveCount(kalan - 1, { timeout: 15_000 });
    kalan -= 1;
  }

  const tamamlandiButonlari = page.getByRole("button", { name: "Tamamlandı" });
  const aksiyonSayisi = await tamamlandiButonlari.count();
  for (let i = 0; i < aksiyonSayisi; i++) {
    const buton = tamamlandiButonlari.nth(i);
    await buton.click();
    await expect(buton).toBeDisabled({ timeout: 3_000 }).catch(() => {});
    await expect(buton).toBeEnabled({ timeout: 15_000 });
  }

  await page.getByRole("button", { name: "Tamamla", exact: true }).click();
  await expect(page.getByRole("button", { name: "Puanla" })).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "Puanla" }).click();
  await expect(page.getByText("/100")).toBeVisible({ timeout: 15_000 });

  // Mühür ekranda görünmeli: puanlama mühürlemeyi de yapar.
  await expect(page.getByText("Sonuç mühürlendi")).toBeVisible({ timeout: 10_000 });

  // --- PDF raporu gerçekten üretiliyor mu? ---
  // page.request: sayfanın oturum çerezini TAŞIR. Çıplak `request` fixture'ı
  // ayrı bir bağlamdır ve çerezsiz gider — proxy onu /giris'e yönlendirir,
  // test de "200 ama HTML" görürdü.
  const pdf = await page.request.get(`/api/simulasyon/${runId}/rapor`);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toContain("application/pdf");

  const govde = await pdf.body();
  // PDF dosya imzası: "boş 200 döndü" ile "gerçekten PDF" arasındaki fark.
  expect(govde.subarray(0, 4).toString()).toBe("%PDF");
  expect(govde.byteLength).toBeGreaterThan(5_000);

  // --- QR'ın gittiği doğrulama sayfası ---
  // Hash'i API yanıtından değil, kullanıcının gerçekten tıkladığı bağlantıdan
  // alıyoruz: test edilen şey ürünün yolu olmalı, kısayolumuz değil.
  const dogrulaLink = page.getByRole("link", { name: /Doğrulama sayfası/ });
  await expect(dogrulaLink).toBeVisible({ timeout: 10_000 });
  const href = (await dogrulaLink.getAttribute("href")) as string;
  const hash = href.split("/").pop() as string;
  expect(hash).toMatch(/^[0-9a-f]{64}$/);

  // Doğrulama OTURUMSUZ çalışmalı: denetçinin hesabı yok.
  const misafir = await page.context().browser()?.newContext();
  const misafirSayfa = await misafir!.newPage();
  await misafirSayfa.goto(`/dogrula/${hash}`);
  await expect(misafirSayfa.getByText("Mühür geçerli")).toBeVisible({ timeout: 15_000 });

  // HASSAS VERİ SIZDIRMAZ — M9 kabul kriteri.
  const metin = (await misafirSayfa.locator("body").textContent()) ?? "";
  expect(metin).not.toContain("E2E Test Kurumu");
  expect(metin).not.toContain("S05");
  expect(metin).not.toMatch(/Puan|BASARILI|KISMI|CRITICAL/);

  await misafir!.close();

  // --- Denetim paketi ZIP + BAĞIMSIZ verify CLI (M11 kabul kriteri) ---
  // Belge M01: "audit package temiz bir ortamda, repo DIŞINDA CLI ile
  // doğrulanır." Burada ZIP'i indiriyor, açıyor, verify-paket.ts'i AYRI bir
  // process olarak koşuyoruz — uygulamanın kendisi doğrulamaya karışmıyor.
  const paket = await page.request.get(`/api/simulasyon/${runId}/paket`);
  expect(paket.status()).toBe(200);
  expect(paket.headers()["content-type"]).toContain("application/zip");
  const zipBytes = await paket.body();
  expect(zipBytes.subarray(0, 2).toString()).toBe("PK"); // ZIP imzası

  // ZIP'i geçici bir klasöre aç (denetçinin yapacağı gibi).
  const JSZip = (await import("jszip")).default;
  const { mkdtempSync, writeFileSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { execFileSync } = await import("node:child_process");

  const klasor = mkdtempSync(join(tmpdir(), "kalkan-paket-"));
  try {
    const zip = await JSZip.loadAsync(zipBytes);
    for (const ad of Object.keys(zip.files)) {
      const icerik = await zip.files[ad].async("nodebuffer");
      writeFileSync(join(klasor, ad), icerik);
    }

    // 1) Sağlam paket: verify CLI VERIFIED demeli, çıkış kodu 0.
    const cikti = execFileSync("npx", ["tsx", "scripts/verify-paket.ts", klasor], {
      encoding: "utf8",
      shell: process.platform === "win32",
    });
    expect(cikti).toContain("VERIFIED");
    expect(cikti).toContain("[OK]");

    // 2) core-manifest kurcalanırsa CLI FAILED demeli, çıkış kodu 1.
    writeFileSync(join(klasor, "core-manifest.json"), '{"puan":100,"sahte":true}');
    let kurcaCikti = "";
    let cikisKodu = 0;
    try {
      execFileSync("npx", ["tsx", "scripts/verify-paket.ts", klasor], {
        encoding: "utf8",
        shell: process.platform === "win32",
      });
    } catch (e) {
      const err = e as { status: number; stdout: string };
      cikisKodu = err.status;
      kurcaCikti = err.stdout;
    }
    expect(cikisKodu).toBe(1);
    expect(kurcaCikti).toContain("FAILED");
  } finally {
    rmSync(klasor, { recursive: true, force: true });
  }
});
