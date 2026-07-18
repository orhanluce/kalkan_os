// V2 PR-3a (ADR-V2-4): tedarikçi IBAN değişikliği doğrulama — maker-checker,
// kimlik atfı, tenant izolasyonu, TAM IBAN saklanmaz. PGlite + gerçek migration.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, seedTwoTenants, type TestDb } from "./helpers/pg";

let db: TestDb;
let seed: Awaited<ReturnType<typeof seedTwoTenants>>;
const CHECKER = "a0000000-0000-0000-0000-000000000004";
const H = (c: string) => c.repeat(64);

/**
 * Servis (rota) bağlamı: gerçek karar rotası service_role admin client'ıyla
 * yazar; onun auth.uid()'i NULL'dur. PGlite tek bağlantı olduğu ve withRole
 * jwt claim'ini (is_local=false) session'da bıraktığı için, önceki asUser'dan
 * sızan claim db.sql'de auth.uid()'i kirletir — burada temizleyip service
 * bağlamını doğru modelliyoruz.
 */
async function servisKarar(id: string, dogrulayan: string, durum: string) {
  await db.sql(`select set_config('request.jwt.claim.sub', '', false)`);
  await db.sql(
    `update public.supplier_bank_change_verifications
     set durum = $3, dogrulayan = $2, dogrulandi_at = now(), dogrulama_notu = 'not' where id = $1`,
    [id, dogrulayan, durum],
  );
}

async function talepAc(tenantId: string, talepEden: string): Promise<string> {
  const { rows } = await db.asUser(
    talepEden,
    `insert into public.supplier_bank_change_verifications
       (tenant_id, tedarikci_ad, yeni_iban_maskeli, yeni_iban_hash, out_of_band_kanal, talep_eden)
     values ($1, 'Acme A.Ş.', 'TR33 **** **26', $2, 'bilinen yetkiliyle telefon', $3) returning id`,
    [tenantId, H("a"), talepEden],
  );
  return rows[0].id as string;
}

beforeEach(async () => {
  db = await createTestDb();
  seed = await seedTwoTenants(db);
  await db.sql(`insert into auth.users (id, email) values ($1, 'checker4@demo.com')`, [CHECKER]);
  await db.sql(
    `insert into public.profiles (id, tenant_id, role, full_name) values ($1, $2, 'uyum', 'Checker4')`,
    [CHECKER, seed.A.tenantId],
  );
});

afterEach(async () => {
  await db.close();
});

describe("IBAN değişikliği — talep + veri minimizasyonu", () => {
  it("talep oturum sahibi adına açılır; maskeli+hash saklanır (tam IBAN kolonu YOK)", async () => {
    const id = await talepAc(seed.A.tenantId, seed.A.userId);
    const { rows } = await db.sql(
      `select yeni_iban_maskeli, yeni_iban_hash, durum from public.supplier_bank_change_verifications where id = $1`,
      [id],
    );
    expect(rows[0].durum).toBe("TALEP_EDILDI");
    expect(rows[0].yeni_iban_maskeli).toContain("*");
    expect(rows[0].yeni_iban_hash).toMatch(/^[0-9a-f]{64}$/);
    // Şemada tam-IBAN kolonu olmadığını doğrula (yanlışlıkla saklanamaz).
    const { rows: kolon } = await db.sql(
      `select column_name from information_schema.columns
       where table_name = 'supplier_bank_change_verifications' and column_name ilike '%iban%'`,
    );
    const adlar = kolon.map((k) => k.column_name);
    expect(adlar).toContain("yeni_iban_maskeli");
    expect(adlar).toContain("yeni_iban_hash");
    expect(adlar).not.toContain("yeni_iban"); // tam değer kolonu yok
  });

  it("maskesiz (yıldızsız) yeni IBAN reddedilir (check — tam IBAN kaçağı önlenir)", async () => {
    await expect(
      db.asUser(
        seed.A.userId,
        `insert into public.supplier_bank_change_verifications
           (tenant_id, tedarikci_ad, yeni_iban_maskeli, yeni_iban_hash, out_of_band_kanal, talep_eden)
         values ($1, 'X', 'TR330006100519786457841326', $2, 'telefon', $3)`,
        [seed.A.tenantId, H("a"), seed.A.userId],
      ),
    ).rejects.toThrow();
  });

  it("talep BAŞKASI adına açılamaz (talep_eden = auth.uid)", async () => {
    await expect(
      db.asUser(
        seed.A.userId,
        `insert into public.supplier_bank_change_verifications
           (tenant_id, tedarikci_ad, yeni_iban_maskeli, yeni_iban_hash, out_of_band_kanal, talep_eden)
         values ($1, 'X', 'TR** **26', $2, 'telefon', $3)`,
        [seed.A.tenantId, H("a"), CHECKER],
      ),
    ).rejects.toThrow();
  });

  it("denetçi-misafir talep açamaz (rol RLS)", async () => {
    const misafir = "a0000000-0000-0000-0000-000000000005";
    await db.sql(`insert into auth.users (id, email) values ($1, 'm5@demo.com')`, [misafir]);
    await db.sql(
      `insert into public.profiles (id, tenant_id, role, full_name) values ($1, $2, 'denetci_misafir', 'M5')`,
      [misafir, seed.A.tenantId],
    );
    await expect(talepAc(seed.A.tenantId, misafir)).rejects.toThrow();
  });
});

describe("IBAN değişikliği — maker-checker doğrulama", () => {
  it("talep eden kendi değişikliğini doğrulayamaz (guard)", async () => {
    const id = await talepAc(seed.A.tenantId, seed.A.userId);
    await expect(servisKarar(id, seed.A.userId, "DOGRULANDI")).rejects.toThrow(
      /maker-checker|kendi IBAN/,
    );
  });

  it("farklı yetkili doğrular; sonra karar donar (ikinci kez değişmez)", async () => {
    const id = await talepAc(seed.A.tenantId, seed.A.userId);
    // Karar service_role ile (rota deseni — istemci UPDATE revoke'lu).
    await servisKarar(id, CHECKER, "DOGRULANDI");
    const { rows } = await db.sql(
      `select durum, dogrulayan from public.supplier_bank_change_verifications where id = $1`,
      [id],
    );
    expect(rows[0].durum).toBe("DOGRULANDI");
    expect(rows[0].dogrulayan).toBe(CHECKER);
    // Karar donuk.
    await expect(
      db.sql(`update public.supplier_bank_change_verifications set durum = 'REDDEDILDI' where id = $1`, [id]),
    ).rejects.toThrow(/degistirilemez/);
    // Audit kararı doğrulayana atfedildi.
    const { rows: audit } = await db.sql(
      `select actor_id from public.audit_log where eylem = 'iban_degisiklik_karari' and hedef_id = $1`,
      [id],
    );
    expect(audit[0].actor_id).toBe(CHECKER);
  });

  it("kimlik atfı sahtelenemez: A, 'CHECKER doğruladı' diyemez", async () => {
    const id = await talepAc(seed.A.tenantId, seed.A.userId);
    await expect(
      db.asUser(
        seed.A.userId,
        `update public.supplier_bank_change_verifications set durum = 'DOGRULANDI', dogrulayan = $2 where id = $1`,
        [id, CHECKER],
      ),
    ).rejects.toThrow();
  });
});

describe("IBAN değişikliği — tenant izolasyonu", () => {
  it("B kiracısı A'nın kaydını göremez/güncelleyemez", async () => {
    const id = await talepAc(seed.A.tenantId, seed.A.userId);
    const { rows } = await db.asUser(
      seed.B.userId,
      `select id from public.supplier_bank_change_verifications where id = $1`,
      [id],
    );
    expect(rows).toHaveLength(0);
    await expect(
      db.asUser(
        seed.B.userId,
        `update public.supplier_bank_change_verifications set durum = 'DOGRULANDI', dogrulayan = $2 where id = $1`,
        [id, seed.B.userId],
      ),
    ).rejects.toThrow();
  });
});
