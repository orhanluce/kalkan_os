// Dikey D, ilk dilim (20260720200000/210000): impact_graph_snapshots —
// immutable (service_role dahil), cross-tenant guard, Proof Room üçüncü dal.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, seedTwoTenants, type TestDb } from "./helpers/pg";

let db: TestDb;
let seed: Awaited<ReturnType<typeof seedTwoTenants>>;

function bosGraf() {
  return { dugumler: [], kenarlar: [] };
}
function bosSpof() {
  return { sistemikNoktalar: [], hesaplamaYontemi: "test" };
}
function bosYayilim() {
  return { baslangicDugumIdleri: [], yon: "ileri", etkilenenler: [], hesaplamaYontemi: "test" };
}

async function snapshotEkle(tenantId: string, extra: Record<string, unknown> = {}) {
  const { rows } = await db.sql(
    `insert into public.impact_graph_snapshots (tenant_id, graf, graf_hash, spof_raporu, yayilim_raporu, hesaplama_yontemi, iliskili_roi_export_run_id)
     values ($1, $2::jsonb, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7) returning id`,
    [
      tenantId,
      JSON.stringify(extra.graf ?? bosGraf()),
      extra.graf_hash ?? "a".repeat(64),
      JSON.stringify(extra.spof_raporu ?? bosSpof()),
      JSON.stringify(extra.yayilim_raporu ?? bosYayilim()),
      JSON.stringify(extra.hesaplama_yontemi ?? { motor: "impact-graph-v1" }),
      extra.iliskili_roi_export_run_id ?? null,
    ],
  );
  return rows[0].id as string;
}

async function exportEkle(tenantId: string, extra: Record<string, unknown> = {}) {
  const { rows } = await db.sql(
    `insert into public.roi_export_runs (tenant_id, talep_eden, paket, paket_hash, on_kontrol_raporu, engelleyici_sorun_sayisi, durum)
     values ($1, $2, $3::jsonb, $4, $5::jsonb, $6, coalesce($7, 'TASLAK')) returning id`,
    [
      tenantId,
      extra.talep_eden ?? seed.A.userId,
      JSON.stringify({ schema: "KALKAN_ROI_EXPORT_V1" }),
      "b".repeat(64),
      JSON.stringify({ sorunlar: [], engelleyiciSayisi: 0 }),
      0,
      extra.durum ?? null,
    ],
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

describe("impact_graph_snapshots — immutable (append-only)", () => {
  it("hiçbir alan UPDATE ile değiştirilemez (service_role dahil, RLS bypass'lı test helper)", async () => {
    const id = await snapshotEkle(seed.A.tenantId);
    await expect(
      db.sql(`update public.impact_graph_snapshots set graf_hash = $2 where id = $1`, [id, "c".repeat(64)]),
    ).rejects.toThrow(/degistirilemez/i);
  });

  it("kimlik atfı: olusturan istemci bağlamında oturum sahibine sabitlenir", async () => {
    const { rows } = await db.asUser(
      seed.A.userId,
      `insert into public.impact_graph_snapshots (tenant_id, graf, graf_hash, spof_raporu, yayilim_raporu, hesaplama_yontemi)
       values ($1, $2::jsonb, $3, $4::jsonb, $5::jsonb, $6::jsonb) returning olusturan`,
      [seed.A.tenantId, JSON.stringify(bosGraf()), "d".repeat(64), JSON.stringify(bosSpof()), JSON.stringify(bosYayilim()), JSON.stringify({})],
    );
    expect(rows[0].olusturan).toBe(seed.A.userId);
  });

  it("oluşturma audit_log'a düşer, sistemik nokta sayısını taşır", async () => {
    const id = await snapshotEkle(seed.A.tenantId, {
      spof_raporu: { sistemikNoktalar: [{ dugumId: "x", tur: "UCUNCU_TARAF", etiket: "x", etkilenenKritikHizmetIdleri: ["a", "b"] }], hesaplamaYontemi: "t" },
    });
    const { rows } = await db.sql(`select detay from public.audit_log where eylem = 'etki_grafi_anlik_goruntu_olusturuldu' and hedef_id = $1`, [id]);
    expect(rows).toHaveLength(1);
    const detay = rows[0].detay as { sistemik_nokta_sayisi: number };
    expect(detay.sistemik_nokta_sayisi).toBe(1);
  });
});

describe("impact_graph_snapshots — cross-tenant guard (iliskili_roi_export_run_id)", () => {
  it("başka kiracının export'una bağlanamaz", async () => {
    const bExportId = await exportEkle(seed.B.tenantId);
    await expect(snapshotEkle(seed.A.tenantId, { iliskili_roi_export_run_id: bExportId })).rejects.toThrow(/cross-tenant/i);
  });

  it("aynı kiracının export'una bağlanabilir", async () => {
    const aExportId = await exportEkle(seed.A.tenantId);
    const id = await snapshotEkle(seed.A.tenantId, { iliskili_roi_export_run_id: aExportId });
    const { rows } = await db.sql(`select iliskili_roi_export_run_id from public.impact_graph_snapshots where id = $1`, [id]);
    expect(rows[0].iliskili_roi_export_run_id).toBe(aExportId);
  });
});

describe("impact_graph_snapshots — RLS", () => {
  it("cross-tenant: B, A'nın anlık görüntüsünü göremez", async () => {
    const id = await snapshotEkle(seed.A.tenantId);
    const { rows } = await db.asUser(seed.B.userId, `select id from public.impact_graph_snapshots where id = $1`, [id]);
    expect(rows).toHaveLength(0);
  });
});

describe("proof_room_links — graph_snapshot_id üçüncü polimorfik hedef", () => {
  it("iki hedef birden dolu olamaz (test_run_id + graph_snapshot_id)", async () => {
    const { rows: tr } = await db.sql(
      `insert into public.control_test_definitions (tenant_id, control_id, tur, ad)
       values ($1, $2, 'MANUAL_PROCEDURE', 'Test') returning id`,
      [seed.A.tenantId, seed.controlId],
    );
    const { rows: run } = await db.sql(
      `insert into public.test_runs (tenant_id, test_definition_id, control_id, sonuc, gerekce, tanim_surumu)
       values ($1, $2, $3, 'PASSED', 'test', 1) returning id`,
      [seed.A.tenantId, tr[0].id, seed.controlId],
    );
    const snapshotId = await snapshotEkle(seed.A.tenantId);
    await expect(
      db.sql(
        `insert into public.proof_room_links (tenant_id, test_run_id, graph_snapshot_id, son_gecerlilik)
         values ($1, $2, $3, now() + interval '7 days')`,
        [seed.A.tenantId, run[0].id, snapshotId],
      ),
    ).rejects.toThrow();
  });

  it("üç hedef de boş olamaz", async () => {
    await expect(
      db.sql(`insert into public.proof_room_links (tenant_id, son_gecerlilik) values ($1, now() + interval '7 days')`, [seed.A.tenantId]),
    ).rejects.toThrow();
  });

  it("yalnız graph_snapshot_id ile link kurulabilir", async () => {
    const snapshotId = await snapshotEkle(seed.A.tenantId);
    const { rows } = await db.sql(
      `insert into public.proof_room_links (tenant_id, graph_snapshot_id, son_gecerlilik)
       values ($1, $2, now() + interval '7 days') returning id`,
      [seed.A.tenantId, snapshotId],
    );
    expect(rows).toHaveLength(1);
  });
});

describe("proof_room_goruntule — graphSnapshot dalı (oturumsuz)", () => {
  it("geçerli token graf/spof/yayılım/hesaplama yöntemini minimize edilmeden döner", async () => {
    const snapshotId = await snapshotEkle(seed.A.tenantId, {
      graf: { dugumler: [{ id: "KRITIK_HIZMET:h1", tur: "KRITIK_HIZMET", etiket: "Ödeme", bilinmiyor: false }], kenarlar: [] },
      spof_raporu: { sistemikNoktalar: [], hesaplamaYontemi: "t" },
    });
    const { rows: link } = await db.sql(
      `insert into public.proof_room_links (tenant_id, graph_snapshot_id, son_gecerlilik)
       values ($1, $2, now() + interval '7 days') returning token`,
      [seed.A.tenantId, snapshotId],
    );
    const { rows } = await db.sql(`select public.proof_room_goruntule($1) as veri`, [link[0].token]);
    const veri = rows[0].veri as { graphSnapshot?: { grafHash: string; graf: { dugumler: unknown[] } } };
    expect(veri.graphSnapshot?.grafHash).toBe("a".repeat(64));
    expect(veri.graphSnapshot?.graf.dugumler).toHaveLength(1);
  });

  it("süresi geçmiş link null döner", async () => {
    const snapshotId = await snapshotEkle(seed.A.tenantId);
    const { rows: link } = await db.sql(
      `insert into public.proof_room_links (tenant_id, graph_snapshot_id, son_gecerlilik)
       values ($1, $2, now() - interval '1 hour') returning token`,
      [seed.A.tenantId, snapshotId],
    );
    const { rows } = await db.sql(`select public.proof_room_goruntule($1) as veri`, [link[0].token]);
    expect(rows[0].veri).toBeNull();
  });

  it("iptal edilmiş link null döner", async () => {
    const snapshotId = await snapshotEkle(seed.A.tenantId);
    const { rows: link } = await db.sql(
      `insert into public.proof_room_links (tenant_id, graph_snapshot_id, son_gecerlilik, iptal_edildi)
       values ($1, $2, now() + interval '7 days', true) returning token`,
      [seed.A.tenantId, snapshotId],
    );
    const { rows } = await db.sql(`select public.proof_room_goruntule($1) as veri`, [link[0].token]);
    expect(rows[0].veri).toBeNull();
  });

  it("test_run_id dalı (mevcut davranış) hâlâ çalışır — regresyon yok", async () => {
    const { rows: tr } = await db.sql(
      `insert into public.control_test_definitions (tenant_id, control_id, tur, ad)
       values ($1, $2, 'MANUAL_PROCEDURE', 'Test') returning id`,
      [seed.A.tenantId, seed.controlId],
    );
    const { rows: run } = await db.sql(
      `insert into public.test_runs (tenant_id, test_definition_id, control_id, sonuc, gerekce, tanim_surumu)
       values ($1, $2, $3, 'PASSED', 'test', 1) returning id`,
      [seed.A.tenantId, tr[0].id, seed.controlId],
    );
    const { rows: link } = await db.sql(
      `insert into public.proof_room_links (tenant_id, test_run_id, son_gecerlilik)
       values ($1, $2, now() + interval '7 days') returning token`,
      [seed.A.tenantId, run[0].id],
    );
    const { rows } = await db.sql(`select public.proof_room_goruntule($1) as veri`, [link[0].token]);
    const veri = rows[0].veri as { kosu?: { id: string } };
    expect(veri.kosu?.id).toBe(run[0].id);
  });
});
