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
});

afterEach(async () => {
  await db.close();
});

/** Tenant A adına, gerçek istemci yolundan (RLS uygulanarak) audit kaydı yazar. */
async function yaz(eylem: string, detay: Record<string, unknown> | null = null) {
  await db.asUser(
    seed.A.userId,
    `insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
     values ($1, $2, $3, 'tenant_controls', $4, $5)`,
    [seed.A.tenantId, seed.A.userId, eylem, seed.controlId, detay ? JSON.stringify(detay) : null],
  );
}

async function zinciriDogrula(tenantId: string) {
  const { rows } = await db.sql(`select * from public.verify_audit_chain($1)`, [tenantId]);
  return rows;
}

describe("audit_log hash zinciri", () => {
  it("sağlam zincir doğrulamayı geçer", async () => {
    await yaz("durum_degisti", { durum: "karsilaniyor" });
    await yaz("not_guncellendi");
    await yaz("sorumlu_atandi", { yeni: seed.A.userId });

    expect(await zinciriDogrula(seed.A.tenantId)).toEqual([]);
  });

  it("her kayıt bir öncekinin hash'ini taşır; ilk kaydın öncülü yoktur", async () => {
    await yaz("durum_degisti");
    await yaz("not_guncellendi");

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
    await yaz("durum_degisti", { durum: "karsilaniyor" });
    await yaz("not_guncellendi");
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
    await yaz("durum_degisti");
    await yaz("not_guncellendi");
    await yaz("sorumlu_atandi");

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

  it("istemci event_hash'i uyduramaz — trigger üzerine yazar", async () => {
    await db.asUser(
      seed.A.userId,
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
    await yaz("durum_degisti");
    await db.asUser(
      seed.B.userId,
      `insert into public.audit_log (tenant_id, actor_id, eylem) values ($1, $2, 'durum_degisti')`,
      [seed.B.tenantId, seed.B.userId],
    );
    await yaz("not_guncellendi");

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
    await yaz("durum_degisti", { durum: "karsilaniyor" });
    await yaz("not_guncellendi");
    await yaz("sorumlu_atandi");

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
