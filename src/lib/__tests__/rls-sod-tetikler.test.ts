// M16 #5: atama/kural değişimi değerlendirme borcunu outbox'a kuyruklar;
// tenant başına DEBOUNCE (tek PENDING olay). Gerçek migration'lara karşı
// PGlite (kural 1/4).
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, seedTwoTenants, type TestDb } from "./helpers/pg";

let db: TestDb;
let seed: Awaited<ReturnType<typeof seedTwoTenants>>;

async function bekleyenSayisi(tenantId: string): Promise<number> {
  const { rows } = await db.sql(
    `select count(*)::int as n from public.sod_outbox
     where tenant_id = $1 and event_type = 'SOD_YENIDEN_DEGERLENDIR' and durum = 'PENDING'`,
    [tenantId],
  );
  return rows[0].n as number;
}

beforeEach(async () => {
  db = await createTestDb();
  seed = await seedTwoTenants(db);
});

afterEach(async () => {
  await db.close();
});

describe("sod_yeniden_degerlendir_kuyrukla — değişim → outbox (debounce'lu)", () => {
  it("atama eklenince PENDING olay doğar; ikinci/üçüncü değişiklik YENİ olay üretmez", async () => {
    await db.sql(
      `insert into public.sod_atamalari (tenant_id, kullanici_id, aktivite_kodu) values ($1, $2, 'A1')`,
      [seed.A.tenantId, seed.A.userId],
    );
    expect(await bekleyenSayisi(seed.A.tenantId)).toBe(1);

    await db.sql(
      `insert into public.sod_atamalari (tenant_id, kullanici_id, aktivite_kodu) values ($1, $2, 'A2')`,
      [seed.A.tenantId, seed.A.userId],
    );
    await db.sql(`update public.sod_atamalari set rol_kodu = 'R' where tenant_id = $1`, [seed.A.tenantId]);
    expect(await bekleyenSayisi(seed.A.tenantId)).toBe(1); // debounce
  });

  it("olay DONE olunca sonraki değişiklik YENİ olay üretir", async () => {
    await db.sql(
      `insert into public.sod_atamalari (tenant_id, kullanici_id, aktivite_kodu) values ($1, $2, 'A1')`,
      [seed.A.tenantId, seed.A.userId],
    );
    await db.sql(
      `update public.sod_outbox set durum = 'DONE' where tenant_id = $1 and event_type = 'SOD_YENIDEN_DEGERLENDIR'`,
      [seed.A.tenantId],
    );
    await db.sql(`delete from public.sod_atamalari where tenant_id = $1`, [seed.A.tenantId]);
    expect(await bekleyenSayisi(seed.A.tenantId)).toBe(1);
  });

  it("kural ve taraf değişimi de kuyruklar (taraf tenant'ı kural üzerinden bulur)", async () => {
    const { rows } = await db.sql(
      `insert into public.sod_kurallari (tenant_id, kod, ad) values ($1, 'K1', 'Kural') returning id`,
      [seed.A.tenantId],
    );
    expect(await bekleyenSayisi(seed.A.tenantId)).toBe(1);

    await db.sql(
      `update public.sod_outbox set durum = 'DONE' where tenant_id = $1 and event_type = 'SOD_YENIDEN_DEGERLENDIR'`,
      [seed.A.tenantId],
    );
    await db.sql(
      `insert into public.sod_kural_taraflari (rule_id, taraf, aktivite_kodu) values ($1, 'A', 'AKT')`,
      [rows[0].id],
    );
    expect(await bekleyenSayisi(seed.A.tenantId)).toBe(1);
  });

  it("kiracılar birbirinin debounce'unu ETKİLEMEZ", async () => {
    await db.sql(
      `insert into public.sod_atamalari (tenant_id, kullanici_id, aktivite_kodu) values ($1, $2, 'A1')`,
      [seed.A.tenantId, seed.A.userId],
    );
    await db.sql(
      `insert into public.sod_atamalari (tenant_id, kullanici_id, aktivite_kodu) values ($1, $2, 'B1')`,
      [seed.B.tenantId, seed.B.userId],
    );
    expect(await bekleyenSayisi(seed.A.tenantId)).toBe(1);
    expect(await bekleyenSayisi(seed.B.tenantId)).toBe(1);
  });
});
