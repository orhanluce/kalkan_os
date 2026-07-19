import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { E2E_KURUM_ADI, girisYap } from "./helpers";

// M18 (G8): eğitim gereksinimi + atama + tamamlama (geçme skordan hesaplanır,
// uydurulamaz; attestation şartı) + yetkinlik boşluğu. Gerçek Chromium.

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env eksik (.env.local).");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function temizle(db: ReturnType<typeof admin>, tenantId: string) {
  await db.from("training_requirements").delete().eq("tenant_id", tenantId).like("ad", "E2E-EG%");
}

test("eğitim: gereksinim → ata → skor<eşik kalır, skor≥eşik geçer (attestation)", async ({ page }) => {
  test.setTimeout(120_000);
  const db = admin();
  const { data: kurum } = await db.from("tenants").select("id").eq("name", E2E_KURUM_ADI).single();
  await temizle(db, kurum!.id);

  try {
    await girisYap(page);
    await page.goto("/egitim");

    // 1) İki gereksinim (eşik 70).
    await page.getByLabel("Ad").fill("E2E-EG KVKK");
    await page.getByLabel("Geçme eşiği").fill("70");
    await page.getByRole("button", { name: "Gereksinim Ekle" }).click();
    await expect(page.getByText("E2E-EG KVKK")).toBeVisible();
    await page.getByLabel("Ad").fill("E2E-EG AI");
    await page.getByRole("button", { name: "Gereksinim Ekle" }).click();
    await expect(page.getByText("E2E-EG AI")).toBeVisible();

    // 2) İkisini de bana ata (DB üzerinden — UI atama race'i test dışı).
    const { data: reqRows } = await db.from("training_requirements").select("id, ad").eq("tenant_id", kurum!.id).like("ad", "E2E-EG%");
    const { data: prof } = await db.from("profiles").select("id").eq("tenant_id", kurum!.id).eq("role", "admin").single();
    for (const r of reqRows ?? []) {
      await db.from("training_assignments").insert({ tenant_id: kurum!.id, requirement_id: r.id, kullanici: prof!.id });
    }
    await page.reload();

    // 3) KVKK'yı 50 ile tamamla → KALDI (geçme eşikten hesaplanır).
    const kvkkSatir = page.getByRole("row").filter({ hasText: "E2E-EG KVKK" });
    await kvkkSatir.getByLabel("E2E-EG KVKK skor").fill("50");
    await expect(kvkkSatir.getByRole("button", { name: "Tamamla (attestation)" })).toBeEnabled();
    await kvkkSatir.getByRole("button", { name: "Tamamla (attestation)" }).click();
    await expect(page.getByRole("row").filter({ hasText: "E2E-EG KVKK" }).getByText(/Kaldı \(50\)/)).toBeVisible();

    // 4) AI'yı 90 ile tamamla → Geçti + TAMAMLANDI.
    const aiSatir = page.getByRole("row").filter({ hasText: "E2E-EG AI" });
    await aiSatir.getByLabel("E2E-EG AI skor").fill("90");
    await expect(aiSatir.getByRole("button", { name: "Tamamla (attestation)" })).toBeEnabled();
    await aiSatir.getByRole("button", { name: "Tamamla (attestation)" }).click();
    await expect(page.getByRole("row").filter({ hasText: "E2E-EG AI" }).getByText(/Geçti \(90\)/)).toBeVisible();

    // DB: KVKK gecti=false (skor<eşik, istemci uyduramaz); AI gecti=true.
    const { data: reqs } = await db.from("training_requirements").select("id, ad").eq("tenant_id", kurum!.id).like("ad", "E2E-EG%");
    const kvkkId = reqs!.find((r) => r.ad === "E2E-EG KVKK")!.id;
    const { data: kvkkAsg } = await db.from("training_assignments").select("id").eq("requirement_id", kvkkId).single();
    const { data: kvkkComp } = await db.from("training_completions").select("gecti, attestation").eq("assignment_id", kvkkAsg!.id).single();
    expect(kvkkComp!.gecti).toBe(false);
    expect(kvkkComp!.attestation).toBe(true);

    // 5) Retraining otomasyonu (M18 sonraki dilim, ROADMAP §1.30): periyodik
    // gereksinim + eski tamamlanma → cron çağrısı YENİ bir ATANDI doğurur.
    const { data: periyotReq } = await db
      .from("training_requirements")
      .insert({ tenant_id: kurum!.id, ad: "E2E-EG Periyodik", gecme_esigi: 70, periyot_gun: 30 })
      .select("id")
      .single();
    const { data: periyotAsg } = await db
      .from("training_assignments")
      .insert({ tenant_id: kurum!.id, requirement_id: periyotReq!.id, kullanici: prof!.id })
      .select("id")
      .single();
    await db.from("training_completions").insert({ tenant_id: kurum!.id, assignment_id: periyotAsg!.id, skor: 90, attestation: true });
    await db.from("training_completions").update({ tamamlandi_at: "2020-01-01T00:00:00Z" }).eq("assignment_id", periyotAsg!.id);

    await page.reload();
    const periyotSatirOnce = page.getByRole("row").filter({ hasText: "E2E-EG Periyodik" });
    await expect(periyotSatirOnce.getByText(/Yenileme gecikti/)).toBeVisible();

    const { error: rpcHata } = await db.rpc("egitim_periyot_yenile");
    expect(rpcHata).toBeNull();

    const { data: yenilenmisAtamalar } = await db.from("training_assignments").select("durum").eq("requirement_id", periyotReq!.id);
    expect(yenilenmisAtamalar!.map((a) => a.durum).sort()).toEqual(["ATANDI", "TAMAMLANDI"]);

    await page.reload();
    const periyotSatirlar = page.getByRole("row").filter({ hasText: "E2E-EG Periyodik" });
    await expect(periyotSatirlar).toHaveCount(2);
    await expect(page.getByText("ATANDI").first()).toBeVisible();
  } finally {
    await temizle(db, kurum!.id);
  }
});
