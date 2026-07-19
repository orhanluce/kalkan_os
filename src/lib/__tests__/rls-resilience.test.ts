// Nihai talimat v3.3 §8.0 Dikey 5 (M21/M42): dayanıklılık taksonomisi
// (control_resilience_domains, global katalog + kural 3 dört-göz disiplini —
// obligations deseninin aynısı) + etki grafiği kenarı (critical_service_controls,
// tenant'a özgü, M13 grafının genişlemesi).
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, seedTwoTenants, type TestDb } from "./helpers/pg";

let db: TestDb;
let seed: Awaited<ReturnType<typeof seedTwoTenants>>;

async function hizmetEkle(tenantId: string, ad = "Müşteri ödemesi"): Promise<string> {
  const { rows } = await db.sql(`insert into public.critical_business_services (tenant_id, ad) values ($1, $2) returning id`, [tenantId, ad]);
  return rows[0].id as string;
}

async function siniflandirmaEkle(extra: Record<string, unknown> = {}): Promise<string> {
  const { rows } = await db.sql(
    `insert into public.control_resilience_domains (control_id, kategori, dogrulama_durumu)
     values ($1, $2, coalesce($3, 'TODO_DOGRULA')) returning id`,
    [extra.control_id ?? seed.controlId, extra.kategori ?? "IZLEME_TESPIT", extra.dogrulama_durumu ?? null],
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

describe("control_resilience_domains — global katalog + dört-göz (Dikey 5, M21/M42)", () => {
  it("her iki kiracının kullanıcısı da AYNI sınıflandırmayı okur (global)", async () => {
    const id = await siniflandirmaEkle();
    for (const u of [seed.A.userId, seed.B.userId]) {
      const { rows } = await db.asUser(u, `select id from public.control_resilience_domains where id = $1`, [id]);
      expect(rows).toHaveLength(1);
    }
  });

  it("istemci global sınıflandırma YAZAMAZ (politika yok — seed/service)", async () => {
    await expect(
      db.asUser(seed.A.userId, `insert into public.control_resilience_domains (control_id, kategori) values ($1, 'YONETISIM')`, [seed.controlId]),
    ).rejects.toThrow();
  });

  it("kural 3: kayıt VERIFIED DOĞAMAZ", async () => {
    await expect(siniflandirmaEkle({ dogrulama_durumu: "VERIFIED" })).rejects.toThrow(/VERIFIED dogamaz/);
  });

  it("yalnız 8 üst alandan biri kabul edilir (29 alt kategori doğrudan bağlanmaz)", async () => {
    await expect(siniflandirmaEkle({ kategori: "TEZ-ALT-KATEGORI-17" })).rejects.toThrow();
  });

  it("LEGAL_REVIEW geçişi inceleme atfı olmadan REDDEDİLİR (dört-göz halka 1)", async () => {
    const id = await siniflandirmaEkle();
    await expect(
      db.sql(`update public.control_resilience_domains set dogrulama_durumu = 'LEGAL_REVIEW' where id = $1`, [id]),
    ).rejects.toThrow(/incelemeye_alan/);
  });

  it("DÖRT GÖZ: incelemeye alan kendi sunumunu DOĞRULAYAMAZ", async () => {
    const id = await siniflandirmaEkle();
    await db.sql(
      `update public.control_resilience_domains set dogrulama_durumu = 'LEGAL_REVIEW', incelemeye_alan = $2, incelemeye_alinma_zamani = now() where id = $1`,
      [id, seed.A.userId],
    );
    await expect(
      db.sql(
        `update public.control_resilience_domains set dogrulama_durumu = 'VERIFIED', dogrulayan = $2, dogrulama_zamani = now() where id = $1`,
        [id, seed.A.userId],
      ),
    ).rejects.toThrow(/dort goz/);
  });

  it("LEGAL_REVIEW → VERIFIED, FARKLI dogrulayan + zaman ile GEÇER", async () => {
    const id = await siniflandirmaEkle();
    await db.sql(
      `update public.control_resilience_domains set dogrulama_durumu = 'LEGAL_REVIEW', incelemeye_alan = $2, incelemeye_alinma_zamani = now() where id = $1`,
      [id, seed.B.userId],
    );
    await db.sql(
      `update public.control_resilience_domains set dogrulama_durumu = 'VERIFIED', dogrulayan = $2, dogrulama_zamani = now() where id = $1`,
      [id, seed.A.userId],
    );
    const { rows } = await db.sql(`select dogrulama_durumu from public.control_resilience_domains where id = $1`, [id]);
    expect(rows[0].dogrulama_durumu).toBe("VERIFIED");
  });

  it("VERIFIED sınıflandırmanın kategorisi DONUK; doğrulama geri alınınca düzenlenebilir", async () => {
    const id = await siniflandirmaEkle();
    await db.sql(
      `update public.control_resilience_domains set dogrulama_durumu = 'LEGAL_REVIEW', incelemeye_alan = $2, incelemeye_alinma_zamani = now() where id = $1`,
      [id, seed.B.userId],
    );
    await db.sql(
      `update public.control_resilience_domains set dogrulama_durumu = 'VERIFIED', dogrulayan = $2, dogrulama_zamani = now() where id = $1`,
      [id, seed.A.userId],
    );
    await expect(
      db.sql(`update public.control_resilience_domains set kategori = 'KURTARMA' where id = $1`, [id]),
    ).rejects.toThrow(/degistirilemez/);
    await db.sql(`update public.control_resilience_domains set dogrulama_durumu = 'TODO_DOGRULA', kategori = 'KURTARMA' where id = $1`, [id]);
    const { rows } = await db.sql(`select kategori from public.control_resilience_domains where id = $1`, [id]);
    expect(rows[0].kategori).toBe("KURTARMA");
  });

  it("aynı kontrol→kategori çifti İKİNCİ kez eklenemez (unique)", async () => {
    await siniflandirmaEkle({ kategori: "MUDAHALE" });
    await expect(siniflandirmaEkle({ kategori: "MUDAHALE" })).rejects.toThrow();
  });
});

describe("critical_service_controls — M13 grafının genişlemesi, tenant'a özgü kenar (Dikey 5)", () => {
  it("cross-tenant: A'nın kenarını B GÖREMEZ", async () => {
    const sid = await hizmetEkle(seed.A.tenantId);
    const { rows } = await db.sql(
      `insert into public.critical_service_controls (tenant_id, critical_service_id, control_id) values ($1, $2, $3) returning id`,
      [seed.A.tenantId, sid, seed.controlId],
    );
    const { rows: b } = await db.asUser(seed.B.userId, `select id from public.critical_service_controls where id = $1`, [rows[0].id]);
    expect(b).toHaveLength(0);
    const { rows: a } = await db.asUser(seed.A.userId, `select id from public.critical_service_controls where id = $1`, [rows[0].id]);
    expect(a).toHaveLength(1);
  });

  it("aynı hizmet→kontrol çifti İKİNCİ kez bağlanamaz (unique)", async () => {
    const sid = await hizmetEkle(seed.A.tenantId);
    await db.sql(
      `insert into public.critical_service_controls (tenant_id, critical_service_id, control_id) values ($1, $2, $3)`,
      [seed.A.tenantId, sid, seed.controlId],
    );
    await expect(
      db.sql(`insert into public.critical_service_controls (tenant_id, critical_service_id, control_id) values ($1, $2, $3)`, [
        seed.A.tenantId,
        sid,
        seed.controlId,
      ]),
    ).rejects.toThrow();
  });

  it("misafir (denetci_misafir) YAZAMAZ", async () => {
    const misafirId = "a0000000-0000-0000-0000-000000000009";
    await db.sql(`insert into auth.users (id, email) values ($1, 'misafir@demo.com')`, [misafirId]);
    await db.sql(`insert into public.profiles (id, tenant_id, role, full_name) values ($1, $2, 'denetci_misafir', 'Misafir')`, [misafirId, seed.A.tenantId]);
    const sid = await hizmetEkle(seed.A.tenantId);
    await expect(
      db.asUser(misafirId, `insert into public.critical_service_controls (tenant_id, critical_service_id, control_id) values ($1, $2, $3)`, [
        seed.A.tenantId,
        sid,
        seed.controlId,
      ]),
    ).rejects.toThrow();
  });
});
