// M18 "sonraki dilim" borcu: retraining otomasyonu (ROADMAP §1.30,
// 20260719060000'de kaydedilmişti). SoD/TPR süre-dolumu cron'larıyla AYNI
// desen; training_assignments unique kısıtı partial hale geldi (impact_
// tolerances "tek yürürlükte" deseni). PGlite.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, seedTwoTenants, type TestDb } from "./helpers/pg";

let db: TestDb;
let seed: Awaited<ReturnType<typeof seedTwoTenants>>;

async function gereksinim(tenantId: string, periyotGun: number | null = 365) {
  const { rows } = await db.sql(
    `insert into public.training_requirements (tenant_id, ad, konu, gecme_esigi, periyot_gun) values ($1, 'KVKK Eğitimi', 'KVKK', 70, $2) returning id`,
    [tenantId, periyotGun],
  );
  return rows[0].id as string;
}
async function atamaVeTamamla(tenantId: string, requirementId: string, kullaniciId: string, tamamlandiAt: string) {
  const { rows: a } = await db.sql(
    `insert into public.training_assignments (tenant_id, requirement_id, kullanici) values ($1, $2, $3) returning id`,
    [tenantId, requirementId, kullaniciId],
  );
  await db.sql(
    `insert into public.training_completions (tenant_id, assignment_id, skor, attestation) values ($1, $2, 90, true)`,
    [tenantId, a[0].id],
  );
  await db.sql(`update public.training_completions set tamamlandi_at = $2 where assignment_id = $1`, [a[0].id, tamamlandiAt]);
  return a[0].id as string;
}

beforeEach(async () => {
  db = await createTestDb();
  seed = await seedTwoTenants(db);
});
afterEach(async () => {
  await db.close();
});

describe("training_assignments — partial unique (M18 retraining ön koşulu)", () => {
  it("aynı requirement+kullanıcı için İKİ ATANDI olamaz", async () => {
    const reqId = await gereksinim(seed.A.tenantId);
    await db.sql(`insert into public.training_assignments (tenant_id, requirement_id, kullanici) values ($1, $2, $3)`, [seed.A.tenantId, reqId, seed.A.userId]);
    await expect(
      db.sql(`insert into public.training_assignments (tenant_id, requirement_id, kullanici) values ($1, $2, $3)`, [seed.A.tenantId, reqId, seed.A.userId]),
    ).rejects.toThrow();
  });

  it("ATANDI + TAMAMLANDI (farklı satır) BİRLİKTE var olabilir (retraining zinciri)", async () => {
    const reqId = await gereksinim(seed.A.tenantId);
    await atamaVeTamamla(seed.A.tenantId, reqId, seed.A.userId, "2020-01-01T00:00:00Z");
    // Retraining sonrası ikinci (aktif) atama.
    await db.sql(`insert into public.training_assignments (tenant_id, requirement_id, kullanici) values ($1, $2, $3)`, [seed.A.tenantId, reqId, seed.A.userId]);
    const { rows } = await db.sql(`select durum from public.training_assignments where requirement_id = $1 order by created_at`, [reqId]);
    expect(rows.map((r) => r.durum)).toEqual(["TAMAMLANDI", "ATANDI"]);
  });
});

describe("egitim_periyot_yenile() — retraining cron (M18 sonraki dilim)", () => {
  it("periyot dolmuş TAMAMLANDI → YENİ ATANDI doğar + audit", async () => {
    const reqId = await gereksinim(seed.A.tenantId, 30);
    await atamaVeTamamla(seed.A.tenantId, reqId, seed.A.userId, "2020-01-01T00:00:00Z"); // çok eski
    await db.sql(`select public.egitim_periyot_yenile()`);
    const { rows } = await db.sql(`select durum from public.training_assignments where requirement_id = $1 order by created_at`, [reqId]);
    expect(rows).toHaveLength(2);
    expect(rows[1].durum).toBe("ATANDI");
    const { rows: audit } = await db.sql(`select count(*)::int as n from public.audit_log where eylem = 'egitim_periyot_yenilendi'`);
    expect(audit[0].n).toBe(1);
  });

  it("periyot HENÜZ dolmamışsa yenilenmez", async () => {
    const reqId = await gereksinim(seed.A.tenantId, 365);
    await atamaVeTamamla(seed.A.tenantId, reqId, seed.A.userId, new Date().toISOString()); // az önce
    await db.sql(`select public.egitim_periyot_yenile()`);
    const { rows } = await db.sql(`select id from public.training_assignments where requirement_id = $1`, [reqId]);
    expect(rows).toHaveLength(1);
  });

  it("periyot_gun NULL ise (tek seferlik eğitim) yenilenmez", async () => {
    const reqId = await gereksinim(seed.A.tenantId, null);
    await atamaVeTamamla(seed.A.tenantId, reqId, seed.A.userId, "2020-01-01T00:00:00Z");
    await db.sql(`select public.egitim_periyot_yenile()`);
    const { rows } = await db.sql(`select id from public.training_assignments where requirement_id = $1`, [reqId]);
    expect(rows).toHaveLength(1);
  });

  it("idempotent: hâlâ AKTİF (ATANDI) bir atama varsa TEKRAR yenilemez", async () => {
    const reqId = await gereksinim(seed.A.tenantId, 30);
    await atamaVeTamamla(seed.A.tenantId, reqId, seed.A.userId, "2020-01-01T00:00:00Z");
    await db.sql(`select public.egitim_periyot_yenile()`);
    await db.sql(`select public.egitim_periyot_yenile()`); // ikinci koşu — yeni satır eklememeli
    const { rows } = await db.sql(`select id from public.training_assignments where requirement_id = $1`, [reqId]);
    expect(rows).toHaveLength(2);
  });

  it("cross-tenant: B'nin gereksinimi A'nın koşusundan etkilenmez", async () => {
    const reqA = await gereksinim(seed.A.tenantId, 30);
    const reqB = await gereksinim(seed.B.tenantId, 30);
    await atamaVeTamamla(seed.A.tenantId, reqA, seed.A.userId, "2020-01-01T00:00:00Z");
    await atamaVeTamamla(seed.B.tenantId, reqB, seed.B.userId, "2020-01-01T00:00:00Z");
    await db.sql(`select public.egitim_periyot_yenile()`);
    const { rows: a } = await db.sql(`select id from public.training_assignments where requirement_id = $1`, [reqA]);
    const { rows: b } = await db.sql(`select id from public.training_assignments where requirement_id = $1`, [reqB]);
    expect(a).toHaveLength(2);
    expect(b).toHaveLength(2);
  });
});
