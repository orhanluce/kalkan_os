// Nihai talimat v3.3 §8.0 Dikey 4 KALANI: segment-bazlı drift sonucu + insan
// override gerekçesi + model rollback/son test + ISO 42001↔27001 crosswalk.
// PGlite.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, seedTwoTenants, type TestDb } from "./helpers/pg";

let db: TestDb;
let seed: Awaited<ReturnType<typeof seedTwoTenants>>;

async function aiSistem(tenantId: string) {
  const { rows } = await db.sql(`insert into public.ai_systems (tenant_id, ad) values ($1, 'S') returning id`, [tenantId]);
  return rows[0].id as string;
}
async function driftEkle(tenantId: string, sysId: string, segment: string | null = null) {
  const { rows } = await db.sql(
    `insert into public.ai_drift_readings (tenant_id, ai_system_id, metrik, deger, esik, esik_kaynagi, segment) values ($1, $2, 'accuracy', 0.6, 0.05, 'Politika v1', $3) returning id`,
    [tenantId, sysId, segment],
  );
  return rows[0].id as string;
}
async function crosswalkEkle(extra: Record<string, unknown> = {}) {
  const { rows } = await db.sql(
    `insert into public.iso_42001_27001_crosswalk (iso42001_ref, iso27001_ref, dogrulama_durumu) values ($1, $2, coalesce($3, 'TODO_DOGRULA')) returning id`,
    [extra.iso42001_ref ?? "6.1.2", extra.iso27001_ref ?? "A.5.1", extra.dogrulama_durumu ?? null],
  );
  return rows[0].id as string;
}

beforeEach(async () => {
  db = await createTestDb();
  seed = await seedTwoTenants(db);
});
afterEach(async () => {
  await db.close();
});

describe("segment-bazlı drift sonucu (Dikey 4 kalanı)", () => {
  it("aynı metrik farklı segmentlerde ayrı okunur (agregat gizlemez)", async () => {
    const s = await aiSistem(seed.A.tenantId);
    await driftEkle(seed.A.tenantId, s, "bolge:istanbul");
    await driftEkle(seed.A.tenantId, s, "bolge:izmir");
    await driftEkle(seed.A.tenantId, s, null);
    const { rows } = await db.sql(`select segment from public.ai_drift_readings where ai_system_id = $1 order by segment nulls last`, [s]);
    expect(rows.map((r) => r.segment)).toEqual(["bolge:istanbul", "bolge:izmir", null]);
  });
});

describe("insan override gerekçesi — DB guard (Dikey 4 kalanı)", () => {
  it("override_edildi=true gerekçesiz REDDEDİLİR", async () => {
    const s = await aiSistem(seed.A.tenantId);
    const d = await driftEkle(seed.A.tenantId, s);
    await expect(
      db.sql(`update public.ai_drift_readings set override_edildi = true where id = $1`, [d]),
    ).rejects.toThrow(/gerekce zorunlu/);
  });

  it("gerekçeli ama insan atfı olmayan override REDDEDİLİR", async () => {
    const s = await aiSistem(seed.A.tenantId);
    const d = await driftEkle(seed.A.tenantId, s);
    await expect(
      db.sql(`update public.ai_drift_readings set override_edildi = true, override_gerekce = 'Bilinen mevsimsel sapma' where id = $1`, [d]),
    ).rejects.toThrow(/insan karari ister/);
  });

  it("tam override (gerekçe + insan atfı + zaman) GEÇER + audit", async () => {
    const s = await aiSistem(seed.A.tenantId);
    const d = await driftEkle(seed.A.tenantId, s);
    await db.sql(
      `update public.ai_drift_readings set override_edildi = true, override_gerekce = 'Bilinen mevsimsel sapma', override_eden = $2, override_zamani = now() where id = $1`,
      [d, seed.A.userId],
    );
    const { rows } = await db.sql(`select override_edildi from public.ai_drift_readings where id = $1`, [d]);
    expect(rows[0].override_edildi).toBe(true);
    const audit = await db.sql(`select count(*)::int as n from public.audit_log where hedef_tablo = 'ai_drift_readings' and hedef_id = $1 and eylem = 'ai_drift_override_edildi'`, [d]);
    expect(audit.rows[0].n).toBe(1);
  });

  it("override edilmiş okuma DONUK (kararı sessizce geri alınamaz)", async () => {
    const s = await aiSistem(seed.A.tenantId);
    const d = await driftEkle(seed.A.tenantId, s);
    await db.sql(
      `update public.ai_drift_readings set override_edildi = true, override_gerekce = 'X', override_eden = $2, override_zamani = now() where id = $1`,
      [d, seed.A.userId],
    );
    await expect(
      db.sql(`update public.ai_drift_readings set override_gerekce = 'Değişti' where id = $1`, [d]),
    ).rejects.toThrow(/degistirilemez/);
  });
});

describe("model rollback + son test (Dikey 4 kalanı, exit_plans deseni)", () => {
  it("TAMAMLANDI kanıtsız/tarihsiz/kararsız REDDEDİLİR (check constraint)", async () => {
    const s = await aiSistem(seed.A.tenantId);
    await expect(
      db.sql(
        `insert into public.ai_model_rollbacks (tenant_id, ai_system_id, onceki_surum, yeni_surum, sebep, durum) values ($1, $2, 'v2', 'v1', 'drift', 'TAMAMLANDI')`,
        [seed.A.tenantId, s],
      ),
    ).rejects.toThrow();
  });

  it("TASLAK → TAMAMLANDI kanıt+tarih+karar ile GEÇER + audit", async () => {
    const s = await aiSistem(seed.A.tenantId);
    const { rows } = await db.sql(
      `insert into public.ai_model_rollbacks (tenant_id, ai_system_id, onceki_surum, yeni_surum, sebep) values ($1, $2, 'v2', 'v1', 'drift esigi asildi') returning id`,
      [seed.A.tenantId, s],
    );
    const id = rows[0].id;
    await db.sql(
      `update public.ai_model_rollbacks set durum = 'TAMAMLANDI', son_test_kaniti = 'regresyon-testi-42', son_test_tarihi = current_date, karar_veren = $2, karar_zamani = now() where id = $1`,
      [id, seed.A.userId],
    );
    const { rows: after } = await db.sql(`select durum from public.ai_model_rollbacks where id = $1`, [id]);
    expect(after[0].durum).toBe("TAMAMLANDI");
    const audit = await db.sql(`select count(*)::int as n from public.audit_log where hedef_tablo = 'ai_model_rollbacks' and hedef_id = $1 and eylem = 'ai_rollback_durum_degisti'`, [id]);
    expect(audit.rows[0].n).toBe(1);
  });

  it("tamamlanmış rollback DONUK", async () => {
    const s = await aiSistem(seed.A.tenantId);
    const { rows } = await db.sql(
      `insert into public.ai_model_rollbacks (tenant_id, ai_system_id, onceki_surum, yeni_surum, sebep, durum, son_test_kaniti, son_test_tarihi, karar_veren, karar_zamani)
       values ($1, $2, 'v2', 'v1', 'x', 'TAMAMLANDI', 'kanit', current_date, $3, now()) returning id`,
      [seed.A.tenantId, s, seed.A.userId],
    );
    await expect(
      db.sql(`update public.ai_model_rollbacks set sebep = 'değişti' where id = $1`, [rows[0].id]),
    ).rejects.toThrow(/degistirilemez/);
  });

  it("kaynak drift okuması başka kiracıdan ise REDDEDİLİR", async () => {
    const sB = await aiSistem(seed.B.tenantId);
    const dB = await driftEkle(seed.B.tenantId, sB);
    const sA = await aiSistem(seed.A.tenantId);
    await expect(
      db.sql(
        `insert into public.ai_model_rollbacks (tenant_id, ai_system_id, onceki_surum, yeni_surum, sebep, kaynak_drift_reading_id) values ($1, $2, 'v2', 'v1', 'x', $3)`,
        [seed.A.tenantId, sA, dB],
      ),
    ).rejects.toThrow(/ayni kiraciya/);
  });

  it("cross-tenant: A'nın rollback kaydı B'ye görünmez", async () => {
    const s = await aiSistem(seed.A.tenantId);
    const { rows } = await db.sql(
      `insert into public.ai_model_rollbacks (tenant_id, ai_system_id, onceki_surum, yeni_surum, sebep) values ($1, $2, 'v2', 'v1', 'x') returning id`,
      [seed.A.tenantId, s],
    );
    const { rows: b } = await db.asUser(seed.B.userId, `select id from public.ai_model_rollbacks where id = $1`, [rows[0].id]);
    expect(b).toHaveLength(0);
  });
});

describe("ISO 42001↔27001 crosswalk — global katalog + dört-göz (Dikey 4 kalanı)", () => {
  it("her iki kiracının kullanıcısı da AYNI crosswalk kaydını okur (global)", async () => {
    const id = await crosswalkEkle();
    for (const u of [seed.A.userId, seed.B.userId]) {
      const { rows } = await db.asUser(u, `select id from public.iso_42001_27001_crosswalk where id = $1`, [id]);
      expect(rows).toHaveLength(1);
    }
  });

  it("istemci global crosswalk YAZAMAZ (politika yok — seed/service)", async () => {
    await expect(
      db.asUser(seed.A.userId, `insert into public.iso_42001_27001_crosswalk (iso42001_ref, iso27001_ref) values ('6.1.2', 'A.5.1')`),
    ).rejects.toThrow();
  });

  it("kural 3: kayıt VERIFIED DOĞAMAZ", async () => {
    await expect(crosswalkEkle({ dogrulama_durumu: "VERIFIED" })).rejects.toThrow(/VERIFIED dogamaz/);
  });

  it("INSERT-anında LEGAL_REVIEW için de incelemeye_alan/zaman zorunlu (dört-göz INSERT-bypass forward-fix'i)", async () => {
    await expect(crosswalkEkle({ dogrulama_durumu: "LEGAL_REVIEW" })).rejects.toThrow(/incelemeye_alan/i);
  });

  it("INSERT-anında REJECTED doğrudan doğamaz", async () => {
    await expect(crosswalkEkle({ dogrulama_durumu: "REJECTED" })).rejects.toThrow(/dogamaz/i);
  });

  it("DÖRT GÖZ: incelemeye alan kendi sunumunu DOĞRULAYAMAZ", async () => {
    const id = await crosswalkEkle();
    await db.sql(
      `update public.iso_42001_27001_crosswalk set dogrulama_durumu = 'LEGAL_REVIEW', incelemeye_alan = $2, incelemeye_alinma_zamani = now() where id = $1`,
      [id, seed.A.userId],
    );
    await expect(
      db.sql(
        `update public.iso_42001_27001_crosswalk set dogrulama_durumu = 'VERIFIED', dogrulayan = $2, dogrulama_zamani = now() where id = $1`,
        [id, seed.A.userId],
      ),
    ).rejects.toThrow(/dort goz/);
  });

  it("LEGAL_REVIEW → VERIFIED, FARKLI dogrulayan + zaman ile GEÇER", async () => {
    const id = await crosswalkEkle();
    await db.sql(
      `update public.iso_42001_27001_crosswalk set dogrulama_durumu = 'LEGAL_REVIEW', incelemeye_alan = $2, incelemeye_alinma_zamani = now() where id = $1`,
      [id, seed.B.userId],
    );
    await db.sql(
      `update public.iso_42001_27001_crosswalk set dogrulama_durumu = 'VERIFIED', dogrulayan = $2, dogrulama_zamani = now() where id = $1`,
      [id, seed.A.userId],
    );
    const { rows } = await db.sql(`select dogrulama_durumu from public.iso_42001_27001_crosswalk where id = $1`, [id]);
    expect(rows[0].dogrulama_durumu).toBe("VERIFIED");
  });

  it("aynı (iso42001_ref, iso27001_ref) çifti İKİNCİ kez eklenemez (unique)", async () => {
    await crosswalkEkle({ iso42001_ref: "6.1.2", iso27001_ref: "A.5.1" });
    await expect(crosswalkEkle({ iso42001_ref: "6.1.2", iso27001_ref: "A.5.1" })).rejects.toThrow();
  });
});
