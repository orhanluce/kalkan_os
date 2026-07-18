// V2 PR-4a (M19, ADR-T3): kaynak sicili — global referans (tenant'sız),
// authenticated okur, istemci yazamaz; artifact hash + sürüm zinciri.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, seedTwoTenants, type TestDb } from "./helpers/pg";

let db: TestDb;
let seed: Awaited<ReturnType<typeof seedTwoTenants>>;
const H = (c: string) => c.repeat(64);

async function kaynakEkle(): Promise<string> {
  const { rows } = await db.sql(
    `insert into public.regulatory_sources (authority, jurisdiction, kaynak_seviyesi, ad, erisim_politikasi_durumu)
     values ('SPK', 'TR', 'A', 'SPK Mevzuat Sistemi', 'manuel') returning id`,
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

describe("regulatory_sources / source_artifacts — global referans", () => {
  it("her iki kiracının kullanıcısı da AYNI kaynağı okur (tenant'sız global)", async () => {
    const sid = await kaynakEkle();
    const { rows: a } = await db.asUser(seed.A.userId, `select id from public.regulatory_sources where id = $1`, [sid]);
    const { rows: b } = await db.asUser(seed.B.userId, `select id from public.regulatory_sources where id = $1`, [sid]);
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1); // global — B de görür (ortak hukuk verisi)
  });

  it("istemci global kaynak YAZAMAZ (politika yok — seed/service)", async () => {
    await expect(
      db.asUser(
        seed.A.userId,
        `insert into public.regulatory_sources (authority, jurisdiction, kaynak_seviyesi, ad) values ('X', 'TR', 'A', 'X')`,
      ),
    ).rejects.toThrow();
  });

  it("artifact hash + dogrulama_durumu TODO_DOGRULA doğar (kural 3); geçersiz seviye reddedilir", async () => {
    const sid = await kaynakEkle();
    await db.sql(
      `insert into public.source_artifacts (source_id, baslik, sha256) values ($1, 'Tebliğ v1', $2)`,
      [sid, H("a")],
    );
    const { rows } = await db.sql(`select dogrulama_durumu from public.source_artifacts where source_id = $1`, [sid]);
    expect(rows[0].dogrulama_durumu).toBe("TODO_DOGRULA");

    await expect(
      db.sql(`insert into public.regulatory_sources (authority, jurisdiction, kaynak_seviyesi, ad) values ('X','TR','Z','X')`),
    ).rejects.toThrow();
  });

  it("aynı kaynakta aynı sha256 iki artifact üretemez (unique)", async () => {
    const sid = await kaynakEkle();
    await db.sql(`insert into public.source_artifacts (source_id, baslik, sha256) values ($1, 'A', $2)`, [sid, H("b")]);
    await expect(
      db.sql(`insert into public.source_artifacts (source_id, baslik, sha256) values ($1, 'B', $2)`, [sid, H("b")]),
    ).rejects.toThrow();
  });
});
