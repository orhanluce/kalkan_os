import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { E2E_KURUM_ADI, girisYap } from "./helpers";

// G3: şeffaflık defteri — imzalı ifade → ağaç başı (STH) → kapsama makbuzu →
// BAĞIMSIZ offline doğrulayıcı (verify-seffaflik.ts) AYRI process olarak
// VERIFIED/FAILED. Gerçek Chromium + gerçek Supabase.

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env eksik (.env.local).");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function temizle(db: ReturnType<typeof admin>, tenantId: string) {
  // Append-only: UPDATE yasak ama tenant temizliği için DELETE (service_role) serbest.
  await db.from("transparency_checkpoints").delete().eq("tenant_id", tenantId);
  await db.from("transparency_ledger_entries").delete().eq("tenant_id", tenantId);
}

test("şeffaflık: ifade → STH → makbuz → bağımsız offline doğrulayıcı", async ({ page }) => {
  test.setTimeout(120_000);
  const db = admin();
  const { data: kurum } = await db.from("tenants").select("id").eq("name", E2E_KURUM_ADI).single();
  await temizle(db, kurum!.id);

  try {
    await girisYap(page);
    await page.goto("/seffaflik");

    // 1) İfade kaydet.
    await page.getByLabel("Artefakt türü").selectOption("SIMULATION_MANIFEST");
    await page.getByLabel("Kaydedilecek içerik (SHA-256 özeti alınır)").fill("tatbikat-icerik-g3-001");
    await page.getByRole("button", { name: "İfadeyi Kaydet" }).click();
    await expect(page.getByText(/Kaydedildi \(yaprak #0/)).toBeVisible();
    await expect(page.getByText("Defterde (STH bekliyor)")).toBeVisible();

    // 2) Ağaç başı yayınla → kayıt "şeffaflık defterinde".
    await page.getByRole("button", { name: "Ağaç Başı Yayınla" }).click();
    await expect(page.getByText("Şeffaflık defterinde")).toBeVisible();
    await expect(page.getByRole("link", { name: "Makbuz İndir" })).toBeVisible();

    // DB: kayıt sealed (leaf_index 0, entry_hash 64 hex).
    const { data: entry } = await db
      .from("transparency_ledger_entries")
      .select("id, leaf_index, entry_hash, previous_entry_hash")
      .eq("tenant_id", kurum!.id)
      .order("leaf_index", { ascending: true })
      .limit(1)
      .single();
    expect(Number(entry!.leaf_index)).toBe(0);
    expect(entry!.entry_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(entry!.previous_entry_hash).toBeNull();

    // 3) Makbuzu oturumlu istekle çek (tarayıcı cookie'siyle).
    const makbuzResp = await page.request.get(`/api/seffaflik/makbuz/${entry!.id}`);
    expect(makbuzResp.status()).toBe(200);
    const makbuz = await makbuzResp.json();

    // 4) BAĞIMSIZ offline doğrulayıcı — ayrı process, DB'siz.
    const { mkdtempSync, writeFileSync, rmSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const { execFileSync } = await import("node:child_process");

    const klasor = mkdtempSync(join(tmpdir(), "kalkan-seffaflik-"));
    try {
      const makbuzYol = join(klasor, "makbuz.json");
      writeFileSync(makbuzYol, JSON.stringify(makbuz));

      // Sağlam makbuz: VERIFIED, çıkış 0.
      const cikti = execFileSync("npx", ["tsx", "scripts/verify-seffaflik.ts", makbuzYol], {
        encoding: "utf8",
        shell: process.platform === "win32",
      });
      expect(cikti).toContain("VERIFIED");
      expect(cikti).toContain("[OK]");

      // Kurcala: yaprağı değiştir → FAILED, çıkış 1.
      const kurcali = { ...makbuz, leafHash: "0".repeat(64) };
      writeFileSync(makbuzYol, JSON.stringify(kurcali));
      let kod = 0;
      let kurcaCikti = "";
      try {
        execFileSync("npx", ["tsx", "scripts/verify-seffaflik.ts", makbuzYol], {
          encoding: "utf8",
          shell: process.platform === "win32",
        });
      } catch (e) {
        const err = e as { status: number; stdout: string };
        kod = err.status;
        kurcaCikti = err.stdout;
      }
      expect(kod).toBe(1);
      expect(kurcaCikti).toContain("FAILED");
    } finally {
      rmSync(klasor, { recursive: true, force: true });
    }
  } finally {
    await temizle(db, kurum!.id);
  }
});
