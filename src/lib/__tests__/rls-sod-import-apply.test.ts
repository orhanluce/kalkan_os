// M16 PR-3B: atomik apply + idempotency + transactional-outbox + manifest.
// Gerçek migration'lara karşı PGlite (kural 1/4). Apply fonksiyonu (security
// definer) burada superuser olarak çağrılır — canlıda service_role rotası
// çağırır; execute yetkisi authenticated/anon'dan revoke edildi.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, seedTwoTenants, type TestDb } from "./helpers/pg";

let db: TestDb;
let seed: Awaited<ReturnType<typeof seedTwoTenants>>;

const H = (c: string) => c.repeat(64);
const SNAP = H("5");
const RULES = H("6");
const MANIFEST = H("e");

/** Güncellenecek ve sona-erdirilecek için mevcut atama kurar. */
async function mevcutAtamalariKur(tenantId: string, userId: string) {
  // rec-upd: apply GÜNCELLEYECEK.
  await db.sql(
    `insert into public.sod_atamalari
       (tenant_id, harici_kullanici_id, aktivite_kodu, rol_kodu, sistem_kapsami,
        gecerlilik_baslangic, kaynak_sistem, source_record_id, subject_type)
     values ($1, 'hr:ext-upd', 'ESKI_AKT', null, 'kalkan_os', '2026-01-01', 'hr', 'rec-upd', 'USER')`,
    [tenantId],
  );
  // rec-end: apply SONA ERDİRECEK (gecerlilik_bitis atanacak).
  await db.sql(
    `insert into public.sod_atamalari
       (tenant_id, harici_kullanici_id, aktivite_kodu, sistem_kapsami,
        gecerlilik_baslangic, kaynak_sistem, source_record_id, subject_type)
     values ($1, 'hr:ext-end', 'AKTX', 'kalkan_os', '2026-01-01', 'hr', 'rec-end', 'USER')`,
    [tenantId],
  );
  void userId;
}

/** READY_FOR_REVIEW bir önizleme yazar (ekle 1 / güncelle 1 / sona-erdir 1). */
async function onizlemeKur(tenantId: string, userId: string, snap = SNAP, rules = RULES) {
  const diff = {
    eklenecek: [
      {
        externalSubjectId: "ext-new",
        subjectType: "USER",
        displayName: "Yeni Kişi",
        email: "y@x.com",
        roleCode: null,
        activityCode: "YENI_AKT",
        systemCode: "kalkan_os",
        validFrom: "2026-03-01",
        validTo: null,
        source: "hr",
        sourceRecordId: "rec-new",
      },
    ],
    guncellenecek: [
      {
        record: {
          externalSubjectId: "ext-upd",
          subjectType: "USER",
          displayName: null,
          email: null,
          roleCode: "R2",
          activityCode: "YENI_UPD_AKT",
          systemCode: "kalkan_os",
          validFrom: "2026-02-01",
          validTo: null,
          source: "hr",
          sourceRecordId: "rec-upd",
        },
        onceki: { source_record_id: "rec-upd", kaynak_sistem: "hr" },
      },
    ],
    degismeyecek: [],
    sonaErdirilecek: [
      {
        source_record_id: "rec-end",
        kaynak_sistem: "hr",
        aktivite_kodu: "AKTX",
        rol_kodu: null,
        sistem_kapsami: "kalkan_os",
        gecerlilik_baslangic: "2026-01-01",
        gecerlilik_bitis: null,
      },
    ],
  };
  const { rows } = await db.sql(
    `insert into public.sod_import_onizlemeleri
       (tenant_id, kaynak, mode, file_hash, normalized_records_hash, assignment_snapshot_hash,
        rule_set_version, normalized_records, diff, durum, yukleyen)
     values ($1, 'hr', 'AUTHORITATIVE_SNAPSHOT', $2, $3, $4, $5, '[]', $6, 'READY_FOR_REVIEW', $7)
     returning id`,
    [tenantId, H("a"), H("b"), snap, rules, JSON.stringify(diff), userId],
  );
  return rows[0].id as string;
}

function uygula(onizlemeId: string, userId: string, snap = SNAP, rules = RULES) {
  return db.sql(`select public.sod_import_uygula($1, $2, $3, $4, $5) as sonuc`, [
    onizlemeId,
    userId,
    snap,
    rules,
    MANIFEST,
  ]);
}

beforeEach(async () => {
  db = await createTestDb();
  seed = await seedTwoTenants(db);
});

afterEach(async () => {
  await db.close();
});

describe("sod_import_uygula — atomik apply", () => {
  it("ekle/güncelle/sona-erdir uygular, manifest + outbox yazar, önizlemeyi APPLIED yapar", async () => {
    await mevcutAtamalariKur(seed.A.tenantId, seed.A.userId);
    const onizlemeId = await onizlemeKur(seed.A.tenantId, seed.A.userId);

    const { rows } = await uygula(onizlemeId, seed.A.userId);
    const sonuc = rows[0].sonuc as { eklenen: number; guncellenen: number; sona_erdirilen: number; manifest_id: string };
    expect(sonuc.eklenen).toBe(1);
    expect(sonuc.guncellenen).toBe(1);
    expect(sonuc.sona_erdirilen).toBe(1);

    // Eklenen atama: harici kimlik = kaynak:externalSubjectId.
    const { rows: yeni } = await db.sql(
      `select harici_kullanici_id, aktivite_kodu, subject_type from public.sod_atamalari
       where tenant_id = $1 and source_record_id = 'rec-new'`,
      [seed.A.tenantId],
    );
    expect(yeni).toHaveLength(1);
    expect(yeni[0].harici_kullanici_id).toBe("hr:ext-new");
    expect(yeni[0].aktivite_kodu).toBe("YENI_AKT");

    // Güncellenen atama: aktivite_kodu değişti.
    const { rows: upd } = await db.sql(
      `select aktivite_kodu, rol_kodu from public.sod_atamalari
       where tenant_id = $1 and source_record_id = 'rec-upd'`,
      [seed.A.tenantId],
    );
    expect(upd[0].aktivite_kodu).toBe("YENI_UPD_AKT");
    expect(upd[0].rol_kodu).toBe("R2");

    // Sona erdirilen atama: FİZİKSEL SİLME YOK, yalnız gecerlilik_bitis atandı.
    const { rows: end } = await db.sql(
      `select gecerlilik_bitis from public.sod_atamalari
       where tenant_id = $1 and source_record_id = 'rec-end'`,
      [seed.A.tenantId],
    );
    expect(end).toHaveLength(1);
    expect(end[0].gecerlilik_bitis).not.toBeNull();

    // Manifest yazıldı.
    const { rows: man } = await db.sql(
      `select eklenen_sayisi, guncellenen_sayisi, sona_erdirilen_sayisi, manifest_hash
       from public.sod_import_manifestleri where onizleme_id = $1`,
      [onizlemeId],
    );
    expect(man).toHaveLength(1);
    expect(man[0].eklenen_sayisi).toBe(1);
    expect(man[0].manifest_hash).toBe(MANIFEST);

    // Outbox olayı PENDING yazıldı. (#5 tetikleri de SOD_YENIDEN_DEGERLENDIR
    // olayı düşürür — burada yalnız import olayı sınanır, türle filtrelenir.)
    const { rows: out } = await db.sql(
      `select event_type, durum from public.sod_outbox
       where tenant_id = $1 and event_type = 'SOD_ATAMALARI_IMPORT_EDILDI'`,
      [seed.A.tenantId],
    );
    expect(out).toHaveLength(1);
    expect(out[0].durum).toBe("PENDING");

    // Önizleme APPLIED.
    const { rows: onz } = await db.sql(
      `select durum from public.sod_import_onizlemeleri where id = $1`,
      [onizlemeId],
    );
    expect(onz[0].durum).toBe("APPLIED");

    // Audit kaydı düştü (actor = uygulayan; auth.uid service_role'de NULL olur).
    const { rows: audit } = await db.sql(
      `select a.actor_id from public.audit_log a
       join public.sod_import_manifestleri m on m.id = a.hedef_id
       where a.eylem = 'sod_import_uygulandi' and m.onizleme_id = $1`,
      [onizlemeId],
    );
    expect(audit).toHaveLength(1);
    expect(audit[0].actor_id).toBe(seed.A.userId);
  });

  it("APPLIED önizleme yeniden uygulanamaz (durum kilidi + idempotency)", async () => {
    await mevcutAtamalariKur(seed.A.tenantId, seed.A.userId);
    const onizlemeId = await onizlemeKur(seed.A.tenantId, seed.A.userId);
    await uygula(onizlemeId, seed.A.userId);

    await expect(uygula(onizlemeId, seed.A.userId)).rejects.toThrow(/ONIZLEME_UYGULANAMAZ/);

    // Tek manifest, tek eklenen atama — çift apply olmadı.
    const { rows: man } = await db.sql(
      `select count(*)::int as n from public.sod_import_manifestleri where onizleme_id = $1`,
      [onizlemeId],
    );
    expect(man[0].n).toBe(1);
  });

  it("STALE: güncel hash önizlemeninkiyle uyuşmazsa apply reddedilir ve HİÇBİR ŞEY yazılmaz (atomik)", async () => {
    await mevcutAtamalariKur(seed.A.tenantId, seed.A.userId);
    const onizlemeId = await onizlemeKur(seed.A.tenantId, seed.A.userId);

    // Yanlış güncel snapshot hash'i geç.
    await expect(uygula(onizlemeId, seed.A.userId, H("9"), RULES)).rejects.toThrow(/IMPORT_PREVIEW_STALE/);

    // Atomiklik: manifest yok, yeni atama yok, önizleme hâlâ READY.
    const { rows: man } = await db.sql(`select count(*)::int as n from public.sod_import_manifestleri`);
    expect(man[0].n).toBe(0);
    const { rows: yeni } = await db.sql(
      `select count(*)::int as n from public.sod_atamalari where source_record_id = 'rec-new'`,
    );
    expect(yeni[0].n).toBe(0);
    const { rows: onz } = await db.sql(
      `select durum from public.sod_import_onizlemeleri where id = $1`,
      [onizlemeId],
    );
    expect(onz[0].durum).toBe("READY_FOR_REVIEW");
  });

  it("idempotent ekle: aynı kaynak kaydını iki farklı önizleme uygularsa atama TEK kalır (upsert)", async () => {
    const o1 = await onizlemeKur(seed.A.tenantId, seed.A.userId);
    // o1'de mevcut atama yok; ekle 1 (rec-new), güncelle 0 eşleşir, sona-erdir 0.
    await uygula(o1, seed.A.userId);
    const o2 = await onizlemeKur(seed.A.tenantId, seed.A.userId);
    await uygula(o2, seed.A.userId);

    const { rows } = await db.sql(
      `select count(*)::int as n from public.sod_atamalari
       where tenant_id = $1 and kaynak_sistem = 'hr' and source_record_id = 'rec-new'`,
      [seed.A.tenantId],
    );
    expect(rows[0].n).toBe(1);
  });
});

describe("sod_import_manifestleri + sod_outbox RLS", () => {
  it("manifest: kiracı kendi kaydını görür, başkasınınkini göremez; append-only", async () => {
    await mevcutAtamalariKur(seed.A.tenantId, seed.A.userId);
    const onizlemeId = await onizlemeKur(seed.A.tenantId, seed.A.userId);
    await uygula(onizlemeId, seed.A.userId);

    const { rows: kendi } = await db.asUser(
      seed.A.userId,
      `select id from public.sod_import_manifestleri where onizleme_id = $1`,
      [onizlemeId],
    );
    expect(kendi).toHaveLength(1);
    const { rows: baska } = await db.asUser(
      seed.B.userId,
      `select id from public.sod_import_manifestleri where onizleme_id = $1`,
      [onizlemeId],
    );
    expect(baska).toHaveLength(0);

    const manId = kendi[0].id as string;
    await expect(
      db.asUser(seed.A.userId, `update public.sod_import_manifestleri set kaynak = 'x' where id = $1`, [manId]),
    ).rejects.toThrow();
    await expect(
      db.asUser(seed.A.userId, `delete from public.sod_import_manifestleri where id = $1`, [manId]),
    ).rejects.toThrow();
    await expect(
      db.asUser(
        seed.A.userId,
        `insert into public.sod_import_manifestleri
           (tenant_id, onizleme_id, kaynak, mode, file_hash, normalized_records_hash,
            assignment_snapshot_hash, rule_set_version, manifest_hash,
            eklenen_sayisi, guncellenen_sayisi, sona_erdirilen_sayisi)
         values ($1, $2, 'hr', 'DELTA', $3, $3, $3, $3, $3, 0, 0, 0)`,
        [seed.A.tenantId, onizlemeId, H("a")],
      ),
    ).rejects.toThrow();
  });

  it("outbox: kiracı izolasyonu + append-only (istemci INSERT/UPDATE/DELETE edemez)", async () => {
    await mevcutAtamalariKur(seed.A.tenantId, seed.A.userId);
    const onizlemeId = await onizlemeKur(seed.A.tenantId, seed.A.userId);
    await uygula(onizlemeId, seed.A.userId);

    const { rows: kendi } = await db.asUser(
      seed.A.userId,
      `select id from public.sod_outbox where event_type = 'SOD_ATAMALARI_IMPORT_EDILDI'`,
    );
    expect(kendi).toHaveLength(1);
    const { rows: baska } = await db.asUser(seed.B.userId, `select id from public.sod_outbox`);
    expect(baska).toHaveLength(0);

    const olayId = kendi[0].id as string;
    await expect(
      db.asUser(seed.A.userId, `update public.sod_outbox set durum = 'DONE' where id = $1`, [olayId]),
    ).rejects.toThrow();
    await expect(
      db.asUser(seed.A.userId, `delete from public.sod_outbox where id = $1`, [olayId]),
    ).rejects.toThrow();
  });

  it("apply fonksiyonu authenticated tarafından ÇAĞRILAMAZ (execute revoke — tenant atlama yok)", async () => {
    const onizlemeId = await onizlemeKur(seed.A.tenantId, seed.A.userId);
    await expect(
      db.asUser(seed.A.userId, `select public.sod_import_uygula($1, $2, $3, $4, $5)`, [
        onizlemeId,
        seed.A.userId,
        SNAP,
        RULES,
        MANIFEST,
      ]),
    ).rejects.toThrow();
  });
});
