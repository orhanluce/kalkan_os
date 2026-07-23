import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { E2E_KULLANICI_ADI, girisYap, kontrolAc } from "./helpers";

/** Node tarafı service client — süre-dolumu işini (revoke'lu RPC) çağırmak için. */
function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env eksik (.env.local).");
  return createClient(url, key, { auth: { persistSession: false } });
}

// docs/ROADMAP.md M2 kabul kriteri:
//   "kanıt yükle → kontrol 'karşılanıyor' olur → geçerliliği geçmişe çek →
//    'kısmi'ye düşer; audit_log'da iki kayıt görünür"
//
// UYARLAMA: kriterdeki "geçerliliği geçmişe çek" adımı, var olan bir kanıdı
// UPDATE etmeyi ima ediyor — ama evidences append-only (CLAUDE.md kural 2,
// kabul kriterinden önce gelir). Bu yüzden aynı son durum, süresi geçmiş
// yeni bir kanıt yükleyerek doğrulanıyor: sonuç aynı ("kısmi"ye düşüş),
// değişmez kural çiğnenmiyor.
//
// Her test farklı bir kontrol kodu kullanır (bkz. select-etiketleri.spec.ts
// notu) — testler arası durum sızıntısını önlemek için.

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
  await kontrolAc(page, "TODO-DOGRULA-04");

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
  await kontrolAc(page, "TODO-DOGRULA-05");

  const durumTrigger = page.getByRole("combobox").first();
  // İçeriği önce bekle, sonra tıkla: diğer testlerdeki gibi (bkz.
  // sorumlu-atama.spec.ts) bu, hydration tamamlanmadan tıklamayı önler —
  // doğrudan .click() ile başlamak base-ui'nin portal'lı popup'ında ara sıra
  // "option bulunamadı" zaman aşımına yol açıyordu.
  await expect(durumTrigger).toContainText("Açık");
  await durumTrigger.click();
  await page.getByRole("option", { name: "Kısmi" }).click();
  await expect(durumTrigger).toContainText("Kısmi");

  await page.goto("/denetim-izi");
  // /denetim-izi TÜM kiracının izini gösterir, yalnızca bu kontrolün değil —
  // önceki testlerin bu ortak e2e kiracısında bıraktığı "Durum değişti"
  // kayıtları da görünür. .first() bilinçli: en az bir kayıt var mı diye
  // bakıyoruz, tam olarak bir tane diye değil.
  await expect(page.getByText("Durum değişti").first()).toBeVisible();
  // Eylemi yapan kullanıcı adıyla yazılmalı (aktör atfı) — artık audit_log
  // trigger'ı DB'de yazıyor (bkz. 20260717090000_audit_triggers.sql), ama
  // aktör atfının ekrana kadar doğru ulaştığını yalnızca bu e2e kanıtlıyor.
  await expect(page.getByText(E2E_KULLANICI_ADI).first()).toBeVisible();

  // Gerçek DB'ye yazıldığı için yenilemeden sonra da durmalı.
  await page.reload();
  await expect(page.getByText("Durum değişti").first()).toBeVisible();
});

// FAZ 1 (Kanonik Kanıt, 2026-07-23): "bir kanıt, dört çerçeve" yansıtması artık
// kaynak_kontrol_id ile hangi ORİJİNAL yüklemeden geldiğini taşıyor (önceden
// bu alan DB'de hiç yoktu, hep null görünüyordu — bkz. src/lib/supabase/
// veri.ts'teki eski "ŞEMA EKSİĞİ" yorumu). Bu test, seed'de gerçekten var olan
// bir 'esdeger' eşlemesini (VII-128.10 TODO-DOGRULA-05 <-> 7545
// TODO-DOGRULA-7545-01, scripts/seed-controls.ts) kullanarak uçtan uca
// doğruluyor: yansıtılan satır doğru kaynağa LİNKLENİYOR (önceden bu link
// kaynakKontrolId'yi bir KONTROL id'si sanıp kırık olurdu — Dikey K ADR §4'ün
// "adı yanıltıcı" uyarısı; kod tarafında bu turda düzeltildi).
test("kanıt yansıtması: eşdeğer kontrolde görünür ve kaynağa doğru linklenir", async ({ page }) => {
  await girisYap(page);
  await kontrolAc(page, "TODO-DOGRULA-05");

  await beyanKanitiYukle(page, "FAZ 1 e2e: bilgi güvenliği politikası " + Date.now());
  await expect(page.getByText("Yüklenen Kanıtlar (1)")).toBeVisible({ timeout: 10_000 });

  // Eşdeğer kontrole geç: yansıtılan satır orada, "esdeger" olduğu için
  // kısmi-destek rozeti YOK, ve kaynağa dönen link gerçekten çalışıyor.
  await kontrolAc(page, "TODO-DOGRULA-7545-01");
  const yansitmaNotu = page.getByText("Eşlenik kanıt").first();
  await expect(yansitmaNotu).toBeVisible();
  await expect(page.getByText("Kısmi destek — kontrolü tam karşılamıyor")).toHaveCount(0);

  await page.getByRole("link", { name: "kaynak kontrolden" }).first().click();
  await expect(page.getByText("TODO-DOGRULA-05").first()).toBeVisible();
});

// BİLİNEN, İZLENEN AÇIK (docs/ROADMAP.md "Supabase geçişi" borçları):
// "Kanıt süresi dolması artık yalnızca yükleme anında hesaplanıyor; DB'de
// 'karsilaniyor' kalıp UI'da 'kismi' görünen kayıtlar oluşabilir."
//
// Bu test o davranışı sınıyordu: kanıt SÜRESİ GEÇMİŞ HALE GELDİKTEN SONRA
// (yükleme anında değil, zaman geçtiği için) sayfa yenilenince durumun
// otomatik 'kısmi'ye düşmesini bekliyordu. Mock/localStorage döneminde
// applyExpiryDowngrades() her yüklemede TÜM kanıtları yeniden değerlendirip
// bunu sağlıyordu. Supabase'e geçişte bu yeniden-değerlendirme adımı
// TAŞINMADI — yalnızca kanıt EKLENİRKEN o anki tarihe göre durum hesaplanıyor
// (bkz. src/lib/store.tsx addEvidence). Yani bugün geçerli bir kanıtla
// karşılanıyor olan bir kontrol, kanıdın süresi dolduğunda kendiliğinden
// kısmi'ye düşmüyor — biri o kontrole tekrar dokunana kadar.
//
// Bunu sessizce atlamak yerine burada AÇIKÇA skip ediyoruz: doğru çözüm bir
// veritabanı trigger'ı veya zamanlanmış iş (pg_cron), ve bu "Playwright'ı
// yeniden aç" görevinin kapsamı dışında — kendi başına bir iştir. Test kodu,
// düzeltildiğinde tam olarak neyin doğrulanması gerektiğini burada belgeliyor.
// M2 borcu KAPANDI (migration 20260718010000): otomatik kanıt süre-dolumu
// artık bir pg_cron işi (`kanit_suresi_dolanlari_isle`). Eskiden bu test
// skip'liydi çünkü append-only evidences'ta bir kanıdı geçmişe çekemiyorduk
// ve trigger/cron yoktu. Şimdi: geçmiş tarihli kanıt + karsilaniyor durumu
// service client ile kurulur (gerçek dünyada bu durum ZAMANLA oluşur — kanıt
// geçerliyken yüklenir, sonra dolar), süre-dolumu İŞİ çalıştırılır, ve
// sonuç — kontrol 'kismi'ye düşer, audit "Sistem"e atfedilir — UI'da doğrulanır.
test("otomatik kanıt süre-dolumu kontrolü 'kısmi'ye düşürür ve Sistem'e atfedilir", async ({
  page,
}) => {
  test.setTimeout(45_000);
  const db = admin();

  // Diğer testlerin dokunmadığı bir kontrol seç (TODO-DOGRULA-15).
  const { data: kurum } = await db.from("tenants").select("id").eq("name", "E2E Test Kurumu A.Ş.").single();
  const { data: kontrol } = await db
    .from("controls")
    .select("id")
    .eq("madde_ref", "TODO-DOGRULA-15")
    .single();

  // Durumu 'karsilaniyor' yap + geçmiş tarihli (dünkü) kanıt ekle. Bu, kanıt
  // geçerliyken karşılanmış, sonra kanıdı dolmuş bir kontrolün durumudur.
  await db
    .from("tenant_controls")
    .update({ durum: "karsilaniyor" })
    .eq("tenant_id", kurum!.id)
    .eq("control_id", kontrol!.id);
  const dun = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  await db.from("evidences").insert({
    tenant_id: kurum!.id,
    control_id: kontrol!.id,
    tip: "beyan",
    classification: "gizli",
    retention_class: "10y",
    envelope_schema_version: "KALKAN_EVIDENCE_ENVELOPE_V1",
    gecerlilik_bitis: dun,
  });

  // Süre-dolumu İŞİNİ çalıştır (pg_cron'un günlük yaptığını burada elle).
  const { data: islenen, error } = await db.rpc("kanit_suresi_dolanlari_isle");
  expect(error).toBeNull();
  expect(Number(islenen)).toBeGreaterThanOrEqual(1);

  // Kontrol 'kismi'ye düştü mü — DB'de.
  const { data: tc } = await db
    .from("tenant_controls")
    .select("durum")
    .eq("tenant_id", kurum!.id)
    .eq("control_id", kontrol!.id)
    .single();
  expect(tc!.durum).toBe("kismi");

  // UI: denetim izinde "Kanıt süresi doldu" + "Sistem" görünür.
  await girisYap(page);
  await page.goto("/denetim-izi");
  await expect(page.getByText("Kanıt süresi doldu").first()).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Sistem").first()).toBeVisible();
});

// M11 kabul kriteri: dosya kanıtı GERÇEKTEN Storage'a yüklenir ve geri
// indirilebilir (docs/ROADMAP.md M11). Bugüne kadar form yalnızca dosya
// adını kaydediyordu — bu test o boşluğu tarayıcıdan kapatır.
//
// Storage RLS'in kiracı sınırı ve bucket'ın private oluşu ayrıca canlıya
// karşı script'le doğrulandı (kendi klasörüne yükleme OK, başka tenant yoluna
// yükleme RLS ile reddedildi) — PGlite storage şemasını taklit edemediği için
// o katman burada değil, gerçek Supabase'e karşı kanıtlanır.
test("M11: dosya kanıtı Storage'a yüklenir ve imzalı URL ile indirilebilir", async ({ page }) => {
  await girisYap(page);
  await kontrolAc(page, "TODO-DOGRULA-06");

  // Tip "Dosya" seç ve gerçek bir dosya ekle (bellekten, buffer olarak).
  await page.getByLabel("Tip").click();
  await page.getByRole("option", { name: "Dosya" }).click();

  const icerik = `M11 e2e kanit dosyasi ${Date.now()}`;
  await page.getByLabel(/Dosya \(SHA-256/).setInputFiles({
    name: "kanit.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(icerik, "utf8"),
  });

  // Gizlilik sınıfı ve saklama süresinin varsayılanları var (zorunlu ama
  // makul); doğrudan gönder.
  await page.getByRole("button", { name: "Kanıt Ekle" }).click();

  // Kanıt listede belirmeli ve "Dosyayı indir" bağlantısı görünmeli —
  // bağlantının varlığı storage_object_key'in DOLU olduğunun kanıtı, yani
  // dosya gerçekten yüklendi (link/beyan tipinde bu bağlantı çıkmaz).
  await expect(page.getByText("Yüklenen Kanıtlar (1)")).toBeVisible({ timeout: 10_000 });
  const indirBtn = page.getByRole("button", { name: "Dosyayı indir" });
  await expect(indirBtn).toBeVisible();

  // İndir: yeni sekmede imzalı URL açılır. Popup'ı yakalayıp URL'in gerçek
  // storage nesnesine işaret ettiğini ve baytların DÖNDÜĞÜNÜ doğrula.
  const [popup] = await Promise.all([page.waitForEvent("popup"), indirBtn.click()]);
  await popup.waitForLoadState();
  expect(popup.url()).toContain("/storage/v1/object/sign/evidence/");

  // İmzalı URL'in içeriği yüklenen dosyayla aynı olmalı.
  const inen = await page.request.get(popup.url());
  expect(inen.status()).toBe(200);
  expect(await inen.text()).toBe(icerik);
});
