// M18 (G8): training/competency — cross-tenant, geçme eşikten hesaplanır
// (uydurulamaz), attestation şartı, geçen tamamlama atamayı kapatır. PGlite.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, seedTwoTenants, type TestDb } from "./helpers/pg";

let db: TestDb;
let seed: Awaited<ReturnType<typeof seedTwoTenants>>;
const A_MISAFIR = "a0000000-0000-0000-0000-000000000009";

beforeEach(async () => {
  db = await createTestDb();
  seed = await seedTwoTenants(db);
  await db.sql(`insert into auth.users (id, email) values ($1, 'misafir@demo.com')`, [A_MISAFIR]);
  await db.sql(`insert into public.profiles (id, tenant_id, role, full_name) values ($1, $2, 'denetci_misafir', 'Misafir')`, [A_MISAFIR, seed.A.tenantId]);
});

afterEach(async () => {
  await db.close();
});

async function gereksinimVeAtama(tenantId: string, esik = 70) {
  const { rows: r } = await db.sql(
    `insert into public.training_requirements (tenant_id, ad, konu, gecme_esigi) values ($1, 'KVKK Eğitimi', 'KVKK', $2) returning id`,
    [tenantId, esik],
  );
  const { rows: a } = await db.sql(
    `insert into public.training_assignments (tenant_id, requirement_id, kullanici) values ($1, $2, $3) returning id`,
    [tenantId, r[0].id, seed.A.userId],
  );
  return { requirementId: r[0].id as string, assignmentId: a[0].id as string };
}

describe("training/competency — RLS + invariant (M18)", () => {
  it("cross-tenant: A'nın gereksinimini B GÖREMEZ; misafir YAZAMAZ", async () => {
    const { requirementId } = await gereksinimVeAtama(seed.A.tenantId);
    const { rows: b } = await db.asUser(seed.B.userId, `select id from public.training_requirements where id = $1`, [requirementId]);
    expect(b).toHaveLength(0);
    await expect(
      db.asUser(A_MISAFIR, `insert into public.training_requirements (tenant_id, ad) values ($1, 'X')`, [seed.A.tenantId]),
    ).rejects.toThrow();
  });

  it("GEÇME eşikten hesaplanır: skor<eşik → gecti=false (istemci 'geçti' diyemez)", async () => {
    const { assignmentId } = await gereksinimVeAtama(seed.A.tenantId, 70);
    // İstemci gecti=true dese bile guard skor<eşikten false yapar.
    await db.sql(
      `insert into public.training_completions (tenant_id, assignment_id, skor, gecti, attestation) values ($1, $2, 50, true, true)`,
      [seed.A.tenantId, assignmentId],
    );
    const { rows } = await db.sql(`select gecti from public.training_completions where assignment_id = $1`, [assignmentId]);
    expect(rows[0].gecti).toBe(false);
    // Atama hâlâ ATANDI (geçilmedi).
    const { rows: a } = await db.sql(`select durum from public.training_assignments where id = $1`, [assignmentId]);
    expect(a[0].durum).toBe("ATANDI");
  });

  it("attestation olmadan tamamlama YASAK", async () => {
    const { assignmentId } = await gereksinimVeAtama(seed.A.tenantId);
    await expect(
      db.sql(`insert into public.training_completions (tenant_id, assignment_id, skor, attestation) values ($1, $2, 90, false)`, [seed.A.tenantId, assignmentId]),
    ).rejects.toThrow(/attestation/);
  });

  it("geçen tamamlama atamayı TAMAMLANDI yapar (yetkinlik boşluğu kapanır)", async () => {
    const { assignmentId } = await gereksinimVeAtama(seed.A.tenantId, 70);
    await db.sql(`insert into public.training_completions (tenant_id, assignment_id, skor, attestation) values ($1, $2, 85, true)`, [seed.A.tenantId, assignmentId]);
    const { rows: c } = await db.sql(`select gecti from public.training_completions where assignment_id = $1`, [assignmentId]);
    expect(c[0].gecti).toBe(true);
    const { rows: a } = await db.sql(`select durum from public.training_assignments where id = $1`, [assignmentId]);
    expect(a[0].durum).toBe("TAMAMLANDI");
  });

  it("bir atamaya İKİNCİ tamamlama eklenemez (unique)", async () => {
    const { assignmentId } = await gereksinimVeAtama(seed.A.tenantId);
    await db.sql(`insert into public.training_completions (tenant_id, assignment_id, skor, attestation) values ($1, $2, 85, true)`, [seed.A.tenantId, assignmentId]);
    await expect(
      db.sql(`insert into public.training_completions (tenant_id, assignment_id, skor, attestation) values ($1, $2, 90, true)`, [seed.A.tenantId, assignmentId]),
    ).rejects.toThrow();
  });
});
