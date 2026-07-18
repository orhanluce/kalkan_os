// V2 PR-3b (ADR-V2-5): activation_events kiracı izolasyonu + geçerli tür.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, seedTwoTenants, type TestDb } from "./helpers/pg";

let db: TestDb;
let seed: Awaited<ReturnType<typeof seedTwoTenants>>;

beforeEach(async () => {
  db = await createTestDb();
  seed = await seedTwoTenants(db);
});

afterEach(async () => {
  await db.close();
});

describe("activation_events RLS", () => {
  it("kiracı kendi olayını yazar/okur; başkasınınkini göremez", async () => {
    await db.asUser(
      seed.A.userId,
      `insert into public.activation_events (tenant_id, event_type) values ($1, 'PROFILE_COMPLETED')`,
      [seed.A.tenantId],
    );
    const { rows: kendi } = await db.asUser(
      seed.A.userId,
      `select event_type from public.activation_events where tenant_id = $1`,
      [seed.A.tenantId],
    );
    expect(kendi).toHaveLength(1);
    const { rows: baska } = await db.asUser(
      seed.B.userId,
      `select id from public.activation_events where tenant_id = $1`,
      [seed.A.tenantId],
    );
    expect(baska).toHaveLength(0);
  });

  it("başka kiracı adına olay yazılamaz (with check)", async () => {
    await expect(
      db.asUser(
        seed.A.userId,
        `insert into public.activation_events (tenant_id, event_type) values ($1, 'FIRST_EVIDENCE')`,
        [seed.B.tenantId],
      ),
    ).rejects.toThrow();
  });

  it("geçersiz event_type check ile reddedilir", async () => {
    await expect(
      db.asUser(
        seed.A.userId,
        `insert into public.activation_events (tenant_id, event_type) values ($1, 'RANDOM')`,
        [seed.A.tenantId],
      ),
    ).rejects.toThrow();
  });
});
