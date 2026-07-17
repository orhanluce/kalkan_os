// M12: kontrol test motoru — kiracı izolasyonu, kural 13 durum sözlüğü,
// append-only koşular ve durum türetimi (docs/ROADMAP.md M12).
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { kontrolGuvenceDurumu, type TestSonuc } from "../control-test";
import { createTestDb, seedTwoTenants, type TestDb } from "./helpers/pg";

let db: TestDb;
let seed: Awaited<ReturnType<typeof seedTwoTenants>>;
let tanimId: string;

beforeEach(async () => {
  db = await createTestDb();
  seed = await seedTwoTenants(db);

  const { rows } = await db.sql(
    `insert into public.control_test_definitions (tenant_id, control_id, tur, ad)
     values ($1, $2, 'MANUAL_PROCEDURE', 'MFA zorunlu mu') returning id`,
    [seed.A.tenantId, seed.controlId],
  );
  tanimId = rows[0].id as string;
});

afterEach(async () => {
  await db.close();
});

function kosuEkle(sonuc: string, patch: Record<string, unknown> = {}) {
  const alanlar: Record<string, unknown> = {
    tenant_id: seed.A.tenantId,
    test_definition_id: tanimId,
    control_id: seed.controlId,
    sonuc,
    gerekce: "test",
    tanim_surumu: 1,
    ...patch,
  };
  const k = Object.keys(alanlar);
  return db.sql(
    `insert into public.test_runs (${k.join(", ")}) values (${k.map((_, i) => `$${i + 1}`).join(", ")}) returning id, seq`,
    Object.values(alanlar),
  );
}

describe("kiracı izolasyonu (kural 1)", () => {
  it("kiracı kendi test tanımını görür, başkası göremez", async () => {
    const { rows: kendi } = await db.asUser(
      seed.A.userId,
      `select id from public.control_test_definitions where id = $1`,
      [tanimId],
    );
    expect(kendi).toHaveLength(1);
    const { rows: baska } = await db.asUser(
      seed.B.userId,
      `select id from public.control_test_definitions where id = $1`,
      [tanimId],
    );
    expect(baska).toHaveLength(0);
  });

  it("test koşusu da kiracıyla sınırlı", async () => {
    await kosuEkle("PASSED");
    const { rows } = await db.asUser(seed.B.userId, `select id from public.test_runs`);
    expect(rows).toHaveLength(0);
  });
});

describe("kural 13: durum sözlüğü (birleştirilemez)", () => {
  it("beş geçerli durum da yazılabilir", async () => {
    for (const s of ["PASSED", "FAILED", "UNKNOWN", "STALE", "EXCEPTION"]) {
      const { rows } = await kosuEkle(s);
      expect(rows).toHaveLength(1);
    }
  });

  it("sözlük dışı durum reddedilir — 'basarisiz' gibi uydurma değer yazılamaz", async () => {
    await expect(kosuEkle("basarisiz")).rejects.toThrow();
  });

  it("gerekçesiz sonuç yazılamaz (kural 11)", async () => {
    await expect(kosuEkle("FAILED", { gerekce: null })).rejects.toThrow();
  });
});

describe("append-only (kural 2): test sonucu tarihsel olgudur", () => {
  it("koşu UPDATE edilemez", async () => {
    const { rows } = await kosuEkle("FAILED");
    await expect(
      db.asUser(seed.A.userId, `update public.test_runs set sonuc = 'PASSED' where id = $1`, [
        rows[0].id,
      ]),
    ).rejects.toThrow();
  });

  it("koşu DELETE edilemez", async () => {
    const { rows } = await kosuEkle("FAILED");
    await expect(
      db.asUser(seed.A.userId, `delete from public.test_runs where id = $1`, [rows[0].id]),
    ).rejects.toThrow();
  });

  it("service_role bile UPDATE edemez — trigger rolden bağımsız (canlı açık kapandı)", async () => {
    // db.sql superuser: RLS ve revoke'u bypass eder. Immutability trigger'ı
    // buna rağmen tutmalı — canlıda service_role'ün UPDATE geçtiği açık bu
    // trigger'la kapandı.
    const { rows } = await kosuEkle("FAILED");
    await expect(
      db.sql(`update public.test_runs set sonuc = 'PASSED' where id = $1`, [rows[0].id]),
    ).rejects.toThrow(/degistirilemez/i);
  });

  it("cascade DELETE çalışır — tanım silinince koşu da gider (trigger bloke etmez)", async () => {
    await kosuEkle("PASSED");
    await db.sql(`delete from public.control_test_definitions where id = $1`, [tanimId]);
    const { rows } = await db.sql(`select id from public.test_runs where test_definition_id = $1`, [
      tanimId,
    ]);
    expect(rows).toHaveLength(0);
  });
});

describe("kontrol_son_test_sonuclari + TS birleştirme", () => {
  it("her tanım için EN SON koşuyu döndürür", async () => {
    await kosuEkle("PASSED");
    await kosuEkle("FAILED"); // aynı tanım, daha yeni
    const { rows } = await db.sql(`select * from public.kontrol_son_test_sonuclari($1)`, [
      seed.controlId,
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].sonuc).toBe("FAILED");
  });

  it("iki tanımın en son sonuçları TS'te birleşince en kötüsü kazanır", async () => {
    // İkinci bir tanım + koşu.
    const { rows: t2 } = await db.sql(
      `insert into public.control_test_definitions (tenant_id, control_id, tur, ad)
       values ($1, $2, 'CONFIG_ASSERTION', 'Parola politikasi') returning id`,
      [seed.A.tenantId, seed.controlId],
    );
    await kosuEkle("PASSED");
    await kosuEkle("STALE", { test_definition_id: t2[0].id });

    const { rows } = await db.sql(`select sonuc from public.kontrol_son_test_sonuclari($1)`, [
      seed.controlId,
    ]);
    const sonuclar = rows.map((r) => r.sonuc as TestSonuc);
    // PASSED + STALE -> STALE (birleştirme TS'te, SQL yalnız ham malzeme verir).
    expect(kontrolGuvenceDurumu(sonuclar)).toBe("STALE");
  });

  it("hiç test yoksa NOT_TESTED", async () => {
    const { rows } = await db.sql(`select sonuc from public.kontrol_son_test_sonuclari($1)`, [
      seed.controlId,
    ]);
    expect(kontrolGuvenceDurumu(rows.map((r) => r.sonuc as TestSonuc))).toBe("NOT_TESTED");
  });
});
