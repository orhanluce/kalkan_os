// V2 PR-2b (ADR-V2-2): control_packs katalog RLS + dayanak guard'ı.
// Gerçek migration'lara karşı PGlite.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, seedTwoTenants, type TestDb } from "./helpers/pg";

let db: TestDb;
let seed: Awaited<ReturnType<typeof seedTwoTenants>>;

/** Bir paket + yayın sürümü kurar (superuser). */
async function paketKur(): Promise<string> {
  const { rows: p } = await db.sql(
    `insert into public.control_packs (kod, ad, audience) values ('CFO-BASE', 'CFO Baseline', 'CORPORATE_FINANCE') returning id`,
  );
  const { rows: v } = await db.sql(
    `insert into public.control_pack_versions (pack_id, surum, yayin_durumu) values ($1, 1, 'yayinlandi') returning id`,
    [p[0].id],
  );
  return v[0].id as string;
}

beforeEach(async () => {
  db = await createTestDb();
  seed = await seedTwoTenants(db);
});

afterEach(async () => {
  await db.close();
});

describe("control_packs katalog RLS", () => {
  it("authenticated kullanıcı paket kataloğunu OKUR (global referans, tenant'sız)", async () => {
    await paketKur();
    const { rows } = await db.asUser(seed.A.userId, `select kod, audience from public.control_packs`);
    expect(rows).toHaveLength(1);
    expect(rows[0].audience).toBe("CORPORATE_FINANCE");
  });

  it("istemci katalog YAZAMAZ (insert politikası yok — seed/service)", async () => {
    await expect(
      db.asUser(
        seed.A.userId,
        `insert into public.control_packs (kod, ad, audience) values ('X', 'X', 'BOTH')`,
      ),
    ).rejects.toThrow();
  });

  it("geçersiz audience check ile reddedilir", async () => {
    await expect(
      db.sql(`insert into public.control_packs (kod, ad, audience) values ('Y', 'Y', 'HERKES')`),
    ).rejects.toThrow();
  });
});

describe("pack_controls dayanak (basis) guard'ı — ADR-V2-2", () => {
  it("CONTRACTUAL kaynak referansı OLMADAN yazılamaz", async () => {
    const vid = await paketKur();
    await expect(
      db.sql(
        `insert into public.pack_controls (pack_version_id, control_id, basis)
         values ($1, $2, 'CONTRACTUAL')`,
        [vid, seed.controlId],
      ),
    ).rejects.toThrow(/kaynak referansi/);
  });

  it("BOARD_POLICY kaynak referansı OLMADAN yazılamaz", async () => {
    const vid = await paketKur();
    await expect(
      db.sql(
        `insert into public.pack_controls (pack_version_id, control_id, basis)
         values ($1, $2, 'BOARD_POLICY')`,
        [vid, seed.controlId],
      ),
    ).rejects.toThrow(/kaynak referansi/);
  });

  it("CONTRACTUAL referansla YAZILIR; LEGAL_MANDATORY ve BEST_PRACTICE referanssız yazılır", async () => {
    const vid = await paketKur();
    await db.sql(
      `insert into public.pack_controls (pack_version_id, control_id, basis, kaynak_referansi)
       values ($1, $2, 'CONTRACTUAL', 'Ana Sözleşme md.7')`,
      [vid, seed.controlId],
    );
    // Farklı sürüm gerekmez; aynı sürümde farklı kontrol olmadığından ikinci
    // paket sürümü kuralım LEGAL/BEST için.
    const { rows: v2 } = await db.sql(
      `insert into public.control_pack_versions
         (pack_id, surum, yayin_durumu)
       select pack_id, 2, 'taslak' from public.control_pack_versions where id = $1 returning id`,
      [vid],
    );
    await db.sql(
      `insert into public.pack_controls (pack_version_id, control_id, basis)
       values ($1, $2, 'LEGAL_MANDATORY')`,
      [v2[0].id, seed.controlId],
    );
    const { rows } = await db.sql(`select count(*)::int as n from public.pack_controls`);
    expect(rows[0].n).toBe(2);
  });

  it("geçersiz basis check ile reddedilir", async () => {
    const vid = await paketKur();
    await expect(
      db.sql(
        `insert into public.pack_controls (pack_version_id, control_id, basis)
         values ($1, $2, 'MORAL')`,
        [vid, seed.controlId],
      ),
    ).rejects.toThrow();
  });

  it("aynı sürümde aynı kontrol iki kez bağlanamaz (unique)", async () => {
    const vid = await paketKur();
    await db.sql(
      `insert into public.pack_controls (pack_version_id, control_id, basis)
       values ($1, $2, 'BEST_PRACTICE')`,
      [vid, seed.controlId],
    );
    await expect(
      db.sql(
        `insert into public.pack_controls (pack_version_id, control_id, basis)
         values ($1, $2, 'LEGAL_MANDATORY')`,
        [vid, seed.controlId],
      ),
    ).rejects.toThrow();
  });
});
