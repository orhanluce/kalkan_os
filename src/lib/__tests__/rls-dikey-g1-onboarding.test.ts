import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./helpers/pg";

// Dikey G1 (docs/adr/PR0-dikeyG-g1-pilot-provisioning-onboarding-2026-07-22.md):
// self-servis bootstrap kapanışı + platform_operator izolasyonu + durum
// makinesi guard'ı + import maker-checker + regülasyon paketi VERIFIED-only
// kuralı. Canlı smoke (scripts/smoke-dikeyg-g1.ts, ÇALIŞTIRILDI VE SİLİNDİ)
// bu davranışları gerçek Supabase Auth oturumlarıyla doğruladı; bu dosya
// AYNI garantileri kalıcı, committed testler olarak sabitler.

let db: TestDb;
beforeEach(async () => {
  db = await createTestDb();
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

describe("Dikey G1 — self-servis bootstrap KAPALI", () => {
  it("1) authenticated ama profilsiz kullanıcı tenants'a INSERT edemez", async () => {
    const attackerId = "d0000000-0000-0000-0000-000000000001";
    await db.sql(`insert into auth.users (id, email) values ($1, 'attacker@demo.com')`, [attackerId]);
    await expect(
      db.asUser(attackerId, `insert into public.tenants (name, segment) values ('Saldırgan Tenant', 'diger')`),
    ).rejects.toThrow(/row-level security/i);
  });

  it("2) authenticated ama profilsiz kullanıcı BOŞ bir tenant'a kendini admin yapamaz", async () => {
    const attackerId = "d0000000-0000-0000-0000-000000000002";
    await db.sql(`insert into auth.users (id, email) values ($1, 'attacker2@demo.com')`, [attackerId]);
    const { rows } = await db.sql(`insert into public.tenants (name, segment) values ('Boş Tenant', 'diger') returning id`);
    const tenantId = rows[0].id as string;
    await expect(
      db.asUser(
        attackerId,
        `insert into public.profiles (id, tenant_id, role) values ($1, $2, 'admin')`,
        [attackerId, tenantId],
      ),
    ).rejects.toThrow(/row-level security/i);
  });
});

describe("Dikey G1 — platform_operator rolü + izolasyon", () => {
  it("3) platform_operator tenant_id NULL olmalı — CHECK constraint zorlar", async () => {
    const id = "d0000000-0000-0000-0000-000000000003";
    await db.sql(`insert into auth.users (id, email) values ($1, 'op3@demo.com')`, [id]);
    await expect(
      db.sql(
        `insert into public.profiles (id, tenant_id, role) values ($1, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'platform_operator')`,
        [id],
      ),
    ).rejects.toThrow();
  });

  it("4) normal rol tenant_id NULL olamaz — CHECK constraint zorlar", async () => {
    const id = "d0000000-0000-0000-0000-000000000004";
    await db.sql(`insert into auth.users (id, email) values ($1, 'op4@demo.com')`, [id]);
    await expect(
      db.sql(`insert into public.profiles (id, tenant_id, role) values ($1, null, 'admin')`, [id]),
    ).rejects.toThrow();
  });

  it("5) platform_operator tenant açabilir", async () => {
    const opId = "d0000000-0000-0000-0000-000000000005";
    await platformOperatorKur(opId, "op5@demo.com");
    const { rows } = await db.asUser(opId, `insert into public.tenants (name, segment) values ('G1 Pilot', 'araci_kurum') returning id`);
    expect(rows).toHaveLength(1);
  });

  it("6) platform_operator kritik hizmet (iş verisi) GÖREMEZ", async () => {
    const opId = "d0000000-0000-0000-0000-000000000006";
    await platformOperatorKur(opId, "op6@demo.com");
    const { rows: tenantRows } = await db.sql(`insert into public.tenants (name, segment) values ('G1 Pilot 6', 'araci_kurum') returning id`);
    const tenantId = tenantRows[0].id as string;
    await db.sql(`insert into public.critical_business_services (tenant_id, ad) values ($1, 'Ödeme Sistemi')`, [tenantId]);

    const { rows } = await db.asUser(opId, `select id from public.critical_business_services where tenant_id = $1`, [tenantId]);
    expect(rows).toHaveLength(0);
  });

  it("7) platform_operator ilk tenant-admin profilini oluşturabilir", async () => {
    const opId = "d0000000-0000-0000-0000-000000000007";
    await platformOperatorKur(opId, "op7@demo.com");
    const { rows: tenantRows } = await db.asUser(opId, `insert into public.tenants (name, segment) values ('G1 Pilot 7', 'araci_kurum') returning id`);
    const tenantId = tenantRows[0].id as string;
    const newAdminId = "d0000000-0000-0000-0000-000000000071";
    await db.sql(`insert into auth.users (id, email) values ($1, 'admin7@demo.com')`, [newAdminId]);
    // NOT "returning id": Postgres RLS ayrıca RETURNING'in görünürlüğünü bir
    // SELECT politikasıyla sınar — platform_operator, davet ettiği kullanıcının
    // kendi profilini GÖRMEZ (yalnız kendi satırını, profiles_select_self);
    // gerçek uygulama rotası (platform/tenants/route.ts) da bu yüzden BİLİNÇLİ
    // olarak .select() ZİNCİRLEMEZ. Doğrulama ayrı bir sorgu (service context) ile.
    await db.asUser(
      opId,
      `insert into public.profiles (id, tenant_id, role, full_name) values ($1, $2, 'admin', 'Yeni Admin')`,
      [newAdminId, tenantId],
    );
    const { rows } = await db.sql(`select id from public.profiles where id = $1`, [newAdminId]);
    expect(rows).toHaveLength(1);
  });
});

describe("Dikey G1 — tenant_provisioning durum makinesi", () => {
  async function provisioningKur(opId: string) {
    const { rows: tenantRows } = await db.asUser(opId, `insert into public.tenants (name, segment) values ('G1 Pilot Durum', 'araci_kurum') returning id`);
    const tenantId = tenantRows[0].id as string;
    const { rows } = await db.asUser(
      opId,
      `insert into public.tenant_provisioning (tenant_id, olusturan, davet_edilen_eposta) values ($1, $2, 'admin@pilot.test') returning id, durum`,
      [tenantId, opId],
    );
    return { tenantId, provId: rows[0].id as string, durum: rows[0].durum };
  }

  it("8) olusturan platform_operator DEĞİLSE reddedilir", async () => {
    const { tenantId, adminId } = await seedNormalTenant();
    await expect(
      db.sql(`insert into public.tenant_provisioning (tenant_id, olusturan, davet_edilen_eposta) values ($1, $2, 'x@y.com')`, [tenantId, adminId]),
    ).rejects.toThrow(/platform_operator/);
  });

  it("9) HAZIRLIK -> DAVET_GONDERILDI izinli geçiş", async () => {
    const opId = "d0000000-0000-0000-0000-000000000009";
    await platformOperatorKur(opId, "op9@demo.com");
    const { provId } = await provisioningKur(opId);
    await db.asUser(opId, `update public.tenant_provisioning set durum = 'DAVET_GONDERILDI' where id = $1`, [provId]);
    const { rows } = await db.sql(`select durum from public.tenant_provisioning where id = $1`, [provId]);
    expect(rows[0].durum).toBe("DAVET_GONDERILDI");
  });

  it("10) HAZIRLIK -> PILOT_AKTIF (izinsiz atlama) reddedilir", async () => {
    const opId = "d0000000-0000-0000-0000-000000000010";
    await platformOperatorKur(opId, "op10@demo.com");
    const { provId } = await provisioningKur(opId);
    await expect(
      db.asUser(opId, `update public.tenant_provisioning set durum = 'PILOT_AKTIF' where id = $1`, [provId]),
    ).rejects.toThrow(/not an allowed transition/);
  });

  it("10b) tenant admin KENDİ provisioning kaydını izinli hedeflere ilerletebilir", async () => {
    const opId = "d0000000-0000-0000-0000-00000000010b";
    await platformOperatorKur(opId, "op10b@demo.com");
    const { tenantId, provId } = await provisioningKur(opId);
    await db.sql(`update public.tenant_provisioning set durum = 'DAVET_GONDERILDI' where id = $1`, [provId]);
    const adminId = "e0000000-0000-0000-0000-000000010b01";
    await db.sql(`insert into auth.users (id, email) values ($1, 'tadmin10b@demo.com')`, [adminId]);
    await db.sql(`insert into public.profiles (id, tenant_id, role, full_name) values ($1, $2, 'admin', 'Tenant Admin')`, [adminId, tenantId]);

    await db.asUser(adminId, `update public.tenant_provisioning set durum = 'ILK_GIRIS_TAMAMLANDI' where id = $1`, [provId]);
    const { rows } = await db.sql(`select durum from public.tenant_provisioning where id = $1`, [provId]);
    expect(rows[0].durum).toBe("ILK_GIRIS_TAMAMLANDI");
  });

  it("10c) tenant admin KENDİ isteğiyle PILOT_AKTIF/DONDURULDU/SONA_ERDI ayarlayamaz (yalnız platform_operator)", async () => {
    const opId = "d0000000-0000-0000-0000-00000000010c";
    await platformOperatorKur(opId, "op10c@demo.com");
    const { tenantId, provId } = await provisioningKur(opId);
    await db.sql(`update public.tenant_provisioning set durum = 'DAVET_GONDERILDI' where id = $1`, [provId]);
    await db.sql(`update public.tenant_provisioning set durum = 'ILK_GIRIS_TAMAMLANDI' where id = $1`, [provId]);
    await db.sql(`update public.tenant_provisioning set durum = 'KURULUM_DEVAM_EDIYOR' where id = $1`, [provId]);
    await db.sql(`update public.tenant_provisioning set durum = 'KURULUM_INCELEMEDE' where id = $1`, [provId]);
    const adminId = "e0000000-0000-0000-0000-00000001c001";
    await db.sql(`insert into auth.users (id, email) values ($1, 'tadmin10c@demo.com')`, [adminId]);
    await db.sql(`insert into public.profiles (id, tenant_id, role, full_name) values ($1, $2, 'admin', 'Tenant Admin')`, [adminId, tenantId]);

    await expect(
      db.asUser(adminId, `update public.tenant_provisioning set durum = 'PILOT_AKTIF' where id = $1`, [provId]),
    ).rejects.toThrow(/row-level security/i);
  });

  it("11) PILOT_SONA_ERDI terminal — geri dönüş yok", async () => {
    const opId = "d0000000-0000-0000-0000-000000000011";
    await platformOperatorKur(opId, "op11@demo.com");
    const { provId } = await provisioningKur(opId);
    await db.sql(
      `update public.tenant_provisioning set durum = 'DAVET_GONDERILDI' where id = $1`,
      [provId],
    );
    await db.sql(`update public.tenant_provisioning set durum = 'ILK_GIRIS_TAMAMLANDI' where id = $1`, [provId]);
    await db.sql(`update public.tenant_provisioning set durum = 'KURULUM_DEVAM_EDIYOR' where id = $1`, [provId]);
    await db.sql(`update public.tenant_provisioning set durum = 'KURULUM_INCELEMEDE' where id = $1`, [provId]);
    await db.sql(`update public.tenant_provisioning set durum = 'PILOT_AKTIF' where id = $1`, [provId]);
    await db.sql(`update public.tenant_provisioning set durum = 'PILOT_SONA_ERDI' where id = $1`, [provId]);
    await expect(
      db.sql(`update public.tenant_provisioning set durum = 'PILOT_AKTIF' where id = $1`, [provId]),
    ).rejects.toThrow(/not an allowed transition/);
  });

  it("12) append-only audit izi: her INSERT/UPDATE bir satır bırakır", async () => {
    const opId = "d0000000-0000-0000-0000-000000000012";
    await platformOperatorKur(opId, "op12@demo.com");
    const { provId } = await provisioningKur(opId);
    await db.sql(`update public.tenant_provisioning set durum = 'DAVET_GONDERILDI' where id = $1`, [provId]);
    const { rows } = await db.sql(`select onceki_durum, yeni_durum from public.tenant_provisioning_audit where tenant_provisioning_id = $1 order by created_at`, [provId]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ onceki_durum: null, yeni_durum: "HAZIRLIK" });
    expect(rows[1]).toMatchObject({ onceki_durum: "HAZIRLIK", yeni_durum: "DAVET_GONDERILDI" });
  });

  it("13) audit izi immutable — UPDATE/DELETE reddedilir", async () => {
    const opId = "d0000000-0000-0000-0000-000000000013";
    await platformOperatorKur(opId, "op13@demo.com");
    const { provId } = await provisioningKur(opId);
    const { rows } = await db.sql(`select id from public.tenant_provisioning_audit where tenant_provisioning_id = $1`, [provId]);
    await expect(db.sql(`update public.tenant_provisioning_audit set yeni_durum = 'X' where id = $1`, [rows[0].id])).rejects.toThrow(/append-only/);
    await expect(db.sql(`delete from public.tenant_provisioning_audit where id = $1`, [rows[0].id])).rejects.toThrow(/append-only/);
  });
});

describe("Dikey G1 — onboarding import maker-checker", () => {
  it("14) önizlemeyi yükleyen kişi AYNI önizlemeyi uygulayamaz", async () => {
    const { tenantId, adminId } = await seedNormalTenant();
    const { rows } = await db.asUser(
      adminId,
      `insert into public.onboarding_import_onizlemeleri (tenant_id, entity_turu, kaynak, dosya_hash, normalized_records, kayit_sayisi, yukleyen)
       values ($1, 'KRITIK_HIZMET', 'csv', repeat('a', 64), '[{"ad":"Ödeme Sistemi"}]'::jsonb, 1, $2) returning id`,
      [tenantId, adminId],
    );
    const onizlemeId = rows[0].id as string;
    await expect(
      db.asUser(adminId, `select * from public.onboarding_import_uygula($1, $2)`, [onizlemeId, adminId]),
    ).rejects.toThrow(/bagimsizlik|dort goz/);
  });

  it("15) bağımsız ikinci kişi önizlemeyi uygulayabilir → gerçek kayıt oluşur", async () => {
    const { tenantId, adminId } = await seedNormalTenant();
    const secondAdminId = "d0000000-0000-0000-0000-000000000151";
    await db.sql(`insert into auth.users (id, email) values ($1, 'second@demo.com')`, [secondAdminId]);
    await db.sql(`insert into public.profiles (id, tenant_id, role, full_name) values ($1, $2, 'admin', 'İkinci Admin')`, [secondAdminId, tenantId]);

    const { rows } = await db.asUser(
      adminId,
      `insert into public.onboarding_import_onizlemeleri (tenant_id, entity_turu, kaynak, dosya_hash, normalized_records, kayit_sayisi, yukleyen)
       values ($1, 'KRITIK_HIZMET', 'csv', repeat('b', 64), '[{"ad":"Muhasebe Sistemi"}]'::jsonb, 1, $2) returning id`,
      [tenantId, adminId],
    );
    const onizlemeId = rows[0].id as string;
    const { rows: applyRows } = await db.asUser(secondAdminId, `select * from public.onboarding_import_uygula($1, $2)`, [onizlemeId, secondAdminId]);
    expect(applyRows[0].uygulanan_kayit_sayisi).toBe(1);

    const { rows: created } = await db.sql(`select ad from public.critical_business_services where tenant_id = $1 and ad = 'Muhasebe Sistemi'`, [tenantId]);
    expect(created).toHaveLength(1);
  });

  it("16) aynı önizleme İKİ KEZ uygulanamaz (durum APPLIED'e geçer)", async () => {
    const { tenantId, adminId } = await seedNormalTenant();
    const secondAdminId = "d0000000-0000-0000-0000-000000000161";
    await db.sql(`insert into auth.users (id, email) values ($1, 'second16@demo.com')`, [secondAdminId]);
    await db.sql(`insert into public.profiles (id, tenant_id, role, full_name) values ($1, $2, 'admin', 'İkinci Admin')`, [secondAdminId, tenantId]);
    const { rows } = await db.asUser(
      adminId,
      `insert into public.onboarding_import_onizlemeleri (tenant_id, entity_turu, kaynak, dosya_hash, normalized_records, kayit_sayisi, yukleyen)
       values ($1, 'TEDARIKCI', 'csv', repeat('c', 64), '[{"ad":"AWS"}]'::jsonb, 1, $2) returning id`,
      [tenantId, adminId],
    );
    const onizlemeId = rows[0].id as string;
    await db.asUser(secondAdminId, `select * from public.onboarding_import_uygula($1, $2)`, [onizlemeId, secondAdminId]);
    await expect(
      db.asUser(secondAdminId, `select * from public.onboarding_import_uygula($1, $2)`, [onizlemeId, secondAdminId]),
    ).rejects.toThrow(/uygulanabilir durumda degil/);
  });
});

describe("Dikey G1 — regülasyon paketi VERIFIED-only", () => {
  it("17) taslak (DRAFT_RESEARCH) paket tenant'a bağlanamaz", async () => {
    const { tenantId, adminId } = await seedNormalTenant();
    const { rows } = await db.sql(`insert into public.regulation_packages (kod, ad) values ('TEST_DRAFT', 'Test Taslak') returning id`);
    await expect(
      db.asUser(
        adminId,
        `insert into public.tenant_regulation_scope (tenant_id, regulation_package_id, secen) values ($1, $2, $3)`,
        [tenantId, rows[0].id, adminId],
      ),
    ).rejects.toThrow(/yalniz hukukca VERIFIED/);
  });

  it("18) VERIFIED paket tenant'a bağlanabilir", async () => {
    const { tenantId, adminId } = await seedNormalTenant();
    const legalId = "d0000000-0000-0000-0000-000000000180";
    await db.sql(`insert into auth.users (id, email) values ($1, 'legal18@demo.com')`, [legalId]);
    await db.sql(`insert into public.profiles (id, tenant_id, role, full_name) values ($1, $2, 'uyum', 'Hukuk')`, [legalId, tenantId]);
    const { rows } = await db.sql(`insert into public.regulation_packages (kod, ad) values ('TEST_V', 'Test Doğrulanmış') returning id`);
    const pkgId = rows[0].id as string;
    await db.sql(`update public.regulation_packages set hukuk_dogrulama_durumu = 'LEGAL_REVIEW' where id = $1`, [pkgId]);
    await db.sql(
      `update public.regulation_packages set hukuk_dogrulama_durumu = 'VERIFIED', dogrulayan = $2, dogrulama_zamani = now() where id = $1`,
      [pkgId, legalId],
    );
    const { rows: secim } = await db.asUser(
      adminId,
      `insert into public.tenant_regulation_scope (tenant_id, regulation_package_id, secen) values ($1, $2, $3) returning id`,
      [tenantId, pkgId, adminId],
    );
    expect(secim).toHaveLength(1);
  });

  it("19) paket VERIFIED doğamaz (INSERT'te)", async () => {
    await expect(
      db.sql(`insert into public.regulation_packages (kod, ad, hukuk_dogrulama_durumu) values ('TEST_BORN_VERIFIED', 'X', 'VERIFIED')`),
    ).rejects.toThrow(/kayit VERIFIED dogamaz/);
  });
});

let seedSayaci = 0;
async function seedNormalTenant() {
  seedSayaci++;
  const { rows: tenantRows } = await db.sql(`insert into public.tenants (name, segment) values ($1, 'araci_kurum') returning id`, [`Seed Tenant ${seedSayaci}`]);
  const tenantId = tenantRows[0].id as string;
  const adminId = `e0000000-0000-0000-0000-${String(seedSayaci).padStart(12, "0")}`;
  await db.sql(`insert into auth.users (id, email) values ($1, $2)`, [adminId, `admin-${seedSayaci}@demo.com`]);
  await db.sql(`insert into public.profiles (id, tenant_id, role, full_name) values ($1, $2, 'admin', 'Tenant Admin')`, [adminId, tenantId]);
  return { tenantId, adminId };
}
