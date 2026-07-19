import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { E2E_KURUM_ADI, girisYap } from "./helpers";

// G3 sonraki dilim: iki ağaç başı (STH) arası APPEND-ONLY tutarlılık kanıtı,
// BAĞIMSIZ offline doğrulayıcıyla (verify-seffaflik.ts, tutarlılık modu).

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env eksik (.env.local).");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function temizle(db: ReturnType<typeof admin>, tenantId: string) {
  await db.from("transparency_checkpoints").delete().eq("tenant_id", tenantId);
  await db.from("transparency_ledger_entries").delete().eq("tenant_id", tenantId);
}

test("şeffaflık: iki STH arası append-only tutarlılık kanıtı doğrulanır", async ({ page }) => {
  test.setTimeout(120_000);
  const db = admin();
  const { data: kurum } = await db.from("tenants").select("id").eq("name", E2E_KURUM_ADI).single();
  await temizle(db, kurum!.id);

  try {
    await girisYap(page);
    await page.goto("/seffaflik");

    // İfade 1 → STH (boy 1).
    await page.getByLabel("Kaydedilecek içerik (SHA-256 özeti alınır)").fill("tutarlilik-icerik-1");
    await page.getByRole("button", { name: "İfadeyi Kaydet" }).click();
    await expect(page.getByText(/yaprak #0/)).toBeVisible();
    await page.getByRole("button", { name: "Ağaç Başı Yayınla" }).click();
    await expect(page.getByText("Şeffaflık defterinde")).toBeVisible();

    // İfade 2 → STH (boy 2).
    await page.getByLabel("Kaydedilecek içerik (SHA-256 özeti alınır)").fill("tutarlilik-icerik-2");
    await page.getByRole("button", { name: "İfadeyi Kaydet" }).click();
    await expect(page.getByText(/yaprak #1/)).toBeVisible();
    await page.getByRole("button", { name: "Ağaç Başı Yayınla" }).click();
    // İki farklı boyutta STH → tutarlılık indirme bağı görünür.
    await expect(page.getByRole("link", { name: /Tutarlılık kanıtı indir/ })).toBeVisible();

    // Tutarlılık kanıtını oturumlu istekle çek.
    const resp = await page.request.get("/api/seffaflik/tutarlilik?from=1&to=2");
    expect(resp.status()).toBe(200);
    const kanit = await resp.json();
    expect(kanit.leaves).toHaveLength(2);

    const { mkdtempSync, writeFileSync, rmSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const { execFileSync } = await import("node:child_process");

    const klasor = mkdtempSync(join(tmpdir(), "kalkan-tutarlilik-"));
    try {
      const yol = join(klasor, "tutarlilik.json");
      writeFileSync(yol, JSON.stringify(kanit));

      // Sağlam: VERIFIED (append-only), çıkış 0.
      const cikti = execFileSync("npx", ["tsx", "scripts/verify-seffaflik.ts", yol], {
        encoding: "utf8",
        shell: process.platform === "win32",
      });
      expect(cikti).toContain("VERIFIED");
      expect(cikti).toContain("yalnız ekledi");

      // Ön ekteki yaprağı kurcala (geçmiş yeniden yazılmış) → FAILED, çıkış 1.
      const kurcali = { ...kanit, leaves: ["0".repeat(64), kanit.leaves[1]] };
      writeFileSync(yol, JSON.stringify(kurcali));
      let kod = 0;
      let kurcaCikti = "";
      try {
        execFileSync("npx", ["tsx", "scripts/verify-seffaflik.ts", yol], {
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
