// docs/ROADMAP.md M1 kabul kriteri:
//   "RLS testi (Vitest, service-role dışı istemciyle) tenant A'nın tenant B
//    verisini OKUYAMADIĞINI kanıtlar"
// CLAUDE.md kural 1: "Her tabloda tenant_id + RLS; RLS'i test etmeden hiçbir
// tablo 'bitti' sayılmaz."
//
// Bu testler gerçek Postgres'te (PGlite) gerçek migration dosyalarına karşı
// koşar — bkz. helpers/pg.ts.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createTestDb, seedTwoTenants, type TestDb } from "./helpers/pg";

let db: TestDb;
let A: { tenantId: string; userId: string };
let B: { tenantId: string; userId: string };
let controlId: string;

beforeAll(async () => {
  db = await createTestDb();
  const seeded = await seedTwoTenants(db);
  A = seeded.A;
  B = seeded.B;
  controlId = seeded.controlId;

  // Her iki tenant da aynı kontrol için kendi kaydını oluşturur.
  await db.sql(
    `insert into public.tenant_controls (tenant_id, control_id, durum, not_metni)
     values ($1, $2, 'karsilaniyor', 'A gizli notu'), ($3, $2, 'acik', 'B gizli notu')`,
    [A.tenantId, controlId, B.tenantId],
  );
  await db.sql(
    `insert into public.evidences (tenant_id, control_id, tip, storage_path)
     values ($1, $2, 'beyan', 'A kanıtı'), ($3, $2, 'beyan', 'B kanıtı')`,
    [A.tenantId, controlId, B.tenantId],
  );
  await db.sql(
    `insert into public.findings (tenant_id, kaynak, onem, baslik)
     values ($1, 'sizma_testi', 'kritik', 'A bulgusu'), ($2, 'denetim', 'orta', 'B bulgusu')`,
    [A.tenantId, B.tenantId],
  );
  await db.sql(
    `insert into public.audit_log (tenant_id, actor_id, eylem)
     values ($1, $2, 'durum_degisti'), ($3, $4, 'durum_degisti')`,
    [A.tenantId, A.userId, B.tenantId, B.userId],
  );
  await db.sql(
    `insert into public.share_links (tenant_id, son_gecerlilik)
     values ($1, now() + interval '30 days'), ($2, now() + interval '30 days')`,
    [A.tenantId, B.tenantId],
  );
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe("M1 kabul kriteri: tenant izolasyonu (okuma)", () => {
  it("tenant_controls: A yalnızca kendi satırını görür, B'ninkini göremez", async () => {
    const { rows } = await db.asUser(A.userId, `select tenant_id, not_metni from public.tenant_controls`);

    expect(rows).toHaveLength(1);
    expect(rows[0].tenant_id).toBe(A.tenantId);
    expect(rows[0].not_metni).toBe("A gizli notu");
  });

  it("evidences: A, B'nin kanıtını göremez", async () => {
    const { rows } = await db.asUser(A.userId, `select tenant_id, storage_path from public.evidences`);

    expect(rows).toHaveLength(1);
    expect(rows[0].storage_path).toBe("A kanıtı");
  });

  it("findings: A, B'nin bulgusunu göremez", async () => {
    const { rows } = await db.asUser(A.userId, `select baslik from public.findings`);

    expect(rows).toHaveLength(1);
    expect(rows[0].baslik).toBe("A bulgusu");
  });

  it("audit_log: A, B'nin denetim kaydını göremez", async () => {
    const { rows } = await db.asUser(A.userId, `select tenant_id from public.audit_log`);

    expect(rows).toHaveLength(1);
    expect(rows[0].tenant_id).toBe(A.tenantId);
  });

  it("share_links: A, B'nin paylaşım linkini (ve token'ını) göremez", async () => {
    const { rows } = await db.asUser(A.userId, `select tenant_id from public.share_links`);

    expect(rows).toHaveLength(1);
    expect(rows[0].tenant_id).toBe(A.tenantId);
  });

  it("tenants: A yalnızca kendi kurumunu görür", async () => {
    const { rows } = await db.asUser(A.userId, `select name from public.tenants`);

    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Tenant A");
  });

  it("profiles: A, B'nin kullanıcısını göremez", async () => {
    const { rows } = await db.asUser(A.userId, `select full_name from public.profiles`);

    expect(rows).toHaveLength(1);
    expect(rows[0].full_name).toBe("A Admin");
  });

  it("simetri kontrolü: B de yalnızca kendi verisini görür (politika A'ya özel değil)", async () => {
    const { rows } = await db.asUser(B.userId, `select not_metni from public.tenant_controls`);

    expect(rows).toHaveLength(1);
    expect(rows[0].not_metni).toBe("B gizli notu");
  });

  it("oturum açmamış ziyaretçi (anon) hiçbir tenant verisini göremez", async () => {
    const tc = await db.asAnon(`select * from public.tenant_controls`);
    const ev = await db.asAnon(`select * from public.evidences`);
    const fn = await db.asAnon(`select * from public.findings`);

    expect(tc.rows).toHaveLength(0);
    expect(ev.rows).toHaveLength(0);
    expect(fn.rows).toHaveLength(0);
  });
});

describe("M1 kabul kriteri: tenant izolasyonu (yazma)", () => {
  it("A, B'nin tenant_id'siyle satır YAZAMAZ", async () => {
    await expect(
      db.asUser(
        A.userId,
        `insert into public.tenant_controls (tenant_id, control_id, durum) values ($1, $2, 'acik')`,
        [B.tenantId, controlId],
      ),
    ).rejects.toThrow();
  });

  it("A, B'nin kanıtını sahte tenant_id ile ekleyemez", async () => {
    await expect(
      db.asUser(
        A.userId,
        `insert into public.evidences (tenant_id, control_id, tip) values ($1, $2, 'beyan')`,
        [B.tenantId, controlId],
      ),
    ).rejects.toThrow();
  });

  it("A, B'nin satırını UPDATE ile ele geçiremez (görünmediği için etkilenen satır 0)", async () => {
    await db.asUser(A.userId, `update public.tenant_controls set durum = 'kapsam_disi' where tenant_id = $1`, [
      B.tenantId,
    ]);

    // Service-role ile bakınca B'nin durumu değişmemiş olmalı.
    const { rows } = await db.sql(`select durum from public.tenant_controls where tenant_id = $1`, [
      B.tenantId,
    ]);
    expect(rows[0].durum).toBe("acik");
  });

  it("A, B'nin bulgusunu silemez", async () => {
    await db.asUser(A.userId, `delete from public.findings where tenant_id = $1`, [B.tenantId]);

    const { rows } = await db.sql(`select count(*)::int as n from public.findings where tenant_id = $1`, [
      B.tenantId,
    ]);
    expect(rows[0].n).toBe(1);
  });

  it("A kendi tenant'ına yazabilir (politika fazla kısıtlayıcı değil)", async () => {
    await db.asUser(
      A.userId,
      `insert into public.findings (tenant_id, kaynak, onem, baslik) values ($1, 'ic_tespit', 'dusuk', 'A yeni bulgu')`,
      [A.tenantId],
    );

    const { rows } = await db.asUser(A.userId, `select count(*)::int as n from public.findings`);
    expect(rows[0].n).toBe(2);
  });
});
