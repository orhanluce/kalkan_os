// Dikey F, F2 (docs/adr/PR0-dikeyF-f2-kritik-hizmet-test-paketi-2026-07-21.md):
// kritik_hizmet_test_paketi_snapshots — mühürlü, append-only, tenant-scoped.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, seedTwoTenants, type TestDb } from "./helpers/pg";

let db: TestDb;
let seed: Awaited<ReturnType<typeof seedTwoTenants>>;

const PAKET_HASH = "a".repeat(64);

async function kritikHizmetEkle(tenantId: string, ad = "Ödeme Sistemi") {
  const { rows } = await db.sql(`insert into public.critical_business_services (tenant_id, ad) values ($1, $2) returning id`, [tenantId, ad]);
  return rows[0].id as string;
}

beforeEach(async () => {
  db = await createTestDb();
  seed = await seedTwoTenants(db);
});

afterEach(async () => {
  await db.close();
});

describe("kritik_hizmet_test_paketi_snapshots — tenant bütünlüğü + olusturan atfı", () => {
  it("aynı-tenant kritik hizmet için snapshot oluşturulabilir; olusturan sunucu tarafında sabitlenir", async () => {
    const hizmetId = await kritikHizmetEkle(seed.A.tenantId);
    const { rows } = await db.asUser(
      seed.A.userId,
      `insert into public.kritik_hizmet_test_paketi_snapshots (tenant_id, critical_service_id, paket, paket_hash, hesaplama_yontemi)
       values ($1, $2, $3::jsonb, $4, $5::jsonb) returning id, olusturan`,
      [seed.A.tenantId, hizmetId, JSON.stringify({ schema: "KALKAN_CRITICAL_SERVICE_TEST_PACKAGE_V1" }), PAKET_HASH, JSON.stringify({ surum: "v1" })],
    );
    expect(rows[0].olusturan).toBe(seed.A.userId);
  });

  it("cross-tenant kritik hizmete snapshot bağlanamaz (INSERT anında reddedilir)", async () => {
    const hizmetIdB = await kritikHizmetEkle(seed.B.tenantId);
    await expect(
      db.sql(
        `insert into public.kritik_hizmet_test_paketi_snapshots (tenant_id, critical_service_id, paket, paket_hash, hesaplama_yontemi)
         values ($1, $2, '{}'::jsonb, $3, '{}'::jsonb)`,
        [seed.A.tenantId, hizmetIdB, PAKET_HASH],
      ),
    ).rejects.toThrow(/cross-tenant/i);
  });

  it("service_role (RLS-bypass) cross-tenant guard'ı atlayamaz", async () => {
    const hizmetIdB = await kritikHizmetEkle(seed.B.tenantId);
    // db.sql superuser: RLS'i bypass eder — trigger yine de reddetmeli.
    await expect(
      db.sql(
        `insert into public.kritik_hizmet_test_paketi_snapshots (tenant_id, critical_service_id, paket, paket_hash, hesaplama_yontemi)
         values ($1, $2, '{}'::jsonb, $3, '{}'::jsonb)`,
        [seed.A.tenantId, hizmetIdB, PAKET_HASH],
      ),
    ).rejects.toThrow(/cross-tenant/i);
  });

  it("olmayan critical_service_id reddedilir (düz FK)", async () => {
    await expect(
      db.sql(
        `insert into public.kritik_hizmet_test_paketi_snapshots (tenant_id, critical_service_id, paket, paket_hash, hesaplama_yontemi)
         values ($1, $2, '{}'::jsonb, $3, '{}'::jsonb)`,
        [seed.A.tenantId, "00000000-0000-0000-0000-000000000099", PAKET_HASH],
      ),
    ).rejects.toThrow();
  });

  it("B kiracısı A'nın snapshot'ını GÖREMEZ", async () => {
    const hizmetId = await kritikHizmetEkle(seed.A.tenantId);
    await db.asUser(
      seed.A.userId,
      `insert into public.kritik_hizmet_test_paketi_snapshots (tenant_id, critical_service_id, paket, paket_hash, hesaplama_yontemi)
       values ($1, $2, '{}'::jsonb, $3, '{}'::jsonb)`,
      [seed.A.tenantId, hizmetId, PAKET_HASH],
    );
    const { rows } = await db.asUser(seed.B.userId, `select id from public.kritik_hizmet_test_paketi_snapshots`);
    expect(rows).toHaveLength(0);
  });

  it("paket_hash formatı zorlanır (64 hex karakter)", async () => {
    const hizmetId = await kritikHizmetEkle(seed.A.tenantId);
    await expect(
      db.sql(
        `insert into public.kritik_hizmet_test_paketi_snapshots (tenant_id, critical_service_id, paket, paket_hash, hesaplama_yontemi)
         values ($1, $2, '{}'::jsonb, 'kisa-hash', '{}'::jsonb)`,
        [seed.A.tenantId, hizmetId],
      ),
    ).rejects.toThrow();
  });
});

describe("kritik_hizmet_test_paketi_snapshots — immutability (append-only)", () => {
  it("UPDATE service_role dahil HER ZAMAN reddedilir", async () => {
    const hizmetId = await kritikHizmetEkle(seed.A.tenantId);
    const { rows } = await db.sql(
      `insert into public.kritik_hizmet_test_paketi_snapshots (tenant_id, critical_service_id, paket, paket_hash, hesaplama_yontemi)
       values ($1, $2, '{}'::jsonb, $3, '{}'::jsonb) returning id`,
      [seed.A.tenantId, hizmetId, PAKET_HASH],
    );
    await expect(
      db.sql(`update public.kritik_hizmet_test_paketi_snapshots set paket_hash = $1 where id = $2`, ["b".repeat(64), rows[0].id]),
    ).rejects.toThrow(/degistirilemez/i);
  });
});

describe("kritik_hizmet_test_paketi_snapshots — audit", () => {
  it("INSERT audit_log'a düşer", async () => {
    const hizmetId = await kritikHizmetEkle(seed.A.tenantId);
    await db.asUser(
      seed.A.userId,
      `insert into public.kritik_hizmet_test_paketi_snapshots (tenant_id, critical_service_id, paket, paket_hash, hesaplama_yontemi)
       values ($1, $2, '{}'::jsonb, $3, '{}'::jsonb)`,
      [seed.A.tenantId, hizmetId, PAKET_HASH],
    );
    const { rows } = await db.sql(
      `select count(*)::int as n from public.audit_log where eylem = 'kritik_hizmet_test_paketi_olusturuldu' and tenant_id = $1`,
      [seed.A.tenantId],
    );
    expect(rows[0].n).toBe(1);
  });
});
