// Anchor parti kalıcılığının RLS ve append-only davranışı
// (docs/ROADMAP.md M5.5, şartname §9.2).
//
// Sabitleme bir SİSTEM işidir: partiler ve makbuzlar service_role muadili
// (db.sql) ile yazılır. Bu yüzden testler iki şeyi ayrı ayrı sınar —
// kullanıcı bunları YAZAMAZ, ama kendi kiracısınınkini OKUYABİLİR.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, seedTwoTenants, type TestDb, ZARF_DEGERLERI, ZARF_KOLONLARI } from "./helpers/pg";

let db: TestDb;
let seed: Awaited<ReturnType<typeof seedTwoTenants>>;

const KOK_A = "a".repeat(64);
const KOK_B = "b".repeat(64);

beforeEach(async () => {
  db = await createTestDb();
  seed = await seedTwoTenants(db);
});

afterEach(async () => {
  await db.close();
});

async function kanitYukle(tenantId: string): Promise<string> {
  const { rows } = await db.sql(
    `insert into public.evidences (tenant_id, control_id, tip, yukleyen, ${ZARF_KOLONLARI})
     values ($1, $2, 'beyan', null, ${ZARF_DEGERLERI}) returning id`,
    [tenantId, seed.controlId],
  );
  return rows[0].id as string;
}

/** Sistem işi: parti oluşturur, kanıtı yaprak olarak bağlar. */
async function partiOlustur(tenantId: string, kok: string, evidenceId: string): Promise<string> {
  const { rows } = await db.sql(
    `insert into public.anchor_batches (tenant_id, merkle_root, yaprak_sayisi)
     values ($1, $2, 1) returning id`,
    [tenantId, kok],
  );
  const batchId = rows[0].id as string;
  await db.sql(
    `insert into public.anchor_batch_leaves (batch_id, evidence_id, tenant_id) values ($1, $2, $3)`,
    [batchId, evidenceId, tenantId],
  );
  return batchId;
}

async function makbuzYaz(batchId: string, tenantId: string, anchoredAt: string) {
  await db.sql(
    `insert into public.anchor_receipts (batch_id, tenant_id, saglayici, anchored_at, payload)
     values ($1, $2, 'local-append-only', $3, '{"uyari":"test"}'::jsonb)`,
    [batchId, tenantId, anchoredAt],
  );
}

async function durum(batchId: string): Promise<string> {
  const { rows } = await db.sql(`select public.anchor_batch_durumu($1) as d`, [batchId]);
  return rows[0].d as string;
}

describe("anchor partileri", () => {
  it("makbuzsuz parti 'beklemede'dir (PENDING_ANCHOR)", async () => {
    // Şartname §9.2: sağlayıcı çalışmıyorsa akış durmamalı, parti beklemede
    // kalmalı. Sistem veri kaybetmez, yalnızca makbuzsuz kalır.
    const batchId = await partiOlustur(seed.A.tenantId, KOK_A, await kanitYukle(seed.A.tenantId));
    expect(await durum(batchId)).toBe("beklemede");
  });

  it("makbuz gelince parti 'sabitlendi' olur", async () => {
    const batchId = await partiOlustur(seed.A.tenantId, KOK_A, await kanitYukle(seed.A.tenantId));
    await makbuzYaz(batchId, seed.A.tenantId, "2026-07-16T10:00:00.000Z");
    expect(await durum(batchId)).toBe("sabitlendi");
  });

  it("geçersiz Merkle kökü reddedilir", async () => {
    await expect(
      db.sql(
        `insert into public.anchor_batches (tenant_id, merkle_root, yaprak_sayisi)
         values ($1, 'kisa-kok', 1)`,
        [seed.A.tenantId],
      ),
    ).rejects.toThrow();
  });

  it("boş parti oluşturulamaz", async () => {
    await expect(
      db.sql(
        `insert into public.anchor_batches (tenant_id, merkle_root, yaprak_sayisi)
         values ($1, $2, 0)`,
        [seed.A.tenantId, KOK_A],
      ),
    ).rejects.toThrow();
  });

  it("makbuz, başka kiracının partisine yazılamaz", async () => {
    const batchId = await partiOlustur(seed.A.tenantId, KOK_A, await kanitYukle(seed.A.tenantId));

    await expect(makbuzYaz(batchId, seed.B.tenantId, "2026-07-16T10:00:00.000Z")).rejects.toThrow(
      /kiraciya ait/i,
    );
  });

  it("kullanıcı kendi kiracısının partisini görebilir", async () => {
    const batchId = await partiOlustur(seed.A.tenantId, KOK_A, await kanitYukle(seed.A.tenantId));
    await makbuzYaz(batchId, seed.A.tenantId, "2026-07-16T10:00:00.000Z");

    const { rows } = await db.asUser(
      seed.A.userId,
      `select merkle_root from public.anchor_batches where id = $1`,
      [batchId],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].merkle_root).toBe(KOK_A);
  });

  it("kullanıcı başka kiracının partisini, yapraklarını ve makbuzunu göremez", async () => {
    const batchId = await partiOlustur(seed.B.tenantId, KOK_B, await kanitYukle(seed.B.tenantId));
    await makbuzYaz(batchId, seed.B.tenantId, "2026-07-16T10:00:00.000Z");

    for (const tablo of ["anchor_batches", "anchor_batch_leaves", "anchor_receipts"]) {
      const kolon = tablo === "anchor_batches" ? "id" : "batch_id";
      const { rows } = await db.asUser(
        seed.A.userId,
        `select 1 from public.${tablo} where ${kolon} = $1`,
        [batchId],
      );
      expect(rows, `${tablo} sizdirdi`).toHaveLength(0);
    }
  });

  it("kullanıcı parti veya makbuz YAZAMAZ (sabitleme sistem işidir)", async () => {
    const evidenceId = await kanitYukle(seed.A.tenantId);

    // Kullanıcının verebileceği tek şey sahte bir zaman iddiası olurdu.
    await expect(
      db.asUser(
        seed.A.userId,
        `insert into public.anchor_batches (tenant_id, merkle_root, yaprak_sayisi)
         values ($1, $2, 1)`,
        [seed.A.tenantId, KOK_A],
      ),
    ).rejects.toThrow();

    const batchId = await partiOlustur(seed.A.tenantId, KOK_A, evidenceId);
    await expect(
      db.asUser(
        seed.A.userId,
        `insert into public.anchor_receipts (batch_id, tenant_id, saglayici, anchored_at)
         values ($1, $2, 'sahte', now())`,
        [batchId, seed.A.tenantId],
      ),
    ).rejects.toThrow();
  });

  it("sabitlenmiş kök değiştirilemez veya silinemez (append-only)", async () => {
    const batchId = await partiOlustur(seed.A.tenantId, KOK_A, await kanitYukle(seed.A.tenantId));

    await expect(
      db.asUser(seed.A.userId, `update public.anchor_batches set merkle_root = $2 where id = $1`, [
        batchId,
        KOK_B,
      ]),
    ).rejects.toThrow();

    await expect(
      db.asUser(seed.A.userId, `delete from public.anchor_batches where id = $1`, [batchId]),
    ).rejects.toThrow();
  });

  it("kanıttan sabitleme bilgisine ulaşılır", async () => {
    const evidenceId = await kanitYukle(seed.A.tenantId);
    const batchId = await partiOlustur(seed.A.tenantId, KOK_A, evidenceId);
    await makbuzYaz(batchId, seed.A.tenantId, "2026-07-16T10:00:00.000Z");

    const { rows } = await db.sql(`select * from public.evidence_anchor_bilgisi($1)`, [evidenceId]);

    expect(rows).toHaveLength(1);
    expect(rows[0].merkle_root).toBe(KOK_A);
    expect(rows[0].durum).toBe("sabitlendi");
    expect(rows[0].anchored_at).toBeTruthy();
  });

  it("hiç sabitlenmemiş kanıt için sabitleme bilgisi boştur", async () => {
    const evidenceId = await kanitYukle(seed.A.tenantId);
    const { rows } = await db.sql(`select * from public.evidence_anchor_bilgisi($1)`, [evidenceId]);
    expect(rows).toHaveLength(0);
  });

  it("aynı kanıt iki kez sabitlenirse en son parti döner", async () => {
    const evidenceId = await kanitYukle(seed.A.tenantId);
    await partiOlustur(seed.A.tenantId, KOK_A, evidenceId);
    const ikinciBatch = await partiOlustur(seed.A.tenantId, KOK_B, evidenceId);
    await makbuzYaz(ikinciBatch, seed.A.tenantId, "2026-07-17T10:00:00.000Z");

    const { rows } = await db.sql(`select * from public.evidence_anchor_bilgisi($1)`, [evidenceId]);
    expect(rows[0].merkle_root).toBe(KOK_B);
  });

  it("aynı kanıt bir partiye iki kez yaprak olarak eklenemez", async () => {
    const evidenceId = await kanitYukle(seed.A.tenantId);
    const batchId = await partiOlustur(seed.A.tenantId, KOK_A, evidenceId);

    // Yaprak sayısı ile gerçek yaprak sayısı ayrışsaydı kök yeniden
    // üretilemezdi.
    await expect(
      db.sql(
        `insert into public.anchor_batch_leaves (batch_id, evidence_id, tenant_id)
         values ($1, $2, $3)`,
        [batchId, evidenceId, seed.A.tenantId],
      ),
    ).rejects.toThrow();
  });
});
