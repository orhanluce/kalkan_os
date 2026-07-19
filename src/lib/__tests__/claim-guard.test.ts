import { describe, expect, it } from "vitest";
import {
  catismaTespitEt,
  iddiaGosterimDurumuHesapla,
  verifiedOnKosulDegerlendir,
  type IddiaOzet,
} from "../claim-guard";

const ASOF = "2026-07-20";

describe("iddiaGosterimDurumuHesapla (37 Tez Dikey C claim guard motoru)", () => {
  it("REJECTED her zaman REDDEDILDI döner", () => {
    const sonuc = iddiaGosterimDurumuHesapla({
      dogrulamaDurumu: "REJECTED",
      yururlukTarihi: null,
      yenidenIncelemeGerekli: false,
      asOf: ASOF,
    });
    expect(sonuc.gosterimDurumu).toBe("REDDEDILDI");
    expect(sonuc.kesinGosterilebilir).toBe(false);
  });

  it("SUPERSEDED de REDDEDILDI döner", () => {
    const sonuc = iddiaGosterimDurumuHesapla({
      dogrulamaDurumu: "SUPERSEDED",
      yururlukTarihi: null,
      yenidenIncelemeGerekli: false,
      asOf: ASOF,
    });
    expect(sonuc.gosterimDurumu).toBe("REDDEDILDI");
  });

  it("VERIFIED + süresi geçmemiş + inceleme işareti yok -> VERIFIED, kesin gösterilebilir", () => {
    const sonuc = iddiaGosterimDurumuHesapla({
      dogrulamaDurumu: "VERIFIED",
      yururlukTarihi: "2027-01-01",
      yenidenIncelemeGerekli: false,
      asOf: ASOF,
    });
    expect(sonuc.gosterimDurumu).toBe("VERIFIED");
    expect(sonuc.kesinGosterilebilir).toBe(true);
  });

  it("VERIFIED ama süresi geçmiş -> SURESI_GECMIS_INCELEME_GEREKLI (staleness DB durumundan öncelikli)", () => {
    const sonuc = iddiaGosterimDurumuHesapla({
      dogrulamaDurumu: "VERIFIED",
      yururlukTarihi: "2020-01-01",
      yenidenIncelemeGerekli: false,
      asOf: ASOF,
    });
    expect(sonuc.gosterimDurumu).toBe("SURESI_GECMIS_INCELEME_GEREKLI");
    expect(sonuc.kesinGosterilebilir).toBe(false);
  });

  it("VERIFIED ama yeniden_inceleme_gerekli=true -> SURESI_GECMIS_INCELEME_GEREKLI", () => {
    const sonuc = iddiaGosterimDurumuHesapla({
      dogrulamaDurumu: "VERIFIED",
      yururlukTarihi: null,
      yenidenIncelemeGerekli: true,
      asOf: ASOF,
    });
    expect(sonuc.gosterimDurumu).toBe("SURESI_GECMIS_INCELEME_GEREKLI");
  });

  it("yururluk tarihi tam asOf günü ise SÜRESİ GEÇMİŞ SAYILMAZ (eşitlik dahil)", () => {
    const sonuc = iddiaGosterimDurumuHesapla({
      dogrulamaDurumu: "VERIFIED",
      yururlukTarihi: ASOF,
      yenidenIncelemeGerekli: false,
      asOf: ASOF,
    });
    expect(sonuc.gosterimDurumu).toBe("VERIFIED");
  });

  it("LEGAL_REVIEW -> LEGAL_REVIEW_REQUIRED, kesin değil", () => {
    const sonuc = iddiaGosterimDurumuHesapla({
      dogrulamaDurumu: "LEGAL_REVIEW",
      yururlukTarihi: null,
      yenidenIncelemeGerekli: false,
      asOf: ASOF,
    });
    expect(sonuc.gosterimDurumu).toBe("LEGAL_REVIEW_REQUIRED");
    expect(sonuc.kesinGosterilebilir).toBe(false);
  });

  it("DRAFT_RESEARCH/TODO_DOGRULA -> UNVERIFIED", () => {
    expect(
      iddiaGosterimDurumuHesapla({ dogrulamaDurumu: "DRAFT_RESEARCH", yururlukTarihi: null, yenidenIncelemeGerekli: false, asOf: ASOF })
        .gosterimDurumu,
    ).toBe("UNVERIFIED");
    expect(
      iddiaGosterimDurumuHesapla({ dogrulamaDurumu: "TODO_DOGRULA", yururlukTarihi: null, yenidenIncelemeGerekli: false, asOf: ASOF })
        .gosterimDurumu,
    ).toBe("UNVERIFIED");
  });
});

describe("verifiedOnKosulDegerlendir (DB guard'ının TS önizlemesi)", () => {
  it("kaynak yok -> uygun değil", () => {
    const sonuc = verifiedOnKosulDegerlendir({ kaynakVarMi: false, kaynakDurumu: null, kanitSayisi: 3 });
    expect(sonuc.uygun).toBe(false);
    expect(sonuc.eksikSebepler.length).toBeGreaterThan(0);
  });

  it("kaynak var ama VERIFIED değil -> uygun değil", () => {
    const sonuc = verifiedOnKosulDegerlendir({ kaynakVarMi: true, kaynakDurumu: "TODO_DOGRULA", kanitSayisi: 1 });
    expect(sonuc.uygun).toBe(false);
  });

  it("kanıt yok -> uygun değil (kaynak VERIFIED olsa bile)", () => {
    const sonuc = verifiedOnKosulDegerlendir({ kaynakVarMi: true, kaynakDurumu: "VERIFIED", kanitSayisi: 0 });
    expect(sonuc.uygun).toBe(false);
  });

  it("kaynak VERIFIED + en az bir kanıt -> uygun", () => {
    const sonuc = verifiedOnKosulDegerlendir({ kaynakVarMi: true, kaynakDurumu: "VERIFIED", kanitSayisi: 1 });
    expect(sonuc.uygun).toBe(true);
    expect(sonuc.eksikSebepler).toEqual([]);
  });
});

describe("catismaTespitEt (kural 8: kaynak çatışması sessizce çözülmez)", () => {
  function iddia(over: Partial<IddiaOzet>): IddiaOzet {
    return {
      id: "id-1",
      hedefTablo: "controls",
      hedefId: "c-1",
      iddiaTuru: "UYUM",
      sonuc: "OLUMLU",
      dogrulamaDurumu: "VERIFIED",
      ...over,
    };
  }

  it("aynı hedef+tür için tek sonuç varsa çatışma yok", () => {
    const sonuc = catismaTespitEt([iddia({ id: "a" }), iddia({ id: "b" })]);
    expect(sonuc).toEqual([]);
  });

  it("aynı hedef+tür için farklı sonuçlar (OLUMLU vs OLUMSUZ) çatışma üretir", () => {
    const sonuc = catismaTespitEt([iddia({ id: "a", sonuc: "OLUMLU" }), iddia({ id: "b", sonuc: "OLUMSUZ" })]);
    expect(sonuc).toHaveLength(1);
    expect(sonuc[0].farkliSonuclar).toEqual(["OLUMLU", "OLUMSUZ"]);
    expect(sonuc[0].iddiaIdleri).toEqual(["a", "b"]);
  });

  it("REJECTED/SUPERSEDED iddialar çatışma hesabına katılmaz", () => {
    const sonuc = catismaTespitEt([
      iddia({ id: "a", sonuc: "OLUMLU" }),
      iddia({ id: "b", sonuc: "OLUMSUZ", dogrulamaDurumu: "REJECTED" }),
    ]);
    expect(sonuc).toEqual([]);
  });

  it("farklı hedef veya farklı iddia türü ayrı gruptur, karşılaştırılmaz", () => {
    const sonuc = catismaTespitEt([
      iddia({ id: "a", sonuc: "OLUMLU", hedefId: "c-1" }),
      iddia({ id: "b", sonuc: "OLUMSUZ", hedefId: "c-2" }),
      iddia({ id: "c", sonuc: "OLUMSUZ", iddiaTuru: "RISK" }),
    ]);
    expect(sonuc).toEqual([]);
  });

  it("hedefsiz (genel) iddialar karşılaştırma dışı bırakılır", () => {
    const sonuc = catismaTespitEt([
      iddia({ id: "a", sonuc: "OLUMLU", hedefTablo: null, hedefId: null }),
      iddia({ id: "b", sonuc: "OLUMSUZ", hedefTablo: null, hedefId: null }),
    ]);
    expect(sonuc).toEqual([]);
  });

  it("üç farklı sonuç (KOSULLU dahil) hepsini raporlar", () => {
    const sonuc = catismaTespitEt([
      iddia({ id: "a", sonuc: "OLUMLU" }),
      iddia({ id: "b", sonuc: "OLUMSUZ" }),
      iddia({ id: "c", sonuc: "KOSULLU" }),
    ]);
    expect(sonuc[0].farkliSonuclar).toEqual(["KOSULLU", "OLUMLU", "OLUMSUZ"]);
  });

  it("girdi sırası sonucu etkilemez (deterministik)", () => {
    const a = iddia({ id: "a", sonuc: "OLUMLU" });
    const b = iddia({ id: "b", sonuc: "OLUMSUZ" });
    expect(catismaTespitEt([a, b])).toEqual(catismaTespitEt([b, a]));
  });
});
