// 37 Tez Dikey B, Faz 4 (20260720170000): DORA RoI export provenance —
// mühürleme, dört-göz terminal istisnası (yeniden_inceleme_* bayrağı DIŞINDA
// hiçbir şey karara bağlanmış kaydı değiştiremez), SCITT enqueue (yalnız
// YAYINLANDI geçişinde) ve reconciliation cron (kaynak SONRADAN düşerse
// export işaretlenir, durum GERİYE DÖNÜK değişmez).
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, seedTwoTenants, type TestDb } from "./helpers/pg";

let db: TestDb;
let seed: Awaited<ReturnType<typeof seedTwoTenants>>;
const A_IKINCI = "a0000000-0000-0000-0000-000000000002";

function provenanceRaporu(over: { iddiaIdleri?: string[]; roiKaynaklari?: { sablonKodu: string; alanKodu: string | null }[]; ictHizmetKodlari?: string[] } = {}) {
  return {
    schema: "KALKAN_ROI_EXPORT_PROVENANCE_V1",
    satirlar: [],
    ozet: {},
    izlenenler: {
      iddiaIdleri: over.iddiaIdleri ?? [],
      roiKaynaklari: over.roiKaynaklari ?? [],
      ictHizmetKodlari: over.ictHizmetKodlari ?? [],
    },
  };
}

async function exportEkle(tenantId: string, extra: Record<string, unknown> = {}) {
  const { rows } = await db.sql(
    `insert into public.roi_export_runs (tenant_id, talep_eden, paket, paket_hash, on_kontrol_raporu, engelleyici_sorun_sayisi, durum, provenance_raporu, provenance_hash)
     values ($1, $2, $3::jsonb, $4, $5::jsonb, $6, coalesce($7, 'TASLAK'), $8::jsonb, $9) returning id`,
    [
      tenantId,
      extra.talep_eden ?? seed.A.userId,
      JSON.stringify(extra.paket ?? { schema: "KALKAN_ROI_EXPORT_V1" }),
      extra.paket_hash ?? "a".repeat(64),
      JSON.stringify(extra.on_kontrol_raporu ?? { sorunlar: [], engelleyiciSayisi: 0 }),
      extra.engelleyici_sorun_sayisi ?? 0,
      extra.durum ?? null,
      JSON.stringify(extra.provenance_raporu ?? provenanceRaporu()),
      extra.provenance_hash ?? "d".repeat(64),
    ],
  );
  return rows[0].id as string;
}

async function yayinla(id: string) {
  await db.sql(`update public.roi_export_runs set durum = 'ONAY_TALEP_EDILDI' where id = $1`, [id]);
  await db.sql(`update public.roi_export_runs set durum = 'YAYINLANDI', onaylayan = $2, onay_zamani = now() where id = $1`, [id, A_IKINCI]);
}

async function outboxSayisi(artifactId: string): Promise<number> {
  const { rows } = await db.sql(`select count(*)::int as n from public.ledger_outbox where artifact_table = 'roi_export_runs' and artifact_id = $1`, [artifactId]);
  return rows[0].n as number;
}

beforeEach(async () => {
  db = await createTestDb();
  seed = await seedTwoTenants(db);
  await db.sql(`insert into auth.users (id, email) values ($1, 'a-ikinci@demo.com')`, [A_IKINCI]);
  await db.sql(`insert into public.profiles (id, tenant_id, role, full_name) values ($1, $2, 'uyum', 'A İkinci')`, [A_IKINCI, seed.A.tenantId]);
});
afterEach(async () => {
  await db.close();
});

describe("roi_export_runs — provenance mühürleme", () => {
  it("provenance_raporu/provenance_hash TASLAK'ta değiştirilemez (mühürlü içerik)", async () => {
    const id = await exportEkle(seed.A.tenantId);
    await expect(
      db.sql(`update public.roi_export_runs set provenance_hash = $2 where id = $1`, [id, "e".repeat(64)]),
    ).rejects.toThrow(/degistirilemez/i);
  });

  it("YAYINLANDI terminalde provenance_raporu bile değişemez", async () => {
    const id = await exportEkle(seed.A.tenantId, { talep_eden: seed.A.userId });
    await yayinla(id);
    await expect(
      db.sql(`update public.roi_export_runs set provenance_raporu = $2::jsonb where id = $1`, [id, JSON.stringify(provenanceRaporu({ iddiaIdleri: ["x"] }))]),
    ).rejects.toThrow(/degistirilemez/i);
  });
});

describe("roi_export_runs — terminal istisnası: YALNIZ yeniden_inceleme_* değişebilir", () => {
  it("YAYINLANDI export'ta yeniden_inceleme_gerekli/nedeni güncellenebilir", async () => {
    const id = await exportEkle(seed.A.tenantId, { talep_eden: seed.A.userId });
    await yayinla(id);
    await db.sql(`update public.roi_export_runs set yeniden_inceleme_gerekli = true, yeniden_inceleme_nedeni = 'test' where id = $1`, [id]);
    const { rows } = await db.sql(`select yeniden_inceleme_gerekli, yeniden_inceleme_nedeni, durum from public.roi_export_runs where id = $1`, [id]);
    expect(rows[0].yeniden_inceleme_gerekli).toBe(true);
    expect(rows[0].yeniden_inceleme_nedeni).toBe("test");
    expect(rows[0].durum).toBe("YAYINLANDI");
  });

  it("yeniden_inceleme_gerekli ile BİRLİKTE durum da değiştirilmeye çalışılırsa reddedilir (kaçış yolu yok)", async () => {
    const id = await exportEkle(seed.A.tenantId, { talep_eden: seed.A.userId });
    await yayinla(id);
    await expect(
      db.sql(`update public.roi_export_runs set yeniden_inceleme_gerekli = true, durum = 'REDDEDILDI' where id = $1`, [id]),
    ).rejects.toThrow(/degistirilemez/i);
  });
});

describe("roi_export_runs — SCITT enqueue yalnız YAYINLANDI geçişinde", () => {
  it("TASLAK→ONAY_TALEP_EDILDI enqueue ÜRETMEZ", async () => {
    const id = await exportEkle(seed.A.tenantId, { engelleyici_sorun_sayisi: 0 });
    await db.sql(`update public.roi_export_runs set durum = 'ONAY_TALEP_EDILDI' where id = $1`, [id]);
    expect(await outboxSayisi(id)).toBe(0);
  });

  it("ONAY_TALEP_EDILDI→YAYINLANDI enqueue ÜRETİR (statement_kind=ROI_EXPORT_PUBLISHED)", async () => {
    const id = await exportEkle(seed.A.tenantId, { talep_eden: seed.A.userId });
    await yayinla(id);
    expect(await outboxSayisi(id)).toBe(1);
    const { rows } = await db.sql(`select statement_kind from public.ledger_outbox where artifact_table = 'roi_export_runs' and artifact_id = $1`, [id]);
    expect(rows[0].statement_kind).toBe("ROI_EXPORT_PUBLISHED");
  });

  it("REDDEDILDI geçişi enqueue ÜRETMEZ (yalnız YAYINLANDI)", async () => {
    const id = await exportEkle(seed.A.tenantId, { talep_eden: seed.A.userId });
    await db.sql(`update public.roi_export_runs set durum = 'ONAY_TALEP_EDILDI' where id = $1`, [id]);
    await db.sql(`update public.roi_export_runs set durum = 'REDDEDILDI', onaylayan = $2, onay_zamani = now() where id = $1`, [id, A_IKINCI]);
    expect(await outboxSayisi(id)).toBe(0);
  });

  it("idempotency: reconciliation güncellemesi (durum YAYINLANDI kalır) ikinci enqueue üretmez", async () => {
    const id = await exportEkle(seed.A.tenantId, { talep_eden: seed.A.userId });
    await yayinla(id);
    expect(await outboxSayisi(id)).toBe(1);
    await db.sql(`update public.roi_export_runs set yeniden_inceleme_gerekli = true, yeniden_inceleme_nedeni = 'x' where id = $1`, [id]);
    expect(await outboxSayisi(id)).toBe(1);
  });
});

describe("roi_export_runs_yeniden_inceleme_isle — kaynak sonradan düşerse export işaretlenir", () => {
  it("izlenen assurance_claims SUPERSEDED olursa yeniden_inceleme_gerekli=true olur", async () => {
    const kf = await db.sql(`insert into public.critical_business_services (tenant_id, ad) values ($1, 'Ödeme') returning id`, [seed.A.tenantId]);
    const iddia = await db.sql(
      `insert into public.assurance_claims (tenant_id, iddia_turu, hedef_tablo, hedef_id, iddia_metni, sonuc, guven_gerekcesi, dogrulama_durumu)
       values ($1, 'UYUM', 'critical_business_services', $2, 'test', 'OLUMLU', 'test', 'TODO_DOGRULA') returning id`,
      [seed.A.tenantId, kf.rows[0].id],
    );
    const id = await exportEkle(seed.A.tenantId, {
      talep_eden: seed.A.userId,
      provenance_raporu: provenanceRaporu({ iddiaIdleri: [iddia.rows[0].id as string] }),
    });
    await yayinla(id);

    // Kaynak sonradan düşer (LEGAL_REVIEW gecmeden dogrudan SUPERSEDED — INSERT-disi UPDATE, guard bunu engellemez cunku yalniz VERIFIED/REJECTED gecisleri kisitli).
    await db.sql(`update public.assurance_claims set dogrulama_durumu = 'SUPERSEDED' where id = $1`, [iddia.rows[0].id]);

    await db.sql(`select public.roi_export_runs_yeniden_inceleme_isle()`);
    const { rows } = await db.sql(`select yeniden_inceleme_gerekli, yeniden_inceleme_nedeni from public.roi_export_runs where id = $1`, [id]);
    expect(rows[0].yeniden_inceleme_gerekli).toBe(true);
    expect(rows[0].yeniden_inceleme_nedeni).toMatch(/iddia/i);
  });

  it("izlenen roi_kaynak_kayitlari SUPERSEDED olursa yeniden_inceleme_gerekli=true olur", async () => {
    await db.sql(
      `insert into public.roi_kaynak_kayitlari (sablon_kodu, alan_kodu, alan_adi, zorunluluk_aciklamasi, kaynak_url, dogrulama_durumu)
       values ('B_06.01', null, 'ad', 'aciklama', 'https://example.test', 'TODO_DOGRULA')`,
    );
    const id = await exportEkle(seed.A.tenantId, {
      talep_eden: seed.A.userId,
      provenance_raporu: provenanceRaporu({ roiKaynaklari: [{ sablonKodu: "B_06.01", alanKodu: null }] }),
    });
    await yayinla(id);

    await db.sql(`update public.roi_kaynak_kayitlari set dogrulama_durumu = 'SUPERSEDED' where sablon_kodu = 'B_06.01'`);
    await db.sql(`select public.roi_export_runs_yeniden_inceleme_isle()`);
    const { rows } = await db.sql(`select yeniden_inceleme_gerekli, yeniden_inceleme_nedeni from public.roi_export_runs where id = $1`, [id]);
    expect(rows[0].yeniden_inceleme_gerekli).toBe(true);
    expect(rows[0].yeniden_inceleme_nedeni).toMatch(/roi_kaynak_kayitlari/i);
  });

  it("izlenen ict_service_types SUPERSEDED olursa yeniden_inceleme_gerekli=true olur", async () => {
    await db.sql(`insert into public.ict_service_types (kod, ad, dogrulama_durumu) values ('S99', 'test hizmet', 'TODO_DOGRULA')`);
    const id = await exportEkle(seed.A.tenantId, {
      talep_eden: seed.A.userId,
      provenance_raporu: provenanceRaporu({ ictHizmetKodlari: ["S99"] }),
    });
    await yayinla(id);

    await db.sql(`update public.ict_service_types set dogrulama_durumu = 'SUPERSEDED' where kod = 'S99'`);
    await db.sql(`select public.roi_export_runs_yeniden_inceleme_isle()`);
    const { rows } = await db.sql(`select yeniden_inceleme_gerekli from public.roi_export_runs where id = $1`, [id]);
    expect(rows[0].yeniden_inceleme_gerekli).toBe(true);
  });

  it("kaynak düşmezse export işaretlenmez (yanlış pozitif yok)", async () => {
    const id = await exportEkle(seed.A.tenantId, {
      talep_eden: seed.A.userId,
      provenance_raporu: provenanceRaporu({ roiKaynaklari: [{ sablonKodu: "B_01.01", alanKodu: null }] }),
    });
    await yayinla(id);
    await db.sql(`select public.roi_export_runs_yeniden_inceleme_isle()`);
    const { rows } = await db.sql(`select yeniden_inceleme_gerekli from public.roi_export_runs where id = $1`, [id]);
    expect(rows[0].yeniden_inceleme_gerekli).toBe(false);
  });

  it("cross-tenant: B'nin export'u A'nın düşen kaynağından ETKİLENMEZ (yalnız gerçek eşleşen izlenir)", async () => {
    await db.sql(`insert into public.ict_service_types (kod, ad, dogrulama_durumu) values ('S98', 'test hizmet 2', 'TODO_DOGRULA')`);
    const idA = await exportEkle(seed.A.tenantId, {
      talep_eden: seed.A.userId,
      provenance_raporu: provenanceRaporu({ ictHizmetKodlari: ["S98"] }),
    });
    const idB = await exportEkle(seed.B.tenantId, {
      talep_eden: seed.B.userId,
      provenance_raporu: provenanceRaporu({ ictHizmetKodlari: [] }),
    });
    await yayinla(idA);
    // B'yi de yayinla (guard yalniz onaylayan <> talep_eden ister, tenant eslesmesi zorlamaz — test helper RLS'i atlar).
    await db.sql(`update public.roi_export_runs set durum = 'ONAY_TALEP_EDILDI' where id = $1`, [idB]);
    await db.sql(`update public.roi_export_runs set durum = 'YAYINLANDI', onaylayan = $2, onay_zamani = now() where id = $1`, [idB, A_IKINCI]);

    await db.sql(`update public.ict_service_types set dogrulama_durumu = 'SUPERSEDED' where kod = 'S98'`);
    await db.sql(`select public.roi_export_runs_yeniden_inceleme_isle()`);

    const { rows: a } = await db.sql(`select yeniden_inceleme_gerekli from public.roi_export_runs where id = $1`, [idA]);
    const { rows: b } = await db.sql(`select yeniden_inceleme_gerekli from public.roi_export_runs where id = $1`, [idB]);
    expect(a[0].yeniden_inceleme_gerekli).toBe(true);
    expect(b[0].yeniden_inceleme_gerekli).toBe(false);
  });
});
