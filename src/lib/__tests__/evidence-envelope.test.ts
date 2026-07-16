import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { canonicalJson, envelopeHash, type EvidenceEnvelope } from "../evidence-envelope";

function zarf(patch: Partial<EvidenceEnvelope> = {}): EvidenceEnvelope {
  return {
    evidenceId: "e0000000-0000-0000-0000-000000000001",
    tenantId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    version: 1,
    sha256: "ab".repeat(32),
    sizeBytes: 12345,
    mimeType: "application/pdf",
    sourceType: "MANUAL_UPLOAD",
    sourceSystem: "PENTEST_VENDOR",
    capturedAt: "2026-07-01T00:00:00.000Z",
    uploadedAt: "2026-07-16T10:00:00.000Z",
    uploadedBy: "a0000000-0000-0000-0000-000000000001",
    retentionClass: "AUDIT_10Y",
    classification: "CONFIDENTIAL",
    previousVersionHash: null,
    controlRefs: ["CTRL-IAM-001"],
    legalHold: false,
    ...patch,
  };
}

describe("canonicalJson", () => {
  it("anahtar sırası çıktıyı etkilemez", async () => {
    // Asıl mesele bu: JSON.stringify ekleme sırasını korur, dolayısıyla
    // aynı zarfı farklı sırayla kuran iki kod yolu farklı hash üretirdi.
    const a = { b: 1, a: 2, c: 3 };
    const b = { c: 3, a: 2, b: 1 };

    expect(canonicalJson(a)).toBe(canonicalJson(b));
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b)); // sorunun kendisi
  });

  it("anahtarları alfabetik sıralar ve boşluk bırakmaz", () => {
    expect(canonicalJson({ z: 1, a: "x" })).toBe('{"a":"x","z":1}');
  });

  it("dizi sırasını KORUR (veri sırası anlamlıdır)", () => {
    expect(canonicalJson({ r: ["b", "a"] })).toBe('{"r":["b","a"]}');
    expect(canonicalJson({ r: ["b", "a"] })).not.toBe(canonicalJson({ r: ["a", "b"] }));
  });

  it("null, boolean ve sayıları doğru kodlar", () => {
    expect(canonicalJson({ a: null, b: false, c: 0 })).toBe('{"a":null,"b":false,"c":0}');
  });

  it("string içindeki özel karakterler kaçırılır", () => {
    expect(canonicalJson({ a: 'tırnak "x"' })).toBe('{"a":"tırnak \\"x\\""}');
  });
});

describe("envelopeHash", () => {
  it("aynı zarf her zaman aynı hash'i verir", async () => {
    expect(await envelopeHash(zarf())).toBe(await envelopeHash(zarf()));
  });

  it("alan sırası farklı kurulan aynı zarf aynı hash'i verir", async () => {
    const duz = zarf();
    // Alanları ters sırada yeniden kur: içerik aynı, ekleme sırası farklı.
    const tersSirali = Object.fromEntries(
      Object.entries(duz).reverse(),
    ) as unknown as EvidenceEnvelope;

    expect(await envelopeHash(tersSirali)).toBe(await envelopeHash(duz));
  });

  it("bağımsız referansla eşleşir (canonical metnin SHA-256'sı)", async () => {
    // envelopeHash Web Crypto kullanır; burada node:crypto ile aynı değeri
    // ayrı bir yoldan kuruyoruz — kodun kendi kendini onaylamaması için.
    const e = zarf();
    const beklenen = createHash("sha256").update(canonicalJson(e as never), "utf8").digest("hex");

    expect(await envelopeHash(e)).toBe(beklenen);
  });

  for (const [alan, deger] of [
    ["sha256", "cd".repeat(32)],
    ["sizeBytes", 999],
    ["uploadedAt", "2026-07-17T10:00:00.000Z"],
    ["classification", "PUBLIC"],
    ["legalHold", true],
    ["previousVersionHash", "ef".repeat(32)],
  ] as const) {
    it(`${alan} değişirse hash değişir`, async () => {
      expect(await envelopeHash(zarf({ [alan]: deger }))).not.toBe(await envelopeHash(zarf()));
    });
  }

  it("controlRefs değişirse hash değişir", async () => {
    // Kanıtın HANGİ kontrol için sunulduğu zarfın parçasıdır: aynı dosyayı
    // başka bir kontrole bağlamak yeni bir iddiadır, aynı zarf değil.
    expect(await envelopeHash(zarf({ controlRefs: ["CTRL-IAM-002"] }))).not.toBe(
      await envelopeHash(zarf()),
    );
  });

  it("dosya aynı kalsa bile zarf değişirse hash değişir", async () => {
    // sha256 (dosya) sabit, sourceSystem farklı: dosya aynı ama iddia farklı.
    // Dosya hash'ini sabitlemek bunu yakalamazdı — zarfı sabitlemek yakalar.
    expect(await envelopeHash(zarf({ sourceSystem: "BASKA_TEDARIKCI" }))).not.toBe(
      await envelopeHash(zarf()),
    );
  });

  it("SHA-256 hex biçimindedir", async () => {
    expect(await envelopeHash(zarf())).toMatch(/^[0-9a-f]{64}$/);
  });
});
