// 37 Tez Dikey B, Faz 3 ilk dilim (20260720130000): roi_export_runs —
// sealed snapshot + maker-checker yayın onayı. Guard BAŞTAN doğru yazıldı
// (INSERT-anı yalnız TASLAK'a izin verir — sod_import_rollbacklari'nda
// bulunan INSERT-bypass'ın burada TEKRARLANMADIĞINI kanıtlayan testler).
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, seedTwoTenants, type TestDb } from "./helpers/pg";

let db: TestDb;
let seed: Awaited<ReturnType<typeof seedTwoTenants>>;
const A_IKINCI = "a0000000-0000-0000-0000-000000000002";

async function exportEkle(tenantId: string, extra: Record<string, unknown> = {}) {
  const { rows } = await db.sql(
    `insert into public.roi_export_runs (tenant_id, talep_eden, paket, paket_hash, on_kontrol_raporu, engelleyici_sorun_sayisi, durum)
     values ($1, $2, $3::jsonb, $4, $5::jsonb, $6, coalesce($7, 'TASLAK')) returning id`,
    [
      tenantId,
      extra.talep_eden ?? seed.A.userId,
      JSON.stringify(extra.paket ?? { schema: "KALKAN_ROI_EXPORT_V1" }),
      extra.paket_hash ?? "a".repeat(64),
      JSON.stringify(extra.on_kontrol_raporu ?? { sorunlar: [], engelleyiciSayisi: 0 }),
      extra.engelleyici_sorun_sayisi ?? 0,
      extra.durum ?? null,
    ],
  );
  return rows[0].id as string;
}

beforeEach(async () => {
  db = await createTestDb();
  seed = await seedTwoTenants(db);
  await db.sql(`insert into auth.users (id, email) values ($1, 'a-ikinci@demo.com')`, [A_IKINCI]);
  await db.sql(`insert into public.profiles (id, tenant_id, role, full_name) values ($1, $2, 'uyum', 'A İkinci')`, [A_IKINCI, seed.A.tenantId]);
});
afterEach(async () => {
  await db.close();
});

describe("roi_export_runs — INSERT-anı guard'ı (sod_import_rollbacklari'nın BULUNAN açığı burada tekrarlanmadı)", () => {
  it("INSERT-anında ONAY_TALEP_EDILDI doğrudan doğamaz", async () => {
    await expect(exportEkle(seed.A.tenantId, { durum: "ONAY_TALEP_EDILDI" })).rejects.toThrow(/INSERT anında yalniz TASLAK/i);
  });

  it("INSERT-anında YAYINLANDI doğrudan doğamaz (aynı kişi kendi export'unu 'onaylanmış' gibi INSERT edemez)", async () => {
    await expect(
      exportEkle(seed.A.tenantId, { durum: "YAYINLANDI" }),
    ).rejects.toThrow(/INSERT anında yalniz TASLAK/i);
  });

  it("INSERT-anında REDDEDILDI doğrudan doğamaz", async () => {
    await expect(exportEkle(seed.A.tenantId, { durum: "REDDEDILDI" })).rejects.toThrow(/INSERT anında yalniz TASLAK/i);
  });

  it("TASLAK olarak INSERT edilir, talep_eden kimlik atfı istemci bağlamında sabitlenir", async () => {
    const { rows } = await db.asUser(
      seed.A.userId,
      `insert into public.roi_export_runs (tenant_id, talep_eden, paket, paket_hash, on_kontrol_raporu)
       values ($1, $2, '{}'::jsonb, $3, '{}'::jsonb) returning talep_eden, durum`,
      [seed.A.tenantId, A_IKINCI, "b".repeat(64)],
    );
    // Guard talep_eden'i oturum sahibine SABİTLER — client'ın verdiği A_IKINCI'yi yok sayar.
    expect(rows[0].talep_eden).toBe(seed.A.userId);
    expect(rows[0].durum).toBe("TASLAK");
  });
});

describe("roi_export_runs — export öncesi engelleme (kurucu talimatı)", () => {
  it("engelleyici sorun varken ONAY_TALEP_EDILDI'ye geçiş reddedilir", async () => {
    const id = await exportEkle(seed.A.tenantId, { engelleyici_sorun_sayisi: 2 });
    await expect(
      db.sql(`update public.roi_export_runs set durum = 'ONAY_TALEP_EDILDI' where id = $1`, [id]),
    ).rejects.toThrow(/Engelleyici sorun/i);
  });

  it("engelleyici sorun yoksa ONAY_TALEP_EDILDI'ye geçilebilir", async () => {
    const id = await exportEkle(seed.A.tenantId, { engelleyici_sorun_sayisi: 0 });
    await db.sql(`update public.roi_export_runs set durum = 'ONAY_TALEP_EDILDI' where id = $1`, [id]);
    const { rows } = await db.sql(`select durum from public.roi_export_runs where id = $1`, [id]);
    expect(rows[0].durum).toBe("ONAY_TALEP_EDILDI");
  });
});

describe("roi_export_runs — maker-checker yayın onayı", () => {
  it("talep eden kendi export'unu YAYINLANDI yapamaz", async () => {
    const id = await exportEkle(seed.A.tenantId, { talep_eden: seed.A.userId });
    await db.sql(`update public.roi_export_runs set durum = 'ONAY_TALEP_EDILDI' where id = $1`, [id]);
    await expect(
      db.sql(
        `update public.roi_export_runs set durum = 'YAYINLANDI', onaylayan = $2, onay_zamani = now() where id = $1`,
        [id, seed.A.userId],
      ),
    ).rejects.toThrow(/maker-checker/i);
  });

  it("farklı kişi onaylarsa YAYINLANDI olur", async () => {
    const id = await exportEkle(seed.A.tenantId, { talep_eden: seed.A.userId });
    await db.sql(`update public.roi_export_runs set durum = 'ONAY_TALEP_EDILDI' where id = $1`, [id]);
    await db.sql(
      `update public.roi_export_runs set durum = 'YAYINLANDI', onaylayan = $2, onay_zamani = now() where id = $1`,
      [id, A_IKINCI],
    );
    const { rows } = await db.sql(`select durum, onaylayan from public.roi_export_runs where id = $1`, [id]);
    expect(rows[0].durum).toBe("YAYINLANDI");
    expect(rows[0].onaylayan).toBe(A_IKINCI);
  });

  it("YAYINLANDI terminal — bir daha değiştirilemez", async () => {
    const id = await exportEkle(seed.A.tenantId, { talep_eden: seed.A.userId });
    await db.sql(`update public.roi_export_runs set durum = 'ONAY_TALEP_EDILDI' where id = $1`, [id]);
    await db.sql(`update public.roi_export_runs set durum = 'YAYINLANDI', onaylayan = $2, onay_zamani = now() where id = $1`, [id, A_IKINCI]);
    await expect(
      db.sql(`update public.roi_export_runs set durum = 'TASLAK' where id = $1`, [id]),
    ).rejects.toThrow(/degistirilemez/i);
  });

  it("mühürlenmiş içerik (paket/paket_hash) hiçbir durumda değiştirilemez", async () => {
    const id = await exportEkle(seed.A.tenantId);
    await expect(
      db.sql(`update public.roi_export_runs set paket_hash = $2 where id = $1`, [id, "c".repeat(64)]),
    ).rejects.toThrow(/degistirilemez/i);
  });

  it("REDDEDILDI de onaylayan != talep_eden ister", async () => {
    const id = await exportEkle(seed.A.tenantId, { talep_eden: seed.A.userId });
    await db.sql(`update public.roi_export_runs set durum = 'ONAY_TALEP_EDILDI' where id = $1`, [id]);
    await expect(
      db.sql(`update public.roi_export_runs set durum = 'REDDEDILDI', onaylayan = $2, onay_zamani = now() where id = $1`, [id, seed.A.userId]),
    ).rejects.toThrow(/maker-checker/i);
  });
});

describe("roi_export_runs — RLS + audit", () => {
  it("cross-tenant: B, A'nın export'unu göremez", async () => {
    const id = await exportEkle(seed.A.tenantId);
    const { rows } = await db.asUser(seed.B.userId, `select id from public.roi_export_runs where id = $1`, [id]);
    expect(rows).toHaveLength(0);
  });

  it("oluşturma audit_log'a düşer", async () => {
    const id = await exportEkle(seed.A.tenantId);
    const { rows } = await db.sql(`select id from public.audit_log where eylem = 'roi_export_olusturuldu' and hedef_id = $1`, [id]);
    expect(rows).toHaveLength(1);
  });
});

describe("proof_room_links — roi_export_run_id polimorfik hedef", () => {
  it("test_run_id ve roi_export_run_id'nin İKİSİ de dolu olamaz", async () => {
    const { rows: tr } = await db.sql(
      `insert into public.control_test_definitions (tenant_id, control_id, tur, ad)
       values ($1, $2, 'MANUAL_PROCEDURE', 'Test') returning id`,
      [seed.A.tenantId, seed.controlId],
    );
    const { rows: run } = await db.sql(
      `insert into public.test_runs (tenant_id, test_definition_id, control_id, sonuc, gerekce, tanim_surumu)
       values ($1, $2, $3, 'PASSED', 'test', 1) returning id`,
      [seed.A.tenantId, tr[0].id, seed.controlId],
    );
    const exportId = await exportEkle(seed.A.tenantId);
    await expect(
      db.sql(
        `insert into public.proof_room_links (tenant_id, test_run_id, roi_export_run_id, son_gecerlilik)
         values ($1, $2, $3, now() + interval '7 days')`,
        [seed.A.tenantId, run[0].id, exportId],
      ),
    ).rejects.toThrow();
  });

  it("yalnız roi_export_run_id ile link kurulabilir", async () => {
    const exportId = await exportEkle(seed.A.tenantId);
    const { rows } = await db.sql(
      `insert into public.proof_room_links (tenant_id, roi_export_run_id, son_gecerlilik)
       values ($1, $2, now() + interval '7 days') returning id`,
      [seed.A.tenantId, exportId],
    );
    expect(rows).toHaveLength(1);
  });
});
