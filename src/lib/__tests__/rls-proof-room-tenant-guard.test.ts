// Dikey E, E2, Kapı 1 (20260720280000): proof_room_links'in DÖRT polimorfik
// hedefi için merkezi cross-tenant guard (proof_room_link_target_guard).
// E1'in dar cloud_assurance_profile_id-yalnız guard'ının YERİNİ ALDI —
// eski üç hedefte (test_run_id/roi_export_run_id/graph_snapshot_id) hiç
// var olmayan bir güvenlik boşluğu kapatılıyor.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, seedTwoTenants, type TestDb } from "./helpers/pg";

let db: TestDb;
let seed: Awaited<ReturnType<typeof seedTwoTenants>>;

async function testRunEkle(tenantId: string, controlId: string) {
  const { rows: tr } = await db.sql(
    `insert into public.control_test_definitions (tenant_id, control_id, tur, ad)
     values ($1, $2, 'MANUAL_PROCEDURE', 'Test') returning id`,
    [tenantId, controlId],
  );
  const { rows: run } = await db.sql(
    `insert into public.test_runs (tenant_id, test_definition_id, control_id, sonuc, gerekce, tanim_surumu)
     values ($1, $2, $3, 'PASSED', 'test', 1) returning id`,
    [tenantId, tr[0].id, controlId],
  );
  return run[0].id as string;
}

async function roiExportEkle(tenantId: string, userId: string) {
  // Dört-göz/maker-checker INSERT-bypass koruması: INSERT anında yalnız
  // TASLAK doğabilir (roi_export_run_guard). Proof Room link testi export'un
  // hangi durumda olduğuyla ilgilenmiyor — yalnız tenant_id doğru mu.
  const { rows } = await db.sql(
    `insert into public.roi_export_runs (tenant_id, talep_eden, paket, paket_hash, on_kontrol_raporu, engelleyici_sorun_sayisi)
     values ($1, $2, $3::jsonb, $4, $5::jsonb, 0) returning id`,
    [
      tenantId,
      userId,
      JSON.stringify({ schema: "KALKAN_ROI_EXPORT_V1" }),
      "b".repeat(64),
      JSON.stringify({ sorunlar: [], engelleyiciSayisi: 0 }),
    ],
  );
  return rows[0].id as string;
}

async function graphSnapshotEkle(tenantId: string) {
  const { rows } = await db.sql(
    `insert into public.impact_graph_snapshots (tenant_id, graf, graf_hash, spof_raporu, yayilim_raporu, hesaplama_yontemi)
     values ($1, $2::jsonb, $3, $4::jsonb, $5::jsonb, $6::jsonb) returning id`,
    [
      tenantId,
      JSON.stringify({ dugumler: [], kenarlar: [] }),
      "c".repeat(64),
      JSON.stringify({ sistemikNoktalar: [], hesaplamaYontemi: "t" }),
      JSON.stringify({ baslangicDugumIdleri: [], yon: "ileri", etkilenenler: [], hesaplamaYontemi: "t" }),
      JSON.stringify({}),
    ],
  );
  return rows[0].id as string;
}

async function tedarikciEkle(tenantId: string, ad: string) {
  const { rows } = await db.sql(`insert into public.third_parties (tenant_id, ad) values ($1, $2) returning id`, [tenantId, ad]);
  return rows[0].id as string;
}

async function cloudProfilEkle(tenantId: string, thirdPartyId: string) {
  const { rows } = await db.sql(
    `insert into public.cloud_assurance_profile_snapshots (tenant_id, third_party_id, profil, profil_hash, hesaplama_yontemi)
     values ($1, $2, $3::jsonb, $4, $5::jsonb) returning id`,
    [tenantId, thirdPartyId, JSON.stringify({}), "d".repeat(64), JSON.stringify({})],
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

describe("proof_room_link_target_guard — dört hedefte de cross-tenant reddi", () => {
  it("1) Tenant A, Tenant B'nin test_run_id'siyle link oluşturamaz", async () => {
    const bRun = await testRunEkle(seed.B.tenantId, seed.controlId);
    await expect(
      db.sql(
        `insert into public.proof_room_links (tenant_id, test_run_id, son_gecerlilik) values ($1, $2, now() + interval '7 days')`,
        [seed.A.tenantId, bRun],
      ),
    ).rejects.toThrow(/cross-tenant/i);
  });

  it("2) Tenant A, Tenant B'nin roi_export_run_id'siyle link oluşturamaz", async () => {
    const bExport = await roiExportEkle(seed.B.tenantId, seed.B.userId);
    await expect(
      db.sql(
        `insert into public.proof_room_links (tenant_id, roi_export_run_id, son_gecerlilik) values ($1, $2, now() + interval '7 days')`,
        [seed.A.tenantId, bExport],
      ),
    ).rejects.toThrow(/cross-tenant/i);
  });

  it("3) Tenant A, Tenant B'nin graph_snapshot_id'siyle link oluşturamaz", async () => {
    const bSnap = await graphSnapshotEkle(seed.B.tenantId);
    await expect(
      db.sql(
        `insert into public.proof_room_links (tenant_id, graph_snapshot_id, son_gecerlilik) values ($1, $2, now() + interval '7 days')`,
        [seed.A.tenantId, bSnap],
      ),
    ).rejects.toThrow(/cross-tenant/i);
  });

  it("4) Tenant A, Tenant B'nin cloud_assurance_profile_id'siyle link oluşturamaz", async () => {
    const bTp = await tedarikciEkle(seed.B.tenantId, "B Vendor");
    const bProfil = await cloudProfilEkle(seed.B.tenantId, bTp);
    await expect(
      db.sql(
        `insert into public.proof_room_links (tenant_id, cloud_assurance_profile_id, son_gecerlilik) values ($1, $2, now() + interval '7 days')`,
        [seed.A.tenantId, bProfil],
      ),
    ).rejects.toThrow(/cross-tenant/i);
  });

  it("5) artefakt bulunmuyorsa insert reddedilir (var olmayan test_run_id)", async () => {
    await expect(
      db.sql(
        `insert into public.proof_room_links (tenant_id, test_run_id, son_gecerlilik) values ($1, $2, now() + interval '7 days')`,
        [seed.A.tenantId, "00000000-0000-0000-0000-000000000000"],
      ),
    ).rejects.toThrow();
  });

  it("6) birden fazla hedef verilirse CHECK reddeder", async () => {
    const aRun = await testRunEkle(seed.A.tenantId, seed.controlId);
    const aSnap = await graphSnapshotEkle(seed.A.tenantId);
    await expect(
      db.sql(
        `insert into public.proof_room_links (tenant_id, test_run_id, graph_snapshot_id, son_gecerlilik) values ($1, $2, $3, now() + interval '7 days')`,
        [seed.A.tenantId, aRun, aSnap],
      ),
    ).rejects.toThrow();
  });

  it("7) hiç hedef verilmezse CHECK reddeder", async () => {
    await expect(
      db.sql(`insert into public.proof_room_links (tenant_id, son_gecerlilik) values ($1, now() + interval '7 days')`, [seed.A.tenantId]),
    ).rejects.toThrow();
  });

  it("8) geçerli aynı-tenant hedef her dört tür için kabul edilir", async () => {
    const aRun = await testRunEkle(seed.A.tenantId, seed.controlId);
    const aExport = await roiExportEkle(seed.A.tenantId, seed.A.userId);
    const aSnap = await graphSnapshotEkle(seed.A.tenantId);
    const aTp = await tedarikciEkle(seed.A.tenantId, "A Vendor");
    const aProfil = await cloudProfilEkle(seed.A.tenantId, aTp);

    const { rows: r1 } = await db.sql(
      `insert into public.proof_room_links (tenant_id, test_run_id, son_gecerlilik) values ($1, $2, now() + interval '7 days') returning id`,
      [seed.A.tenantId, aRun],
    );
    const { rows: r2 } = await db.sql(
      `insert into public.proof_room_links (tenant_id, roi_export_run_id, son_gecerlilik) values ($1, $2, now() + interval '7 days') returning id`,
      [seed.A.tenantId, aExport],
    );
    const { rows: r3 } = await db.sql(
      `insert into public.proof_room_links (tenant_id, graph_snapshot_id, son_gecerlilik) values ($1, $2, now() + interval '7 days') returning id`,
      [seed.A.tenantId, aSnap],
    );
    const { rows: r4 } = await db.sql(
      `insert into public.proof_room_links (tenant_id, cloud_assurance_profile_id, son_gecerlilik) values ($1, $2, now() + interval '7 days') returning id`,
      [seed.A.tenantId, aProfil],
    );
    expect(r1).toHaveLength(1);
    expect(r2).toHaveLength(1);
    expect(r3).toHaveLength(1);
    expect(r4).toHaveLength(1);
  });

  it("9) service_role (RLS-bypass test bağlantısı) cross-tenant hedef oluşturamaz — trigger'a dayanır, RLS'e değil", async () => {
    const bRun = await testRunEkle(seed.B.tenantId, seed.controlId);
    // db.sql zaten service_role muadili (RLS bypass) — guard'ın RLS'e
    // DEĞİL trigger'a dayandığını doğrudan kanıtlar.
    await expect(
      db.sql(
        `insert into public.proof_room_links (tenant_id, test_run_id, son_gecerlilik) values ($1, $2, now() + interval '7 days')`,
        [seed.A.tenantId, bRun],
      ),
    ).rejects.toThrow(/cross-tenant/i);
  });

  it("10) UPDATE ile hedef alanı başka kiracının artefaktına değiştirilemez", async () => {
    const aRun = await testRunEkle(seed.A.tenantId, seed.controlId);
    const { rows: link } = await db.sql(
      `insert into public.proof_room_links (tenant_id, test_run_id, son_gecerlilik) values ($1, $2, now() + interval '7 days') returning id`,
      [seed.A.tenantId, aRun],
    );
    const bRun = await testRunEkle(seed.B.tenantId, seed.controlId);
    await expect(
      db.sql(`update public.proof_room_links set test_run_id = $2 where id = $1`, [link[0].id, bRun]),
    ).rejects.toThrow(/cross-tenant/i);
  });

  it("var olan geçerli linkler migration sırasında bozulmaz (regresyon)", async () => {
    const aRun = await testRunEkle(seed.A.tenantId, seed.controlId);
    const { rows: link } = await db.sql(
      `insert into public.proof_room_links (tenant_id, test_run_id, son_gecerlilik) values ($1, $2, now() + interval '7 days') returning id, token`,
      [seed.A.tenantId, aRun],
    );
    // Aynı satırı, hedefi DEĞİŞTİRMEDEN başka bir alanla (örn. iptal) güncellemek
    // guard'ı hiç tetiklemeden geçmeli — mevcut geçerli linkler bozulmaz.
    await db.sql(`update public.proof_room_links set iptal_edildi = true where id = $1`, [link[0].id]);
    const { rows } = await db.sql(`select iptal_edildi from public.proof_room_links where id = $1`, [link[0].id]);
    expect(rows[0].iptal_edildi).toBe(true);
  });
});
