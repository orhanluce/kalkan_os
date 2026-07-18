// PR-Q1': source_fetch_runs — global okuma, istemci yazamaz, başarılı koşu
// artifact'sız olamaz. Gerçek migration'lara karşı PGlite.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, seedTwoTenants, type TestDb } from "./helpers/pg";

let db: TestDb;
let seed: Awaited<ReturnType<typeof seedTwoTenants>>;
const H = (c: string) => c.repeat(64);

async function kaynakVeArtifact() {
  const { rows: s } = await db.sql(
    `insert into public.regulatory_sources (authority, jurisdiction, kaynak_seviyesi, ad, erisim_politikasi_durumu)
     values ('SPK', 'TR', 'A', 'SPK Mevzuat Sistemi', 'manuel') returning id`,
  );
  const { rows: a } = await db.sql(
    `insert into public.source_artifacts (source_id, baslik, sha256) values ($1, 'Tebliğ v1', $2) returning id`,
    [s[0].id, H("a")],
  );
  return { sourceId: s[0].id as string, artifactId: a[0].id as string };
}

beforeEach(async () => {
  db = await createTestDb();
  seed = await seedTwoTenants(db);
});

afterEach(async () => {
  await db.close();
});

describe("source_fetch_runs — global sicil (PR-Q1')", () => {
  it("her iki kiracının kullanıcısı da AYNI çekim kaydını okur (global)", async () => {
    const { sourceId, artifactId } = await kaynakVeArtifact();
    const { rows } = await db.sql(
      `insert into public.source_fetch_runs (source_id, durum, artifact_id) values ($1, 'BASARILI', $2) returning id`,
      [sourceId, artifactId],
    );
    for (const u of [seed.A.userId, seed.B.userId]) {
      const { rows: r } = await db.asUser(u, `select id from public.source_fetch_runs where id = $1`, [rows[0].id]);
      expect(r).toHaveLength(1);
    }
  });

  it("istemci çekim kaydı YAZAMAZ/DEĞİŞTİREMEZ (politika yok + revoke)", async () => {
    const { sourceId, artifactId } = await kaynakVeArtifact();
    await expect(
      db.asUser(
        seed.A.userId,
        `insert into public.source_fetch_runs (source_id, durum, artifact_id) values ($1, 'BASARILI', $2)`,
        [sourceId, artifactId],
      ),
    ).rejects.toThrow();
    const { rows } = await db.sql(
      `insert into public.source_fetch_runs (source_id, durum, artifact_id) values ($1, 'BASARILI', $2) returning id`,
      [sourceId, artifactId],
    );
    await expect(
      db.asUser(seed.A.userId, `update public.source_fetch_runs set durum = 'BASARISIZ' where id = $1`, [rows[0].id]),
    ).rejects.toThrow();
  });

  it("BASARILI koşu artifact'sız OLAMAZ; BASARISIZ artifact'sız olur (check)", async () => {
    const { sourceId, artifactId } = await kaynakVeArtifact();
    await expect(
      db.sql(`insert into public.source_fetch_runs (source_id, durum) values ($1, 'BASARILI')`, [sourceId]),
    ).rejects.toThrow();
    await db.sql(
      `insert into public.source_fetch_runs (source_id, durum, hata_ozeti) values ($1, 'BASARISIZ', 'timeout')`,
      [sourceId],
    );
    await db.sql(
      `insert into public.source_fetch_runs (source_id, durum, artifact_id) values ($1, 'BASARILI', $2)`,
      [sourceId, artifactId],
    );
  });
});
