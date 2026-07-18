import { describe, expect, it } from "vitest";
import {
  csvAyristir,
  diffHesapla,
  dosyaHash,
  kayitlarHash,
  normalize,
  onizlemeBayatMi,
  type MevcutAtama,
  type SodAssignmentImportRecord,
} from "../sod-import";

// M16 PR-3A: sağlayıcıdan bağımsız sözleşme + güvenli CSV parser + deterministik
// dry-run. Bu dosya kabul kapısının HER maddesini sınar: parser sıra-bağımsız
// ve deterministik; formula injection + bozuk CSV reddedilir; aynı dosya aynı
// hash + aynı diff; snapshot değişince eski preview bayat.

const BASLIK =
  "external_subject_id,subject_type,display_name,email,role_code,activity_code,system_code,valid_from,valid_to,source,source_record_id";

function csv(satirlar: string[]): string {
  return [BASLIK, ...satirlar].join("\n");
}

/** Ham metni ayrıştır + normalize et; kayıtları döndür. */
function ayristirNormalize(metin: string) {
  const bytes = new TextEncoder().encode(metin);
  const p = csvAyristir(metin, bytes.byteLength);
  expect(p.dosyaHatasi).toBeNull();
  return normalize(p.basliklar, p.satirlar);
}

const SATIR_A = "ext-1,USER,Ayşe,a@x.com,ROL1,KANIT_YUKLE,kalkan_os,2026-01-01,,hr,rec-1";
const SATIR_B = "ext-2,USER,Mehmet,,ROL2,ONAY,kalkan_os,2026-01-01,,hr,rec-2";

describe("csvAyristir — dosya güvenliği + yapı", () => {
  it("boş dosya reddedilir", () => {
    const p = csvAyristir("", 0);
    expect(p.dosyaHatasi?.kod).toBe("BOS_DOSYA");
  });

  it("null byte reddedilir", () => {
    const metin = csv([SATIR_A]) + "\0";
    const p = csvAyristir(metin, metin.length);
    expect(p.dosyaHatasi?.kod).toBe("NULL_BYTE");
  });

  it("çok büyük dosya reddedilir", () => {
    const p = csvAyristir(csv([SATIR_A]), 10 * 1024 * 1024);
    expect(p.dosyaHatasi?.kod).toBe("COK_BUYUK");
  });

  it("yinelenen başlık reddedilir", () => {
    const kotu = BASLIK + ",source" + "\n" + SATIR_A + ",x";
    const p = csvAyristir(kotu, kotu.length);
    expect(p.dosyaHatasi?.kod).toBe("YINELENEN_BASLIK");
  });

  it("eksik zorunlu kolon reddedilir", () => {
    const kotu = "external_subject_id,subject_type\next-1,USER";
    const p = csvAyristir(kotu, kotu.length);
    expect(p.dosyaHatasi?.kod).toBe("EKSIK_ZORUNLU_KOLON");
  });

  it("BOM temizlenir", () => {
    const metin = "﻿" + csv([SATIR_A]);
    const p = csvAyristir(metin, metin.length);
    expect(p.dosyaHatasi).toBeNull();
    expect(p.basliklar[0]).toBe("external_subject_id");
  });

  it("kolon sırası ÖNEMSİZ — indeksle çözülür", () => {
    const tersBaslik = "source_record_id,source,valid_to,valid_from,system_code,activity_code,role_code,email,display_name,subject_type,external_subject_id";
    const tersSatir = "rec-1,hr,,2026-01-01,kalkan_os,KANIT_YUKLE,ROL1,a@x.com,Ayşe,USER,ext-1";
    const metin = [tersBaslik, tersSatir].join("\n");
    const p = csvAyristir(metin, metin.length);
    const n = normalize(p.basliklar, p.satirlar);
    expect(n.kayitlar[0].externalSubjectId).toBe("ext-1");
    expect(n.kayitlar[0].activityCode).toBe("KANIT_YUKLE");
  });
});

describe("normalize — formula injection + doğrulama", () => {
  it("formül karakteriyle başlayan hücre satırı reddeder (FORMULA_INJECTION)", () => {
    for (const kotu of ['=cmd()', "+1+1", "-2", "@SUM(A1)"]) {
      const n = ayristirNormalize(csv([`${kotu},USER,x,,,AKT,sys,2026-01-01,,hr,rec-9`]));
      expect(n.kayitlar).toHaveLength(0);
      expect(n.satirHatalari[0].kod).toBe("FORMULA_INJECTION");
    }
  });

  it("geçersiz subject_type reddedilir", () => {
    const n = ayristirNormalize(csv(["ext-1,ADMIN,x,,,AKT,sys,2026-01-01,,hr,rec-1"]));
    expect(n.satirHatalari[0].kod).toBe("GECERSIZ_SUBJECT_TYPE");
  });

  it("geçersiz tarih reddedilir", () => {
    const n = ayristirNormalize(csv(["ext-1,USER,x,,,AKT,sys,01-01-2026,,hr,rec-1"]));
    expect(n.satirHatalari[0].kod).toBe("GECERSIZ_TARIH");
  });

  it("zorunlu alan boşsa reddedilir", () => {
    const n = ayristirNormalize(csv(["ext-1,USER,x,,,,sys,2026-01-01,,hr,rec-1"]));
    expect(n.satirHatalari[0].kod).toBe("ZORUNLU_ALAN_BOS");
  });

  it("e-posta küçük harfe indirilir (değişmez kimlik değil, ipucu)", () => {
    const n = ayristirNormalize(csv(["ext-1,USER,x,A@X.COM,,AKT,sys,2026-01-01,,hr,rec-1"]));
    expect(n.kayitlar[0].email).toBe("a@x.com");
  });

  it("aynı (source, sourceRecordId) iki satırda: DUPLICATE tespit edilir", () => {
    const n = ayristirNormalize(csv([SATIR_A, "ext-9,USER,z,,,BASKA,sys,2026-01-01,,hr,rec-1"]));
    expect(n.duplicateler).toHaveLength(1);
    expect(n.duplicateler[0]).toMatchObject({ source: "hr", sourceRecordId: "rec-1" });
  });

  it("tırnaklı alan + virgül doğru ayrışır", () => {
    const n = ayristirNormalize(csv(['ext-1,USER,"Yılmaz, Ayşe",,,AKT,sys,2026-01-01,,hr,rec-1']));
    expect(n.kayitlar[0].displayName).toBe("Yılmaz, Ayşe");
  });
});

describe("determinizm — sıra bağımsız, aynı dosya aynı hash", () => {
  it("satır sırası normalize çıktısını ETKİLEMEZ", () => {
    const a = ayristirNormalize(csv([SATIR_A, SATIR_B]));
    const b = ayristirNormalize(csv([SATIR_B, SATIR_A]));
    expect(a.kayitlar).toEqual(b.kayitlar); // ikisi de (source,recordId) sıralı
  });

  it("aynı dosya aynı normalizedRecordsHash verir; sıra değişse de", async () => {
    const a = ayristirNormalize(csv([SATIR_A, SATIR_B]));
    const b = ayristirNormalize(csv([SATIR_B, SATIR_A]));
    expect(await kayitlarHash(a.kayitlar)).toBe(await kayitlarHash(b.kayitlar));
  });

  it("fileHash ham baytların hash'i — deterministik", async () => {
    const bytes = new TextEncoder().encode(csv([SATIR_A]));
    expect(await dosyaHash(bytes)).toBe(await dosyaHash(bytes));
  });

  it("bir alan değişince normalizedRecordsHash değişir", async () => {
    const a = ayristirNormalize(csv([SATIR_A]));
    const b = ayristirNormalize(csv([SATIR_A.replace("KANIT_YUKLE", "BASKA_AKT")]));
    expect(await kayitlarHash(a.kayitlar)).not.toBe(await kayitlarHash(b.kayitlar));
  });
});

describe("diffHesapla — ekle/güncelle/değişmez/sona erdir", () => {
  const kayit = (patch: Partial<SodAssignmentImportRecord> = {}): SodAssignmentImportRecord => ({
    externalSubjectId: "ext-1",
    subjectType: "USER",
    displayName: null,
    email: null,
    roleCode: "ROL1",
    activityCode: "KANIT_YUKLE",
    systemCode: "kalkan_os",
    validFrom: "2026-01-01",
    validTo: null,
    source: "hr",
    sourceRecordId: "rec-1",
    ...patch,
  });
  const mevcut = (patch: Partial<MevcutAtama> = {}): MevcutAtama => ({
    source_record_id: "rec-1",
    kaynak_sistem: "hr",
    aktivite_kodu: "KANIT_YUKLE",
    rol_kodu: "ROL1",
    sistem_kapsami: "kalkan_os",
    gecerlilik_baslangic: "2026-01-01",
    gecerlilik_bitis: null,
    ...patch,
  });

  it("yeni kayıt EKLENECEK", () => {
    const d = diffHesapla([kayit()], [], "DELTA");
    expect(d.eklenecek).toHaveLength(1);
    expect(d.guncellenecek).toHaveLength(0);
  });

  it("aynı kayıt DEĞİŞMEYECEK", () => {
    const d = diffHesapla([kayit()], [mevcut()], "DELTA");
    expect(d.degismeyecek).toHaveLength(1);
    expect(d.eklenecek).toHaveLength(0);
  });

  it("alanı değişen kayıt GÜNCELLENECEK", () => {
    const d = diffHesapla([kayit({ validTo: "2026-12-31" })], [mevcut()], "DELTA");
    expect(d.guncellenecek).toHaveLength(1);
  });

  it("DELTA modunda sona erdirme YOK", () => {
    const d = diffHesapla([], [mevcut()], "DELTA");
    expect(d.sonaErdirilecek).toHaveLength(0);
  });

  it("SNAPSHOT (boş dosya) kaynağın tüm aktif atamalarını SONA ERDİRİR", () => {
    // Otoriter kaynak 'hr' boş geldi → 'hr' atamaları sona erer.
    const d = diffHesapla([], [mevcut()], "AUTHORITATIVE_SNAPSHOT", "hr");
    expect(d.sonaErdirilecek).toHaveLength(1);
  });

  it("SNAPSHOT: BAŞKA kaynağın ataması etkilenmez (kurucu §11)", () => {
    // Otoriter kaynak 'hr'; mevcut 'ldap' ataması gelende yok ama BAŞKA
    // kaynak — dokunulmaz.
    const d = diffHesapla(
      [kayit()],
      [mevcut({ kaynak_sistem: "ldap", source_record_id: "l-1" })],
      "AUTHORITATIVE_SNAPSHOT",
      "hr",
    );
    expect(d.sonaErdirilecek).toHaveLength(0);
    expect(d.eklenecek).toHaveLength(1);
  });

  it("source_record_id'si olmayan (eski/elle) atama SNAPSHOT sona-erdirmesine dahil değil", () => {
    const d = diffHesapla([kayit()], [mevcut({ source_record_id: null })], "AUTHORITATIVE_SNAPSHOT", "hr");
    expect(d.sonaErdirilecek).toHaveLength(0);
  });

  it("aynı dosya aynı diff'i verir (determinizm)", () => {
    const d1 = diffHesapla([kayit()], [mevcut()], "DELTA");
    const d2 = diffHesapla([kayit()], [mevcut()], "DELTA");
    expect(d1).toEqual(d2);
  });
});

describe("onizlemeBayatMi — stale preview (409 zemini)", () => {
  it("snapshot değişince BAYAT", () => {
    expect(onizlemeBayatMi("hashA", "hashB", "rv1", "rv1")).toBe(true);
  });
  it("kural seti değişince BAYAT", () => {
    expect(onizlemeBayatMi("hashA", "hashA", "rv1", "rv2")).toBe(true);
  });
  it("ikisi de aynıysa TAZE", () => {
    expect(onizlemeBayatMi("hashA", "hashA", "rv1", "rv1")).toBe(false);
  });
});
