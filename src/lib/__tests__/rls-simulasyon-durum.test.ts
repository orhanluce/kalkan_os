// M8: durum makinesi ve zaman hesabı (docs/ROADMAP.md M8, belge §7.3).
//
// Bir tatbikat sonucu denetime sunuluyorsa "oynanmadan puanlandı" veya
// "bittikten sonra gelişme eklendi" mümkün olmamalı. Bu dosya o yolları
// kapatıyor.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, seedTwoTenants, type TestDb } from "./helpers/pg";

let db: TestDb;
let seed: Awaited<ReturnType<typeof seedTwoTenants>>;
let runId: string;
let versionId: string;
let injectId: string;
let decisionPointId: string;

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
  versionId = v[0].id as string;

  const { rows: i } = await db.sql(
    `insert into public.scenario_injects (version_id, sira, t_dakika, baslik, icerik)
     values ($1, 1, 0, 'Gelisme', 'icerik') returning id`,
    [versionId],
  );
  injectId = i[0].id as string;

  const { rows: dp } = await db.sql(
    `insert into public.scenario_decision_points (version_id, inject_id, kod, soru, tip)
     values ($1, $2, 'K1', 'Soru?', 'secim') returning id`,
    [versionId, injectId],
  );
  decisionPointId = dp[0].id as string;

  const { rows: r } = await db.sql(
    `insert into public.simulation_runs (tenant_id, version_id, ad, mod)
     values ($1, $2, 'Test', 'canli') returning id`,
    [seed.A.tenantId, versionId],
  );
  runId = r[0].id as string;

  await db.sql(
    `insert into public.simulation_participants (run_id, tenant_id, user_id, senaryo_rolu, katilim_tipi)
     values ($1, $2, $3, 'yonetici', 'yonetici')`,
    [runId, seed.A.tenantId, seed.A.userId],
  );
});

afterEach(async () => {
  await db.close();
});

async function durumaGec(durum: string) {
  await db.sql(`update public.simulation_runs set durum = $1 where id = $2`, [durum, runId]);
}

async function durumOku(): Promise<Record<string, unknown>> {
  const { rows } = await db.sql(
    `select durum, basladi_at, bitti_at, duraklatilan_saniye, duraklatildi_at
     from public.simulation_runs where id = $1`,
    [runId],
  );
  return rows[0];
}

describe("simülasyon durum makinesi", () => {
  it("geçerli akış baştan sona çalışır", async () => {
    for (const d of ["hazir", "calisiyor", "tamamlandi", "puanlaniyor", "incelendi", "kapandi"]) {
      await durumaGec(d);
    }
    expect((await durumOku()).durum).toBe("kapandi");
  });

  it("oynanmadan puanlamaya geçilemez", async () => {
    // Bir tatbikat sonucu denetime sunuluyorsa bu yol kapalı olmalı.
    await expect(durumaGec("puanlaniyor")).rejects.toThrow(/Gecersiz durum gecisi/i);
  });

  it("taslaktan doğrudan kapanamaz", async () => {
    await expect(durumaGec("kapandi")).rejects.toThrow(/Gecersiz durum gecisi/i);
  });

  it("kapanmış tatbikat yeniden açılamaz", async () => {
    for (const d of ["hazir", "calisiyor", "tamamlandi", "puanlaniyor", "incelendi", "kapandi"]) {
      await durumaGec(d);
    }
    // Denetime sunulmuş bir sonucu değiştirmek olurdu.
    await expect(durumaGec("calisiyor")).rejects.toThrow(/Gecersiz durum gecisi/i);
  });

  it("iptal edilmiş tatbikat yeniden başlatılamaz", async () => {
    await durumaGec("hazir");
    await durumaGec("calisiyor");
    await durumaGec("iptal");
    await expect(durumaGec("calisiyor")).rejects.toThrow(/Gecersiz durum gecisi/i);
  });

  it("çalışan tatbikat duraklatılıp devam ettirilebilir", async () => {
    await durumaGec("hazir");
    await durumaGec("calisiyor");
    await durumaGec("duraklatildi");
    await durumaGec("calisiyor");
    expect((await durumOku()).durum).toBe("calisiyor");
  });
});

describe("simülasyon zaman hesabı", () => {
  it("başlatınca basladi_at yazılır", async () => {
    await durumaGec("hazir");
    expect((await durumOku()).basladi_at).toBeNull();

    await durumaGec("calisiyor");
    expect((await durumOku()).basladi_at).not.toBeNull();
  });

  it("duraklatılan süre birikir ve devam edince yazılır", async () => {
    await durumaGec("hazir");
    await durumaGec("calisiyor");
    await durumaGec("duraklatildi");

    // Duraklatma anını geriye al: 30 saniye duraklatılmış gibi.
    await db.sql(
      `update public.simulation_runs set duraklatildi_at = now() - interval '30 seconds' where id = $1`,
      [runId],
    );
    await durumaGec("calisiyor");

    const sonra = await durumOku();
    // Duraklatılan süre katılımcının yanıt süresine yazılmamalı.
    expect(Number(sonra.duraklatilan_saniye)).toBeGreaterThanOrEqual(29);
    expect(sonra.duraklatildi_at).toBeNull();
  });

  it("iki kez duraklatılırsa süreler toplanır", async () => {
    await durumaGec("hazir");
    await durumaGec("calisiyor");

    for (const saniye of [20, 10]) {
      await durumaGec("duraklatildi");
      await db.sql(
        `update public.simulation_runs set duraklatildi_at = now() - make_interval(secs => $2) where id = $1`,
        [runId, saniye],
      );
      await durumaGec("calisiyor");
    }

    expect(Number((await durumOku()).duraklatilan_saniye)).toBeGreaterThanOrEqual(29);
  });

  it("tamamlanınca bitti_at yazılır", async () => {
    await durumaGec("hazir");
    await durumaGec("calisiyor");
    await durumaGec("tamamlandi");
    expect((await durumOku()).bitti_at).not.toBeNull();
  });
});

describe("simülasyon: gelişme yayınlama sınırları", () => {
  async function yayinla(hedefRunId = runId, hedefInjectId = injectId) {
    await db.sql(
      `insert into public.simulation_inject_deliveries (run_id, tenant_id, inject_id, yayinlayan)
       values ($1, $2, $3, $4)`,
      [hedefRunId, seed.A.tenantId, hedefInjectId, seed.A.userId],
    );
  }

  it("başlamamış tatbikatta gelişme yayınlanamaz", async () => {
    await expect(yayinla()).rejects.toThrow(/calisan tatbikatta/i);
  });

  it("çalışan tatbikatta yayınlanabilir", async () => {
    await durumaGec("hazir");
    await durumaGec("calisiyor");
    await yayinla();

    const { rows } = await db.sql(`select * from public.simulation_inject_deliveries`);
    expect(rows).toHaveLength(1);
  });

  it("tamamlanmış tatbikata gelişme eklenemez", async () => {
    await durumaGec("hazir");
    await durumaGec("calisiyor");
    await durumaGec("tamamlandi");

    // Zaman çizelgesini geriye dönük değiştirmek, puanlamayı da değiştirirdi.
    await expect(yayinla()).rejects.toThrow(/calisan tatbikatta/i);
  });

  it("başka senaryonun gelişmesi bu tatbikata sokulamaz", async () => {
    const { rows: t2 } = await db.sql(
      `insert into public.scenario_templates (kod, ad, tehdit_kategorisi)
       values ('S98', 'Baska', 'test') returning id`,
    );
    const { rows: v2 } = await db.sql(
      `insert into public.scenario_template_versions (template_id, surum, tahmini_dakika)
       values ($1, 1, 30) returning id`,
      [t2[0].id],
    );
    const { rows: i2 } = await db.sql(
      `insert into public.scenario_injects (version_id, sira, t_dakika, baslik, icerik)
       values ($1, 1, 0, 'Yabanci', 'icerik') returning id`,
      [v2[0].id],
    );

    await durumaGec("hazir");
    await durumaGec("calisiyor");
    await expect(yayinla(runId, i2[0].id as string)).rejects.toThrow(/senaryo surumune ait degil/i);
  });
});

describe("simülasyon: karar verme sınırları", () => {
  async function kararVer() {
    await db.sql(
      `insert into public.simulation_decisions (run_id, tenant_id, decision_point_id, katilimci_id, cevap, senaryo_dakika)
       values ($1, $2, $3, $4, 'Evet', 5)`,
      [runId, seed.A.tenantId, decisionPointId, seed.A.userId],
    );
  }

  it("yayınlanmamış gelişmenin kararı verilemez", async () => {
    await durumaGec("hazir");
    await durumaGec("calisiyor");

    // Kararı verebilen katılımcı, senaryoyu önceden biliyor demektir.
    await expect(kararVer()).rejects.toThrow(/henuz yayinlanmadi/i);
  });

  it("gelişme yayınlandıktan sonra karar verilebilir", async () => {
    await durumaGec("hazir");
    await durumaGec("calisiyor");
    await db.sql(
      `insert into public.simulation_inject_deliveries (run_id, tenant_id, inject_id, yayinlayan)
       values ($1, $2, $3, $4)`,
      [runId, seed.A.tenantId, injectId, seed.A.userId],
    );

    await kararVer();
    const { rows } = await db.sql(`select cevap from public.simulation_decisions`);
    expect(rows[0].cevap).toBe("Evet");
  });

  it("tamamlanmış tatbikatta karar verilemez", async () => {
    await durumaGec("hazir");
    await durumaGec("calisiyor");
    await db.sql(
      `insert into public.simulation_inject_deliveries (run_id, tenant_id, inject_id, yayinlayan)
       values ($1, $2, $3, $4)`,
      [runId, seed.A.tenantId, injectId, seed.A.userId],
    );
    await durumaGec("tamamlandi");

    await expect(kararVer()).rejects.toThrow(/calisan tatbikatta/i);
  });
});

describe("simülasyon puanı", () => {
  it("kullanıcı puan YAZAMAZ (sistem hesaplar)", async () => {
    await expect(
      db.asUser(
        seed.A.userId,
        `insert into public.simulation_scores (run_id, tenant_id, puan, durum, satirlar)
         values ($1, $2, 100, 'BASARILI', '[]'::jsonb)`,
        [runId, seed.A.tenantId],
      ),
    ).rejects.toThrow();
  });

  it("tatbikat başına tek puan satırı olur", async () => {
    await db.sql(
      `insert into public.simulation_scores (run_id, tenant_id, puan, durum, satirlar)
       values ($1, $2, 80, 'BASARILI', '[]'::jsonb)`,
      [runId, seed.A.tenantId],
    );

    // Puanlama deterministik: "ikinci puanlama" diye bir kavram yok.
    await expect(
      db.sql(
        `insert into public.simulation_scores (run_id, tenant_id, puan, durum, satirlar)
         values ($1, $2, 90, 'BASARILI', '[]'::jsonb)`,
        [runId, seed.A.tenantId],
      ),
    ).rejects.toThrow();
  });

  it("geçersiz puan reddedilir", async () => {
    await expect(
      db.sql(
        `insert into public.simulation_scores (run_id, tenant_id, puan, durum, satirlar)
         values ($1, $2, 150, 'BASARILI', '[]'::jsonb)`,
        [runId, seed.A.tenantId],
      ),
    ).rejects.toThrow();
  });

  it("başka kiracı puanı göremez", async () => {
    await db.sql(
      `insert into public.simulation_scores (run_id, tenant_id, puan, durum, satirlar)
       values ($1, $2, 80, 'BASARILI', '[]'::jsonb)`,
      [runId, seed.A.tenantId],
    );

    const { rows } = await db.asUser(seed.B.userId, `select * from public.simulation_scores`);
    expect(rows).toHaveLength(0);
  });
});
