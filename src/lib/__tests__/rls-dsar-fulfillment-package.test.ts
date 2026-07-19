// DSAR kanıt paketi (M36 sonraki dilim; nihai talimat v3.2 §8.0 asenkron mühür):
// RLS + TAMAMLANDI guard + append-only + tek-paket. Ledger bağlantısı artık
// GENEL artifact_ledger_links/ledger_outbox katmanına ait — bkz.
// rls-ledger-outbox.test.ts. PGlite gerçek migration'lara karşı.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, seedTwoTenants, type TestDb } from "./helpers/pg";

let db: TestDb;
let seed: Awaited<ReturnType<typeof seedTwoTenants>>;
const A_MISAFIR = "a0000000-0000-0000-0000-000000000009";
const hex = (n: number) => n.toString(16).padStart(64, "0");
const MAN = `'{"schema":"KALKAN_DSAR_FULFILLMENT_V1"}'::jsonb`;

async function dsarEkle(tenantId: string, durum: string, kimlik: boolean) {
  const { rows } = await db.sql(
    `insert into public.data_subject_requests (tenant_id, tur, veri_sahibi_maskeli, veri_sahibi_hash, kimlik_dogrulandi, durum)
     values ($1, 'ERISIM', 'a***@x.com', $2, $3, $4) returning id`,
    [tenantId, hex(7), kimlik, durum],
  );
  return rows[0].id as string;
}
async function paketEkle(tenantId: string, dsarId: string, manifestHash = hex(1)) {
  return db.sql(
    `insert into public.dsar_fulfillment_packages (tenant_id, dsar_id, manifest, manifest_hash, aciklanan_kategoriler)
     values ($1, $2, ${MAN}, $3, array['kimlik','iletisim']) returning id`,
    [tenantId, dsarId, manifestHash],
  );
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

describe("DSAR kanıt paketi — RLS + guard (M36 sonraki dilim)", () => {
  it("TAMAMLANDI DSAR için paket mühürlenir + audit + AYNI transaction'da outbox olayı", async () => {
    const dsar = await dsarEkle(seed.A.tenantId, "TAMAMLANDI", true);
    const p = await paketEkle(seed.A.tenantId, dsar);
    expect(p.rows[0].id).toBeTruthy();
    const audit = await db.sql(
      `select count(*)::int as n from public.audit_log where hedef_tablo = 'dsar_fulfillment_packages' and hedef_id = $1`,
      [p.rows[0].id],
    );
    expect(audit.rows[0].n).toBe(1);
    const outbox = await db.sql(
      `select durum from public.ledger_outbox where artifact_table = 'dsar_fulfillment_packages' and artifact_id = $1`,
      [p.rows[0].id],
    );
    expect(outbox.rows).toHaveLength(1);
    expect(outbox.rows[0].durum).toBe("PENDING");
  });

  it("TAMAMLANDI olmayan DSAR için paket reddedilir", async () => {
    const dsar = await dsarEkle(seed.A.tenantId, "ISLENIYOR", true);
    await expect(paketEkle(seed.A.tenantId, dsar)).rejects.toThrow(/TAMAMLANDI/);
  });

  it("bir DSAR için tek paket (ikinci reddedilir)", async () => {
    const dsar = await dsarEkle(seed.A.tenantId, "TAMAMLANDI", true);
    await paketEkle(seed.A.tenantId, dsar);
    await expect(paketEkle(seed.A.tenantId, dsar, hex(2))).rejects.toThrow();
  });

  it("append-only: UPDATE reddedilir", async () => {
    const dsar = await dsarEkle(seed.A.tenantId, "TAMAMLANDI", true);
    const p = await paketEkle(seed.A.tenantId, dsar);
    await expect(
      db.sql(`update public.dsar_fulfillment_packages set manifest_hash = $2 where id = $1`, [p.rows[0].id, hex(9)]),
    ).rejects.toThrow(/append-only/);
  });

  it("cross-tenant: A'nın paketi B'ye görünmez; misafir yazamaz", async () => {
    const dsar = await dsarEkle(seed.A.tenantId, "TAMAMLANDI", true);
    const p = await paketEkle(seed.A.tenantId, dsar);
    const { rows: b } = await db.asUser(
      seed.B.userId,
      `select id from public.dsar_fulfillment_packages where id = $1`,
      [p.rows[0].id],
    );
    expect(b).toHaveLength(0);
    await expect(
      db.asUser(
        A_MISAFIR,
        `insert into public.dsar_fulfillment_packages (tenant_id, dsar_id, manifest, manifest_hash)
         values ($1, $2, ${MAN}, $3)`,
        [seed.A.tenantId, dsar, hex(3)],
      ),
    ).rejects.toThrow();
  });
});
