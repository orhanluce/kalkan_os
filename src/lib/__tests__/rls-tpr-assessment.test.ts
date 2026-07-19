// M35 sonraki dilim: tedarikçi değerlendirme/anket/bulgu — RLS + bulgu kapanış
// guard'ı (kural 14) + TAMAMLANDI'da açık KRİTİK bulgu engeli. PGlite.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, seedTwoTenants, type TestDb } from "./helpers/pg";

let db: TestDb;
let seed: Awaited<ReturnType<typeof seedTwoTenants>>;
const A_MISAFIR = "a0000000-0000-0000-0000-000000000009";

async function tedarikci(tenantId: string, ad: string) {
  const { rows } = await db.sql(
    `insert into public.third_parties (tenant_id, ad) values ($1, $2) returning id`,
    [tenantId, ad],
  );
  return rows[0].id as string;
}
async function degerlendirme(tenantId: string, tpId: string) {
  const { rows } = await db.sql(
    `insert into public.third_party_assessments (tenant_id, third_party_id, tur) values ($1, $2, 'DORA') returning id`,
    [tenantId, tpId],
  );
  return rows[0].id as string;
}
async function bulgu(tenantId: string, aId: string, tpId: string, ciddiyet: string) {
  const { rows } = await db.sql(
    `insert into public.assessment_findings (tenant_id, assessment_id, third_party_id, baslik, ciddiyet) values ($1, $2, $3, 'B', $4) returning id`,
    [tenantId, aId, tpId, ciddiyet],
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

describe("tedarikçi değerlendirme/bulgu — RLS + guard (M35 sonraki dilim)", () => {
  it("cross-tenant: A değerlendirmesi B'ye görünmez; misafir yazamaz", async () => {
    const tp = await tedarikci(seed.A.tenantId, "Vendor A");
    const a = await degerlendirme(seed.A.tenantId, tp);
    const { rows: b } = await db.asUser(seed.B.userId, `select id from public.third_party_assessments where id = $1`, [a]);
    expect(b).toHaveLength(0);
    await expect(
      db.asUser(
        A_MISAFIR,
        `insert into public.third_party_assessments (tenant_id, third_party_id) values ($1, $2)`,
        [seed.A.tenantId, tp],
      ),
    ).rejects.toThrow();
  });

  it("bulgu kapanışı kanıt + kapatan + zaman ister (kural 14)", async () => {
    const tp = await tedarikci(seed.A.tenantId, "V");
    const a = await degerlendirme(seed.A.tenantId, tp);
    const f = await bulgu(seed.A.tenantId, a, tp, "YUKSEK");
    // Kanıtsız kapatma reddi.
    await expect(
      db.sql(`update public.assessment_findings set durum = 'KAPANDI' where id = $1`, [f]),
    ).rejects.toThrow(/kanit/);
    // Kanıt + kapatan + zaman ile kapanır.
    await db.sql(
      `update public.assessment_findings set durum = 'KAPANDI', kapanis_kanit = 'düzeltildi', kapatan = $2, kapanis_zamani = now() where id = $1`,
      [f, seed.A.userId],
    );
    const { rows } = await db.sql(`select durum from public.assessment_findings where id = $1`, [f]);
    expect(rows[0].durum).toBe("KAPANDI");
  });

  it("bulgu değerlendirmenin tedarikçisiyle tutarsızsa reddedilir", async () => {
    const tp1 = await tedarikci(seed.A.tenantId, "V1");
    const tp2 = await tedarikci(seed.A.tenantId, "V2");
    const a = await degerlendirme(seed.A.tenantId, tp1);
    await expect(bulgu(seed.A.tenantId, a, tp2, "ORTA")).rejects.toThrow(/tutarsiz/);
  });

  it("TAMAMLANDI: degerlendiren zorunlu + açık KRİTİK bulgu engeli", async () => {
    const tp = await tedarikci(seed.A.tenantId, "V");
    const a = await degerlendirme(seed.A.tenantId, tp);
    // degerlendiren yok → reddedilir.
    await expect(
      db.sql(`update public.third_party_assessments set durum = 'TAMAMLANDI' where id = $1`, [a]),
    ).rejects.toThrow(/degerlendiren/);
    // Açık KRİTİK bulgu → reddedilir.
    const f = await bulgu(seed.A.tenantId, a, tp, "KRITIK");
    await expect(
      db.sql(`update public.third_party_assessments set durum = 'TAMAMLANDI', degerlendiren = $2 where id = $1`, [a, seed.A.userId]),
    ).rejects.toThrow(/KRITIK/);
    // Kritik bulgu kapanınca tamamlanır (tamamlandi_at otomatik).
    await db.sql(
      `update public.assessment_findings set durum = 'KAPANDI', kapanis_kanit = 'x', kapatan = $2, kapanis_zamani = now() where id = $1`,
      [f, seed.A.userId],
    );
    await db.sql(`update public.third_party_assessments set durum = 'TAMAMLANDI', degerlendiren = $2 where id = $1`, [a, seed.A.userId]);
    const { rows } = await db.sql(`select durum, tamamlandi_at from public.third_party_assessments where id = $1`, [a]);
    expect(rows[0].durum).toBe("TAMAMLANDI");
    expect(rows[0].tamamlandi_at).not.toBeNull();
  });

  it("anket sorusu risk_seviyesi null olabilir (değerlendirilmedi ≠ DÜŞÜK)", async () => {
    const tp = await tedarikci(seed.A.tenantId, "V");
    const a = await degerlendirme(seed.A.tenantId, tp);
    await db.sql(
      `insert into public.assessment_questions (tenant_id, assessment_id, soru) values ($1, $2, 'Alt yüklenici var mı?')`,
      [seed.A.tenantId, a],
    );
    const { rows } = await db.sql(`select risk_seviyesi from public.assessment_questions where assessment_id = $1`, [a]);
    expect(rows[0].risk_seviyesi).toBeNull();
  });
});
