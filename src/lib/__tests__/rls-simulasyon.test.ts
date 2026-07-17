// M8 kabul kriteri: "katılımcı başka rolün gizli inject'ini SORGUYLA DA
// göremez; aynı inject iki kez yayınlanmaz" (docs/ROADMAP.md M8).
//
// Rol bazlı gizlilik bir UI filtresi değil RLS kuralıdır: istemcide
// filtrelenseydi, ağ sekmesini açan katılımcı diğer rollerin gizli
// gelişmelerini okur ve tatbikat anlamsızlaşırdı. Bu dosya tam da o sorguyu
// atarak sınar.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, seedTwoTenants, type TestDb } from "./helpers/pg";

let db: TestDb;
let seed: Awaited<ReturnType<typeof seedTwoTenants>>;
let runId: string;
let versionId: string;
let acikInjectId: string;
let gizliInjectId: string;

/** A kiracısında ikinci kullanıcı: farklı senaryo rolü oynayacak. */
const A_IKINCI = "a0000000-0000-0000-0000-000000000002";
/** A kiracısında üçüncü kullanıcı: gözlemci. */
const A_GOZLEMCI = "a0000000-0000-0000-0000-000000000003";

beforeEach(async () => {
  db = await createTestDb();
  seed = await seedTwoTenants(db);

  for (const [id, ad] of [
    [A_IKINCI, "A Ikinci"],
    [A_GOZLEMCI, "A Gozlemci"],
  ] as const) {
    await db.sql(`insert into auth.users (id, email) values ($1, $2)`, [id, `${id}@demo.com`]);
    await db.sql(
      `insert into public.profiles (id, tenant_id, role, full_name) values ($1, $2, 'uyum', $3)`,
      [id, seed.A.tenantId, ad],
    );
  }

  const { rows: t } = await db.sql(
    `insert into public.scenario_templates (kod, ad, tehdit_kategorisi)
     values ('S99', 'Test', 'test') returning id`,
  );
  const { rows: v } = await db.sql(
    `insert into public.scenario_template_versions (template_id, surum, tahmini_dakika)
     values ($1, 1, 60) returning id`,
    [t[0].id],
  );
  versionId = v[0].id as string;

  // Herkese açık gelişme (gorunur_roller boş).
  const { rows: i1 } = await db.sql(
    `insert into public.scenario_injects (version_id, sira, t_dakika, baslik, icerik)
     values ($1, 1, 0, 'Acik gelisme', 'Herkes gorur') returning id`,
    [versionId],
  );
  acikInjectId = i1[0].id as string;

  // Yalnızca uyum_hukuk rolüne açık gizli gelişme.
  const { rows: i2 } = await db.sql(
    `insert into public.scenario_injects (version_id, sira, t_dakika, baslik, icerik, gorunur_roller)
     values ($1, 2, 20, 'Gizli gelisme', 'GIZLI ICERIK', array['uyum_hukuk']) returning id`,
    [versionId],
  );
  gizliInjectId = i2[0].id as string;

  const { rows: r } = await db.sql(
    `insert into public.simulation_runs (tenant_id, version_id, ad, mod)
     values ($1, $2, 'Test tatbikati', 'canli') returning id`,
    [seed.A.tenantId, versionId],
  );
  runId = r[0].id as string;

  // A.userId: yönetici. A_IKINCI: soc rolünde katılımcı (gizliyi görmemeli).
  // A_GOZLEMCI: gözlemci (her şeyi görür).
  await db.sql(
    `insert into public.simulation_participants (run_id, tenant_id, user_id, senaryo_rolu, katilim_tipi)
     values ($1, $2, $3, 'yonetici', 'yonetici'),
            ($1, $2, $4, 'soc_bt_operasyon', 'katilimci'),
            ($1, $2, $5, 'gozlemci', 'gozlemci')`,
    [runId, seed.A.tenantId, seed.A.userId, A_IKINCI, A_GOZLEMCI],
  );

  // Tatbikatı çalışır duruma getir: durum makinesi (20260717130000) artık
  // başlamamış tatbikatta gelişme yayınlanmasını ve karar verilmesini
  // engelliyor. Bu dosya görünürlük kurallarını sınıyor, durum makinesini
  // değil — o rls-simulasyon-durum.test.ts'in işi.
  await db.sql(`update public.simulation_runs set durum = 'hazir' where id = $1`, [runId]);
  await db.sql(`update public.simulation_runs set durum = 'calisiyor' where id = $1`, [runId]);
});

afterEach(async () => {
  await db.close();
});

async function yayinla(injectId: string, yayinlayan = seed.A.userId) {
  await db.asUser(
    yayinlayan,
    `insert into public.simulation_inject_deliveries (run_id, tenant_id, inject_id, yayinlayan)
     values ($1, $2, $3, $4)`,
    [runId, seed.A.tenantId, injectId, yayinlayan],
  );
}

async function gorunenInjectler(userId: string): Promise<string[]> {
  const { rows } = await db.asUser(
    userId,
    `select si.baslik from public.simulation_inject_deliveries d
     join public.scenario_injects si on si.id = d.inject_id
     where d.run_id = $1`,
    [runId],
  );
  return rows.map((r) => String(r.baslik));
}

describe("simülasyon: rol bazlı inject görünürlüğü", () => {
  it("herkese açık gelişmeyi tüm katılımcılar görür", async () => {
    await yayinla(acikInjectId);
    expect(await gorunenInjectler(A_IKINCI)).toContain("Acik gelisme");
  });

  it("katılımcı BAŞKA rolün gizli gelişmesini SORGUYLA DA göremez", async () => {
    await yayinla(gizliInjectId);

    // A_IKINCI 'soc_bt_operasyon' rolünde; gizli gelişme 'uyum_hukuk'a açık.
    expect(await gorunenInjectler(A_IKINCI)).toEqual([]);
  });

  it("kendi rolüne açık gizli gelişmeyi görür", async () => {
    await db.sql(
      `update public.simulation_participants set senaryo_rolu = 'uyum_hukuk'
       where run_id = $1 and user_id = $2`,
      [runId, A_IKINCI],
    );
    await yayinla(gizliInjectId);

    expect(await gorunenInjectler(A_IKINCI)).toContain("Gizli gelisme");
  });

  it("tatbikat yöneticisi her gelişmeyi görür", async () => {
    await yayinla(acikInjectId);
    await yayinla(gizliInjectId);

    // Yönetici zaten senaryoyu yayınlayan taraftır.
    expect(await gorunenInjectler(seed.A.userId)).toHaveLength(2);
  });

  it("gözlemci her gelişmeyi görür", async () => {
    await yayinla(gizliInjectId);
    expect(await gorunenInjectler(A_GOZLEMCI)).toContain("Gizli gelisme");
  });

  it("YAYINLANMAMIŞ gelişme hiç kimseye görünmez", async () => {
    // Zaman çizelgesini önceden görebilen katılımcı tatbikatı anlamsızlaştırır.
    expect(await gorunenInjectler(seed.A.userId)).toEqual([]);
    expect(await gorunenInjectler(A_IKINCI)).toEqual([]);
  });

  it("başka kiracının kullanıcısı tatbikatı göremez", async () => {
    await yayinla(acikInjectId);
    expect(await gorunenInjectler(seed.B.userId)).toEqual([]);

    const { rows } = await db.asUser(seed.B.userId, `select * from public.simulation_runs`);
    expect(rows).toHaveLength(0);
  });
});

describe("simülasyon: inject yayınlama", () => {
  it("aynı inject iki kez yayınlanamaz (idempotency şemada)", async () => {
    await yayinla(acikInjectId);
    await expect(yayinla(acikInjectId)).rejects.toThrow();
  });

  it("katılımcı gelişme YAYINLAYAMAZ (yalnızca yönetici)", async () => {
    await expect(yayinla(acikInjectId, A_IKINCI)).rejects.toThrow();
  });

  it("yayınlanmış gelişme geri alınamaz (append-only)", async () => {
    await yayinla(acikInjectId);

    await expect(
      db.asUser(seed.A.userId, `delete from public.simulation_inject_deliveries where run_id = $1`, [
        runId,
      ]),
    ).rejects.toThrow();
  });
});

describe("simülasyon: kararlar", () => {
  async function kararNoktasiOlustur(): Promise<string> {
    const { rows } = await db.sql(
      `insert into public.scenario_decision_points (version_id, kod, soru, tip)
       values ($1, 'K1', 'Test sorusu?', 'secim') returning id`,
      [versionId],
    );
    return rows[0].id as string;
  }

  it("katılımcı kendi adına karar verebilir", async () => {
    const dpId = await kararNoktasiOlustur();

    await db.asUser(
      A_IKINCI,
      `insert into public.simulation_decisions (run_id, tenant_id, decision_point_id, katilimci_id, cevap, senaryo_dakika)
       values ($1, $2, $3, $4, 'Evet', 12)`,
      [runId, seed.A.tenantId, dpId, A_IKINCI],
    );

    const { rows } = await db.asUser(A_IKINCI, `select cevap from public.simulation_decisions`);
    expect(rows[0].cevap).toBe("Evet");
  });

  it("katılımcı BAŞKASI adına karar veremez", async () => {
    const dpId = await kararNoktasiOlustur();

    // Başkasının adına karar yazılabilseydi tatbikat sonucu ve puanlaması
    // anlamsız olurdu.
    await expect(
      db.asUser(
        A_IKINCI,
        `insert into public.simulation_decisions (run_id, tenant_id, decision_point_id, katilimci_id, cevap, senaryo_dakika)
         values ($1, $2, $3, $4, 'Evet', 12)`,
        [runId, seed.A.tenantId, dpId, seed.A.userId],
      ),
    ).rejects.toThrow();
  });

  it("verilmiş karar değiştirilemez veya silinemez", async () => {
    const dpId = await kararNoktasiOlustur();
    await db.asUser(
      A_IKINCI,
      `insert into public.simulation_decisions (run_id, tenant_id, decision_point_id, katilimci_id, cevap, senaryo_dakika)
       values ($1, $2, $3, $4, 'Hayir', 12)`,
      [runId, seed.A.tenantId, dpId, A_IKINCI],
    );

    // Kararını sonradan düzeltebilen katılımcı, tatbikatın ölçtüğü şeyi
    // ortadan kaldırır.
    await expect(
      db.asUser(A_IKINCI, `update public.simulation_decisions set cevap = 'Evet'`),
    ).rejects.toThrow();
    await expect(
      db.asUser(A_IKINCI, `delete from public.simulation_decisions`),
    ).rejects.toThrow();
  });
});

describe("simülasyon: gözlem notları", () => {
  it("gizli gözlem notunu katılımcı göremez", async () => {
    await db.asUser(
      A_GOZLEMCI,
      `insert into public.simulation_observations (run_id, tenant_id, gozlemci_id, not_metni, katilimcilara_acik)
       values ($1, $2, $3, 'Gizli degerlendirme', false)`,
      [runId, seed.A.tenantId, A_GOZLEMCI],
    );

    const { rows } = await db.asUser(A_IKINCI, `select not_metni from public.simulation_observations`);
    expect(rows).toHaveLength(0);
  });

  it("katılımcılara açık not görünür", async () => {
    await db.asUser(
      A_GOZLEMCI,
      `insert into public.simulation_observations (run_id, tenant_id, gozlemci_id, not_metni, katilimcilara_acik)
       values ($1, $2, $3, 'Acik geri bildirim', true)`,
      [runId, seed.A.tenantId, A_GOZLEMCI],
    );

    const { rows } = await db.asUser(A_IKINCI, `select not_metni from public.simulation_observations`);
    expect(rows[0].not_metni).toBe("Acik geri bildirim");
  });

  it("katılımcı gözlem notu YAZAMAZ", async () => {
    await expect(
      db.asUser(
        A_IKINCI,
        `insert into public.simulation_observations (run_id, tenant_id, gozlemci_id, not_metni)
         values ($1, $2, $3, 'Sahte not')`,
        [runId, seed.A.tenantId, A_IKINCI],
      ),
    ).rejects.toThrow();
  });
});

describe("simülasyon: bulgu önerileri (kural 11)", () => {
  it("kullanıcı bulgu önerisi YAZAMAZ (öneriyi sistem üretir)", async () => {
    // Kullanıcı kendi önerisini yazabilseydi "sistem tespit etti" iddiası
    // anlamını yitirirdi.
    await expect(
      db.asUser(
        seed.A.userId,
        `insert into public.simulation_finding_proposals (run_id, tenant_id, baslik, gerekce, onem)
         values ($1, $2, 'Sahte', 'Sahte', 'kritik')`,
        [runId, seed.A.tenantId],
      ),
    ).rejects.toThrow();
  });

  it("öneri PROPOSED durumunda doğar", async () => {
    await db.sql(
      `insert into public.simulation_finding_proposals (run_id, tenant_id, control_id, baslik, gerekce, onem)
       values ($1, $2, $3, 'Eskalasyon gecikti', '42 dakika, hedef 15', 'yuksek')`,
      [runId, seed.A.tenantId, seed.controlId],
    );

    const { rows } = await db.asUser(
      seed.A.userId,
      `select durum, finding_id from public.simulation_finding_proposals`,
    );
    expect(rows[0].durum).toBe("PROPOSED");
    // Onaylanmadan gerçek bulgu oluşmaz.
    expect(rows[0].finding_id).toBeNull();
  });

  it("başka kiracı öneriyi göremez", async () => {
    await db.sql(
      `insert into public.simulation_finding_proposals (run_id, tenant_id, baslik, gerekce, onem)
       values ($1, $2, 'Test', 'Test', 'orta')`,
      [runId, seed.A.tenantId],
    );

    const { rows } = await db.asUser(seed.B.userId, `select * from public.simulation_finding_proposals`);
    expect(rows).toHaveLength(0);
  });
});

describe("simülasyon: run şeması", () => {
  it("şablon sürümü silinemez (geçmiş tatbikat korunur)", async () => {
    // on delete restrict: bir run'a bağlı sürüm silinirse geçmiş tatbikat
    // neye göre oynandığını kaybederdi.
    await expect(
      db.sql(`delete from public.scenario_template_versions where id = $1`, [versionId]),
    ).rejects.toThrow();
  });

  it("geçersiz mod reddedilir", async () => {
    await expect(
      db.sql(
        `insert into public.simulation_runs (tenant_id, version_id, ad, mod)
         values ($1, $2, 'Test', 'uydurma_mod')`,
        [seed.A.tenantId, versionId],
      ),
    ).rejects.toThrow();
  });

  it("zaman ölçeği pozitif olmalı", async () => {
    await expect(
      db.sql(
        `insert into public.simulation_runs (tenant_id, version_id, ad, mod, zaman_olcegi)
         values ($1, $2, 'Test', 'hizlandirilmis', 0)`,
        [seed.A.tenantId, versionId],
      ),
    ).rejects.toThrow();
  });
});
