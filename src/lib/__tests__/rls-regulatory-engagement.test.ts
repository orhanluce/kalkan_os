// M38+M41 (G7): regülatör yazışması — cross-tenant, yanıt dört-göz onayı +
// gönderim makbuzu, içerik donukluğu, matter-kapsamlı dış erişim (bağımsızlık
// beyanı şartı, süre/iptal, oturumsuz görünüm). PGlite.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
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

async function matterVeTalep(tenantId: string) {
  const { rows: m } = await db.sql(
    `insert into public.regulatory_matters (tenant_id, otorite, konu) values ($1, 'SPK', 'Bilgi sistemleri incelemesi') returning id`,
    [tenantId],
  );
  const { rows: r } = await db.sql(
    `insert into public.regulatory_requests (tenant_id, matter_id, talep_metni, son_tarih) values ($1, $2, 'Erişim listesi', current_date + 5) returning id`,
    [tenantId, m[0].id],
  );
  return { matterId: m[0].id as string, requestId: r[0].id as string };
}

describe("regulatory engagement — RLS + dört-göz + dış erişim (G7)", () => {
  it("cross-tenant: A'nın matter'ını B GÖREMEZ; misafir YAZAMAZ", async () => {
    const { matterId } = await matterVeTalep(seed.A.tenantId);
    const { rows: b } = await db.asUser(seed.B.userId, `select id from public.regulatory_matters where id = $1`, [matterId]);
    expect(b).toHaveLength(0);
    await expect(
      db.asUser(A_MISAFIR, `insert into public.regulatory_matters (tenant_id, otorite, konu) values ($1, 'X', 'y')`, [seed.A.tenantId]),
    ).rejects.toThrow();
  });

  it("yanıt: ONAYLANDI dört-göz; GONDERILDI makbuz ister; içerik donuk", async () => {
    const { requestId } = await matterVeTalep(seed.A.tenantId);
    const { rows: y } = await db.sql(
      `insert into public.regulatory_responses (tenant_id, request_id, surum, icerik, hazirlayan) values ($1, $2, 1, 'Yanıt v1', $3) returning id`,
      [seed.A.tenantId, requestId, seed.A.userId],
    );
    // Hazırlayan kendi yanıtını onaylayamaz.
    await expect(
      db.sql(`update public.regulatory_responses set durum = 'ONAYLANDI', onaylayan = $2, onay_zamani = now() where id = $1`, [y[0].id, seed.A.userId]),
    ).rejects.toThrow(/dort goz/);
    await db.sql(`update public.regulatory_responses set durum = 'ONAYLANDI', onaylayan = $2, onay_zamani = now() where id = $1`, [y[0].id, A_IKINCI]);
    // Onaylanmış yanıtın içeriği donuk.
    await expect(
      db.sql(`update public.regulatory_responses set icerik = 'değişti' where id = $1`, [y[0].id]),
    ).rejects.toThrow(/degistirilemez/);
    // GONDERILDI makbuzsuz reddi.
    await expect(
      db.sql(`update public.regulatory_responses set durum = 'GONDERILDI' where id = $1`, [y[0].id]),
    ).rejects.toThrow(/makbuz/);
    await db.sql(`update public.regulatory_responses set durum = 'GONDERILDI', gonderim_receipt = $2, gonderildi_at = now() where id = $1`, [y[0].id, "a".repeat(64)]);
    const { rows } = await db.sql(`select durum from public.regulatory_responses where id = $1`, [y[0].id]);
    expect(rows[0].durum).toBe("GONDERILDI");
  });

  it("DIŞ ERİŞİM: bağımsızlık beyanı OLMADAN görünüm null; beyanla görünür + audit", async () => {
    const { matterId } = await matterVeTalep(seed.A.tenantId);
    // Beyansız grant → null.
    const { rows: g1 } = await db.sql(
      `insert into public.matter_access_grants (tenant_id, matter_id, external_email, son_gecerlilik) values ($1, $2, 'denetci@x.com', now() + interval '7 days') returning token`,
      [seed.A.tenantId, matterId],
    );
    const { rows: bosGorunum } = await db.asAnon(`select public.matter_goruntule($1) as v`, [g1[0].token]);
    expect(bosGorunum[0].v).toBeNull();

    // Bağımsızlık beyanı + beyanlı grant → görünür.
    const { rows: beyan } = await db.sql(
      `insert into public.independence_declarations (tenant_id, matter_id, external_email, beyan_eden_ad, cikar_catismasi_yok) values ($1, $2, 'denetci@x.com', 'Denetçi', true) returning id`,
      [seed.A.tenantId, matterId],
    );
    const { rows: g2 } = await db.sql(
      `insert into public.matter_access_grants (tenant_id, matter_id, external_email, bagimsizlik_beyani_id, son_gecerlilik) values ($1, $2, 'denetci@x.com', $3, now() + interval '7 days') returning token`,
      [seed.A.tenantId, matterId, beyan[0].id],
    );
    const { rows: gorunum } = await db.asAnon(`select public.matter_goruntule($1) as v`, [g2[0].token]);
    const v = gorunum[0].v as Record<string, unknown>;
    expect(v.otorite).toBe("SPK");
    expect((v.talepler as unknown[]).length).toBe(1);
    const { rows: audit } = await db.sql(
      `select count(*)::int as n from public.audit_log where eylem = 'matter_dis_goruntulendi' and tenant_id = $1`,
      [seed.A.tenantId],
    );
    expect(audit[0].n).toBe(1);
  });

  it("dış erişim: dolmuş ve iptal token AYNI null (ayrım yok)", async () => {
    const { matterId } = await matterVeTalep(seed.A.tenantId);
    const { rows: beyan } = await db.sql(
      `insert into public.independence_declarations (tenant_id, matter_id, external_email, beyan_eden_ad, cikar_catismasi_yok) values ($1, $2, 'd@x.com', 'D', true) returning id`,
      [seed.A.tenantId, matterId],
    );
    const dolmus = await db.sql(
      `insert into public.matter_access_grants (tenant_id, matter_id, external_email, bagimsizlik_beyani_id, son_gecerlilik) values ($1, $2, 'd@x.com', $3, now() - interval '1 hour') returning token`,
      [seed.A.tenantId, matterId, beyan[0].id],
    );
    expect((await db.asAnon(`select public.matter_goruntule($1) as v`, [dolmus.rows[0].token])).rows[0].v).toBeNull();
    const iptal = await db.sql(
      `insert into public.matter_access_grants (tenant_id, matter_id, external_email, bagimsizlik_beyani_id, son_gecerlilik, iptal_edildi) values ($1, $2, 'd@x.com', $3, now() + interval '7 days', true) returning token`,
      [seed.A.tenantId, matterId, beyan[0].id],
    );
    expect((await db.asAnon(`select public.matter_goruntule($1) as v`, [iptal.rows[0].token])).rows[0].v).toBeNull();
  });
});
