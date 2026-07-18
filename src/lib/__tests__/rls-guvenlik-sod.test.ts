// M16 #9 güvenlik testleri (kurucu listesi): dolaylı özdeşlikle kendi
// istisnasını onaylama, kimlik atfı sahteleme, cross-tenant IDOR.
//
// Bu dosya YAZILIRKEN iki gerçek açık bulundu ve 20260718070001 ile kapatıldı:
//   (1) İstemci, istisnayı BAŞKASI adına talep edebiliyordu (talep_eden_id
//       serbestti) → sonra kendisi "farklı kişi" olarak onaylayıp maker-checker'ı
//       tersinden atlatabilirdi.
//   (2) İstemci, onay/kapanış atfını (onaylayan_id / resolved_by) başkasının
//       kimliğiyle yazabiliyordu — kendi istisnasını "B onayladı" diyerek
//       EXCEPTION_APPROVED'a taşıyabilirdi.
// Düzeltme: kimlik alanları OTURUM SAHİBİNE sabitlenir (auth.uid() null olan
// service/cron bağlamı etkilenmez — süre dolumu işi 'onaylandi' yazmaz).
//
// CSV formula injection sod-import.test.ts'te (parser katmanı) sınanıyor —
// burada tekrarlanmaz.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, seedTwoTenants, type TestDb } from "./helpers/pg";

let db: TestDb;
let seed: Awaited<ReturnType<typeof seedTwoTenants>>;
const CHECKER = "a0000000-0000-0000-0000-000000000002";

/** Kural + çatışma kurar (superuser — senaryo zemini). */
async function catismaKur(tenantId: string, kullaniciId: string) {
  const { rows: kural } = await db.sql(
    `insert into public.sod_kurallari (tenant_id, kod, ad) values ($1, 'GVN', 'Güvenlik') returning id`,
    [tenantId],
  );
  const { rows: catisma } = await db.sql(
    `insert into public.sod_catismalari
       (tenant_id, rule_id, kullanici_id, sistem_kapsami, onem, fingerprint)
     values ($1, $2, $3, 'kalkan_os', 'kritik', $4) returning id`,
    [tenantId, kural[0].id, kullaniciId, "f".repeat(64)],
  );
  return catisma[0].id as string;
}

beforeEach(async () => {
  db = await createTestDb();
  seed = await seedTwoTenants(db);
  await db.sql(`insert into auth.users (id, email) values ($1, 'checker@demo.com')`, [CHECKER]);
  await db.sql(
    `insert into public.profiles (id, tenant_id, role, full_name) values ($1, $2, 'uyum', 'A Checker')`,
    [CHECKER, seed.A.tenantId],
  );
});

afterEach(async () => {
  await db.close();
});

describe("dolaylı özdeşlik — istisna kimlik atfı sahtelenemez", () => {
  it("istisna BAŞKASI adına talep edilemez (talep_eden = oturum sahibi)", async () => {
    const catismaId = await catismaKur(seed.A.tenantId, seed.A.userId);
    // A, talebi CHECKER adına açmaya çalışıyor — sonra kendisi 'farklı kişi'
    // olarak onaylayıp maker-checker'ı tersinden atlatabilirdi.
    await expect(
      db.asUser(
        seed.A.userId,
        `insert into public.sod_istisnalari (conflict_id, tenant_id, gerekce, talep_eden_id, bitis)
         values ($1, $2, 'g', $3, current_date + 30)`,
        [catismaId, seed.A.tenantId, CHECKER],
      ),
    ).rejects.toThrow(/oturum sahibi/);
  });

  it("talep eden, onayı BAŞKASININ kimliğiyle yazamaz (onaylayan = oturum sahibi)", async () => {
    const catismaId = await catismaKur(seed.A.tenantId, seed.A.userId);
    await db.asUser(
      seed.A.userId,
      `insert into public.sod_istisnalari (conflict_id, tenant_id, gerekce, talep_eden_id, bitis)
       values ($1, $2, 'g', $3, current_date + 30)`,
      [catismaId, seed.A.tenantId, seed.A.userId],
    );
    // A kendi istisnasını "CHECKER onayladı" diye güncellemeye çalışıyor.
    await expect(
      db.asUser(
        seed.A.userId,
        `update public.sod_istisnalari set durum = 'onaylandi', onaylayan_id = $2
         where conflict_id = $1`,
        [catismaId, CHECKER],
      ),
    ).rejects.toThrow(/oturum sahibi/);
  });

  it("MEŞRU yol çalışır: farklı kullanıcı KENDİ kimliğiyle onaylar", async () => {
    const catismaId = await catismaKur(seed.A.tenantId, seed.A.userId);
    await db.asUser(
      seed.A.userId,
      `insert into public.sod_istisnalari (conflict_id, tenant_id, gerekce, talep_eden_id, bitis)
       values ($1, $2, 'g', $3, current_date + 30)`,
      [catismaId, seed.A.tenantId, seed.A.userId],
    );
    await db.asUser(
      CHECKER,
      `update public.sod_istisnalari set durum = 'onaylandi', onaylayan_id = $2
       where conflict_id = $1`,
      [catismaId, CHECKER],
    );
    const { rows } = await db.sql(`select durum, onaylayan_id from public.sod_istisnalari where conflict_id = $1`, [
      catismaId,
    ]);
    expect(rows[0].durum).toBe("onaylandi");
    expect(rows[0].onaylayan_id).toBe(CHECKER);
  });

  it("service bağlamı (auth.uid null) etkilenmez: süre dolumu 'suresi_doldu' yazabilir", async () => {
    const catismaId = await catismaKur(seed.A.tenantId, seed.A.userId);
    await db.sql(
      `insert into public.sod_istisnalari (conflict_id, tenant_id, gerekce, talep_eden_id, bitis, durum, onaylayan_id)
       values ($1, $2, 'g', $3, current_date + 30, 'onaylandi', $4)`,
      [catismaId, seed.A.tenantId, seed.A.userId, CHECKER],
    );
    await db.sql(`update public.sod_istisnalari set durum = 'suresi_doldu' where conflict_id = $1`, [catismaId]);
    const { rows } = await db.sql(`select durum from public.sod_istisnalari where conflict_id = $1`, [catismaId]);
    expect(rows[0].durum).toBe("suresi_doldu");
  });
});

describe("dolaylı özdeşlik — çatışma kapanış atfı sahtelenemez", () => {
  it("RESOLVED, resolved_by BAŞKASI gösterilerek yazılamaz", async () => {
    const catismaId = await catismaKur(seed.A.tenantId, seed.A.userId);
    // Zemin: onaylanmış istisna → EXCEPTION_APPROVED (superuser hazırlar).
    await db.sql(
      `insert into public.sod_istisnalari (conflict_id, tenant_id, gerekce, talep_eden_id, bitis, durum, onaylayan_id)
       values ($1, $2, 'g', $3, current_date + 30, 'onaylandi', $4)`,
      [catismaId, seed.A.tenantId, seed.A.userId, CHECKER],
    );
    await db.sql(`update public.sod_catismalari set durum = 'EXCEPTION_APPROVED' where id = $1`, [catismaId]);

    // A, "CHECKER bağımsız kapattı" iddiasıyla kapatmaya çalışıyor.
    await expect(
      db.asUser(
        seed.A.userId,
        `update public.sod_catismalari set durum = 'RESOLVED', resolved_by = $2, resolved_at = now()
         where id = $1`,
        [catismaId, CHECKER],
      ),
    ).rejects.toThrow(/oturum sahibi/);

    // Meşru: CHECKER kendi kimliğiyle kapatır.
    await db.asUser(
      CHECKER,
      `update public.sod_catismalari set durum = 'RESOLVED', resolved_by = $2, resolved_at = now()
       where id = $1`,
      [catismaId, CHECKER],
    );
    const { rows } = await db.sql(`select durum from public.sod_catismalari where id = $1`, [catismaId]);
    expect(rows[0].durum).toBe("RESOLVED");
  });
});

describe("cross-tenant IDOR — SoD yüzeyleri", () => {
  it("B kiracısı A'nın çatışmasını/istisnasını GÖREMEZ ve güncelleyemez (0 satır)", async () => {
    const catismaId = await catismaKur(seed.A.tenantId, seed.A.userId);
    await db.sql(
      `insert into public.sod_istisnalari (conflict_id, tenant_id, gerekce, talep_eden_id, bitis)
       values ($1, $2, 'g', $3, current_date + 30)`,
      [catismaId, seed.A.tenantId, seed.A.userId],
    );

    const { rows: gorunen } = await db.asUser(
      seed.B.userId,
      `select id from public.sod_catismalari where id = $1`,
      [catismaId],
    );
    expect(gorunen).toHaveLength(0);

    // UPDATE denemeleri RLS'te hedefi görmez → 0 satır, sessiz etkisizlik.
    await db.asUser(seed.B.userId, `update public.sod_catismalari set durum = 'UNDER_REVIEW' where id = $1`, [
      catismaId,
    ]);
    await db.asUser(seed.B.userId, `update public.sod_istisnalari set gerekce = 'x' where conflict_id = $1`, [
      catismaId,
    ]);
    const { rows: durum } = await db.sql(
      `select c.durum, i.gerekce from public.sod_catismalari c
       join public.sod_istisnalari i on i.conflict_id = c.id where c.id = $1`,
      [catismaId],
    );
    expect(durum[0].durum).toBe("OPEN");
    expect(durum[0].gerekce).toBe("g");
  });
});
