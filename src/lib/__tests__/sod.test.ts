import { describe, expect, it } from "vitest";
import {
  atamaSnapshotHash,
  kuralSetiHash,
  sodDegerlendir,
  sodFingerprint,
  type SodAtama,
  type SodKural,
} from "../sod";

function kural(patch: Partial<SodKural> = {}): SodKural {
  return {
    id: "r1",
    kod: "SOD-01",
    durum: "aktif",
    onem: "kritik",
    // sistem_kapsami: null — genel kural, hangi sistemde olursa olsun
    // geçerli. Asıl çatışma kararı atamaların ORTAK kapsamına göre verilir.
    tarafA: { aktivite_kodu: "KANIT_YUKLE", rol_kodu: null, sistem_kapsami: null },
    tarafB: { aktivite_kodu: "KANIT_ONAYLA", rol_kodu: null, sistem_kapsami: null },
    ...patch,
  };
}

function atama(patch: Partial<SodAtama> = {}): SodAtama {
  return {
    kisiKimligi: "u1",
    aktivite_kodu: "KANIT_YUKLE",
    rol_kodu: null,
    sistem_kapsami: "kalkan_os",
    ...patch,
  };
}

describe("sodDegerlendir — temel çatışma tespiti", () => {
  it("aynı kişide çatışan iki atama çatışma oluşturur", async () => {
    const atamalar = [
      atama({ kisiKimligi: "u1", aktivite_kodu: "KANIT_YUKLE" }),
      atama({ kisiKimligi: "u1", aktivite_kodu: "KANIT_ONAYLA" }),
    ];
    const sonuc = await sodDegerlendir("t1", atamalar, [kural()]);
    expect(sonuc).toHaveLength(1);
    expect(sonuc[0].kisiKimligi).toBe("u1");
    expect(sonuc[0].ruleId).toBe("r1");
  });

  it("farklı kişilerin atamaları çatışma oluşturmaz", async () => {
    const atamalar = [
      atama({ kisiKimligi: "u1", aktivite_kodu: "KANIT_YUKLE" }),
      atama({ kisiKimligi: "u2", aktivite_kodu: "KANIT_ONAYLA" }),
    ];
    const sonuc = await sodDegerlendir("t1", atamalar, [kural()]);
    expect(sonuc).toHaveLength(0);
  });

  it("yalnız bir tarafa eşleşen atama tek başına çatışma oluşturmaz", async () => {
    const atamalar = [atama({ kisiKimligi: "u1", aktivite_kodu: "KANIT_YUKLE" })];
    const sonuc = await sodDegerlendir("t1", atamalar, [kural()]);
    expect(sonuc).toHaveLength(0);
  });

  it("pasif kural çatışma üretmez", async () => {
    const atamalar = [
      atama({ kisiKimligi: "u1", aktivite_kodu: "KANIT_YUKLE" }),
      atama({ kisiKimligi: "u1", aktivite_kodu: "KANIT_ONAYLA" }),
    ];
    const sonuc = await sodDegerlendir("t1", atamalar, [kural({ durum: "pasif" })]);
    expect(sonuc).toHaveLength(0);
  });

  it("farklı sistem kapsamındaki A ve B çatışma oluşturmaz", async () => {
    const atamalar = [
      atama({ kisiKimligi: "u1", aktivite_kodu: "KANIT_YUKLE", sistem_kapsami: "sistem-x" }),
      atama({ kisiKimligi: "u1", aktivite_kodu: "KANIT_ONAYLA", sistem_kapsami: "sistem-y" }),
    ];
    const sonuc = await sodDegerlendir("t1", atamalar, [kural()]);
    expect(sonuc).toHaveLength(0);
  });

  it("aynı kapsamda A ve B varsa, farklı kapsamda da olsalar, o kapsam için çatışma bulunur", async () => {
    const atamalar = [
      atama({ kisiKimligi: "u1", aktivite_kodu: "KANIT_YUKLE", sistem_kapsami: "sistem-x" }),
      atama({ kisiKimligi: "u1", aktivite_kodu: "KANIT_ONAYLA", sistem_kapsami: "sistem-x" }),
      atama({ kisiKimligi: "u1", aktivite_kodu: "KANIT_ONAYLA", sistem_kapsami: "sistem-y" }),
    ];
    const sonuc = await sodDegerlendir("t1", atamalar, [kural()]);
    expect(sonuc).toHaveLength(1);
    expect(sonuc[0].sistem_kapsami).toBe("sistem-x");
  });

  it("rol_kodu belirtilmişse eşleşmeli — belirtilmemişse (null) atlanır", async () => {
    const rolluKural = kural({
      tarafA: { aktivite_kodu: "X", rol_kodu: "gelistirici", sistem_kapsami: "kalkan_os" },
      tarafB: { aktivite_kodu: "Y", rol_kodu: null, sistem_kapsami: "kalkan_os" },
    });
    const uyumluAtamalar = [
      atama({ kisiKimligi: "u1", aktivite_kodu: "X", rol_kodu: "gelistirici" }),
      atama({ kisiKimligi: "u1", aktivite_kodu: "Y", rol_kodu: "herhangi" }),
    ];
    expect(await sodDegerlendir("t1", uyumluAtamalar, [rolluKural])).toHaveLength(1);

    const uyumsuzAtamalar = [
      atama({ kisiKimligi: "u1", aktivite_kodu: "X", rol_kodu: "yonetici" }), // rol uymuyor
      atama({ kisiKimligi: "u1", aktivite_kodu: "Y", rol_kodu: "herhangi" }),
    ];
    expect(await sodDegerlendir("t1", uyumsuzAtamalar, [rolluKural])).toHaveLength(0);
  });

  it("birden çok kişi ve kural karışık girdide doğru ayrışır", async () => {
    const k2 = kural({
      id: "r2",
      tarafA: { aktivite_kodu: "BULGU_SAHIBI", rol_kodu: null, sistem_kapsami: "kalkan_os" },
      tarafB: { aktivite_kodu: "BAGIMSIZ_KAPANIS", rol_kodu: null, sistem_kapsami: "kalkan_os" },
    });
    const atamalar = [
      atama({ kisiKimligi: "u1", aktivite_kodu: "KANIT_YUKLE" }),
      atama({ kisiKimligi: "u1", aktivite_kodu: "KANIT_ONAYLA" }), // u1: r1 çatışması
      atama({ kisiKimligi: "u2", aktivite_kodu: "BULGU_SAHIBI" }),
      atama({ kisiKimligi: "u2", aktivite_kodu: "BAGIMSIZ_KAPANIS" }), // u2: r2 çatışması
      atama({ kisiKimligi: "u3", aktivite_kodu: "KANIT_YUKLE" }), // u3: yalnız bir taraf
    ];
    const sonuc = await sodDegerlendir("t1", atamalar, [kural(), k2]);
    expect(sonuc).toHaveLength(2);
    expect(sonuc.map((s) => s.kisiKimligi).sort()).toEqual(["u1", "u2"]);
  });
});

describe("determinizm (kural 11)", () => {
  it("aynı girdi aynı fingerprint'i üretir", async () => {
    const a = await sodFingerprint("t1", "r1", "u1", "kalkan_os");
    const b = await sodFingerprint("t1", "r1", "u1", "kalkan_os");
    expect(a).toBe(b);
  });

  it("farklı kişi farklı fingerprint üretir", async () => {
    const a = await sodFingerprint("t1", "r1", "u1", "kalkan_os");
    const b = await sodFingerprint("t1", "r1", "u2", "kalkan_os");
    expect(a).not.toBe(b);
  });

  it("tekrar değerlendirme AYNI fingerprint'i üretir — duplicate açılmaz", async () => {
    const atamalar = [
      atama({ kisiKimligi: "u1", aktivite_kodu: "KANIT_YUKLE" }),
      atama({ kisiKimligi: "u1", aktivite_kodu: "KANIT_ONAYLA" }),
    ];
    const birinci = await sodDegerlendir("t1", atamalar, [kural()]);
    const ikinci = await sodDegerlendir("t1", atamalar, [kural()]);
    expect(ikinci[0].fingerprint).toBe(birinci[0].fingerprint);
  });

  it("kuralSetiHash sıradan etkilenmez", async () => {
    const k2 = kural({ id: "r2", kod: "SOD-02" });
    const a = await kuralSetiHash([kural(), k2]);
    const b = await kuralSetiHash([k2, kural()]);
    expect(a).toBe(b);
  });

  it("kuralSetiHash bir kural değişince değişir", async () => {
    const a = await kuralSetiHash([kural()]);
    const b = await kuralSetiHash([kural({ onem: "dusuk" })]);
    expect(a).not.toBe(b);
  });

  it("atamaSnapshotHash sıradan etkilenmez", async () => {
    const atamalar = [
      atama({ kisiKimligi: "u1", aktivite_kodu: "A" }),
      atama({ kisiKimligi: "u2", aktivite_kodu: "B" }),
    ];
    const a = await atamaSnapshotHash(atamalar);
    const b = await atamaSnapshotHash([...atamalar].reverse());
    expect(a).toBe(b);
  });

  it("atamaSnapshotHash bir atama değişince değişir", async () => {
    const a = await atamaSnapshotHash([atama({ kisiKimligi: "u1" })]);
    const b = await atamaSnapshotHash([atama({ kisiKimligi: "u2" })]);
    expect(a).not.toBe(b);
  });
});
