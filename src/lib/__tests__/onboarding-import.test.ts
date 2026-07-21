import { describe, expect, it } from "vitest";
import { onboardingImportAyristir } from "../onboarding-import";

describe("onboardingImportAyristir — KRITIK_HIZMET", () => {
  it("1) geçerli CSV doğru ayrıştırılır", () => {
    const csv = "ad,durum\nÖdeme Sistemi,AKTIF\nMuhasebe Sistemi,AKTIF\n";
    const r = onboardingImportAyristir("KRITIK_HIZMET", csv, csv.length);
    expect(r.dosyaHatasi).toBeNull();
    expect(r.kayitlar).toHaveLength(2);
    expect(r.kayitlar[0]).toEqual({ ad: "Ödeme Sistemi", durum: "AKTIF" });
  });

  it("2) boş 'ad' satır hatası üretir, dosyayı reddetmez", () => {
    const csv = "ad\nGeçerli Hizmet\n,\n";
    const r = onboardingImportAyristir("KRITIK_HIZMET", csv, csv.length);
    expect(r.dosyaHatasi).toBeNull();
    expect(r.kayitlar).toHaveLength(1);
    expect(r.satirHatalari).toHaveLength(1);
  });

  it("3) eksik zorunlu kolon dosyayı reddeder", () => {
    const csv = "durum\nAKTIF\n";
    const r = onboardingImportAyristir("KRITIK_HIZMET", csv, csv.length);
    expect(r.dosyaHatasi?.kod).toBe("EKSIK_ZORUNLU_KOLON");
  });

  it("4) null byte reddedilir", () => {
    const csv = "ad\nX\0Y\n";
    const r = onboardingImportAyristir("KRITIK_HIZMET", csv, csv.length);
    expect(r.dosyaHatasi?.kod).toBe("NULL_BYTE");
  });

  it("5) formula injection (=/+/-/@ ile başlayan hücre) reddedilir", () => {
    const csv = "ad\n=SUM(A1:A10)\n";
    const r = onboardingImportAyristir("KRITIK_HIZMET", csv, csv.length);
    expect(r.dosyaHatasi?.kod).toBe("FORMULA_INJECTION");
  });

  it("6) yinelenen başlık reddedilir", () => {
    const csv = "ad,ad\nX,Y\n";
    const r = onboardingImportAyristir("KRITIK_HIZMET", csv, csv.length);
    expect(r.dosyaHatasi?.kod).toBe("YINELENEN_BASLIK");
  });

  it("7) boş dosya reddedilir", () => {
    const r = onboardingImportAyristir("KRITIK_HIZMET", "", 0);
    expect(r.dosyaHatasi?.kod).toBe("BOS_DOSYA");
  });

  it("8) BOM temizlenir", () => {
    const csv = "﻿ad\nX\n";
    const r = onboardingImportAyristir("KRITIK_HIZMET", csv, csv.length);
    expect(r.dosyaHatasi).toBeNull();
    expect(r.kayitlar[0].ad).toBe("X");
  });

  it("9) tırnaklı virgüllü alan doğru ayrıştırılır (RFC4180)", () => {
    const csv = 'ad\n"Ödeme, Takas Sistemi"\n';
    const r = onboardingImportAyristir("KRITIK_HIZMET", csv, csv.length);
    expect(r.kayitlar[0].ad).toBe("Ödeme, Takas Sistemi");
  });
});

describe("onboardingImportAyristir — KONTROL", () => {
  it("10) madde_ref zorunlu kolon", () => {
    const csv = "madde_ref\nVII-128.10-md.26\n";
    const r = onboardingImportAyristir("KONTROL", csv, csv.length);
    expect(r.dosyaHatasi).toBeNull();
    expect(r.kayitlar[0]).toEqual({ madde_ref: "VII-128.10-md.26" });
  });

  it("11) 'ad' kolonu KONTROL için zorunlu kolon eksikliği sayılmaz", () => {
    const csv = "madde_ref\nX\n";
    const r = onboardingImportAyristir("KONTROL", csv, csv.length);
    expect(r.dosyaHatasi).toBeNull();
  });
});

describe("onboardingImportAyristir — TEDARIKCI", () => {
  it("12) ad + opsiyonel hizmet_ozeti", () => {
    const csv = "ad,hizmet_ozeti\nAWS,Bulut altyapısı\n";
    const r = onboardingImportAyristir("TEDARIKCI", csv, csv.length);
    expect(r.kayitlar[0]).toEqual({ ad: "AWS", hizmet_ozeti: "Bulut altyapısı" });
  });
});

describe("onboardingImportAyristir — sınırlar", () => {
  it("13) çok büyük dosya reddedilir", () => {
    const r = onboardingImportAyristir("KRITIK_HIZMET", "ad\nX\n", 3 * 1024 * 1024);
    expect(r.dosyaHatasi?.kod).toBe("COK_BUYUK");
  });

  it("14) determinizm: aynı girdi aynı çıktı", () => {
    const csv = "ad\nA\nB\nC\n";
    const r1 = onboardingImportAyristir("KRITIK_HIZMET", csv, csv.length);
    const r2 = onboardingImportAyristir("KRITIK_HIZMET", csv, csv.length);
    expect(r1).toEqual(r2);
  });
});
