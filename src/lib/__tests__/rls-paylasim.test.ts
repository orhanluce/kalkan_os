// M4 kabul kriteri: "Denetçi kapsam dışındaki kanıtı göremiyor; erişim
// süresi sonunda otomatik kapanıyor" (docs/ROADMAP.md M4, şartname §6.6).
//
// Denetçi OTURUMSUZ gelir (asAnon): bu testlerin tamamı, hesabı olmayan bir
// kullanıcının yalnızca token ile ne görebildiğini sınar.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, seedTwoTenants, type TestDb, ZARF_DEGERLERI, ZARF_KOLONLARI } from "./helpers/pg";

let db: TestDb;
let seed: Awaited<ReturnType<typeof seedTwoTenants>>;

/** A kiracısının ikinci çerçevesi ve o çerçeveye ait kontrolü — kapsam sınırını sınamak için. */
const IKINCI_FRAMEWORK = "f0000000-0000-0000-0000-000000000002";
const KAPSAM_DISI_CONTROL = "c0000000-0000-0000-0000-000000000002";

const TOKEN = "a".repeat(64);

beforeEach(async () => {
  db = await createTestDb();
  seed = await seedTwoTenants(db);

  // İkinci bir çerçeve + kontrol: paylaşım yalnızca ilk çerçeveyi kapsayacak.
  await db.sql(
    `insert into public.frameworks (id, code, name, version) values ($1, '7545', 'Ikinci Cerceve', 'v0')`,
    [IKINCI_FRAMEWORK],
  );
  await db.sql(
    `insert into public.controls (id, framework_id, madde_ref, baslik, periyot, kritiklik)
     values ($1, $2, 'KAPSAM-DISI-01', 'Kapsam disi kontrol', 'yillik', 5)`,
    [KAPSAM_DISI_CONTROL, IKINCI_FRAMEWORK],
  );

  // A kiracısı her iki kontrolü de izliyor.
  await db.sql(
    `insert into public.tenant_controls (tenant_id, control_id, durum)
     values ($1, $2, 'karsilaniyor'), ($1, $3, 'acik')`,
    [seed.A.tenantId, seed.controlId, KAPSAM_DISI_CONTROL],
  );
  // B kiracısı da aynı kontrolü izliyor — sızmamalı.
  await db.sql(
    `insert into public.tenant_controls (tenant_id, control_id, durum) values ($1, $2, 'kapsam_disi')`,
    [seed.B.tenantId, seed.controlId],
  );

  await db.sql(
    `insert into public.evidences (tenant_id, control_id, tip, storage_path, hash_sha256, ${ZARF_KOLONLARI})
     values ($1, $2, 'beyan', 'A gizli kanit yolu', 'aa11', ${ZARF_DEGERLERI})`,
    [seed.A.tenantId, seed.controlId],
  );
  // B'nin aynı kontrole ait kanıtı: A'nın paylaşımında SAYILMAMALI.
  await db.sql(
    `insert into public.evidences (tenant_id, control_id, tip, storage_path, ${ZARF_KOLONLARI})
     values ($1, $2, 'beyan', 'B kaniti', ${ZARF_DEGERLERI})`,
    [seed.B.tenantId, seed.controlId],
  );
});

afterEach(async () => {
  await db.close();
});

async function paylasimOlustur(sonGecerlilik: string, token = TOKEN, frameworkId = seed.frameworkId) {
  await db.sql(
    `insert into public.share_links (tenant_id, token, kapsam, son_gecerlilik)
     values ($1, $2, $3::jsonb, $4)`,
    [seed.A.tenantId, token, JSON.stringify({ frameworkId }), sonGecerlilik],
  );
}

/** Denetçi yolu: oturumsuz (anon), yalnızca token ile. */
async function goruntule(token = TOKEN): Promise<Record<string, unknown> | null> {
  const { rows } = await db.asAnon(`select public.paylasim_goruntule($1) as sonuc`, [token]);
  return rows[0].sonuc as Record<string, unknown> | null;
}

describe("denetçi paylaşımı: oturumsuz token erişimi", () => {
  it("geçerli token ile kapsamdaki kontroller görünür", async () => {
    await paylasimOlustur("2099-01-01T00:00:00Z");
    const sonuc = await goruntule();

    expect(sonuc).not.toBeNull();
    expect(sonuc?.kurumAdi).toBe("Tenant A");
    expect(sonuc?.frameworkCode).toBe("VII-128.10");

    const kontroller = sonuc?.kontroller as Record<string, unknown>[];
    expect(kontroller).toHaveLength(1);
    expect(kontroller[0].madde_ref).toBe("TODO-DOGRULA-01");
    expect(kontroller[0].durum).toBe("karsilaniyor");
  });

  it("kapsam DIŞINDAKİ çerçevenin kontrolü görünmez", async () => {
    await paylasimOlustur("2099-01-01T00:00:00Z");
    const kontroller = (await goruntule())?.kontroller as Record<string, unknown>[];

    // Kurum bu kontrolü izliyor ama paylaşımın kapsamı ilk çerçeve.
    expect(kontroller.map((k) => k.madde_ref)).not.toContain("KAPSAM-DISI-01");
  });

  it("kanıt İÇERİĞİ dönmez, yalnızca sayısı", async () => {
    await paylasimOlustur("2099-01-01T00:00:00Z");
    const sonuc = await goruntule();

    // Denetçi kanıtın varlığını bilmeli, içeriğini değil (şartname §10.4).
    const metin = JSON.stringify(sonuc);
    expect(metin).not.toContain("A gizli kanit yolu");
    expect(metin).not.toContain("aa11");

    const kontroller = sonuc?.kontroller as Record<string, unknown>[];
    expect(Number(kontroller[0].kanit_sayisi)).toBe(1);
  });

  it("başka kiracının kanıtı sayıma karışmaz", async () => {
    await paylasimOlustur("2099-01-01T00:00:00Z");
    const kontroller = (await goruntule())?.kontroller as Record<string, unknown>[];

    // Aynı control_id'ye B'nin de kanıtı var; A'nın paylaşımı 1 saymalı.
    expect(Number(kontroller[0].kanit_sayisi)).toBe(1);
  });

  it("başka kiracının durumu görünmez", async () => {
    await paylasimOlustur("2099-01-01T00:00:00Z");
    const kontroller = (await goruntule())?.kontroller as Record<string, unknown>[];

    // B aynı kontrolü 'kapsam_disi' işaretlemiş; A'nın paylaşımı A'nın
    // durumunu göstermeli.
    expect(kontroller).toHaveLength(1);
    expect(kontroller[0].durum).toBe("karsilaniyor");
  });

  it("süresi dolmuş link veri döndürmez (erişim otomatik kapanır)", async () => {
    await paylasimOlustur("2020-01-01T00:00:00Z");
    expect(await goruntule()).toBeNull();
  });

  it("yanlış token veri döndürmez", async () => {
    await paylasimOlustur("2099-01-01T00:00:00Z");
    expect(await goruntule("b".repeat(64))).toBeNull();
  });

  it("geçersiz ve süresi dolmuş token AYNI cevabı verir", async () => {
    // Ayırt edilebilselerdi, saldırgan geçerli token'ları eleyebilirdi.
    await paylasimOlustur("2020-01-01T00:00:00Z");
    expect(await goruntule()).toBeNull();
    expect(await goruntule("c".repeat(64))).toBeNull();
  });

  it("oturumsuz kullanıcı tabloları DOĞRUDAN okuyamaz", async () => {
    await paylasimOlustur("2099-01-01T00:00:00Z");

    // RPC tek kapıdır: fonksiyonu atlayıp tabloya gitmek hiçbir şey vermez.
    for (const tablo of ["share_links", "tenant_controls", "evidences", "tenants"]) {
      const { rows } = await db.asAnon(`select * from public.${tablo}`);
      expect(rows, `${tablo} anon'a sizdirdi`).toHaveLength(0);
    }
  });

  it("denetçi erişimi denetim izine yazılır (token yazılmadan)", async () => {
    await paylasimOlustur("2099-01-01T00:00:00Z");
    await goruntule();

    const { rows } = await db.sql(
      `select actor_id, eylem, detay from public.audit_log
       where tenant_id = $1 and eylem = 'paylasim_goruntulendi'`,
      [seed.A.tenantId],
    );

    expect(rows).toHaveLength(1);
    // Erişen bir kullanıcı değil, token sahibi: actor_id null.
    expect(rows[0].actor_id).toBeNull();
    expect(JSON.stringify(rows[0].detay)).not.toContain(TOKEN);
  });

  it("silinen çerçeveye işaret eden paylaşım veri döndürmez", async () => {
    await paylasimOlustur("2099-01-01T00:00:00Z", TOKEN, "f0000000-0000-0000-0000-00000000dead");
    expect(await goruntule()).toBeNull();
  });
});
