// DSAR kanıt paketi (M36 sonraki dilim): RLS + TAMAMLANDI guard + append-only +
// tek-paket + tenant tutarlılığı. PGlite gerçek migration'lara karşı. DB kripto
// DOĞRULAMAZ (çevrimdışı doğrulayıcının işi) — burada manifest/imza opak.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, seedTwoTenants, type TestDb } from "./helpers/pg";

let db: TestDb;
let seed: Awaited<ReturnType<typeof seedTwoTenants>>;
const A_MISAFIR = "a0000000-0000-0000-0000-000000000009";
const hex = (n: number) => n.toString(16).padStart(64, "0");
const MAN = `'{"schema":"KALKAN_DSAR_FULFILLMENT_V1"}'::jsonb`;
const STMT = `'{"schema":"KALKAN_SCITT_STATEMENT_V1","kind":"DSAR_FULFILLMENT"}'::jsonb`;

async function dsarEkle(tenantId: string, durum: string, kimlik: boolean) {
  const { rows } = await db.sql(
    `insert into public.data_subject_requests (tenant_id, tur, veri_sahibi_maskeli, veri_sahibi_hash, kimlik_dogrulandi, durum)
     values ($1, 'ERISIM', 'a***@x.com', $2, $3, $4) returning id`,
    [tenantId, hex(7), kimlik, durum],
  );
  return rows[0].id as string;
}
async function ledgerEkle(tenantId: string) {
  const { rows } = await db.sql(
    `insert into public.transparency_ledger_entries (tenant_id, statement_kind, statement_hash, signed_statement, leaf_hash)
     values ($1, 'DSAR_FULFILLMENT', $2, ${STMT}, $3) returning id, leaf_index`,
    [tenantId, hex(1), hex(101)],
  );
  return rows[0];
}
async function paketEkle(tenantId: string, dsarId: string, ledgerId: string, leafIndex: number) {
  return db.sql(
    `insert into public.dsar_fulfillment_packages (tenant_id, dsar_id, manifest, manifest_hash, aciklanan_kategoriler, signed_statement, ledger_entry_id, leaf_index)
     values ($1, $2, ${MAN}, $3, array['kimlik','iletisim'], ${STMT}, $4, $5) returning id`,
    [tenantId, dsarId, hex(1), ledgerId, leafIndex],
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
  it("TAMAMLANDI DSAR için paket mühürlenir + audit", async () => {
    const dsar = await dsarEkle(seed.A.tenantId, "TAMAMLANDI", true);
    const l = await ledgerEkle(seed.A.tenantId);
    const p = await paketEkle(seed.A.tenantId, dsar, l.id as string, Number(l.leaf_index));
    expect(p.rows[0].id).toBeTruthy();
    const audit = await db.sql(
      `select count(*)::int as n from public.audit_log where hedef_tablo = 'dsar_fulfillment_packages' and hedef_id = $1`,
      [p.rows[0].id],
    );
    expect(audit.rows[0].n).toBe(1);
  });

  it("TAMAMLANDI olmayan DSAR için paket reddedilir", async () => {
    const dsar = await dsarEkle(seed.A.tenantId, "ISLENIYOR", true);
    const l = await ledgerEkle(seed.A.tenantId);
    await expect(paketEkle(seed.A.tenantId, dsar, l.id as string, Number(l.leaf_index))).rejects.toThrow(/TAMAMLANDI/);
  });

  it("başka kiracının defter kaydıyla paket reddedilir", async () => {
    const dsar = await dsarEkle(seed.A.tenantId, "TAMAMLANDI", true);
    const lB = await ledgerEkle(seed.B.tenantId); // B'nin kaydı
    await expect(paketEkle(seed.A.tenantId, dsar, lB.id as string, Number(lB.leaf_index))).rejects.toThrow(
      /baska kiraciya/,
    );
  });

  it("bir DSAR için tek paket (ikinci reddedilir)", async () => {
    const dsar = await dsarEkle(seed.A.tenantId, "TAMAMLANDI", true);
    const l1 = await ledgerEkle(seed.A.tenantId);
    await paketEkle(seed.A.tenantId, dsar, l1.id as string, Number(l1.leaf_index));
    const l2 = await ledgerEkle(seed.A.tenantId);
    await expect(paketEkle(seed.A.tenantId, dsar, l2.id as string, Number(l2.leaf_index))).rejects.toThrow();
  });

  it("append-only: UPDATE reddedilir", async () => {
    const dsar = await dsarEkle(seed.A.tenantId, "TAMAMLANDI", true);
    const l = await ledgerEkle(seed.A.tenantId);
    const p = await paketEkle(seed.A.tenantId, dsar, l.id as string, Number(l.leaf_index));
    await expect(
      db.sql(`update public.dsar_fulfillment_packages set manifest_hash = $2 where id = $1`, [p.rows[0].id, hex(9)]),
    ).rejects.toThrow(/append-only/);
  });

  it("cross-tenant: A'nın paketi B'ye görünmez; misafir yazamaz", async () => {
    const dsar = await dsarEkle(seed.A.tenantId, "TAMAMLANDI", true);
    const l = await ledgerEkle(seed.A.tenantId);
    const p = await paketEkle(seed.A.tenantId, dsar, l.id as string, Number(l.leaf_index));
    const { rows: b } = await db.asUser(
      seed.B.userId,
      `select id from public.dsar_fulfillment_packages where id = $1`,
      [p.rows[0].id],
    );
    expect(b).toHaveLength(0);
    await expect(
      db.asUser(
        A_MISAFIR,
        `insert into public.dsar_fulfillment_packages (tenant_id, dsar_id, manifest, manifest_hash, signed_statement, ledger_entry_id, leaf_index)
         values ($1, $2, ${MAN}, $3, ${STMT}, $4, 0)`,
        [seed.A.tenantId, dsar, hex(2), l.id],
      ),
    ).rejects.toThrow();
  });
});
