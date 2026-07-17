import referansCanonicalize from "canonicalize";
import { describe, expect, it } from "vitest";
import {
  canonicalHash,
  canonicalJson,
  kanonikSayi,
  kanonikZaman,
  type CanonicalDeger,
} from "../canonical";

/** RFC 8785 referans implementasyonu — hakem. */
function referans(deger: CanonicalDeger): string {
  const out = referansCanonicalize(deger as unknown);
  if (out === undefined) throw new Error("referans: serilestirilemedi");
  return out;
}

/**
 * ESKİ kanonikleştirme (JCS'e geçmeden önce evidence-envelope.ts'te olan).
 * Burada yalnızca GEÇİŞİN GÜVENLİ olduğunu kanıtlamak için duruyor: JCS'e
 * geçmek, daha önce mühürlenmiş zarfların hash'ini SESSİZCE değiştirseydi
 * eski kanıtlar doğrulanamaz hale gelirdi ve bunu ancak canlıda fark ederdik.
 */
function eskiCanonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((v) => eskiCanonicalJson(v)).join(",")}]`;
  const rec = value as Record<string, unknown>;
  const keys = Object.keys(rec).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${eskiCanonicalJson(rec[k])}`).join(",")}}`;
}

describe("canonicalJson — RFC 8785", () => {
  it("anahtarları sıralar, boşluk bırakmaz", () => {
    expect(canonicalJson({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
  });

  it("dizi sırasını KORUR — sıra çağıranın verisidir", () => {
    expect(canonicalJson(["b", "a"])).toBe('["b","a"]');
  });

  it("iç içe nesnelerde de sıralar", () => {
    expect(canonicalJson({ z: { y: 1, x: 2 } })).toBe('{"z":{"x":2,"y":1}}');
  });

  it("Türkçe karakterleri escape ETMEZ — ham bırakır (RFC 8785)", () => {
    expect(canonicalJson({ ad: "açık ışık" })).toBe('{"ad":"açık ışık"}');
  });

  it("kayan noktayı ECMAScript kuralıyla yazar: 10.0 -> 10", () => {
    expect(canonicalJson({ a: 10.0 })).toBe('{"a":10}');
  });

  it("undefined'ı sessizce hash'lemez, patlar", () => {
    // Sessiz düşme, {a: undefined} ile {} arasındaki farkı yok ederdi.
    expect(() => canonicalJson(undefined as unknown as CanonicalDeger)).toThrow();
  });

  it("null ile boş dizi ile eksik alan AYRI hash verir", () => {
    // "Değer yok"un üç farklı anlamı var; hash bunları karıştırmamalı.
    const a = canonicalJson({ k: null });
    const b = canonicalJson({ k: [] });
    const c = canonicalJson({});
    expect(new Set([a, b, c]).size).toBe(3);
  });
});

describe("RFC 8785 UYGUNLUĞU — referans implementasyona karşı", () => {
  // `canonicalize` RFC 8785'in referans JS implementasyonu ve YALNIZCA burada,
  // devDependency olarak duruyor. Runtime'da kullanılmıyor: yalnızca `import`
  // koşulu tanımladığı için tsx script'lerinden çözülemiyordu ve bu ürünün
  // tüm iddiası, denetçinin hash'i BAĞIMSIZ olarak hesaplayabilmesi.
  //
  // Yani uygunluk iddiamız "bize güvenin" değil: kendi uygulamamızın
  // referansla birebir aynı çıktıyı verdiğini aşağıdaki külliyat gösteriyor.
  const KULLIYAT: [string, CanonicalDeger][] = [
    ["düz nesne", { b: 1, a: 2 }],
    ["iç içe", { z: { y: 1, x: { w: true } } }],
    ["dizi sırası", ["b", "a", "c"]],
    ["nesne dizisi", [{ b: 1 }, { a: 2 }]],
    ["null", { k: null }],
    ["boş nesne/dizi", { a: {}, b: [] }],
    ["boolean", { t: true, f: false }],
    ["tam sayı", { a: 0, b: -1, c: 1000000 }],
    ["kayan nokta", { a: 10.0, b: 0.5, c: -0.25, d: 1e21, e: 1e-7 }],
    ["türkçe", { ad: "açık ışık ğüşiöç", buyuk: "İSTANBUL" }],
    ["escape gerektiren", { s: 'tirnak" ters\\ satir\nsekme\t' }],
    ["kontrol karakteri", { s: "" }],
    ["unicode ötesi", { s: "emoji 🔐 ve çince 中文" }],
    ["anahtar sırası UTF-16", { "é": 1, a: 2, Z: 3, "10": 4, "2": 5 }],
    ["derin karışık", { l: [1, "a", null, { m: [true, { n: 0.1 }] }] }],
  ];

  for (const [ad, deger] of KULLIYAT) {
    it(`referansla aynı: ${ad}`, () => {
      expect(canonicalJson(deger)).toBe(referans(deger));
    });
  }
});

describe("JCS'in yasakladıkları sessizce geçmez", () => {
  it("NaN reddedilir — JSON.stringify onu sessizce null yapardı", () => {
    // Bir sayıyı yokluğa çevirip hash'e sokmak, hash'in ölçtüğü şeyi bozardı.
    expect(() => canonicalJson({ a: NaN } as unknown as CanonicalDeger)).toThrow();
  });

  it("Infinity reddedilir", () => {
    expect(() => canonicalJson({ a: Infinity } as unknown as CanonicalDeger)).toThrow();
  });

  it("nesne içindeki undefined alan reddedilir — sessizce düşerse {a:undefined} ile {} aynı olurdu", () => {
    expect(() => canonicalJson({ a: undefined } as unknown as CanonicalDeger)).toThrow();
  });
});

describe("JCS geçişi mevcut zarf hash'lerini BOZMUYOR", () => {
  // Zarf alanları: string, tam sayı, boolean, null, string[].
  const zarf = {
    evidenceId: "e1",
    tenantId: "t1",
    version: 2,
    sha256: "a".repeat(64),
    sizeBytes: 1024,
    mimeType: "application/pdf",
    sourceType: "upload",
    sourceSystem: null,
    capturedAt: null,
    uploadedAt: "2026-07-17T09:00:00.000Z",
    uploadedBy: "u1",
    retentionClass: "10y",
    classification: "gizli",
    previousVersionHash: null,
    controlRefs: ["CTRL-IAM-001", "CTRL-IAM-002"],
    legalHold: false,
  };

  it("eski algoritma ile JCS aynı çıktıyı veriyor (bu veri tipleri için)", () => {
    expect(canonicalJson(zarf)).toBe(eskiCanonicalJson(zarf));
  });

  it("Türkçe metin içeren alanda da aynı", () => {
    const tr = { ...zarf, classification: "çok gizli — ışık" };
    expect(canonicalJson(tr)).toBe(eskiCanonicalJson(tr));
  });
});

describe("kanonikZaman", () => {
  it("Postgres'in +00:00 biçimini JS'in Z biçimiyle AYNI hash'e getirir", () => {
    // Aynı an, iki farklı string. Sabitlemeseydik hash, veriyi hangi
    // katmandan okuduğumuza göre değişirdi.
    expect(kanonikZaman("2026-07-17T09:00:00+00:00")).toBe(kanonikZaman("2026-07-17T09:00:00.000Z"));
  });

  it("yerel saat dilimini UTC'ye çevirir", () => {
    expect(kanonikZaman("2026-07-17T12:00:00+03:00")).toBe("2026-07-17T09:00:00.000Z");
  });

  it("null'ı korur — 'yok' bir tarih değildir", () => {
    expect(kanonikZaman(null)).toBeNull();
  });

  it("geçersiz tarihte patlar", () => {
    expect(() => kanonikZaman("dun")).toThrow();
  });
});

describe("kanonikSayi", () => {
  it("Postgres numeric'in string halini sayıya çevirir", () => {
    // agirlik: "10" (string) ile 10 (number) farklı hash verirdi.
    expect(kanonikSayi("10")).toBe(10);
    expect(canonicalJson({ a: kanonikSayi("10") })).toBe(canonicalJson({ a: kanonikSayi(10) }));
  });

  it("10.0 ile 10 aynı", () => {
    expect(canonicalJson({ a: kanonikSayi("10.0") })).toBe(canonicalJson({ a: kanonikSayi(10) }));
  });

  it("sayıya çevrilemeyende patlar", () => {
    expect(() => kanonikSayi("abc")).toThrow();
  });
});

describe("canonicalHash", () => {
  it("deterministik", async () => {
    expect(await canonicalHash({ a: 1 })).toBe(await canonicalHash({ a: 1 }));
  });

  it("anahtar sırasından etkilenmez", async () => {
    expect(await canonicalHash({ a: 1, b: 2 })).toBe(await canonicalHash({ b: 2, a: 1 }));
  });

  it("tek alan değişince değişir", async () => {
    expect(await canonicalHash({ a: 1 })).not.toBe(await canonicalHash({ a: 2 }));
  });
});
