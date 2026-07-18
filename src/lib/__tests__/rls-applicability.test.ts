// V2 PR-4b adım 3 (M22): applicability_decisions — kiracı izolasyonu,
// UNKNOWN != NOT_APPLICABLE DB invariant'ı, append-only karar zinciri,
// kimlik atfı, tek-güncel-karar, audit. Gerçek migration'lara karşı PGlite.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, seedTwoTenants, type TestDb } from "./helpers/pg";

let db: TestDb;
let seed: Awaited<ReturnType<typeof seedTwoTenants>>;
const H = (c: string) => c.repeat(64);
const MISAFIR = "a0000000-0000-0000-0000-000000000009";

/** Global zincir: kaynak → artifact → hüküm → yükümlülük (service ile). */
async function yukumlulukEkle(): Promise<string> {
  const { rows: s } = await db.sql(
    `insert into public.regulatory_sources (authority, jurisdiction, kaynak_seviyesi, ad, erisim_politikasi_durumu)
     values ('SPK', 'TR', 'A', 'SPK Mevzuat Sistemi', 'manuel') returning id`,
  );
  const { rows: a } = await db.sql(
    `insert into public.source_artifacts (source_id, baslik, sha256) values ($1, 'Tebliğ v1', $2) returning id`,
    [s[0].id, H("a")],
  );
  const { rows: p } = await db.sql(
    `insert into public.provisions (source_artifact_id, provision_ref, metin, effective_from)
     values ($1, 'md. 26', 'Hüküm metni', '2020-01-01') returning id`,
    [a[0].id],
  );
  const { rows: o } = await db.sql(
    `insert into public.obligations (provision_id, kod, baslik, amac) values ($1, 'YUK-1', 'Yükümlülük', 'Amaç') returning id`,
    [p[0].id],
  );
  return o[0].id as string;
}

function kararEkleSql(kolonEk = "", degerEk = ""): string {
  return `insert into public.applicability_decisions
    (tenant_id, obligation_id, durum, fact_snapshot, fact_snapshot_fingerprint${kolonEk})
    values ($1, $2, $3, '{"schema":"KALKAN_APPLICABILITY_FACTS_V1"}'::jsonb, $4${degerEk})
    returning id`;
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

describe("applicability_decisions — RLS + karar invariant'ları (M22)", () => {
  it("kiracı izolasyonu: A'nın kararını B göremez; A kendi kararını görür", async () => {
    const oid = await yukumlulukEkle();
    const { rows } = await db.asUser(seed.A.userId, kararEkleSql(), [
      seed.A.tenantId, oid, "UNKNOWN", H("f"),
    ]);
    const id = rows[0].id;
    const { rows: kendi } = await db.asUser(seed.A.userId, `select id from public.applicability_decisions where id = $1`, [id]);
    expect(kendi).toHaveLength(1);
    const { rows: baska } = await db.asUser(seed.B.userId, `select id from public.applicability_decisions where id = $1`, [id]);
    expect(baska).toHaveLength(0);
  });

  it("denetçi-misafir karar YAZAMAZ; başka kiracı adına da yazılamaz", async () => {
    const oid = await yukumlulukEkle();
    await expect(
      db.asUser(MISAFIR, kararEkleSql(), [seed.A.tenantId, oid, "UNKNOWN", H("f")]),
    ).rejects.toThrow();
    await expect(
      db.asUser(seed.A.userId, kararEkleSql(), [seed.B.tenantId, oid, "UNKNOWN", H("f")]),
    ).rejects.toThrow();
  });

  it("UNKNOWN != NOT_APPLICABLE: NA gerekçe+onay olmadan YAZILAMAZ (service bile), UNKNOWN yazılır", async () => {
    const oid = await yukumlulukEkle();
    // UNKNOWN onaysız/gerekçesiz serbest — "değerlendiremedik" iddia değildir.
    await db.asUser(seed.A.userId, kararEkleSql(), [seed.A.tenantId, oid, "UNKNOWN", H("f")]);
    // NOT_APPLICABLE bir iddiadır: guard service bağlamında bile reddeder.
    await expect(
      db.sql(kararEkleSql(), [seed.B.tenantId, oid, "NOT_APPLICABLE", H("f")]),
    ).rejects.toThrow(/UNKNOWN != NOT_APPLICABLE/);
  });

  it("NOT_APPLICABLE gerekçe + onaylayan(=oturum sahibi) + zaman ile yazılır", async () => {
    const oid = await yukumlulukEkle();
    const { rows } = await db.asUser(
      seed.A.userId,
      kararEkleSql(", gerekce, onaylayan, onay_zamani", ", 'Kapsam dışı: yetki yok', $5, now()"),
      [seed.A.tenantId, oid, "NOT_APPLICABLE", H("f"), seed.A.userId],
    );
    expect(rows).toHaveLength(1);
  });

  it("kimlik atfı: onaylayan BAŞKASI gösterilemez (A, 'B onayladı' diyemez)", async () => {
    const oid = await yukumlulukEkle();
    // B, A'nın kiracısında değil; aynı kiracıda ikinci kullanıcı kur.
    const IKINCI = "a0000000-0000-0000-0000-000000000002";
    await db.sql(`insert into auth.users (id, email) values ($1, 'ikinci@demo.com')`, [IKINCI]);
    await db.sql(
      `insert into public.profiles (id, tenant_id, role, full_name) values ($1, $2, 'uyum', 'İkinci')`,
      [IKINCI, seed.A.tenantId],
    );
    await expect(
      db.asUser(
        seed.A.userId,
        kararEkleSql(", gerekce, onaylayan, onay_zamani", ", 'x', $5, now()"),
        [seed.A.tenantId, oid, "NOT_APPLICABLE", H("f"), IKINCI],
      ),
    ).rejects.toThrow(/kimlik atfi/);
  });

  it("CONDITIONAL koşulsuz yazılamaz; koşulla yazılır", async () => {
    const oid = await yukumlulukEkle();
    await expect(
      db.asUser(
        seed.A.userId,
        kararEkleSql(", gerekce, onaylayan, onay_zamani", ", 'x', $5, now()"),
        [seed.A.tenantId, oid, "CONDITIONAL", H("f"), seed.A.userId],
      ),
    ).rejects.toThrow(/kosul/);
    await db.asUser(
      seed.A.userId,
      kararEkleSql(", kosul, gerekce, onaylayan, onay_zamani", ", 'Halka açıksa', 'x', $5, now()"),
      [seed.A.tenantId, oid, "CONDITIONAL", H("f"), seed.A.userId],
    );
  });

  it("tek güncel karar: ikincisi reddedilir; supersede sonrası yenisi açılır", async () => {
    const oid = await yukumlulukEkle();
    const { rows } = await db.asUser(seed.A.userId, kararEkleSql(), [seed.A.tenantId, oid, "UNKNOWN", H("f")]);
    await expect(
      db.asUser(seed.A.userId, kararEkleSql(), [seed.A.tenantId, oid, "UNKNOWN", H("e")]),
    ).rejects.toThrow();
    await db.asUser(
      seed.A.userId,
      `update public.applicability_decisions set superseded_at = now() where id = $1`,
      [rows[0].id],
    );
    await db.asUser(seed.A.userId, kararEkleSql(), [seed.A.tenantId, oid, "UNKNOWN", H("e")]);
  });

  it("append-only: durum/olgu düzenlenemez, kapatılan karar yeniden açılamaz", async () => {
    const oid = await yukumlulukEkle();
    const { rows } = await db.asUser(seed.A.userId, kararEkleSql(), [seed.A.tenantId, oid, "UNKNOWN", H("f")]);
    const id = rows[0].id;
    await expect(
      db.asUser(seed.A.userId, `update public.applicability_decisions set durum = 'APPLICABLE' where id = $1`, [id]),
    ).rejects.toThrow(/append-only/);
    await db.asUser(seed.A.userId, `update public.applicability_decisions set superseded_at = now() where id = $1`, [id]);
    await expect(
      db.asUser(seed.A.userId, `update public.applicability_decisions set superseded_at = null where id = $1`, [id]),
    ).rejects.toThrow();
  });

  it("fingerprint 64-hex zorunlu (kural 15: neyi doğruladığı belli, biçimi de)", async () => {
    const oid = await yukumlulukEkle();
    await expect(
      db.asUser(seed.A.userId, kararEkleSql(), [seed.A.tenantId, oid, "UNKNOWN", "kisa-hash"]),
    ).rejects.toThrow();
  });

  it("audit izi: karar yazımı ve kapaması audit_log'a düşer", async () => {
    const oid = await yukumlulukEkle();
    const { rows } = await db.asUser(seed.A.userId, kararEkleSql(), [seed.A.tenantId, oid, "UNKNOWN", H("f")]);
    await db.asUser(seed.A.userId, `update public.applicability_decisions set superseded_at = now() where id = $1`, [rows[0].id]);
    const { rows: audit } = await db.sql(
      `select eylem from public.audit_log where hedef_tablo = 'applicability_decisions' and hedef_id = $1 order by created_at`,
      [rows[0].id],
    );
    expect(audit.map((r) => r.eylem)).toEqual([
      "uygulanabilirlik_karari_verildi",
      "uygulanabilirlik_karari_kapatildi",
    ]);
  });
});
