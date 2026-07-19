import { describe, expect, it } from "vitest";
import { simulasyonTamamlamalariniBelirle } from "../egitim-simulasyon-bagi";

describe("simulasyonTamamlamalariniBelirle (M18 sonraki dilim: tatbikat → eğitim bağı)", () => {
  it("egitimKonusu null ise hiçbir tamamlama üretmez", () => {
    const sonuc = simulasyonTamamlamalariniBelirle({
      egitimKonusu: null,
      katilimcilar: [{ userId: "u1", katilimTipi: "katilimci" }],
      aktifAtamalar: [{ assignmentId: "a1", kullanici: "u1", konu: "GUVENLIK" }],
    });
    expect(sonuc).toEqual([]);
  });

  it("konu eşleşen + katılımcı rolündeki kullanıcı için tamamlama üretir", () => {
    const sonuc = simulasyonTamamlamalariniBelirle({
      egitimKonusu: "GUVENLIK",
      katilimcilar: [{ userId: "u1", katilimTipi: "katilimci" }],
      aktifAtamalar: [{ assignmentId: "a1", kullanici: "u1", konu: "GUVENLIK" }],
    });
    expect(sonuc).toEqual([{ assignmentId: "a1", kullanici: "u1" }]);
  });

  it("yönetici ve gözlemci rolündeki kullanıcılar dışlanır", () => {
    const sonuc = simulasyonTamamlamalariniBelirle({
      egitimKonusu: "GUVENLIK",
      katilimcilar: [
        { userId: "yonetici1", katilimTipi: "yonetici" },
        { userId: "gozlemci1", katilimTipi: "gozlemci" },
      ],
      aktifAtamalar: [
        { assignmentId: "a1", kullanici: "yonetici1", konu: "GUVENLIK" },
        { assignmentId: "a2", kullanici: "gozlemci1", konu: "GUVENLIK" },
      ],
    });
    expect(sonuc).toEqual([]);
  });

  it("konu eşleşmeyen atama dışlanır", () => {
    const sonuc = simulasyonTamamlamalariniBelirle({
      egitimKonusu: "GUVENLIK",
      katilimcilar: [{ userId: "u1", katilimTipi: "katilimci" }],
      aktifAtamalar: [{ assignmentId: "a1", kullanici: "u1", konu: "KVKK" }],
    });
    expect(sonuc).toEqual([]);
  });

  it("katılımcının o konuda aktif ataması yoksa atlanır (eğitim matrisi kurulmamış olabilir)", () => {
    const sonuc = simulasyonTamamlamalariniBelirle({
      egitimKonusu: "GUVENLIK",
      katilimcilar: [{ userId: "u1", katilimTipi: "katilimci" }],
      aktifAtamalar: [],
    });
    expect(sonuc).toEqual([]);
  });

  it("aynı konuda birden fazla gereksinim/atama varsa hepsi üretilir", () => {
    const sonuc = simulasyonTamamlamalariniBelirle({
      egitimKonusu: "GUVENLIK",
      katilimcilar: [{ userId: "u1", katilimTipi: "katilimci" }],
      aktifAtamalar: [
        { assignmentId: "a1", kullanici: "u1", konu: "GUVENLIK" },
        { assignmentId: "a2", kullanici: "u1", konu: "GUVENLIK" },
      ],
    });
    expect(sonuc).toHaveLength(2);
  });

  it("birden fazla katılımcı, karışık konu — yalnız eşleşenler döner", () => {
    const sonuc = simulasyonTamamlamalariniBelirle({
      egitimKonusu: "GUVENLIK",
      katilimcilar: [
        { userId: "u1", katilimTipi: "katilimci" },
        { userId: "u2", katilimTipi: "katilimci" },
      ],
      aktifAtamalar: [
        { assignmentId: "a1", kullanici: "u1", konu: "GUVENLIK" },
        { assignmentId: "a2", kullanici: "u2", konu: "KVKK" },
      ],
    });
    expect(sonuc).toEqual([{ assignmentId: "a1", kullanici: "u1" }]);
  });
});
