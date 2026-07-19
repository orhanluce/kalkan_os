// M37 AI veri/model güvence genişlemesi (nihai v3.3 §8.0 Dikey 4): soyağacı
// zenginleştirme (poisoning BİLİNMİYOR default) + drift (eşik kaynağı zorunlu) +
// saf driftDegerlendir. PGlite + saf birim.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, seedTwoTenants, type TestDb } from "./helpers/pg";
import { driftDegerlendir } from "../ai-olay";

let db: TestDb;
let seed: Awaited<ReturnType<typeof seedTwoTenants>>;

async function aiSistem(tenantId: string) {
  const { rows } = await db.sql(`insert into public.ai_systems (tenant_id, ad) values ($1, 'S') returning id`, [tenantId]);
  return rows[0].id as string;
}
async function evalKur(tenantId: string, sysId: string) {
  const { rows } = await db.sql(`insert into public.ai_evaluations (tenant_id, ai_system_id, tur) values ($1, $2, 'BIAS') returning id`, [tenantId, sysId]);
  return rows[0].id as string;
}

beforeEach(async () => {
  db = await createTestDb();
  seed = await seedTwoTenants(db);
});
afterEach(async () => {
  await db.close();
});

describe("driftDegerlendir (saf, kural 11)", () => {
  it("eşik yoksa DEGERLENDIRILEMEDI (koda gömülü eşik uydurulmaz)", () => {
    expect(driftDegerlendir(5, null, 3).durum).toBe("DEGERLENDIRILEMEDI");
  });
  it("baseline sapması eşiği aşarsa ESIK_ASILDI", () => {
    expect(driftDegerlendir(10, 2, 3).durum).toBe("ESIK_ASILDI"); // |10-3|=7 > 2
  });
  it("tolerans içinde", () => {
    expect(driftDegerlendir(4, 2, 3).durum).toBe("TOLERANS_ICINDE"); // |4-3|=1 ≤ 2
  });
});

describe("AI veri/model güvence — RLS + guard (§8.0 Dikey 4)", () => {
  it("soyağacı poisoning_riski BİLİNMİYOR doğar (değerlendirilmedi ≠ düşük)", async () => {
    const s = await aiSistem(seed.A.tenantId);
    const e = await evalKur(seed.A.tenantId, s);
    const { rows } = await db.sql(
      `insert into public.ai_data_lineage (tenant_id, ai_evaluation_id, tur, ad, lisans, izin_amaci, surum, sentetik_oran)
       values ($1, $2, 'EGITIM_VERISI', 'set-1', 'CC-BY', 'model eğitimi', 'v1', 30) returning poisoning_riski, sentetik_oran`,
      [seed.A.tenantId, e],
    );
    expect(rows[0].poisoning_riski).toBe("BILINMIYOR");
    expect(Number(rows[0].sentetik_oran)).toBe(30);
  });

  it("sentetik_oran 0-100 dışı reddedilir", async () => {
    const s = await aiSistem(seed.A.tenantId);
    const e = await evalKur(seed.A.tenantId, s);
    await expect(
      db.sql(`insert into public.ai_data_lineage (tenant_id, ai_evaluation_id, tur, ad, sentetik_oran) values ($1, $2, 'EGITIM_VERISI', 'x', 150)`, [seed.A.tenantId, e]),
    ).rejects.toThrow();
  });

  it("drift eşiği verilince esik_kaynagi ZORUNLU (eşik koda gömülmez)", async () => {
    const s = await aiSistem(seed.A.tenantId);
    await expect(
      db.sql(`insert into public.ai_drift_readings (tenant_id, ai_system_id, metrik, deger, esik) values ($1, $2, 'accuracy', 0.8, 0.05)`, [seed.A.tenantId, s]),
    ).rejects.toThrow(/esik_kaynagi/);
    // Kaynak ile kabul edilir + audit.
    const { rows } = await db.sql(
      `insert into public.ai_drift_readings (tenant_id, ai_system_id, metrik, deger, esik, esik_kaynagi, baseline) values ($1, $2, 'accuracy', 0.8, 0.05, 'Model Politikası v2 §4', 0.82) returning id`,
      [seed.A.tenantId, s],
    );
    const audit = await db.sql(`select count(*)::int as n from public.audit_log where hedef_tablo = 'ai_drift_readings' and hedef_id = $1`, [rows[0].id]);
    expect(audit.rows[0].n).toBe(1);
  });

  it("drift okuması başka kiracının sistemine reddedilir", async () => {
    const sB = await aiSistem(seed.B.tenantId);
    await expect(
      db.sql(`insert into public.ai_drift_readings (tenant_id, ai_system_id, metrik, deger) values ($1, $2, 'm', 1)`, [seed.A.tenantId, sB]),
    ).rejects.toThrow(/ayni kiraciya/);
  });

  it("cross-tenant: A'nın drift okuması B'ye görünmez", async () => {
    const s = await aiSistem(seed.A.tenantId);
    const r = await db.sql(`insert into public.ai_drift_readings (tenant_id, ai_system_id, metrik, deger) values ($1, $2, 'm', 1) returning id`, [seed.A.tenantId, s]);
    const { rows: b } = await db.asUser(seed.B.userId, `select id from public.ai_drift_readings where id = $1`, [r.rows[0].id]);
    expect(b).toHaveLength(0);
  });
});
