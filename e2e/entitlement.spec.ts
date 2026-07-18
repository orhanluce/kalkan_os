import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { E2E_KURUM_ADI, girisYap } from "./helpers";

// V2 PR-2c (ADR-V2-3, V2 §11): entitlement SERVER-SIDE zorlaması.
// Starter planındaki kiracı SoD değerlendirmesini SUNUCUDA çalıştıramaz (402);
// Pro'ya yükseltince çalışır. UI gizleme değil, gerçek server kapısı test edilir.
// Gerçek Chromium + gerçek Supabase.

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env eksik (.env.local).");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function planSurumId(db: ReturnType<typeof admin>, kod: string): Promise<string> {
  const { data } = await db
    .from("plan_versions")
    .select("id, product_plans!inner(kod)")
    .eq("surum", 1)
    .eq("product_plans.kod", kod)
    .single();
  return (data as { id: string }).id;
}

async function abonelikAta(db: ReturnType<typeof admin>, tenantId: string, kod: string) {
  const pvId = await planSurumId(db, kod);
  await db.from("tenant_subscriptions").upsert(
    { tenant_id: tenantId, plan_version_id: pvId, durum: "aktif" },
    { onConflict: "tenant_id" },
  );
  await db.from("subscription_events").insert({ tenant_id: tenantId, event_type: "PROVISIONED", plan_version_id: pvId });
}

test("entitlement: Starter SoD değerlendirmeyi SUNUCUDA çalıştıramaz; Pro çalıştırır", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const db = admin();
  const { data: kurum } = await db.from("tenants").select("id").eq("name", E2E_KURUM_ADI).single();

  await girisYap(page);
  try {
    // 1) Starter planı ata → server 402 döner (UI'da gizli olsa da API reddeder).
    await abonelikAta(db, kurum!.id, "CFO_STARTER");
    const res402 = await page.request.post("/api/sod/degerlendir");
    expect(res402.status()).toBe(402);
    expect((await res402.json()).kod).toBe("ENTITLEMENT_YOK");

    // 2) Pro'ya yükselt → aynı istek geçer (200).
    await abonelikAta(db, kurum!.id, "CFO_PRO");
    const res200 = await page.request.post("/api/sod/degerlendir");
    expect(res200.status()).toBe(200);
  } finally {
    // Temizlik: aboneliği kaldır (diğer testler VARSAYILAN permissive ile koşsun).
    await db.from("tenant_subscriptions").delete().eq("tenant_id", kurum!.id);
    await db.from("subscription_events").delete().eq("tenant_id", kurum!.id);
  }
});
