// Dikey F, F2 (docs/adr/PR0-dikeyF-f2-kritik-hizmet-test-paketi-2026-07-21.md):
// kritik_hizmet_test_paketi_snapshots — mühürlü, append-only, tenant-scoped.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, seedTwoTenants, type TestDb } from "./helpers/pg";

let db: TestDb;
let seed: Awaited<ReturnType<typeof seedTwoTenants>>;

const PAKET_HASH = "a".repeat(64);

async function kritikHizmetEkle(tenantId: string, ad = "Ödeme Sistemi") {
  const { rows } = await db.sql(`insert into public.critical_business_services (tenant_id, ad) values ($1, $2) returning id`, [tenantId, ad]);
  return rows[0].id as string;
}

beforeEach(async () => {
  db = await createTestDb();
  seed = await seedTwoTenants(db);
});

afterEach(async () => {
  await db.close();
});

describe("kritik_hizmet_test_paketi_snapshots — tenant bütünlüğü + olusturan atfı", () => {
  it("aynı-tenant kritik hizmet için snapshot oluşturulabilir; olusturan sunucu tarafında sabitlenir", async () => {
    const hizmetId = await kritikHizmetEkle(seed.A.tenantId);
    const { rows } = await db.asUser(
      seed.A.userId,
      `insert into public.kritik_hizmet_test_paketi_snapshots (tenant_id, critical_service_id, paket, paket_hash, hesaplama_yontemi)
       values ($1, $2, $3::jsonb, $4, $5::jsonb) returning id, olusturan`,
      [seed.A.tenantId, hizmetId, JSON.stringify({ schema: "KALKAN_CRITICAL_SERVICE_TEST_PACKAGE_V1" }), PAKET_HASH, JSON.stringify({ surum: "v1" })],
    );
    expect(rows[0].olusturan).toBe(seed.A.userId);
  });

  it("cross-tenant kritik hizmete snapshot bağlanamaz (INSERT anında reddedilir)", async () => {
    const hizmetIdB = await kritikHizmetEkle(seed.B.tenantId);
    await expect(
      db.sql(
        `insert into public.kritik_hizmet_test_paketi_snapshots (tenant_id, critical_service_id, paket, paket_hash, hesaplama_yontemi)
         values ($1, $2, '{}'::jsonb, $3, '{}'::jsonb)`,
        [seed.A.tenantId, hizmetIdB, PAKET_HASH],
      ),
    ).rejects.toThrow(/cross-tenant/i);
  });

  it("service_role (RLS-bypass) cross-tenant guard'ı atlayamaz", async () => {
    const hizmetIdB = await kritikHizmetEkle(seed.B.tenantId);
    // db.sql superuser: RLS'i bypass eder — trigger yine de reddetmeli.
    await expect(
      db.sql(
        `insert into public.kritik_hizmet_test_paketi_snapshots (tenant_id, critical_service_id, paket, paket_hash, hesaplama_yontemi)
         values ($1, $2, '{}'::jsonb, $3, '{}'::jsonb)`,
        [seed.A.tenantId, hizmetIdB, PAKET_HASH],
      ),
    ).rejects.toThrow(/cross-tenant/i);
  });

  it("olmayan critical_service_id reddedilir (düz FK)", async () => {
    await expect(
      db.sql(
        `insert into public.kritik_hizmet_test_paketi_snapshots (tenant_id, critical_service_id, paket, paket_hash, hesaplama_yontemi)
         values ($1, $2, '{}'::jsonb, $3, '{}'::jsonb)`,
        [seed.A.tenantId, "00000000-0000-0000-0000-000000000099", PAKET_HASH],
      ),
    ).rejects.toThrow();
  });

  it("B kiracısı A'nın snapshot'ını GÖREMEZ", async () => {
    const hizmetId = await kritikHizmetEkle(seed.A.tenantId);
    await db.asUser(
      seed.A.userId,
      `insert into public.kritik_hizmet_test_paketi_snapshots (tenant_id, critical_service_id, paket, paket_hash, hesaplama_yontemi)
       values ($1, $2, '{}'::jsonb, $3, '{}'::jsonb)`,
      [seed.A.tenantId, hizmetId, PAKET_HASH],
    );
    const { rows } = await db.asUser(seed.B.userId, `select id from public.kritik_hizmet_test_paketi_snapshots`);
    expect(rows).toHaveLength(0);
  });

  it("paket_hash formatı zorlanır (64 hex karakter)", async () => {
    const hizmetId = await kritikHizmetEkle(seed.A.tenantId);
    await expect(
      db.sql(
        `insert into public.kritik_hizmet_test_paketi_snapshots (tenant_id, critical_service_id, paket, paket_hash, hesaplama_yontemi)
         values ($1, $2, '{}'::jsonb, 'kisa-hash', '{}'::jsonb)`,
        [seed.A.tenantId, hizmetId],
      ),
    ).rejects.toThrow();
  });
});

describe("kritik_hizmet_test_paketi_snapshots — immutability (append-only)", () => {
  it("UPDATE service_role dahil HER ZAMAN reddedilir", async () => {
    const hizmetId = await kritikHizmetEkle(seed.A.tenantId);
    const { rows } = await db.sql(
      `insert into public.kritik_hizmet_test_paketi_snapshots (tenant_id, critical_service_id, paket, paket_hash, hesaplama_yontemi)
       values ($1, $2, '{}'::jsonb, $3, '{}'::jsonb) returning id`,
      [seed.A.tenantId, hizmetId, PAKET_HASH],
    );
    await expect(
      db.sql(`update public.kritik_hizmet_test_paketi_snapshots set paket_hash = $1 where id = $2`, ["b".repeat(64), rows[0].id]),
    ).rejects.toThrow(/degistirilemez/i);
  });
});

describe("kritik_hizmet_test_paketi_snapshots — audit", () => {
  it("INSERT audit_log'a düşer", async () => {
    const hizmetId = await kritikHizmetEkle(seed.A.tenantId);
    await db.asUser(
      seed.A.userId,
      `insert into public.kritik_hizmet_test_paketi_snapshots (tenant_id, critical_service_id, paket, paket_hash, hesaplama_yontemi)
       values ($1, $2, '{}'::jsonb, $3, '{}'::jsonb)`,
      [seed.A.tenantId, hizmetId, PAKET_HASH],
    );
    const { rows } = await db.sql(
      `select count(*)::int as n from public.audit_log where eylem = 'kritik_hizmet_test_paketi_olusturuldu' and tenant_id = $1`,
      [seed.A.tenantId],
    );
    expect(rows[0].n).toBe(1);
  });
});

// Dikey F, F3 — impact_tolerances tenant izolasyonu + V1/V2 snapshot birlikte-okuma.
async function yururluktenOnayliToleransEkle(tenantId: string, hizmetId: string, userId: string, surum = 1, kesinti: number | null = 4, veriKaybi: number | null = 1) {
  // YURURLUKTE guard'ı yonetim_onayi + onaylayan + onay_zamani ister.
  const { rows } = await db.sql(
    `insert into public.impact_tolerances
       (tenant_id, critical_service_id, surum, max_kesinti_saat, max_veri_kaybi_saat, yonetim_onayi, onaylayan, onay_zamani, durum)
     values ($1, $2, $3, $4, $5, true, $6, now(), 'YURURLUKTE') returning id`,
    [tenantId, hizmetId, surum, kesinti, veriKaybi, userId],
  );
  return rows[0].id as string;
}

describe("F3 — impact_tolerances tenant izolasyonu", () => {
  it("B kiracısı A'nın etki toleransını GÖREMEZ (RLS)", async () => {
    const hizmetA = await kritikHizmetEkle(seed.A.tenantId);
    await yururluktenOnayliToleransEkle(seed.A.tenantId, hizmetA, seed.A.userId);

    const gorulen = await db.asUser(seed.B.userId, `select id from public.impact_tolerances`);
    expect(gorulen.rows).toHaveLength(0);

    // A kendi toleransını görür.
    const kendi = await db.asUser(seed.A.userId, `select id from public.impact_tolerances`);
    expect(kendi.rows).toHaveLength(1);
  });

  it("bir hizmet için aynı anda ikinci YURURLUKTE kayıt DB'de imkansız (tek-yürürlükte partial unique index)", async () => {
    const hizmetA = await kritikHizmetEkle(seed.A.tenantId);
    await yururluktenOnayliToleransEkle(seed.A.tenantId, hizmetA, seed.A.userId, 1);
    await expect(yururluktenOnayliToleransEkle(seed.A.tenantId, hizmetA, seed.A.userId, 2)).rejects.toThrow();
  });

  it("YURURLUKTE onaysız (yonetim_onayi/onaylayan yok) reddedilir — onaysız hedef yürürlüğe giremez", async () => {
    const hizmetA = await kritikHizmetEkle(seed.A.tenantId);
    await expect(
      db.sql(
        `insert into public.impact_tolerances (tenant_id, critical_service_id, surum, max_kesinti_saat, durum)
         values ($1, $2, 1, 4, 'YURURLUKTE')`,
        [seed.A.tenantId, hizmetA],
      ),
    ).rejects.toThrow();
  });
});

describe("F3 — V1/V2 snapshot birlikte okunur, ikisi de immutable", () => {
  it("V1 (tolerans alanı yok) ve V2 (etkiToleransiOzeti mühürlü) yan yana yaşar ve okunur", async () => {
    const hizmetId = await kritikHizmetEkle(seed.A.tenantId);
    const v1 = JSON.stringify({ schema: "KALKAN_CRITICAL_SERVICE_TEST_PACKAGE_V1", genelDurum: "DOGRULANMIS" });
    const v2 = JSON.stringify({
      schema: "KALKAN_CRITICAL_SERVICE_TEST_PACKAGE_V2",
      genelDurum: "DOGRULANMIS",
      etkiToleransiOzeti: { durum: "TOLERANS_TANIMLI_VE_ONAYLI", maxKesintiSaat: 4, maxVeriKaybiSaat: 1, karsilastirmaYapildi: false },
    });
    await db.asUser(seed.A.userId, `insert into public.kritik_hizmet_test_paketi_snapshots (tenant_id, critical_service_id, paket, paket_hash, hesaplama_yontemi) values ($1,$2,$3::jsonb,$4,'{}'::jsonb)`, [seed.A.tenantId, hizmetId, v1, "a".repeat(64)]);
    await db.asUser(seed.A.userId, `insert into public.kritik_hizmet_test_paketi_snapshots (tenant_id, critical_service_id, paket, paket_hash, hesaplama_yontemi) values ($1,$2,$3::jsonb,$4,'{}'::jsonb)`, [seed.A.tenantId, hizmetId, v2, "b".repeat(64)]);

    const { rows } = await db.asUser(seed.A.userId, `select paket->>'schema' as schema, paket->'etkiToleransiOzeti' as tol from public.kritik_hizmet_test_paketi_snapshots order by paket_hash`);
    expect(rows).toHaveLength(2);
    const v1row = rows.find((r) => r.schema === "KALKAN_CRITICAL_SERVICE_TEST_PACKAGE_V1");
    const v2row = rows.find((r) => r.schema === "KALKAN_CRITICAL_SERVICE_TEST_PACKAGE_V2");
    expect(v1row?.tol).toBeNull(); // V1'de tolerans YOK — savunmacı okunacak
    expect(v2row?.tol).not.toBeNull();
  });

  it("V2 snapshot (tolerans mühürlü) UPDATE ile değiştirilemez", async () => {
    const hizmetId = await kritikHizmetEkle(seed.A.tenantId);
    const v2 = JSON.stringify({ schema: "KALKAN_CRITICAL_SERVICE_TEST_PACKAGE_V2", etkiToleransiOzeti: { durum: "TOLERANS_TANIMLI_VE_ONAYLI" } });
    const { rows } = await db.sql(`insert into public.kritik_hizmet_test_paketi_snapshots (tenant_id, critical_service_id, paket, paket_hash, hesaplama_yontemi) values ($1,$2,$3::jsonb,$4,'{}'::jsonb) returning id`, [seed.A.tenantId, hizmetId, v2, PAKET_HASH]);
    await expect(db.sql(`update public.kritik_hizmet_test_paketi_snapshots set paket = '{}'::jsonb where id = $1`, [rows[0].id])).rejects.toThrow(/degistirilemez/i);
  });
});
