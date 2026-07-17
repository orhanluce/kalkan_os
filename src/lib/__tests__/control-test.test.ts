import { describe, expect, it } from "vitest";
import {
  kontrolGuvenceDurumu,
  testDegerlendir,
  type Gozlem,
  type TestTanimi,
} from "../control-test";

const ASOF = new Date("2026-07-17T12:00:00.000Z");

function tanim(patch: Partial<TestTanimi> = {}): TestTanimi {
  return { tur: "MANUAL_PROCEDURE", tazelikGun: 90, ...patch };
}

function gozlem(patch: Partial<Gozlem> = {}): Gozlem {
  return {
    toplamaBasarisiz: false,
    toplamaHatasi: null,
    gozlemZamani: "2026-07-16T12:00:00.000Z", // 1 gün önce, taze
    istisnaKabul: false,
    iddiaKarsilandi: true,
    ...patch,
  };
}

describe("kural 13'ün kalbi: toplama arızası ASLA FAILED üretmez", () => {
  it("toplama başarısızsa UNKNOWN — connector düşmesi kontrol başarısızlığı değildir", () => {
    const r = testDegerlendir(
      tanim(),
      gozlem({ toplamaBasarisiz: true, toplamaHatasi: "API 503", iddiaKarsilandi: false }),
      ASOF,
    );
    // İddia "karşılanmadı" DESE BİLE toplama başarısızsa sonuç UNKNOWN:
    // ölçemediğimiz şeyi başarısız sayamayız.
    expect(r.sonuc).toBe("UNKNOWN");
    expect(r.gerekce).toMatch(/toplama|ölçüm/i);
  });

  it("sinyal yoksa (iddiaKarsilandi null) UNKNOWN — FAILED DEĞİL", () => {
    const r = testDegerlendir(tanim(), gozlem({ iddiaKarsilandi: null }), ASOF);
    expect(r.sonuc).toBe("UNKNOWN");
  });

  it("CONFIG_ASSERTION'da gözlenen değer yoksa UNKNOWN — FAILED değil", () => {
    const r = testDegerlendir(
      tanim({ tur: "CONFIG_ASSERTION", beklenen: { mfa: true } }),
      gozlem({ gozlenenDeger: undefined, iddiaKarsilandi: undefined }),
      ASOF,
    );
    expect(r.sonuc).toBe("UNKNOWN");
  });
});

describe("beş durum birbirinden ayrı (kural 13)", () => {
  it("iddia karşılandı -> PASSED", () => {
    expect(testDegerlendir(tanim(), gozlem({ iddiaKarsilandi: true }), ASOF).sonuc).toBe("PASSED");
  });

  it("iddia karşılanmadı -> FAILED (gerçekten değerlendirildi)", () => {
    expect(testDegerlendir(tanim(), gozlem({ iddiaKarsilandi: false }), ASOF).sonuc).toBe("FAILED");
  });

  it("istisna kabul -> EXCEPTION, PASSED'a karışmaz", () => {
    const r = testDegerlendir(tanim(), gozlem({ istisnaKabul: true, iddiaKarsilandi: false }), ASOF);
    expect(r.sonuc).toBe("EXCEPTION");
  });

  it("bayat ölçüm -> STALE, FAILED değil", () => {
    // 100 gün önce, 90 günlük pencere.
    const r = testDegerlendir(
      tanim({ tazelikGun: 90 }),
      gozlem({ gozlemZamani: "2026-04-08T12:00:00.000Z", iddiaKarsilandi: true }),
      ASOF,
    );
    expect(r.sonuc).toBe("STALE");
  });

  it("tazelik penceresi içindeyse bayat değil", () => {
    const r = testDegerlendir(
      tanim({ tazelikGun: 90 }),
      gozlem({ gozlemZamani: "2026-06-01T12:00:00.000Z", iddiaKarsilandi: true }),
      ASOF,
    );
    expect(r.sonuc).toBe("PASSED");
  });

  it("tazelik şartı yoksa (null) eski ölçüm bile bayat değil", () => {
    const r = testDegerlendir(
      tanim({ tazelikGun: null }),
      gozlem({ gozlemZamani: "2020-01-01T00:00:00.000Z", iddiaKarsilandi: true }),
      ASOF,
    );
    expect(r.sonuc).toBe("PASSED");
  });
});

describe("karar ağacı sırası", () => {
  it("toplama arızası istisnadan da önce gelir — ölçemediğimizi kabul edemeyiz", () => {
    const r = testDegerlendir(
      tanim(),
      gozlem({ toplamaBasarisiz: true, istisnaKabul: true }),
      ASOF,
    );
    expect(r.sonuc).toBe("UNKNOWN");
  });

  it("istisna bayatlıktan önce gelir — kabul, tazelikten bağımsız", () => {
    const r = testDegerlendir(
      tanim({ tazelikGun: 90 }),
      gozlem({ istisnaKabul: true, gozlemZamani: "2020-01-01T00:00:00.000Z" }),
      ASOF,
    );
    expect(r.sonuc).toBe("EXCEPTION");
  });
});

describe("CONFIG_ASSERTION — kanonik değer karşılaştırması", () => {
  it("gözlenen = beklenen -> PASSED (anahtar sırası önemsiz)", () => {
    const r = testDegerlendir(
      tanim({ tur: "CONFIG_ASSERTION", beklenen: { mfa: true, minLen: 12 } }),
      gozlem({ gozlenenDeger: { minLen: 12, mfa: true } }),
      ASOF,
    );
    expect(r.sonuc).toBe("PASSED");
  });

  it("gözlenen ≠ beklenen -> FAILED", () => {
    const r = testDegerlendir(
      tanim({ tur: "CONFIG_ASSERTION", beklenen: { mfa: true } }),
      gozlem({ gozlenenDeger: { mfa: false } }),
      ASOF,
    );
    expect(r.sonuc).toBe("FAILED");
  });
});

describe("determinizm (kural 11)", () => {
  it("aynı girdi aynı sonuç ve aynı gerekçe", () => {
    const a = testDegerlendir(tanim(), gozlem(), ASOF);
    const b = testDegerlendir(tanim(), gozlem(), ASOF);
    expect(a).toEqual(b);
  });
});

describe("kontrolGuvenceDurumu — birleştirmez, en kötüyü seçer", () => {
  it("hiç test yoksa NOT_TESTED", () => {
    expect(kontrolGuvenceDurumu([])).toBe("NOT_TESTED");
  });

  it("FAILED her şeyi bastırır", () => {
    expect(kontrolGuvenceDurumu(["PASSED", "FAILED", "STALE", "UNKNOWN"])).toBe("FAILED");
  });

  it("FAILED yoksa STALE, UNKNOWN'dan öncelikli", () => {
    expect(kontrolGuvenceDurumu(["PASSED", "UNKNOWN", "STALE"])).toBe("STALE");
  });

  it("UNKNOWN, EXCEPTION'dan öncelikli — ölçülememiş, kabul edilmişten kötü", () => {
    expect(kontrolGuvenceDurumu(["PASSED", "EXCEPTION", "UNKNOWN"])).toBe("UNKNOWN");
  });

  it("hepsi PASSED ise PASSED", () => {
    expect(kontrolGuvenceDurumu(["PASSED", "PASSED"])).toBe("PASSED");
  });

  it("yalnız EXCEPTION -> EXCEPTION (kabul edilmiş boşluk, PASSED değil)", () => {
    expect(kontrolGuvenceDurumu(["EXCEPTION"])).toBe("EXCEPTION");
  });
});
