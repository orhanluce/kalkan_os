import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { E2E_KURUM_ADI, girisYap, ikinciKullaniciGirisYap } from "./helpers";

// 37 Tez Dikey B, Faz 3 kalan dilimi: DORA RoI export motoru gerçek HTTP +
// UI + Chromium e2e. Gerçek çağrılar (page.request), gerçek Supabase.
// Kapsam: oturumsuz 401, engelleyici-sorun-varken-onay-reddi, maker-checker
// (talep eden kendi export'unu onaylayamaz — UI'da buton bile göstermez),
// farklı kişi onayı, CSV/XLSX indirme + içerik/imza doğrulaması, Proof Room
// linki oturumsuz görüntüleme. service_role KULLANILMADIĞI şu iki katmanda
// zaten kanıtlı: (a) rota kodu yalnız createClient()/server.ts (SSR/çerez)
// kullanıyor, service-role import YOK; (b) rls-roi-export-runs.test.ts
// (PGlite) admin/uyum DIŞI rolün INSERT/UPDATE'inin RLS'te reddedildiğini
// kanıtlıyor — burada üçüncü bir misafir-rolü e2e kullanıcısı YOK (fixture
// yalnız admin+uyum taşıyor), tekrar kanıtlamak gereksiz kopya olurdu.

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env eksik (.env.local).");
  return createClient(url, key, { auth: { persistSession: false } });
}

test("DORA RoI export: oturumsuz 401, engelleyici-sorun-blok, maker-checker onay, CSV/XLSX indirme, Proof Room", async ({ browser }) => {
  test.setTimeout(180_000);
  const db = admin();
  const { data: kurum } = await db.from("tenants").select("id").eq("name", E2E_KURUM_ADI).single();
  const tenantId = kurum!.id as string;

  // Temiz başlangıç: önceki koşulardan kalan kimlik/export silinir.
  await db.from("tenant_legal_identity").delete().eq("tenant_id", tenantId);
  const olusturulanExportIdleri: string[] = [];

  const adminCtx = await browser.newContext();
  const adminPage = await adminCtx.newPage();
  const uyumCtx = await browser.newContext();
  const uyumPage = await uyumCtx.newPage();

  try {
    // 0) Oturumsuz istek: proxy.ts TÜM /api/dora-roi/* yollarını korur (ACIK_
    //    YOLLAR'da yok) — /giris'e 307 redirect eder, rota koduna hiç
    //    ulaşmaz. Bu asıl koruma katmanı (rotanın kendi `if (!user)` 401
    //    dalı, tarayıcı-çerezli her isteğin proxy'de zaten durdurulması
    //    nedeniyle pratikte hiç tetiklenmez — savunma derinliği).
    const oturumsuzCtx = await browser.newContext();
    const oturumsuzYanit = await oturumsuzCtx.request.post("/api/dora-roi/export", { maxRedirects: 0 });
    expect(oturumsuzYanit.status()).toBe(307);
    expect(oturumsuzYanit.headers()["location"]).toContain("/giris");
    await oturumsuzCtx.close();

    await girisYap(adminPage);
    await adminPage.goto("/dora-roi");

    // 1) Kimlik profili yokken export oluştur → engelleyici sorun (BLOK),
    //    "Onay Talep Et" devre dışı.
    await adminPage.getByRole("button", { name: "Yeni Export Oluştur" }).click();
    const ilkSatir = adminPage.locator("div").filter({ hasText: "TASLAK" }).first();
    await expect(ilkSatir.getByText(/BLOK/)).toBeVisible({ timeout: 15_000 });
    await expect(adminPage.getByRole("button", { name: "Onay Talep Et" }).first()).toBeDisabled();

    // 2) Kimlik profilini kur (LEI+ülke+EUID — engelleyici VE uyarı sorunlarını temizler).
    const { error: kimlikErr } = await db.from("tenant_legal_identity").insert({ tenant_id: tenantId, lei: "5493001KJTIIGC8Y1R12", ulke_kodu: "TR", euid: "TR.E2E.123" });
    expect(kimlikErr).toBeNull();

    // 3) Temiz export oluştur.
    await adminPage.getByRole("button", { name: "Yeni Export Oluştur" }).click();
    await expect(adminPage.getByText("Ön-kontrol: sorun yok").first()).toBeVisible({ timeout: 15_000 });

    const { data: exportlar } = await db.from("roi_export_runs").select("id, engelleyici_sorun_sayisi").eq("tenant_id", tenantId).order("created_at", { ascending: false });
    const temizExport = exportlar!.find((e) => e.engelleyici_sorun_sayisi === 0)!;
    olusturulanExportIdleri.push(...exportlar!.map((e) => e.id));

    const temizSatir = adminPage.getByTestId(`roi-export-${temizExport.id}`);
    await temizSatir.getByRole("button", { name: "Onay Talep Et" }).click();
    await expect(adminPage.getByText("Bu export'u siz talep ettiniz")).toBeVisible({ timeout: 10_000 });

    // 4) Gerçek HTTP: admin kendi export'unu onaylamaya çalışırsa 409.
    const kendiOnayi = await adminPage.request.post(`/api/dora-roi/export/${temizExport.id}/karar`, { data: { eylem: "onayla" } });
    expect(kendiOnayi.status()).toBe(409);
    const kendiOnayiGovde = await kendiOnayi.json();
    expect(kendiOnayiGovde.hata).toContain("maker-checker");

    // 5) Farklı kullanıcı (uyum) onaylar.
    await ikinciKullaniciGirisYap(uyumPage);
    await uyumPage.goto("/dora-roi");
    const uyumSatir = uyumPage.getByTestId(`roi-export-${temizExport.id}`);
    await uyumSatir.getByRole("button", { name: "Onayla" }).click();
    await expect(uyumSatir.getByRole("link", { name: "CSV indir" })).toBeVisible({ timeout: 10_000 });

    // 6) CSV indirme — içerik + uyarı metni + LEI doğrulanır.
    const csvYanit = await uyumPage.request.get(`/api/dora-roi/export/${temizExport.id}/dosya?format=csv`);
    expect(csvYanit.ok()).toBeTruthy();
    expect(csvYanit.headers()["content-type"]).toContain("text/csv");
    const csvMetin = await csvYanit.text();
    expect(csvMetin).toContain("5493001KJTIIGC8Y1R12");
    expect(csvMetin).toContain("TAM UYGUNLUĞUNU İDDİA ETMEZ");
    expect(csvYanit.headers()["x-dosya-hash-sha256"]).toMatch(/^[0-9a-f]{64}$/);

    // 7) XLSX indirme — ZIP imzası (PK) doğrulanır.
    const xlsxYanit = await uyumPage.request.get(`/api/dora-roi/export/${temizExport.id}/dosya?format=xlsx`);
    expect(xlsxYanit.ok()).toBeTruthy();
    const xlsxGovde = await xlsxYanit.body();
    expect(xlsxGovde[0]).toBe(0x50);
    expect(xlsxGovde[1]).toBe(0x4b);

    // 8) TASLAK/ONAY_TALEP_EDILDI export'ta indirme 404 (yalnız YAYINLANDI).
    // (İlk bloklu export hâlâ TASLAK.)
    const blokluExport = exportlar!.find((e) => e.engelleyici_sorun_sayisi > 0)!;
    const bloklu404 = await uyumPage.request.get(`/api/dora-roi/export/${blokluExport.id}/dosya?format=csv`);
    expect(bloklu404.status()).toBe(404);

    // 9) Proof Room linki — oturumsuz görüntüleme.
    await uyumSatir.getByRole("button", { name: "Proof Room Linki Oluştur" }).click();
    const proofLink = await uyumPage.getByText(/^Proof Room linki:/).textContent();
    const proofUrl = proofLink!.replace("Proof Room linki: ", "").trim();

    const denetciCtx = await browser.newContext();
    const denetciPage = await denetciCtx.newPage();
    await denetciPage.goto(proofUrl);
    await expect(denetciPage.getByText("Export özeti")).toBeVisible({ timeout: 10_000 });
    await expect(denetciPage.getByText(/Snapshot hash'i/)).toBeVisible();
    await denetciCtx.close();
  } finally {
    if (olusturulanExportIdleri.length > 0) {
      await db.from("proof_room_links").delete().in("roi_export_run_id", olusturulanExportIdleri);
      await db.from("roi_export_runs").delete().in("id", olusturulanExportIdleri);
    }
    await db.from("tenant_legal_identity").delete().eq("tenant_id", tenantId);
    await adminCtx.close();
    await uyumCtx.close();
  }
});
