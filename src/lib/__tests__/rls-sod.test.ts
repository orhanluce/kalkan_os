// M16: Görevler Ayrılığı (SoD) motoru — kiracı izolasyonu, mevzuat durumu
// geçiş guard'ı (kural 3) ve çatışma durum makinesi (docs/ROADMAP.md M16).
//
// Bu dosyanın derdi: DB invariant'ları gerçekten tutuyor mu? "Talep eden
// kendi istisnasını onaylayamaz" ve "MITIGATED, başarılı testsiz olamaz"
// gibi kurallar route koduna bırakılırsa tek bir yanlış UPDATE onları deler;
// burada trigger'ın kendisini sınıyoruz.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, seedTwoTenants, type TestDb } from "./helpers/pg";

let db: TestDb;
let seed: Awaited<ReturnType<typeof seedTwoTenants>>;
let ruleId: string;
let tanimId: string;

beforeEach(async () => {
  db = await createTestDb();
  seed = await seedTwoTenants(db);

  const { rows: r } = await db.sql(
    `insert into public.sod_kurallari (tenant_id, kod, ad, onem, olusturan)
     values ($1, 'SOD-01', 'Talep eden onaylayamaz', 'kritik', $2) returning id`,
    [seed.A.tenantId, seed.A.userId],
  );
  ruleId = r[0].id as string;

  const { rows: t } = await db.sql(
    `insert into public.control_test_definitions (tenant_id, control_id, tur, ad)
     values ($1, $2, 'MANUAL_PROCEDURE', 'Telafi edici kontrol testi') returning id`,
    [seed.A.tenantId, seed.controlId],
  );
  tanimId = t[0].id as string;
});

afterEach(async () => {
  await db.close();
});

async function catismaEkle(patch: Record<string, unknown> = {}) {
  const alanlar: Record<string, unknown> = {
    tenant_id: seed.A.tenantId,
    rule_id: ruleId,
    kullanici_id: seed.A.userId,
    sistem_kapsami: "kalkan_os",
    onem: "kritik",
    fingerprint: "fp-" + Math.random().toString(36).slice(2),
    ...patch,
  };
  const kolonlar = Object.keys(alanlar);
  const yerTutucular = kolonlar.map((_, i) => `$${i + 1}`);
  return db.sql(
    `insert into public.sod_catismalari (${kolonlar.join(", ")}) values (${yerTutucular.join(", ")}) returning id, durum`,
    Object.values(alanlar),
  );
}

describe("kiracı izolasyonu (kural 1)", () => {
  it("kural, taraf, atama, çatışma, istisna, telafi edici kontrol — hepsi tenant'a kilitli", async () => {
    const { rows: c } = await catismaEkle();
    const conflictId = c[0].id as string;

    await db.sql(
      `insert into public.sod_kural_taraflari (rule_id, taraf, aktivite_kodu) values ($1, 'A', 'KANIT_YUKLE')`,
      [ruleId],
    );
    await db.sql(
      `insert into public.sod_atamalari (tenant_id, kullanici_id, aktivite_kodu) values ($1, $2, 'KANIT_YUKLE')`,
      [seed.A.tenantId, seed.A.userId],
    );
    const { rows: exc } = await db.sql(
      `insert into public.sod_istisnalari (conflict_id, tenant_id, gerekce, talep_eden_id, bitis)
       values ($1, $2, 'gerekce', $3, current_date + 30) returning id`,
      [conflictId, seed.A.tenantId, seed.A.userId],
    );
    await db.sql(
      `insert into public.sod_telafi_edici_kontroller (conflict_id, tenant_id, test_definition_id)
       values ($1, $2, $3)`,
      [conflictId, seed.A.tenantId, tanimId],
    );

    // B kiracısı hiçbirini SORGUYLA da göremez.
    const { rows: bRule } = await db.asUser(seed.B.userId, `select id from public.sod_kurallari`);
    expect(bRule).toHaveLength(0);
    const { rows: bTaraf } = await db.asUser(
      seed.B.userId,
      `select id from public.sod_kural_taraflari`,
    );
    expect(bTaraf).toHaveLength(0);
    const { rows: bAtama } = await db.asUser(seed.B.userId, `select id from public.sod_atamalari`);
    expect(bAtama).toHaveLength(0);
    const { rows: bConflict } = await db.asUser(
      seed.B.userId,
      `select id from public.sod_catismalari`,
    );
    expect(bConflict).toHaveLength(0);
    const { rows: bExc } = await db.asUser(seed.B.userId, `select id from public.sod_istisnalari`);
    expect(bExc).toHaveLength(0);
    const { rows: bCc } = await db.asUser(
      seed.B.userId,
      `select id from public.sod_telafi_edici_kontroller`,
    );
    expect(bCc).toHaveLength(0);

    // A kiracısı kendi verisini görür.
    const { rows: aRule } = await db.asUser(seed.A.userId, `select id from public.sod_kurallari`);
    expect(aRule).toHaveLength(1);
    expect(exc).toHaveLength(1);
  });
});

describe("mevzuat durumu geçişi (kural 3)", () => {
  it("TODO_DOGRULA -> VERIFIED onaylayan olmadan reddedilir", async () => {
    await db.sql(`update public.sod_kurallari set mevzuat_durumu = 'TODO_DOGRULA' where id = $1`, [
      ruleId,
    ]);
    await expect(
      db.sql(`update public.sod_kurallari set mevzuat_durumu = 'VERIFIED' where id = $1`, [ruleId]),
    ).rejects.toThrow(/onaylayan olmadan/i);
  });

  it("TODO_DOGRULA -> VERIFIED onaylayan ile kabul edilir", async () => {
    await db.sql(`update public.sod_kurallari set mevzuat_durumu = 'TODO_DOGRULA' where id = $1`, [
      ruleId,
    ]);
    const { rows } = await db.sql(
      `update public.sod_kurallari set mevzuat_durumu = 'VERIFIED', onaylayan = $2 where id = $1
       returning mevzuat_durumu`,
      [ruleId, seed.A.userId],
    );
    expect(rows[0].mevzuat_durumu).toBe("VERIFIED");
  });

  it("SPK kaynaklı kural INTERNAL değil TODO_DOGRULA doğar (route disiplini, DB varsayılanı serbest bırakır)", async () => {
    const { rows } = await db.sql(
      `insert into public.sod_kurallari (tenant_id, kod, ad, kaynak_turu, mevzuat_durumu, olusturan)
       values ($1, 'SOD-SPK-01', 'SPK kaynaklı kural', 'spk_notu', 'TODO_DOGRULA', $2)
       returning mevzuat_durumu`,
      [seed.A.tenantId, seed.A.userId],
    );
    expect(rows[0].mevzuat_durumu).toBe("TODO_DOGRULA");
  });
});

describe("istisna guard'ı: talep eden kendi istisnasını onaylayamaz", () => {
  it("INSERT'te onaylanan durumla ve talep_eden=onaylayan ile reddedilir", async () => {
    const { rows: c } = await catismaEkle();
    await expect(
      db.sql(
        `insert into public.sod_istisnalari
           (conflict_id, tenant_id, gerekce, talep_eden_id, onaylayan_id, bitis, durum)
         values ($1, $2, 'g', $3, $3, current_date + 10, 'onaylandi')`,
        [c[0].id, seed.A.tenantId, seed.A.userId],
      ),
    ).rejects.toThrow(/kendi istisnasini onaylayamaz/i);
  });

  it("UPDATE ile sonradan onaylanmaya çalışılırsa da reddedilir", async () => {
    const { rows: c } = await catismaEkle();
    const { rows: exc } = await db.sql(
      `insert into public.sod_istisnalari (conflict_id, tenant_id, gerekce, talep_eden_id, bitis)
       values ($1, $2, 'g', $3, current_date + 10) returning id`,
      [c[0].id, seed.A.tenantId, seed.A.userId],
    );
    await expect(
      db.sql(
        `update public.sod_istisnalari set durum = 'onaylandi', onaylayan_id = $2 where id = $1`,
        [exc[0].id, seed.A.userId],
      ),
    ).rejects.toThrow(/kendi istisnasini onaylayamaz/i);
  });

  it("farklı kullanıcı onaylarsa kabul edilir", async () => {
    const { rows: c } = await catismaEkle();
    const { rows: exc } = await db.sql(
      `insert into public.sod_istisnalari (conflict_id, tenant_id, gerekce, talep_eden_id, bitis)
       values ($1, $2, 'g', $3, current_date + 10) returning id`,
      [c[0].id, seed.A.tenantId, seed.A.userId],
    );
    // seedTwoTenants yalnızca tenant başına bir admin veriyor; ikinci bir
    // onaylayan için aynı tenant'a yeni bir profil ekliyoruz.
    const onaylayanId = "a0000000-0000-0000-0000-000000000099";
    await db.sql(`insert into auth.users (id, email) values ($1, 'onaylayan@demo.com')`, [
      onaylayanId,
    ]);
    await db.sql(
      `insert into public.profiles (id, tenant_id, role, full_name) values ($1, $2, 'uyum', 'Onaylayan')`,
      [onaylayanId, seed.A.tenantId],
    );
    const { rows } = await db.sql(
      `update public.sod_istisnalari set durum = 'onaylandi', onaylayan_id = $2 where id = $1
       returning durum`,
      [exc[0].id, onaylayanId],
    );
    expect(rows[0].durum).toBe("onaylandi");
  });

  it("süresiz istisna oluşturulamaz — bitis zorunlu ve baslangictan sonra olmalı", async () => {
    const { rows: c } = await catismaEkle();
    await expect(
      db.sql(
        `insert into public.sod_istisnalari (conflict_id, tenant_id, gerekce, talep_eden_id, bitis)
         values ($1, $2, 'g', $3, current_date)`,
        [c[0].id, seed.A.tenantId, seed.A.userId],
      ),
    ).rejects.toThrow();
  });
});

describe("çatışma durum makinesi", () => {
  it("dedup: aynı fingerprint iki kez açık kayıt olamaz", async () => {
    await catismaEkle({ fingerprint: "ayni-fp" });
    await expect(catismaEkle({ fingerprint: "ayni-fp" })).rejects.toThrow();
  });

  it("EXCEPTION_APPROVED: onaylı istisna olmadan reddedilir", async () => {
    const { rows: c } = await catismaEkle();
    await expect(
      db.sql(`update public.sod_catismalari set durum = 'EXCEPTION_APPROVED' where id = $1`, [
        c[0].id,
      ]),
    ).rejects.toThrow(/onaylanmis bir istisna bulunamadi/i);
  });

  it("EXCEPTION_APPROVED: onaylı istisna varsa kabul edilir", async () => {
    const { rows: c } = await catismaEkle();
    const onaylayanId = "a0000000-0000-0000-0000-000000000098";
    await db.sql(`insert into auth.users (id, email) values ($1, 'onaylayan2@demo.com')`, [
      onaylayanId,
    ]);
    await db.sql(
      `insert into public.profiles (id, tenant_id, role, full_name) values ($1, $2, 'uyum', 'Onaylayan2')`,
      [onaylayanId, seed.A.tenantId],
    );
    await db.sql(
      `insert into public.sod_istisnalari
         (conflict_id, tenant_id, gerekce, talep_eden_id, onaylayan_id, bitis, durum)
       values ($1, $2, 'g', $3, $4, current_date + 10, 'onaylandi')`,
      [c[0].id, seed.A.tenantId, seed.A.userId, onaylayanId],
    );
    const { rows } = await db.sql(
      `update public.sod_catismalari set durum = 'EXCEPTION_APPROVED' where id = $1 returning durum`,
      [c[0].id],
    );
    expect(rows[0].durum).toBe("EXCEPTION_APPROVED");
  });

  it("MITIGATED: bağlı telafi edici kontrolün son testi PASSED değilse reddedilir", async () => {
    const { rows: c } = await catismaEkle();
    await db.sql(
      `insert into public.sod_telafi_edici_kontroller (conflict_id, tenant_id, test_definition_id)
       values ($1, $2, $3)`,
      [c[0].id, seed.A.tenantId, tanimId],
    );
    await db.sql(
      `insert into public.test_runs (tenant_id, test_definition_id, control_id, sonuc, gerekce, tanim_surumu)
       values ($1, $2, $3, 'FAILED', 'basarisiz', 1)`,
      [seed.A.tenantId, tanimId, seed.controlId],
    );
    await expect(
      db.sql(`update public.sod_catismalari set durum = 'MITIGATED' where id = $1`, [c[0].id]),
    ).rejects.toThrow(/PASSED degil/i);
  });

  it("MITIGATED: hiç test koşusu yoksa da reddedilir", async () => {
    const { rows: c } = await catismaEkle();
    await db.sql(
      `insert into public.sod_telafi_edici_kontroller (conflict_id, tenant_id, test_definition_id)
       values ($1, $2, $3)`,
      [c[0].id, seed.A.tenantId, tanimId],
    );
    await expect(
      db.sql(`update public.sod_catismalari set durum = 'MITIGATED' where id = $1`, [c[0].id]),
    ).rejects.toThrow(/kosu yok/i);
  });

  it("MITIGATED: son test PASSED ise kabul edilir", async () => {
    const { rows: c } = await catismaEkle();
    await db.sql(
      `insert into public.sod_telafi_edici_kontroller (conflict_id, tenant_id, test_definition_id)
       values ($1, $2, $3)`,
      [c[0].id, seed.A.tenantId, tanimId],
    );
    await db.sql(
      `insert into public.test_runs (tenant_id, test_definition_id, control_id, sonuc, gerekce, tanim_surumu)
       values ($1, $2, $3, 'PASSED', 'basarili', 1)`,
      [seed.A.tenantId, tanimId, seed.controlId],
    );
    const { rows } = await db.sql(
      `update public.sod_catismalari set durum = 'MITIGATED' where id = $1 returning durum`,
      [c[0].id],
    );
    expect(rows[0].durum).toBe("MITIGATED");
  });

  it("MITIGATED sonrası başarısız retest ile REOPENED'a geçilebilir (guard engellemez)", async () => {
    const { rows: c } = await catismaEkle();
    await db.sql(
      `insert into public.sod_telafi_edici_kontroller (conflict_id, tenant_id, test_definition_id)
       values ($1, $2, $3)`,
      [c[0].id, seed.A.tenantId, tanimId],
    );
    await db.sql(
      `insert into public.test_runs (tenant_id, test_definition_id, control_id, sonuc, gerekce, tanim_surumu)
       values ($1, $2, $3, 'PASSED', 'basarili', 1)`,
      [seed.A.tenantId, tanimId, seed.controlId],
    );
    await db.sql(`update public.sod_catismalari set durum = 'MITIGATED' where id = $1`, [c[0].id]);

    // Telafi edici kontrol daha sonra BAŞARISIZ olur — route bu durumda
    // çatışmayı REOPENED yapar (guard bunu yasaklamaz, yalnızca MITIGATED/
    // RESOLVED gibi olumlu geçişleri kanıt ister).
    const { rows } = await db.sql(
      `update public.sod_catismalari set durum = 'REOPENED' where id = $1 returning durum`,
      [c[0].id],
    );
    expect(rows[0].durum).toBe("REOPENED");
  });

  it("RESOLVED: resolved_by olmadan reddedilir", async () => {
    const { rows: c } = await catismaEkle({ durum: "MITIGATED" });
    await expect(
      db.sql(`update public.sod_catismalari set durum = 'RESOLVED' where id = $1`, [c[0].id]),
    ).rejects.toThrow(/resolved_by/i);
  });

  it("RESOLVED: OPEN'dan direkt geçilemez", async () => {
    const { rows: c } = await catismaEkle();
    await expect(
      db.sql(
        `update public.sod_catismalari set durum = 'RESOLVED', resolved_by = $2 where id = $1`,
        [c[0].id, seed.A.userId],
      ),
    ).rejects.toThrow(/MITIGATED veya EXCEPTION_APPROVED/i);
  });

  it("RESOLVED: MITIGATED'ten resolved_by ile kabul edilir (mutlu yol)", async () => {
    const { rows: c } = await catismaEkle({ durum: "MITIGATED" });
    const { rows } = await db.sql(
      `update public.sod_catismalari set durum = 'RESOLVED', resolved_by = $2 where id = $1
       returning durum`,
      [c[0].id, seed.A.userId],
    );
    expect(rows[0].durum).toBe("RESOLVED");
  });
});

describe("sod_atamalari", () => {
  it("kullanici_id ve harici_kullanici_id ikisi de boşsa reddedilir", async () => {
    await expect(
      db.sql(`insert into public.sod_atamalari (tenant_id, aktivite_kodu) values ($1, 'X')`, [
        seed.A.tenantId,
      ]),
    ).rejects.toThrow();
  });

  it("yalnız harici_kullanici_id ile de eklenebilir (connector'suz gelecek senaryo)", async () => {
    const { rows } = await db.sql(
      `insert into public.sod_atamalari (tenant_id, harici_kullanici_id, aktivite_kodu)
       values ($1, 'ext-123', 'X') returning id`,
      [seed.A.tenantId],
    );
    expect(rows).toHaveLength(1);
  });
});
