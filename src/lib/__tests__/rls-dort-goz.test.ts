// docs/ROADMAP.md M5.5 / Faz 5 kabul kriteri: "kendi yüklediği kanıtı tek
// kullanıcı nihai onaylayamıyor" (görevler ayrılığı, VII-128.10).
//
// Kural trigger'da olduğu için burada hem istemci yolundan (asUser, RLS
// uygulanır) hem de RLS'i bypass eden yoldan (db.sql) sınanır — bir uyum
// ürününde görevler ayrılığı, uygulamanın hangi rolle bağlandığına bağlı
// olmamalıdır.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, seedTwoTenants, type TestDb, ZARF_DEGERLERI, ZARF_KOLONLARI } from "./helpers/pg";

let db: TestDb;
let seed: Awaited<ReturnType<typeof seedTwoTenants>>;

/** Tenant A'da ikinci bir kullanıcı — dört-göz için ikinci göz. */
const A_IKINCI = "a0000000-0000-0000-0000-000000000002";

beforeEach(async () => {
  db = await createTestDb();
  seed = await seedTwoTenants(db);

  await db.sql(`insert into auth.users (id, email) values ($1, 'a2@demo.com')`, [A_IKINCI]);
  await db.sql(
    `insert into public.profiles (id, tenant_id, role, full_name)
     values ($1, $2, 'uyum', 'A Ikinci Kullanici')`,
    [A_IKINCI, seed.A.tenantId],
  );
});

afterEach(async () => {
  await db.close();
});

/** A.userId'nin yüklediği bir kanıt oluşturur ve id'sini döndürür. */
async function kanitYukle(yukleyen: string | null = seed.A.userId): Promise<string> {
  const { rows } = await db.sql(
    `insert into public.evidences (tenant_id, control_id, tip, yukleyen, ${ZARF_KOLONLARI})
     values ($1, $2, 'beyan', $3, ${ZARF_DEGERLERI}) returning id`,
    [seed.A.tenantId, seed.controlId, yukleyen],
  );
  return rows[0].id as string;
}

async function durum(evidenceId: string): Promise<string> {
  const { rows } = await db.sql(`select public.evidence_durumu($1) as d`, [evidenceId]);
  return rows[0].d as string;
}

describe("dört-göz onayı", () => {
  it("incelenmemiş kanıt 'incelemede' durumundadır", async () => {
    expect(await durum(await kanitYukle())).toBe("incelemede");
  });

  it("başka bir kullanıcı kanıtı kabul edebilir", async () => {
    const evidenceId = await kanitYukle();

    await db.asUser(
      A_IKINCI,
      `insert into public.evidence_reviews (tenant_id, evidence_id, reviewer_id, karar, gerekce)
       values ($1, $2, $3, 'kabul', 'Politika ekinde dogrulandi')`,
      [seed.A.tenantId, evidenceId, A_IKINCI],
    );

    expect(await durum(evidenceId)).toBe("kabul");
  });

  it("yükleyen kendi kanıtını ONAYLAYAMAZ", async () => {
    const evidenceId = await kanitYukle();

    await expect(
      db.asUser(
        seed.A.userId,
        `insert into public.evidence_reviews (tenant_id, evidence_id, reviewer_id, karar)
         values ($1, $2, $3, 'kabul')`,
        [seed.A.tenantId, evidenceId, seed.A.userId],
      ),
    ).rejects.toThrow(/dort-goz/i);

    expect(await durum(evidenceId)).toBe("incelemede");
  });

  it("yükleyen kendi kanıtını REDDEDEMEZ de (kural karardan bağımsız)", async () => {
    const evidenceId = await kanitYukle();

    // 'ret' de bir karardır: yükleyenin kendi kanıtını eleyebilmesi de
    // görevler ayrılığını deler (istenmeyen kanıtı sessizce düşürmek).
    await expect(
      db.asUser(
        seed.A.userId,
        `insert into public.evidence_reviews (tenant_id, evidence_id, reviewer_id, karar)
         values ($1, $2, $3, 'ret')`,
        [seed.A.tenantId, evidenceId, seed.A.userId],
      ),
    ).rejects.toThrow(/dort-goz/i);
  });

  it("dört-göz kuralı RLS'i bypass eden yoldan da uygulanır", async () => {
    const evidenceId = await kanitYukle();

    // service_role / DB yöneticisi muadili: RLS yok, ama trigger var.
    await expect(
      db.sql(
        `insert into public.evidence_reviews (tenant_id, evidence_id, reviewer_id, karar)
         values ($1, $2, $3, 'kabul')`,
        [seed.A.tenantId, evidenceId, seed.A.userId],
      ),
    ).rejects.toThrow(/dort-goz/i);
  });

  it("kullanıcı başkası adına karar yazamaz", async () => {
    const evidenceId = await kanitYukle();

    // Yükleyen, meslektaşının kimliğiyle kendi kanıtını onaylamayı deniyor.
    // Bu engellenmezse dört-göz kuralı tamamen anlamsızlaşırdı.
    await expect(
      db.asUser(
        seed.A.userId,
        `insert into public.evidence_reviews (tenant_id, evidence_id, reviewer_id, karar)
         values ($1, $2, $3, 'kabul')`,
        [seed.A.tenantId, evidenceId, A_IKINCI],
      ),
    ).rejects.toThrow();

    expect(await durum(evidenceId)).toBe("incelemede");
  });

  it("başka kiracının kullanıcısı kanıtı inceleyemez", async () => {
    const evidenceId = await kanitYukle();

    await expect(
      db.asUser(
        seed.B.userId,
        `insert into public.evidence_reviews (tenant_id, evidence_id, reviewer_id, karar)
         values ($1, $2, $3, 'kabul')`,
        [seed.B.tenantId, evidenceId, seed.B.userId],
      ),
    ).rejects.toThrow();

    expect(await durum(evidenceId)).toBe("incelemede");
  });

  it("son karar geçerlidir (kabul sonra ret -> ret)", async () => {
    const evidenceId = await kanitYukle();

    for (const karar of ["kabul", "ret"]) {
      await db.asUser(
        A_IKINCI,
        `insert into public.evidence_reviews (tenant_id, evidence_id, reviewer_id, karar)
         values ($1, $2, $3, $4)`,
        [seed.A.tenantId, evidenceId, A_IKINCI, karar],
      );
    }

    expect(await durum(evidenceId)).toBe("ret");

    // ...ve önceki karar SİLİNMEZ: denetçi kararın değiştiğini görebilmeli.
    const { rows } = await db.sql(
      `select karar from public.evidence_reviews where evidence_id = $1 order by seq asc`,
      [evidenceId],
    );
    expect(rows.map((r) => r.karar)).toEqual(["kabul", "ret"]);
  });

  it("verilmiş karar değiştirilemez veya silinemez (append-only)", async () => {
    const evidenceId = await kanitYukle();
    await db.asUser(
      A_IKINCI,
      `insert into public.evidence_reviews (tenant_id, evidence_id, reviewer_id, karar)
       values ($1, $2, $3, 'ret')`,
      [seed.A.tenantId, evidenceId, A_IKINCI],
    );

    await expect(
      db.asUser(A_IKINCI, `update public.evidence_reviews set karar = 'kabul' where evidence_id = $1`, [
        evidenceId,
      ]),
    ).rejects.toThrow();

    await expect(
      db.asUser(A_IKINCI, `delete from public.evidence_reviews where evidence_id = $1`, [evidenceId]),
    ).rejects.toThrow();

    expect(await durum(evidenceId)).toBe("ret");
  });

  it("kararı veren profil silinemez (karar sahipsiz kalmasın)", async () => {
    const evidenceId = await kanitYukle();
    await db.asUser(
      A_IKINCI,
      `insert into public.evidence_reviews (tenant_id, evidence_id, reviewer_id, karar)
       values ($1, $2, $3, 'kabul')`,
      [seed.A.tenantId, evidenceId, A_IKINCI],
    );

    await expect(db.sql(`delete from public.profiles where id = $1`, [A_IKINCI])).rejects.toThrow();
  });

  it("BİLİNEN SINIR: yükleyen profili silinmişse dört-göz uygulanamaz", async () => {
    // evidences.yukleyen "on delete set null" — profil silinince kanıtın
    // yükleyeni bilinmez olur ve "kim onaylayamaz" sorusu cevapsız kalır.
    // Bu testin amacı kuralı savunmak değil, SINIRI görünür tutmak: profil
    // silme akışı eklendiğinde burası kırmızıya dönmeli ve karar yeniden
    // ele alınmalı (bkz. 20260716120011_evidence_reviews.sql notu).
    const evidenceId = await kanitYukle(null);

    await db.asUser(
      seed.A.userId,
      `insert into public.evidence_reviews (tenant_id, evidence_id, reviewer_id, karar)
       values ($1, $2, $3, 'kabul')`,
      [seed.A.tenantId, evidenceId, seed.A.userId],
    );

    expect(await durum(evidenceId)).toBe("kabul");
  });
});
