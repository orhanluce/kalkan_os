// M35 saf yardımcılar (G4): yoğunlaşma analizi, sözleşme yakınlığı, RoI iskeleti.
import { describe, expect, it } from "vitest";
import {
  konsantrasyonAnalizi,
  roiKaydiUret,
  sozlesmeYakinligi,
  type TedarikciGraf,
} from "../tedarikci";

const SIMDI = "2026-07-19T12:00:00Z";

describe("konsantrasyonAnalizi (M35)", () => {
  it("aynı dördüncü tarafa bağımlı ≥2 tedarikçi yoğunlaşma noktasıdır", () => {
    const graf: TedarikciGraf[] = [
      { id: "1", ad: "Vendor A", tier: "KRITIK", kritikHizmetVar: true, dorduncuTaraflar: [{ id: "d1", ad: "AWS", bilinmiyor: false }] },
      { id: "2", ad: "Vendor B", tier: "ONEMLI", kritikHizmetVar: true, dorduncuTaraflar: [{ id: "d2", ad: "aws", bilinmiyor: false }] },
      { id: "3", ad: "Vendor C", tier: "DUSUK", kritikHizmetVar: false, dorduncuTaraflar: [{ id: "d3", ad: "Azure", bilinmiyor: false }] },
    ];
    const r = konsantrasyonAnalizi(graf);
    // AWS (normalize case-insensitive) iki tedarikçide → yoğunlaşma; Azure tek → değil.
    expect(r.yogunlasmaNoktalari).toHaveLength(1);
    expect(r.yogunlasmaNoktalari[0].dorduncuTarafAd).toBe("aws");
    expect(r.yogunlasmaNoktalari[0].bagimliTedarikciler).toEqual(["Vendor A", "Vendor B"]);
  });

  it("BİLİNMEYEN dördüncü taraf ayrı raporlanır — düşük risk VARSAYILMAZ", () => {
    const graf: TedarikciGraf[] = [
      { id: "1", ad: "Vendor A", tier: "KRITIK", kritikHizmetVar: true, dorduncuTaraflar: [{ id: "d1", ad: null, bilinmiyor: true }] },
    ];
    const r = konsantrasyonAnalizi(graf);
    expect(r.yogunlasmaNoktalari).toHaveLength(0);
    expect(r.bilinmeyenBagimliligiOlanlar).toEqual(["Vendor A"]);
  });

  it("deterministik: girdi sırasından bağımsız aynı sonuç (kural 11)", () => {
    const a: TedarikciGraf[] = [
      { id: "1", ad: "B", tier: "DUSUK", kritikHizmetVar: false, dorduncuTaraflar: [{ id: "x", ad: "X", bilinmiyor: false }] },
      { id: "2", ad: "A", tier: "DUSUK", kritikHizmetVar: false, dorduncuTaraflar: [{ id: "x", ad: "X", bilinmiyor: false }] },
    ];
    const r1 = konsantrasyonAnalizi(a);
    const r2 = konsantrasyonAnalizi([...a].reverse());
    expect(r1).toEqual(r2);
    expect(r1.yogunlasmaNoktalari[0].bagimliTedarikciler).toEqual(["A", "B"]);
  });
});

describe("sozlesmeYakinligi (M35)", () => {
  it("eşik içindeki bitiş 'yaklaşıyor'; geçmiş 'gecmis'", () => {
    expect(sozlesmeYakinligi("2026-08-10", SIMDI, 60).yaklasiyor).toBe(true);
    expect(sozlesmeYakinligi("2026-07-01", SIMDI, 60).gecmis).toBe(true);
    expect(sozlesmeYakinligi("2027-01-01", SIMDI, 60).yaklasiyor).toBe(false);
  });

  it("deterministik (kural 11)", () => {
    expect(sozlesmeYakinligi("2026-09-01", SIMDI, 30)).toEqual(sozlesmeYakinligi("2026-09-01", SIMDI, 30));
  });
});

describe("roiKaydiUret (M35)", () => {
  it("RoI iskeleti türetilir; bilinmeyen alt-bağımlılık işaretlenir; MVP uyarısı taşır", () => {
    const r = roiKaydiUret({
      tedarikci: { ad: "Vendor A", ulke: "TR", tier: "KRITIK", karar: "ONAYLANDI" },
      hizmetler: [
        { hizmet_adi: "Bulut", kritik: true, veri_siniflari: ["musteri"] },
        { hizmet_adi: "Log", kritik: false, veri_siniflari: [] },
      ],
      sozlesmeler: [{ sozlesme_ref: "S-1", baslangic: "2025-01-01", bitis: "2027-01-01", denetim_hakki: true, cikis_maddesi: true }],
      dorduncuTaraflar: [{ ad: null, bilinmiyor: true, ulke: null }],
    });
    expect(r.schema).toBe("KALKAN_DORA_ROI_MVP_V1");
    expect(r.kritikHizmetSayisi).toBe(1);
    expect(r.bilinmeyenAltBagimlilik).toBe(true);
    expect(r.uyari).toContain("MVP");
  });
});
