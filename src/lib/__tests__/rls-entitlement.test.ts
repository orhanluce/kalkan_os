// V2 PR-2c (ADR-V2-3): plan/entitlement RLS — kiracı kendi aboneliğini okur
// ama YAZAMAZ (forged plan claim reddi); downgrade veri SİLMEZ; append-only
// subscription_events. Gerçek migration'lara karşı PGlite (seed dahil).
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, seedTwoTenants, type TestDb } from "./helpers/pg";

let db: TestDb;
let seed: Awaited<ReturnType<typeof seedTwoTenants>>;

async function planSurumId(kod: string): Promise<string> {
  const { rows } = await db.sql(
    `select pv.id from public.plan_versions pv
     join public.product_plans p on p.id = pv.plan_id
     where p.kod = $1 and pv.surum = 1`,
    [kod],
  );
  return rows[0].id as string;
}

/** service_role (mock billing) abonelik atar. */
async function abonelikAta(tenantId: string, planKod: string) {
  const pvId = await planSurumId(planKod);
  await db.sql(
    `insert into public.tenant_subscriptions (tenant_id, plan_version_id, durum) values ($1, $2, 'aktif')
     on conflict (tenant_id) do update set plan_version_id = excluded.plan_version_id, durum = 'aktif'`,
    [tenantId, pvId],
  );
  await db.sql(
    `insert into public.subscription_events (tenant_id, event_type, plan_version_id) values ($1, 'PROVISIONED', $2)`,
    [tenantId, pvId],
  );
}

beforeEach(async () => {
  db = await createTestDb();
  seed = await seedTwoTenants(db);
});

afterEach(async () => {
  await db.close();
});

describe("plan kataloğu seed + RLS", () => {
  it("5 plan × v1 sürüm seed edildi; authenticated okur", async () => {
    const { rows } = await db.asUser(seed.A.userId, `select count(*)::int as n from public.product_plans`);
    expect(rows[0].n).toBe(5);
    const { rows: pv } = await db.asUser(
      seed.A.userId,
      `select yetkiler from public.plan_versions pv join public.product_plans p on p.id = pv.plan_id where p.kod = 'CFO_STARTER'`,
    );
    expect((pv[0].yetkiler as { sod: string }).sod).toBe("gorunum");
  });
});

describe("abonelik RLS — forged plan claim reddi", () => {
  it("kiracı KENDİ aboneliğini okur, başkasınınkini göremez", async () => {
    await abonelikAta(seed.A.tenantId, "CFO_PRO");
    const { rows: kendi } = await db.asUser(
      seed.A.userId,
      `select durum from public.tenant_subscriptions where tenant_id = $1`,
      [seed.A.tenantId],
    );
    expect(kendi).toHaveLength(1);
    const { rows: baska } = await db.asUser(
      seed.B.userId,
      `select durum from public.tenant_subscriptions where tenant_id = $1`,
      [seed.A.tenantId],
    );
    expect(baska).toHaveLength(0);
  });

  it("istemci KENDİ planını YÜKSELTEMEZ (insert/update revoke — bypass DB'de kapalı)", async () => {
    const proId = await planSurumId("CFO_PRO");
    // A, kendine Pro aboneliği yazmayı deniyor (entitlement bypass).
    await expect(
      db.asUser(
        seed.A.userId,
        `insert into public.tenant_subscriptions (tenant_id, plan_version_id) values ($1, $2)`,
        [seed.A.tenantId, proId],
      ),
    ).rejects.toThrow();

    // Var olan Starter aboneliği Pro'ya UPDATE ile de yükseltilemez.
    await abonelikAta(seed.A.tenantId, "CFO_STARTER");
    await expect(
      db.asUser(
        seed.A.userId,
        `update public.tenant_subscriptions set plan_version_id = $2 where tenant_id = $1`,
        [seed.A.tenantId, proId],
      ),
    ).rejects.toThrow();

    // subscription_events da istemciden yazılamaz.
    await expect(
      db.asUser(
        seed.A.userId,
        `insert into public.subscription_events (tenant_id, event_type) values ($1, 'UPGRADED')`,
        [seed.A.tenantId],
      ),
    ).rejects.toThrow();
  });
});

describe("downgrade veri kaybı YOK", () => {
  it("Pro'dan Starter'a düşünce kiracının SoD verisi DURUR (sadece yetki daralır)", async () => {
    await abonelikAta(seed.A.tenantId, "CFO_PRO");
    // Kiracının bir SoD kuralı olsun.
    await db.sql(`insert into public.sod_kurallari (tenant_id, kod, ad) values ($1, 'K1', 'Kural')`, [
      seed.A.tenantId,
    ]);

    // service_role downgrade (mock billing): Starter'a düş + event.
    await abonelikAta(seed.A.tenantId, "CFO_STARTER");

    // Veri SİLİNMEDİ — kural hâlâ orada (yalnız değerlendirme yetkisi daraldı,
    // o rota katmanında; şema veri silmez).
    const { rows } = await db.sql(`select count(*)::int as n from public.sod_kurallari where tenant_id = $1`, [
      seed.A.tenantId,
    ]);
    expect(rows[0].n).toBe(1);

    // Aktif plan artık Starter (sod: gorunum).
    const { rows: sub } = await db.sql(
      `select pv.yetkiler from public.tenant_subscriptions s
       join public.plan_versions pv on pv.id = s.plan_version_id where s.tenant_id = $1`,
      [seed.A.tenantId],
    );
    expect((sub[0].yetkiler as { sod: string }).sod).toBe("gorunum");

    // subscription_events downgrade izini taşır (append-only — provision + provision).
    const { rows: ev } = await db.sql(
      `select count(*)::int as n from public.subscription_events where tenant_id = $1`,
      [seed.A.tenantId],
    );
    expect(ev[0].n).toBeGreaterThanOrEqual(2);
  });
});
