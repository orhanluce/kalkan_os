import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { E2E_KURUM_ADI, girisYap } from "./helpers";

// V2 PR-4a (M19): kaynak sicili salt-okur; REGULATED org-type'ta Regülasyon
// nav grubu görünür. Gerçek Chromium + gerçek Supabase.

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env eksik (.env.local).");
  return createClient(url, key, { auth: { persistSession: false } });
}

test("kaynak sicili: REGULATED nav + seed'li kaynaklar salt-okur listelenir", async ({ page }) => {
  test.setTimeout(90_000);
  const db = admin();
  const { data: kurum } = await db.from("tenants").select("id").eq("name", E2E_KURUM_ADI).single();
  await db
    .from("organization_profiles")
    .upsert({ tenant_id: kurum!.id, organization_type: "REGULATED_FINANCIAL_INSTITUTION" }, { onConflict: "tenant_id" });

  await girisYap(page);
  await page.reload(); // org profili store'a gelsin
  // REGULATED nav: Mevzuat > Kanun ve Yönetmelikler (etiket ceacc2c'de
  // "Kaynaklar"dan değiştirildi — nav-items.ts tek doğru kaynak).
  await expect(page.getByRole("link", { name: "Kanun ve Yönetmelikler" })).toBeVisible({ timeout: 15_000 });

  await page.goto("/regulasyon/kaynaklar");
  await expect(page.getByRole("heading", { name: "Resmî Kaynak Sicili" })).toBeVisible();
  // Seed'li gerçek kaynaklar (küratör script'i ile eklendi). "EUR-Lex" birden
  // fazla AB kaynağının otorite hücresinde görünür (regülasyon araştırma
  // zincirinden 36 kaynak seed'li) — en az birinin varlığı yeterli.
  await expect(page.getByRole("link", { name: "SPK Mevzuat Sistemi" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "EUR-Lex", exact: true }).first()).toBeVisible();
  // Erişim politikası rozeti (connector onay bekliyor — kural 3/§13).
  await expect(page.getByText("Politika onayı bekliyor").first()).toBeVisible();
  // PR-Q1' kural 8: hiç çekim olmayan kaynak "güncel" DEĞİL — dürüst mesaj.
  await expect(page.getByText("Hiç çekim yok — güncellik iddia edilemez").first()).toBeVisible();

  // Temizlik.
  await db.from("organization_profiles").delete().eq("tenant_id", kurum!.id);
});

test("PR-Q1': ingest edilen artifact + çekim koşusu tazelik ve nüsha listesinde görünür", async ({ page }) => {
  test.setTimeout(90_000);
  const db = admin();
  const { data: kurum } = await db.from("tenants").select("id").eq("name", E2E_KURUM_ADI).single();
  await db
    .from("organization_profiles")
    .upsert({ tenant_id: kurum!.id, organization_type: "REGULATED_FINANCIAL_INSTITUTION" }, { onConflict: "tenant_id" });

  // Sentetik e2e artifact'ı (kural 3: E2E etiketli, TODO_DOGRULA; sonda silinir).
  // Başlık HER KOŞUDA benzersiz (Date.now()): sabit bir literal, önceki bir
  // koşu timeout/kill nedeniyle finally'ye ulaşamazsa aynı isimli debris
  // birikmesine (ve sonraki koşuların .first() ile yanlış <details>'ı
  // açmasına) yol açıyordu — 2026-07-23'te tam suite koşusunda 13 birikmiş
  // kalıntı olarak yakalandı.
  const { data: kaynak } = await db.from("regulatory_sources").select("id").eq("ad", "SPK Mevzuat Sistemi").single();
  const baslik = `E2E sentetik nüsha (silinecek) ${Date.now()}`;
  const sha = [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, "0")).join("");
  const { data: art } = await db
    .from("source_artifacts")
    .insert({ source_id: kaynak!.id, baslik, sha256: sha, fetched_at: new Date().toISOString() })
    .select("id").single();
  const { data: kosu } = await db
    .from("source_fetch_runs")
    .insert({ source_id: kaynak!.id, durum: "BASARILI", artifact_id: art!.id })
    .select("id").single();

  try {
    await girisYap(page);
    await page.goto("/regulasyon/kaynaklar");
    await expect(page.getByRole("heading", { name: "Resmî Kaynak Sicili" })).toBeVisible();
    // Tazelik: bugünkü başarılı çekim → "Son çekim: bugün".
    await expect(page.getByText("Son çekim: bugün").first()).toBeVisible();
    // Nüsha listesi: bir <details> PER KAYNAK satırı var (birden fazla kaynağın
    // artifact'ı olabilir — regülasyon araştırma zincirinden 36 kaynak seed'li).
    // "nüsha" metnine körce .first() ile tıklamak YANLIŞ satırı açabilir; SPK
    // Mevzuat Sistemi satırını AÇIKÇA bulup İÇİNDEKİ <details>'ı açıyoruz.
    // "nüsha" alt metni satırdaki HEM <summary>'de (ör. "1 nüsha") HEM DE
    // kendi sentetik başlığımızda ("... nüsha (silinecek) ...") geçtiği için
    // metne göre değil <summary> etiketine göre hedefliyoruz.
    const spkSatiri = page.getByRole("row").filter({ hasText: "SPK Mevzuat Sistemi" });
    await spkSatiri.locator("summary").click();
    await expect(spkSatiri.getByText(baslik)).toBeVisible();
    // Sayfa TAM hash'i basar (kısaltma yok, bkz. src/app/(app)/regulasyon/
    // kaynaklar/page.tsx: <code title={a.sha256}>{a.sha256}</code>) — alt
    // dize eşleşmesiyle ilk 12 karakteri arıyoruz, uydurma bir "…" son eki
    // beklemiyoruz.
    await expect(spkSatiri.getByText(sha.slice(0, 12), { exact: false })).toBeVisible();
    await expect(spkSatiri.getByText("Doğrulanmadı").first()).toBeVisible(); // TODO_DOGRULA doğar (kural 3)
  } finally {
    await db.from("source_fetch_runs").delete().eq("id", kosu!.id);
    await db.from("source_artifacts").delete().eq("id", art!.id);
    await db.from("organization_profiles").delete().eq("tenant_id", kurum!.id);
  }
});
