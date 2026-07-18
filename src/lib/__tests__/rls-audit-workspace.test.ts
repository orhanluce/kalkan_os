// M17 (G8): audit workspace — cross-tenant, workpaper bağımsızlık sign-off,
// onaylanmış kağıt donukluğu, örnek boyut check, seed tekrarlanabilirlik. PGlite.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ornekIndeksleriSec } from "../denetim";
import { createTestDb, seedTwoTenants, type TestDb } from "./helpers/pg";

let db: TestDb;
let seed: Awaited<ReturnType<typeof seedTwoTenants>>;
const A_IKINCI = "a0000000-0000-0000-0000-000000000002";
const A_MISAFIR = "a0000000-0000-0000-0000-000000000009";

beforeEach(async () => {
  db = await createTestDb();
  seed = await seedTwoTenants(db);
  for (const [id, rol, ad] of [
    [A_IKINCI, "uyum", "İkinci"],
    [A_MISAFIR, "denetci_misafir", "Misafir"],
  ] as const) {
    await db.sql(`insert into auth.users (id, email) values ($1, $2)`, [id, `${ad}@demo.com`]);
    await db.sql(`insert into public.profiles (id, tenant_id, role, full_name) values ($1, $2, $3, $4)`, [id, seed.A.tenantId, rol, ad]);
  }
});

afterEach(async () => {
  await db.close();
});

async function isEkle(tenantId: string): Promise<string> {
  const { rows } = await db.sql(`insert into public.audit_engagements (tenant_id, ad, risk_seviyesi) values ($1, 'BS Denetimi', 'YUKSEK') returning id`, [tenantId]);
  return rows[0].id as string;
}

describe("audit workspace — RLS + bağımsızlık + tekrarlanabilirlik (M17)", () => {
  it("cross-tenant: A'nın denetim işini B GÖREMEZ; misafir YAZAMAZ", async () => {
    const id = await isEkle(seed.A.tenantId);
    const { rows: b } = await db.asUser(seed.B.userId, `select id from public.audit_engagements where id = $1`, [id]);
    expect(b).toHaveLength(0);
    await expect(
      db.asUser(A_MISAFIR, `insert into public.audit_engagements (tenant_id, ad) values ($1, 'X')`, [seed.A.tenantId]),
    ).rejects.toThrow();
  });

  it("workpaper BAĞIMSIZLIK: hazırlayan kendi kağıdını ONAYLAYAMAZ; içerik donuk", async () => {
    const eid = await isEkle(seed.A.tenantId);
    const { rows: w } = await db.sql(
      `insert into public.audit_workpapers (tenant_id, engagement_id, baslik, icerik, hazirlayan, hazirlama_zamani) values ($1, $2, 'WP-1', 'bulgular', $3, now()) returning id`,
      [seed.A.tenantId, eid, seed.A.userId],
    );
    await expect(
      db.sql(`update public.audit_workpapers set durum = 'ONAYLANDI', reviewer = $2, review_zamani = now() where id = $1`, [w[0].id, seed.A.userId]),
    ).rejects.toThrow(/bagimsizlik|dort goz/);
    await db.sql(`update public.audit_workpapers set durum = 'ONAYLANDI', reviewer = $2, review_zamani = now() where id = $1`, [w[0].id, A_IKINCI]);
    // Onaylanmış kağıt içeriği donuk.
    await expect(
      db.sql(`update public.audit_workpapers set icerik = 'değişti' where id = $1`, [w[0].id]),
    ).rejects.toThrow(/degistirilemez/);
    const { rows: audit } = await db.sql(`select eylem from public.audit_log where hedef_tablo = 'audit_workpapers' and hedef_id = $1`, [w[0].id]);
    expect(audit.map((r) => r.eylem)).toContain("calisma_kagidi_durum_degisti");
  });

  it("örnek boyut popülasyonu aşamaz (check); seed'li seçim TEKRARLANABİLİR", async () => {
    const eid = await isEkle(seed.A.tenantId);
    await expect(
      db.sql(`insert into public.audit_samples (tenant_id, engagement_id, populasyon_boyutu, ornek_boyutu, seed) values ($1, $2, 10, 20, 's')`, [seed.A.tenantId, eid]),
    ).rejects.toThrow();
    // Saf motorla seç, sakla, yeniden üret.
    const secim = ornekIndeksleriSec(100, 10, "audit-2026");
    await db.sql(
      `insert into public.audit_samples (tenant_id, engagement_id, populasyon_boyutu, ornek_boyutu, seed, secilen_indeksler) values ($1, $2, 100, 10, 'audit-2026', $3)`,
      [seed.A.tenantId, eid, secim],
    );
    const { rows } = await db.sql(`select seed, secilen_indeksler from public.audit_samples where engagement_id = $1`, [eid]);
    // Denetçi kayıtlı seed ile yeniden üretir → aynı seçim.
    const yeniden = ornekIndeksleriSec(100, 10, rows[0].seed as string);
    expect((rows[0].secilen_indeksler as number[]).map(Number)).toEqual(yeniden);
  });
});
