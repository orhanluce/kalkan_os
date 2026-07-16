// docs/ROADMAP.md M5.5 kabul kriteri: "kasıtlı bozulan audit_log zinciri
// testle tespit edilir".
//
// Bu testler zincirin AMACINI sınar: append-only kuralı uygulama rolünün
// silip değiştirmesini engeller; zincir ise veritabanına doğrudan erişebilen
// birinin (burada superuser ile taklit ediliyor) yaptığı değişikliğin
// TESPİT EDİLEBİLİR olduğunu gösterir. Bu yüzden kurcalama adımları
// bilinçli olarak db.sql() ile — yani RLS'i bypass ederek — yapılır.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, seedTwoTenants, type TestDb } from "./helpers/pg";

let db: TestDb;
let seed: Awaited<ReturnType<typeof seedTwoTenants>>;

beforeEach(async () => {
  db = await createTestDb();
  seed = await seedTwoTenants(db);

  // Her iki kiracıya da kontrolü ata: audit kayıtları artık gerçek
  // eylemlerden (tenant_controls güncellemesi) trigger yoluyla doğuyor.
  for (const t of [seed.A, seed.B]) {
    await db.sql(
      `insert into public.tenant_controls (tenant_id, control_id, durum) values ($1, $2, 'acik')`,
      [t.tenantId, seed.controlId],
    );
  }
});

afterEach(async () => {
  await db.close();
});

/**
 * Gerçek bir eylem yapar; audit kaydını TRIGGER yazar.
 *
 * İstemci audit_log'a doğrudan yazamadığı için (20260717090000) testler de
 * yazmaz — bu iyi: artık sınadığımız şey "bir kayıt uydurabilir miyiz"
 * değil, "gerçek bir eylem doğru izi bırakıyor mu".
 */
async function durumDegistir(durum: string, userId = seed.A.userId, tenantId = seed.A.tenantId) {
  await db.asUser(userId, `update public.tenant_controls set durum = $1 where tenant_id = $2`, [
    durum,
    tenantId,
  ]);
}

async function notGuncelle(not: string) {
  await db.asUser(seed.A.userId, `update public.tenant_controls set not_metni = $1 where tenant_id = $2`, [
    not,
    seed.A.tenantId,
  ]);
}

async function sorumluAta(userId: string | null) {
  await db.asUser(
    seed.A.userId,
    `update public.tenant_controls set sorumlu_user_id = $1 where tenant_id = $2`,
    [userId, seed.A.tenantId],
  );
}

async function zinciriDogrula(tenantId: string) {
  const { rows } = await db.sql(`select * from public.verify_audit_chain($1)`, [tenantId]);
  return rows;
}

describe("audit_log hash zinciri", () => {
  it("gerçek eylemler trigger yoluyla iz bırakır ve zincir sağlamdır", async () => {
    await durumDegistir("karsilaniyor");
    await notGuncelle("bir not");
    await sorumluAta(seed.A.userId);

    const { rows } = await db.sql(
      `select eylem from public.audit_log where tenant_id = $1 order by seq asc`,
      [seed.A.tenantId],
    );
    expect(rows.map((r) => r.eylem)).toEqual([
      "durum_degisti",
      "not_guncellendi",
      "sorumlu_atandi",
    ]);
    expect(await zinciriDogrula(seed.A.tenantId)).toEqual([]);
  });

  it("not içeriği denetim kaydına YAZILMAZ (kural 7)", async () => {
    await notGuncelle("gizli musteri bilgisi iceren not");

    const { rows } = await db.sql(
      `select detay from public.audit_log where tenant_id = $1 and eylem = 'not_guncellendi'`,
      [seed.A.tenantId],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].detay).toBeNull();
  });

  it("değişmeyen bir güncelleme iz bırakmaz", async () => {
    await durumDegistir("acik"); // zaten 'acik'

    const { rows } = await db.sql(`select count(*)::int as n from public.audit_log where tenant_id = $1`, [
      seed.A.tenantId,
    ]);
    expect(rows[0].n).toBe(0);
  });

  it("her kayıt bir öncekinin hash'ini taşır; ilk kaydın öncülü yoktur", async () => {
    await durumDegistir("karsilaniyor");
    await notGuncelle("not");

    const { rows } = await db.sql(
      `select seq, previous_event_hash, event_hash from public.audit_log
       where tenant_id = $1 order by seq asc`,
      [seed.A.tenantId],
    );

    expect(rows).toHaveLength(2);
    expect(rows[0].previous_event_hash).toBeNull();
    expect(rows[0].event_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(rows[1].previous_event_hash).toBe(rows[0].event_hash);
  });

  it("kurcalanan bir kayıt tespit edilir", async () => {
    await durumDegistir("karsilaniyor");
    await notGuncelle("not");
    expect(await zinciriDogrula(seed.A.tenantId)).toEqual([]);

    // Uygulama rolü bunu YAPAMAZ (revoke + politika yok) — burada
    // veritabanına doğrudan erişebilen bir saldırganı taklit ediyoruz.
    await db.sql(
      `update public.audit_log set detay = '{"durum":"kapsam_disi"}'::jsonb
       where tenant_id = $1 and seq = 1`,
      [seed.A.tenantId],
    );

    const bozuk = await zinciriDogrula(seed.A.tenantId);
    expect(bozuk.length).toBeGreaterThan(0);
    expect(Number(bozuk[0].bozuk_seq)).toBe(1);
    expect(String(bozuk[0].sebep)).toContain("event_hash");
  });

  it("silinen bir kayıt tespit edilir", async () => {
    await durumDegistir("karsilaniyor");
    await notGuncelle("not");
    await sorumluAta(seed.A.userId);

    // Ortadaki kaydı sil: ardılının previous_event_hash'i artık öncülünün
    // hash'iyle uyuşmaz.
    await db.sql(`delete from public.audit_log where tenant_id = $1 and seq = 2`, [
      seed.A.tenantId,
    ]);

    const bozuk = await zinciriDogrula(seed.A.tenantId);
    expect(bozuk.length).toBeGreaterThan(0);
    expect(Number(bozuk[0].bozuk_seq)).toBe(3);
    expect(String(bozuk[0].sebep)).toContain("previous_event_hash");
  });

  it("RLS'i bypass eden yol bile hash'i uyduramaz — trigger üzerine yazar", async () => {
    // İstemci artık audit_log'a hiç yazamıyor (bkz. rls-guvenlik.test.ts),
    // ama veritabanına doğrudan erişen biri yazabilir. Onun bile hash
    // üretmesine izin verilmez: trigger gönderilen değerleri ezer.
    await db.sql(
      `insert into public.audit_log (tenant_id, actor_id, eylem, event_hash, previous_event_hash)
       values ($1, $2, 'durum_degisti', 'sahte-hash', 'sahte-onceki')`,
      [seed.A.tenantId, seed.A.userId],
    );

    const { rows } = await db.sql(
      `select event_hash, previous_event_hash from public.audit_log where tenant_id = $1`,
      [seed.A.tenantId],
    );

    expect(rows[0].event_hash).not.toBe("sahte-hash");
    expect(rows[0].event_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(rows[0].previous_event_hash).toBeNull();
    expect(await zinciriDogrula(seed.A.tenantId)).toEqual([]);
  });

  it("tenant zincirleri birbirinden bağımsızdır", async () => {
    await durumDegistir("karsilaniyor");
    await durumDegistir("kismi", seed.B.userId, seed.B.tenantId);
    await notGuncelle("not");

    // B'nin ilk kaydı, A'nın kayıtlarından etkilenmemeli: kendi zincirinin
    // başı olmalı. Aksi halde bir tenant'ın olay sayısı diğerine sızardı.
    const { rows } = await db.sql(
      `select previous_event_hash from public.audit_log where tenant_id = $1 order by seq asc`,
      [seed.B.tenantId],
    );
    expect(rows[0].previous_event_hash).toBeNull();

    expect(await zinciriDogrula(seed.A.tenantId)).toEqual([]);
    expect(await zinciriDogrula(seed.B.tenantId)).toEqual([]);
  });

  it("kurcalanan kayıt, bir sonrakinin zincirini de bozar (tespit tek satırda gizlenemez)", async () => {
    await durumDegistir("karsilaniyor");
    await notGuncelle("not");
    await sorumluAta(seed.A.userId);

    // Saldırgan hem içeriği değiştirip hem de kendi event_hash'ini yeniden
    // hesaplayarak ilk satırı "tutarlı" hale getirse bile, ardılın
    // previous_event_hash'i eski hash'i işaret ettiği için zincir kırılır.
    const { rows: yeniHash } = await db.sql(
      `select encode(digest(public.audit_log_canonical(
         $1::uuid, $2::uuid, 'durum_degisti', 'tenant_controls', $3::uuid,
         '{"durum":"kapsam_disi"}'::jsonb,
         (select created_at from public.audit_log where tenant_id = $1 and seq = 1),
         null
       ), 'sha256'), 'hex') as h`,
      [seed.A.tenantId, seed.A.userId, seed.controlId],
    );

    await db.sql(
      `update public.audit_log
       set detay = '{"durum":"kapsam_disi"}'::jsonb, event_hash = $2
       where tenant_id = $1 and seq = 1`,
      [seed.A.tenantId, yeniHash[0].h],
    );

    const bozuk = await zinciriDogrula(seed.A.tenantId);
    expect(bozuk.length).toBeGreaterThan(0);
    expect(Number(bozuk[0].bozuk_seq)).toBe(2);
    expect(String(bozuk[0].sebep)).toContain("previous_event_hash");
  });
});
