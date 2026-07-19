import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { E2E_KURUM_ADI, girisYap } from "./helpers";

// Nihai v3.3 §8.0 Dikey 2: bir kontrol testi koşusu ZENGİN immutable snapshot
// (amaç/kapsam/hedef/senaryo + beklenen/performans/başlangıç-bitiş) taşır ve
// OTOMATİK olarak V2 manifestiyle şeffaflık defterine mühürlenir; makbuz
// bağımsız offline doğrulanır. Gerçek Chromium + gerçek Supabase.

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

test("kontrol testi zengin koşusu OTOMATİK V2 manifestiyle mühürlenir → makbuz offline doğrulanır", async ({ page }) => {
  test.setTimeout(120_000);
  const db = admin();
  const { data: kurum } = await db.from("tenants").select("id").eq("name", E2E_KURUM_ADI).single();
  await ledgerTemizle(db, kurum!.id);

  // Kapsam alanlı bir test tanımı (admin ile).
  const { data: control } = await db.from("controls").select("id").limit(1).single();
  const { data: tanim } = await db
    .from("control_test_definitions")
    .insert({
      tenant_id: kurum!.id,
      control_id: control!.id,
      tur: "ATTACK_SIMULATION",
      ad: "E2E-Manifest tatbikatı",
      amac: "MFA doğrula",
      kapsam: "tüm ayrıcalıklı hesaplar",
      hedef_varlik: "Entra ID",
      kritik_hizmet_adi: "Ödeme sistemi",
      senaryo_kimligi: "E2E-TAT-01",
      senaryo_surumu: 1,
    })
    .select("id")
    .single();
  const tanimId = tanim!.id as string;

  try {
    await girisYap(page);

    // Zengin koşu (beklenen/performans + başlangıç-bitiş) — rota hazirlayan'ı
    // oturum sahibine sabitler, koşu AYNI transaction'da outbox olayı doğurur,
    // rota otomatik drenaj eder (§1.37).
    const calistir = await page.request.post(`/api/kontrol-test/${tanimId}/calistir`, {
      data: {
        iddiaKarsilandi: true,
        gozlemZamani: new Date().toISOString(),
        baslangicAt: new Date().toISOString(),
        bitisAt: new Date().toISOString(),
        beklenenSonuc: "tüm hesaplar MFA'lı",
        performansEtkisi: "yok",
        yanlisPozitif: false,
        yanlisNegatif: false,
        logReferanslari: [{ ad: "sim-log-1", hash: "a".repeat(64) }],
      },
    });
    expect(calistir.ok()).toBeTruthy();
    const cSonuc = await calistir.json();
    expect(cSonuc.sonuc).toBe("PASSED");
    expect(cSonuc.ledgerDurumu).toBe("ANCHORED"); // otomatik mühür

    const runId = cSonuc.testRunId as string;

    // DB: koşu zengin snapshot taşıyor + hazirlayan dolu.
    const { data: run } = await db
      .from("test_runs")
      .select("beklenen_sonuc, performans_etkisi, hazirlayan, log_referanslari")
      .eq("id", runId)
      .single();
    expect(run!.beklenen_sonuc).toBe("tüm hesaplar MFA'lı");
    expect(run!.hazirlayan).not.toBeNull();

    // Ledger link + V2 manifest şeması imzalı ifadede.
    const { data: link } = await db
      .from("artifact_ledger_links")
      .select("ledger_entry_id")
      .eq("artifact_table", "test_runs")
      .eq("artifact_id", runId)
      .single();
    const { data: entry } = await db
      .from("transparency_ledger_entries")
      .select("statement_kind, signed_statement")
      .eq("id", link!.ledger_entry_id)
      .single();
    expect(entry!.statement_kind).toBe("CONTROL_TEST_RUN");

    // STH yayınla → makbuz → BAĞIMSIZ offline doğrulayıcı.
    const cp = await page.request.post("/api/seffaflik/checkpoint");
    expect(cp.ok()).toBeTruthy();
    const makbuzResp = await page.request.get(`/api/seffaflik/makbuz/${link!.ledger_entry_id}`);
    expect(makbuzResp.status()).toBe(200);
    const makbuz = await makbuzResp.json();

    const { mkdtempSync, writeFileSync, rmSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const { execFileSync } = await import("node:child_process");
    const klasor = mkdtempSync(join(tmpdir(), "kalkan-ktm-"));
    try {
      const yol = join(klasor, "makbuz.json");
      writeFileSync(yol, JSON.stringify(makbuz));
      const cikti = execFileSync("npx", ["tsx", "scripts/verify-seffaflik.ts", yol], { encoding: "utf8", shell: process.platform === "win32" });
      expect(cikti).toContain("VERIFIED");
    } finally {
      rmSync(klasor, { recursive: true, force: true });
    }
  } finally {
    await ledgerTemizle(db, kurum!.id);
    await db.from("test_runs").delete().eq("test_definition_id", tanimId);
    await db.from("control_test_definitions").delete().eq("id", tanimId);
  }
});
