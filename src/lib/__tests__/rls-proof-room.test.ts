// G1 Proof Room: token'lı oturumsuz erişim — kapsam/expiry/iptal/cross-tenant
// güvenlik testleri (nihai talimat §12: "Proof Room token scope/expiry").
// Gerçek migration'lara karşı PGlite.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, seedTwoTenants, type TestDb } from "./helpers/pg";

let db: TestDb;
let seed: Awaited<ReturnType<typeof seedTwoTenants>>;
const H = (c: string) => c.repeat(64);
const MISAFIR = "a0000000-0000-0000-0000-000000000009";

/** Kiracıda tanım + koşu; globalde kaynak zinciri + eşleme kurar. */
async function kosuVeZincir(tenantId: string) {
  const { rows: d } = await db.sql(
    `insert into public.control_test_definitions (tenant_id, control_id, tur, ad)
     values ($1, $2, 'MANUAL_PROCEDURE', 'Proof tanımı') returning id`,
    [tenantId, seed.controlId],
  );
  const { rows: r } = await db.sql(
    `insert into public.test_runs (tenant_id, test_definition_id, control_id, sonuc, gerekce, tanim_surumu)
     values ($1, $2, $3, 'PASSED', 'test', 1) returning id`,
    [tenantId, d[0].id, seed.controlId],
  );
  const { rows: s } = await db.sql(
    `insert into public.regulatory_sources (authority, jurisdiction, kaynak_seviyesi, ad, erisim_politikasi_durumu)
     values ('SPK', 'TR', 'A', 'Proof Kaynak', 'manuel') returning id`,
  );
  const { rows: a } = await db.sql(
    `insert into public.source_artifacts (source_id, baslik, sha256) values ($1, 'Artifact', $2) returning id`,
    [s[0].id, H("a")],
  );
  const { rows: p } = await db.sql(
    `insert into public.provisions (source_artifact_id, provision_ref, metin, effective_from)
     values ($1, 'md. 9', 'Hüküm metni', '2020-01-01') returning id`,
    [a[0].id],
  );
  const { rows: o } = await db.sql(
    `insert into public.obligations (provision_id, kod, baslik, amac) values ($1, 'PR-YUK-1', 'Y', 'a') returning id`,
    [p[0].id],
  );
  await db.sql(
    `insert into public.obligation_control_mappings (obligation_id, control_id) values ($1, $2)`,
    [o[0].id, seed.controlId],
  );
  return { runId: r[0].id as string };
}

async function linkOlustur(userId: string, tenantId: string, runId: string, gunSonra = 7): Promise<string> {
  const { rows } = await db.asUser(
    userId,
    `insert into public.proof_room_links (tenant_id, test_run_id, son_gecerlilik)
     values ($1, $2, now() + ($3 || ' days')::interval) returning token`,
    [tenantId, runId, String(gunSonra)],
  );
  return rows[0].token as string;
}

beforeEach(async () => {
  db = await createTestDb();
  seed = await seedTwoTenants(db);
  await db.sql(`insert into auth.users (id, email) values ($1, 'misafir@demo.com')`, [MISAFIR]);
  await db.sql(
    `insert into public.profiles (id, tenant_id, role, full_name) values ($1, $2, 'denetci_misafir', 'Misafir')`,
    [MISAFIR, seed.A.tenantId],
  );
});

afterEach(async () => {
  await db.close();
});

describe("proof_room — token'lı salt-okur erişim (G1)", () => {
  it("admin link oluşturur; B kiracısı A'nın linkini GÖREMEZ; misafir OLUŞTURAMAZ", async () => {
    const { runId } = await kosuVeZincir(seed.A.tenantId);
    await linkOlustur(seed.A.userId, seed.A.tenantId, runId);
    const { rows: baska } = await db.asUser(seed.B.userId, `select id from public.proof_room_links`);
    expect(baska).toHaveLength(0);
    await expect(
      db.asUser(
        MISAFIR,
        `insert into public.proof_room_links (tenant_id, test_run_id, son_gecerlilik) values ($1, $2, now() + interval '1 day')`,
        [seed.A.tenantId, runId],
      ),
    ).rejects.toThrow();
  });

  it("geçerli token: koşu + zincir + kurum döner ve görüntüleme AUDIT'e düşer", async () => {
    const { runId } = await kosuVeZincir(seed.A.tenantId);
    const token = await linkOlustur(seed.A.userId, seed.A.tenantId, runId);
    const { rows } = await db.asAnon(`select public.proof_room_goruntule($1) as v`, [token]);
    const v = rows[0].v as Record<string, unknown>;
    expect((v.kosu as Record<string, unknown>).id).toBe(runId);
    expect((v.kosu as Record<string, unknown>).sonuc).toBe("PASSED");
    expect((v.kaynakZinciri as unknown[]).length).toBe(1);
    const zincir = (v.kaynakZinciri as Record<string, unknown>[])[0];
    expect(zincir.artifactSha256).toBe(H("a"));
    expect(zincir.snippet).toBe("Hüküm metni");
    const { rows: audit } = await db.sql(
      `select count(*)::int as n from public.audit_log where eylem = 'proof_room_goruntulendi' and tenant_id = $1`,
      [seed.A.tenantId],
    );
    expect(audit[0].n).toBe(1);
  });

  it("geçersiz, süresi dolmuş ve iptal edilmiş token AYNI yanıtı (null) verir", async () => {
    const { runId } = await kosuVeZincir(seed.A.tenantId);
    const { rows: gecersiz } = await db.asAnon(`select public.proof_room_goruntule('yok-boyle-token') as v`);
    expect(gecersiz[0].v).toBeNull();

    const dolmus = await linkOlustur(seed.A.userId, seed.A.tenantId, runId);
    await db.sql(`update public.proof_room_links set son_gecerlilik = now() - interval '1 hour' where token = $1`, [dolmus]);
    const { rows: d } = await db.asAnon(`select public.proof_room_goruntule($1) as v`, [dolmus]);
    expect(d[0].v).toBeNull();

    const iptal = await linkOlustur(seed.A.userId, seed.A.tenantId, runId);
    await db.asUser(seed.A.userId, `update public.proof_room_links set iptal_edildi = true where token = $1`, [iptal]);
    const { rows: i } = await db.asAnon(`select public.proof_room_goruntule($1) as v`, [iptal]);
    expect(i[0].v).toBeNull();
  });

  it("cross-tenant: A'nın linki B'nin koşusuna işaret ederse null (scope koruması)", async () => {
    const { runId: bRun } = await kosuVeZincir(seed.B.tenantId);
    // A kendi kiracısında ama B'nin koşusuna link kurmayı denesin.
    const token = await linkOlustur(seed.A.userId, seed.A.tenantId, bRun);
    const { rows } = await db.asAnon(`select public.proof_room_goruntule($1) as v`, [token]);
    expect(rows[0].v).toBeNull(); // RPC, run.tenant_id = link.tenant_id ister
  });
});
