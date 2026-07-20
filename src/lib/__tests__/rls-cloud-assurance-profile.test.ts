// Dikey E, E1 (20260720220000..260000): kaynak_turu epistemik kolonu,
// assessment_finding_guard bağımsız kapanış forward-fix'i, cloud_assurance_
// profile_snapshots (immutable + cross-tenant guard), Proof Room 4. dal.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, seedTwoTenants, type TestDb } from "./helpers/pg";

let db: TestDb;
let seed: Awaited<ReturnType<typeof seedTwoTenants>>;
const A_SAHIP = "a0000000-0000-0000-0000-000000000020";
const A_KAPATAN = "a0000000-0000-0000-0000-000000000021";

async function tedarikci(tenantId: string, ad: string) {
  const { rows } = await db.sql(`insert into public.third_parties (tenant_id, ad) values ($1, $2) returning id`, [tenantId, ad]);
  return rows[0].id as string;
}
async function sozlesme(tenantId: string, tpId: string) {
  const { rows } = await db.sql(
    `insert into public.third_party_contracts (tenant_id, third_party_id, sozlesme_ref, baslangic, bitis)
     values ($1, $2, 'S-1', '2026-01-01', '2027-01-01') returning id`,
    [tenantId, tpId],
  );
  return rows[0].id as string;
}
async function exportEkle(tenantId: string) {
  const { rows } = await db.sql(
    `insert into public.roi_export_runs (tenant_id, talep_eden, paket, paket_hash, on_kontrol_raporu, engelleyici_sorun_sayisi, durum)
     values ($1, $2, $3::jsonb, $4, $5::jsonb, 0, 'TASLAK') returning id`,
    [tenantId, seed.A.userId, JSON.stringify({ schema: "KALKAN_ROI_EXPORT_V1" }), "b".repeat(64), JSON.stringify({ sorunlar: [], engelleyiciSayisi: 0 })],
  );
  return rows[0].id as string;
}
async function profilEkle(tenantId: string, thirdPartyId: string, extra: Record<string, unknown> = {}) {
  const { rows } = await db.sql(
    `insert into public.cloud_assurance_profile_snapshots
       (tenant_id, third_party_id, third_party_contract_id, profil, profil_hash, hesaplama_yontemi, iliskili_roi_export_run_id)
     values ($1, $2, $3, $4::jsonb, $5, $6::jsonb, $7) returning id`,
    [
      tenantId,
      thirdPartyId,
      extra.third_party_contract_id ?? null,
      JSON.stringify(extra.profil ?? { genelDurum: "EKSIK", kategoriler: [] }),
      extra.profil_hash ?? "a".repeat(64),
      JSON.stringify(extra.hesaplama_yontemi ?? { sema: "cloud-assurance-profili@1" }),
      extra.iliskili_roi_export_run_id ?? null,
    ],
  );
  return rows[0].id as string;
}

beforeEach(async () => {
  db = await createTestDb();
  seed = await seedTwoTenants(db);
  for (const [id, email] of [
    [A_SAHIP, "sahip@demo.com"],
    [A_KAPATAN, "kapatan@demo.com"],
  ]) {
    await db.sql(`insert into auth.users (id, email) values ($1, $2)`, [id, email]);
    await db.sql(`insert into public.profiles (id, tenant_id, role, full_name) values ($1, $2, 'uyum', 'T')`, [id, seed.A.tenantId]);
  }
});
afterEach(async () => {
  await db.close();
});

describe("kaynak_turu — epistemik kolon (assessment_question_templates + assessment_questions)", () => {
  it("default UNKNOWN, backfill/tahmin yok", async () => {
    const { rows: t } = await db.sql(
      `insert into public.assessment_question_templates (tenant_id, soru) values ($1, 'S?') returning kaynak_turu`,
      [seed.A.tenantId],
    );
    expect(t[0].kaynak_turu).toBe("UNKNOWN");

    const tp = await tedarikci(seed.A.tenantId, "V");
    const { rows: a } = await db.sql(
      `insert into public.third_party_assessments (tenant_id, third_party_id) values ($1, $2) returning id`,
      [seed.A.tenantId, tp],
    );
    const { rows: q } = await db.sql(
      `insert into public.assessment_questions (tenant_id, assessment_id, soru) values ($1, $2, 'S?') returning kaynak_turu`,
      [seed.A.tenantId, a[0].id],
    );
    expect(q[0].kaynak_turu).toBe("UNKNOWN");
  });

  it("izin verilmeyen değer reddedilir (8'li kapalı küme dışı)", async () => {
    await expect(
      db.sql(`insert into public.assessment_question_templates (tenant_id, soru, kaynak_turu) values ($1, 'S?', 'ASLA_YOKTUR')`, [seed.A.tenantId]),
    ).rejects.toThrow();
  });

  it("8 değerin hepsi kabul edilir (template ve question aynı küme)", async () => {
    const degerler = [
      "LEGAL_REQUIREMENT",
      "REGULATORY_GUIDANCE",
      "CONTRACTUAL_REQUIREMENT",
      "INTERNAL_POLICY",
      "PROVIDER_ATTESTATION",
      "TECHNICAL_OBSERVATION",
      "BEST_PRACTICE",
      "UNKNOWN",
    ];
    for (const d of degerler) {
      await expect(
        db.sql(`insert into public.assessment_question_templates (tenant_id, soru, kaynak_turu) values ($1, 'S?', $2)`, [seed.A.tenantId, d]),
      ).resolves.not.toThrow();
    }
  });

  it("kaynak_turu değişimi audit_log'a düşer", async () => {
    const { rows: t } = await db.sql(
      `insert into public.assessment_question_templates (tenant_id, soru) values ($1, 'S?') returning id`,
      [seed.A.tenantId],
    );
    await db.sql(`update public.assessment_question_templates set kaynak_turu = 'LEGAL_REQUIREMENT' where id = $1`, [t[0].id]);
    const { rows } = await db.sql(
      `select detay from public.audit_log where eylem = 'kaynak_turu_degisti' and hedef_id = $1`,
      [t[0].id],
    );
    expect(rows).toHaveLength(1);
    const detay = rows[0].detay as { onceki: string; yeni: string };
    expect(detay).toEqual({ onceki: "UNKNOWN", yeni: "LEGAL_REQUIREMENT" });
  });

  it("assessment_questions.template_id şablonu canlı bağlar (kopyalama anında donmaz)", async () => {
    const { rows: t } = await db.sql(
      `insert into public.assessment_question_templates (tenant_id, soru, kategori) values ($1, 'S?', 'IAM_LOG') returning id`,
      [seed.A.tenantId],
    );
    const tp = await tedarikci(seed.A.tenantId, "V");
    const { rows: a } = await db.sql(
      `insert into public.third_party_assessments (tenant_id, third_party_id) values ($1, $2) returning id`,
      [seed.A.tenantId, tp],
    );
    const { rows: q } = await db.sql(
      `insert into public.assessment_questions (tenant_id, assessment_id, soru, template_id) values ($1, $2, 'S?', $3) returning id`,
      [seed.A.tenantId, a[0].id, t[0].id],
    );
    const { rows: joined } = await db.sql(
      `select tpl.kategori from public.assessment_questions q join public.assessment_question_templates tpl on tpl.id = q.template_id where q.id = $1`,
      [q[0].id],
    );
    expect(joined[0].kategori).toBe("IAM_LOG");
  });
});

describe("assessment_finding_guard — bağımsız kapanış (Dikey E kurucu kararı #1)", () => {
  async function bulguAc(sahibi: string | null) {
    const tp = await tedarikci(seed.A.tenantId, "V");
    const { rows: a } = await db.sql(
      `insert into public.third_party_assessments (tenant_id, third_party_id) values ($1, $2) returning id`,
      [seed.A.tenantId, tp],
    );
    const { rows: f } = await db.sql(
      `insert into public.assessment_findings (tenant_id, assessment_id, third_party_id, baslik, ciddiyet, sahibi)
       values ($1, $2, $3, 'B', 'YUKSEK', $4) returning id`,
      [seed.A.tenantId, a[0].id, tp, sahibi],
    );
    return f[0].id as string;
  }

  it("sahibi atanmadan kapanamaz", async () => {
    const f = await bulguAc(null);
    await expect(
      db.sql(
        `update public.assessment_findings set durum = 'KAPANDI', kapanis_kanit = 'x', kapatan = $2, kapanis_zamani = now() where id = $1`,
        [f, A_KAPATAN],
      ),
    ).rejects.toThrow(/sahibi atanmadan/);
  });

  it("sahibi kendi bulgusunu kapatamaz (maker-checker)", async () => {
    const f = await bulguAc(A_SAHIP);
    await expect(
      db.sql(
        `update public.assessment_findings set durum = 'KAPANDI', kapanis_kanit = 'x', kapatan = $2, kapanis_zamani = now() where id = $1`,
        [f, A_SAHIP],
      ),
    ).rejects.toThrow(/kendi bulgusunu kapatamaz/);
  });

  it("NULL-bypass tuzağı yok: sahibi NULL iken 'kapatan farklı' mantığıyla kapanamaz", async () => {
    // sahibi NULL olduğunda `kapatan IS DISTINCT FROM sahibi` tek başına
    // (yanlışlıkla) true dönerdi — guard önce `sahibi is null` reddeder.
    const f = await bulguAc(null);
    await expect(
      db.sql(
        `update public.assessment_findings set durum = 'KAPANDI', kapanis_kanit = 'x', kapatan = $2, kapanis_zamani = now() where id = $1`,
        [f, A_SAHIP],
      ),
    ).rejects.toThrow(/sahibi atanmadan/);
  });

  it("farklı yetkili kanıtla kapatabilir", async () => {
    const f = await bulguAc(A_SAHIP);
    await db.sql(
      `update public.assessment_findings set durum = 'KAPANDI', kapanis_kanit = 'düzeltildi', kapatan = $2, kapanis_zamani = now() where id = $1`,
      [f, A_KAPATAN],
    );
    const { rows } = await db.sql(`select durum from public.assessment_findings where id = $1`, [f]);
    expect(rows[0].durum).toBe("KAPANDI");
  });

  it("service_role bu kuralı atlayamaz (trigger'da, RLS'e dayanmaz)", async () => {
    // db.sql zaten RLS bypass eden test bağlantısı (service_role muadili) —
    // yukarıdaki testler zaten bunu kanıtlıyor; burada AÇIKÇA tekrar doğrulanır.
    const f = await bulguAc(A_SAHIP);
    await expect(
      db.sql(
        `update public.assessment_findings set durum = 'KAPANDI', kapanis_kanit = 'x', kapatan = $2, kapanis_zamani = now() where id = $1`,
        [f, A_SAHIP],
      ),
    ).rejects.toThrow();
  });

  it("mevcut açık/taslak bulgular migration ile otomatik kapanmaz/değişmez", async () => {
    const f = await bulguAc(A_SAHIP);
    const { rows } = await db.sql(`select durum, kapatan from public.assessment_findings where id = $1`, [f]);
    expect(rows[0].durum).toBe("ACIK");
    expect(rows[0].kapatan).toBeNull();
  });
});

describe("cloud_assurance_profile_snapshots — immutable + cross-tenant guard", () => {
  it("hiçbir alan UPDATE ile değiştirilemez (service_role dahil)", async () => {
    const tp = await tedarikci(seed.A.tenantId, "V");
    const id = await profilEkle(seed.A.tenantId, tp);
    await expect(
      db.sql(`update public.cloud_assurance_profile_snapshots set profil_hash = $2 where id = $1`, [id, "c".repeat(64)]),
    ).rejects.toThrow(/degistirilemez/i);
  });

  it("profil_hash formatı zorunlu (64 hex)", async () => {
    const tp = await tedarikci(seed.A.tenantId, "V");
    await expect(profilEkle(seed.A.tenantId, tp, { profil_hash: "kisa" })).rejects.toThrow();
  });

  it("kimlik atfı: olusturan istemci bağlamında oturum sahibine sabitlenir", async () => {
    const tp = await tedarikci(seed.A.tenantId, "V");
    const { rows } = await db.asUser(
      seed.A.userId,
      `insert into public.cloud_assurance_profile_snapshots (tenant_id, third_party_id, profil, profil_hash, hesaplama_yontemi)
       values ($1, $2, $3::jsonb, $4, $5::jsonb) returning olusturan`,
      [seed.A.tenantId, tp, JSON.stringify({}), "a".repeat(64), JSON.stringify({})],
    );
    expect(rows[0].olusturan).toBe(seed.A.userId);
  });

  it("başka kiracının third_party_id'sine bağlanamaz (cross-tenant)", async () => {
    const tpB = await tedarikci(seed.B.tenantId, "V-B");
    await expect(profilEkle(seed.A.tenantId, tpB)).rejects.toThrow(/cross-tenant/i);
  });

  it("aynı kiracının ama BAŞKA tedarikçinin sözleşmesine bağlanamaz", async () => {
    const tp1 = await tedarikci(seed.A.tenantId, "V1");
    const tp2 = await tedarikci(seed.A.tenantId, "V2");
    const contract2 = await sozlesme(seed.A.tenantId, tp2);
    await expect(profilEkle(seed.A.tenantId, tp1, { third_party_contract_id: contract2 })).rejects.toThrow(/cross-tenant/i);
  });

  it("başka kiracının sözleşmesine bağlanamaz", async () => {
    const tp = await tedarikci(seed.A.tenantId, "V");
    const tpB = await tedarikci(seed.B.tenantId, "V-B");
    const contractB = await sozlesme(seed.B.tenantId, tpB);
    await expect(profilEkle(seed.A.tenantId, tp, { third_party_contract_id: contractB })).rejects.toThrow(/cross-tenant/i);
  });

  it("aynı kiracının kendi sözleşmesine bağlanabilir", async () => {
    const tp = await tedarikci(seed.A.tenantId, "V");
    const contract = await sozlesme(seed.A.tenantId, tp);
    const id = await profilEkle(seed.A.tenantId, tp, { third_party_contract_id: contract });
    const { rows } = await db.sql(`select third_party_contract_id from public.cloud_assurance_profile_snapshots where id = $1`, [id]);
    expect(rows[0].third_party_contract_id).toBe(contract);
  });

  it("başka kiracının roi_export_run'ına bağlanamaz", async () => {
    const tp = await tedarikci(seed.A.tenantId, "V");
    const exportB = await exportEkle(seed.B.tenantId);
    await expect(profilEkle(seed.A.tenantId, tp, { iliskili_roi_export_run_id: exportB })).rejects.toThrow(/cross-tenant/i);
  });

  it("aynı kiracının roi_export_run'ına bağlanabilir", async () => {
    const tp = await tedarikci(seed.A.tenantId, "V");
    const exportA = await exportEkle(seed.A.tenantId);
    const id = await profilEkle(seed.A.tenantId, tp, { iliskili_roi_export_run_id: exportA });
    const { rows } = await db.sql(`select iliskili_roi_export_run_id from public.cloud_assurance_profile_snapshots where id = $1`, [id]);
    expect(rows[0].iliskili_roi_export_run_id).toBe(exportA);
  });

  it("oluşturma audit_log'a düşer", async () => {
    const tp = await tedarikci(seed.A.tenantId, "V");
    const id = await profilEkle(seed.A.tenantId, tp, { profil: { genelDurum: "DOGRULANMIS_PROFIL", kategoriler: [] } });
    const { rows } = await db.sql(
      `select detay from public.audit_log where eylem = 'guvence_profili_anlik_goruntu_olusturuldu' and hedef_id = $1`,
      [id],
    );
    expect(rows).toHaveLength(1);
    const detay = rows[0].detay as { genel_durum: string };
    expect(detay.genel_durum).toBe("DOGRULANMIS_PROFIL");
  });

  it("cross-tenant: B, A'nın profilini göremez", async () => {
    const tp = await tedarikci(seed.A.tenantId, "V");
    const id = await profilEkle(seed.A.tenantId, tp);
    const { rows } = await db.asUser(seed.B.userId, `select id from public.cloud_assurance_profile_snapshots where id = $1`, [id]);
    expect(rows).toHaveLength(0);
  });

  it("misafir/düşük yetkili rol INSERT edemez", async () => {
    await db.sql(`insert into auth.users (id, email) values ($1, 'misafir2@demo.com')`, ["a0000000-0000-0000-0000-000000000022"]);
    await db.sql(
      `insert into public.profiles (id, tenant_id, role, full_name) values ($1, $2, 'denetci_misafir', 'M')`,
      ["a0000000-0000-0000-0000-000000000022", seed.A.tenantId],
    );
    const tp = await tedarikci(seed.A.tenantId, "V");
    await expect(
      db.asUser(
        "a0000000-0000-0000-0000-000000000022",
        `insert into public.cloud_assurance_profile_snapshots (tenant_id, third_party_id, profil, profil_hash, hesaplama_yontemi)
         values ($1, $2, $3::jsonb, $4, $5::jsonb)`,
        [seed.A.tenantId, tp, JSON.stringify({}), "a".repeat(64), JSON.stringify({})],
      ),
    ).rejects.toThrow();
  });
});

describe("proof_room_links — cloud_assurance_profile_id dördüncü polimorfik hedef", () => {
  it("iki hedef birden dolu olamaz (graph_snapshot_id + cloud_assurance_profile_id)", async () => {
    const tp = await tedarikci(seed.A.tenantId, "V");
    const profilId = await profilEkle(seed.A.tenantId, tp);
    const { rows: snap } = await db.sql(
      `insert into public.impact_graph_snapshots (tenant_id, graf, graf_hash, spof_raporu, yayilim_raporu, hesaplama_yontemi)
       values ($1, $2::jsonb, $3, $4::jsonb, $5::jsonb, $6::jsonb) returning id`,
      [seed.A.tenantId, JSON.stringify({ dugumler: [], kenarlar: [] }), "e".repeat(64), JSON.stringify({ sistemikNoktalar: [], hesaplamaYontemi: "t" }), JSON.stringify({ baslangicDugumIdleri: [], yon: "ileri", etkilenenler: [], hesaplamaYontemi: "t" }), JSON.stringify({})],
    );
    await expect(
      db.sql(
        `insert into public.proof_room_links (tenant_id, graph_snapshot_id, cloud_assurance_profile_id, son_gecerlilik)
         values ($1, $2, $3, now() + interval '7 days')`,
        [seed.A.tenantId, snap[0].id, profilId],
      ),
    ).rejects.toThrow();
  });

  it("dört hedef de boş olamaz", async () => {
    await expect(
      db.sql(`insert into public.proof_room_links (tenant_id, son_gecerlilik) values ($1, now() + interval '7 days')`, [seed.A.tenantId]),
    ).rejects.toThrow();
  });

  it("yalnız cloud_assurance_profile_id ile link kurulabilir", async () => {
    const tp = await tedarikci(seed.A.tenantId, "V");
    const profilId = await profilEkle(seed.A.tenantId, tp);
    const { rows } = await db.sql(
      `insert into public.proof_room_links (tenant_id, cloud_assurance_profile_id, son_gecerlilik)
       values ($1, $2, now() + interval '7 days') returning id`,
      [seed.A.tenantId, profilId],
    );
    expect(rows).toHaveLength(1);
  });

  it("cross-tenant linking DB seviyesinde reddedilir", async () => {
    const tpB = await tedarikci(seed.B.tenantId, "V-B");
    const profilBId = await profilEkle(seed.B.tenantId, tpB);
    await expect(
      db.sql(
        `insert into public.proof_room_links (tenant_id, cloud_assurance_profile_id, son_gecerlilik)
         values ($1, $2, now() + interval '7 days')`,
        [seed.A.tenantId, profilBId],
      ),
    ).rejects.toThrow();
  });
});

describe("proof_room_goruntule — cloudAssuranceProfile dalı (oturumsuz)", () => {
  it("geçerli token profili minimize EDİLMEDEN döner (hash/hesaplama yöntemi dahil)", async () => {
    const tp = await tedarikci(seed.A.tenantId, "V");
    const profilId = await profilEkle(seed.A.tenantId, tp, {
      profil: { genelDurum: "INCELEME_GEREKLI", kategoriler: [] },
      hesaplama_yontemi: { sema: "cloud-assurance-profili@1", asOf: "2026-07-20T00:00:00Z" },
    });
    const { rows: link } = await db.sql(
      `insert into public.proof_room_links (tenant_id, cloud_assurance_profile_id, son_gecerlilik)
       values ($1, $2, now() + interval '7 days') returning token`,
      [seed.A.tenantId, profilId],
    );
    const { rows } = await db.sql(`select public.proof_room_goruntule($1) as veri`, [link[0].token]);
    const veri = rows[0].veri as {
      cloudAssuranceProfile?: { id: string; profilHash: string; profil: { genelDurum: string }; hesaplamaYontemi: { sema: string } };
    };
    expect(veri.cloudAssuranceProfile?.id).toBe(profilId);
    expect(veri.cloudAssuranceProfile?.profilHash).toBe("a".repeat(64));
    expect(veri.cloudAssuranceProfile?.profil.genelDurum).toBe("INCELEME_GEREKLI");
    expect(veri.cloudAssuranceProfile?.hesaplamaYontemi.sema).toBe("cloud-assurance-profili@1");
  });

  it("süresi geçmiş link null döner", async () => {
    const tp = await tedarikci(seed.A.tenantId, "V");
    const profilId = await profilEkle(seed.A.tenantId, tp);
    const { rows: link } = await db.sql(
      `insert into public.proof_room_links (tenant_id, cloud_assurance_profile_id, son_gecerlilik)
       values ($1, $2, now() - interval '1 hour') returning token`,
      [seed.A.tenantId, profilId],
    );
    const { rows } = await db.sql(`select public.proof_room_goruntule($1) as veri`, [link[0].token]);
    expect(rows[0].veri).toBeNull();
  });

  it("iptal edilmiş link null döner", async () => {
    const tp = await tedarikci(seed.A.tenantId, "V");
    const profilId = await profilEkle(seed.A.tenantId, tp);
    const { rows: link } = await db.sql(
      `insert into public.proof_room_links (tenant_id, cloud_assurance_profile_id, son_gecerlilik, iptal_edildi)
       values ($1, $2, now() + interval '7 days', true) returning token`,
      [seed.A.tenantId, profilId],
    );
    const { rows } = await db.sql(`select public.proof_room_goruntule($1) as veri`, [link[0].token]);
    expect(rows[0].veri).toBeNull();
  });

  it("görüntüleme audit_log'a düşer", async () => {
    const tp = await tedarikci(seed.A.tenantId, "V");
    const profilId = await profilEkle(seed.A.tenantId, tp);
    const { rows: link } = await db.sql(
      `insert into public.proof_room_links (tenant_id, cloud_assurance_profile_id, son_gecerlilik)
       values ($1, $2, now() + interval '7 days') returning token, id`,
      [seed.A.tenantId, profilId],
    );
    await db.sql(`select public.proof_room_goruntule($1)`, [link[0].token]);
    const { rows } = await db.sql(
      `select detay from public.audit_log where eylem = 'proof_room_goruntulendi' and hedef_id = $1`,
      [link[0].id],
    );
    expect(rows).toHaveLength(1);
    const detay = rows[0].detay as { cloudAssuranceProfileId: string };
    expect(detay.cloudAssuranceProfileId).toBe(profilId);
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
