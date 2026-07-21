import { describe, expect, it } from "vitest";
import {
  kritikHizmetTestPaketiOlustur,
  KRITIK_HIZMET_TEST_PAKETI_SCHEMA,
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
