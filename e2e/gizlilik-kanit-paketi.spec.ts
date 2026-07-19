import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { E2E_KURUM_ADI, girisYap } from "./helpers";

// M36 sonraki dilim: DSAR karşılanma kanıt paketi — TAMAMLANDI DSAR mühürlenir,
// şeffaflık defterine (G3) yazılır, BAĞIMSIZ offline doğrulayıcı VERIFIED/FAILED.

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env eksik (.env.local).");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function temizle(db: ReturnType<typeof admin>, tenantId: string) {
  await db.from("artifact_ledger_links").delete().eq("tenant_id", tenantId);
  await db.from("ledger_outbox").delete().eq("tenant_id", tenantId);
  await db.from("dsar_fulfillment_packages").delete().eq("tenant_id", tenantId);
  await db.from("transparency_ledger_entries").delete().eq("tenant_id", tenantId);
  await db.from("data_subject_requests").delete().eq("tenant_id", tenantId).like("veri_sahibi_maskeli", "e2e%");
}

test("gizlilik: DSAR kanıt paketi mühürlenir + bağımsız offline doğrulanır", async ({ page }) => {
  test.setTimeout(120_000);
  const db = admin();
  const { data: kurum } = await db.from("tenants").select("id").eq("name", E2E_KURUM_ADI).single();
  await temizle(db, kurum!.id);

  // TAMAMLANDI bir DSAR kur (kimlik doğrulanmış — guard tamamlandi_at doldurur).
  const { data: dsar } = await db
    .from("data_subject_requests")
    .insert({
      tenant_id: kurum!.id,
      tur: "ERISIM",
      veri_sahibi_maskeli: "e2e-k***@x.com",
      veri_sahibi_hash: "a".repeat(64),
      kimlik_dogrulandi: true,
      durum: "TAMAMLANDI",
    })
    .select("id")
    .single();
  const dsarId = dsar!.id as string;

  try {
    await girisYap(page);
    await page.goto("/gizlilik");

    // Kategori gir + mühürle. Mühür ARTIK ASENKRON (outbox+drenaj) — bu rota
    // aynı istekte drenajı da tetikler, bu yüzden UI hızla ANCHORED gösterir.
    await page.getByLabel(`${dsarId} açıklanan kategoriler`).fill("kimlik, iletisim, islem_gecmisi");
    await page.getByRole("button", { name: "Kanıt Paketi Mühürle" }).click();
    await expect(page.getByText(/Kanıt paketi ✓ mühürlü/)).toBeVisible();

    // DB: paket (artık ledger_entry_id/leaf_index taşımıyor — GENEL artifact_
    // ledger_links tek doğruluk kaynağı) + manifest hash + defter kaydı bağı.
    const { data: pkg } = await db
      .from("dsar_fulfillment_packages")
      .select("id, manifest_hash, aciklanan_kategoriler")
      .eq("dsar_id", dsarId)
      .single();
    expect(pkg!.manifest_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(pkg!.aciklanan_kategoriler).toContain("islem_gecmisi");
    const { data: link } = await db
      .from("artifact_ledger_links")
      .select("ledger_entry_id")
      .eq("artifact_table", "dsar_fulfillment_packages")
      .eq("artifact_id", pkg!.id)
      .single();
    const { data: entry } = await db
      .from("transparency_ledger_entries")
      .select("statement_kind, statement_hash")
      .eq("id", link!.ledger_entry_id)
      .single();
    expect(entry!.statement_kind).toBe("DSAR_FULFILLMENT");
    expect(entry!.statement_hash).toBe(pkg!.manifest_hash); // ifade tam bu manifesti işaret ediyor

    // Yaprak deftere yazıldı (mühürlendi) ama KAPSAYAN bir ağaç başı (STH)
    // henüz yok — G3'ün kendi deseni (bkz. seffaflik.spec.ts): STH ayrı,
    // kasıtlı bir yayın adımıdır. Kapsama makbuzu için bunu yayınla.
    const checkpoint = await page.request.post("/api/seffaflik/checkpoint");
    expect(checkpoint.ok()).toBeTruthy();

    // Paketi oturumlu istekle çek → BAĞIMSIZ offline doğrulayıcı.
    const resp = await page.request.get(`/api/gizlilik/dsar/${dsarId}/kanit-paketi`);
    expect(resp.status()).toBe(200);
    const paket = await resp.json();

    const { mkdtempSync, writeFileSync, rmSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const { execFileSync } = await import("node:child_process");

    const klasor = mkdtempSync(join(tmpdir(), "kalkan-dsar-"));
    try {
      const yol = join(klasor, "paket.json");
      writeFileSync(yol, JSON.stringify(paket));

      const cikti = execFileSync("npx", ["tsx", "scripts/verify-dsar-paketi.ts", yol], {
        encoding: "utf8",
        shell: process.platform === "win32",
      });
      expect(cikti).toContain("VERIFIED");

      // Manifest kurcala (kategori ekle) → hash düşer → FAILED.
      const kurcali = { ...paket, manifest: { ...paket.manifest, aciklananKategoriler: [...paket.manifest.aciklananKategoriler, "konum"] } };
      writeFileSync(yol, JSON.stringify(kurcali));
      let kod = 0;
      let kurcaCikti = "";
      try {
        execFileSync("npx", ["tsx", "scripts/verify-dsar-paketi.ts", yol], {
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
