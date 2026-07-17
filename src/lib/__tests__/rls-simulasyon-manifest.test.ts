// M9: sonuç manifesti — kiracı izolasyonu, değişmezlik ve QR yüzeyinin
// veri minimizasyonu (docs/ROADMAP.md M9, belge §11.3).
//
// Bu dosyanın asıl derdi tek bir cümle: mühür, mühürlenen şeyi koruyabiliyor
// mu? Manifest sonradan düzeltilebiliyorsa "immutable" bir iddia değil bir
// temennidir; QR yüzeyi puanı sızdırıyorsa doğrulama bir bilgi kaçağıdır.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, seedTwoTenants, type TestDb } from "./helpers/pg";

let db: TestDb;
let seed: Awaited<ReturnType<typeof seedTwoTenants>>;
let runId: string;
let manifestId: string;

const HASH_A = "a".repeat(64);
const RAPOR_HASH = "b".repeat(64);
const KOK = "c".repeat(64);

beforeEach(async () => {
  db = await createTestDb();
  seed = await seedTwoTenants(db);

  const { rows: t } = await db.sql(
    `insert into public.scenario_templates (kod, ad, tehdit_kategorisi)
     values ('S99', 'Test', 'test') returning id`,
  );
  const { rows: v } = await db.sql(
    `insert into public.scenario_template_versions (template_id, surum, tahmini_dakika)
     values ($1, 1, 60) returning id`,
    [t[0].id],
  );
  const { rows: r } = await db.sql(
    `insert into public.simulation_runs (tenant_id, version_id, ad, mod, durum)
     values ($1, $2, 'Test', 'canli', 'tamamlandi') returning id`,
    [seed.A.tenantId, v[0].id],
  );
  runId = r[0].id as string;

  const { rows: m } = await db.sql(
    `insert into public.simulation_result_manifests
       (run_id, tenant_id, core_manifest, core_manifest_hash, report_data_hash, merkle_root)
     values ($1, $2, $3, $4, $5, $6) returning id`,
    [runId, seed.A.tenantId, JSON.stringify({ puan: 72, durum: "KISMI" }), HASH_A, RAPOR_HASH, KOK],
  );
  manifestId = m[0].id as string;
});

afterEach(async () => {
  await db.close();
});

describe("kiracı izolasyonu (kural 1)", () => {
  it("kiracı kendi manifestini görür", async () => {
    const { rows } = await db.asUser(
      seed.A.userId,
      `select id from public.simulation_result_manifests where id = $1`,
      [manifestId],
    );
    expect(rows).toHaveLength(1);
  });

  it("başka kiracı manifesti SORGUYLA da göremez", async () => {
    const { rows } = await db.asUser(
      seed.B.userId,
      `select id from public.simulation_result_manifests where id = $1`,
      [manifestId],
    );
    expect(rows).toHaveLength(0);
  });

  it("oturumsuz ziyaretçi manifest tablosunu okuyamaz — QR yüzeyi tablo değil, RPC'dir", async () => {
    const { rows } = await db.asAnon(`select id from public.simulation_result_manifests`);
    expect(rows).toHaveLength(0);
  });

  it("makbuz da kiracıyla sınırlı", async () => {
    await db.sql(
      `insert into public.simulation_manifest_receipts (manifest_id, tenant_id, saglayici, anchored_at)
       values ($1, $2, 'local-append-only', now())`,
      [manifestId, seed.A.tenantId],
    );
    const { rows } = await db.asUser(
      seed.B.userId,
      `select id from public.simulation_manifest_receipts`,
    );
    expect(rows).toHaveLength(0);
  });
});

describe("değişmezlik (belge §11.3)", () => {
  it("manifest GÜNCELLENEMEZ — service_role bile", async () => {
    // db.sql superuser: RLS'i bypass eder. Kural trigger'da olduğu için
    // yine de tutmalı — mühürü yazan taraf zaten service_role.
    await expect(
      db.sql(`update public.simulation_result_manifests set core_manifest_hash = $1 where id = $2`, [
        "d".repeat(64),
        manifestId,
      ]),
    ).rejects.toThrow(/degistirilemez/i);
  });

  it("puanı manifest içinde sessizce düzeltmek de engellenir", async () => {
    await expect(
      db.sql(`update public.simulation_result_manifests set core_manifest = $1 where id = $2`, [
        JSON.stringify({ puan: 100, durum: "BASARILI" }),
        manifestId,
      ]),
    ).rejects.toThrow(/degistirilemez/i);
  });

  it("kullanıcı kendi manifestini yazamaz — mühür sistem işidir (kural 11)", async () => {
    await expect(
      db.asUser(
        seed.A.userId,
        `insert into public.simulation_result_manifests
           (run_id, tenant_id, core_manifest, core_manifest_hash, report_data_hash, merkle_root)
         values ($1, $2, '{}', $3, $4, $5)`,
        [runId, seed.A.tenantId, "e".repeat(64), RAPOR_HASH, KOK],
      ),
    ).rejects.toThrow();
  });

  it("bir tatbikatın iki resmi sonucu olamaz", async () => {
    await expect(
      db.sql(
        `insert into public.simulation_result_manifests
           (run_id, tenant_id, core_manifest, core_manifest_hash, report_data_hash, merkle_root)
         values ($1, $2, '{}', $3, $4, $5)`,
        [runId, seed.A.tenantId, "f".repeat(64), RAPOR_HASH, KOK],
      ),
    ).rejects.toThrow();
  });

  it("tatbikat silinince manifest cascade ile gider — trigger kendi cascade'ini bloke etmez", async () => {
    // 20260717170000'deki hatanın regresyonu: DELETE'te erken çıkmayan bir
    // trigger, cascade'i kendi hatasıyla bloke ediyordu.
    await db.sql(`delete from public.simulation_runs where id = $1`, [runId]);
    const { rows } = await db.sql(`select id from public.simulation_result_manifests`);
    expect(rows).toHaveLength(0);
  });
});

describe("manifest_dogrulama_durumu (ADR-M11-01)", () => {
  it("imzasız manifest 'imzasiz' döner — eski kayıt dürüstçe işaretlenir", async () => {
    const { rows } = await db.sql(`select public.manifest_dogrulama_durumu($1) as durum`, [
      manifestId,
    ]);
    expect(rows[0].durum).toBe("imzasiz");
  });

  it("imzalı manifest 'imzali' döner", async () => {
    // Manifest immutable (UPDATE reddedilir); imza INSERT'te verilir. Aynı
    // tatbikatın iki manifesti olamayacağı için yeni bir run kuruyoruz.
    const { rows: r2 } = await db.sql(
      `insert into public.simulation_runs (tenant_id, version_id, ad, mod, durum)
       select tenant_id, version_id, 'Imzali', 'canli', 'tamamlandi'
       from public.simulation_runs where id = $1 returning id`,
      [runId],
    );
    const { rows: m2 } = await db.sql(
      `insert into public.simulation_result_manifests
         (run_id, tenant_id, core_manifest, core_manifest_hash, report_data_hash, merkle_root,
          signature_jws, signature_kid, signature_public_jwk, signer_ad)
       values ($1, $2, '{}', $3, $4, $5, 'hdr..sig', 'local-dev-x', '{"kty":"EC"}', 'local-dev-es256')
       returning id`,
      [r2[0].id, seed.A.tenantId, "1".repeat(64), "2".repeat(64), "3".repeat(64)],
    );
    const { rows } = await db.sql(`select public.manifest_dogrulama_durumu($1) as durum`, [
      m2[0].id,
    ]);
    expect(rows[0].durum).toBe("imzali");
  });
});

describe("manifest_dogrula — herkese açık QR yüzeyi (M9 kabul kriteri)", () => {
  it("oturumsuz ziyaretçi geçerli hash'i doğrulayabilir", async () => {
    const { rows } = await db.asAnon(`select * from public.manifest_dogrula($1)`, [HASH_A]);
    expect(rows).toHaveLength(1);
    expect(rows[0].report_data_hash).toBe(RAPOR_HASH);
  });

  it("makbuz yokken durum 'beklemede' — sabitleme tekrar denenebilir bir iştir", async () => {
    const { rows } = await db.asAnon(`select * from public.manifest_dogrula($1)`, [HASH_A]);
    expect(rows[0].durum).toBe("beklemede");
    expect(rows[0].anchored_at).toBeNull();
  });

  it("makbuz gelince 'sabitlendi'ye döner", async () => {
    await db.sql(
      `insert into public.simulation_manifest_receipts (manifest_id, tenant_id, saglayici, anchored_at)
       values ($1, $2, 'local-append-only', now())`,
      [manifestId, seed.A.tenantId],
    );
    const { rows } = await db.asAnon(`select * from public.manifest_dogrula($1)`, [HASH_A]);
    expect(rows[0].durum).toBe("sabitlendi");
    expect(rows[0].saglayici).toBe("local-append-only");
  });

  it("bilinmeyen hash BOŞ döner — varlık/yokluk bilgisi bile sızmaz", async () => {
    const { rows } = await db.asAnon(`select * from public.manifest_dogrula($1)`, ["9".repeat(64)]);
    expect(rows).toHaveLength(0);
  });

  it("HASSAS VERİ SIZDIRMAZ: puan, kiracı, senaryo ve manifest içeriği dönmez", async () => {
    // M9 kabul kriteri. Bu test, fonksiyona ileride "kolaylık olsun" diye
    // puan/kurum adı eklenmesine karşı bir kapıdır: doğrulama, belgenin
    // sahiciliğini söyler — içeriğini değil.
    const { rows } = await db.asAnon(`select * from public.manifest_dogrula($1)`, [HASH_A]);
    const alanlar = Object.keys(rows[0]);
    expect(alanlar.sort()).toEqual(
      ["anchored_at", "durum", "muhurlendi_at", "report_data_hash", "saglayici"].sort(),
    );
    const serialize = JSON.stringify(rows[0]);
    expect(serialize).not.toContain("72");
    expect(serialize).not.toContain("KISMI");
    expect(serialize).not.toContain(seed.A.tenantId);
  });
});
