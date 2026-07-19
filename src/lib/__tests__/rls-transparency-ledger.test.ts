// Şeffaflık defteri (G3): RLS + append-only hash zinciri + STH guard + durum
// türetimi. PGlite gerçek migration'lara karşı. DB kriptoyu DOĞRULAMAZ (bu
// çevrimdışı doğrulayıcının işi) — burada leaf_hash/imza opak hex/jsonb.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, seedTwoTenants, type TestDb } from "./helpers/pg";

let db: TestDb;
let seed: Awaited<ReturnType<typeof seedTwoTenants>>;
const A_MISAFIR = "a0000000-0000-0000-0000-000000000009";

const hex = (n: number) => n.toString(16).padStart(64, "0");
const STMT = `'{"schema":"KALKAN_SCITT_STATEMENT_V1"}'::jsonb`;
const JWK = `'{"kty":"EC","crv":"P-256","x":"x","y":"y"}'::jsonb`;

async function girdiEkle(tenantId: string, statementHash: string, leafHash: string) {
  return db.sql(
    `insert into public.transparency_ledger_entries (tenant_id, statement_kind, statement_hash, signed_statement, leaf_hash)
     values ($1, 'SIMULATION_MANIFEST', $2, ${STMT}, $3) returning id, leaf_index, previous_entry_hash, entry_hash`,
    [tenantId, statementHash, leafHash],
  );
}

async function checkpointEkle(tenantId: string, treeSize: number, saglayici: string | null) {
  return db.sql(
    `insert into public.transparency_checkpoints
       (tenant_id, tree_size, root_hash, sth_jws, sth_kid, sth_public_jwk, signer_ad, timestamp_saglayici)
     values ($1, $2, $3, 'aa..bb', 'local-dev-kid', ${JWK}, 'local-dev-es256', $4) returning id`,
    [tenantId, treeSize, hex(treeSize), saglayici],
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

describe("şeffaflık defteri — RLS + append-only + STH (G3)", () => {
  it("cross-tenant: A'nın kaydını B GÖREMEZ; misafir YAZAMAZ", async () => {
    const { rows } = await girdiEkle(seed.A.tenantId, hex(1), hex(101));
    const { rows: b } = await db.asUser(
      seed.B.userId,
      `select id from public.transparency_ledger_entries where id = $1`,
      [rows[0].id],
    );
    expect(b).toHaveLength(0);
    // denetci_misafir admin/uyum değil → insert reddi.
    await expect(
      db.asUser(
        A_MISAFIR,
        `insert into public.transparency_ledger_entries (tenant_id, statement_kind, statement_hash, signed_statement, leaf_hash)
         values ($1, 'X', $2, ${STMT}, $3)`,
        [seed.A.tenantId, hex(2), hex(102)],
      ),
    ).rejects.toThrow();
  });

  it("admin kayıt yazar; leaf_index 0'dan sıralı + hash zinciri kurulur", async () => {
    const a0 = await db.asUser(
      seed.A.userId,
      `insert into public.transparency_ledger_entries (tenant_id, statement_kind, statement_hash, signed_statement, leaf_hash)
       values ($1, 'SIMULATION_MANIFEST', $2, ${STMT}, $3) returning leaf_index, previous_entry_hash, entry_hash`,
      [seed.A.tenantId, hex(1), hex(101)],
    );
    const a1 = await db.asUser(
      seed.A.userId,
      `insert into public.transparency_ledger_entries (tenant_id, statement_kind, statement_hash, signed_statement, leaf_hash)
       values ($1, 'SIMULATION_MANIFEST', $2, ${STMT}, $3) returning leaf_index, previous_entry_hash, entry_hash`,
      [seed.A.tenantId, hex(2), hex(102)],
    );
    expect(Number(a0.rows[0].leaf_index)).toBe(0);
    expect(a0.rows[0].previous_entry_hash).toBeNull();
    expect(Number(a1.rows[0].leaf_index)).toBe(1);
    // İkinci kaydın previous_entry_hash'i birincinin entry_hash'i (zincir).
    expect(a1.rows[0].previous_entry_hash).toBe(a0.rows[0].entry_hash);
    // İstemci hash gönderemez zaten; seal deterministik ve boş değil.
    expect(String(a0.rows[0].entry_hash)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("append-only: UPDATE service_role dahil reddedilir", async () => {
    const { rows } = await girdiEkle(seed.A.tenantId, hex(1), hex(101));
    await expect(
      db.sql(`update public.transparency_ledger_entries set leaf_hash = $2 where id = $1`, [rows[0].id, hex(999)]),
    ).rejects.toThrow(/append-only/);
  });

  it("STH guard: yanlış tree_size reddedilir; doğru olan + audit yazılır", async () => {
    await girdiEkle(seed.A.tenantId, hex(1), hex(101));
    await girdiEkle(seed.A.tenantId, hex(2), hex(102));
    // Kütükte 2 kayıt var → tree_size 3 reddedilir.
    await expect(checkpointEkle(seed.A.tenantId, 3, null)).rejects.toThrow(/uyusmuyor/);
    const cp = await checkpointEkle(seed.A.tenantId, 2, null);
    expect(cp.rows[0].id).toBeTruthy();
    const audit = await db.sql(
      `select count(*)::int as n from public.audit_log where hedef_tablo = 'transparency_checkpoints' and hedef_id = $1`,
      [cp.rows[0].id],
    );
    expect(audit.rows[0].n).toBe(1);
  });

  it("durum türetimi: beklemede → defterde → (yerel damga yükseltmez) → nitelikli", async () => {
    const e0 = await girdiEkle(seed.A.tenantId, hex(1), hex(101));
    await girdiEkle(seed.A.tenantId, hex(2), hex(102));
    const entryId = e0.rows[0].id;
    const durum = async () =>
      (await db.sql(`select public.transparency_dogrulama_durumu($1) as d`, [entryId])).rows[0].d;

    expect(await durum()).toBe("defterde_beklemede");
    await checkpointEkle(seed.A.tenantId, 2, null);
    expect(await durum()).toBe("seffaflik_defterinde");
    // Yerel damga NİTELİKLİ değil → durum yükselmez.
    await checkpointEkle(seed.A.tenantId, 2, "local-dev-tsa");
    expect(await durum()).toBe("seffaflik_defterinde");
    // Nitelikli TSA → dis_zaman_damgali.
    await checkpointEkle(seed.A.tenantId, 2, "kamu-sm");
    expect(await durum()).toBe("dis_zaman_damgali");
  });
});
