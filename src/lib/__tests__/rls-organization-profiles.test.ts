// V2 PR-2 (ADR-V2-1): organization_profiles — kiracı izolasyonu, rol-yazma
// sınırı, scope-recalc outbox, audit. Gerçek migration'lara karşı PGlite.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, seedTwoTenants, type TestDb } from "./helpers/pg";

let db: TestDb;
let seed: Awaited<ReturnType<typeof seedTwoTenants>>;
// Aynı kiracıda denetçi-misafir (yazamamalı).
const MISAFIR = "a0000000-0000-0000-0000-000000000009";

beforeEach(async () => {
  db = await createTestDb();
  seed = await seedTwoTenants(db);
  await db.sql(`insert into auth.users (id, email) values ($1, 'misafir@demo.com')`, [MISAFIR]);
  await db.sql(
    `insert into public.profiles (id, tenant_id, role, full_name) values ($1, $2, 'denetci_misafir', 'Misafir')`,
    [MISAFIR, seed.A.tenantId],
  );
});

afterEach(async () => {
  await db.close();
});

describe("organization_profiles RLS + rol sınırı", () => {
  it("admin profil oluşturabilir; kiracı kendi profilini görür, başkasınınkini göremez", async () => {
    await db.asUser(
      seed.A.userId,
      `insert into public.organization_profiles (tenant_id, organization_type) values ($1, 'CORPORATE_FINANCE')`,
      [seed.A.tenantId],
    );
    const { rows: kendi } = await db.asUser(
      seed.A.userId,
      `select organization_type from public.organization_profiles where tenant_id = $1`,
      [seed.A.tenantId],
    );
    expect(kendi[0].organization_type).toBe("CORPORATE_FINANCE");
    const { rows: baska } = await db.asUser(
      seed.B.userId,
      `select tenant_id from public.organization_profiles where tenant_id = $1`,
      [seed.A.tenantId],
    );
    expect(baska).toHaveLength(0);
  });

  it("denetçi-misafir profil YAZAMAZ (rol RLS'te de zorlanır)", async () => {
    await expect(
      db.asUser(
        MISAFIR,
        `insert into public.organization_profiles (tenant_id, organization_type) values ($1, 'CORPORATE_FINANCE')`,
        [seed.A.tenantId],
      ),
    ).rejects.toThrow();
  });

  it("başka kiracı adına profil yazılamaz (with check)", async () => {
    await expect(
      db.asUser(
        seed.A.userId,
        `insert into public.organization_profiles (tenant_id, organization_type) values ($1, 'CORPORATE_FINANCE')`,
        [seed.B.tenantId],
      ),
    ).rejects.toThrow();
  });

  it("geçersiz organization_type check ile reddedilir", async () => {
    await expect(
      db.asUser(
        seed.A.userId,
        `insert into public.organization_profiles (tenant_id, organization_type) values ($1, 'BANKA')`,
        [seed.A.tenantId],
      ),
    ).rejects.toThrow();
  });
});

describe("organization_profiles scope-recalc + audit", () => {
  it("organization_type değişimi outbox olayı + audit üretir; alakasız alan değişimi ÜRETMEZ", async () => {
    await db.sql(
      `insert into public.organization_profiles (tenant_id, organization_type) values ($1, 'CORPORATE_FINANCE')`,
      [seed.A.tenantId],
    );
    // Alakasız alan (sektör) değişimi — scope olayı YOK.
    await db.asUser(
      seed.A.userId,
      `update public.organization_profiles set operating_sectors = '{enerji}' where tenant_id = $1`,
      [seed.A.tenantId],
    );
    let { rows } = await db.sql(
      `select count(*)::int as n from public.sod_outbox where event_type = 'ORGANIZATION_SCOPE_DEGISTI'`,
    );
    expect(rows[0].n).toBe(0);

    // organization_type değişimi — scope olayı + audit VAR.
    await db.asUser(
      seed.A.userId,
      `update public.organization_profiles set organization_type = 'MIXED_GROUP' where tenant_id = $1`,
      [seed.A.tenantId],
    );
    ({ rows } = await db.sql(
      `select payload from public.sod_outbox where event_type = 'ORGANIZATION_SCOPE_DEGISTI'`,
    ));
    expect(rows).toHaveLength(1);
    expect((rows[0].payload as { organization_type: string }).organization_type).toBe("MIXED_GROUP");

    const { rows: audit } = await db.sql(
      `select 1 from public.audit_log where eylem = 'organizasyon_profili_degisti' and tenant_id = $1`,
      [seed.A.tenantId],
    );
    expect(audit).toHaveLength(1);
  });

  it("finance_department_enabled değişimi de scope olayı üretir", async () => {
    await db.sql(
      `insert into public.organization_profiles (tenant_id, organization_type, finance_department_enabled)
       values ($1, 'CORPORATE_FINANCE', false)`,
      [seed.A.tenantId],
    );
    await db.asUser(
      seed.A.userId,
      `update public.organization_profiles set finance_department_enabled = true where tenant_id = $1`,
      [seed.A.tenantId],
    );
    const { rows } = await db.sql(
      `select count(*)::int as n from public.sod_outbox where event_type = 'ORGANIZATION_SCOPE_DEGISTI'`,
    );
    expect(rows[0].n).toBe(1);
  });
});
