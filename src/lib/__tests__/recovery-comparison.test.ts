import { describe, expect, it } from "vitest";
import { kurtarmaKarsilastirmasiOlustur, kurtarmaKarsilastirmasiHash, RECOVERY_COMPARISON_SCHEMA, type RecoveryComparisonGirdisi } from "../recovery-comparison";

function temel(overrides: Partial<RecoveryComparisonGirdisi> = {}): RecoveryComparisonGirdisi {
  return {
    testRunId: "run-1",
    comparisonId: "cmp-1",
    measurement: {
      id: "m-1",
      olcumKaynagi: "MANUEL_BEYAN",
      olculenKesintiSaat: 3,
      olculenVeriKaybiSaat: 1,
      beyanKesintiSaat: null,
      beyanVeriKaybiSaat: null,
    },
    tolerance: { id: "t-1", surum: 2, yonetimOnayi: true, onayZamani: "2026-01-01T00:00:00.000Z", maxKesintiSaat: 4, maxVeriKaybiSaat: 2 },
    criticalServiceId: "svc-1",
    supersedesComparisonId: null,
    createdAt: "2026-07-21T10:00:00.000Z",
    ...overrides,
  };
}

describe("kurtarmaKarsilastirmasiOlustur — RTO/RPO bağımsız değerlendirme", () => {
  it("1) ölçülen değer hedef içindeyse KARSILADI", () => {
    const p = kurtarmaKarsilastirmasiOlustur(temel());
    expect(p.rto.sonuc).toBe("KARSILADI");
    expect(p.rto.olculenDegerSaat).toBe(3);
    expect(p.rto.hedefSaat).toBe(4);
  });

  it("2) ölçülen değer hedefi aşıyorsa ASTI", () => {
    const p = kurtarmaKarsilastirmasiOlustur(temel({ measurement: { id: "m-1", olcumKaynagi: "MANUEL_BEYAN", olculenKesintiSaat: 5, olculenVeriKaybiSaat: 1, beyanKesintiSaat: null, beyanVeriKaybiSaat: null } }));
    expect(p.rto.sonuc).toBe("ASTI");
  });

  it("3) sınır değer (tam hedefe eşit) KARSILADI sayılır (<=)", () => {
    const p = kurtarmaKarsilastirmasiOlustur(temel({ measurement: { id: "m-1", olcumKaynagi: "MANUEL_BEYAN", olculenKesintiSaat: 4, olculenVeriKaybiSaat: 1, beyanKesintiSaat: null, beyanVeriKaybiSaat: null } }));
    expect(p.rto.sonuc).toBe("KARSILADI");
  });

  it("4) veri kaybı ölçümü/beyanı yoksa RPO OLCUM_YOK", () => {
    const p = kurtarmaKarsilastirmasiOlustur(temel({ measurement: { id: "m-1", olcumKaynagi: "MANUEL_BEYAN", olculenKesintiSaat: 3, olculenVeriKaybiSaat: null, beyanKesintiSaat: null, beyanVeriKaybiSaat: null } }));
    expect(p.rpo.sonuc).toBe("OLCUM_YOK");
    expect(p.rpo.olculenDegerSaat).toBeNull();
  });

  it("5) tolerans hedefi NULL ise TOLERANS_YOK (ölçüm olsa bile)", () => {
    const p = kurtarmaKarsilastirmasiOlustur(temel({ tolerance: { id: "t-1", surum: 2, yonetimOnayi: true, onayZamani: "2026-01-01T00:00:00.000Z", maxKesintiSaat: 4, maxVeriKaybiSaat: null } }));
    expect(p.rpo.sonuc).toBe("TOLERANS_YOK");
    expect(p.rpo.olculenDegerSaat).toBe(1); // ölçüm VAR, yalnız hedef yok — deger kaybolmaz
  });

  it("6) RTO ve RPO tamamen BAĞIMSIZ — biri KARSILADI iken diğeri TOLERANS_YOK olabilir", () => {
    const p = kurtarmaKarsilastirmasiOlustur(temel({ tolerance: { id: "t-1", surum: 2, yonetimOnayi: true, onayZamani: "2026-01-01T00:00:00.000Z", maxKesintiSaat: 4, maxVeriKaybiSaat: null } }));
    expect(p.rto.sonuc).toBe("KARSILADI");
    expect(p.rpo.sonuc).toBe("TOLERANS_YOK");
  });

  it("7) tolerans HİÇ onaylanmamışsa (yonetimOnayi=false/onayZamani=null) HER İKİ metrik de KARSILASTIRILAMAZ", () => {
    const p1 = kurtarmaKarsilastirmasiOlustur(temel({ tolerance: { id: "t-1", surum: 2, yonetimOnayi: false, onayZamani: null, maxKesintiSaat: 4, maxVeriKaybiSaat: 2 } }));
    expect(p1.rto.sonuc).toBe("KARSILASTIRILAMAZ");
    expect(p1.rpo.sonuc).toBe("KARSILASTIRILAMAZ");
    const p2 = kurtarmaKarsilastirmasiOlustur(temel({ tolerance: { id: "t-1", surum: 1, yonetimOnayi: true, onayZamani: null, maxKesintiSaat: 4, maxVeriKaybiSaat: 2 } }));
    expect(p2.rto.sonuc).toBe("KARSILASTIRILAMAZ");
    expect(p2.rpo.sonuc).toBe("KARSILASTIRILAMAZ");
  });

  it("7b) BİTEMPORAL DOĞRULUK: tolerans BUGÜN 'SUPERSEDED' olsa bile, geçmişte GERÇEKTEN onaylı/aktif İDİYSE (yonetimOnayi+onayZamani dolu) karşılaştırma YAPILIR — 'durum' alanına bakılmaz", () => {
    // Bu, ADR §2'nin ana motivasyonu: as-of çözümü geçmiş bir ölçüm anı için
    // ARTIK süprese edilmiş bir sürümü haklı olarak eşleştirebilir; motor
    // bunu 'SUPERSEDED' diye reddetmemeli (çağıran zaten bitemporal olarak
    // doğru sürümü seçmiş).
    const p = kurtarmaKarsilastirmasiOlustur(temel({ tolerance: { id: "t-eski", surum: 1, yonetimOnayi: true, onayZamani: "2025-01-01T00:00:00.000Z", maxKesintiSaat: 4, maxVeriKaybiSaat: 2 } }));
    expect(p.rto.sonuc).toBe("KARSILADI");
    expect(p.rpo.sonuc).toBe("KARSILADI");
  });

  it("8) beyan (süre-yalnız) modunda, ölçüm yoksa beyan değeri kullanılır", () => {
    const p = kurtarmaKarsilastirmasiOlustur(
      temel({ measurement: { id: "m-1", olcumKaynagi: "MANUEL_BEYAN", olculenKesintiSaat: null, olculenVeriKaybiSaat: null, beyanKesintiSaat: 2, beyanVeriKaybiSaat: 1 } }),
    );
    expect(p.rto.olculenDegerSaat).toBe(2);
    expect(p.rto.sonuc).toBe("KARSILADI");
  });

  it("9) ölçülen değer varsa beyan değerine göre ÖNCELİKLİDİR", () => {
    const p = kurtarmaKarsilastirmasiOlustur(
      temel({ measurement: { id: "m-1", olcumKaynagi: "MANUEL_BEYAN", olculenKesintiSaat: 3, olculenVeriKaybiSaat: 1, beyanKesintiSaat: 99, beyanVeriKaybiSaat: 99 } }),
    );
    expect(p.rto.olculenDegerSaat).toBe(3);
  });
});

describe("kurtarmaKarsilastirmasiOlustur — güvenilirlik dili (ADR §5)", () => {
  it("10) MANUEL_BEYAN: 'beyan edilen değer ... hedefin içinde/aşıyor' dili", () => {
    const p = kurtarmaKarsilastirmasiOlustur(temel());
    expect(p.rto.aciklama).toContain("Beyan edilen değer");
    expect(p.rto.aciklama).toContain("hedefin içinde");

    const asan = kurtarmaKarsilastirmasiOlustur(temel({ measurement: { id: "m-1", olcumKaynagi: "MANUEL_BEYAN", olculenKesintiSaat: 9, olculenVeriKaybiSaat: 1, beyanKesintiSaat: null, beyanVeriKaybiSaat: null } }));
    expect(asan.rto.aciklama).toContain("hedefi aşıyor");
  });

  it("11) OTOMATIK_OLCUM: 'ölçülen değer hedefi karşıladı/aştı' dili", () => {
    const p = kurtarmaKarsilastirmasiOlustur(temel({ measurement: { id: "m-1", olcumKaynagi: "OTOMATIK_OLCUM", olculenKesintiSaat: 3, olculenVeriKaybiSaat: 1, beyanKesintiSaat: null, beyanVeriKaybiSaat: null } }));
    expect(p.rto.aciklama).toContain("Ölçülen değer");
    expect(p.rto.aciklama).toContain("hedefi karşıladı");
  });

  it("12) hiçbir yerde kaynağı gizleyen çıplak 'RTO karşılandı'/'RPO karşılandı' ifadesi yok", () => {
    const json = JSON.stringify(kurtarmaKarsilastirmasiOlustur(temel()));
    expect(json).not.toContain("RTO karşılandı");
    expect(json).not.toContain("RPO karşılandı");
    expect(json).not.toContain("Tolerans karşılandı");
  });
});

describe("kurtarmaKarsilastirmasiOlustur — determinizm + hash + supersede", () => {
  it("13) aynı girdi aynı payload'ı üretir", () => {
    expect(kurtarmaKarsilastirmasiOlustur(temel())).toEqual(kurtarmaKarsilastirmasiOlustur(temel()));
  });

  it("14) aynı payload aynı kanonik hash'i üretir; farklı sonuç farklı hash", async () => {
    const h1 = await kurtarmaKarsilastirmasiHash(kurtarmaKarsilastirmasiOlustur(temel()));
    const h2 = await kurtarmaKarsilastirmasiHash(kurtarmaKarsilastirmasiOlustur(temel()));
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
    const h3 = await kurtarmaKarsilastirmasiHash(
      kurtarmaKarsilastirmasiOlustur(temel({ measurement: { id: "m-1", olcumKaynagi: "MANUEL_BEYAN", olculenKesintiSaat: 5, olculenVeriKaybiSaat: 1, beyanKesintiSaat: null, beyanVeriKaybiSaat: null } })),
    );
    expect(h3).not.toBe(h1);
  });

  it("15) supersedesComparisonId payload'a girer ve hash'i etkiler", async () => {
    const h1 = await kurtarmaKarsilastirmasiHash(kurtarmaKarsilastirmasiOlustur(temel()));
    const h2 = await kurtarmaKarsilastirmasiHash(kurtarmaKarsilastirmasiOlustur(temel({ supersedesComparisonId: "cmp-0" })));
    expect(h2).not.toBe(h1);
  });

  it("16) şema sabiti doğru", () => {
    expect(kurtarmaKarsilastirmasiOlustur(temel()).schema).toBe(RECOVERY_COMPARISON_SCHEMA);
  });

  it("17) tolerans eşikleri payload'a MÜHÜRLENİR (yalnız FK değil)", () => {
    const p = kurtarmaKarsilastirmasiOlustur(temel());
    expect(p.toleransMaxKesintiSaat).toBe(4);
    expect(p.toleransMaxVeriKaybiSaat).toBe(2);
    expect(p.toleransSurumu).toBe(2);
  });
});
