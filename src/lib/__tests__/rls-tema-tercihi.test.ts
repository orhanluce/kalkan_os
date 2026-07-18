// ADR-T2: profiles.tema_tercihi — kendi tercihini günceller, başkasınınkini
// güncelleyemez; geçersiz değer check ile reddedilir (kural 1: yeni kolon da
// RLS testiyle gelir).
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

describe("profiles.tema_tercihi", () => {
  it("varsayılan 'system' doğar", async () => {
    const { rows } = await db.sql(`select tema_tercihi from public.profiles where id = $1`, [seed.A.userId]);
    expect(rows[0].tema_tercihi).toBe("system");
  });

  it("kullanıcı KENDİ tema tercihini güncelleyebilir", async () => {
    await db.asUser(seed.A.userId, `update public.profiles set tema_tercihi = 'dark' where id = $1`, [
      seed.A.userId,
    ]);
    const { rows } = await db.sql(`select tema_tercihi from public.profiles where id = $1`, [seed.A.userId]);
    expect(rows[0].tema_tercihi).toBe("dark");
  });

  it("kullanıcı BAŞKASININ tema tercihini güncelleyemez (profiles_update_self)", async () => {
    // RLS'te UPDATE hedefi görünmez → 0 satır etkilenir, hata fırlamaz.
    await db.asUser(seed.A.userId, `update public.profiles set tema_tercihi = 'dark' where id = $1`, [
      seed.B.userId,
    ]);
    const { rows } = await db.sql(`select tema_tercihi from public.profiles where id = $1`, [seed.B.userId]);
    expect(rows[0].tema_tercihi).toBe("system");
  });

  it("geçersiz değer check ile reddedilir", async () => {
    await expect(
      db.asUser(seed.A.userId, `update public.profiles set tema_tercihi = 'neon' where id = $1`, [
        seed.A.userId,
      ]),
    ).rejects.toThrow();
  });

  it("tema güncellemesi role/tenant_id dokunmadan geçer (privilege trigger engel olmaz)", async () => {
    // prevent_profile_privilege_change yalnız role/tenant_id değişimini
    // engeller — tema güncellemesi bu guard'a takılmamalı.
    await db.asUser(seed.A.userId, `update public.profiles set tema_tercihi = 'light' where id = $1`, [
      seed.A.userId,
    ]);
    const { rows } = await db.sql(`select tema_tercihi, role from public.profiles where id = $1`, [
      seed.A.userId,
    ]);
    expect(rows[0].tema_tercihi).toBe("light");
    expect(rows[0].role).toBe("admin");
  });
});
