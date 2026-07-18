// M16 tamamlama + M2 borcu: süre-dolumu otomasyonu
// (docs/ROADMAP.md M16, migration 20260718010000).
//
// İki zaman-tabanlı iş, ikisi de idempotent olmalı ve gerçek bir kontrol
// boşluğunu kapatmalı: süresi dolan SoD istisnası çatışmayı AÇMALI; kanıtı
// dolan kontrol 'kismi'ye DÜŞMELİ. Bu dosya o iki fonksiyonu gerçek Postgres'te
// (PGlite) sınar — pg_cron zamanlaması burada yok (defansif DO bloğu no-op),
// yalnız fonksiyon mantığı.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, seedTwoTenants, type TestDb } from "./helpers/pg";

let db: TestDb;
let seed: Awaited<ReturnType<typeof seedTwoTenants>>;
let ikinciUserId: string;

beforeEach(async () => {
  db = await createTestDb();
  seed = await seedTwoTenants(db);

  // Tenant A'ya ikinci kullanıcı: istisna onayı için (talep eden ≠ onaylayan).
  ikinciUserId = "a0000000-0000-0000-0000-000000000002";
  await db.sql(`insert into auth.users (id, email) values ($1, 'a2@demo.com')`, [ikinciUserId]);
  await db.sql(
    `insert into public.profiles (id, tenant_id, role, full_name)
     values ($1, $2, 'uyum', 'A Ikinci')`,
    [ikinciUserId, seed.A.tenantId],
  );
});

afterEach(async () => {
  await db.close();
});

// --- SoD istisna süre dolumu ---

/** EXCEPTION_APPROVED bir çatışma + onaylı istisna kurar; bitiş ayarlanabilir. */
async function onayliIstisnaKur(bitisSql: string): Promise<{ conflictId: string; istisnaId: string }> {
  const { rows: rule } = await db.sql(
    `insert into public.sod_kurallari (tenant_id, kod, ad, onem) values ($1, 'SOD-X', 'x', 'kritik') returning id`,
    [seed.A.tenantId],
  );
  const { rows: c } = await db.sql(
    `insert into public.sod_catismalari (tenant_id, rule_id, kullanici_id, sistem_kapsami, onem, fingerprint, durum)
     values ($1, $2, $3, 'kalkan_os', 'kritik', $4, 'OPEN') returning id`,
    [seed.A.tenantId, rule[0].id, seed.A.userId, "fp-" + Math.random().toString(36).slice(2)],
  );
  const conflictId = c[0].id as string;
  // İstisna: talep eden A, onaylayan ikinci kullanıcı (guard'ı geçsin).
  // baslangic geçmişte: gerçek istisnalar geçmişte başlar ve `bitis > baslangic`
  // check'i geçmiş bir bitiş için de sağlanmalı (60 gün önce başladı).
  const { rows: exc } = await db.sql(
    `insert into public.sod_istisnalari (conflict_id, tenant_id, gerekce, talep_eden_id, onaylayan_id, baslangic, bitis, durum)
     values ($1, $2, 'gerekce', $3, $4, current_date - 60, ${bitisSql}, 'onaylandi') returning id`,
    [conflictId, seed.A.tenantId, seed.A.userId, ikinciUserId],
  );
  // Çatışmayı EXCEPTION_APPROVED'e taşı (guard: onaylı istisna + farklı onaylayan var).
  await db.sql(`update public.sod_catismalari set durum = 'EXCEPTION_APPROVED' where id = $1`, [conflictId]);
  return { conflictId, istisnaId: exc[0].id as string };
}

async function calistir(): Promise<number> {
  const { rows } = await db.sql(`select public.sod_istisna_suresi_dolanlari_isle() as n`);
  return Number(rows[0].n);
}

async function durumlar(conflictId: string, istisnaId: string) {
  const { rows: c } = await db.sql(`select durum from public.sod_catismalari where id = $1`, [conflictId]);
  const { rows: i } = await db.sql(`select durum from public.sod_istisnalari where id = $1`, [istisnaId]);
  return { catisma: c[0].durum, istisna: i[0].durum };
}

describe("sod_istisna_suresi_dolanlari_isle", () => {
  it("süresi dolan istisna EXPIRED olur, çatışma REOPENED'e döner", async () => {
    const { conflictId, istisnaId } = await onayliIstisnaKur("current_date - 1");
    const n = await calistir();
    expect(n).toBe(1);
    expect(await durumlar(conflictId, istisnaId)).toEqual({
      catisma: "REOPENED",
      istisna: "suresi_doldu",
    });
  });

  it("bitiş BUGÜN olan istisna henüz dolmamıştır (son geçerli gün)", async () => {
    const { conflictId, istisnaId } = await onayliIstisnaKur("current_date");
    expect(await calistir()).toBe(0);
    expect(await durumlar(conflictId, istisnaId)).toEqual({
      catisma: "EXCEPTION_APPROVED",
      istisna: "onaylandi",
    });
  });

  it("gelecekteki istisna işlenmez", async () => {
    const { conflictId, istisnaId } = await onayliIstisnaKur("current_date + 30");
    expect(await calistir()).toBe(0);
    expect((await durumlar(conflictId, istisnaId)).istisna).toBe("onaylandi");
  });

  it("İDEMPOTENT: ikinci koşu aynı istisnayı yeniden işlemez", async () => {
    await onayliIstisnaKur("current_date - 1");
    expect(await calistir()).toBe(1);
    expect(await calistir()).toBe(0); // artık 'onaylandi' değil, eşleşmez
  });

  it("çatışma zaten OPEN ise istisna dolar ama çatışma çift-işlenmez", async () => {
    const { conflictId, istisnaId } = await onayliIstisnaKur("current_date - 1");
    // Çatışmayı manuel OPEN'a al (EXCEPTION_APPROVED değil).
    await db.sql(`update public.sod_catismalari set durum = 'OPEN' where id = $1`, [conflictId]);
    expect(await calistir()).toBe(1); // istisna yine dolar
    // Çatışma OPEN'dı, REOPENED'e ZORLANMAZ (yalnız EXCEPTION_APPROVED açılır).
    expect((await durumlar(conflictId, istisnaId)).catisma).toBe("OPEN");
  });

  it("MITIGATED çatışma istisna dolsa bile açılmaz — mitigasyon ayrı mekanizma", async () => {
    // Çatışmayı MITIGATED yapabilmek için PASSED telafi edici test gerekir;
    // bunu kurmak yerine guard'ı geçici kapatıp MITIGATED'e alıyoruz (bu test
    // yalnız 'EXCEPTION_APPROVED değilse açma' kuralını sınıyor).
    const { conflictId, istisnaId } = await onayliIstisnaKur("current_date - 1");
    await db.sql(
      `alter table public.sod_catismalari disable trigger sod_catisma_durum_guard_before_update`,
    );
    await db.sql(`update public.sod_catismalari set durum = 'MITIGATED' where id = $1`, [conflictId]);
    await db.sql(
      `alter table public.sod_catismalari enable trigger sod_catisma_durum_guard_before_update`,
    );
    expect(await calistir()).toBe(1); // istisna dolar
    expect((await durumlar(conflictId, istisnaId)).catisma).toBe("MITIGATED"); // dokunulmadı
  });

  it("süre dolumu 'sod_istisna_karar_verildi' audit kaydı üretir (Sistem)", async () => {
    await onayliIstisnaKur("current_date - 1");
    await calistir();
    const { rows } = await db.sql(
      `select actor_id, detay from public.audit_log
       where eylem = 'sod_istisna_karar_verildi' and detay->>'durum' = 'suresi_doldu'`,
    );
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0].actor_id).toBeNull(); // Sistem
  });
});

describe("sod_cron_durumu — pg_cron görünürlüğü", () => {
  it("PGlite'ta (pg_cron yok) hatasız BOŞ döner — dinamik EXECUTE + exception", async () => {
    const { rows } = await db.sql(`select * from public.sod_cron_durumu()`);
    expect(rows).toHaveLength(0);
  });
});

describe("onaylı istisna süre-kimlik kilidi (PR-3 ön koruma)", () => {
  it("onaylı istisnanın bitiş tarihi UPDATE ile UZATILAMAZ", async () => {
    const { istisnaId } = await onayliIstisnaKur("current_date + 5");
    await expect(
      db.sql(`update public.sod_istisnalari set bitis = current_date + 365 where id = $1`, [istisnaId]),
    ).rejects.toThrow(/degistirilemez/i);
  });

  it("onaylı istisnanın talep_eden/onaylayan/conflict/tenant alanları değiştirilemez", async () => {
    const { istisnaId } = await onayliIstisnaKur("current_date + 5");
    await expect(
      db.sql(`update public.sod_istisnalari set talep_eden_id = $1 where id = $2`, [ikinciUserId, istisnaId]),
    ).rejects.toThrow(/degistirilemez/i);
    await expect(
      db.sql(`update public.sod_istisnalari set onaylayan_id = $1 where id = $2`, [seed.A.userId, istisnaId]),
    ).rejects.toThrow(/degistirilemez/i);
  });

  it("KİLİT SÜRE-DOLUMUNU ENGELLEMEZ: onaylandi -> suresi_doldu geçişi çalışır", async () => {
    // Kritik regresyon: guard yalnız süre/kimlik alanlarını dondurur, durum
    // geçişini değil. Süre-dolumu işi hâlâ istisnayı dolduruyor olmalı.
    const { istisnaId } = await onayliIstisnaKur("current_date - 1");
    expect(await calistir()).toBe(1);
    const { rows } = await db.sql(`select durum from public.sod_istisnalari where id = $1`, [istisnaId]);
    expect(rows[0].durum).toBe("suresi_doldu");
  });

  it("HENÜZ ONAYLANMAMIŞ (talep_edildi) istisna düzenlenebilir — kilit yalnız onaylıda", async () => {
    const { rows: rule } = await db.sql(
      `insert into public.sod_kurallari (tenant_id, kod, ad, onem) values ($1, 'SOD-P', 'p', 'orta') returning id`,
      [seed.A.tenantId],
    );
    const { rows: c } = await db.sql(
      `insert into public.sod_catismalari (tenant_id, rule_id, kullanici_id, sistem_kapsami, onem, fingerprint, durum)
       values ($1, $2, $3, 'kalkan_os', 'orta', $4, 'OPEN') returning id`,
      [seed.A.tenantId, rule[0].id, seed.A.userId, "fp-p-" + Math.random().toString(36).slice(2)],
    );
    const { rows: exc } = await db.sql(
      `insert into public.sod_istisnalari (conflict_id, tenant_id, gerekce, talep_eden_id, bitis, durum)
       values ($1, $2, 'g', $3, current_date + 5, 'talep_edildi') returning id`,
      [c[0].id, seed.A.tenantId, seed.A.userId],
    );
    // Onaylanmadan bitiş düzeltmek serbest.
    await db.sql(`update public.sod_istisnalari set bitis = current_date + 10 where id = $1`, [exc[0].id]);
    const { rows } = await db.sql(`select bitis from public.sod_istisnalari where id = $1`, [exc[0].id]);
    expect(rows[0].bitis).not.toBeNull();
  });
});

// --- Kanıt süre dolumu (M2 borcu) ---

async function karsilananKontrolKur(bitisSql: string | null) {
  await db.sql(
    `insert into public.tenant_controls (tenant_id, control_id, durum) values ($1, $2, 'karsilaniyor')`,
    [seed.A.tenantId, seed.controlId],
  );
  // Zarf guard'ı için tam alanlar (rls-kanit-zarfi deseni).
  const bitis = bitisSql === null ? "null" : bitisSql;
  await db.sql(
    `insert into public.evidences
       (tenant_id, control_id, tip, hash_sha256, mime_type, file_size, classification, retention_class,
        envelope_schema_version, gecerlilik_bitis)
     values ($1, $2, 'dosya', $3, 'application/pdf', 1024, 'gizli', '10y', 'KALKAN_EVIDENCE_ENVELOPE_V1', ${bitis})`,
    [seed.A.tenantId, seed.controlId, "ab".repeat(32)],
  );
}

async function kontrolDurumu(): Promise<string> {
  const { rows } = await db.sql(
    `select durum from public.tenant_controls where tenant_id = $1 and control_id = $2`,
    [seed.A.tenantId, seed.controlId],
  );
  return rows[0].durum as string;
}

async function kanitCalistir(): Promise<number> {
  const { rows } = await db.sql(`select public.kanit_suresi_dolanlari_isle() as n`);
  return Number(rows[0].n);
}

describe("kanit_suresi_dolanlari_isle", () => {
  it("kanıtı dolmuş kontrol 'kismi'ye düşer + Sistem audit'i düşer", async () => {
    await karsilananKontrolKur("current_date - 1");
    expect(await kanitCalistir()).toBe(1);
    expect(await kontrolDurumu()).toBe("kismi");

    const { rows } = await db.sql(
      `select actor_id from public.audit_log where eylem = 'kanit_suresi_doldu'`,
    );
    expect(rows.length).toBe(1);
    expect(rows[0].actor_id).toBeNull(); // Sistem
  });

  it("süresiz (null bitiş) kanıtta kontrol 'karsilaniyor' kalır", async () => {
    await karsilananKontrolKur(null);
    expect(await kanitCalistir()).toBe(0);
    expect(await kontrolDurumu()).toBe("karsilaniyor");
  });

  it("geleceğe dönük kanıtta kontrol düşmez", async () => {
    await karsilananKontrolKur("current_date + 30");
    expect(await kanitCalistir()).toBe(0);
    expect(await kontrolDurumu()).toBe("karsilaniyor");
  });

  it("'acik' kontrol etkilenmez", async () => {
    await db.sql(
      `insert into public.tenant_controls (tenant_id, control_id, durum) values ($1, $2, 'acik')`,
      [seed.A.tenantId, seed.controlId],
    );
    await db.sql(
      `insert into public.evidences
         (tenant_id, control_id, tip, hash_sha256, mime_type, file_size, classification, retention_class,
          envelope_schema_version, gecerlilik_bitis)
       values ($1, $2, 'dosya', $3, 'application/pdf', 1024, 'gizli', '10y', 'KALKAN_EVIDENCE_ENVELOPE_V1', current_date - 1)`,
      [seed.A.tenantId, seed.controlId, "cd".repeat(32)],
    );
    expect(await kanitCalistir()).toBe(0);
    expect(await kontrolDurumu()).toBe("acik");
  });

  it("İDEMPOTENT: ikinci koşu tekrar düşürmez, tekrar audit yazmaz", async () => {
    await karsilananKontrolKur("current_date - 1");
    expect(await kanitCalistir()).toBe(1);
    expect(await kanitCalistir()).toBe(0);
    const { rows } = await db.sql(
      `select count(*)::int as n from public.audit_log where eylem = 'kanit_suresi_doldu'`,
    );
    expect(rows[0].n).toBe(1); // tek kayıt
  });
});
