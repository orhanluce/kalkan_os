// M35 sonraki dilim: vendor-portal dış erişim (ROADMAP §1.24 sonu, §1.53
// sonrası; 20260719290000). matter_access_grants/matter_goruntule deseninin
// tedarikçi grafına uygulanması — PGlite'a karşı RPC + guard testleri.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, seedTwoTenants, type TestDb } from "./helpers/pg";

let db: TestDb;
let seed: Awaited<ReturnType<typeof seedTwoTenants>>;

async function tedarikci(tenantId: string, ad: string) {
  const { rows } = await db.sql(
    `insert into public.third_parties (tenant_id, ad, tier) values ($1, $2, 'KRITIK') returning id`,
    [tenantId, ad],
  );
  return rows[0].id as string;
}

async function grant(tenantId: string, thirdPartyId: string, sonGecerlilik: string, iptal = false) {
  const { rows } = await db.sql(
    `insert into public.third_party_access_grants (tenant_id, third_party_id, external_email, son_gecerlilik, iptal_edildi)
     values ($1, $2, 'vendor@example.com', $3, $4) returning token`,
    [tenantId, thirdPartyId, sonGecerlilik, iptal],
  );
  return rows[0].token as string;
}

async function goruntule(token: string) {
  const { rows } = await db.sql(`select public.tedarikci_goruntule($1) as sonuc`, [token]);
  return rows[0].sonuc as Record<string, unknown> | null;
}

const YARIN = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
const DUN = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

beforeEach(async () => {
  db = await createTestDb();
  seed = await seedTwoTenants(db);
});
afterEach(async () => {
  await db.close();
});

describe("tedarikci_goruntule (M35 sonraki dilim: vendor-portal dış erişim)", () => {
  it("geçerli token: tedarikçi özeti + açık bulgular döner", async () => {
    const tpId = await tedarikci(seed.A.tenantId, "Bulut Sağlayıcı A");
    const { rows: a } = await db.sql(
      `insert into public.third_party_assessments (tenant_id, third_party_id, tur, durum) values ($1, $2, 'DORA', 'DEVAM') returning id`,
      [seed.A.tenantId, tpId],
    );
    await db.sql(
      `insert into public.assessment_findings (tenant_id, assessment_id, third_party_id, baslik, ciddiyet, durum) values ($1, $2, $3, 'Şifreleme eksik', 'YUKSEK', 'ACIK')`,
      [seed.A.tenantId, a[0].id, tpId],
    );
    const token = await grant(seed.A.tenantId, tpId, YARIN);

    const sonuc = await goruntule(token);
    expect(sonuc?.ad).toBe("Bulut Sağlayıcı A");
    expect((sonuc?.acikBulgular as unknown[]).length).toBe(1);
    expect((sonuc?.acikBulgular as { baslik: string }[])[0].baslik).toBe("Şifreleme eksik");
  });

  it("KAPANDI bulgu dış görünümde YOK", async () => {
    const tpId = await tedarikci(seed.A.tenantId, "Bulut Sağlayıcı B");
    const { rows: a } = await db.sql(
      `insert into public.third_party_assessments (tenant_id, third_party_id) values ($1, $2) returning id`,
      [seed.A.tenantId, tpId],
    );
    await db.sql(
      `insert into public.assessment_findings (tenant_id, assessment_id, third_party_id, baslik, durum, kapanis_kanit, kapatan, kapanis_zamani)
       values ($1, $2, $3, 'Kapanmış bulgu', 'KAPANDI', 'kanit', $4, now())`,
      [seed.A.tenantId, a[0].id, tpId, seed.A.userId],
    );
    const token = await grant(seed.A.tenantId, tpId, YARIN);
    const sonuc = await goruntule(token);
    expect(sonuc?.acikBulgular).toEqual([]);
  });

  it("süresi dolmuş token null döner", async () => {
    const tpId = await tedarikci(seed.A.tenantId, "Bulut Sağlayıcı C");
    const token = await grant(seed.A.tenantId, tpId, DUN);
    expect(await goruntule(token)).toBeNull();
  });

  it("iptal edilmiş token null döner", async () => {
    const tpId = await tedarikci(seed.A.tenantId, "Bulut Sağlayıcı D");
    const token = await grant(seed.A.tenantId, tpId, YARIN, true);
    expect(await goruntule(token)).toBeNull();
  });

  it("var olmayan token null döner", async () => {
    expect(await goruntule("uydurma-token")).toBeNull();
  });

  it("her görüntüleme audit_log'a düşer (aktör yok)", async () => {
    const tpId = await tedarikci(seed.A.tenantId, "Bulut Sağlayıcı E");
    const token = await grant(seed.A.tenantId, tpId, YARIN);
    await goruntule(token);
    const { rows } = await db.sql(
      `select actor_id from public.audit_log where eylem = 'tedarikci_dis_goruntulendi' and tenant_id = $1`,
      [seed.A.tenantId],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].actor_id).toBeNull();
  });

  it("cross-tenant: B'nin tedarikçisi A'nın grant'ıyla erişilemez (grant tenant'a kilitli)", async () => {
    const tpB = await tedarikci(seed.B.tenantId, "B Tedarikçisi");
    // A kiracısı adına, B'nin tedarikçisine grant yazılmaya çalışılırsa FK
    // third_party_id B'ye ait ama tenant_id A — RPC ikisini birlikte arar,
    // eşleşmez → null.
    const { rows } = await db.sql(
      `insert into public.third_party_access_grants (tenant_id, third_party_id, external_email, son_gecerlilik)
       values ($1, $2, 'vendor@example.com', $3) returning token`,
      [seed.A.tenantId, tpB, YARIN],
    );
    expect(await goruntule(rows[0].token as string)).toBeNull();
  });
});

describe("third_party_access_grants RLS", () => {
  it("yalnız aynı tenant görebilir", async () => {
    const tpId = await tedarikci(seed.A.tenantId, "Görünürlük Testi");
    await grant(seed.A.tenantId, tpId, YARIN);
    const { rows: a } = await db.asUser(seed.A.userId, `select id from public.third_party_access_grants`);
    expect(a).toHaveLength(1);
    const { rows: b } = await db.asUser(seed.B.userId, `select id from public.third_party_access_grants`);
    expect(b).toHaveLength(0);
  });
});
