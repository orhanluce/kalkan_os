import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { E2E_KURUM_ADI, girisYap } from "./helpers";

// G1 Proof Room (nihai §8/§12): koşudan süreli oturumsuz link → denetçi
// hesapsız görüntüler; süre dolunca ve iptalde AYNI "geçersiz" ekranı.
// Gerçek Chromium; görüntüleme ayrı (oturumsuz) browser context'inde.

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env eksik (.env.local).");
  return createClient(url, key, { auth: { persistSession: false } });
}

test("proof room: koşu → link → oturumsuz görüntüleme; expiry ve iptal aynı reddi verir", async ({ page, browser }) => {
  test.setTimeout(120_000);
  const db = admin();

  const { data: kurum } = await db.from("tenants").select("id").eq("name", E2E_KURUM_ADI).single();
  const { data: tanim } = await db
    .from("control_test_definitions")
    .select("id")
    .eq("tenant_id", kurum!.id)
    .eq("ad", "E2E: MFA tüm ayrıcalıklı hesaplarda zorunlu")
    .single();

  // 1) Admin bir PASSED koşusu üretir ve Proof Room linki açar.
  await girisYap(page);
  const kosu = await page.request.post(`/api/kontrol-test/${tanim!.id}/calistir`, {
    data: { iddiaKarsilandi: true, gozlemZamani: new Date().toISOString() },
  });
  expect(kosu.ok()).toBeTruthy();
  const { testRunId } = (await kosu.json()) as { testRunId: string };

  const link = await page.request.post("/api/proof-room", { data: { testRunId } });
  expect(link.ok()).toBeTruthy();
  const { url, linkId } = (await link.json()) as { url: string; linkId: string };

  // 2) OTURUMSUZ context: sayfa hesapsız açılır (proxy açık yolu + RPC kapısı).
  const misafirCtx = await browser.newContext();
  const misafir = await misafirCtx.newPage();
  try {
    await misafir.goto(url);
    await expect(misafir.getByRole("heading", { name: `Proof Room — ${E2E_KURUM_ADI}` })).toBeVisible();
    await expect(misafir.getByText("Sonuç: PASSED")).toBeVisible();
    await expect(misafir.getByText("Yasal dayanak: ALLOW", { exact: true })).toBeVisible();
    // Dayanak eşlemesi olmayan kontrol DÜRÜSTÇE söylenir (iddia uydurulmaz).
    await expect(misafir.getByText("dayanak eşlemesi yok", { exact: false })).toBeVisible();
    await expect(misafir.getByText("Paketi indir (JSON)")).toBeVisible();

    // Görüntüleme audit'e düştü (aktör yok — token sahibi).
    const { data: audit } = await db
      .from("audit_log")
      .select("id")
      .eq("tenant_id", kurum!.id)
      .eq("eylem", "proof_room_goruntulendi");
    expect((audit ?? []).length).toBeGreaterThan(0);

    // 3) Süre dolunca aynı sayfa "geçersiz" der (ayrım yok).
    await db.from("proof_room_links").update({ son_gecerlilik: new Date(Date.now() - 3600_000).toISOString() }).eq("id", linkId);
    await misafir.reload();
    await expect(misafir.getByText("Link geçersiz veya süresi dolmuş.")).toBeVisible();

    // 4) Yeni link + İPTAL → yine aynı ret.
    const link2 = await page.request.post("/api/proof-room", { data: { testRunId } });
    const { url: url2, linkId: linkId2 } = (await link2.json()) as { url: string; linkId: string };
    const iptal = await page.request.post("/api/proof-room", { data: { eylem: "iptal", linkId: linkId2 } });
    expect(iptal.ok()).toBeTruthy();
    await misafir.goto(url2);
    await expect(misafir.getByText("Link geçersiz veya süresi dolmuş.")).toBeVisible();
  } finally {
    await misafirCtx.close();
  }
});
