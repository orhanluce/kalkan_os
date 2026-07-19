import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { E2E_KURUM_ADI, girisYap } from "./helpers";

// Nihai v3.3 §8.0 Dikey 1: tedarikçi değerlendirme SIGN-OFF'u TAMAMLANINCA
// OTOMATİK olarak SCITT şeffaflık defterine mühürlenir (transactional outbox);
// receipt Proof Room/offline verifier zincirine taşınır. Gerçek Chromium.

const VENDOR = "E2E Sign-off Ledger Vendor A.Ş.";

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env eksik (.env.local).");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function temizle(db: ReturnType<typeof admin>, tenantId: string) {
  await db.from("artifact_ledger_links").delete().eq("tenant_id", tenantId);
  await db.from("ledger_outbox").delete().eq("tenant_id", tenantId);
  await db.from("transparency_checkpoints").delete().eq("tenant_id", tenantId);
  await db.from("transparency_ledger_entries").delete().eq("tenant_id", tenantId);
  await db.from("assessment_findings").delete().eq("tenant_id", tenantId);
  await db.from("third_party_assessments").delete().eq("tenant_id", tenantId);
  await db.from("third_parties").delete().eq("tenant_id", tenantId).eq("ad", VENDOR);
}

test("tedarikçi sign-off tamamlanınca OTOMATİK deftere mühürlenir → makbuz offline doğrulanır", async ({ page }) => {
  test.setTimeout(120_000);
  const db = admin();
  const { data: kurum } = await db.from("tenants").select("id").eq("name", E2E_KURUM_ADI).single();
  await temizle(db, kurum!.id);
  const { data: vendor } = await db.from("third_parties").insert({ tenant_id: kurum!.id, ad: VENDOR, tier: "KRITIK" }).select("id").single();
  const vendorId = vendor!.id as string;

  try {
    await girisYap(page);
    await page.goto(`/tedarikciler/${vendorId}`);

    // Değerlendirme aç, açık kritik bulgu YOK → doğrudan tamamla.
    await page.getByRole("button", { name: "Yeni Değerlendirme (DORA)" }).click();
    await expect(page.getByText("TASLAK")).toBeVisible();
    await page.getByRole("button", { name: "Değerlendirmeyi Tamamla" }).click();

    // Tamamlama → trigger enqueue + rota otomatik drenaj → ANCHORED rozet.
    await expect(page.getByText("Sign-off deftere mühürlü")).toBeVisible();

    // DB: assessment ANCHORED + link + doğru statement_kind.
    const { data: asmt } = await db.from("third_party_assessments").select("id").eq("third_party_id", vendorId).single();
    const { data: link } = await db
      .from("artifact_ledger_links")
      .select("ledger_entry_id")
      .eq("artifact_table", "third_party_assessments")
      .eq("artifact_id", asmt!.id)
      .single();
    const { data: entry } = await db
      .from("transparency_ledger_entries")
      .select("statement_kind, statement_hash")
      .eq("id", link!.ledger_entry_id)
      .single();
    expect(entry!.statement_kind).toBe("TPR_ASSESSMENT_SIGNOFF");
    expect(entry!.statement_hash).toMatch(/^[0-9a-f]{64}$/);

    // Ağaç başı (STH) yayınla → makbuz al → BAĞIMSIZ offline doğrulayıcı.
    const cp = await page.request.post("/api/seffaflik/checkpoint");
    expect(cp.ok()).toBeTruthy();
    const makbuzResp = await page.request.get(`/api/seffaflik/makbuz/${link!.ledger_entry_id}`);
    expect(makbuzResp.status()).toBe(200);
    const makbuz = await makbuzResp.json();

    const { mkdtempSync, writeFileSync, rmSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const { execFileSync } = await import("node:child_process");
    const klasor = mkdtempSync(join(tmpdir(), "kalkan-signoff-"));
    try {
      const yol = join(klasor, "makbuz.json");
      writeFileSync(yol, JSON.stringify(makbuz));
      const cikti = execFileSync("npx", ["tsx", "scripts/verify-seffaflik.ts", yol], { encoding: "utf8", shell: process.platform === "win32" });
      expect(cikti).toContain("VERIFIED");

      // Kurcala → FAILED.
      writeFileSync(yol, JSON.stringify({ ...makbuz, leafHash: "0".repeat(64) }));
      let kod = 0;
      try {
        execFileSync("npx", ["tsx", "scripts/verify-seffaflik.ts", yol], { encoding: "utf8", shell: process.platform === "win32" });
      } catch (e) {
        kod = (e as { status: number }).status;
      }
      expect(kod).toBe(1);
    } finally {
      rmSync(klasor, { recursive: true, force: true });
    }
  } finally {
    await temizle(db, kurum!.id);
  }
});
