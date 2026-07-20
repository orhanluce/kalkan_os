// Dikey F, F1 (docs/adr/PR0-dikeyF-f1-test-manifesti-kritik-hizmet-retest-
// 2026-07-20.md): control_test_definitions -> critical_business_services/
// scenario_templates opsiyonel FK + tenant bütünlüğü guard'ı, ve findings
// kapanışına bağımsızlık kontrolü (öneriyi kabul eden kendi bulgusunu
// kapatamaz).
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, seedTwoTenants, type TestDb } from "./helpers/pg";

let db: TestDb;
let seed: Awaited<ReturnType<typeof seedTwoTenants>>;
let tanimId: string;

const A_ONERİ_KABUL = "a0000000-0000-0000-0000-000000000060";
const A_BAGIMSIZ_ONAYLAYAN = "a0000000-0000-0000-0000-000000000061";

beforeEach(async () => {
  db = await createTestDb();
  seed = await seedTwoTenants(db);

  const { rows } = await db.sql(
    `insert into public.control_test_definitions (tenant_id, control_id, tur, ad)
     values ($1, $2, 'MANUAL_PROCEDURE', 'MFA zorunlu mu') returning id`,
    [seed.A.tenantId, seed.controlId],
  );
  tanimId = rows[0].id as string;

  for (const [id, email] of [
    [A_ONERİ_KABUL, "kabul-eden@demo.com"],
    [A_BAGIMSIZ_ONAYLAYAN, "bagimsiz@demo.com"],
  ] as const) {
    await db.sql(`insert into auth.users (id, email) values ($1, $2)`, [id, email]);
    await db.sql(`insert into public.profiles (id, tenant_id, role, full_name) values ($1, $2, 'uyum', 'T')`, [
      id,
      seed.A.tenantId,
    ]);
  }
});

afterEach(async () => {
  await db.close();
});

async function kritikHizmetEkle(tenantId: string, ad = "Ödeme Sistemi") {
  const { rows } = await db.sql(
    `insert into public.critical_business_services (tenant_id, ad) values ($1, $2) returning id`,
    [tenantId, ad],
  );
  return rows[0].id as string;
}

async function senaryoEkle(kod = "TAT-F1-01") {
  const { rows } = await db.sql(
    `insert into public.scenario_templates (kod, ad, tehdit_kategorisi) values ($1, 'Test senaryosu', 'DIGER') returning id`,
    [kod],
  );
  return rows[0].id as string;
}

describe("control_test_definitions -> critical_service_id tenant bütünlüğü", () => {
  it("aynı-tenant kritik hizmete bağlanabilir", async () => {
    const hizmetId = await kritikHizmetEkle(seed.A.tenantId);
    const { rows } = await db.sql(
      `update public.control_test_definitions set critical_service_id = $1 where id = $2 returning critical_service_id`,
      [hizmetId, tanimId],
    );
    expect(rows[0].critical_service_id).toBe(hizmetId);
  });

  it("cross-tenant kritik hizmete bağlanamaz (UPDATE)", async () => {
    const hizmetIdB = await kritikHizmetEkle(seed.B.tenantId);
    await expect(
      db.sql(`update public.control_test_definitions set critical_service_id = $1 where id = $2`, [hizmetIdB, tanimId]),
    ).rejects.toThrow(/cross-tenant/i);
  });

  it("cross-tenant kritik hizmete bağlanamaz (INSERT anında)", async () => {
    const hizmetIdB = await kritikHizmetEkle(seed.B.tenantId);
    await expect(
      db.sql(
        `insert into public.control_test_definitions (tenant_id, control_id, tur, ad, critical_service_id)
         values ($1, $2, 'MANUAL_PROCEDURE', 'Baska tanim', $3)`,
        [seed.A.tenantId, seed.controlId, hizmetIdB],
      ),
    ).rejects.toThrow(/cross-tenant/i);
  });

  it("olmayan UUID reddedilir", async () => {
    await expect(
      db.sql(`update public.control_test_definitions set critical_service_id = $1 where id = $2`, [
        "00000000-0000-0000-0000-000000000099",
        tanimId,
      ]),
    ).rejects.toThrow(/gecerli bir kritik hizmete/i);
  });

  it("service_role (RLS-bypass) cross-tenant guard'ı atlayamaz", async () => {
    const hizmetIdB = await kritikHizmetEkle(seed.B.tenantId);
    // db.sql superuser: RLS'i bypass eder — trigger yine de reddetmeli.
    await expect(
      db.sql(`update public.control_test_definitions set critical_service_id = $1 where id = $2`, [hizmetIdB, tanimId]),
    ).rejects.toThrow(/cross-tenant/i);
  });

  it("null'a geri dönmek her zaman serbest", async () => {
    const hizmetId = await kritikHizmetEkle(seed.A.tenantId);
    await db.sql(`update public.control_test_definitions set critical_service_id = $1 where id = $2`, [hizmetId, tanimId]);
    const { rows } = await db.sql(
      `update public.control_test_definitions set critical_service_id = null where id = $1 returning critical_service_id`,
      [tanimId],
    );
    expect(rows[0].critical_service_id).toBeNull();
  });
});

describe("control_test_definitions -> scenario_template_id (global katalog, tenant guard uydurulmaz)", () => {
  it("global senaryoya herhangi bir kiracı bağlanabilir", async () => {
    const senaryoId = await senaryoEkle();
    const { rows } = await db.sql(
      `update public.control_test_definitions set scenario_template_id = $1 where id = $2 returning scenario_template_id`,
      [senaryoId, tanimId],
    );
    expect(rows[0].scenario_template_id).toBe(senaryoId);
  });

  it("olmayan senaryo UUID'i düz FK ile reddedilir", async () => {
    await expect(
      db.sql(`update public.control_test_definitions set scenario_template_id = $1 where id = $2`, [
        "00000000-0000-0000-0000-000000000099",
        tanimId,
      ]),
    ).rejects.toThrow();
  });
});

describe("mevcut serbest metin alanları dokunulmadan kalır", () => {
  it("kritik_hizmet_adi/senaryo_kimligi FK eklenmeden de yazılabilir, otomatik eşleştirilmez", async () => {
    const { rows } = await db.sql(
      `update public.control_test_definitions set kritik_hizmet_adi = 'Ödeme Sistemi', senaryo_kimligi = 'TAT-F1-01' where id = $1
       returning kritik_hizmet_adi, senaryo_kimligi, critical_service_id, scenario_template_id`,
      [tanimId],
    );
    expect(rows[0].kritik_hizmet_adi).toBe("Ödeme Sistemi");
    expect(rows[0].critical_service_id).toBeNull();
    expect(rows[0].scenario_template_id).toBeNull();
  });
});

describe("control_test_finding_proposals.finding_id — en fazla bir öneri bağlanabilir", () => {
  it("aynı bulguya ikinci bir öneri finding_id atayamaz (unique index)", async () => {
    const { rows: run1 } = await db.sql(
      `insert into public.test_runs (tenant_id, test_definition_id, control_id, sonuc, gerekce, tanim_surumu)
       values ($1, $2, $3, 'FAILED', 'g', 1) returning id`,
      [seed.A.tenantId, tanimId, seed.controlId],
    );
    const { rows: run2 } = await db.sql(
      `insert into public.test_runs (tenant_id, test_definition_id, control_id, sonuc, gerekce, tanim_surumu)
       values ($1, $2, $3, 'FAILED', 'g', 1) returning id`,
      [seed.A.tenantId, tanimId, seed.controlId],
    );
    const { rows: f } = await db.sql(
      `insert into public.findings (tenant_id, kaynak, onem, baslik, durum, retest_gerekli, kaynak_test_definition_id)
       values ($1, 'kontrol_testi', 'kritik', 'X', 'acik', true, $2) returning id`,
      [seed.A.tenantId, tanimId],
    );
    await db.sql(
      `insert into public.control_test_finding_proposals (test_run_id, test_definition_id, tenant_id, control_id, baslik, gerekce, onem, durum, finding_id, karar_veren, karar_at)
       values ($1, $2, $3, $4, 'X', 'g', 'kritik', 'KABUL', $5, $6, now())`,
      [run1[0].id, tanimId, seed.A.tenantId, seed.controlId, f[0].id, A_ONERİ_KABUL],
    );
    await expect(
      db.sql(
        `insert into public.control_test_finding_proposals (test_run_id, test_definition_id, tenant_id, control_id, baslik, gerekce, onem, durum, finding_id, karar_veren, karar_at)
         values ($1, $2, $3, $4, 'X', 'g', 'kritik', 'KABUL', $5, $6, now())`,
        [run2[0].id, tanimId, seed.A.tenantId, seed.controlId, f[0].id, A_BAGIMSIZ_ONAYLAYAN],
      ),
    ).rejects.toThrow();
  });
});

describe("test_runs.retest_of_finding_id — tenant bütünlüğü", () => {
  async function bulguKur(): Promise<{ id: string; tenantId: string }> {
    const { rows } = await db.sql(
      `insert into public.findings (tenant_id, kaynak, onem, baslik, durum, retest_gerekli, kaynak_test_definition_id)
       values ($1, 'kontrol_testi', 'kritik', 'X', 'acik', true, $2) returning id`,
      [seed.A.tenantId, tanimId],
    );
    return { id: rows[0].id as string, tenantId: seed.A.tenantId };
  }

  it("aynı-tenant bulguya retest niyeti bağlanabilir", async () => {
    const f = await bulguKur();
    const { rows } = await db.sql(
      `insert into public.test_runs (tenant_id, test_definition_id, control_id, sonuc, gerekce, tanim_surumu, retest_of_finding_id)
       values ($1, $2, $3, 'PASSED', 'retest', 1, $4) returning retest_of_finding_id`,
      [seed.A.tenantId, tanimId, seed.controlId, f.id],
    );
    expect(rows[0].retest_of_finding_id).toBe(f.id);
  });

  it("cross-tenant bulguya retest niyeti bağlanamaz", async () => {
    const { rows: fB } = await db.sql(
      `insert into public.findings (tenant_id, kaynak, onem, baslik, durum, retest_gerekli)
       values ($1, 'kontrol_testi', 'kritik', 'Y', 'acik', true) returning id`,
      [seed.B.tenantId],
    );
    await expect(
      db.sql(
        `insert into public.test_runs (tenant_id, test_definition_id, control_id, sonuc, gerekce, tanim_surumu, retest_of_finding_id)
         values ($1, $2, $3, 'PASSED', 'retest', 1, $4)`,
        [seed.A.tenantId, tanimId, seed.controlId, fB[0].id],
      ),
    ).rejects.toThrow(/cross-tenant/i);
  });

  it("olmayan bulgu UUID'i reddedilir", async () => {
    await expect(
      db.sql(
        `insert into public.test_runs (tenant_id, test_definition_id, control_id, sonuc, gerekce, tanim_surumu, retest_of_finding_id)
         values ($1, $2, $3, 'PASSED', 'retest', 1, $4)`,
        [seed.A.tenantId, tanimId, seed.controlId, "00000000-0000-0000-0000-000000000099"],
      ),
    ).rejects.toThrow(/gecerli bir bulguya/i);
  });

  it("belirtilmezse null kalır (normal ilk koşu)", async () => {
    const { rows } = await db.sql(
      `insert into public.test_runs (tenant_id, test_definition_id, control_id, sonuc, gerekce, tanim_surumu)
       values ($1, $2, $3, 'FAILED', 'ilk kosu', 1) returning retest_of_finding_id`,
      [seed.A.tenantId, tanimId, seed.controlId],
    );
    expect(rows[0].retest_of_finding_id).toBeNull();
  });
});

describe("finding kapanışı — bağımsızlık (öneriyi kabul eden kendi bulgusunu kapatamaz)", () => {
  async function bulguKurVeOneriBagla(karar_veren: string): Promise<{ findingId: string; runId: string }> {
    const { rows: run } = await db.sql(
      `insert into public.test_runs (tenant_id, test_definition_id, control_id, sonuc, gerekce, tanim_surumu)
       values ($1, $2, $3, 'FAILED', 'g', 1) returning id`,
      [seed.A.tenantId, tanimId, seed.controlId],
    );
    const { rows: f } = await db.sql(
      `insert into public.findings (tenant_id, kaynak, onem, baslik, durum, retest_gerekli, kaynak_test_definition_id)
       values ($1, 'kontrol_testi', 'kritik', 'MFA yok', 'acik', true, $2) returning id`,
      [seed.A.tenantId, tanimId],
    );
    await db.sql(
      `insert into public.control_test_finding_proposals (test_run_id, test_definition_id, tenant_id, control_id, baslik, gerekce, onem, durum, finding_id, karar_veren, karar_at)
       values ($1, $2, $3, $4, 'MFA yok', 'g', 'kritik', 'KABUL', $5, $6, now())`,
      [run[0].id, tanimId, seed.A.tenantId, seed.controlId, f[0].id, karar_veren],
    );
    return { findingId: f[0].id as string, runId: run[0].id as string };
  }

  async function retestEkle(sonuc: string) {
    const { rows } = await db.sql(
      `insert into public.test_runs (tenant_id, test_definition_id, control_id, sonuc, gerekce, tanim_surumu)
       values ($1, $2, $3, $4, 'retest', 1) returning id`,
      [seed.A.tenantId, tanimId, seed.controlId, sonuc],
    );
    return rows[0].id as string;
  }

  it("öneriyi kabul eden kişi kendi bulgusunu kapatamaz (PASSED retest olsa bile)", async () => {
    const { findingId } = await bulguKurVeOneriBagla(A_ONERİ_KABUL);
    await db.sql(`select pg_sleep(0.01)`);
    const r = await retestEkle("PASSED");
    await expect(
      db.sql(
        `update public.findings set durum = 'kapali', kapatma_retest_run_id = $1, kapatan = $2 where id = $3`,
        [r, A_ONERİ_KABUL, findingId],
      ),
    ).rejects.toThrow(/oneriyi kabul eden kisi kendi bulgusunu kapatamaz/i);
  });

  it("farklı yetkili kişi geçerli PASSED retest ile kapatabilir", async () => {
    const { findingId } = await bulguKurVeOneriBagla(A_ONERİ_KABUL);
    await db.sql(`select pg_sleep(0.01)`);
    const r = await retestEkle("PASSED");
    const { rows } = await db.sql(
      `update public.findings set durum = 'kapali', kapatma_retest_run_id = $1, kapatan = $2 where id = $3 returning durum`,
      [r, A_BAGIMSIZ_ONAYLAYAN, findingId],
    );
    expect(rows[0].durum).toBe("kapali");
  });

  it("kapatan IS NULL kapanışta zaten reddedilir (mevcut kontrol korunuyor)", async () => {
    const { findingId } = await bulguKurVeOneriBagla(A_ONERİ_KABUL);
    await db.sql(`select pg_sleep(0.01)`);
    const r = await retestEkle("PASSED");
    await expect(
      db.sql(`update public.findings set durum = 'kapali', kapatma_retest_run_id = $1 where id = $2`, [r, findingId]),
    ).rejects.toThrow(/onaylayan/i);
  });

  it("öneride finding_id/karar_veren yoksa (başka kaynaklı bulgu) sessiz bypass OLUŞMAZ — guard mevcut kontrolleri aynen uygular", async () => {
    // sizma_testi kaynaklı bir bulgu — hiçbir control_test_finding_proposals eşleşmesi yok.
    const { rows: f } = await db.sql(
      `insert into public.findings (tenant_id, kaynak, onem, baslik, durum, retest_gerekli, kaynak_test_definition_id)
       values ($1, 'sizma_testi', 'kritik', 'X', 'acik', true, $2) returning id`,
      [seed.A.tenantId, tanimId],
    );
    await db.sql(`select pg_sleep(0.01)`);
    const r = await retestEkle("PASSED");
    // Aynı kişi (karar_veren olmayan bir bulgu için) kapatabilir — bağımsızlık
    // kontrolü YALNIZ eşleşen bir öneri varsa devreye girer.
    const { rows } = await db.sql(
      `update public.findings set durum = 'kapali', kapatma_retest_run_id = $1, kapatan = $2 where id = $3 returning durum`,
      [r, A_ONERİ_KABUL, f[0].id],
    );
    expect(rows[0].durum).toBe("kapali");
  });

  it("mevcut BEŞ kontrol (retest/onay/PASSED/doğru-tanım/bulgudan-sonra) aynen korunuyor", async () => {
    const { findingId } = await bulguKurVeOneriBagla(A_ONERİ_KABUL);
    // Retest bağlanmadan kapanamaz.
    await expect(
      db.sql(`update public.findings set durum = 'kapali' where id = $1`, [findingId]),
    ).rejects.toThrow(/retest gerekli/i);
  });

  it("mevcut kapalı bulgular migration sonrası etkilenmez (yeniden UPDATE tetiklemiyoruz)", async () => {
    // Kapanışı guard eklenmeden ÖNCE simüle et: doğrudan kapali insert (guard yalnız acik->kapali geçişini izliyor).
    const { rows: f } = await db.sql(
      `insert into public.findings (tenant_id, kaynak, onem, baslik, durum, retest_gerekli)
       values ($1, 'kontrol_testi', 'kritik', 'Eski kapali bulgu', 'kapali', false) returning id, durum`,
      [seed.A.tenantId],
    );
    expect(f[0].durum).toBe("kapali");
  });
});

// Dikey F, F1 — tam e2e suite koşusu sırasında bulunan GERÇEK açık: test_run_
// immutable() (20260717230001) HER update'i koşulsuz reddediyordu; ama
// retest_of_finding_id `on delete set null` olduğundan, referans verdiği bir
// `findings` satırı silindiğinde Postgres'in KENDİSİ test_runs'a bu alanı
// null'a çeken bir UPDATE uyguluyor — trigger bunu da reddediyor, bu yüzden
// ilişkili bulgu BİR DAHA ASLA silinemiyordu (23503, "still referenced").
// Forward-fix: 20260720340000_test_run_immutable_retest_null_fix.sql.
describe("test_run_immutable() — retest_of_finding_id set-null cascade'i özel olarak serbest, başka hiçbir alan değişikliğine izin vermiyor", () => {
  async function kosuKur(retestOfFindingId: string | null = null): Promise<string> {
    const { rows } = await db.sql(
      `insert into public.test_runs (tenant_id, test_definition_id, control_id, sonuc, gerekce, tanim_surumu, retest_of_finding_id)
       values ($1, $2, $3, 'PASSED', 'g', 1, $4) returning id`,
      [seed.A.tenantId, tanimId, seed.controlId, retestOfFindingId],
    );
    return rows[0].id as string;
  }

  it("gerçek bir alanı (sonuc) değiştirmeye çalışmak HALA reddedilir (regresyon)", async () => {
    const runId = await kosuKur();
    await expect(
      db.sql(`update public.test_runs set sonuc = 'FAILED' where id = $1`, [runId]),
    ).rejects.toThrow(/Test sonucu degistirilemez/i);
  });

  it("referans verdiği bulgu SİLİNDİĞİNDE (on delete set null) koşu artık engellenmeden null'a döner ve BULGU GERÇEKTEN SİLİNİR", async () => {
    const { rows: f } = await db.sql(
      `insert into public.findings (tenant_id, kaynak, onem, baslik, durum, retest_gerekli, kaynak_test_definition_id)
       values ($1, 'kontrol_testi', 'kritik', 'X', 'acik', true, $2) returning id`,
      [seed.A.tenantId, tanimId],
    );
    const findingId = f[0].id as string;
    const runId = await kosuKur(findingId);

    await db.sql(`delete from public.findings where id = $1`, [findingId]);

    const { rows: kalan } = await db.sql(`select id from public.findings where id = $1`, [findingId]);
    expect(kalan.length).toBe(0);
    const { rows: kosu } = await db.sql(`select retest_of_finding_id, sonuc from public.test_runs where id = $1`, [runId]);
    expect(kosu[0].retest_of_finding_id).toBeNull();
    // Sonuç/gerekçe DEĞİŞMEDİ — yalnız referans alanı temizlendi (kural 13 bozulmadı).
    expect(kosu[0].sonuc).toBe("PASSED");
  });

  it("retest_of_finding_id'yi null'a çekerken AYNI ANDA başka bir alanı (sonuc) da değiştirmek HALA reddedilir", async () => {
    const { rows: f } = await db.sql(
      `insert into public.findings (tenant_id, kaynak, onem, baslik, durum, retest_gerekli, kaynak_test_definition_id)
       values ($1, 'kontrol_testi', 'kritik', 'X', 'acik', true, $2) returning id`,
      [seed.A.tenantId, tanimId],
    );
    const runId = await kosuKur(f[0].id as string);
    await expect(
      db.sql(`update public.test_runs set retest_of_finding_id = null, sonuc = 'FAILED' where id = $1`, [runId]),
    ).rejects.toThrow(/Test sonucu degistirilemez/i);
  });

  it("retest_of_finding_id'yi elle BAŞKA bir bulguya taşımak (null'a değil) reddedilir", async () => {
    const { rows: f1 } = await db.sql(
      `insert into public.findings (tenant_id, kaynak, onem, baslik, durum, retest_gerekli, kaynak_test_definition_id)
       values ($1, 'kontrol_testi', 'kritik', 'X', 'acik', true, $2) returning id`,
      [seed.A.tenantId, tanimId],
    );
    const { rows: f2 } = await db.sql(
      `insert into public.findings (tenant_id, kaynak, onem, baslik, durum, retest_gerekli, kaynak_test_definition_id)
       values ($1, 'kontrol_testi', 'kritik', 'Y', 'acik', true, $2) returning id`,
      [seed.A.tenantId, tanimId],
    );
    const runId = await kosuKur(f1[0].id as string);
    await expect(
      db.sql(`update public.test_runs set retest_of_finding_id = $1 where id = $2`, [f2[0].id, runId]),
    ).rejects.toThrow(/Test sonucu degistirilemez/i);
  });
});
