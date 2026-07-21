import { describe, expect, it } from "vitest";
import {
  kurtarmaOlcumuOlustur,
  kurtarmaOlcumuHash,
  KurtarmaOlcumuHatasi,
  RECOVERY_MEASUREMENT_SCHEMA,
  type KurtarmaOlcumuGirdisi,
} from "../recovery-measurement";

/** Çağrının belirtilen `kod` ile KurtarmaOlcumuHatasi fırlattığını doğrular. */
function kodBekle(fn: () => unknown, kod: string): void {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(KurtarmaOlcumuHatasi);
    expect((e as KurtarmaOlcumuHatasi).kod).toBe(kod);
    return;
  }
  throw new Error(`Beklenen hata (${kod}) fırlatılmadı`);
}

function temel(overrides: Partial<KurtarmaOlcumuGirdisi> = {}): KurtarmaOlcumuGirdisi {
  return {
    testRunId: "run-1",
    measurementId: "m-1",
    measurementSource: "MANUEL_BEYAN",
    inputMode: "EVENT_TIMESTAMPS",
    outage: { startedAt: "2026-07-10T08:00:00.000Z", restoredAt: "2026-07-10T12:00:00.000Z", declaredHours: null },
    dataLoss: { lastConsistentDataAt: "2026-07-10T07:00:00.000Z", recoveryPointAt: "2026-07-10T08:00:00.000Z", declaredHours: null },
    provenance: { evidenceId: null, sourceSystem: null, sourceEventId: null, sourcePayloadHash: null, declarantPresent: true },
    supersedesMeasurementId: null,
    // Karar D: kesinti olay zamanları mevcutken measuredAt = outage.restoredAt
    // olmak ZORUNDA (OLCUM_ZAMANI_TUTARSIZ) — bu yüzden varsayılan burada
    // outage.restoredAt ile BİREBİR aynı.
    measuredAt: "2026-07-10T12:00:00.000Z",
    recordedAt: "2026-07-21T10:00:00.000Z",
    ...overrides,
  };
}

describe("kurtarmaOlcumuOlustur — türetme ve şema", () => {
  it("1) EVENT_TIMESTAMPS: süreler ham zamanlardan doğru türetilir", () => {
    const p = kurtarmaOlcumuOlustur(temel());
    expect(p.outage.derivedHours).toBe(4);
    expect(p.dataLoss.derivedHours).toBe(1);
    expect(p.schema).toBe(RECOVERY_MEASUREMENT_SCHEMA);
  });

  it("2) comparisonPerformed HER ZAMAN false", () => {
    expect(kurtarmaOlcumuOlustur(temel()).comparisonPerformed).toBe(false);
  });

  it("3) kesinti dolu, veri kaybı boş: veri türetilmez (null), kesinti türetilir", () => {
    const p = kurtarmaOlcumuOlustur(temel({ dataLoss: { lastConsistentDataAt: null, recoveryPointAt: null, declaredHours: null } }));
    expect(p.outage.derivedHours).toBe(4);
    expect(p.dataLoss.derivedHours).toBeNull();
  });

  it("4) NULL süre sıfıra dönüşmez (derivedHours null, 0 değil)", () => {
    const p = kurtarmaOlcumuOlustur(temel({ dataLoss: { lastConsistentDataAt: null, recoveryPointAt: null, declaredHours: null } }));
    expect(p.dataLoss.derivedHours).not.toBe(0);
    expect(p.dataLoss.declaredHours).toBeNull();
  });
});

describe("kurtarmaOlcumuOlustur — DURATION_DECLARATION (süre-yalnız beyan)", () => {
  const beyan = (o: Partial<KurtarmaOlcumuGirdisi> = {}) =>
    temel({
      inputMode: "DURATION_DECLARATION",
      outage: { startedAt: null, restoredAt: null, declaredHours: 4 },
      dataLoss: { lastConsistentDataAt: null, recoveryPointAt: null, declaredHours: 1 },
      ...o,
    });

  it("5) beyan modu declaredHours taşır, derivedHours null kalır", () => {
    const p = kurtarmaOlcumuOlustur(beyan());
    expect(p.outage.declaredHours).toBe(4);
    expect(p.outage.derivedHours).toBeNull();
    expect(p.dataLoss.declaredHours).toBe(1);
    expect(p.dataLoss.derivedHours).toBeNull();
  });

  it("6) beyan modunda ham olay zamanı gönderilirse reddedilir", () => {
    expect(() => kurtarmaOlcumuOlustur(beyan({ outage: { startedAt: "2026-07-10T08:00:00.000Z", restoredAt: null, declaredHours: 4 } }))).toThrow(KurtarmaOlcumuHatasi);
  });

  it("7) EVENT modunda declaredHours gönderilirse reddedilir", () => {
    kodBekle(() => kurtarmaOlcumuOlustur(temel({ outage: { startedAt: "2026-07-10T08:00:00.000Z", restoredAt: "2026-07-10T12:00:00.000Z", declaredHours: 4 } })), "MOD_CAKISMASI");
  });
});

describe("kurtarmaOlcumuOlustur — doğrulama reddi", () => {
  it("8) negatif beyan süresi reddedilir", () => {
    kodBekle(
      () => kurtarmaOlcumuOlustur(temel({ inputMode: "DURATION_DECLARATION", outage: { startedAt: null, restoredAt: null, declaredHours: -1 }, dataLoss: { lastConsistentDataAt: null, recoveryPointAt: null, declaredHours: null } })),
      "NEGATIF_SURE",
    );
  });

  it("9) başlangıç bitişten sonra ise reddedilir (kesinti)", () => {
    kodBekle(() => kurtarmaOlcumuOlustur(temel({ outage: { startedAt: "2026-07-10T12:00:00.000Z", restoredAt: "2026-07-10T08:00:00.000Z", declaredHours: null } })), "SIRA_HATASI");
  });

  it("10) son tutarlı veri kurtarma noktasından sonra ise reddedilir", () => {
    kodBekle(() => kurtarmaOlcumuOlustur(temel({ dataLoss: { lastConsistentDataAt: "2026-07-10T09:00:00.000Z", recoveryPointAt: "2026-07-10T08:00:00.000Z", declaredHours: null } })), "SIRA_HATASI");
  });

  it("11) tamamen boş ölçüm reddedilir", () => {
    kodBekle(
      () => kurtarmaOlcumuOlustur(temel({ outage: { startedAt: null, restoredAt: null, declaredHours: null }, dataLoss: { lastConsistentDataAt: null, recoveryPointAt: null, declaredHours: null } })),
      "BOS_OLCUM",
    );
  });

  it("12) OTOMATIK_OLCUM eksik provenance ile reddedilir", () => {
    kodBekle(() => kurtarmaOlcumuOlustur(temel({ measurementSource: "OTOMATIK_OLCUM" })), "PROVENANCE_EKSIK");
  });

  it("13) OTOMATIK_OLCUM tam provenance ile geçer", () => {
    const p = kurtarmaOlcumuOlustur(
      temel({ measurementSource: "OTOMATIK_OLCUM", provenance: { evidenceId: "ev-1", sourceSystem: "monitoring", sourceEventId: "evt-9", sourcePayloadHash: "a".repeat(64), declarantPresent: false } }),
    );
    expect(p.measurementSource).toBe("OTOMATIK_OLCUM");
    expect(p.provenance.sourceSystem).toBe("monitoring");
  });
});

// Dikey F, F5 hazırlık — Karar D: measured_at yaşam döngüsü.
describe("kurtarmaOlcumuOlustur — measured_at yaşam döngüsü (Karar D)", () => {
  it("18) measured_at, recorded_at'ten makul olmayan ölçüde ileri olamaz (GELECEK_ZAMAN)", () => {
    kodBekle(
      () =>
        kurtarmaOlcumuOlustur(
          temel({
            outage: { startedAt: null, restoredAt: null, declaredHours: null },
            measuredAt: "2026-07-21T10:30:00.000Z", // recordedAt'ten 30 dk ileri — tolerans 5 dk
            recordedAt: "2026-07-21T10:00:00.000Z",
          }),
        ),
      "GELECEK_ZAMAN",
    );
  });

  it("19) recorded_at'ten 5 dk tolerans içindeki measured_at KABUL edilir (saat kayması payı)", () => {
    const p = kurtarmaOlcumuOlustur(
      temel({
        outage: { startedAt: null, restoredAt: null, declaredHours: null },
        measuredAt: "2026-07-21T10:03:00.000Z",
        recordedAt: "2026-07-21T10:00:00.000Z",
      }),
    );
    expect(p.measuredAt).toBe("2026-07-21T10:03:00.000Z");
  });

  it("20) kesinti olay zamanları mevcutken measured_at, hizmetin geri geldiği andan FARKLI olamaz (OLCUM_ZAMANI_TUTARSIZ)", () => {
    kodBekle(() => kurtarmaOlcumuOlustur(temel({ measuredAt: "2026-07-10T13:00:00.000Z" })), "OLCUM_ZAMANI_TUTARSIZ");
  });

  it("21) yalnız veri-kaybı boyutu varsa (kesinti yok) measured_at SERBEST kullanıcı girdisi olabilir", () => {
    const p = kurtarmaOlcumuOlustur(
      temel({
        outage: { startedAt: null, restoredAt: null, declaredHours: null },
        measuredAt: "2026-07-10T09:30:00.000Z", // dataLoss penceresiyle birebir eşleşmesi ZORUNLU değil
      }),
    );
    expect(p.measuredAt).toBe("2026-07-10T09:30:00.000Z");
  });
});

describe("kurtarmaOlcumuOlustur — determinizm + hash", () => {
  it("14) aynı girdi aynı payload'ı üretir", () => {
    expect(kurtarmaOlcumuOlustur(temel())).toEqual(kurtarmaOlcumuOlustur(temel()));
  });

  it("15) aynı payload aynı kanonik hash'i üretir; farklı süre farklı hash", async () => {
    const h1 = await kurtarmaOlcumuHash(kurtarmaOlcumuOlustur(temel()));
    const h2 = await kurtarmaOlcumuHash(kurtarmaOlcumuOlustur(temel()));
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
    const h3 = await kurtarmaOlcumuHash(
      kurtarmaOlcumuOlustur(temel({ outage: { startedAt: "2026-07-10T08:00:00.000Z", restoredAt: "2026-07-10T10:00:00.000Z", declaredHours: null }, measuredAt: "2026-07-10T10:00:00.000Z" })),
    );
    expect(h3).not.toBe(h1);
  });

  it("16) supersede kimliği payload'a girer ve hash'i etkiler", async () => {
    const h1 = await kurtarmaOlcumuHash(kurtarmaOlcumuOlustur(temel()));
    const h2 = await kurtarmaOlcumuHash(kurtarmaOlcumuOlustur(temel({ supersedesMeasurementId: "m-0" })));
    expect(h2).not.toBe(h1);
  });

  it("17) 'RTO/RPO karşılandı' gibi hiçbir hüküm payload'da yok", () => {
    const json = JSON.stringify(kurtarmaOlcumuOlustur(temel()));
    expect(json).not.toContain("karşılandı");
    expect(json).not.toContain("tolerans");
    expect(json).toContain('"comparisonPerformed":false');
  });
});
