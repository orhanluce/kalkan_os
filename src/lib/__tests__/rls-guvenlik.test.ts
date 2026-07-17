// CLAUDE.md kural 2 (evidences/audit_log append-only) ve önceki turda RLS
// gözden geçirmesinde yazılan ayrıcalık-yükseltme düzeltmelerinin gerçek
// Postgres'te çalıştığını kanıtlar. O düzeltmeler o zaman "yazıldı ama
// doğrulanmadı" diye işaretlenmişti — bu dosya o etiketi kaldırır.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestDb, seedTwoTenants, type TestDb, ZARF_DEGERLERI, ZARF_KOLONLARI } from "./helpers/pg";

let db: TestDb;
let A: { tenantId: string; userId: string };
let B: { tenantId: string; userId: string };
let controlId: string;

// Bu testler şemayı/satırları değiştirdiği için her testte taze bir veritabanı.
beforeEach(async () => {
  db = await createTestDb();
  const seeded = await seedTwoTenants(db);
  A = seeded.A;
  B = seeded.B;
  controlId = seeded.controlId;
}, 60_000);

afterEach(async () => {
  await db?.close();
});

describe("CLAUDE.md kural 2: evidences append-only", () => {
  it("kanıt eklenebilir", async () => {
    await db.asUser(
      A.userId,
      `insert into public.evidences (tenant_id, control_id, tip, ${ZARF_KOLONLARI})
     values ($1, $2, 'beyan', ${ZARF_DEGERLERI})`,
      [A.tenantId, controlId],
    );

    const { rows } = await db.asUser(A.userId, `select count(*)::int as n from public.evidences`);
    expect(rows[0].n).toBe(1);
  });

  it("kendi kanıtı bile GÜNCELLENEMEZ", async () => {
    await db.sql(
      `insert into public.evidences (tenant_id, control_id, tip, storage_path, ${ZARF_KOLONLARI})
     values ($1, $2, 'beyan', 'orijinal', ${ZARF_DEGERLERI})`,
      [A.tenantId, controlId],
    );

    await expect(
      db.asUser(A.userId, `update public.evidences set storage_path = 'degistirildi'`),
    ).rejects.toThrow();
  });

  it("kendi kanıtı bile SİLİNEMEZ", async () => {
    await db.sql(`insert into public.evidences (tenant_id, control_id, tip, ${ZARF_KOLONLARI})
     values ($1, $2, 'beyan', ${ZARF_DEGERLERI})`, [
      A.tenantId,
      controlId,
    ]);

    await expect(db.asUser(A.userId, `delete from public.evidences`)).rejects.toThrow();
  });
});

describe("CLAUDE.md kural 2: audit_log append-only", () => {
  it("denetim kaydı GÜNCELLENEMEZ (izin geçmişi çarpıtılamaz)", async () => {
    await db.sql(`insert into public.audit_log (tenant_id, actor_id, eylem) values ($1, $2, 'durum_degisti')`, [
      A.tenantId,
      A.userId,
    ]);

    await expect(
      db.asUser(A.userId, `update public.audit_log set eylem = 'sahte_eylem'`),
    ).rejects.toThrow();
  });

  it("denetim kaydı SİLİNEMEZ (izler örtülemez)", async () => {
    await db.sql(`insert into public.audit_log (tenant_id, actor_id, eylem) values ($1, $2, 'durum_degisti')`, [
      A.tenantId,
      A.userId,
    ]);

    await expect(db.asUser(A.userId, `delete from public.audit_log`)).rejects.toThrow();
  });
});

// Önceki turda bulunan ve düzeltilen açık: actor_id kontrolü yoktu, herhangi
// bir tenant üyesi başkasının adına sahte denetim kaydı yazabiliyordu.
// Denetim kayıtlarını artık YALNIZCA trigger'lar üretir
// (20260717090000_audit_triggers.sql). İstemcinin insert politikası
// kaldırıldı: eskiden actor_id = auth.uid() şartıyla yazabiliyordu, yani
// kimliği doğru ama İÇERİĞİ uydurma bir kayıt (hiç olmamış bir eylem)
// yazılabilirdi. Şimdi ne yazılacağına şema karar veriyor.
describe("audit_log: istemci yazamaz", () => {
  it("kullanıcı kendi adına bile denetim kaydı YAZAMAZ", async () => {
    await expect(
      db.asUser(
        A.userId,
        `insert into public.audit_log (tenant_id, actor_id, eylem) values ($1, $2, 'durum_degisti')`,
        [A.tenantId, A.userId],
      ),
    ).rejects.toThrow();
  });

  it("kullanıcı BAŞKASININ adına denetim kaydı YAZAMAZ", async () => {
    await expect(
      db.asUser(
        A.userId,
        `insert into public.audit_log (tenant_id, actor_id, eylem) values ($1, $2, 'durum_degisti')`,
        [A.tenantId, B.userId],
      ),
    ).rejects.toThrow();
  });

  it("kullanıcı olmamış bir eylemi uyduramaz", async () => {
    // Asıl kazanç bu: eskiden kimlik doğru olduğu sürece istemci istediği
    // eylemi loglayabilirdi — örneğin hiç yapılmamış bir onayı.
    await expect(
      db.asUser(
        A.userId,
        `insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo)
         values ($1, $2, 'paylasim_linki_olusturuldu', 'share_links')`,
        [A.tenantId, A.userId],
      ),
    ).rejects.toThrow();
  });
});

// Önceki turda bulunan en ciddi açık: profiles_insert_self, role/tenant_id'yi
// kısıtlamıyordu — herhangi bir authenticated kullanıcı role='admin' ile
// BAŞKASININ tenant'ına profil açıp o kurumu ele geçirebiliyordu.
describe("profiles: tenant ele geçirme (önceki turda düzeltildi)", () => {
  it("yeni kullanıcı, profili OLMAYAN bir tenant'a admin olarak katılabilir (bootstrap)", async () => {
    const yeniUser = "c0000000-0000-0000-0000-000000000009";
    const yeniTenant = "cccccccc-cccc-cccc-cccc-cccccccccccc";
    await db.sql(`insert into auth.users (id) values ($1)`, [yeniUser]);
    await db.sql(`insert into public.tenants (id, name, segment) values ($1, 'Yeni', 'diger')`, [
      yeniTenant,
    ]);

    await db.asUser(
      yeniUser,
      `insert into public.profiles (id, tenant_id, role) values ($1, $2, 'admin')`,
      [yeniUser, yeniTenant],
    );

    const { rows } = await db.sql(`select count(*)::int as n from public.profiles where id = $1`, [
      yeniUser,
    ]);
    expect(rows[0].n).toBe(1);
  });

  it("saldırgan, VAR OLAN bir tenant'a admin profili açıp kurumu ELE GEÇİREMEZ", async () => {
    const saldirgan = "d0000000-0000-0000-0000-000000000009";
    await db.sql(`insert into auth.users (id) values ($1)`, [saldirgan]);

    // A tenant'ının zaten bir profili var — saldırgan oraya sızmaya çalışıyor.
    await expect(
      db.asUser(
        saldirgan,
        `insert into public.profiles (id, tenant_id, role) values ($1, $2, 'admin')`,
        [saldirgan, A.tenantId],
      ),
    ).rejects.toThrow();
  });

  it("kullanıcı başkasının kimliğiyle profil oluşturamaz", async () => {
    const saldirgan = "d0000000-0000-0000-0000-00000000000a";
    const yeniTenant = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";
    await db.sql(`insert into auth.users (id) values ($1)`, [saldirgan]);
    await db.sql(`insert into public.tenants (id, name, segment) values ($1, 'Yeni2', 'diger')`, [
      yeniTenant,
    ]);

    await expect(
      db.asUser(saldirgan, `insert into public.profiles (id, tenant_id, role) values ($1, $2, 'admin')`, [
        B.userId, // kendi id'si değil
        yeniTenant,
      ]),
    ).rejects.toThrow();
  });
});

// Önceki turda bulunan açık: profiles_update_self, role/tenant_id
// değişikliğini engellemiyordu (id değişmediği için WITH CHECK hep geçiyordu).
// RLS bunu ifade edemediği için BEFORE UPDATE trigger'ı eklendi.
describe("profiles: ayrıcalık yükseltme (önceki turda düzeltildi)", () => {
  it("kullanıcı kendi adını güncelleyebilir", async () => {
    await db.asUser(A.userId, `update public.profiles set full_name = 'Yeni Ad' where id = $1`, [
      A.userId,
    ]);

    const { rows } = await db.sql(`select full_name from public.profiles where id = $1`, [A.userId]);
    expect(rows[0].full_name).toBe("Yeni Ad");
  });

  it("kullanıcı KENDİ ROLÜNÜ yükseltemez", async () => {
    // A zaten admin; uyum kullanıcısı ekleyip onunla deneyelim.
    const uyumUser = "a0000000-0000-0000-0000-000000000002";
    await db.sql(`insert into auth.users (id) values ($1)`, [uyumUser]);
    await db.sql(`insert into public.profiles (id, tenant_id, role) values ($1, $2, 'uyum')`, [
      uyumUser,
      A.tenantId,
    ]);

    await expect(
      db.asUser(uyumUser, `update public.profiles set role = 'admin' where id = $1`, [uyumUser]),
    ).rejects.toThrow(/immutable/i);
  });

  it("kullanıcı kendini BAŞKA BİR TENANT'A taşıyamaz", async () => {
    await expect(
      db.asUser(A.userId, `update public.profiles set tenant_id = $1 where id = $2`, [
        B.tenantId,
        A.userId,
      ]),
    ).rejects.toThrow(/immutable/i);
  });

  it("bypass bayrağı ile (gelecekteki admin fonksiyonu için) rol değişikliği mümkün", async () => {
    // Trigger'ın kasıtlı kaçış yolu çalışmalı, aksi halde davet akışı
    // hiç yazılamaz. Bu, service-role/SECURITY DEFINER bağlamını temsil eder.
    await db.sql(`select set_config('app.bypass_profile_guard', 'true', false)`);
    await db.sql(`update public.profiles set role = 'uyum' where id = $1`, [A.userId]);
    await db.sql(`select set_config('app.bypass_profile_guard', 'false', false)`);

    const { rows } = await db.sql(`select role from public.profiles where id = $1`, [A.userId]);
    expect(rows[0].role).toBe("uyum");
  });
});

describe("controls/frameworks: mevzuat içeriği istemciden yazılamaz", () => {
  it("authenticated kullanıcı kontrol kütüphanesini okuyabilir", async () => {
    const { rows } = await db.asUser(A.userId, `select count(*)::int as n from public.controls`);
    expect(rows[0].n).toBe(1);
  });

  it("authenticated kullanıcı YENİ kontrol ekleyemez (CLAUDE.md kural 3)", async () => {
    // Mevzuat içeriği yalnızca YAML'dan seed edilir; istemci yazamaz.
    const { frameworkId } = await seedFrameworkId();
    await expect(
      db.asUser(
        A.userId,
        `insert into public.controls (framework_id, madde_ref, baslik, periyot, kritiklik)
         values ($1, 'UYDURMA-99', 'Uydurulmuş madde', 'yillik', 5)`,
        [frameworkId],
      ),
    ).rejects.toThrow();
  });

  it("authenticated kullanıcı var olan bir kontrolün metnini değiştiremez", async () => {
    // UPDATE politikası olmadığı için RLS tüm satırları görünmez kılar:
    // sorgu hata vermez ama HİÇBİR satırı etkilemez. Önemli olan sonuç —
    // mevzuat metni değişmemiş olmalı.
    await db.asUser(A.userId, `update public.controls set baslik = 'Değiştirilmiş madde'`);

    const { rows } = await db.sql(`select baslik from public.controls`);
    expect(rows[0].baslik).toBe("Test kontrolü");
  });

  async function seedFrameworkId() {
    const { rows } = await db.sql(`select id from public.frameworks limit 1`);
    return { frameworkId: rows[0].id as string };
  }
});
