// 37 Tez Dikey B, Faz 2 ilk dilim (20260720100000): DORA RoI Annex III
// "Type of ICT services" kapalı kümesi (S01-S19) — global referans, dört-göz
// guard'ı obligations'ın GÜNCEL (iki-kişili) sürümünün BİREBİR aynısı,
// INSERT-anı bypass'ı BAŞTAN kapatılmış (20260720110000'in dersi).
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, seedTwoTenants, type TestDb } from "./helpers/pg";

let db: TestDb;
let seed: Awaited<ReturnType<typeof seedTwoTenants>>;

async function hizmetTuruEkle(extra: Record<string, unknown> = {}): Promise<string> {
  const { rows } = await db.sql(
    `insert into public.ict_service_types (kod, ad, aciklama, kaynak_turu, dogrulama_durumu)
     values ($1, $2, $3, coalesce($4, 'IKINCIL'), coalesce($5, 'TODO_DOGRULA')) returning id`,
    [
      extra.kod ?? "S01",
      extra.ad ?? "ICT project management",
      extra.aciklama ?? "Provision of services related to Project Management Officer (PMO).",
      extra.kaynak_turu ?? null,
      extra.dogrulama_durumu ?? null,
    ],
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

describe("ict_service_types — format + global RLS", () => {
  it("geçerli kod (S01-S99) kabul edilir", async () => {
    const id = await hizmetTuruEkle();
    const { rows } = await db.sql(`select kod from public.ict_service_types where id = $1`, [id]);
    expect(rows[0].kod).toBe("S01");
  });

  it("S öneki olmayan kod reddedilir (format guard)", async () => {
    await expect(hizmetTuruEkle({ kod: "X01" })).rejects.toThrow();
  });

  it("iki haneden farklı sayı reddedilir", async () => {
    await expect(hizmetTuruEkle({ kod: "S1" })).rejects.toThrow();
  });

  it("aynı kod ikinci kez eklenemez (unique)", async () => {
    await hizmetTuruEkle();
    await expect(hizmetTuruEkle()).rejects.toThrow();
  });

  it("her iki kiracının kullanıcısı da AYNI kaydı okur (global, tenant_id yok)", async () => {
    const id = await hizmetTuruEkle();
    const { rows: a } = await db.asUser(seed.A.userId, `select id from public.ict_service_types where id = $1`, [id]);
    const { rows: b } = await db.asUser(seed.B.userId, `select id from public.ict_service_types where id = $1`, [id]);
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
  });

  it("admin/uyum DIŞI rol (denetci_misafir) yazamaz — RLS write policy'si role'e bağlı", async () => {
    const misafirId = "a0000000-0000-0000-0000-00000000009d";
    await db.sql(`insert into auth.users (id, email) values ($1, 'misafir@demo.com')`, [misafirId]);
    await db.sql(`insert into public.profiles (id, tenant_id, role, full_name) values ($1, $2, 'denetci_misafir', 'Misafir')`, [misafirId, seed.A.tenantId]);
    await expect(
      db.asUser(misafirId, `insert into public.ict_service_types (kod, ad) values ('S99', 'Test')`),
    ).rejects.toThrow();
  });

  it("admin/uyum rolü YAZABİLİR (curation akışı için — roi_kaynak_kayitlari'ndan FARKLI, bilinçli tasarım)", async () => {
    const { rows } = await db.asUser(seed.A.userId, `insert into public.ict_service_types (kod, ad) values ('S98', 'Test') returning id`);
    expect(rows).toHaveLength(1);
  });
});

describe("ict_service_types — dört-göz guard'ı (obligations güncel deseninin aynısı)", () => {
  it("VERIFIED doğrudan doğamaz", async () => {
    await expect(hizmetTuruEkle({ dogrulama_durumu: "VERIFIED" })).rejects.toThrow(/dogamaz/i);
  });

  it("REJECTED doğrudan doğamaz", async () => {
    await expect(hizmetTuruEkle({ dogrulama_durumu: "REJECTED" })).rejects.toThrow(/dogamaz/i);
  });

  it("INSERT-anında LEGAL_REVIEW için incelemeye_alan/zaman zorunlu (INSERT-bypass BAŞTAN kapalı)", async () => {
    await expect(hizmetTuruEkle({ dogrulama_durumu: "LEGAL_REVIEW" })).rejects.toThrow(/incelemeye_alan/i);
  });

  it("LEGAL_REVIEW geçişi (UPDATE) inceleme atfı olmadan reddedilir", async () => {
    const id = await hizmetTuruEkle();
    await expect(
      db.sql(`update public.ict_service_types set dogrulama_durumu = 'LEGAL_REVIEW' where id = $1`, [id]),
    ).rejects.toThrow(/incelemeye_alan/i);
  });

  it("DÖRT GÖZ: incelemeye alan kendi sunumunu DOĞRULAYAMAZ", async () => {
    const id = await hizmetTuruEkle();
    await db.sql(
      `update public.ict_service_types set dogrulama_durumu = 'LEGAL_REVIEW', incelemeye_alan = $2, incelemeye_alinma_zamani = now() where id = $1`,
      [id, seed.A.userId],
    );
    await expect(
      db.sql(
        `update public.ict_service_types set dogrulama_durumu = 'VERIFIED', dogrulayan = $2, dogrulama_zamani = now() where id = $1`,
        [id, seed.A.userId],
      ),
    ).rejects.toThrow(/dort goz/i);
  });

  it("LEGAL_REVIEW → VERIFIED, FARKLI dogrulayan + zaman ile GEÇER", async () => {
    const id = await hizmetTuruEkle();
    await db.sql(
      `update public.ict_service_types set dogrulama_durumu = 'LEGAL_REVIEW', incelemeye_alan = $2, incelemeye_alinma_zamani = now() where id = $1`,
      [id, seed.B.userId],
    );
    await db.sql(
      `update public.ict_service_types set dogrulama_durumu = 'VERIFIED', dogrulayan = $2, dogrulama_zamani = now() where id = $1`,
      [id, seed.A.userId],
    );
    const { rows } = await db.sql(`select dogrulama_durumu, dogrulayan, incelemeye_alan from public.ict_service_types where id = $1`, [id]);
    expect(rows[0].dogrulama_durumu).toBe("VERIFIED");
    expect(rows[0].dogrulayan).toBe(seed.A.userId);
    expect(rows[0].incelemeye_alan).toBe(seed.B.userId);
  });

  it("VERIFIED kaydın içeriği (ad) değiştirilemez", async () => {
    const id = await hizmetTuruEkle();
    await db.sql(
      `update public.ict_service_types set dogrulama_durumu = 'LEGAL_REVIEW', incelemeye_alan = $2, incelemeye_alinma_zamani = now() where id = $1`,
      [id, seed.B.userId],
    );
    await db.sql(
      `update public.ict_service_types set dogrulama_durumu = 'VERIFIED', dogrulayan = $2, dogrulama_zamani = now() where id = $1`,
      [id, seed.A.userId],
    );
    await expect(
      db.sql(`update public.ict_service_types set ad = 'Değiştirilmiş' where id = $1`, [id]),
    ).rejects.toThrow(/degistirilemez/i);
  });
});
