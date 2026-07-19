// M17 sonraki dilim son madde: WORM export mührü (ROADMAP §1.29). Bu dosyanın
// derdi simulasyon manifestiyle aynı soru: mühür, mühürlenen şeyi koruyabiliyor
// mu? PGlite.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, seedTwoTenants, type TestDb } from "./helpers/pg";

let db: TestDb;
let seed: Awaited<ReturnType<typeof seedTwoTenants>>;
let engagementId: string;
let exportId: string;

const HASH_A = "a".repeat(64);

beforeEach(async () => {
  db = await createTestDb();
  seed = await seedTwoTenants(db);
  const { rows: e } = await db.sql(
    `insert into public.audit_engagements (tenant_id, ad, risk_seviyesi) values ($1, 'BS Denetimi', 'YUKSEK') returning id`,
    [seed.A.tenantId],
  );
  engagementId = e[0].id as string;
  const { rows: x } = await db.sql(
    `insert into public.audit_worm_exports (tenant_id, engagement_id, paket, paket_hash) values ($1, $2, $3, $4) returning id`,
    [seed.A.tenantId, engagementId, JSON.stringify({ schema: "KALKAN_AUDIT_WORM_EXPORT_V1" }), HASH_A],
  );
  exportId = x[0].id as string;
});

afterEach(async () => {
  await db.close();
});

describe("audit_worm_exports — kiracı izolasyonu (kural 1)", () => {
  it("kiracı kendi mührünü görür", async () => {
    const { rows } = await db.asUser(seed.A.userId, `select id from public.audit_worm_exports where id = $1`, [exportId]);
    expect(rows).toHaveLength(1);
  });

  it("başka kiracı mührü göremez", async () => {
    const { rows } = await db.asUser(seed.B.userId, `select id from public.audit_worm_exports where id = $1`, [exportId]);
    expect(rows).toHaveLength(0);
  });
});

describe("audit_worm_exports — WORM değişmezlik", () => {
  it("mühür GÜNCELLENEMEZ — service_role bile", async () => {
    await expect(
      db.sql(`update public.audit_worm_exports set paket_hash = $1 where id = $2`, ["b".repeat(64), exportId]),
    ).rejects.toThrow(/degistirilemez/i);
  });

  it("paket içeriğini sessizce düzeltmek de engellenir", async () => {
    await expect(
      db.sql(`update public.audit_worm_exports set paket = $1 where id = $2`, [JSON.stringify({ kurcalanmis: true }), exportId]),
    ).rejects.toThrow(/degistirilemez/i);
  });

  it("kullanıcı kendi mührünü YAZAMAZ — mühürleme rota/service_role işidir", async () => {
    await expect(
      db.asUser(
        seed.A.userId,
        `insert into public.audit_worm_exports (tenant_id, engagement_id, paket, paket_hash) values ($1, $2, '{}', $3)`,
        [seed.A.tenantId, engagementId, "c".repeat(64)],
      ),
    ).rejects.toThrow();
  });

  it("aynı hash İKİNCİ kez mühürlenemez (unique)", async () => {
    await expect(
      db.sql(`insert into public.audit_worm_exports (tenant_id, engagement_id, paket, paket_hash) values ($1, $2, '{}', $3)`, [
        seed.A.tenantId,
        engagementId,
        HASH_A,
      ]),
    ).rejects.toThrow();
  });

  it("denetim işi silinince mühür cascade ile gider", async () => {
    await db.sql(`delete from public.audit_engagements where id = $1`, [engagementId]);
    const { rows } = await db.sql(`select id from public.audit_worm_exports where id = $1`, [exportId]);
    expect(rows).toHaveLength(0);
  });
});
