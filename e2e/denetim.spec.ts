import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { E2E_KURUM_ADI, girisYap, ikinciKullaniciGirisYap } from "./helpers";

// M17 (G8): denetim işi + tekrarlanabilir örnekleme (seed) + çalışma kağıdı
// bağımsızlık sign-off (hazırlayan onaylayamaz). Gerçek Chromium, iki kullanıcı.

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env eksik (.env.local).");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function temizle(db: ReturnType<typeof admin>, tenantId: string) {
  await db.from("audit_engagements").delete().eq("tenant_id", tenantId).like("ad", "E2E-DN%");
  await db.from("findings").delete().eq("tenant_id", tenantId).like("baslik", "E2E-DN%");
}

test("denetim: tekrarlanabilir örnekleme + çalışma kağıdı bağımsızlık sign-off", async ({ browser }) => {
  test.setTimeout(150_000);
  const db = admin();
  const { data: kurum } = await db.from("tenants").select("id").eq("name", E2E_KURUM_ADI).single();
  await temizle(db, kurum!.id);

  const adminCtx = await browser.newContext();
  const adminPage = await adminCtx.newPage();
  const uyumCtx = await browser.newContext();
  const uyumPage = await uyumCtx.newPage();

  try {
    // 1) ADMIN denetim işi oluşturur.
    await girisYap(adminPage);
    await adminPage.goto("/denetim");
    await adminPage.getByLabel("Ad").fill("E2E-DN BS denetimi");
    await adminPage.getByRole("button", { name: "Oluştur" }).click();
    await expect(adminPage.getByRole("link", { name: "E2E-DN BS denetimi" })).toBeVisible();
    await adminPage.getByRole("link", { name: "E2E-DN BS denetimi" }).click();

    // 2) Tekrarlanabilir örnekleme (seed) + yeniden üret doğrula.
    await adminPage.getByLabel("Popülasyon").fill("100");
    await adminPage.getByLabel("Örnek boyutu").fill("10");
    await adminPage.getByLabel("Seed").fill("e2e-seed-1");
    await adminPage.getByRole("button", { name: "Örnek Seç" }).click();
    await expect(adminPage.getByText("e2e-seed-1")).toBeVisible();
    await adminPage.getByRole("button", { name: "Yeniden Üret (doğrula)" }).click();
    await expect(adminPage.getByText(/yeniden üretildi: birebir aynı/)).toBeVisible();

    // 3) ADMIN çalışma kağıdı (hazırlayan) → kendisi onaylayamaz (bağımsızlık).
    await adminPage.getByLabel("Başlık").fill("Erişim testleri");
    await adminPage.getByLabel("İçerik").fill("MFA örneklem sonuçları.");
    await adminPage.getByRole("button", { name: "Çalışma Kağıdı Ekle" }).click();
    await expect(adminPage.getByText("Erişim testleri")).toBeVisible();
    await adminPage.getByRole("button", { name: "Sign-off (onayla)" }).click();
    await expect(adminPage.getByRole("alert").filter({ hasText: "bağımsızlık" })).toBeVisible();

    // 3b) Workpaper→kontrol/bulgu bağı (M17 sonraki dilim, ROADMAP §1.29):
    // M13/Dikey5 desenindeki graf-genişletme — sign-off ÖNCESİ serbestçe eklenir.
    const { data: eng0 } = await db.from("audit_engagements").select("id").eq("tenant_id", kurum!.id).eq("ad", "E2E-DN BS denetimi").single();
    const { data: control } = await db.from("controls").select("id, madde_ref").limit(1).single();
    const { data: finding } = await db.from("findings").insert({ tenant_id: kurum!.id, kaynak: "denetim", onem: "orta", baslik: "E2E-DN test bulgusu" }).select("id, baslik").single();

    await adminPage.getByLabel("kontrol seç", { exact: false }).selectOption({ label: control!.madde_ref });
    await adminPage.getByRole("button", { name: "Kontrol Bağla" }).click();
    await expect(adminPage.getByText(control!.madde_ref, { exact: true }).first()).toBeVisible();

    await adminPage.getByLabel("bulgu seç", { exact: false }).selectOption({ label: finding!.baslik });
    await adminPage.getByRole("button", { name: "Bulgu Bağla" }).click();
    await expect(adminPage.getByText(finding!.baslik).first()).toBeVisible();

    // 3c) PBC talebi (M17 sonraki dilim, ROADMAP §1.29): kanıtsız "geldi/
    // kapandı" iddiası yok (kural 14 ruhu, regulatory_requests deseni).
    await adminPage.getByLabel("Talep").fill("IAM erişim listesi");
    await adminPage.getByRole("button", { name: "Talep Ekle" }).click();
    await expect(adminPage.getByText("IAM erişim listesi")).toBeVisible();
    await expect(adminPage.getByText("ACIK", { exact: true })).toBeVisible();

    // ACIK'tan doğrudan "Kapat" görünmez (kanıtsız kapanış yok) — kanıt gir, Alındı işaretle.
    await adminPage.getByLabel(/pbc kanıtı/).fill("IAM export - e2e.csv");
    await adminPage.getByRole("button", { name: "Alındı İşaretle" }).click();
    await expect(adminPage.getByText("ALINDI", { exact: true })).toBeVisible();
    await expect(adminPage.getByText("IAM export - e2e.csv")).toBeVisible();
    await adminPage.getByRole("button", { name: "Kapat" }).click();
    await expect(adminPage.getByText("KAPANDI", { exact: true })).toBeVisible();

    // 3d) Bağımsızlık beyanı (M17 sonraki dilim, ROADMAP §1.29): mevcut G7
    // tablosunun (independence_declarations) audit_engagements'e genellemesi.
    await adminPage.getByLabel("Ad", { exact: true }).fill("E2E Denetçi");
    await adminPage.getByLabel("E-posta").fill("e2e-denetci@ornek.com");
    await adminPage.getByRole("button", { name: "Beyan Ekle" }).click();
    await expect(adminPage.getByText("E2E Denetçi (e2e-denetci@ornek.com)")).toBeVisible();
    await expect(adminPage.getByText("Çıkar çatışması yok", { exact: true }).first()).toBeVisible();

    // 4) UYUM (farklı reviewer) sign-off → ONAYLANDI.
    const eng = eng0;
    await ikinciKullaniciGirisYap(uyumPage);
    await uyumPage.goto(`/denetim/${eng!.id}`);
    await uyumPage.getByRole("button", { name: "Sign-off (onayla)" }).click();
    await expect(uyumPage.getByText("ONAYLANDI")).toBeVisible();

    // 4b) Sign-off SONRASI bağ listesi DONUK: yeni bir kontrol seçici artık yok.
    await expect(uyumPage.getByLabel("kontrol seç", { exact: false })).toHaveCount(0);
    await expect(uyumPage.getByText(control!.madde_ref, { exact: true }).first()).toBeVisible();

    // DB: workpaper ONAYLANDI + reviewer≠hazırlayan; örnek seed'li seçim saklı.
    const { data: wp } = await db.from("audit_workpapers").select("durum, hazirlayan, reviewer").eq("engagement_id", eng!.id).single();
    expect(wp!.durum).toBe("ONAYLANDI");
    expect(wp!.reviewer).not.toBe(wp!.hazirlayan);
    const { data: s } = await db.from("audit_samples").select("seed, secilen_indeksler").eq("engagement_id", eng!.id).single();
    expect(s!.seed).toBe("e2e-seed-1");
    expect((s!.secilen_indeksler as number[]).length).toBe(10);

    // DB: bağların ikisi de kayıtlı, ONAYLANDI sonrası yeni bağ eklenemez.
    const { data: wp2 } = await db.from("audit_workpapers").select("id").eq("engagement_id", eng!.id).single();
    const { data: kBaglar } = await db.from("audit_workpaper_controls").select("id").eq("workpaper_id", wp2!.id);
    expect(kBaglar).toHaveLength(1);
    const { error: donukHata } = await db.from("audit_workpaper_controls").insert({ tenant_id: kurum!.id, workpaper_id: wp2!.id, control_id: control!.id });
    expect(donukHata?.message).toMatch(/donuk/);

    // 5) WORM export (M17 sonraki dilim SON maddesi, ROADMAP §1.29): denetim
    // işinin tam görünümü mühürlenir → BAĞIMSIZ CLI ile DB'siz doğrulanır.
    const disaAktar = await uyumPage.request.post(`/api/denetim/${eng!.id}/worm-export`);
    expect(disaAktar.ok()).toBeTruthy();
    const paketSonuc = await disaAktar.json();
    expect(paketSonuc.paket.schema).toBe("KALKAN_AUDIT_WORM_EXPORT_V1");
    expect(paketSonuc.paket.workpaperlar).toHaveLength(1);
    expect(paketSonuc.paket.beyanlar).toHaveLength(1);

    const { mkdtempSync, writeFileSync, rmSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const { execFileSync } = await import("node:child_process");
    const klasor = mkdtempSync(join(tmpdir(), "kalkan-worm-"));
    try {
      const yol = join(klasor, "paket.json");
      writeFileSync(yol, JSON.stringify(paketSonuc.paket));
      const cikti = execFileSync("npx", ["tsx", "scripts/verify-audit-worm.ts", yol], { encoding: "utf8", shell: process.platform === "win32" });
      expect(cikti).toContain("VERIFIED");

      // Kurcalanmış paket FAILED verir (çıkış kodu 1) — bağımsızlık gerçek.
      const kurcalanmis = { ...paketSonuc.paket, workpaperlar: [{ ...paketSonuc.paket.workpaperlar[0], icerik: "kurcalandı" }] };
      const kurcaYol = join(klasor, "kurcalanmis.json");
      writeFileSync(kurcaYol, JSON.stringify(kurcalanmis));
      expect(() => execFileSync("npx", ["tsx", "scripts/verify-audit-worm.ts", kurcaYol], { encoding: "utf8", shell: process.platform === "win32" })).toThrow();
    } finally {
      rmSync(klasor, { recursive: true, force: true });
    }

    // DB: mühür DEĞİŞMEZ — service_role bile güncelleyemez.
    const { data: worm } = await db.from("audit_worm_exports").select("id").eq("engagement_id", eng!.id).single();
    const { error: wormDonukHata } = await db.from("audit_worm_exports").update({ paket_hash: "f".repeat(64) }).eq("id", worm!.id);
    expect(wormDonukHata?.message).toMatch(/degistirilemez/);
  } finally {
    await adminCtx.close();
    await uyumCtx.close();
    await temizle(db, kurum!.id);
  }
});
