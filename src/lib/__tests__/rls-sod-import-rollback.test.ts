// M16 PR-3C: rollback (ters değişiklik seti, fiziksel silme yok) +
// maker-checker (talep eden karara bağlayamaz) + idempotency + izolasyon.
// Gerçek migration'lara karşı PGlite (kural 1/4).
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, seedTwoTenants, type TestDb } from "./helpers/pg";

let db: TestDb;
let seed: Awaited<ReturnType<typeof seedTwoTenants>>;

const H = (c: string) => c.repeat(64);
const SNAP = H("5");
const RULES = H("6");

/** Apply edilecek üç kalemlik önizleme + öncesi atamalar (PR-3B testiyle aynı desen). */
async function applyKur(tenantId: string, userId: string) {
  // rec-upd: apply GÜNCELLEYECEK (subject alanları dahil eski değerler önemli).
  await db.sql(
    `insert into public.sod_atamalari
       (tenant_id, harici_kullanici_id, aktivite_kodu, rol_kodu, sistem_kapsami,
        gecerlilik_baslangic, kaynak_sistem, source_record_id, subject_type, display_name, email)
     values ($1, 'hr:ext-upd', 'ESKI_AKT', 'ESKI_ROL', 'kalkan_os', '2026-01-01', 'hr', 'rec-upd',
             'USER', 'Eski Ad', 'eski@x.com')`,
    [tenantId],
  );
  // rec-end: apply SONA ERDİRECEK.
  await db.sql(
    `insert into public.sod_atamalari
       (tenant_id, harici_kullanici_id, aktivite_kodu, sistem_kapsami,
        gecerlilik_baslangic, kaynak_sistem, source_record_id, subject_type)
     values ($1, 'hr:ext-end', 'AKTX', 'kalkan_os', '2026-01-01', 'hr', 'rec-end', 'USER')`,
    [tenantId],
  );

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
          subjectType: "SERVICE_ACCOUNT",
          displayName: "Yeni Ad",
          email: "yeni@x.com",
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
    [tenantId, H("a"), H("b"), SNAP, RULES, JSON.stringify(diff), userId],
  );
  const onizlemeId = rows[0].id as string;
  await db.sql(`select public.sod_import_uygula($1, $2, $3, $4, $5)`, [
    onizlemeId,
    userId,
    SNAP,
    RULES,
    H("e"),
  ]);
  const { rows: man } = await db.sql(
    `select id, ters_degisiklik from public.sod_import_manifestleri where onizleme_id = $1`,
    [onizlemeId],
  );
  return { manifestId: man[0].id as string, tersDegisiklik: man[0].ters_degisiklik };
}

async function talepAc(tenantId: string, manifestId: string, talepEden: string) {
  const { rows } = await db.sql(
    `insert into public.sod_import_rollbacklari (tenant_id, manifest_id, gerekce, talep_eden)
     values ($1, $2, 'test gerekçesi', $3) returning id`,
    [tenantId, manifestId, talepEden],
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

describe("apply ters değişiklik setini yakalar (PR-3C)", () => {
  it("üç tür kalem doğru yakalanır; upsert-revive GUNCELLENDI olur", async () => {
    const { manifestId, tersDegisiklik } = await applyKur(seed.A.tenantId, seed.A.userId);
    expect(manifestId).toBeTruthy();
    const kalemler = tersDegisiklik as { tur: string; onceki?: Record<string, unknown> }[];
    const turler = kalemler.map((k) => k.tur).sort();
    expect(turler).toEqual(["EKLENDI", "GUNCELLENDI", "SONA_ERDIRILDI"]);
    // GUNCELLENDI eski değerlerin TAMAMINI taşır (subject alanları dahil).
    const g = kalemler.find((k) => k.tur === "GUNCELLENDI")!;
    expect(g.onceki!.aktivite_kodu).toBe("ESKI_AKT");
    expect(g.onceki!.subject_type).toBe("USER");
    expect(g.onceki!.display_name).toBe("Eski Ad");

    // Upsert-revive: aynı kaynak kaydını İKİNCİ bir önizleme "eklenecek"
    // olarak uygularsa ters seti EKLENDI değil GUNCELLENDI kaydeder.
    const diff2 = {
      eklenecek: [
        {
          externalSubjectId: "ext-new",
          subjectType: "USER",
          displayName: null,
          email: null,
          roleCode: null,
          activityCode: "BAMBASKA",
          systemCode: "kalkan_os",
          validFrom: "2026-04-01",
          validTo: null,
          source: "hr",
          sourceRecordId: "rec-new",
        },
      ],
      guncellenecek: [],
      degismeyecek: [],
      sonaErdirilecek: [],
    };
    const { rows } = await db.sql(
      `insert into public.sod_import_onizlemeleri
         (tenant_id, kaynak, mode, file_hash, normalized_records_hash, assignment_snapshot_hash,
          rule_set_version, normalized_records, diff, durum)
       values ($1, 'hr', 'DELTA', $2, $3, $4, $5, '[]', $6, 'READY_FOR_REVIEW') returning id`,
      [seed.A.tenantId, H("1"), H("2"), SNAP, RULES, JSON.stringify(diff2)],
    );
    await db.sql(`select public.sod_import_uygula($1, $2, $3, $4, $5)`, [
      rows[0].id,
      seed.A.userId,
      SNAP,
      RULES,
      H("f"),
    ]);
    const { rows: man2 } = await db.sql(
      `select ters_degisiklik from public.sod_import_manifestleri where onizleme_id = $1`,
      [rows[0].id],
    );
    const k2 = man2[0].ters_degisiklik as { tur: string; onceki?: Record<string, unknown> }[];
    expect(k2).toHaveLength(1);
    expect(k2[0].tur).toBe("GUNCELLENDI");
    expect(k2[0].onceki!.aktivite_kodu).toBe("YENI_AKT"); // ilk apply'ın yazdığı
  });
});

describe("sod_import_geri_al — maker-checker + atomik ters uygulama", () => {
  it("talep eden kendi rollback'ini uygulayamaz (RPC + trigger çift savunma)", async () => {
    const { manifestId } = await applyKur(seed.A.tenantId, seed.A.userId);
    const talepId = await talepAc(seed.A.tenantId, manifestId, seed.A.userId);
    await expect(
      db.sql(`select public.sod_import_geri_al($1, $2, 'not')`, [talepId, seed.A.userId]),
    ).rejects.toThrow(/maker-checker/);
    // Trigger da bağımsız zorlar (RPC atlanıp doğrudan UPDATE denense bile).
    await expect(
      db.sql(
        `update public.sod_import_rollbacklari set durum='UYGULANDI', onaylayan=$2 where id=$1`,
        [talepId, seed.A.userId],
      ),
    ).rejects.toThrow(/maker-checker|karara baglayamaz/);
  });

  it("farklı yetkili onaylar: eklenen sona erer, güncellenen eski değerlere döner, sona-erdirilen yeniden açılır; outbox olayı düşer", async () => {
    const { manifestId } = await applyKur(seed.A.tenantId, seed.A.userId);
    // İkinci kullanıcı (checker) — B tenant'ın kullanıcısı DEĞİL, aynı kiracıda
    // ikinci profil gerekiyor; seed'e ek kullanıcı aç.
    const checker = "a0000000-0000-0000-0000-000000000002";
    await db.sql(`insert into auth.users (id, email) values ($1, 'a2@demo.com')`, [checker]);
    await db.sql(
      `insert into public.profiles (id, tenant_id, role, full_name) values ($1, $2, 'uyum', 'A Uyum')`,
      [checker, seed.A.tenantId],
    );

    const talepId = await talepAc(seed.A.tenantId, manifestId, seed.A.userId);
    const { rows: sonuc } = await db.sql(`select public.sod_import_geri_al($1, $2, 'onay notu') as s`, [
      talepId,
      checker,
    ]);
    const s = sonuc[0].s as { sona_erdirilen: number; geri_yuklenen: number; yeniden_acilan: number };
    expect(s.sona_erdirilen).toBe(1);
    expect(s.geri_yuklenen).toBe(1);
    expect(s.yeniden_acilan).toBe(1);

    // Eklenen (rec-new): FİZİKSEL SİLİNMEDİ, sona erdirildi.
    const { rows: yeni } = await db.sql(
      `select gecerlilik_bitis from public.sod_atamalari where tenant_id=$1 and source_record_id='rec-new'`,
      [seed.A.tenantId],
    );
    expect(yeni).toHaveLength(1);
    expect(yeni[0].gecerlilik_bitis).not.toBeNull();

    // Güncellenen (rec-upd): apply-öncesi değerlere döndü (subject alanları dahil).
    const { rows: upd } = await db.sql(
      `select aktivite_kodu, rol_kodu, subject_type, display_name, email
       from public.sod_atamalari where tenant_id=$1 and source_record_id='rec-upd'`,
      [seed.A.tenantId],
    );
    expect(upd[0].aktivite_kodu).toBe("ESKI_AKT");
    expect(upd[0].rol_kodu).toBe("ESKI_ROL");
    expect(upd[0].subject_type).toBe("USER");
    expect(upd[0].display_name).toBe("Eski Ad");
    expect(upd[0].email).toBe("eski@x.com");

    // Sona erdirilen (rec-end): yeniden açıldı.
    const { rows: end } = await db.sql(
      `select gecerlilik_bitis from public.sod_atamalari where tenant_id=$1 and source_record_id='rec-end'`,
      [seed.A.tenantId],
    );
    expect(end[0].gecerlilik_bitis).toBeNull();

    // Outbox: apply + rollback = 2 olay; rollback olayı PENDING.
    const { rows: out } = await db.sql(
      `select event_type, durum from public.sod_outbox where tenant_id=$1 order by created_at`,
      [seed.A.tenantId],
    );
    expect(out).toHaveLength(2);
    expect(out[1].event_type).toBe("SOD_ATAMALARI_ROLLBACK_EDILDI");
    expect(out[1].durum).toBe("PENDING");

    // Talep UYGULANDI + audit kararı checker'a atfedildi.
    const { rows: talep } = await db.sql(
      `select durum, onaylayan from public.sod_import_rollbacklari where id=$1`,
      [talepId],
    );
    expect(talep[0].durum).toBe("UYGULANDI");
    expect(talep[0].onaylayan).toBe(checker);
    const { rows: audit } = await db.sql(
      `select actor_id from public.audit_log where eylem='sod_import_rollback_karari' and hedef_id=$1`,
      [talepId],
    );
    expect(audit).toHaveLength(1);
    expect(audit[0].actor_id).toBe(checker);
  });

  it("uygulanmış rollback İKİNCİ kez uygulanamaz; karar verilmiş kayıt değiştirilemez", async () => {
    const { manifestId } = await applyKur(seed.A.tenantId, seed.A.userId);
    const checker = "a0000000-0000-0000-0000-000000000002";
    await db.sql(`insert into auth.users (id, email) values ($1, 'a2@demo.com')`, [checker]);
    await db.sql(
      `insert into public.profiles (id, tenant_id, role, full_name) values ($1, $2, 'uyum', 'A Uyum')`,
      [checker, seed.A.tenantId],
    );
    const talepId = await talepAc(seed.A.tenantId, manifestId, seed.A.userId);
    await db.sql(`select public.sod_import_geri_al($1, $2, 'onay')`, [talepId, checker]);

    await expect(
      db.sql(`select public.sod_import_geri_al($1, $2, 'tekrar')`, [talepId, checker]),
    ).rejects.toThrow(/ROLLBACK_UYGULANAMAZ/);
    await expect(
      db.sql(`update public.sod_import_rollbacklari set durum='REDDEDILDI', onaylayan=$2 where id=$1`, [
        talepId,
        checker,
      ]),
    ).rejects.toThrow(/degistirilemez/);

    // Aynı manifest için YENİ talep de açılamaz (partial unique: UYGULANDI aktif).
    await expect(talepAc(seed.A.tenantId, manifestId, seed.A.userId)).rejects.toThrow();
  });

  it("REDDEDİLEN talep yeni talebe engel değildir (partial unique)", async () => {
    const { manifestId } = await applyKur(seed.A.tenantId, seed.A.userId);
    const checker = "a0000000-0000-0000-0000-000000000002";
    await db.sql(`insert into auth.users (id, email) values ($1, 'a2@demo.com')`, [checker]);
    await db.sql(
      `insert into public.profiles (id, tenant_id, role, full_name) values ($1, $2, 'uyum', 'A Uyum')`,
      [checker, seed.A.tenantId],
    );
    const talep1 = await talepAc(seed.A.tenantId, manifestId, seed.A.userId);
    await db.sql(
      `update public.sod_import_rollbacklari set durum='REDDEDILDI', onaylayan=$2, karar_notu='ret' where id=$1`,
      [talep1, checker],
    );
    const talep2 = await talepAc(seed.A.tenantId, manifestId, seed.A.userId);
    expect(talep2).toBeTruthy();
  });

  it("legacy manifest (ters seti null) geri alınamaz — köken uydurulmaz", async () => {
    const { manifestId } = await applyKur(seed.A.tenantId, seed.A.userId);
    await db.sql(`update public.sod_import_manifestleri set ters_degisiklik = null where id = $1`, [
      manifestId,
    ]);
    const checker = "a0000000-0000-0000-0000-000000000002";
    await db.sql(`insert into auth.users (id, email) values ($1, 'a2@demo.com')`, [checker]);
    await db.sql(
      `insert into public.profiles (id, tenant_id, role, full_name) values ($1, $2, 'uyum', 'A Uyum')`,
      [checker, seed.A.tenantId],
    );
    const talepId = await talepAc(seed.A.tenantId, manifestId, seed.A.userId);
    await expect(
      db.sql(`select public.sod_import_geri_al($1, $2, 'onay')`, [talepId, checker]),
    ).rejects.toThrow(/ROLLBACK_DESTEKLENMIYOR/);
  });
});

describe("sod_import_rollbacklari RLS + yetki sınırları", () => {
  it("kiracı izolasyonu: B, A'nın talebini göremez; A başka kiracı adına talep yazamaz", async () => {
    const { manifestId } = await applyKur(seed.A.tenantId, seed.A.userId);
    const talepId = await talepAc(seed.A.tenantId, manifestId, seed.A.userId);

    const { rows: baska } = await db.asUser(
      seed.B.userId,
      `select id from public.sod_import_rollbacklari where id = $1`,
      [talepId],
    );
    expect(baska).toHaveLength(0);

    await expect(
      db.asUser(
        seed.A.userId,
        `insert into public.sod_import_rollbacklari (tenant_id, manifest_id, gerekce, talep_eden)
         values ($1, $2, 'x', $3)`,
        [seed.B.tenantId, manifestId, seed.A.userId],
      ),
    ).rejects.toThrow();
  });

  it("talep BAŞKASI adına açılamaz (talep_eden = auth.uid RLS'i)", async () => {
    const { manifestId } = await applyKur(seed.A.tenantId, seed.A.userId);
    const checker = "a0000000-0000-0000-0000-000000000002";
    await db.sql(`insert into auth.users (id, email) values ($1, 'a2@demo.com')`, [checker]);
    await db.sql(
      `insert into public.profiles (id, tenant_id, role, full_name) values ($1, $2, 'uyum', 'A Uyum')`,
      [checker, seed.A.tenantId],
    );
    // A kullanıcısı talep_eden=checker yazamaz — maker kimliği sahtelenemez.
    await expect(
      db.asUser(
        seed.A.userId,
        `insert into public.sod_import_rollbacklari (tenant_id, manifest_id, gerekce, talep_eden)
         values ($1, $2, 'x', $3)`,
        [seed.A.tenantId, manifestId, checker],
      ),
    ).rejects.toThrow();
  });

  it("istemci UPDATE/DELETE edemez; geri-al RPC'sini authenticated çağıramaz", async () => {
    const { manifestId } = await applyKur(seed.A.tenantId, seed.A.userId);
    const talepId = await talepAc(seed.A.tenantId, manifestId, seed.A.userId);

    await expect(
      db.asUser(seed.A.userId, `update public.sod_import_rollbacklari set gerekce='x' where id=$1`, [talepId]),
    ).rejects.toThrow();
    await expect(
      db.asUser(seed.A.userId, `delete from public.sod_import_rollbacklari where id=$1`, [talepId]),
    ).rejects.toThrow();
    await expect(
      db.asUser(seed.B.userId, `select public.sod_import_geri_al($1, $2, 'x')`, [talepId, seed.B.userId]),
    ).rejects.toThrow();
  });
});
