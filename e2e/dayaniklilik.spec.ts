import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { E2E_KURUM_ADI, girisYap, ikinciKullaniciGirisYap } from "./helpers";

// Dikey 5 (nihai talimat v3.3 §8.0): M13 kritik hizmet grafının kontrol
// kenarıyla genişlemesi (critical_service_controls) + M21/M42 dayanıklılık
// taksonomisi dört-göz akışı (control_resilience_domains, regulasyon/dogrulama
// deseninin aynısı: uyum sunar, admin karar verir; incelemeye alan kendi
// sunumunu doğrulayamaz). Gerçek Chromium, iki kullanıcı.

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env eksik (.env.local).");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function temizle(db: ReturnType<typeof admin>, tenantId: string, controlIds: string[]) {
  await db.from("critical_business_services").delete().eq("tenant_id", tenantId).like("ad", "E2E-DY%");
  await db.from("control_resilience_domains").delete().in("control_id", controlIds);
}

test("dayanıklılık etki grafiği: kontrol kenarı (M13 genişlemesi) + M21/M42 dört-göz sınıflandırma", async ({ browser }) => {
  test.setTimeout(120_000);
  const db = admin();
  const { data: kurum } = await db.from("tenants").select("id").eq("name", E2E_KURUM_ADI).single();
  const { data: kontroller } = await db.from("controls").select("id, madde_ref").in("madde_ref", ["TODO-DOGRULA-01", "TODO-DOGRULA-02"]);
  const k1 = kontroller!.find((k) => k.madde_ref === "TODO-DOGRULA-01")!;
  const k2 = kontroller!.find((k) => k.madde_ref === "TODO-DOGRULA-02")!;
  await temizle(db, kurum!.id, [k1.id, k2.id]);

  const uyumCtx = await browser.newContext();
  const uyumPage = await uyumCtx.newPage();
  const adminCtx = await browser.newContext();
  const adminPage = await adminCtx.newPage();

  try {
    // --- Kontrol kenarı: M13 kritik hizmet grafının genişlemesi ---
    await girisYap(adminPage);
    await adminPage.goto("/kritik-hizmetler");
    await adminPage.getByLabel("Ad").fill("E2E-DY Ödeme");
    await adminPage.getByRole("button", { name: "Oluştur" }).click();
    await adminPage.getByRole("link", { name: "E2E-DY Ödeme" }).click();
    await expect(adminPage.getByRole("heading", { name: "E2E-DY Ödeme" })).toBeVisible();

    await adminPage.getByLabel("Kontrol").selectOption({ label: k1.madde_ref });
    await adminPage.getByRole("button", { name: "Kontrol Bağla" }).click();
    await expect(adminPage.getByText(k1.madde_ref).first()).toBeVisible();

    await adminPage.goto("/dayaniklilik");
    const etkiSatiri = adminPage.getByRole("row", { name: new RegExp(k1.madde_ref) });
    await expect(etkiSatiri).toContainText("1");
    await expect(etkiSatiri).toContainText("E2E-DY Ödeme");

    // --- M21/M42 dört-göz: UYUM sunar (k1), ADMIN onaylar → VERIFIED ---
    await ikinciKullaniciGirisYap(uyumPage);
    await uyumPage.goto("/dayaniklilik");
    await uyumPage.getByLabel("Kontrol", { exact: true }).selectOption({ label: k1.madde_ref });
    await uyumPage.getByLabel("Dayanıklılık alanı").selectOption({ label: "Kurtarma" });
    await uyumPage.getByRole("button", { name: "Sınıflandırma Öner (TODO_DOĞRULA)" }).click();
    const uyumSatir1 = uyumPage.getByTestId(`siniflandirma-${k1.id}`);
    await uyumSatir1.getByRole("button", { name: "İncelemeye Al" }).click();
    await expect(uyumSatir1.getByText("LEGAL_REVIEW")).toBeVisible();

    // UYUM onaylamaya çalışır → rol kapısı (karar admin'de — K8 açık karar).
    await uyumSatir1.getByRole("button", { name: "Onayla" }).click();
    await expect(uyumPage.getByRole("alert").filter({ hasText: "admin" })).toBeVisible();

    // ADMIN aynı kaydı onaylar → dört göz sağlanır (sunan uyum ≠ onaylayan admin).
    await adminPage.goto("/dayaniklilik");
    const adminSatir1 = adminPage.getByTestId(`siniflandirma-${k1.id}`);
    await adminSatir1.getByRole("button", { name: "Onayla" }).click();
    await expect(adminSatir1.getByText("VERIFIED")).toBeVisible();
    const kurtarmaSatiri = adminPage.getByRole("row", { name: /Kurtarma/ });
    await expect(kurtarmaSatiri).toContainText("Kapsanıyor");

    // --- DB dört-göz guard: ADMIN k2'yi hem sunar hem onaylamaya çalışır → red ---
    await adminPage.getByLabel("Kontrol", { exact: true }).selectOption({ label: k2.madde_ref });
    await adminPage.getByLabel("Dayanıklılık alanı").selectOption({ label: "Müdahale" });
    await adminPage.getByRole("button", { name: "Sınıflandırma Öner (TODO_DOĞRULA)" }).click();
    const adminSatir2 = adminPage.getByTestId(`siniflandirma-${k2.id}`);
    await adminSatir2.getByRole("button", { name: "İncelemeye Al" }).click();
    await expect(adminSatir2.getByText("LEGAL_REVIEW")).toBeVisible();
    await adminSatir2.getByRole("button", { name: "Onayla" }).click();
    await expect(adminPage.getByRole("alert").filter({ hasText: "dort goz" })).toBeVisible();
    await expect(adminSatir2.getByText("LEGAL_REVIEW")).toBeVisible();

    // DB doğrulaması: k1 VERIFIED + dört-göz atfı ayrı kişiler; k2 hâlâ LEGAL_REVIEW.
    const { data: sinif1 } = await db
      .from("control_resilience_domains")
      .select("dogrulama_durumu, incelemeye_alan, dogrulayan")
      .eq("control_id", k1.id)
      .single();
    expect(sinif1!.dogrulama_durumu).toBe("VERIFIED");
    expect(sinif1!.incelemeye_alan).not.toBe(sinif1!.dogrulayan);
    const { data: sinif2 } = await db.from("control_resilience_domains").select("dogrulama_durumu").eq("control_id", k2.id).single();
    expect(sinif2!.dogrulama_durumu).toBe("LEGAL_REVIEW");
  } finally {
    await uyumCtx.close();
    await adminCtx.close();
    await temizle(db, kurum!.id, [k1.id, k2.id]);
  }
});

// Dikey D, ilk dilim (docs/adr/PR0-dikeyD-dayaniklilik-etki-grafi-2026-07-20.md):
// birleşik etki grafı anlık görüntüsü — SPOF tespiti + mühürleme + Proof Room.
test("dayanıklılık: birleşik etki grafı anlık görüntüsü — SPOF tespiti + Proof Room", async ({ browser }) => {
  test.setTimeout(120_000);
  const db = admin();
  const { data: kurum } = await db.from("tenants").select("id").eq("name", E2E_KURUM_ADI).single();
  const tenantId = kurum!.id as string;

  await db.from("critical_business_services").delete().eq("tenant_id", tenantId).like("ad", "E2E-GRAF%");
  const olusturulanSnapshotIdleri: string[] = [];

  const { data: hizmetler, error: hizmetHata } = await db
    .from("critical_business_services")
    .insert([
      { tenant_id: tenantId, ad: "E2E-GRAF Ödeme" },
      { tenant_id: tenantId, ad: "E2E-GRAF Takas" },
    ])
    .select("id, ad");
  expect(hizmetHata).toBeNull();
  const h1 = hizmetler!.find((h) => h.ad === "E2E-GRAF Ödeme")!;
  const h2 = hizmetler!.find((h) => h.ad === "E2E-GRAF Takas")!;

  // İki farklı kritik hizmet AYNI bağımlılık adını paylaşır — SPOF (M13 senaryosu).
  const { error: bagHata } = await db.from("service_dependencies").insert([
    { tenant_id: tenantId, critical_service_id: h1.id, ad: "E2E-GRAF Ortak Veri Merkezi", bagimlilik_turu: "TESIS" },
    { tenant_id: tenantId, critical_service_id: h2.id, ad: "E2E-GRAF Ortak Veri Merkezi", bagimlilik_turu: "TESIS" },
  ]);
  expect(bagHata).toBeNull();

  const adminCtx = await browser.newContext();
  const adminPage = await adminCtx.newPage();

  try {
    await girisYap(adminPage);
    await adminPage.goto("/dayaniklilik");

    await adminPage.getByRole("button", { name: "Anlık Görüntü Oluştur" }).click();
    const sonuc = adminPage.getByTestId("etki-grafi-anlik-goruntu");
    await expect(sonuc).toBeVisible({ timeout: 15_000 });
    await expect(sonuc.getByText(/Graf hash'i:/)).toBeVisible();
    await expect(sonuc.getByText(/E2E-GRAF Ortak Veri Merkezi \(2\)/)).toBeVisible();

    // DB doğrulaması: mühürlü, hash gerçek RFC 8785 formatında.
    const { data: snapshotlar } = await db.from("impact_graph_snapshots").select("id, graf_hash, spof_raporu").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(1);
    olusturulanSnapshotIdleri.push(...(snapshotlar ?? []).map((s) => s.id));
    expect(snapshotlar![0].graf_hash).toMatch(/^[0-9a-f]{64}$/);
    const spof = snapshotlar![0].spof_raporu as { sistemikNoktalar: { etiket: string }[] };
    expect(spof.sistemikNoktalar.some((s) => s.etiket === "E2E-GRAF Ortak Veri Merkezi")).toBe(true);

    // Proof Room linki + oturumsuz görüntüleme.
    await sonuc.getByRole("button", { name: "Proof Room Linki Oluştur" }).click();
    const proofLink = await adminPage.getByText(/^Proof Room linki:/).textContent();
    const proofUrl = proofLink!.replace("Proof Room linki: ", "").trim();

    const denetciCtx = await browser.newContext();
    const denetciPage = await denetciCtx.newPage();
    await denetciPage.goto(proofUrl);
    await expect(denetciPage.getByText("Anlık görüntü özeti")).toBeVisible({ timeout: 10_000 });
    await expect(denetciPage.getByText(/Graf hash'i \(SHA-256\)/)).toBeVisible();
    await expect(denetciPage.getByText("Hesaplama yöntemi ve varsayımlar")).toBeVisible();
    await expect(denetciPage.getByText(/kesin\/doğrulanmış bir gerçek DEĞİLDİR/)).toBeVisible();
    await expect(denetciPage.getByText("E2E-GRAF Ortak Veri Merkezi")).toBeVisible();
    await expect(denetciPage.getByText("2 kritik hizmeti etkiliyor")).toBeVisible();
    await denetciCtx.close();
  } finally {
    if (olusturulanSnapshotIdleri.length > 0) {
      await db.from("proof_room_links").delete().in("graph_snapshot_id", olusturulanSnapshotIdleri);
      await db.from("impact_graph_snapshots").delete().in("id", olusturulanSnapshotIdleri);
    }
    await db.from("critical_business_services").delete().eq("tenant_id", tenantId).like("ad", "E2E-GRAF%");
    await adminCtx.close();
  }
});
