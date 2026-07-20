import { describe, expect, it } from "vitest";
import { roiExportProvenanceOlustur, type RoiExportProvenanceGirdisi } from "../roi-export-provenance";
import type { RoiSablonPaketi } from "../roi-export";

const BOS_PAKET: RoiSablonPaketi = {
  B_01_01: [{ B_01_01_0010_lei: "LEI123", B_01_01_0030_ulke: "TR", B_01_01_0040_kurulusTuru: "BANKA" }],
  B_02_02: [],
  B_05_01: [],
  B_05_02: [],
  B_06_01: [],
} as unknown as RoiSablonPaketi;

function girdi(over: Partial<RoiExportProvenanceGirdisi> = {}): RoiExportProvenanceGirdisi {
  return {
    paket: BOS_PAKET,
    roiKaynaklari: [],
    ictHizmetTurleri: [],
    iddialar: [],
    asOf: "2026-07-20",
    ...over,
  };
}

describe("roiExportProvenanceOlustur", () => {
  it("kaynak yoksa KAYNAK_YOK döner, asla VERIFIED üretmez", () => {
    const rapor = roiExportProvenanceOlustur(girdi());
    expect(rapor.satirlar).toHaveLength(1);
    expect(rapor.satirlar[0].kaynakDurumu).toBe("KAYNAK_YOK");
    expect(rapor.satirlar[0].genelDurum).toBe("KAYNAK_YOK");
    expect(rapor.ozet.VERIFIED).toBe(0);
  });

  it("kaynak VERIFIED ve iliskili iddia yoksa satır yine VERIFIED olabilir (kaynak tek başına yeterli)", () => {
    const rapor = roiExportProvenanceOlustur(
      girdi({ roiKaynaklari: [{ sablonKodu: "B_01.01", alanKodu: null, dogrulamaDurumu: "VERIFIED" }] }),
    );
    expect(rapor.satirlar[0].kaynakDurumu).toBe("VERIFIED");
    expect(rapor.satirlar[0].genelDurum).toBe("VERIFIED");
  });

  it("kaynak VERIFIED ama iliskili iddia REJECTED ise genelDurum REDDEDILDI olur (worst-of, kaçış yok)", () => {
    const paket: RoiSablonPaketi = {
      ...BOS_PAKET,
      B_06_01: [{ id: "kf-1", B_06_01_0030_fonksiyonAdi: "Ödeme", kapsamDisiAlanlar: [] }],
    } as unknown as RoiSablonPaketi;
    const rapor = roiExportProvenanceOlustur(
      girdi({
        paket,
        roiKaynaklari: [{ sablonKodu: "B_06.01", alanKodu: null, dogrulamaDurumu: "VERIFIED" }],
        iddialar: [
          {
            id: "iddia-1",
            hedefTablo: "critical_business_services",
            hedefId: "kf-1",
            sonuc: "OLUMLU",
            dogrulamaDurumu: "REJECTED",
            yururlukTarihi: null,
            yenidenIncelemeGerekli: false,
          },
        ],
      }),
    );
    const satir = rapor.satirlar.find((s) => s.satirId === "kf-1")!;
    expect(satir.kaynakDurumu).toBe("VERIFIED");
    expect(satir.iliskiliIddiaSayisi).toBe(1);
    expect(satir.genelDurum).toBe("REDDEDILDI");
  });

  it("TODO_DOGRULA kaynak kesin uyum ifadesi üretmez (UNVERIFIED)", () => {
    const rapor = roiExportProvenanceOlustur(
      girdi({ roiKaynaklari: [{ sablonKodu: "B_01.01", alanKodu: null, dogrulamaDurumu: "TODO_DOGRULA" }] }),
    );
    expect(rapor.satirlar[0].genelDurum).toBe("UNVERIFIED");
  });

  it("LEGAL_REVIEW kaynak LEGAL_REVIEW_REQUIRED gösterir, VERIFIED değil", () => {
    const rapor = roiExportProvenanceOlustur(
      girdi({ roiKaynaklari: [{ sablonKodu: "B_01.01", alanKodu: null, dogrulamaDurumu: "LEGAL_REVIEW" }] }),
    );
    expect(rapor.satirlar[0].genelDurum).toBe("LEGAL_REVIEW_REQUIRED");
  });

  it("süresi geçmiş iddia (yururlukTarihi < asOf) kaynak VERIFIED olsa bile genelDurum'u düşürür", () => {
    const paket: RoiSablonPaketi = {
      ...BOS_PAKET,
      B_06_01: [{ id: "kf-2", B_06_01_0030_fonksiyonAdi: "Takas", kapsamDisiAlanlar: [] }],
    } as unknown as RoiSablonPaketi;
    const rapor = roiExportProvenanceOlustur(
      girdi({
        paket,
        roiKaynaklari: [{ sablonKodu: "B_06.01", alanKodu: null, dogrulamaDurumu: "VERIFIED" }],
        iddialar: [
          {
            id: "iddia-2",
            hedefTablo: "critical_business_services",
            hedefId: "kf-2",
            sonuc: "OLUMLU",
            dogrulamaDurumu: "VERIFIED",
            yururlukTarihi: "2026-01-01",
            yenidenIncelemeGerekli: false,
          },
        ],
      }),
    );
    const satir = rapor.satirlar.find((s) => s.satirId === "kf-2")!;
    expect(satir.genelDurum).toBe("SURESI_GECMIS_INCELEME_GEREKLI");
  });

  it("B_02.02 satırı doğrulanmamış ICT hizmet türüne bağlıysa VERIFIED gösterilemez", () => {
    const paket: RoiSablonPaketi = {
      ...BOS_PAKET,
      B_02_02: [
        {
          id: "sozlesme-1",
          B_02_02_0010_sozlesmeReferansNo: "REF-1",
          B_02_02_0030_tedarikciKimlikKodu: null,
          B_02_02_0040_kodTuru: null,
          B_02_02_0060_hizmetTuru: "S01",
          B_02_02_0070_baslangic: "2025-01-01",
          B_02_02_0080_bitis: "2027-01-01",
          B_02_02_0090_sonaErmeNedeni: null,
          B_02_02_0100_bildirimSuresiKurumGun: null,
          B_02_02_0110_bildirimSuresiSaglayiciGun: null,
          B_02_02_0140_veriSaklaniyorMu: null,
          B_02_02_0150_veriSaklamaUlkesi: null,
          B_02_02_0160_veriIslemeUlkesi: null,
          fonksiyonKimlikleri: [],
        },
      ],
    } as unknown as RoiSablonPaketi;
    const rapor = roiExportProvenanceOlustur(
      girdi({
        paket,
        roiKaynaklari: [{ sablonKodu: "B_02.02", alanKodu: "B_02.02.0060", dogrulamaDurumu: "VERIFIED" }],
        ictHizmetTurleri: [{ kod: "S01", dogrulamaDurumu: "TODO_DOGRULA" }],
      }),
    );
    const satir = rapor.satirlar.find((s) => s.satirId === "sozlesme-1")!;
    expect(satir.genelDurum).not.toBe("VERIFIED");
    expect(satir.kaynakDurumu).toBe("UNVERIFIED");
  });

  it("çıktı sıralaması sablon+satirId'ye göre deterministiktir, girdi sırasından bağımsız", () => {
    const paket: RoiSablonPaketi = {
      ...BOS_PAKET,
      B_06_01: [
        { id: "z-son", B_06_01_0030_fonksiyonAdi: "Z", kapsamDisiAlanlar: [] },
        { id: "a-ilk", B_06_01_0030_fonksiyonAdi: "A", kapsamDisiAlanlar: [] },
      ],
    } as unknown as RoiSablonPaketi;
    const rapor = roiExportProvenanceOlustur(girdi({ paket }));
    const b0601Ids = rapor.satirlar.filter((s) => s.sablon === "B_06.01").map((s) => s.satirId);
    expect(b0601Ids).toEqual(["a-ilk", "z-son"]);
  });

  it("aynı girdi aynı raporu üretir (deterministik, Date.now() yok)", () => {
    const g = girdi({ roiKaynaklari: [{ sablonKodu: "B_01.01", alanKodu: null, dogrulamaDurumu: "VERIFIED" }] });
    const r1 = roiExportProvenanceOlustur(g);
    const r2 = roiExportProvenanceOlustur(g);
    expect(r1).toEqual(r2);
  });

  it("izlenenler reconciliation için gerçek kaynak/iddia kimliklerini toplar (uydurma yok)", () => {
    const paket: RoiSablonPaketi = {
      ...BOS_PAKET,
      B_06_01: [{ id: "kf-4", B_06_01_0030_fonksiyonAdi: "Y", kapsamDisiAlanlar: [] }],
    } as unknown as RoiSablonPaketi;
    const rapor = roiExportProvenanceOlustur(
      girdi({
        paket,
        roiKaynaklari: [{ sablonKodu: "B_06.01", alanKodu: null, dogrulamaDurumu: "VERIFIED" }],
        iddialar: [
          {
            id: "iddia-4",
            hedefTablo: "critical_business_services",
            hedefId: "kf-4",
            sonuc: "OLUMLU",
            dogrulamaDurumu: "VERIFIED",
            yururlukTarihi: null,
            yenidenIncelemeGerekli: false,
          },
        ],
      }),
    );
    expect(rapor.izlenenler.iddiaIdleri).toEqual(["iddia-4"]);
    expect(rapor.izlenenler.roiKaynaklari).toContainEqual({ sablonKodu: "B_06.01", alanKodu: null });
    expect(rapor.izlenenler.roiKaynaklari).toContainEqual({ sablonKodu: "B_01.01", alanKodu: null });
  });

  it("ozet sayaçları satır sayısına eşittir", () => {
    const paket: RoiSablonPaketi = {
      ...BOS_PAKET,
      B_06_01: [{ id: "kf-3", B_06_01_0030_fonksiyonAdi: "X", kapsamDisiAlanlar: [] }],
    } as unknown as RoiSablonPaketi;
    const rapor = roiExportProvenanceOlustur(girdi({ paket }));
    const toplam = Object.values(rapor.ozet).reduce((a, b) => a + b, 0);
    expect(toplam).toBe(rapor.satirlar.length);
  });
});
