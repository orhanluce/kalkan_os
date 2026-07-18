// M16 #3: istisna uzatma — yeni kayıt + zincir guard'ı; geçmiş silinmez;
// bağımsız onay zinciri uzatmada da işler. Gerçek migration'lara karşı PGlite.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, seedTwoTenants, type TestDb } from "./helpers/pg";

let db: TestDb;
let seed: Awaited<ReturnType<typeof seedTwoTenants>>;
const CHECKER = "a0000000-0000-0000-0000-000000000002";

async function catismaKur(tenantId: string, kullaniciId: string, fp: string) {
  const { rows: kural } = await db.sql(
    `insert into public.sod_kurallari (tenant_id, kod, ad) values ($1, 'UZT-' || $2, 'Kural') returning id`,
    [tenantId, fp.slice(0, 8)],
  );
  const { rows } = await db.sql(
    `insert into public.sod_catismalari
       (tenant_id, rule_id, kullanici_id, sistem_kapsami, onem, fingerprint)
     values ($1, $2, $3, 'kalkan_os', 'kritik', $4) returning id`,
    [tenantId, kural[0].id, kullaniciId, fp],
  );
  return rows[0].id as string;
}

/** Onaylanmış bir istisna kurar (talep A, onay CHECKER — kimlik atfı kurallı). */
async function onayliIstisnaKur(catismaId: string, bitis: string): Promise<string> {
  const { rows } = await db.asUser(
    seed.A.userId,
    `insert into public.sod_istisnalari (conflict_id, tenant_id, gerekce, talep_eden_id, bitis)
     values ($1, $2, 'ilk gerekçe', $3, $4) returning id`,
    [catismaId, seed.A.tenantId, seed.A.userId, bitis],
  );
  const id = rows[0].id as string;
  await db.asUser(
    CHECKER,
    `update public.sod_istisnalari set durum = 'onaylandi', onaylayan_id = $2, karar_notu = 'onay' where id = $1`,
    [id, CHECKER],
  );
  return id;
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

describe("istisna uzatma — zincir + geçmiş korunur", () => {
  it("onaylı istisnadan uzatma açılır; ESKİ KAYIT DURUR (geçmiş silinmez)", async () => {
    const catismaId = await catismaKur(seed.A.tenantId, seed.A.userId, "1".repeat(64));
    const ilkId = await onayliIstisnaKur(catismaId, "2026-08-01");

    await db.asUser(
      seed.A.userId,
      `insert into public.sod_istisnalari
         (conflict_id, tenant_id, gerekce, talep_eden_id, bitis, risk_degerlendirmesi, onceki_istisna_id)
       values ($1, $2, 'uzatma gerekçesi — risk yeniden değerlendirildi', $3, '2026-10-01', 'risk düşük', $4)`,
      [catismaId, seed.A.tenantId, seed.A.userId, ilkId],
    );

    const { rows } = await db.sql(
      `select durum, onceki_istisna_id from public.sod_istisnalari where conflict_id = $1 order by created_at`,
      [catismaId],
    );
    expect(rows).toHaveLength(2); // eski + uzatma, ikisi de duruyor
    expect(rows[0].durum).toBe("onaylandi"); // ilk kayıt DEĞİŞMEDİ
    expect(rows[1].durum).toBe("talep_edildi");
    expect(rows[1].onceki_istisna_id).toBe(ilkId);
  });

  it("uzatma BAŞKA çatışmanın istisnasına bağlanamaz (zincir uydurulamaz)", async () => {
    const catisma1 = await catismaKur(seed.A.tenantId, seed.A.userId, "2".repeat(64));
    const catisma2 = await catismaKur(seed.A.tenantId, seed.A.userId, "3".repeat(64));
    const ilkId = await onayliIstisnaKur(catisma1, "2026-08-01");

    await expect(
      db.asUser(
        seed.A.userId,
        `insert into public.sod_istisnalari
           (conflict_id, tenant_id, gerekce, talep_eden_id, bitis, onceki_istisna_id)
         values ($1, $2, 'g', $3, '2026-10-01', $4)`,
        [catisma2, seed.A.tenantId, seed.A.userId, ilkId],
      ),
    ).rejects.toThrow(/ayni catismaya ait olmali/);
  });

  it("bekleyen (talep_edildi) istisna uzatılamaz", async () => {
    const catismaId = await catismaKur(seed.A.tenantId, seed.A.userId, "4".repeat(64));
    const { rows } = await db.asUser(
      seed.A.userId,
      `insert into public.sod_istisnalari (conflict_id, tenant_id, gerekce, talep_eden_id, bitis)
       values ($1, $2, 'g', $3, '2026-08-01') returning id`,
      [catismaId, seed.A.tenantId, seed.A.userId],
    );
    await expect(
      db.asUser(
        seed.A.userId,
        `insert into public.sod_istisnalari
           (conflict_id, tenant_id, gerekce, talep_eden_id, bitis, onceki_istisna_id)
         values ($1, $2, 'g2', $3, '2026-10-01', $4)`,
        [catismaId, seed.A.tenantId, seed.A.userId, rows[0].id],
      ),
    ).rejects.toThrow(/yalnizca onaylanmis\/suresi dolmus/);
  });

  it("uzatma GERİYE gidemez (yeni bitis > önceki bitis)", async () => {
    const catismaId = await catismaKur(seed.A.tenantId, seed.A.userId, "5".repeat(64));
    const ilkId = await onayliIstisnaKur(catismaId, "2026-08-01");
    await expect(
      db.asUser(
        seed.A.userId,
        `insert into public.sod_istisnalari
           (conflict_id, tenant_id, gerekce, talep_eden_id, bitis, onceki_istisna_id)
         values ($1, $2, 'g', $3, '2026-07-25', $4)`,
        [catismaId, seed.A.tenantId, seed.A.userId, ilkId],
      ),
    ).rejects.toThrow(/ileride olmali/);
  });

  it("süresi dolmuş istisnadan uzatma + bağımsız onay → REOPENED çatışma yeniden EXCEPTION_APPROVED olabilir", async () => {
    const catismaId = await catismaKur(seed.A.tenantId, seed.A.userId, "6".repeat(64));
    const ilkId = await onayliIstisnaKur(catismaId, "2026-08-01");
    // Gerçek yaşam sırası: önce çatışma (onaylı istisnaya dayanarak)
    // EXCEPTION_APPROVED olur; SONRA süre dolar (istisna 'suresi_doldu',
    // çatışma REOPENED — süre-dolumu işinin yaptığı).
    await db.sql(`update public.sod_catismalari set durum = 'EXCEPTION_APPROVED' where id = $1`, [catismaId]);
    await db.sql(`update public.sod_istisnalari set durum = 'suresi_doldu' where id = $1`, [ilkId]);
    await db.sql(`update public.sod_catismalari set durum = 'REOPENED' where id = $1`, [catismaId]);

    // Uzatma talebi (A) + bağımsız onay (CHECKER, kendi kimliğiyle).
    const { rows: uzatma } = await db.asUser(
      seed.A.userId,
      `insert into public.sod_istisnalari
         (conflict_id, tenant_id, gerekce, talep_eden_id, bitis, onceki_istisna_id)
       values ($1, $2, 'dolum sonrası uzatma', $3, '2026-12-01', $4) returning id`,
      [catismaId, seed.A.tenantId, seed.A.userId, ilkId],
    );
    await db.asUser(
      CHECKER,
      `update public.sod_istisnalari set durum = 'onaylandi', onaylayan_id = $2, karar_notu = 'uzatma onayı' where id = $1`,
      [uzatma[0].id, CHECKER],
    );
    // Çatışma guard'ı en son onaylanmış istisnayı (uzatmayı) bulur.
    await db.asUser(CHECKER, `update public.sod_catismalari set durum = 'EXCEPTION_APPROVED' where id = $1`, [
      catismaId,
    ]);
    const { rows } = await db.sql(`select durum from public.sod_catismalari where id = $1`, [catismaId]);
    expect(rows[0].durum).toBe("EXCEPTION_APPROVED");
  });

  it("talep eden uzatmayı da KENDİSİ onaylayamaz (mevcut guard'lar zincire işler)", async () => {
    const catismaId = await catismaKur(seed.A.tenantId, seed.A.userId, "7".repeat(64));
    const ilkId = await onayliIstisnaKur(catismaId, "2026-08-01");
    const { rows: uzatma } = await db.asUser(
      seed.A.userId,
      `insert into public.sod_istisnalari
         (conflict_id, tenant_id, gerekce, talep_eden_id, bitis, onceki_istisna_id)
       values ($1, $2, 'g', $3, '2026-10-01', $4) returning id`,
      [catismaId, seed.A.tenantId, seed.A.userId, ilkId],
    );
    await expect(
      db.asUser(
        seed.A.userId,
        `update public.sod_istisnalari set durum = 'onaylandi', onaylayan_id = $2 where id = $1`,
        [uzatma[0].id, seed.A.userId],
      ),
    ).rejects.toThrow(/kendi istisnasini onaylayamaz/);
  });
});
