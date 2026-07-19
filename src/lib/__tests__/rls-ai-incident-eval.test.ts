// M37 sonraki dilim: AI olay + eval — RLS + olay kapanış guard'ı (kural 14) +
// eval UNKNOWN default (kural 13). PGlite gerçek migration'lara karşı.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, seedTwoTenants, type TestDb } from "./helpers/pg";

let db: TestDb;
let seed: Awaited<ReturnType<typeof seedTwoTenants>>;
const A_MISAFIR = "a0000000-0000-0000-0000-000000000009";

async function aiSistem(tenantId: string, ad: string) {
  const { rows } = await db.sql(
    `insert into public.ai_systems (tenant_id, ad) values ($1, $2) returning id`,
    [tenantId, ad],
  );
  return rows[0].id as string;
}
async function olay(tenantId: string, sysId: string, ciddiyet: string) {
  const { rows } = await db.sql(
    `insert into public.ai_incidents (tenant_id, ai_system_id, ozet, ciddiyet) values ($1, $2, 'olay', $3) returning id`,
    [tenantId, sysId, ciddiyet],
  );
  return rows[0].id as string;
}

beforeEach(async () => {
  db = await createTestDb();
  seed = await seedTwoTenants(db);
  await db.sql(`insert into auth.users (id, email) values ($1, 'misafir@demo.com')`, [A_MISAFIR]);
  await db.sql(
    `insert into public.profiles (id, tenant_id, role, full_name) values ($1, $2, 'denetci_misafir', 'Misafir')`,
    [A_MISAFIR, seed.A.tenantId],
  );
});
afterEach(async () => {
  await db.close();
});

describe("AI olay + eval — RLS + guard (M37 sonraki dilim)", () => {
  it("cross-tenant: A olayı B'ye görünmez; misafir yazamaz", async () => {
    const s = await aiSistem(seed.A.tenantId, "Sys A");
    const o = await olay(seed.A.tenantId, s, "YUKSEK");
    const { rows: b } = await db.asUser(seed.B.userId, `select id from public.ai_incidents where id = $1`, [o]);
    expect(b).toHaveLength(0);
    await expect(
      db.asUser(A_MISAFIR, `insert into public.ai_incidents (tenant_id, ai_system_id, ozet) values ($1, $2, 'x')`, [seed.A.tenantId, s]),
    ).rejects.toThrow();
  });

  it("olay kapanışı kanıt + kapatan + zaman ister (kural 14)", async () => {
    const s = await aiSistem(seed.A.tenantId, "S");
    const o = await olay(seed.A.tenantId, s, "KRITIK");
    await expect(
      db.sql(`update public.ai_incidents set durum = 'KAPANDI' where id = $1`, [o]),
    ).rejects.toThrow(/kanit/);
    await db.sql(
      `update public.ai_incidents set durum = 'KAPANDI', kapanis_kanit = 'giderildi', kapatan = $2, kapanis_zamani = now() where id = $1`,
      [o, seed.A.userId],
    );
    const { rows } = await db.sql(`select durum from public.ai_incidents where id = $1`, [o]);
    expect(rows[0].durum).toBe("KAPANDI");
  });

  it("eval sonucu UNKNOWN doğar (kural 13: ölçülmedi ≠ FAILED)", async () => {
    const s = await aiSistem(seed.A.tenantId, "S");
    await db.sql(`insert into public.ai_evaluations (tenant_id, ai_system_id, tur) values ($1, $2, 'BIAS')`, [seed.A.tenantId, s]);
    const { rows } = await db.sql(`select sonuc from public.ai_evaluations where ai_system_id = $1`, [s]);
    expect(rows[0].sonuc).toBe("UNKNOWN");
  });

  it("bildirim_esik_saat NULL doğar (kural 3: sabit süre uydurulmaz) + pozitif olmalı check'i", async () => {
    const s = await aiSistem(seed.A.tenantId, "S");
    const o = await olay(seed.A.tenantId, s, "KRITIK");
    const { rows } = await db.sql(`select bildirim_esik_saat from public.ai_incidents where id = $1`, [o]);
    expect(rows[0].bildirim_esik_saat).toBeNull();
    await expect(
      db.sql(`update public.ai_incidents set bildirim_esik_saat = -5 where id = $1`, [o]),
    ).rejects.toThrow();
    await db.sql(`update public.ai_incidents set bildirim_esik_saat = 360 where id = $1`, [o]);
    const { rows: sonra } = await db.sql(`select bildirim_esik_saat from public.ai_incidents where id = $1`, [o]);
    expect(Number(sonra[0].bildirim_esik_saat)).toBe(360);
  });

  it("eval sonucu yalnız PASSED/FAILED/UNKNOWN olabilir", async () => {
    const s = await aiSistem(seed.A.tenantId, "S");
    await expect(
      db.sql(`insert into public.ai_evaluations (tenant_id, ai_system_id, tur, sonuc) values ($1, $2, 'BIAS', 'HATALI')`, [seed.A.tenantId, s]),
    ).rejects.toThrow();
  });
});
