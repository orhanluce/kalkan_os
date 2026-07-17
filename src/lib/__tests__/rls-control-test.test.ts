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

describe("verified closure guard (kural 14) — bulgu retest+onay olmadan kapanamaz", () => {
  // Bir kontrol testi bulgusu kurar, kapatmayı çeşitli eksik hallerde dener.
  async function bulguKur(retestGerekli = true): Promise<string> {
    const { rows } = await db.sql(
      `insert into public.findings
         (tenant_id, kaynak, onem, baslik, durum, retest_gerekli, kaynak_test_definition_id)
       values ($1, 'kontrol_testi', 'kritik', 'MFA yok', 'acik', $2, $3) returning id`,
      [seed.A.tenantId, retestGerekli, tanimId],
    );
    return rows[0].id as string;
  }

  async function retestEkle(sonuc: string): Promise<string> {
    const { rows } = await db.sql(
      `insert into public.test_runs (tenant_id, test_definition_id, control_id, sonuc, gerekce, tanim_surumu)
       values ($1, $2, $3, $4, 'retest', 1) returning id`,
      [seed.A.tenantId, tanimId, seed.controlId, sonuc],
    );
    return rows[0].id as string;
  }

  it("retest bağlanmadan kapanamaz", async () => {
    const f = await bulguKur();
    await expect(
      db.sql(`update public.findings set durum = 'kapali' where id = $1`, [f]),
    ).rejects.toThrow(/retest gerekli/i);
  });

  it("onaylayan yok ise kapanamaz", async () => {
    const f = await bulguKur();
    const r = await retestEkle("PASSED");
    await expect(
      db.sql(`update public.findings set durum = 'kapali', kapatma_retest_run_id = $1 where id = $2`, [
        r,
        f,
      ]),
    ).rejects.toThrow(/onaylayan/i);
  });

  it("bağlanan retest PASSED değilse kapanamaz — başarısız retest kapatmaz", async () => {
    const f = await bulguKur();
    const r = await retestEkle("FAILED");
    await expect(
      db.sql(
        `update public.findings set durum = 'kapali', kapatma_retest_run_id = $1, kapatan = $2 where id = $3`,
        [r, seed.A.userId, f],
      ),
    ).rejects.toThrow(/PASSED degil/i);
  });

  it("UNKNOWN retest de kapatmaz — 'ölçemedik' başarılı retest değildir", async () => {
    const f = await bulguKur();
    const r = await retestEkle("UNKNOWN");
    await expect(
      db.sql(
        `update public.findings set durum = 'kapali', kapatma_retest_run_id = $1, kapatan = $2 where id = $3`,
        [r, seed.A.userId, f],
      ),
    ).rejects.toThrow(/PASSED degil/i);
  });

  it("başka test tanımının retesti kapatmaz", async () => {
    const { rows: t2 } = await db.sql(
      `insert into public.control_test_definitions (tenant_id, control_id, tur, ad)
       values ($1, $2, 'CONFIG_ASSERTION', 'Baska test') returning id`,
      [seed.A.tenantId, seed.controlId],
    );
    const f = await bulguKur();
    const { rows: r } = await db.sql(
      `insert into public.test_runs (tenant_id, test_definition_id, control_id, sonuc, gerekce, tanim_surumu)
       values ($1, $2, $3, 'PASSED', 'baska', 1) returning id`,
      [seed.A.tenantId, t2[0].id, seed.controlId],
    );
    await expect(
      db.sql(
        `update public.findings set durum = 'kapali', kapatma_retest_run_id = $1, kapatan = $2 where id = $3`,
        [r[0].id, seed.A.userId, f],
      ),
    ).rejects.toThrow(/baska bir test tanimina/i);
  });

  it("bulgudan ÖNCE koşmuş bir PASSED kapatmaz", async () => {
    // Bulgu oluşmadan önce geçmiş bir test, bulguyu kapatmaz — o başarısızlık
    // sonrasında yeniden geçildiği kanıtlanmalı.
    const r = await retestEkle("PASSED"); // önce retest
    // Küçük bir gecikme yerine bulguyu SONRA kur; created_at now() ile sonra olur.
    await db.sql(`select pg_sleep(0.01)`);
    const f = await bulguKur();
    await expect(
      db.sql(
        `update public.findings set durum = 'kapali', kapatma_retest_run_id = $1, kapatan = $2 where id = $3`,
        [r, seed.A.userId, f],
      ),
    ).rejects.toThrow(/bulgudan ONCE/i);
  });

  it("başarılı retest + onay ile KAPANIR (mutlu yol)", async () => {
    const f = await bulguKur();
    await db.sql(`select pg_sleep(0.01)`);
    const r = await retestEkle("PASSED");
    const { rows } = await db.sql(
      `update public.findings set durum = 'kapali', kapatma_retest_run_id = $1, kapatan = $2, kapatma_onay_at = now()
       where id = $3 returning durum`,
      [r, seed.A.userId, f],
    );
    expect(rows[0].durum).toBe("kapali");
  });

  it("ticket/aksiyon düzenlemek bulguyu kapatmaz — guard yalnız durum geçişinde", async () => {
    // aksiyon_plani güncellemek durumu değiştirmez, guard tetiklenmez ve
    // bulgu 'acik' kalır. "Ticket kapatmak kontrol kapatmaz."
    const f = await bulguKur();
    const { rows } = await db.sql(
      `update public.findings set aksiyon_plani = 'Ekip MFA kuruyor' where id = $1 returning durum`,
      [f],
    );
    expect(rows[0].durum).toBe("acik");
  });

  it("retest_gerekli olmayan bulgu serbest kapanır — kural 14 yalnız gerektirende", async () => {
    const f = await bulguKur(false);
    const { rows } = await db.sql(
      `update public.findings set durum = 'kapali' where id = $1 returning durum`,
      [f],
    );
    expect(rows[0].durum).toBe("kapali");
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
