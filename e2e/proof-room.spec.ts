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

async function ledgerTemizle(db: ReturnType<typeof admin>, tenantId: string) {
  await db.from("artifact_ledger_links").delete().eq("tenant_id", tenantId);
  await db.from("ledger_outbox").delete().eq("tenant_id", tenantId);
  await db.from("transparency_checkpoints").delete().eq("tenant_id", tenantId);
  await db.from("transparency_ledger_entries").delete().eq("tenant_id", tenantId);
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

  // Önceki koşuların defter kalıntısı (leaf_index sıralamasını bozmasın) — temiz taban.
  await ledgerTemizle(db, kurum!.id);

  // 1) Admin bir PASSED koşusu üretir ve Proof Room linki açar. Koşu, AYNI
  // transaction'da ledger_outbox'a bir olay yazdırır (nihai talimat v3.2 §8.0);
  // rota bunu HEMEN drenaj eder ("otomatik" — ayrı bir "deftere ekle" adımı yok).
  await girisYap(page);
  const kosu = await page.request.post(`/api/kontrol-test/${tanim!.id}/calistir`, {
    data: { iddiaKarsilandi: true, gozlemZamani: new Date().toISOString() },
  });
  expect(kosu.ok()).toBeTruthy();
  const { testRunId, ledgerDurumu } = (await kosu.json()) as { testRunId: string; ledgerDurumu: string | null };
  expect(ledgerDurumu).toBe("ANCHORED"); // yaprak deftere yazıldı (mühürlendi)

  // Yaprak deftere yazıldı ama KAPSAYAN bir ağaç başı (STH) henüz yok — G3'ün
  // kendi deseni (seffaflik.spec.ts): STH ayrı, kasıtlı bir yayın adımı.
  const checkpoint = await page.request.post("/api/seffaflik/checkpoint");
  expect(checkpoint.ok()).toBeTruthy();

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

    // 2b) Şeffaflık defteri mührü — OTURUMSUZ RPC'den gelen makbuz, tarayıcıda
    // kuruldu. Bağımsız bir process'e (verify-seffaflik.ts) TAŞINABİLİR.
    await expect(misafir.getByText("Şeffaflık defterinde mühürlü")).toBeVisible();
    const makbuzLink = misafir.getByRole("link", { name: "Kapsama makbuzunu indir (JSON)" });
    await expect(makbuzLink).toBeVisible();
    const [download] = await Promise.all([misafir.waitForEvent("download"), makbuzLink.click()]);
    const makbuzYol = await download.path();
    expect(makbuzYol).toBeTruthy();

    const { execFileSync } = await import("node:child_process");
    const cikti = execFileSync("npx", ["tsx", "scripts/verify-seffaflik.ts", makbuzYol as string], {
      encoding: "utf8",
      shell: process.platform === "win32",
    });
    expect(cikti).toContain("VERIFIED");

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
    await ledgerTemizle(db, kurum!.id);
  }
});
