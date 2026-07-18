// M35 (G4): third-party risk — cross-tenant, insan-karar guard (rating otomatik
// karar değildir), bilinmeyen dördüncü taraf, "tested exit" kanıt şartı,
// sözleşme süre-dolumu cron, süresiz sözleşme yasağı. Gerçek migration'lara PGlite.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, seedTwoTenants, type TestDb } from "./helpers/pg";

let db: TestDb;
let seed: Awaited<ReturnType<typeof seedTwoTenants>>;
const A_MISAFIR = "a0000000-0000-0000-0000-000000000009";

async function tedarikciEkle(tenantId: string, ad = "Vendor A"): Promise<string> {
  const { rows } = await db.sql(
    `insert into public.third_parties (tenant_id, ad, tier) values ($1, $2, 'KRITIK') returning id`,
    [tenantId, ad],
  );
  return rows[0].id as string;
}

beforeEach(async () => {
  db = await createTestDb();
  seed = await seedTwoTenants(db);
  await db.sql(`insert into auth.users (id, email) values ($1, 'misafir@demo.com')`, [A_MISAFIR]);
  await db.sql(`insert into public.profiles (id, tenant_id, role, full_name) values ($1, $2, 'denetci_misafir', 'Misafir')`, [A_MISAFIR, seed.A.tenantId]);
});

afterEach(async () => {
  await db.close();
});

describe("third-party risk — RLS + invariant'lar (M35)", () => {
  it("cross-tenant: A'nın tedarikçisini B GÖREMEZ; misafir YAZAMAZ", async () => {
    const id = await tedarikciEkle(seed.A.tenantId);
    const { rows: b } = await db.asUser(seed.B.userId, `select id from public.third_parties where id = $1`, [id]);
    expect(b).toHaveLength(0);
    await expect(
      db.asUser(A_MISAFIR, `insert into public.third_parties (tenant_id, ad) values ($1, 'X')`, [seed.A.tenantId]),
    ).rejects.toThrow();
  });

  it("İNSAN KARAR: dış rating tek başına ONAYLANDI yapamaz (karar_veren zorunlu)", async () => {
    const id = await tedarikciEkle(seed.A.tenantId);
    // Rating set etmek karar değildir; ONAYLANDI karar_veren'siz reddedilir.
    await db.sql(`update public.third_parties set dis_rating = 'A+', dis_rating_kaynagi = 'ScoreCo' where id = $1`, [id]);
    await expect(
      db.sql(`update public.third_parties set karar = 'ONAYLANDI' where id = $1`, [id]),
    ).rejects.toThrow(/insan karari ister/);
    // İnsan kararıyla geçer.
    await db.sql(`update public.third_parties set karar = 'ONAYLANDI', karar_veren = $2, karar_zamani = now() where id = $1`, [id, seed.A.userId]);
    const { rows } = await db.sql(`select karar from public.third_parties where id = $1`, [id]);
    expect(rows[0].karar).toBe("ONAYLANDI");
  });

  it("kimlik atfı: karar başkası adına verilemez", async () => {
    const id = await tedarikciEkle(seed.A.tenantId);
    await expect(
      db.asUser(seed.A.userId, `update public.third_parties set karar = 'REDDEDILDI', karar_veren = $2, karar_zamani = now() where id = $1`, [id, seed.B.userId]),
    ).rejects.toThrow(/kimlik atfi/);
  });

  it("BİLİNMEYEN dördüncü taraf: adsız kayıt yalnız bilinmiyor=true ile", async () => {
    const id = await tedarikciEkle(seed.A.tenantId);
    // Adsız + bilinmiyor=false reddi.
    await expect(
      db.sql(`insert into public.fourth_parties (tenant_id, third_party_id) values ($1, $2)`, [seed.A.tenantId, id]),
    ).rejects.toThrow();
    // bilinmiyor=true adsız geçer (düşük risk varsayılmaz — açıkça bilinmiyor).
    await db.sql(`insert into public.fourth_parties (tenant_id, third_party_id, bilinmiyor) values ($1, $2, true)`, [seed.A.tenantId, id]);
    // Bilinen (adlı) da geçer.
    await db.sql(`insert into public.fourth_parties (tenant_id, third_party_id, ad) values ($1, $2, 'AWS')`, [seed.A.tenantId, id]);
  });

  it("TESTED EXIT: kanıt+tarih olmadan test_edildi=true YASAK", async () => {
    const id = await tedarikciEkle(seed.A.tenantId);
    await expect(
      db.sql(`insert into public.exit_plans (tenant_id, third_party_id, ozet, test_edildi) values ($1, $2, 'plan', true)`, [seed.A.tenantId, id]),
    ).rejects.toThrow();
    // Kanıt + tarihle geçer.
    await db.sql(
      `insert into public.exit_plans (tenant_id, third_party_id, ozet, test_edildi, test_tarihi, test_kaniti) values ($1, $2, 'plan', true, current_date, 'tatbikat-2026')`,
      [seed.A.tenantId, id],
    );
  });

  it("süresiz sözleşme yasak (bitis <= baslangic); süre-dolumu cron AKTIF→SURESI_DOLDU", async () => {
    const id = await tedarikciEkle(seed.A.tenantId);
    await expect(
      db.sql(`insert into public.third_party_contracts (tenant_id, third_party_id, sozlesme_ref, baslangic, bitis) values ($1, $2, 'S-1', current_date, current_date)`, [seed.A.tenantId, id]),
    ).rejects.toThrow();
    // Dolmuş sözleşme.
    const { rows: c } = await db.sql(
      `insert into public.third_party_contracts (tenant_id, third_party_id, sozlesme_ref, baslangic, bitis) values ($1, $2, 'S-1', current_date - 400, current_date - 1) returning id`,
      [seed.A.tenantId, id],
    );
    await db.sql(`select public.tpr_sozlesme_dolanlari_isle()`);
    const { rows } = await db.sql(`select durum from public.third_party_contracts where id = $1`, [c[0].id]);
    expect(rows[0].durum).toBe("SURESI_DOLDU");
    // İdempotent.
    await db.sql(`select public.tpr_sozlesme_dolanlari_isle()`);
    const { rows: r2 } = await db.sql(`select durum from public.third_party_contracts where id = $1`, [c[0].id]);
    expect(r2[0].durum).toBe("SURESI_DOLDU");
  });

  it("audit: tedarikçi oluşturma + karar değişimi audit_log'a düşer", async () => {
    const id = await tedarikciEkle(seed.A.tenantId);
    await db.sql(`update public.third_parties set karar = 'ONAYLANDI', karar_veren = $2, karar_zamani = now() where id = $1`, [id, seed.A.userId]);
    const { rows } = await db.sql(`select eylem from public.audit_log where hedef_tablo = 'third_parties' and hedef_id = $1 order by created_at`, [id]);
    expect(rows.map((r) => r.eylem)).toEqual(["tedarikci_olusturuldu", "tedarikci_karar_degisti"]);
  });
});
