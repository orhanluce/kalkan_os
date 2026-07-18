// M16 PR-3A: import önizleme tablosu — kiracı izolasyonu + append-only + audit
// (docs/ROADMAP.md M16 PR-3A).
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, seedTwoTenants, type TestDb } from "./helpers/pg";

let db: TestDb;
let seed: Awaited<ReturnType<typeof seedTwoTenants>>;

const H = (c: string) => c.repeat(64);

async function onizlemeEkle(tenantId: string) {
  const { rows } = await db.sql(
    `insert into public.sod_import_onizlemeleri
       (tenant_id, kaynak, mode, file_hash, normalized_records_hash, assignment_snapshot_hash,
        rule_set_version, normalized_records, diff)
     values ($1, 'hr', 'DELTA', $2, $3, $4, $5, '[]', '{}') returning id`,
    [tenantId, H("a"), H("b"), H("c"), H("d")],
  );
  return rows[0].id as string;
}

beforeEach(async () => {
  db = await createTestDb();
  seed = await seedTwoTenants(db);
});

afterEach(async () => {
  await db.close();
});

describe("sod_import_onizlemeleri RLS", () => {
  it("kiracı kendi önizlemesini görür, başkasınınkini SORGUYLA da göremez", async () => {
    const id = await onizlemeEkle(seed.A.tenantId);
    const { rows: kendi } = await db.asUser(
      seed.A.userId,
      `select id from public.sod_import_onizlemeleri where id = $1`,
      [id],
    );
    expect(kendi).toHaveLength(1);
    const { rows: baska } = await db.asUser(
      seed.B.userId,
      `select id from public.sod_import_onizlemeleri where id = $1`,
      [id],
    );
    expect(baska).toHaveLength(0);
  });

  it("kullanıcı başka kiracı adına önizleme YAZAMAZ (RLS with check)", async () => {
    await expect(
      db.asUser(
        seed.A.userId,
        `insert into public.sod_import_onizlemeleri
           (tenant_id, kaynak, mode, file_hash, normalized_records_hash, assignment_snapshot_hash,
            rule_set_version, normalized_records, diff)
         values ($1, 'hr', 'DELTA', $2, $3, $4, $5, '[]', '{}')`,
        [seed.B.tenantId, H("a"), H("b"), H("c"), H("d")],
      ),
    ).rejects.toThrow();
  });

  it("önizleme append-only: istemci UPDATE/DELETE edemez", async () => {
    const id = await onizlemeEkle(seed.A.tenantId);
    await expect(
      db.asUser(seed.A.userId, `update public.sod_import_onizlemeleri set durum = 'APPLIED' where id = $1`, [id]),
    ).rejects.toThrow();
    await expect(
      db.asUser(seed.A.userId, `delete from public.sod_import_onizlemeleri where id = $1`, [id]),
    ).rejects.toThrow();
  });

  it("önizleme oluşturma audit kaydı üretir", async () => {
    const id = await onizlemeEkle(seed.A.tenantId);
    const { rows } = await db.sql(
      `select eylem from public.audit_log where hedef_id = $1 and eylem = 'sod_import_onizleme_olusturuldu'`,
      [id],
    );
    expect(rows).toHaveLength(1);
  });
});

describe("sod_atamalari idempotency anahtarı", () => {
  it("aynı (tenant, kaynak_sistem, source_record_id) iki atama üretemez", async () => {
    await db.sql(
      `insert into public.sod_atamalari (tenant_id, kullanici_id, aktivite_kodu, kaynak_sistem, source_record_id)
       values ($1, $2, 'AKT', 'hr', 'rec-1')`,
      [seed.A.tenantId, seed.A.userId],
    );
    await expect(
      db.sql(
        `insert into public.sod_atamalari (tenant_id, kullanici_id, aktivite_kodu, kaynak_sistem, source_record_id)
         values ($1, $2, 'BASKA', 'hr', 'rec-1')`,
        [seed.A.tenantId, seed.A.userId],
      ),
    ).rejects.toThrow();
  });

  it("source_record_id null ise (eski/elle atama) tekillik zorlanmaz", async () => {
    // Partial index yalnız source_record_id dolu satırları kapsar.
    for (let i = 0; i < 2; i++) {
      await db.sql(
        `insert into public.sod_atamalari (tenant_id, kullanici_id, aktivite_kodu, kaynak_sistem)
         values ($1, $2, 'AKT', 'kalkan_os')`,
        [seed.A.tenantId, seed.A.userId],
      );
    }
    const { rows } = await db.sql(
      `select count(*)::int as n from public.sod_atamalari where source_record_id is null and tenant_id = $1`,
      [seed.A.tenantId],
    );
    expect(rows[0].n).toBe(2);
  });
});
