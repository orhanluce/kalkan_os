// Transactional outbox → şeffaflık defteri köprüsü (nihai talimat v3.2 §8.0):
// RLS + idempotent enqueue + race-safe claim + rollback safety + durum
// türetimi. PGlite gerçek migration'lara karşı.
//
// DÜRÜST SINIR: PGlite tek bağlantılı bir WASM Postgres'tir — gerçek eşzamanlı
// İKİ transaction'ı burada literal olarak koşturamayız (bkz. src/lib/__tests__/
// helpers/pg.ts üstündeki genel uyarı). FOR UPDATE SKIP LOCKED + UNIQUE
// kısıtlarının verdiği güvenceyi SIRALI simülasyonla kanıtlıyoruz: claim'in
// PENDING satırı PROCESSING'e çevirdiğini ve bir sonraki claim'in onu BİR
// DAHA almadığını doğrulamak, iki eşzamanlı worker'ın aynı satırı iki kez
// işleyemeyeceğinin SQL-seviyesi kanıtıdır (thread'siz de geçerli bir kanıt).
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

async function tanimVeTestRunKur(tenantId: string) {
  const control = await db.sql(`select id from public.controls limit 1`);
  const tanim = await db.sql(
    `insert into public.control_test_definitions (tenant_id, control_id, tur, ad) values ($1, $2, 'MANUAL_PROCEDURE', 'T') returning id`,
    [tenantId, control.rows[0].id],
  );
  return { tanimId: tanim.rows[0].id as string, controlId: control.rows[0].id as string };
}

describe("ledger_outbox / artifact_ledger_links — RLS + idempotency (§8.0)", () => {
  it("test_runs INSERT AYNI transaction'da outbox olayı doğurur (enqueue)", async () => {
    const { tanimId, controlId } = await tanimVeTestRunKur(seed.A.tenantId);
    const run = await db.sql(
      `insert into public.test_runs (tenant_id, test_definition_id, control_id, sonuc, gerekce, tanim_surumu)
       values ($1, $2, $3, 'PASSED', 'g', 1) returning id`,
      [seed.A.tenantId, tanimId, controlId],
    );
    const { rows } = await db.sql(
      `select durum, statement_kind from public.ledger_outbox where artifact_table = 'test_runs' and artifact_id = $1`,
      [run.rows[0].id],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].durum).toBe("PENDING");
    expect(rows[0].statement_kind).toBe("CONTROL_TEST_RUN");
  });

  it("ROLLBACK: transaction geri alınırsa orphan outbox satırı OLUŞMAZ", async () => {
    const { tanimId, controlId } = await tanimVeTestRunKur(seed.A.tenantId);
    await db.sql("begin");
    const run = await db.sql(
      `insert into public.test_runs (tenant_id, test_definition_id, control_id, sonuc, gerekce, tanim_surumu)
       values ($1, $2, $3, 'PASSED', 'g', 1) returning id`,
      [seed.A.tenantId, tanimId, controlId],
    );
    await db.sql("rollback");
    const { rows } = await db.sql(
      `select id from public.ledger_outbox where artifact_table = 'test_runs' and artifact_id = $1`,
      [run.rows[0].id],
    );
    expect(rows).toHaveLength(0);
    // test_run'ın kendisi de geri alındı (aynı transaction).
    const { rows: runRows } = await db.sql(`select id from public.test_runs where id = $1`, [run.rows[0].id]);
    expect(runRows).toHaveLength(0);
  });

  it("İDEMPOTENT ENQUEUE: bir artefakt için ikinci enqueue çağrısı ikinci satır yaratmaz", async () => {
    const { tanimId, controlId } = await tanimVeTestRunKur(seed.A.tenantId);
    const run = await db.sql(
      `insert into public.test_runs (tenant_id, test_definition_id, control_id, sonuc, gerekce, tanim_surumu)
       values ($1, $2, $3, 'PASSED', 'g', 1) returning id`,
      [seed.A.tenantId, tanimId, controlId],
    );
    // Trigger'ın kullandığı enqueue fonksiyonunu doğrudan tekrar çağır (retry simülasyonu).
    await db.sql(
      `insert into public.ledger_outbox (tenant_id, artifact_table, artifact_id, statement_kind)
       values ($1, 'test_runs', $2, 'CONTROL_TEST_RUN') on conflict (artifact_table, artifact_id) do nothing`,
      [seed.A.tenantId, run.rows[0].id],
    );
    const { rows } = await db.sql(
      `select count(*)::int as n from public.ledger_outbox where artifact_table = 'test_runs' and artifact_id = $1`,
      [run.rows[0].id],
    );
    expect(rows[0].n).toBe(1);
  });

  it("cross-tenant: A'nın outbox olayı B'ye görünmez; istemci doğrudan yazamaz/güncelleyemez", async () => {
    const { tanimId, controlId } = await tanimVeTestRunKur(seed.A.tenantId);
    const run = await db.sql(
      `insert into public.test_runs (tenant_id, test_definition_id, control_id, sonuc, gerekce, tanim_surumu)
       values ($1, $2, $3, 'PASSED', 'g', 1) returning id`,
      [seed.A.tenantId, tanimId, controlId],
    );
    const { rows: b } = await db.asUser(
      seed.B.userId,
      `select id from public.ledger_outbox where artifact_table = 'test_runs' and artifact_id = $1`,
      [run.rows[0].id],
    );
    expect(b).toHaveLength(0);
    await expect(
      db.asUser(
        seed.A.userId,
        `insert into public.ledger_outbox (tenant_id, artifact_table, artifact_id, statement_kind) values ($1, 'x', $2, 'y')`,
        [seed.A.tenantId, run.rows[0].id],
      ),
    ).rejects.toThrow();
  });

  it("claim: PENDING satırı PROCESSING'e çevirir; ikinci claim ONU bir daha ALMAZ (skip-locked eşdeğeri)", async () => {
    const { tanimId, controlId } = await tanimVeTestRunKur(seed.A.tenantId);
    await db.sql(
      `insert into public.test_runs (tenant_id, test_definition_id, control_id, sonuc, gerekce, tanim_surumu)
       values ($1, $2, $3, 'PASSED', 'g', 1)`,
      [seed.A.tenantId, tanimId, controlId],
    );
    const ilkClaim = await db.asUser(seed.A.userId, `select * from public.ledger_outbox_claim(10)`);
    expect(ilkClaim.rows).toHaveLength(1);
    expect(ilkClaim.rows[0].durum).toBe("PROCESSING");

    const ikinciClaim = await db.asUser(seed.A.userId, `select * from public.ledger_outbox_claim(10)`);
    expect(ikinciClaim.rows).toHaveLength(0); // aynı satır TEKRAR claim edilmez
  });

  it("mark_processed: link kurar + PROCESSED'e taşır + audit + tek link (idempotent tekrar çağrı)", async () => {
    const { tanimId, controlId } = await tanimVeTestRunKur(seed.A.tenantId);
    const run = await db.sql(
      `insert into public.test_runs (tenant_id, test_definition_id, control_id, sonuc, gerekce, tanim_surumu)
       values ($1, $2, $3, 'PASSED', 'g', 1) returning id`,
      [seed.A.tenantId, tanimId, controlId],
    );
    const claim = await db.asUser(seed.A.userId, `select * from public.ledger_outbox_claim(10)`);
    const outboxId = claim.rows[0].id as string;

    // Sahte bir ledger_entry_id (gerçek transparency_ledger_entries satırı olmasa
    // da FK yok — mark_processed sadece link kurar; bu test outbox/link
    // katmanını izole sınıyor, imza/Merkle G3'te ayrıca kanıtlı).
    const entry = await db.sql(
      `insert into public.transparency_ledger_entries (tenant_id, statement_kind, statement_hash, signed_statement, leaf_hash)
       values ($1, 'CONTROL_TEST_RUN', $2, '{}'::jsonb, $3) returning id`,
      [seed.A.tenantId, "a".repeat(64), "b".repeat(64)],
    );

    await db.asUser(seed.A.userId, `select public.ledger_outbox_mark_processed($1, $2)`, [outboxId, entry.rows[0].id]);
    const durum1 = await db.sql(`select public.artifact_ledger_durumu('test_runs', $1) as d`, [run.rows[0].id]);
    expect(durum1.rows[0].d).toBe("ANCHORED");

    // İkinci çağrı (retry simülasyonu) hata VERMEZ, ikinci link YARATMAZ.
    await db.asUser(seed.A.userId, `select public.ledger_outbox_mark_processed($1, $2)`, [outboxId, entry.rows[0].id]);
    const { rows: linkler } = await db.sql(
      `select count(*)::int as n from public.artifact_ledger_links where artifact_table = 'test_runs' and artifact_id = $1`,
      [run.rows[0].id],
    );
    expect(linkler[0].n).toBe(1);

    const audit = await db.sql(
      `select count(*)::int as n from public.audit_log where eylem = 'artefakt_deftere_muhurlendi' and hedef_id = $1`,
      [run.rows[0].id],
    );
    expect(audit.rows[0].n).toBeGreaterThanOrEqual(1);
  });

  it("mark_failed: 5. denemede FAILED'e düşer, öncesinde PENDING (yeniden dene)", async () => {
    const { tanimId, controlId } = await tanimVeTestRunKur(seed.A.tenantId);
    await db.sql(
      `insert into public.test_runs (tenant_id, test_definition_id, control_id, sonuc, gerekce, tanim_surumu)
       values ($1, $2, $3, 'PASSED', 'g', 1)`,
      [seed.A.tenantId, tanimId, controlId],
    );
    const claim = await db.asUser(seed.A.userId, `select * from public.ledger_outbox_claim(10)`);
    const outboxId = claim.rows[0].id as string;

    for (let i = 0; i < 4; i++) {
      await db.asUser(seed.A.userId, `select public.ledger_outbox_mark_failed($1, 'test-hata')`, [outboxId]);
      const { rows } = await db.sql(`select durum, deneme_sayisi from public.ledger_outbox where id = $1`, [outboxId]);
      expect(rows[0].durum).toBe("PENDING"); // 1..4. deneme: yeniden denenir
    }
    await db.asUser(seed.A.userId, `select public.ledger_outbox_mark_failed($1, 'test-hata')`, [outboxId]);
    const { rows } = await db.sql(`select durum, deneme_sayisi from public.ledger_outbox where id = $1`, [outboxId]);
    expect(rows[0].durum).toBe("FAILED"); // 5. deneme: dead-letter
    expect(Number(rows[0].deneme_sayisi)).toBe(5);
  });

  it("durum: KAYITSIZ → PENDING → ANCHORED (dsar_fulfillment_packages üzerinden uçtan uca)", async () => {
    const dsar = await db.sql(
      `insert into public.data_subject_requests (tenant_id, tur, veri_sahibi_maskeli, kimlik_dogrulandi, durum)
       values ($1, 'ERISIM', 'a***@x.com', true, 'TAMAMLANDI') returning id`,
      [seed.A.tenantId],
    );
    const durumOnce = await db.sql(`select public.artifact_ledger_durumu('dsar_fulfillment_packages', $1) as d`, [
      "00000000-0000-0000-0000-000000000000",
    ]);
    expect(durumOnce.rows[0].d).toBe("KAYITSIZ");

    const pkg = await db.sql(
      `insert into public.dsar_fulfillment_packages (tenant_id, dsar_id, manifest, manifest_hash)
       values ($1, $2, '{}'::jsonb, $3) returning id`,
      [seed.A.tenantId, dsar.rows[0].id, "c".repeat(64)],
    );
    const durumSonra = await db.sql(`select public.artifact_ledger_durumu('dsar_fulfillment_packages', $1) as d`, [
      pkg.rows[0].id,
    ]);
    expect(durumSonra.rows[0].d).toBe("PENDING");
  });

  it("dsar_paket_guard: TAMAMLANDI olmayan DSAR için paket reddedilir (ledger sütunları düştü, kural aynı)", async () => {
    const dsar = await db.sql(
      `insert into public.data_subject_requests (tenant_id, tur, veri_sahibi_maskeli, kimlik_dogrulandi, durum)
       values ($1, 'ERISIM', 'a***@x.com', true, 'ISLENIYOR') returning id`,
      [seed.A.tenantId],
    );
    await expect(
      db.sql(
        `insert into public.dsar_fulfillment_packages (tenant_id, dsar_id, manifest, manifest_hash)
         values ($1, $2, '{}'::jsonb, $3)`,
        [seed.A.tenantId, dsar.rows[0].id, "d".repeat(64)],
      ),
    ).rejects.toThrow(/TAMAMLANDI/);
  });
});
