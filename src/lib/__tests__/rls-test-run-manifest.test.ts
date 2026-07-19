// M12 standart test manifesti (nihai v3.3 §8.0 Dikey 2): test_runs zengin
// snapshot alanları + append-only KORUNUR + hazırlayan/onaylayan ayrımı guard'ı
// + CONTROL_TEST_RUN outbox enqueue hâlâ çalışıyor. PGlite.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, seedTwoTenants, type TestDb } from "./helpers/pg";

let db: TestDb;
let seed: Awaited<ReturnType<typeof seedTwoTenants>>;

beforeEach(async () => {
  db = await createTestDb();
  seed = await seedTwoTenants(db);
});
afterEach(async () => {
  await db.close();
});

async function tanimKur(tenantId: string) {
  const control = await db.sql(`select id from public.controls limit 1`);
  const t = await db.sql(
    `insert into public.control_test_definitions (tenant_id, control_id, tur, ad, amac, kapsam, hedef_varlik, kritik_hizmet_adi, senaryo_kimligi, senaryo_surumu)
     values ($1, $2, 'ATTACK_SIMULATION', 'MFA tatbikatı', 'MFA doğrula', 'ayrıcalıklı hesaplar', 'Entra ID', 'Ödeme', 'TAT-01', 1) returning id`,
    [tenantId, control.rows[0].id],
  );
  return { tanimId: t.rows[0].id as string, controlId: control.rows[0].id as string };
}

describe("test_run manifest alanları — snapshot + append-only + guard (§8.0 Dikey 2)", () => {
  it("zengin snapshot alanları yazılır + CONTROL_TEST_RUN outbox olayı doğar", async () => {
    const { tanimId, controlId } = await tanimKur(seed.A.tenantId);
    const r = await db.sql(
      `insert into public.test_runs (tenant_id, test_definition_id, control_id, sonuc, gerekce, tanim_surumu,
         baslangic_at, bitis_at, beklenen_sonuc, performans_etkisi, yanlis_pozitif, yanlis_negatif, log_referanslari, hazirlayan)
       values ($1, $2, $3, 'PASSED', 'g', 1, now(), now(), 'tüm hesaplar MFA', 'yok', false, false, '[{"ad":"log1","hash":null}]'::jsonb, $4)
       returning id, beklenen_sonuc, performans_etkisi`,
      [seed.A.tenantId, tanimId, controlId, seed.A.userId],
    );
    expect(r.rows[0].beklenen_sonuc).toBe("tüm hesaplar MFA");
    const outbox = await db.sql(`select statement_kind from public.ledger_outbox where artifact_table = 'test_runs' and artifact_id = $1`, [r.rows[0].id]);
    expect(outbox.rows).toHaveLength(1);
    expect(outbox.rows[0].statement_kind).toBe("CONTROL_TEST_RUN");
  });

  it("append-only KORUNUR: yeni alanlar UPDATE ile değiştirilemez", async () => {
    const { tanimId, controlId } = await tanimKur(seed.A.tenantId);
    const r = await db.sql(
      `insert into public.test_runs (tenant_id, test_definition_id, control_id, sonuc, gerekce, tanim_surumu, beklenen_sonuc)
       values ($1, $2, $3, 'PASSED', 'g', 1, 'x') returning id`,
      [seed.A.tenantId, tanimId, controlId],
    );
    await expect(
      db.asUser(seed.A.userId, `update public.test_runs set beklenen_sonuc = 'y' where id = $1`, [r.rows[0].id]),
    ).rejects.toThrow();
  });

  it("hazırlayan/onaylayan ayrımı (kural 4): bağımsız onaylayan = hazırlayan reddedilir", async () => {
    const { tanimId, controlId } = await tanimKur(seed.A.tenantId);
    await expect(
      db.sql(
        `insert into public.test_runs (tenant_id, test_definition_id, control_id, sonuc, gerekce, tanim_surumu, hazirlayan, bagimsiz_onaylayan)
         values ($1, $2, $3, 'PASSED', 'g', 1, $4, $4)`,
        [seed.A.tenantId, tanimId, controlId, seed.A.userId],
      ),
    ).rejects.toThrow(/ayni kisi/);
    // Farklı kişi kabul edilir.
    await db.sql(
      `insert into public.test_runs (tenant_id, test_definition_id, control_id, sonuc, gerekce, tanim_surumu, hazirlayan, bagimsiz_onaylayan)
       values ($1, $2, $3, 'PASSED', 'g', 1, $4, $5)`,
      [seed.A.tenantId, tanimId, controlId, seed.A.userId, seed.B.userId],
    );
  });

  it("senaryo_surumu pozitif olmalı (check)", async () => {
    const control = await db.sql(`select id from public.controls limit 1`);
    await expect(
      db.sql(
        `insert into public.control_test_definitions (tenant_id, control_id, tur, ad, senaryo_surumu) values ($1, $2, 'MANUAL_PROCEDURE', 'x', 0)`,
        [seed.A.tenantId, control.rows[0].id],
      ),
    ).rejects.toThrow();
  });
});
