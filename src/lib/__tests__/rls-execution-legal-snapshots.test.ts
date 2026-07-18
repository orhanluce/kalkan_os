// V2 PR-4b adım 4 (M23): execution_legal_snapshots — kiracı izolasyonu,
// BLOCK↔koşusuz tutarlılık, bir-koşuya-bir-fotoğraf, tam değişmezlik
// (service_role dahil). Gerçek migration'lara karşı PGlite.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, seedTwoTenants, type TestDb } from "./helpers/pg";

let db: TestDb;
let seed: Awaited<ReturnType<typeof seedTwoTenants>>;

const SNAPSHOT = `'{"schema":"KALKAN_EXECUTION_LEGAL_SNAPSHOT_V1","asOf":"2026-07-18","eslemeler":[],"karar":"ALLOW","sebepler":[]}'::jsonb`;

/** Kiracıda bir test tanımı + (istenirse) bir koşu kurar. */
async function tanimVeKosu(tenantId: string, kosu: boolean) {
  const { rows: d } = await db.sql(
    `insert into public.control_test_definitions (tenant_id, control_id, tur, ad)
     values ($1, $2, 'MANUAL_PROCEDURE', 'Test tanımı') returning id`,
    [tenantId, seed.controlId],
  );
  let runId: string | null = null;
  if (kosu) {
    const { rows: r } = await db.sql(
      `insert into public.test_runs (tenant_id, test_definition_id, control_id, sonuc, gerekce, tanim_surumu)
       values ($1, $2, $3, 'PASSED', 'test', 1) returning id`,
      [tenantId, d[0].id, seed.controlId],
    );
    runId = r[0].id as string;
  }
  return { definitionId: d[0].id as string, runId };
}

beforeEach(async () => {
  db = await createTestDb();
  seed = await seedTwoTenants(db);
});

afterEach(async () => {
  await db.close();
});

describe("execution_legal_snapshots — RLS + değişmezlik (M23)", () => {
  it("kiracı kendi fotoğrafını ekler/okur; başka kiracı GÖREMEZ ve adına yazamaz", async () => {
    const { definitionId, runId } = await tanimVeKosu(seed.A.tenantId, true);
    const { rows } = await db.asUser(
      seed.A.userId,
      `insert into public.execution_legal_snapshots (tenant_id, control_id, test_definition_id, test_run_id, karar, snapshot)
       values ($1, $2, $3, $4, 'ALLOW', ${SNAPSHOT}) returning id`,
      [seed.A.tenantId, seed.controlId, definitionId, runId],
    );
    const { rows: baska } = await db.asUser(
      seed.B.userId,
      `select id from public.execution_legal_snapshots where id = $1`,
      [rows[0].id],
    );
    expect(baska).toHaveLength(0);
    await expect(
      db.asUser(
        seed.B.userId,
        `insert into public.execution_legal_snapshots (tenant_id, control_id, test_definition_id, karar, snapshot)
         values ($1, $2, $3, 'BLOCK', ${SNAPSHOT})`,
        [seed.A.tenantId, seed.controlId, definitionId],
      ),
    ).rejects.toThrow();
  });

  it("BLOCK koşusuz olmak ZORUNDA; ALLOW koşusuz OLAMAZ (check)", async () => {
    const { definitionId, runId } = await tanimVeKosu(seed.A.tenantId, true);
    // BLOCK + test_run_id dolu → red.
    await expect(
      db.sql(
        `insert into public.execution_legal_snapshots (tenant_id, control_id, test_definition_id, test_run_id, karar, snapshot)
         values ($1, $2, $3, $4, 'BLOCK', ${SNAPSHOT})`,
        [seed.A.tenantId, seed.controlId, definitionId, runId],
      ),
    ).rejects.toThrow();
    // ALLOW + koşusuz → red.
    await expect(
      db.sql(
        `insert into public.execution_legal_snapshots (tenant_id, control_id, test_definition_id, karar, snapshot)
         values ($1, $2, $3, 'ALLOW', ${SNAPSHOT})`,
        [seed.A.tenantId, seed.controlId, definitionId],
      ),
    ).rejects.toThrow();
    // BLOCK koşusuz → geçer (engellenen girişim de kayıt altında).
    await db.sql(
      `insert into public.execution_legal_snapshots (tenant_id, control_id, test_definition_id, karar, snapshot)
       values ($1, $2, $3, 'BLOCK', ${SNAPSHOT})`,
      [seed.A.tenantId, seed.controlId, definitionId],
    );
  });

  it("bir koşuya İKİNCİ fotoğraf eklenemez (unique)", async () => {
    const { definitionId, runId } = await tanimVeKosu(seed.A.tenantId, true);
    const ekle = () =>
      db.sql(
        `insert into public.execution_legal_snapshots (tenant_id, control_id, test_definition_id, test_run_id, karar, snapshot)
         values ($1, $2, $3, $4, 'ALLOW', ${SNAPSHOT})`,
        [seed.A.tenantId, seed.controlId, definitionId, runId],
      );
    await ekle();
    await expect(ekle()).rejects.toThrow();
  });

  it("fotoğraf DEĞİŞMEZ: UPDATE/DELETE service_role bağlamında bile reddedilir", async () => {
    const { definitionId, runId } = await tanimVeKosu(seed.A.tenantId, true);
    const { rows } = await db.sql(
      `insert into public.execution_legal_snapshots (tenant_id, control_id, test_definition_id, test_run_id, karar, snapshot)
       values ($1, $2, $3, $4, 'ALLOW', ${SNAPSHOT}) returning id`,
      [seed.A.tenantId, seed.controlId, definitionId, runId],
    );
    await expect(
      db.sql(`update public.execution_legal_snapshots set karar = 'ALLOW_WITH_WARNING' where id = $1`, [rows[0].id]),
    ).rejects.toThrow(/immutable/);
    await expect(
      db.sql(`delete from public.execution_legal_snapshots where id = $1`, [rows[0].id]),
    ).rejects.toThrow(/immutable/);
  });
});
