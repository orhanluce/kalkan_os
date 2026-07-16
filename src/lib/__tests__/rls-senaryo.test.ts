// M7 kabul kriteri: yayınlanmış şablon değiştirilemez; her beklenen aksiyon
// bir kontrole bağlanabiliyor; senaryo içeriğini istemci yazamaz
// (docs/ROADMAP.md M7, CLAUDE.md kural 10 ve 12).
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, seedTwoTenants, type TestDb } from "./helpers/pg";

let db: TestDb;
let seed: Awaited<ReturnType<typeof seedTwoTenants>>;
let templateId: string;
let versionId: string;

beforeEach(async () => {
  db = await createTestDb();
  seed = await seedTwoTenants(db);

  const { rows: t } = await db.sql(
    `insert into public.scenario_templates (kod, ad, tehdit_kategorisi)
     values ('S99', 'Test senaryosu', 'test') returning id`,
  );
  templateId = t[0].id as string;

  const { rows: v } = await db.sql(
    `insert into public.scenario_template_versions (template_id, surum, tahmini_dakika)
     values ($1, 1, 60) returning id`,
    [templateId],
  );
  versionId = v[0].id as string;
});

afterEach(async () => {
  await db.close();
});

async function yayinla() {
  await db.sql(
    `update public.scenario_template_versions set durum = 'yayinlandi', yayinlandi_at = now() where id = $1`,
    [versionId],
  );
}

async function injectEkle(sira = 1) {
  await db.sql(
    `insert into public.scenario_injects (version_id, sira, t_dakika, baslik, icerik)
     values ($1, $2, 0, 'Test', 'Test icerik')`,
    [versionId, sira],
  );
}

describe("senaryo şablonu: yayınlanmış sürüm immutable (kural 10)", () => {
  it("taslak sürüm serbestçe değiştirilebilir", async () => {
    await db.sql(`update public.scenario_template_versions set tahmini_dakika = 90 where id = $1`, [
      versionId,
    ]);
    await injectEkle();

    const { rows } = await db.sql(
      `select tahmini_dakika from public.scenario_template_versions where id = $1`,
      [versionId],
    );
    expect(rows[0].tahmini_dakika).toBe(90);
  });

  it("yayınlanmış sürüm DEĞİŞTİRİLEMEZ", async () => {
    await yayinla();

    await expect(
      db.sql(`update public.scenario_template_versions set tahmini_dakika = 120 where id = $1`, [
        versionId,
      ]),
    ).rejects.toThrow(/degistirilemez|yeni surum/i);
  });

  it("yayınlanmış sürüm SİLİNEMEZ", async () => {
    await yayinla();

    await expect(
      db.sql(`delete from public.scenario_template_versions where id = $1`, [versionId]),
    ).rejects.toThrow(/silinemez/i);
  });

  it("yayınlanmış sürümün İÇERİĞİ de donar", async () => {
    await injectEkle(1);
    await yayinla();

    // Immutability yalnızca sürüm satırında olsaydı, inject'i değiştirerek
    // geçmiş tatbikatın senaryosunu geriye dönük değiştirmek mümkün olurdu.
    await expect(injectEkle(2)).rejects.toThrow(/degistirilemez/i);

    await expect(
      db.sql(`update public.scenario_injects set icerik = 'degistirildi' where version_id = $1`, [
        versionId,
      ]),
    ).rejects.toThrow(/degistirilemez/i);

    await expect(
      db.sql(`delete from public.scenario_injects where version_id = $1`, [versionId]),
    ).rejects.toThrow(/degistirilemez/i);
  });

  it("yayınlanmış sürümün puanlama kuralı da donar", async () => {
    await db.sql(
      `insert into public.scenario_scoring_rules (version_id, kod, tip, bilesen, agirlik, aciklama)
       values ($1, 'K1', 'ACTION_COMPLETED', 'zorunlu_aksiyonlar', 10, 'test')`,
      [versionId],
    );
    await yayinla();

    // Puanlama kuralı sonradan değiştirilebilseydi, geçmiş bir tatbikatın
    // neye göre puanlandığı geriye dönük değişirdi.
    await expect(
      db.sql(`update public.scenario_scoring_rules set agirlik = 99 where version_id = $1`, [
        versionId,
      ]),
    ).rejects.toThrow(/degistirilemez/i);
  });

  it("yayınlanmış sürüm arşive alınabilir (kullanımdan kaldırma)", async () => {
    await yayinla();

    // İçerik donar ama şablonun kullanımdan kaldırılabilmesi gerekir.
    await db.sql(`update public.scenario_template_versions set durum = 'arsiv' where id = $1`, [
      versionId,
    ]);

    const { rows } = await db.sql(
      `select durum from public.scenario_template_versions where id = $1`,
      [versionId],
    );
    expect(rows[0].durum).toBe("arsiv");
  });

  it("yeni sürüm oluşturulabilir; eski sürüm korunur", async () => {
    await injectEkle();
    await yayinla();

    const { rows } = await db.sql(
      `insert into public.scenario_template_versions (template_id, surum, tahmini_dakika)
       values ($1, 2, 45) returning id`,
      [templateId],
    );
    expect(rows[0].id).toBeTruthy();

    // Değişiklik yeni sürüm doğurur, eskisi olduğu gibi durur.
    const { rows: hepsi } = await db.sql(
      `select surum, durum from public.scenario_template_versions where template_id = $1 order by surum`,
      [templateId],
    );
    expect(hepsi).toHaveLength(2);
    expect(hepsi[0]).toMatchObject({ surum: 1, durum: "yayinlandi" });
    expect(hepsi[1]).toMatchObject({ surum: 2, durum: "taslak" });
  });

  it("aynı şablonda aynı sürüm numarası iki kez olamaz", async () => {
    await expect(
      db.sql(
        `insert into public.scenario_template_versions (template_id, surum, tahmini_dakika)
         values ($1, 1, 30)`,
        [templateId],
      ),
    ).rejects.toThrow();
  });
});

describe("senaryo şablonu: içerik yalnızca seed ile yazılır (kural 12)", () => {
  it("kullanıcı senaryo şablonu YAZAMAZ", async () => {
    await expect(
      db.asUser(
        seed.A.userId,
        `insert into public.scenario_templates (kod, ad, tehdit_kategorisi) values ('SAHTE', 'x', 'y')`,
      ),
    ).rejects.toThrow();
  });

  it("kullanıcı puanlama kuralını DEĞİŞTİREMEZ", async () => {
    await db.sql(
      `insert into public.scenario_scoring_rules (version_id, kod, tip, bilesen, agirlik, aciklama)
       values ($1, 'K1', 'ACTION_COMPLETED', 'zorunlu_aksiyonlar', 10, 'test')`,
      [versionId],
    );

    // Kendi puanını yükseltebilseydi, tatbikat sonucu anlamsız olurdu.
    // UPDATE yetkisi tamamen revoke edildiği için sessizce 0 satır değil,
    // doğrudan hata döner — istenen budur.
    await expect(
      db.asUser(seed.A.userId, `update public.scenario_scoring_rules set agirlik = 100`),
    ).rejects.toThrow(/permission denied/i);

    const { rows } = await db.sql(`select agirlik from public.scenario_scoring_rules`);
    expect(Number(rows[0].agirlik)).toBe(10);
  });

  it("kullanıcı şablonu okuyabilir (kütüphane ortak referans veridir)", async () => {
    const { rows } = await db.asUser(seed.A.userId, `select kod from public.scenario_templates`);
    expect(rows.map((r) => r.kod)).toContain("S99");
  });

  it("seed edilen şablon UNVERIFIED_SAMPLE varsayılanıyla gelir", async () => {
    const { rows } = await db.sql(`select icerik_durumu from public.scenario_templates where kod = 'S99'`);
    expect(rows[0].icerik_durumu).toBe("UNVERIFIED_SAMPLE");
  });
});

describe("senaryo şablonu: ana ürüne bağlanma", () => {
  it("beklenen aksiyon bir kontrole bağlanabilir", async () => {
    const { rows: a } = await db.sql(
      `insert into public.scenario_expected_actions (version_id, kod, aciklama, hedef_dakika)
       values ($1, 'A1', 'Test aksiyonu', 15) returning id`,
      [versionId],
    );

    await db.sql(
      `insert into public.scenario_control_mappings (expected_action_id, control_id) values ($1, $2)`,
      [a[0].id, seed.controlId],
    );

    // Bu bağ, simülasyonu ana ürüne bağlayan tek yerdir: olmadan tatbikat
    // kontrol değerlendirmesine dokunmayan bir oyun olurdu.
    const { rows } = await db.sql(
      `select c.madde_ref from public.scenario_control_mappings m
       join public.controls c on c.id = m.control_id
       where m.expected_action_id = $1`,
      [a[0].id],
    );
    expect(rows[0].madde_ref).toBe("TODO-DOGRULA-01");
  });

  it("silinen kontrol, eşlemeyi de götürür (sarkan bağ kalmaz)", async () => {
    const { rows: a } = await db.sql(
      `insert into public.scenario_expected_actions (version_id, kod, aciklama)
       values ($1, 'A2', 'Test') returning id`,
      [versionId],
    );
    await db.sql(
      `insert into public.scenario_control_mappings (expected_action_id, control_id) values ($1, $2)`,
      [a[0].id, seed.controlId],
    );

    await db.sql(`delete from public.controls where id = $1`, [seed.controlId]);

    const { rows } = await db.sql(`select * from public.scenario_control_mappings`);
    expect(rows).toHaveLength(0);
  });

  it("geçersiz puanlama kural türü reddedilir", async () => {
    await expect(
      db.sql(
        `insert into public.scenario_scoring_rules (version_id, kod, tip, bilesen, agirlik, aciklama)
         values ($1, 'K2', 'UYDURMA_KURAL', 'zorunlu_aksiyonlar', 10, 'test')`,
        [versionId],
      ),
    ).rejects.toThrow();
  });

  it("gerekçesiz puanlama kuralı yazılamaz (kural 11)", async () => {
    // Her puan satırı neden verildiğini göstermek zorunda.
    await expect(
      db.sql(
        `insert into public.scenario_scoring_rules (version_id, kod, tip, bilesen, agirlik)
         values ($1, 'K3', 'ACTION_COMPLETED', 'zorunlu_aksiyonlar', 10)`,
        [versionId],
      ),
    ).rejects.toThrow();
  });
});
