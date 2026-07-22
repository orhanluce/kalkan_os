import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, seedTwoTenants, type TestDb } from "./helpers/pg";

let db: TestDb;
let seed: Awaited<ReturnType<typeof seedTwoTenants>>;

async function sourceAndRule() {
  const { rows: sourceRows } = await db.sql(
    `insert into public.regulatory_sources (authority, jurisdiction, kaynak_seviyesi, ad, erisim_politikasi_durumu)
     values ('BDDK', 'TR', 'A', 'Banka Test Mevzuati', 'manuel') returning id`,
  );
  const sourceId = sourceRows[0].id as string;
  const { rows: ruleRows } = await db.sql(
    `insert into public.regulatory_scope_rules
       (source_id, entity_type, required_jurisdiction, module_keys, rationale)
     values ($1, 'BANKA', 'TR', '{KONTROLLER,DENETIM}', 'Test adayi') returning id`,
    [sourceId],
  );
  return { sourceId, ruleId: ruleRows[0].id as string };
}

beforeEach(async () => {
  db = await createTestDb();
  seed = await seedTwoTenants(db);
});

afterEach(async () => db?.close());

describe("kurum turu -> mevzuat kapsami", () => {
  it("taslak profil eslesmesini inceleme gerekli dogurur; modul acmaz", async () => {
    await sourceAndRule();
    await db.asUser(
      seed.A.userId,
      `insert into public.organization_profiles
         (tenant_id, organization_type, regulated_entity_types, regulated_status, jurisdictions)
       values ($1, 'REGULATED_FINANCIAL_INSTITUTION', '{BANKA}', 'REGULATED', '{TR}')`,
      [seed.A.tenantId],
    );
    const { rows } = await db.asUser(
      seed.A.userId,
      `select scope_status, module_keys from public.tenant_regulatory_scopes where superseded_at is null`,
    );
    expect(rows).toEqual([{ scope_status: "REVIEW_REQUIRED", module_keys: [] }]);
  });

  it("dort-goz dogrulanmis kural yenilemede AUTO_ACTIVE olur ve modulleri tasir", async () => {
    const { ruleId } = await sourceAndRule();
    const reviewer = seed.A.userId;
    const verifier = "a0000000-0000-0000-0000-000000000002";
    await db.sql(`insert into auth.users (id, email) values ($1, 'ikinci@test.local')`, [verifier]);
    await db.sql(
      `insert into public.profiles (id, tenant_id, role, full_name) values ($1, $2, 'admin', 'Ikinci')`,
      [verifier, seed.A.tenantId],
    );
    await db.sql(
      `update public.regulatory_scope_rules set verification_status='LEGAL_REVIEW', reviewed_by=$2, reviewed_at=now() where id=$1`,
      [ruleId, reviewer],
    );
    await db.sql(
      `update public.regulatory_scope_rules set verification_status='VERIFIED', verified_by=$2, verified_at=now() where id=$1`,
      [ruleId, verifier],
    );
    await db.asUser(
      seed.A.userId,
      `insert into public.organization_profiles
         (tenant_id, organization_type, regulated_entity_types, regulated_status, jurisdictions)
       values ($1, 'REGULATED_FINANCIAL_INSTITUTION', '{BANKA}', 'REGULATED', '{TR}')`,
      [seed.A.tenantId],
    );
    const { rows } = await db.asUser(
      seed.A.userId,
      `select scope_status, module_keys from public.tenant_regulatory_scopes where superseded_at is null`,
    );
    expect(rows).toEqual([{ scope_status: "AUTO_ACTIVE", module_keys: ["KONTROLLER", "DENETIM"] }]);
  });

  it("manuel mevzuat tenant'a ozeldir ve baska tenant okuyamaz", async () => {
    await db.asUser(
      seed.A.userId,
      `insert into public.tenant_regulatory_scopes
        (tenant_id, manual_title, origin, scope_status, added_by)
       values ($1, 'Kurum ozel mevzuati', 'MANUAL', 'MANUAL_TRACKED', $2)`,
      [seed.A.tenantId, seed.A.userId],
    );
    const { rows: own } = await db.asUser(
      seed.A.userId,
      `select manual_title from public.tenant_regulatory_scopes`,
    );
    const { rows: other } = await db.asUser(
      seed.B.userId,
      `select manual_title from public.tenant_regulatory_scopes`,
    );
    expect(own).toHaveLength(1);
    expect(other).toHaveLength(0);
  });

  it("istemci PROFILE_RULE veya baska kullanici atfi uyduramaz", async () => {
    const { sourceId, ruleId } = await sourceAndRule();
    await expect(
      db.asUser(
        seed.A.userId,
        `insert into public.tenant_regulatory_scopes
          (tenant_id, source_id, rule_id, origin, scope_status, added_by)
         values ($1, $2, $3, 'PROFILE_RULE', 'AUTO_ACTIVE', $4)`,
        [seed.A.tenantId, sourceId, ruleId, seed.A.userId],
      ),
    ).rejects.toThrow();
    await expect(
      db.asUser(
        seed.A.userId,
        `insert into public.tenant_regulatory_scopes
          (tenant_id, manual_title, origin, scope_status, added_by)
         values ($1, 'Sahte', 'MANUAL', 'MANUAL_TRACKED', $2)`,
        [seed.A.tenantId, seed.B.userId],
      ),
    ).rejects.toThrow();
  });
});
