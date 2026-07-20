// 37 Tez Dikey B, Faz 2 kalan dilimi (20260720120000): tenant_legal_identity/
// third_party_contracts/fourth_parties genişlemesi + third_party_contract_
// critical_services açık mapping tablosu. Yeni dört-göz YOK (ADR §5 — tenant'ın
// kendi operasyonel verisi, ict_hizmet_turu_kod ZATEN dört-göz korumalı
// ict_service_types'a FK).
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, seedTwoTenants, type TestDb } from "./helpers/pg";

let db: TestDb;
let seed: Awaited<ReturnType<typeof seedTwoTenants>>;

async function hizmetTuruEkle(kod = "S07"): Promise<string> {
  await db.sql(`insert into public.ict_service_types (kod, ad) values ($1, 'Test hizmeti') on conflict (kod) do nothing`, [kod]);
  return kod;
}

async function tedarikciEkle(tenantId: string, ad = "Vendor A"): Promise<string> {
  const { rows } = await db.sql(`insert into public.third_parties (tenant_id, ad) values ($1, $2) returning id`, [tenantId, ad]);
  return rows[0].id as string;
}

async function sozlesmeEkle(tenantId: string, thirdPartyId: string, extra: Record<string, unknown> = {}): Promise<string> {
  const { rows } = await db.sql(
    `insert into public.third_party_contracts (tenant_id, third_party_id, sozlesme_ref, baslangic, bitis, ict_hizmet_turu_kod, veri_saklama_ulkesi)
     values ($1, $2, $3, current_date, current_date + 365, $4, $5) returning id`,
    [tenantId, thirdPartyId, extra.sozlesme_ref ?? "S-1", extra.ict_hizmet_turu_kod ?? null, extra.veri_saklama_ulkesi ?? null],
  );
  return rows[0].id as string;
}

async function kritikHizmetEkle(tenantId: string, ad = "Ödeme İşleme"): Promise<string> {
  const { rows } = await db.sql(`insert into public.critical_business_services (tenant_id, ad) values ($1, $2) returning id`, [tenantId, ad]);
  return rows[0].id as string;
}

beforeEach(async () => {
  db = await createTestDb();
  seed = await seedTwoTenants(db);
});
afterEach(async () => {
  await db.close();
});

describe("tenant_legal_identity — Faz 2 kalan alanlar", () => {
  it("ticaret_sicil_no ve kayit_tutan_kurulus alanları serbest/format-kontrollü kabul edilir", async () => {
    const { rows } = await db.sql(
      `insert into public.tenant_legal_identity (tenant_id, ticaret_sicil_no, kayit_tutan_kurulus_lei, kayit_tutan_kurulus_adi)
       values ($1, '123456', '5493001KJTIIGC8Y1R12', 'Grup Ana Ortaklığı A.Ş.') returning ticaret_sicil_no, kayit_tutan_kurulus_lei`,
      [seed.A.tenantId],
    );
    expect(rows[0].ticaret_sicil_no).toBe("123456");
    expect(rows[0].kayit_tutan_kurulus_lei).toBe("5493001KJTIIGC8Y1R12");
  });

  it("kayit_tutan_kurulus_lei format guard (LEI 20 karakter ISO 17442)", async () => {
    await expect(
      db.sql(`insert into public.tenant_legal_identity (tenant_id, kayit_tutan_kurulus_lei) values ($1, 'KISA')`, [seed.A.tenantId]),
    ).rejects.toThrow();
  });
});

describe("third_party_contracts — RoI sözleşme alanları", () => {
  it("ict_hizmet_turu_kod ict_service_types'a FK'lidir (var olmayan kod reddedilir)", async () => {
    const tpId = await tedarikciEkle(seed.A.tenantId);
    await expect(sozlesmeEkle(seed.A.tenantId, tpId, { ict_hizmet_turu_kod: "S99" })).rejects.toThrow();
  });

  it("geçerli hizmet türü koduyla sözleşme oluşturulur", async () => {
    const kod = await hizmetTuruEkle("S07");
    const tpId = await tedarikciEkle(seed.A.tenantId);
    const cid = await sozlesmeEkle(seed.A.tenantId, tpId, { ict_hizmet_turu_kod: kod, veri_saklama_ulkesi: "TR" });
    const { rows } = await db.sql(`select ict_hizmet_turu_kod, veri_saklama_ulkesi from public.third_party_contracts where id = $1`, [cid]);
    expect(rows[0].ict_hizmet_turu_kod).toBe("S07");
    expect(rows[0].veri_saklama_ulkesi).toBe("TR");
  });

  it("veri_saklama_ulkesi format guard (ISO 3166-1 alpha-2)", async () => {
    const tpId = await tedarikciEkle(seed.A.tenantId);
    await expect(sozlesmeEkle(seed.A.tenantId, tpId, { veri_saklama_ulkesi: "TUR" })).rejects.toThrow();
  });

  it("bildirim_suresi negatif olamaz", async () => {
    const tpId = await tedarikciEkle(seed.A.tenantId);
    const cid = await sozlesmeEkle(seed.A.tenantId, tpId);
    await expect(
      db.sql(`update public.third_party_contracts set bildirim_suresi_kurum_gun = -1 where id = $1`, [cid]),
    ).rejects.toThrow();
  });
});

describe("fourth_parties — alt yüklenici zinciri (B_05.02)", () => {
  it("sözleşmeye ve hizmet türüne bağlı alt yüklenici eklenebilir, sira >= 2", async () => {
    const kod = await hizmetTuruEkle("S09");
    const tpId = await tedarikciEkle(seed.A.tenantId);
    const cid = await sozlesmeEkle(seed.A.tenantId, tpId, { ict_hizmet_turu_kod: kod });
    const { rows } = await db.sql(
      `insert into public.fourth_parties (tenant_id, third_party_id, ad, third_party_contract_id, sira, ict_hizmet_turu_kod)
       values ($1, $2, 'Alt Yüklenici A.Ş.', $3, 2, $4) returning sira`,
      [seed.A.tenantId, tpId, cid, kod],
    );
    expect(rows[0].sira).toBe(2);
  });

  it("sira 1 olamaz (doğrudan sağlayıcı third_party'nin kendisi, örtük)", async () => {
    const tpId = await tedarikciEkle(seed.A.tenantId);
    await expect(
      db.sql(`insert into public.fourth_parties (tenant_id, third_party_id, ad, sira) values ($1, $2, 'X', 1)`, [seed.A.tenantId, tpId]),
    ).rejects.toThrow();
  });
});

describe("third_party_contract_critical_services — açık mapping (tier ile birleştirilmez)", () => {
  it("sözleşme + kritik hizmet eşlenebilir, aynı çift ikinci kez eklenemez (unique)", async () => {
    const tpId = await tedarikciEkle(seed.A.tenantId);
    const cid = await sozlesmeEkle(seed.A.tenantId, tpId);
    const csId = await kritikHizmetEkle(seed.A.tenantId);
    await db.sql(
      `insert into public.third_party_contract_critical_services (tenant_id, third_party_contract_id, critical_service_id) values ($1, $2, $3)`,
      [seed.A.tenantId, cid, csId],
    );
    await expect(
      db.sql(
        `insert into public.third_party_contract_critical_services (tenant_id, third_party_contract_id, critical_service_id) values ($1, $2, $3)`,
        [seed.A.tenantId, cid, csId],
      ),
    ).rejects.toThrow();
  });

  it("cross-tenant: B, A'nın eşlemesini göremez", async () => {
    const tpId = await tedarikciEkle(seed.A.tenantId);
    const cid = await sozlesmeEkle(seed.A.tenantId, tpId);
    const csId = await kritikHizmetEkle(seed.A.tenantId);
    await db.sql(
      `insert into public.third_party_contract_critical_services (tenant_id, third_party_contract_id, critical_service_id) values ($1, $2, $3)`,
      [seed.A.tenantId, cid, csId],
    );
    const { rows } = await db.asUser(seed.B.userId, `select id from public.third_party_contract_critical_services`);
    expect(rows).toHaveLength(0);
  });

  it("eşleme oluşturunca audit_log'a düşer", async () => {
    const tpId = await tedarikciEkle(seed.A.tenantId);
    const cid = await sozlesmeEkle(seed.A.tenantId, tpId);
    const csId = await kritikHizmetEkle(seed.A.tenantId);
    await db.asUser(
      seed.A.userId,
      `insert into public.third_party_contract_critical_services (tenant_id, third_party_contract_id, critical_service_id) values ($1, $2, $3)`,
      [seed.A.tenantId, cid, csId],
    );
    const { rows } = await db.sql(
      `select actor_id from public.audit_log where eylem = 'sozlesme_kritik_fonksiyon_eslendi' and tenant_id = $1`,
      [seed.A.tenantId],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].actor_id).toBe(seed.A.userId);
  });

  it("third_parties.tier bu tabloda hiç yok — şema seviyesinde ayrık kalır", async () => {
    const { rows } = await db.sql(
      `select column_name from information_schema.columns where table_name = 'third_party_contract_critical_services' and column_name = 'tier'`,
    );
    expect(rows).toHaveLength(0);
  });
});
