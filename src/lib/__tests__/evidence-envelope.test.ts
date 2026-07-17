import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  canonicalJson,
  envelopeHash,
  zarfOlustur,
  type EvidenceEnvelope,
  type EvidenceRow,
} from "../evidence-envelope";

function zarf(patch: Partial<EvidenceEnvelope> = {}): EvidenceEnvelope {
  return {
    evidenceVersionId: "e0000000-0000-0000-0000-000000000001",
    tenantId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    versionNo: 1,
    fileHash: "ab".repeat(32),
    sema: "KALKAN_EVIDENCE_ENVELOPE_V1",
    hashAlgorithm: "sha256",
    fileSize: 12345,
    storageObjectKey: null,
    storageVersionId: null,
    previousFileHash: null,
    mimeType: "application/pdf",
    sourceType: "MANUAL_UPLOAD",
    sourceSystem: "PENTEST_VENDOR",
    capturedAt: "2026-07-01T00:00:00.000Z",
    uploadedAt: "2026-07-16T10:00:00.000Z",
    uploadedBy: "a0000000-0000-0000-0000-000000000001",
    retentionClass: "AUDIT_10Y",
    classification: "CONFIDENTIAL",
    previousEnvelopeHash: null,
    redactionOf: null,
    redactionNote: null,
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

describe("zarfOlustur — DB satırından zarf", () => {
  function satir(patch: Partial<EvidenceRow> = {}): EvidenceRow {
    return {
      id: "e0000000-0000-0000-0000-000000000001",
      tenant_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      tip: "dosya",
      hash_sha256: "ab".repeat(32),
      hash_algorithm: "sha256",
      version_no: 1,
      file_size: 12345,
      mime_type: "application/pdf",
      storage_object_key: null,
      storage_version_id: null,
      source_system: null,
      captured_at: "2026-07-01T00:00:00+00:00",
      created_at: "2026-07-16T10:00:00+00:00",
      yukleyen: "a0000000-0000-0000-0000-000000000001",
      retention_class: "10y",
      classification: "gizli",
      previous_file_hash: null,
      previous_envelope_hash: null,
      redaksiyon_kaynak_id: null,
      redaksiyon_notu: null,
      legal_hold: false,
      envelope_schema_version: "KALKAN_EVIDENCE_ENVELOPE_V1",
      ...patch,
    };
  }

  it("zarf alanları tamsa zarf üretir", () => {
    const z = zarfOlustur(satir(), ["CTRL-IAM-001"]);
    expect(z?.evidenceVersionId).toBe("e0000000-0000-0000-0000-000000000001");
    expect(z?.classification).toBe("gizli");
    expect(z?.sourceType).toBe("dosya");
  });

  it("LEGACY kayıtta NULL döner — zarf UYDURMAZ", () => {
    // Asıl mesele bu: eksik alanlara varsayılan atayıp zarf üretmek, olmayan
    // bir köken iddiasını hash'lemek olurdu ve o hash denetim raporuna
    // "doğrulandı" diye girerdi.
    expect(zarfOlustur(satir({ envelope_schema_version: null }), [])).toBeNull();
    expect(zarfOlustur(satir({ classification: null }), [])).toBeNull();
    expect(zarfOlustur(satir({ retention_class: null }), [])).toBeNull();
  });

  it("tarihleri kanonikleştirir: Postgres'in +00:00'ı zarfta Z olur", () => {
    // Aynı satır, iki farklı katmandan okunduğunda aynı hash vermeli.
    const z = zarfOlustur(satir(), []);
    expect(z?.uploadedAt).toBe("2026-07-16T10:00:00.000Z");
    expect(z?.capturedAt).toBe("2026-07-01T00:00:00.000Z");
  });

  it("controlRefs sırası hash'i etkilemez", async () => {
    const a = zarfOlustur(satir(), ["CTRL-B", "CTRL-A"]);
    const b = zarfOlustur(satir(), ["CTRL-A", "CTRL-B"]);
    expect(await envelopeHash(a!)).toBe(await envelopeHash(b!));
  });

  it("link/beyan kanıtta fileHash null olabilir", () => {
    const z = zarfOlustur(satir({ tip: "link", hash_sha256: null, mime_type: null, file_size: null }), []);
    expect(z?.fileHash).toBeNull();
    expect(z?.sourceType).toBe("link");
  });

  it("storage alanları bugün boş — Storage'a yükleme yok", () => {
    // Bu bir test değil, bir kaydın altını çizmek: zarf "dosya şurada
    // duruyor" diyemez çünkü uygulama dosyayı Storage'a yüklemiyor.
    const z = zarfOlustur(satir(), []);
    expect(z?.storageObjectKey).toBeNull();
    expect(z?.storageVersionId).toBeNull();
  });

  it("zarf alanı değişince hash değişir — köken mühürlü", async () => {
    const temel = await envelopeHash(zarfOlustur(satir(), [])!);
    for (const patch of [
      { classification: "genel" },
      { retention_class: "1y" },
      { captured_at: "2020-01-01T00:00:00+00:00" },
      { version_no: 2 },
      { legal_hold: true },
    ] as Partial<EvidenceRow>[]) {
      expect(await envelopeHash(zarfOlustur(satir(patch), [])!)).not.toBe(temel);
    }
  });
});

describe("redaksiyon — soy bağı + farklı hash (belge M01)", () => {
  function satir(patch: Partial<EvidenceRow> = {}): EvidenceRow {
    return {
      id: "e0000000-0000-0000-0000-000000000009",
      tenant_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      tip: "dosya",
      hash_sha256: "cd".repeat(32),
      hash_algorithm: "sha256",
      version_no: 1,
      file_size: 5000,
      mime_type: "application/pdf",
      storage_object_key: null,
      storage_version_id: null,
      source_system: null,
      captured_at: null,
      created_at: "2026-07-16T10:00:00+00:00",
      yukleyen: "a0000000-0000-0000-0000-000000000001",
      retention_class: "10y",
      classification: "gizli",
      previous_file_hash: null,
      previous_envelope_hash: null,
      redaksiyon_kaynak_id: null,
      redaksiyon_notu: null,
      legal_hold: false,
      envelope_schema_version: "KALKAN_EVIDENCE_ENVELOPE_V1",
      ...patch,
    };
  }

  const orijinalId = "e0000000-0000-0000-0000-000000000001";

  it("zarfOlustur redaksiyon alanlarını taşır", () => {
    const z = zarfOlustur(
      satir({ redaksiyon_kaynak_id: orijinalId, redaksiyon_notu: "Müşteri IP'leri karartıldı" }),
      [],
    );
    expect(z?.redactionOf).toBe(orijinalId);
    expect(z?.redactionNote).toBe("Müşteri IP'leri karartıldı");
  });

  it("redakte zarfın hash'i orijinalinkinden FARKLI — kabul kriteri", async () => {
    // Orijinal ile redakte, biri redaksiyon işaretli diğeri değil ve dosya
    // hash'leri de farklı: iki iddia iki hash.
    const orijinal = zarfOlustur(satir({ hash_sha256: "cd".repeat(32) }), [])!;
    const redakte = zarfOlustur(
      satir({
        id: "e0000000-0000-0000-0000-000000000002",
        hash_sha256: "ef".repeat(32),
        redaksiyon_kaynak_id: orijinalId,
        redaksiyon_notu: "Kişisel veri karartıldı",
      }),
      [],
    )!;
    expect(await envelopeHash(redakte)).not.toBe(await envelopeHash(orijinal));
  });

  it("redactionOf zarf hash'inin parçası — soy iddiası mühürlü", async () => {
    // Aynı redakte dosya, farklı kaynağa işaret ederse hash değişmeli: "X'in
    // redaksiyonuyum" iddiası mühürlenmezse dosya başka orijinalin redaksiyonu
    // gibi gösterilebilirdi.
    const a = zarfOlustur(satir({ redaksiyon_kaynak_id: orijinalId, redaksiyon_notu: "not" }), [])!;
    const b = zarfOlustur(
      satir({ redaksiyon_kaynak_id: "e0000000-0000-0000-0000-000000000042", redaksiyon_notu: "not" }),
      [],
    )!;
    expect(await envelopeHash(a)).not.toBe(await envelopeHash(b));
  });

  it("redaksiyon notu hash'in parçası — ne karartıldığı mühürlü", async () => {
    const a = zarfOlustur(satir({ redaksiyon_kaynak_id: orijinalId, redaksiyon_notu: "IP karartıldı" }), [])!;
    const b = zarfOlustur(satir({ redaksiyon_kaynak_id: orijinalId, redaksiyon_notu: "İsim karartıldı" }), [])!;
    expect(await envelopeHash(a)).not.toBe(await envelopeHash(b));
  });
});
