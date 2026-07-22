// K2 — Kritik Zamanlanmış Görev Güvenilirliği (docs/adr/PR0-K2-...): mevcut
// ledger_outbox/artifact_ledger_links modelinin güçlendirilmesi — kill-switch,
// terminal hata, orphan-leaf görünürlüğü, manuel retry, sağlık özeti.
// `rls-ledger-outbox.test.ts`'in AYNI PGlite dürüstlük sınırı geçerlidir:
// tek bağlantılı WASM Postgres, GERÇEK eşzamanlı iki transaction'ı literal
// koşturamayız — SIRALI simülasyonla, SQL-seviyesi güvenceleri kanıtlıyoruz.
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

async function platformOperatorKur(id: string, email: string) {
  await db.sql(`insert into auth.users (id, email) values ($1, $2)`, [id, email]);
  await db.sql(
    `insert into public.profiles (id, tenant_id, role, full_name) values ($1, null, 'platform_operator', 'Op')`,
    [id],
  );
}

async function testRunKur(tenantId: string) {
  const control = await db.sql(`select id from public.controls limit 1`);
  const tanim = await db.sql(
    `insert into public.control_test_definitions (tenant_id, control_id, tur, ad) values ($1, $2, 'MANUAL_PROCEDURE', 'T') returning id`,
    [tenantId, control.rows[0].id],
  );
  const run = await db.sql(
    `insert into public.test_runs (tenant_id, test_definition_id, control_id, sonuc, gerekce, tanim_surumu)
     values ($1, $2, $3, 'PASSED', 'g', 1) returning id`,
    [tenantId, tanim.rows[0].id, control.rows[0].id],
  );
  const outbox = await db.sql(
    `select id from public.ledger_outbox where artifact_table = 'test_runs' and artifact_id = $1`,
    [run.rows[0].id],
  );
  return { testRunId: run.rows[0].id as string, outboxId: outbox.rows[0].id as string };
}

describe("K2 — claim semantiği: tamamlanmış/dead-letter iş yeniden alınmaz", () => {
  it("PROCESSED iş tekrar claim edilmez", async () => {
    const { outboxId } = await testRunKur(seed.A.tenantId);
    await db.asUser(seed.A.userId, `select * from public.ledger_outbox_claim(10)`);
    const entry = await db.sql(
      `insert into public.transparency_ledger_entries (tenant_id, statement_kind, statement_hash, signed_statement, leaf_hash)
       values ($1, 'CONTROL_TEST_RUN', $2, '{}'::jsonb, $3) returning id`,
      [seed.A.tenantId, "a".repeat(64), "b".repeat(64)],
    );
    await db.asUser(seed.A.userId, `select public.ledger_outbox_mark_processed($1, $2)`, [outboxId, entry.rows[0].id]);

    const tekrar = await db.asUser(seed.A.userId, `select * from public.ledger_outbox_claim(10)`);
    expect(tekrar.rows).toHaveLength(0);
  });

  it("maksimum deneme (5) aşılan FAILED iş bir daha claim edilmez", async () => {
    const { outboxId } = await testRunKur(seed.A.tenantId);
    await db.asUser(seed.A.userId, `select * from public.ledger_outbox_claim(10)`);
    for (let i = 0; i < 5; i++) {
      await db.asUser(seed.A.userId, `select public.ledger_outbox_mark_failed($1, 'hata')`, [outboxId]);
    }
    const { rows } = await db.sql(`select durum from public.ledger_outbox where id = $1`, [outboxId]);
    expect(rows[0].durum).toBe("FAILED");

    const tekrar = await db.asUser(seed.A.userId, `select * from public.ledger_outbox_claim(10)`);
    expect(tekrar.rows).toHaveLength(0);
  });

  it("lease süresi dolmuş (5 dk+) PROCESSING kayıt kontrollü PENDING'e döner ve yeniden claim edilir", async () => {
    const { outboxId } = await testRunKur(seed.A.tenantId);
    await db.asUser(seed.A.userId, `select * from public.ledger_outbox_claim(10)`);
    // Çökme simülasyonu: islenme_at'i 6 dakika öncesine çek (worker crash sonrası
    // gerçekte olacağının SQL-seviyesi eşdeğeri — sistem saatini değiştiremeyiz).
    await db.sql(`update public.ledger_outbox set islenme_at = now() - interval '6 minutes' where id = $1`, [outboxId]);

    const kurtarma = await db.asUser(seed.A.userId, `select * from public.ledger_outbox_claim(10)`);
    expect(kurtarma.rows).toHaveLength(1);
    expect(kurtarma.rows[0].id).toBe(outboxId);
    expect(kurtarma.rows[0].durum).toBe("PROCESSING");
  });

  it("henüz 5 dakika dolmamış PROCESSING kayıt geri alınmaz (erken kurtarma YOK)", async () => {
    const { outboxId } = await testRunKur(seed.A.tenantId);
    await db.asUser(seed.A.userId, `select * from public.ledger_outbox_claim(10)`);
    await db.sql(`update public.ledger_outbox set islenme_at = now() - interval '2 minutes' where id = $1`, [outboxId]);
    const tekrar = await db.asUser(seed.A.userId, `select * from public.ledger_outbox_claim(10)`);
    expect(tekrar.rows).toHaveLength(0);
  });
});

describe("K2 — terminal hata (yeniden denenmesi anlamsız hatalar)", () => {
  it("mark_failed_terminal TEK çağrıda deneme bütçesini beklemeden FAILED'e düşürür", async () => {
    const { outboxId } = await testRunKur(seed.A.tenantId);
    await db.asUser(seed.A.userId, `select * from public.ledger_outbox_claim(10)`);
    await db.asUser(seed.A.userId, `select public.ledger_outbox_mark_failed_terminal($1, 'manifest builder yok')`, [outboxId]);
    const { rows } = await db.sql(`select durum, deneme_sayisi, son_hata from public.ledger_outbox where id = $1`, [outboxId]);
    expect(rows[0].durum).toBe("FAILED");
    expect(Number(rows[0].deneme_sayisi)).toBe(1); // 5 hak TÜKETİLMEDİ, tek çağrıda terminal
    expect(rows[0].son_hata).toContain("manifest builder yok");
  });

  it("mevcut 2-parametreli mark_failed DOKUNULMADAN aynı şekilde çalışmaya devam eder", async () => {
    const { outboxId } = await testRunKur(seed.A.tenantId);
    await db.asUser(seed.A.userId, `select * from public.ledger_outbox_claim(10)`);
    await db.asUser(seed.A.userId, `select public.ledger_outbox_mark_failed($1, 'gecici hata')`, [outboxId]);
    const { rows } = await db.sql(`select durum, deneme_sayisi from public.ledger_outbox where id = $1`, [outboxId]);
    expect(rows[0].durum).toBe("PENDING"); // 1. deneme: hâlâ yeniden denenir (eski davranış)
    expect(Number(rows[0].deneme_sayisi)).toBe(1);
  });
});

describe("K2 — orphan-leaf görünürlüğü (crash-retry sonrası duplicate imzalama senaryosu)", () => {
  it("aynı outbox kaydına FARKLI iki ledger_entry_id ile mark_processed çağrılırsa: durum PROCESSED kalır, yalnız İLK link tutulur, audit izi düşer", async () => {
    const { testRunId, outboxId } = await testRunKur(seed.A.tenantId);
    await db.asUser(seed.A.userId, `select * from public.ledger_outbox_claim(10)`);

    const entry1 = await db.sql(
      `insert into public.transparency_ledger_entries (tenant_id, statement_kind, statement_hash, signed_statement, leaf_hash)
       values ($1, 'CONTROL_TEST_RUN', $2, '{}'::jsonb, $3) returning id`,
      [seed.A.tenantId, "1".repeat(64), "1".repeat(64)],
    );
    await db.asUser(seed.A.userId, `select public.ledger_outbox_mark_processed($1, $2)`, [outboxId, entry1.rows[0].id]);

    // Crash-retry simülasyonu: İKİNCİ, FARKLI bir ledger entry (gerçekte
    // ledgerOutboxDrain'in idempotency ön-kontrolü BUNU engeller — bu test
    // o kontrol BAYPAS EDİLİRSE DB'nin kendi güvenlik ağının çalıştığını
    // kanıtlar).
    const entry2 = await db.sql(
      `insert into public.transparency_ledger_entries (tenant_id, statement_kind, statement_hash, signed_statement, leaf_hash)
       values ($1, 'CONTROL_TEST_RUN', $2, '{}'::jsonb, $3) returning id`,
      [seed.A.tenantId, "2".repeat(64), "2".repeat(64)],
    );
    await db.asUser(seed.A.userId, `select public.ledger_outbox_mark_processed($1, $2)`, [outboxId, entry2.rows[0].id]);

    const { rows: linkler } = await db.sql(
      `select ledger_entry_id from public.artifact_ledger_links where artifact_table = 'test_runs' and artifact_id = $1`,
      [testRunId],
    );
    expect(linkler).toHaveLength(1);
    expect(linkler[0].ledger_entry_id).toBe(entry1.rows[0].id); // İLK kazanır, ikinci orphan kalır

    const { rows: audit } = await db.sql(
      `select detay from public.audit_log where eylem = 'olasi_orphan_leaf_tespit_edildi' and hedef_id = $1`,
      [testRunId],
    );
    expect(audit).toHaveLength(1);
    const detay = audit[0].detay as { orphanLedgerEntryId: string; kullanilanLedgerEntryId: string };
    expect(detay.orphanLedgerEntryId).toBe(entry2.rows[0].id);

    // Orphan entry SİLİNMEDİ (immutable defter) — yalnız bağlanmadı.
    const { rows: entry2Var } = await db.sql(`select id from public.transparency_ledger_entries where id = $1`, [
      entry2.rows[0].id,
    ]);
    expect(entry2Var).toHaveLength(1);
  });
});

describe("K2 — kill-switch (consumer_etkin) — restore/bakım sonrası varsayılan kapalı senaryosu", () => {
  it("varsayılan: consumer_etkin=true, claim normal çalışır", async () => {
    const { rows } = await db.sql(`select consumer_etkin from public.ledger_outbox_ayarlari where id = 1`);
    expect(rows[0].consumer_etkin).toBe(true);
  });

  it("consumer_etkin=false iken PENDING kayıt olsa bile HİÇBİR şey claim edilmez", async () => {
    await testRunKur(seed.A.tenantId);
    await db.sql(`update public.ledger_outbox_ayarlari set consumer_etkin = false where id = 1`);
    const claim = await db.asUser(seed.A.userId, `select * from public.ledger_outbox_claim(10)`);
    expect(claim.rows).toHaveLength(0);
    // Kayıt hâlâ PENDING — kaybolmadı, yalnız claim edilmedi.
    const { rows } = await db.sql(`select durum from public.ledger_outbox where tenant_id = $1`, [seed.A.tenantId]);
    expect(rows[0].durum).toBe("PENDING");
  });

  it("yeniden consumer_etkin=true yapılınca aynı kayıt normal claim edilir", async () => {
    const { outboxId } = await testRunKur(seed.A.tenantId);
    await db.sql(`update public.ledger_outbox_ayarlari set consumer_etkin = false where id = 1`);
    await db.asUser(seed.A.userId, `select * from public.ledger_outbox_claim(10)`);
    await db.sql(`update public.ledger_outbox_ayarlari set consumer_etkin = true where id = 1`);
    const claim = await db.asUser(seed.A.userId, `select * from public.ledger_outbox_claim(10)`);
    expect(claim.rows).toHaveLength(1);
    expect(claim.rows[0].id).toBe(outboxId);
  });

  it("yalnız platform_operator anahtarı değiştirebilir; tenant admin'in UPDATE'i sıfır satır etkiler (RLS USING filtresi)", async () => {
    // RLS UPDATE semantiği: USING yan tümcesi satırı görünmez kılar — bu bir
    // İSTİSNA fırlatmaz, satır kümesi boş kalır (0 satır güncellenir).
    await db.asUser(seed.A.userId, `update public.ledger_outbox_ayarlari set consumer_etkin = false where id = 1`);
    const { rows } = await db.sql(`select consumer_etkin from public.ledger_outbox_ayarlari where id = 1`);
    expect(rows[0].consumer_etkin).toBe(true); // DEĞİŞMEDİ
  });

  it("herhangi bir authenticated kullanıcı durumu OKUYABİLİR", async () => {
    const { rows } = await db.asUser(seed.A.userId, `select consumer_etkin from public.ledger_outbox_ayarlari where id = 1`);
    expect(rows).toHaveLength(1);
  });
});

describe("K2 — manuel yeniden deneme (dead-letter kurtarma)", () => {
  it("admin/uyum FAILED bir kaydı PENDING'e döndürür + audit izi bırakır + deneme sıfırlanır", async () => {
    const { outboxId } = await testRunKur(seed.A.tenantId);
    await db.asUser(seed.A.userId, `select * from public.ledger_outbox_claim(10)`);
    for (let i = 0; i < 5; i++) {
      await db.asUser(seed.A.userId, `select public.ledger_outbox_mark_failed($1, 'hata')`, [outboxId]);
    }
    const sonuc = await db.asUser(seed.A.userId, `select public.ledger_outbox_manual_retry($1) as basarili`, [outboxId]);
    expect(sonuc.rows[0].basarili).toBe(true);

    const { rows } = await db.sql(`select durum, deneme_sayisi, son_hata from public.ledger_outbox where id = $1`, [outboxId]);
    expect(rows[0].durum).toBe("PENDING");
    expect(Number(rows[0].deneme_sayisi)).toBe(0);
    expect(rows[0].son_hata).toBeNull();

    const { rows: audit } = await db.sql(
      `select id from public.audit_log where eylem = 'outbox_kaydi_manuel_yeniden_denendi' and hedef_id = $1`,
      [outboxId],
    );
    expect(audit.length).toBeGreaterThanOrEqual(1);
  });

  it("aynı iş için PARALEL ikinci manuel retry çift etki üretmez (ikinci çağrı no-op)", async () => {
    const { outboxId } = await testRunKur(seed.A.tenantId);
    await db.asUser(seed.A.userId, `select * from public.ledger_outbox_claim(10)`);
    for (let i = 0; i < 5; i++) {
      await db.asUser(seed.A.userId, `select public.ledger_outbox_mark_failed($1, 'hata')`, [outboxId]);
    }
    const birinci = await db.asUser(seed.A.userId, `select public.ledger_outbox_manual_retry($1) as basarili`, [outboxId]);
    const ikinci = await db.asUser(seed.A.userId, `select public.ledger_outbox_manual_retry($1) as basarili`, [outboxId]);
    expect(birinci.rows[0].basarili).toBe(true);
    expect(ikinci.rows[0].basarili).toBe(false); // artık FAILED değil, PENDING — no-op

    const { rows: audit } = await db.sql(
      `select id from public.audit_log where eylem = 'outbox_kaydi_manuel_yeniden_denendi' and hedef_id = $1`,
      [outboxId],
    );
    expect(audit).toHaveLength(1); // yalnız BİR audit satırı
  });

  it("cross-tenant: B, A'nın FAILED kaydını manuel yeniden deneyemez", async () => {
    const { outboxId } = await testRunKur(seed.A.tenantId);
    await db.asUser(seed.A.userId, `select * from public.ledger_outbox_claim(10)`);
    for (let i = 0; i < 5; i++) {
      await db.asUser(seed.A.userId, `select public.ledger_outbox_mark_failed($1, 'hata')`, [outboxId]);
    }
    const sonuc = await db.asUser(seed.B.userId, `select public.ledger_outbox_manual_retry($1) as basarili`, [outboxId]);
    expect(sonuc.rows[0].basarili).toBe(false);
    const { rows } = await db.sql(`select durum from public.ledger_outbox where id = $1`, [outboxId]);
    expect(rows[0].durum).toBe("FAILED"); // değişmedi
  });
});

describe("K2 — sağlık özeti: tenant izolasyonu + platform_operator minimize görünürlük", () => {
  it("tenant admin yalnız KENDİ tenant'ının özetini görür", async () => {
    await testRunKur(seed.A.tenantId);
    await testRunKur(seed.B.tenantId);
    const ozet = await db.asUser(seed.A.userId, `select public.ledger_outbox_saglik_ozeti() as ozet`);
    const veri = ozet.rows[0].ozet as { kapsam: string; pendingSayisi: number };
    expect(veri.kapsam).toBe("TENANT");
    expect(veri.pendingSayisi).toBe(1); // yalnız A'nınki, B'ninki değil
  });

  it("platform_operator GLOBAL toplam görür, tenant kimliği/payload İÇERMEZ", async () => {
    const opId = "e0000000-0000-0000-0000-000000000001";
    await platformOperatorKur(opId, "op@demo.com");
    await testRunKur(seed.A.tenantId);
    await testRunKur(seed.B.tenantId);

    const ozet = await db.asUser(opId, `select public.ledger_outbox_saglik_ozeti() as ozet`);
    const veri = ozet.rows[0].ozet as Record<string, unknown>;
    expect(veri.kapsam).toBe("GLOBAL");
    expect(veri.pendingSayisi).toBe(2); // İKİ tenant'ın toplamı
    // Hassas/tenant-tanımlayıcı alan YOK: yalnız beklenen anahtarlar var.
    const beklenenAnahtarlar = [
      "kapsam",
      "pendingSayisi",
      "staleProcessingSayisi",
      "processingSayisi",
      "failedSayisi",
      "enEskiPendingYasSaniye",
      "jobTuruBazinda",
    ].sort();
    expect(Object.keys(veri).sort()).toEqual(beklenenAnahtarlar);
    expect(JSON.stringify(veri)).not.toContain(seed.A.tenantId);
    expect(JSON.stringify(veri)).not.toContain(seed.B.tenantId);
  });

  it("en eski pending yaşı doğru hesaplanır (eski kayıt simülasyonu)", async () => {
    const { outboxId } = await testRunKur(seed.A.tenantId);
    await db.sql(`update public.ledger_outbox set created_at = now() - interval '40 minutes' where id = $1`, [outboxId]);
    const ozet = await db.asUser(seed.A.userId, `select public.ledger_outbox_saglik_ozeti() as ozet`);
    const veri = ozet.rows[0].ozet as { enEskiPendingYasSaniye: number };
    expect(veri.enEskiPendingYasSaniye).toBeGreaterThan(35 * 60);
  });
});

describe("K2 — kontrol test sonucu, ledger/consumer hatasından İZOLE (kural 13/21'in veri-seviyesi kanıtı)", () => {
  it("ledger_outbox mark_failed/mark_failed_terminal çağrıları test_runs.sonuc'a DOKUNMAZ", async () => {
    const { testRunId, outboxId } = await testRunKur(seed.A.tenantId);
    await db.asUser(seed.A.userId, `select * from public.ledger_outbox_claim(10)`);
    await db.asUser(seed.A.userId, `select public.ledger_outbox_mark_failed_terminal($1, 'ledger consumer hatasi')`, [outboxId]);

    const { rows } = await db.sql(`select sonuc from public.test_runs where id = $1`, [testRunId]);
    // Kontrol testi sonucu (PASSED) — ledger'ın kendi hatasından ETKİLENMEDİ.
    // "consumer hatası = kanıt geçersiz değildir" (K2 §6) burada veri
    // seviyesinde kanıtlanıyor: iki kayıt (test_runs / ledger_outbox)
    // birbirinden BAĞIMSIZ durum taşır.
    expect(rows[0].sonuc).toBe("PASSED");
  });
});
