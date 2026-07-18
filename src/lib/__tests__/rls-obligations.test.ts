// V2 PR-4b adım 2 (M21): yükümlülükler + kontrol eşlemeleri — global referans
// (tenant'sız, ADR-T3), authenticated okur/istemci yazamaz; kural 3 guard'ları:
// VERIFIED doğamaz, VERIFIED yalnız LEGAL_REVIEW + dogrulayan atfıyla,
// VERIFIED içerik donuk.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, seedTwoTenants, type TestDb } from "./helpers/pg";

let db: TestDb;
let seed: Awaited<ReturnType<typeof seedTwoTenants>>;
const H = (c: string) => c.repeat(64);

/** Kaynak + artifact + hüküm kurar, hüküm id'sini döndürür. */
async function hukumEkle(): Promise<string> {
  const { rows: s } = await db.sql(
    `insert into public.regulatory_sources (authority, jurisdiction, kaynak_seviyesi, ad, erisim_politikasi_durumu)
     values ('SPK', 'TR', 'A', 'SPK Mevzuat Sistemi', 'manuel') returning id`,
  );
  const { rows: a } = await db.sql(
    `insert into public.source_artifacts (source_id, baslik, sha256) values ($1, 'Tebliğ v1', $2) returning id`,
    [s[0].id, H("a")],
  );
  const { rows: p } = await db.sql(
    `insert into public.provisions (source_artifact_id, provision_ref, metin, effective_from)
     values ($1, 'md. 26', 'Hüküm metni', '2020-01-01') returning id`,
    [a[0].id],
  );
  return p[0].id as string;
}

async function yukumlulukEkle(provisionId: string, extra: Record<string, unknown> = {}): Promise<string> {
  const { rows } = await db.sql(
    `insert into public.obligations (provision_id, kod, baslik, amac, dogrulama_durumu)
     values ($1, $2, 'Yedeklilik yükümlülüğü', 'Yurt içi ikincil merkez', coalesce($3, 'TODO_DOGRULA'))
     returning id`,
    [provisionId, extra.kod ?? "YUK-TEST-1", extra.dogrulama_durumu ?? null],
  );
  return rows[0].id as string;
}

async function eslemeEkle(obligationId: string, extra: Record<string, unknown> = {}): Promise<string> {
  const { rows } = await db.sql(
    `insert into public.obligation_control_mappings (obligation_id, control_id, dogrulama_durumu)
     values ($1, $2, coalesce($3, 'TODO_DOGRULA')) returning id`,
    [obligationId, extra.control_id ?? seed.controlId, extra.dogrulama_durumu ?? null],
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

describe("obligations + mappings — global referans + kural 3 guard'ları (M21)", () => {
  it("her iki kiracının kullanıcısı da AYNI yükümlülüğü ve eşlemeyi okur (global)", async () => {
    const oid = await yukumlulukEkle(await hukumEkle());
    const mid = await eslemeEkle(oid);
    for (const u of [seed.A.userId, seed.B.userId]) {
      const { rows: o } = await db.asUser(u, `select id from public.obligations where id = $1`, [oid]);
      const { rows: m } = await db.asUser(u, `select id from public.obligation_control_mappings where id = $1`, [mid]);
      expect(o).toHaveLength(1);
      expect(m).toHaveLength(1);
    }
  });

  it("istemci global yükümlülük/eşleme YAZAMAZ (politika yok — seed/service)", async () => {
    const pid = await hukumEkle();
    await expect(
      db.asUser(
        seed.A.userId,
        `insert into public.obligations (provision_id, kod, baslik, amac) values ($1, 'X', 'x', 'x')`,
        [pid],
      ),
    ).rejects.toThrow();
    const oid = await yukumlulukEkle(pid);
    await expect(
      db.asUser(
        seed.A.userId,
        `insert into public.obligation_control_mappings (obligation_id, control_id) values ($1, $2)`,
        [oid, seed.controlId],
      ),
    ).rejects.toThrow();
  });

  it("kural 3: kayıt VERIFIED DOĞAMAZ (yükümlülük ve eşleme)", async () => {
    const pid = await hukumEkle();
    await expect(yukumlulukEkle(pid, { dogrulama_durumu: "VERIFIED" })).rejects.toThrow(/VERIFIED dogamaz/);
    const oid = await yukumlulukEkle(pid);
    await expect(eslemeEkle(oid, { dogrulama_durumu: "VERIFIED" })).rejects.toThrow(/VERIFIED dogamaz/);
  });

  it("VERIFIED geçişi LEGAL_REVIEW dışından REDDEDİLİR (TODO_DOGRULA'dan doğrudan olmaz)", async () => {
    const oid = await yukumlulukEkle(await hukumEkle());
    await expect(
      db.sql(
        `update public.obligations set dogrulama_durumu = 'VERIFIED', dogrulayan = $2, dogrulama_zamani = now() where id = $1`,
        [oid, seed.A.userId],
      ),
    ).rejects.toThrow(/LEGAL_REVIEW/);
  });

  it("VERIFIED geçişi dogrulayan/dogrulama_zamani olmadan REDDEDİLİR", async () => {
    const oid = await yukumlulukEkle(await hukumEkle());
    await db.sql(`update public.obligations set dogrulama_durumu = 'LEGAL_REVIEW' where id = $1`, [oid]);
    await expect(
      db.sql(`update public.obligations set dogrulama_durumu = 'VERIFIED' where id = $1`, [oid]),
    ).rejects.toThrow(/dogrulayan/);
  });

  it("LEGAL_REVIEW → VERIFIED, dogrulayan + zaman ile GEÇER (yükümlülük ve eşleme)", async () => {
    const oid = await yukumlulukEkle(await hukumEkle());
    const mid = await eslemeEkle(oid);
    for (const [tablo, id] of [
      ["obligations", oid],
      ["obligation_control_mappings", mid],
    ] as const) {
      await db.sql(`update public.${tablo} set dogrulama_durumu = 'LEGAL_REVIEW' where id = $1`, [id]);
      await db.sql(
        `update public.${tablo} set dogrulama_durumu = 'VERIFIED', dogrulayan = $2, dogrulama_zamani = now() where id = $1`,
        [id, seed.A.userId],
      );
      const { rows } = await db.sql(`select dogrulama_durumu from public.${tablo} where id = $1`, [id]);
      expect(rows[0].dogrulama_durumu).toBe("VERIFIED");
    }
  });

  it("VERIFIED yükümlülüğün içeriği DONUK; doğrulama geri alınınca düzenlenebilir", async () => {
    const oid = await yukumlulukEkle(await hukumEkle());
    await db.sql(`update public.obligations set dogrulama_durumu = 'LEGAL_REVIEW' where id = $1`, [oid]);
    await db.sql(
      `update public.obligations set dogrulama_durumu = 'VERIFIED', dogrulayan = $2, dogrulama_zamani = now() where id = $1`,
      [oid, seed.A.userId],
    );
    await expect(
      db.sql(`update public.obligations set baslik = 'Başka iddia' where id = $1`, [oid]),
    ).rejects.toThrow(/icerigi degistirilemez/);
    // Serbest alan (siklik) donuk DEĞİL — içerik-kimliği alanları donuk.
    await db.sql(`update public.obligations set siklik = 'yillik' where id = $1`, [oid]);
    // Doğrulama geri alınınca içerik düzenlenebilir.
    await db.sql(`update public.obligations set dogrulama_durumu = 'TODO_DOGRULA', baslik = 'Düzeltilmiş' where id = $1`, [oid]);
    const { rows } = await db.sql(`select baslik from public.obligations where id = $1`, [oid]);
    expect(rows[0].baslik).toBe("Düzeltilmiş");
  });

  it("VERIFIED eşlemenin kapsam'ı değiştirilemez (tam→kismi sessiz kayma yok)", async () => {
    const oid = await yukumlulukEkle(await hukumEkle());
    const mid = await eslemeEkle(oid);
    await db.sql(`update public.obligation_control_mappings set dogrulama_durumu = 'LEGAL_REVIEW' where id = $1`, [mid]);
    await db.sql(
      `update public.obligation_control_mappings set dogrulama_durumu = 'VERIFIED', dogrulayan = $2, dogrulama_zamani = now() where id = $1`,
      [mid, seed.A.userId],
    );
    await expect(
      db.sql(`update public.obligation_control_mappings set kapsam = 'kismi' where id = $1`, [mid]),
    ).rejects.toThrow(/icerigi degistirilemez/);
  });

  it("aynı yükümlülük→kontrol çifti İKİNCİ kez eşlenemez (unique)", async () => {
    const oid = await yukumlulukEkle(await hukumEkle());
    await eslemeEkle(oid);
    await expect(eslemeEkle(oid)).rejects.toThrow();
  });
});
