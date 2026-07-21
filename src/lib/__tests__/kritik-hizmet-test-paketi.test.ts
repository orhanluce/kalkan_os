import { describe, expect, it } from "vitest";
import {
  kritikHizmetTestPaketiOlustur,
  KRITIK_HIZMET_TEST_PAKETI_SCHEMA,
  type ImpactToleranceInput,
  type KritikHizmetTestPaketiGirdisi,
} from "../kritik-hizmet-test-paketi";

const ASOF = "2026-07-21T12:00:00.000Z";

function temelGirdi(overrides: Partial<KritikHizmetTestPaketiGirdisi> = {}): KritikHizmetTestPaketiGirdisi {
  return {
    criticalService: { id: "svc-1", ad: "Ödeme Sistemi", durum: "AKTIF" },
    asOf: ASOF,
    testTanimlari: [],
    serviceControlIds: [],
    kosular: [],
    kanitlar: [],
    bulgular: [],
    ...overrides,
  };
}

describe("kritikHizmetTestPaketiOlustur — kapsam çözümleme", () => {
  it("1) doğrudan bağlı test tanımı pakete girer", () => {
    const girdi = temelGirdi({
      testTanimlari: [{ id: "t1", controlId: "c1", tur: "MANUAL_PROCEDURE", ad: "T1", tazelikGun: null, criticalServiceId: "svc-1" }],
    });
    const paket = kritikHizmetTestPaketiOlustur(girdi);
    expect(paket.testler).toHaveLength(1);
    expect(paket.testler[0].bagTuru).toBe("DIRECT");
  });

  it("2) kontrol üzerinden bağlı test tanımı pakete girer", () => {
    const girdi = temelGirdi({
      testTanimlari: [{ id: "t1", controlId: "c1", tur: "MANUAL_PROCEDURE", ad: "T1", tazelikGun: null, criticalServiceId: null }],
      serviceControlIds: ["c1"],
    });
    const paket = kritikHizmetTestPaketiOlustur(girdi);
    expect(paket.testler).toHaveLength(1);
    expect(paket.testler[0].bagTuru).toBe("VIA_CRITICAL_SERVICE_CONTROL");
  });

  it("3) her iki yoldan bağlı tanım tekilleşir ve BOTH olur", () => {
    const girdi = temelGirdi({
      testTanimlari: [{ id: "t1", controlId: "c1", tur: "MANUAL_PROCEDURE", ad: "T1", tazelikGun: null, criticalServiceId: "svc-1" }],
      serviceControlIds: ["c1"],
    });
    const paket = kritikHizmetTestPaketiOlustur(girdi);
    expect(paket.testler).toHaveLength(1);
    expect(paket.testler[0].bagTuru).toBe("BOTH");
  });

  it("4) serbest metin benzerliğiyle test dahil edilmez (yalnız gerçek referanslar sayılır)", () => {
    const girdi = temelGirdi({
      testTanimlari: [{ id: "t1", controlId: "baska-kontrol", tur: "MANUAL_PROCEDURE", ad: "Ödeme Sistemi testi (isim benzer)", tazelikGun: null, criticalServiceId: null }],
      serviceControlIds: ["c1"],
    });
    const paket = kritikHizmetTestPaketiOlustur(girdi);
    expect(paket.testler).toHaveLength(0);
    expect(paket.genelDurum).toBe("TEST_YOK");
  });
});

describe("kritikHizmetTestPaketiOlustur — koşu seçimi", () => {
  it("5) her tanım için en güncel koşu doğru seçilir", () => {
    const girdi = temelGirdi({
      testTanimlari: [{ id: "t1", controlId: "c1", tur: "MANUAL_PROCEDURE", ad: "T1", tazelikGun: null, criticalServiceId: "svc-1" }],
      kosular: [
        { id: "r1", testDefinitionId: "t1", seq: 1, sonuc: "FAILED", calistiAt: "2026-07-01T00:00:00.000Z", evidenceId: null },
        { id: "r2", testDefinitionId: "t1", seq: 2, sonuc: "PASSED", calistiAt: "2026-07-10T00:00:00.000Z", evidenceId: null },
      ],
    });
    const paket = kritikHizmetTestPaketiOlustur(girdi);
    expect(paket.testler[0].enGuncelKosu?.testRunId).toBe("r2");
    expect(paket.testler[0].enGuncelKosu?.sonuc).toBe("PASSED");
  });

  it("6) aynı timestamp varsa deterministik tie-break (seq) uygulanır", () => {
    const girdi = temelGirdi({
      testTanimlari: [{ id: "t1", controlId: "c1", tur: "MANUAL_PROCEDURE", ad: "T1", tazelikGun: null, criticalServiceId: "svc-1" }],
      kosular: [
        { id: "r1", testDefinitionId: "t1", seq: 1, sonuc: "FAILED", calistiAt: "2026-07-10T00:00:00.000Z", evidenceId: null },
        { id: "r2", testDefinitionId: "t1", seq: 5, sonuc: "PASSED", calistiAt: "2026-07-10T00:00:00.000Z", evidenceId: null },
      ],
    });
    const paket = kritikHizmetTestPaketiOlustur(girdi);
    expect(paket.testler[0].enGuncelKosu?.testRunId).toBe("r2");
  });

  it("7) eski FAILED + yeni PASSED: güncel sonuç PASSED, tarihsel FAILED sayısı korunur", () => {
    const girdi = temelGirdi({
      testTanimlari: [{ id: "t1", controlId: "c1", tur: "MANUAL_PROCEDURE", ad: "T1", tazelikGun: null, criticalServiceId: "svc-1" }],
      kosular: [
        { id: "r1", testDefinitionId: "t1", seq: 1, sonuc: "FAILED", calistiAt: "2026-07-01T00:00:00.000Z", evidenceId: null },
        { id: "r2", testDefinitionId: "t1", seq: 2, sonuc: "PASSED", calistiAt: "2026-07-10T00:00:00.000Z", evidenceId: null },
      ],
    });
    const paket = kritikHizmetTestPaketiOlustur(girdi);
    expect(paket.testler[0].enGuncelKosu?.sonuc).toBe("PASSED");
    expect(paket.testler[0].tarihselOzet.sonucDagilimi.FAILED).toBe(1);
    expect(paket.testler[0].tarihselOzet.sonucDagilimi.PASSED).toBe(1);
    expect(paket.testler[0].tarihselOzet.toplamKosu).toBe(2);
    expect(paket.genelDurum).toBe("DOGRULANMIS");
  });

  it("8) STALE güncel koşu (veya tazelik penceresi geçmiş PASSED) doğrulanmış sayılmaz", () => {
    const girdiStaleSonuc = temelGirdi({
      testTanimlari: [{ id: "t1", controlId: "c1", tur: "MANUAL_PROCEDURE", ad: "T1", tazelikGun: 90, criticalServiceId: "svc-1" }],
      kosular: [{ id: "r1", testDefinitionId: "t1", seq: 1, sonuc: "STALE", calistiAt: "2026-07-01T00:00:00.000Z", evidenceId: null }],
    });
    expect(kritikHizmetTestPaketiOlustur(girdiStaleSonuc).genelDurum).toBe("INCELEME_GEREKLI");

    // PASSED ama tazelik penceresi (90 gün) çoktan geçmiş — motor bunu KENDİSİ hesaplar.
    const girdiBayatPassed = temelGirdi({
      testTanimlari: [{ id: "t1", controlId: "c1", tur: "MANUAL_PROCEDURE", ad: "T1", tazelikGun: 90, criticalServiceId: "svc-1" }],
      kosular: [{ id: "r1", testDefinitionId: "t1", seq: 1, sonuc: "PASSED", calistiAt: "2026-01-01T00:00:00.000Z", evidenceId: null }],
    });
    const paket = kritikHizmetTestPaketiOlustur(girdiBayatPassed);
    expect(paket.testler[0].enGuncelKosu?.tazelikDurumu).toBe("BAYAT");
    expect(paket.genelDurum).toBe("INCELEME_GEREKLI");
  });

  it("9) UNKNOWN, FAILED olarak yorumlanmaz (ENGELLENDI değil, INCELEME_GEREKLI)", () => {
    const girdi = temelGirdi({
      testTanimlari: [{ id: "t1", controlId: "c1", tur: "MANUAL_PROCEDURE", ad: "T1", tazelikGun: null, criticalServiceId: "svc-1" }],
      kosular: [{ id: "r1", testDefinitionId: "t1", seq: 1, sonuc: "UNKNOWN", calistiAt: "2026-07-10T00:00:00.000Z", evidenceId: null }],
    });
    expect(kritikHizmetTestPaketiOlustur(girdi).genelDurum).toBe("INCELEME_GEREKLI");
  });
});

describe("kritikHizmetTestPaketiOlustur — genel durum sınırları", () => {
  it("10) hiç test tanımı yoksa TEST_YOK", () => {
    expect(kritikHizmetTestPaketiOlustur(temelGirdi()).genelDurum).toBe("TEST_YOK");
  });

  it("11) tanım var, koşu yoksa VERI_EKSIK", () => {
    const girdi = temelGirdi({
      testTanimlari: [{ id: "t1", controlId: "c1", tur: "MANUAL_PROCEDURE", ad: "T1", tazelikGun: null, criticalServiceId: "svc-1" }],
    });
    expect(kritikHizmetTestPaketiOlustur(girdi).genelDurum).toBe("VERI_EKSIK");
    expect(kritikHizmetTestPaketiOlustur(girdi).testler[0].enGuncelKosu).toBeNull();
  });
});

describe("kritikHizmetTestPaketiOlustur — bulgu/retest görünürlüğü", () => {
  it("12) açık bulgu tarihsel ve güncel özetlerde doğru görünür", () => {
    const girdi = temelGirdi({
      testTanimlari: [{ id: "t1", controlId: "c1", tur: "MANUAL_PROCEDURE", ad: "T1", tazelikGun: null, criticalServiceId: "svc-1" }],
      kosular: [{ id: "r1", testDefinitionId: "t1", seq: 1, sonuc: "FAILED", calistiAt: "2026-07-10T00:00:00.000Z", evidenceId: null }],
      bulgular: [{ id: "f1", testDefinitionId: "t1", durum: "acik", onem: "kritik", kapatmaRetestRunId: null, kapatanBelirtildi: false }],
    });
    const paket = kritikHizmetTestPaketiOlustur(girdi);
    expect(paket.testler[0].bulguOzeti.acikBulguIdleri).toEqual(["f1"]);
    expect(paket.testler[0].bulguOzeti.kapanmisBulguIdleri).toEqual([]);
    expect(paket.genelDurum).toBe("ENGELLENDI");
  });

  it("13) kapanmış bulgu ve retest ilişkisi korunur", () => {
    const girdi = temelGirdi({
      testTanimlari: [{ id: "t1", controlId: "c1", tur: "MANUAL_PROCEDURE", ad: "T1", tazelikGun: null, criticalServiceId: "svc-1" }],
      kosular: [
        { id: "r1", testDefinitionId: "t1", seq: 1, sonuc: "FAILED", calistiAt: "2026-07-01T00:00:00.000Z", evidenceId: null },
        { id: "r2", testDefinitionId: "t1", seq: 2, sonuc: "PASSED", calistiAt: "2026-07-10T00:00:00.000Z", evidenceId: null },
      ],
      bulgular: [{ id: "f1", testDefinitionId: "t1", durum: "kapali", onem: "kritik", kapatmaRetestRunId: "r2", kapatanBelirtildi: true }],
    });
    const paket = kritikHizmetTestPaketiOlustur(girdi);
    expect(paket.testler[0].bulguOzeti.kapanmisBulguIdleri).toEqual(["f1"]);
    expect(paket.testler[0].bulguOzeti.kapanisRetestRunIdleri).toEqual(["r2"]);
    expect(paket.testler[0].bulguOzeti.bagimsizKapanmayanBulguIdleri).toEqual([]);
    expect(paket.genelDurum).toBe("DOGRULANMIS");
  });
});

describe("kritikHizmetTestPaketiOlustur — determinizm", () => {
  const girdiZengin = (): KritikHizmetTestPaketiGirdisi =>
    temelGirdi({
      testTanimlari: [
        { id: "t2", controlId: "c2", tur: "CONFIG_ASSERTION", ad: "T2", tazelikGun: 30, criticalServiceId: null },
        { id: "t1", controlId: "c1", tur: "MANUAL_PROCEDURE", ad: "T1", tazelikGun: null, criticalServiceId: "svc-1" },
      ],
      serviceControlIds: ["c2"],
      kosular: [
        { id: "r2", testDefinitionId: "t2", seq: 1, sonuc: "PASSED", calistiAt: "2026-07-15T00:00:00.000Z", evidenceId: "e1" },
        { id: "r1", testDefinitionId: "t1", seq: 1, sonuc: "PASSED", calistiAt: "2026-07-10T00:00:00.000Z", evidenceId: null },
      ],
      kanitlar: [{ id: "e1", hashSha256: "abc", gecerlilikBitis: null }],
      bulgular: [{ id: "f1", testDefinitionId: "t1", durum: "acik", onem: "orta", kapatmaRetestRunId: null, kapatanBelirtildi: false }],
    });

  it("14) aynı girdi aynı çıktıyı üretir", () => {
    const p1 = kritikHizmetTestPaketiOlustur(girdiZengin());
    const p2 = kritikHizmetTestPaketiOlustur(girdiZengin());
    expect(p1).toEqual(p2);
  });

  it("15) test sırası değişse bile çıktı (ve dolayısıyla hash'i) değişmez", () => {
    const g1 = girdiZengin();
    const g2 = girdiZengin();
    g2.testTanimlari = [...g2.testTanimlari].reverse();
    g2.kosular = [...g2.kosular].reverse();
    const p1 = kritikHizmetTestPaketiOlustur(g1);
    const p2 = kritikHizmetTestPaketiOlustur(g2);
    expect(p1).toEqual(p2);
    expect(p1.testler.map((t) => t.testDefinitionId)).toEqual(["t1", "t2"]);
  });

  it("şema sabiti doğru", () => {
    expect(kritikHizmetTestPaketiOlustur(girdiZengin()).schema).toBe(KRITIK_HIZMET_TEST_PAKETI_SCHEMA);
  });
});

describe("kritikHizmetTestPaketiOlustur — tarihsel iz tam geçmişi kopyalamaz", () => {
  it("16) yalnız sayaç/kimlik listeleri taşınır; ham koşu payload'ı (gozlem vb.) yoktur", () => {
    const girdi = temelGirdi({
      testTanimlari: [{ id: "t1", controlId: "c1", tur: "MANUAL_PROCEDURE", ad: "T1", tazelikGun: null, criticalServiceId: "svc-1" }],
      kosular: [
        { id: "r1", testDefinitionId: "t1", seq: 1, sonuc: "FAILED", calistiAt: "2026-07-01T00:00:00.000Z", evidenceId: null },
        { id: "r2", testDefinitionId: "t1", seq: 2, sonuc: "PASSED", calistiAt: "2026-07-10T00:00:00.000Z", evidenceId: null },
      ],
    });
    const paket = kritikHizmetTestPaketiOlustur(girdi);
    const tarihsel = paket.testler[0].tarihselOzet;
    expect(Object.keys(tarihsel).sort()).toEqual(["ilkKosuAt", "sonKosuAt", "sonucDagilimi", "toplamKosu"].sort());
    expect(tarihsel.toplamKosu).toBe(2);
    expect(tarihsel.ilkKosuAt).toBe("2026-07-01T00:00:00.000Z");
    expect(tarihsel.sonKosuAt).toBe("2026-07-10T00:00:00.000Z");
    // Serileştirilmiş paket JSON'unda ham koşu kimliği (r1/r2) veya "gozlem" anahtarı YOK.
    const json = JSON.stringify(paket);
    expect(json).not.toContain("r1");
    expect(json).not.toContain("gozlem");
  });
});

describe("kritikHizmetTestPaketiOlustur — F3: etki toleransı görünürlüğü (nicel karşılaştırma yok)", () => {
  const yururlukteTolerans = (overrides: Partial<ImpactToleranceInput> = {}): ImpactToleranceInput => ({
    id: "tol-1",
    version: 2,
    durum: "YURURLUKTE",
    maxKesintiSaat: 4,
    maxVeriKaybiSaat: 1,
    yonetimOnayi: true,
    onaylayanBelirtildi: true,
    onayZamani: "2026-06-01T00:00:00.000Z",
    ...overrides,
  });

  const passedTestGirdi = (impactTolerances?: ImpactToleranceInput[]): KritikHizmetTestPaketiGirdisi =>
    temelGirdi({
      testTanimlari: [{ id: "t1", controlId: "c1", tur: "RESTORE_TEST", ad: "Yedekten geri yükleme", tazelikGun: null, criticalServiceId: "svc-1" }],
      kosular: [{ id: "r1", testDefinitionId: "t1", seq: 1, sonuc: "PASSED", calistiAt: "2026-07-10T00:00:00.000Z", evidenceId: null }],
      impactTolerances,
    });

  it("F3-1) onaylı tek aktif tolerans doğru özetlenir", () => {
    const paket = kritikHizmetTestPaketiOlustur(passedTestGirdi([yururlukteTolerans()]));
    expect(paket.etkiToleransiOzeti?.durum).toBe("TOLERANS_TANIMLI_VE_ONAYLI");
    expect(paket.etkiToleransiOzeti?.toleranceId).toBe("tol-1");
    expect(paket.etkiToleransiOzeti?.version).toBe(2);
  });

  it("F3-2) RTO ve RPO ayrı ayrı gösterilir", () => {
    const paket = kritikHizmetTestPaketiOlustur(passedTestGirdi([yururlukteTolerans({ maxKesintiSaat: 6, maxVeriKaybiSaat: null })]));
    expect(paket.etkiToleransiOzeti?.maxKesintiSaat).toBe(6);
    expect(paket.etkiToleransiOzeti?.maxVeriKaybiSaat).toBeNull();
  });

  it("F3-3) RPO null ise sıfır gösterilmez (null !== 0)", () => {
    const paket = kritikHizmetTestPaketiOlustur(passedTestGirdi([yururlukteTolerans({ maxVeriKaybiSaat: null })]));
    expect(paket.etkiToleransiOzeti?.maxVeriKaybiSaat).toBeNull();
    expect(paket.etkiToleransiOzeti?.maxVeriKaybiSaat).not.toBe(0);
  });

  it("F3-4) tolerans kaydı yoksa TOLERANS_BULUNAMADI", () => {
    const paket = kritikHizmetTestPaketiOlustur(passedTestGirdi([]));
    expect(paket.etkiToleransiOzeti?.durum).toBe("TOLERANS_BULUNAMADI");
    expect(paket.etkiToleransiOzeti?.aciklamaKodu).toBe("ONAYLI_TOLERANS_YOK");
  });

  it("F3-5) yalnız TASLAK kayıt varsa TOLERANS_TANIMLI_FAKAT_ONAYSIZ, ve DOGRULANMIS INCELEME_GEREKLI'ye düşürülür", () => {
    const paket = kritikHizmetTestPaketiOlustur(
      passedTestGirdi([{ id: "tol-taslak", version: 1, durum: "TASLAK", maxKesintiSaat: 8, maxVeriKaybiSaat: 2, yonetimOnayi: false, onaylayanBelirtildi: false, onayZamani: null }]),
    );
    expect(paket.etkiToleransiOzeti?.durum).toBe("TOLERANS_TANIMLI_FAKAT_ONAYSIZ");
    expect(paket.genelDurum).toBe("INCELEME_GEREKLI");
    expect(paket.gerekceler.some((g) => g.includes("taslak"))).toBe(true);
  });

  it("F3-6) birden fazla aktif (YURURLUKTE) kayıt rastgele seçilmez — BIRDEN_FAZLA_AKTIF_TOLERANS ve DOGRULANMIS düşürülür", () => {
    const paket = kritikHizmetTestPaketiOlustur(
      passedTestGirdi([yururlukteTolerans({ id: "tol-a", version: 1 }), yururlukteTolerans({ id: "tol-b", version: 2 })]),
    );
    expect(paket.etkiToleransiOzeti?.durum).toBe("BIRDEN_FAZLA_AKTIF_TOLERANS");
    expect(paket.etkiToleransiOzeti?.toleranceId).toBeNull();
    expect(paket.genelDurum).toBe("INCELEME_GEREKLI");
  });

  it("F3-7) yürürlükteki kayıtta RTO VE RPO ikisi de null ise TOLERANS_VERISI_EKSIK", () => {
    const paket = kritikHizmetTestPaketiOlustur(passedTestGirdi([yururlukteTolerans({ maxKesintiSaat: null, maxVeriKaybiSaat: null })]));
    expect(paket.etkiToleransiOzeti?.durum).toBe("TOLERANS_VERISI_EKSIK");
    expect(paket.etkiToleransiOzeti?.aciklamaKodu).toBe("TOLERANS_EKSIK");
  });

  it("F3-8) karsilastirmaYapildi her zaman false", () => {
    for (const kayitlar of [undefined, [], [yururlukteTolerans()], [{ ...yururlukteTolerans(), durum: "TASLAK" as const }]]) {
      const paket = kritikHizmetTestPaketiOlustur(passedTestGirdi(kayitlar));
      expect(paket.etkiToleransiOzeti?.karsilastirmaYapildi).toBe(false);
    }
  });

  it("F3-9) test PASSED olsa bile 'RTO karşılandı'/'RPO karşılandı' hiçbir yerde üretilmez", () => {
    const paket = kritikHizmetTestPaketiOlustur(passedTestGirdi([yururlukteTolerans()]));
    const json = JSON.stringify(paket);
    expect(json).not.toContain("RTO karşılandı");
    expect(json).not.toContain("RPO karşılandı");
    expect(json).not.toContain("tolerans içinde");
    expect(json).not.toContain("tolerans aşıldı");
  });

  it("F3-10) tolerans yokluğu tek başına FAILED veya ENGELLENDI üretmez", () => {
    const paket = kritikHizmetTestPaketiOlustur(passedTestGirdi([]));
    expect(paket.genelDurum).toBe("DOGRULANMIS");
  });

  it("F3-11) impactTolerances girdisi hiç verilmezse (undefined) F2 davranışı birebir korunur", () => {
    const girdiF2 = passedTestGirdi(undefined);
    const paket = kritikHizmetTestPaketiOlustur(girdiF2);
    expect(paket.etkiToleransiOzeti?.durum).toBe("TOLERANS_BULUNAMADI");
    expect(paket.genelDurum).toBe("DOGRULANMIS");
  });

  it("F3-12) V1 tüketicisi gibi davranış: impactTolerances alanı yokken şema payload'ı savunmacı okunabilir (undefined tolerans, hata yok)", () => {
    const paket = kritikHizmetTestPaketiOlustur(temelGirdi());
    expect(() => JSON.stringify(paket)).not.toThrow();
    expect(paket.etkiToleransiOzeti).toBeDefined();
  });

  it("F3-13) aynı girdi (tolerans dahil) aynı hash'e denk aynı çıktıyı üretir", () => {
    const g = () => passedTestGirdi([yururlukteTolerans()]);
    expect(kritikHizmetTestPaketiOlustur(g())).toEqual(kritikHizmetTestPaketiOlustur(g()));
  });

  it("F3-14) tolerans kayıt sırası çıktıyı (ve dolayısıyla hash'i) değiştirmez", () => {
    const kayitlar = [yururlukteTolerans({ id: "tol-a", durum: "SUPERSEDED", version: 1 }), yururlukteTolerans({ id: "tol-b", version: 2 })];
    const p1 = kritikHizmetTestPaketiOlustur(passedTestGirdi(kayitlar));
    const p2 = kritikHizmetTestPaketiOlustur(passedTestGirdi([...kayitlar].reverse()));
    expect(p1).toEqual(p2);
  });

  it("F3-15) asOf dışında zaman bağımlılığı yok — aynı asOf her zaman aynı sonucu verir", () => {
    const g = () => passedTestGirdi([yururlukteTolerans()]);
    const p1 = kritikHizmetTestPaketiOlustur(g());
    const p2 = kritikHizmetTestPaketiOlustur(g());
    expect(p1.asOf).toBe(ASOF);
    expect(p1).toEqual(p2);
  });

  it("F3-16) hesaplamaYontemi.etkiToleransiYontemi karşılaştırma yapılmadığını açıkça belirtir", () => {
    const paket = kritikHizmetTestPaketiOlustur(passedTestGirdi([yururlukteTolerans()]));
    expect(paket.hesaplamaYontemi.etkiToleransiYontemi).toContain("nicel uygunluk karşılaştırması yapılmamıştır");
  });

  it("F3-17) ENGELLENDI zaten iken tolerans onaysız/çakışma varsa yine ENGELLENDI kalır (iyileştirilmez)", () => {
    const girdi = temelGirdi({
      testTanimlari: [{ id: "t1", controlId: "c1", tur: "RESTORE_TEST", ad: "T1", tazelikGun: null, criticalServiceId: "svc-1" }],
      kosular: [{ id: "r1", testDefinitionId: "t1", seq: 1, sonuc: "FAILED", calistiAt: "2026-07-10T00:00:00.000Z", evidenceId: null }],
      impactTolerances: [{ id: "tol-taslak", version: 1, durum: "TASLAK", maxKesintiSaat: 8, maxVeriKaybiSaat: 2, yonetimOnayi: false, onaylayanBelirtildi: false, onayZamani: null }],
    });
    const paket = kritikHizmetTestPaketiOlustur(girdi);
    expect(paket.genelDurum).toBe("ENGELLENDI");
  });
});
