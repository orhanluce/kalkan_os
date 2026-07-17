import { describe, expect, it } from "vitest";
import { CORE_MANIFEST_SCHEMA, REPORT_DATA_SCHEMA } from "../canonical";
import {
  PUANLAMA_MOTOR_SURUMU,
  cevapHash,
  coreManifestOlustur,
  packageManifestOlustur,
  pdfFileHash,
  puanlamaKurallariHash,
  reportDataHash,
  type ManifestGirdisi,
  type ReportData,
} from "../simulation-manifest";

function ornekGirdi(): ManifestGirdisi {
  return {
    runId: "11111111-1111-1111-1111-111111111111",
    tenantId: "22222222-2222-2222-2222-222222222222",
    kurumAdi: "Demo Yatirim A.S.",
    senaryoKodu: "S01",
    senaryoAdi: "Fidye yazılımı",
    sablonSurum: 1,
    tatbikatAdi: "Q3 tatbikatı",
    mod: "canli",
    zamanOlcegi: 1,
    basladiAt: "2026-07-17T09:00:00.000Z",
    bittiAt: "2026-07-17T10:30:00.000Z",
    kararlar: [
      { kod: "KR-02", senaryoDakika: 20, cevap: "fidyeyi ödemedik", kanitVar: false },
      { kod: "KR-01", senaryoDakika: 12, cevap: "olayı kritik sınıfladık", kanitVar: true },
    ],
    aksiyonlar: [
      { kod: "ESKALASYON_YAPILDI", tamamlandi: true, dakika: 11 },
      { kod: "DELIL_TOPLANDI", tamamlandi: false, dakika: null },
      { kod: "BCP_DEVREDE", tamamlandi: true, dakika: 28 },
    ],
    kanitlar: [
      {
        evidenceVersionId: "ev-2",
        fileHash: "b".repeat(64),
        envelopeHash: "c".repeat(64),
        envelopeSchemaVersion: "KALKAN_EVIDENCE_ENVELOPE_V1",
        durum: "FULL_ENVELOPE",
      },
      {
        evidenceVersionId: "ev-1",
        fileHash: "a".repeat(64),
        envelopeHash: null,
        envelopeSchemaVersion: null,
        durum: "LEGACY_FILE_HASH_ONLY",
      },
    ],
    kurallar: [
      { kod: "RTO_HEDEFI", tip: "RTO_WITHIN_TARGET", agirlik: 10, parametreler: { hedef_dakika: 90 } },
      { kod: "DELIL", tip: "MANDATORY_FAIL_IF", agirlik: 0, parametreler: {} },
    ],
    puan: 72,
    durum: "KISMI",
    satirlar: [
      { kod: "RTO_HEDEFI", sonuc: "gecti", puan: 10, agirlik: 10 },
      { kod: "DELIL", sonuc: "kaldi", puan: 0, agirlik: 0 },
    ],
    kritikBasarisizliklar: ["KRİTİK: delil toplanmadı"],
    oneriSayisi: 3,
  };
}

/** Deterministik karıştırıcı: testin kendisi rastgele olmamalı (aynı tohum, aynı sıra). */
function karistir<T>(dizi: T[], tohum: number): T[] {
  const out = [...dizi];
  let s = tohum;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) % 2147483648;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

describe("dört hash ayrı şeyleri doğrular", () => {
  it("reportDataHash manifest veya PDF hash'i İÇERMEZ — döngü kurulmamalı", async () => {
    const { reportData } = await coreManifestOlustur(ornekGirdi());
    const serialize = JSON.stringify(reportData);
    expect(serialize).not.toContain("coreManifestHash");
    expect(serialize).not.toContain("pdfFileHash");
    expect(serialize).not.toContain("packageManifestHash");
  });

  it("çekirdek manifest reportDataHash'i taşır — rapor manifeste bağlıdır", async () => {
    const s = await coreManifestOlustur(ornekGirdi());
    expect(s.coreManifest.reportDataHash).toBe(s.reportDataHash);
  });

  it("çekirdek manifest kendi hash'ini İÇERMEZ", async () => {
    const s = await coreManifestOlustur(ornekGirdi());
    expect(JSON.stringify(s.coreManifest)).not.toContain(s.coreManifestHash);
  });

  it("her iki hash de şema sürümünü taşır — doğrulayan hangi kuralla hesaplayacağını bilmeli", async () => {
    const s = await coreManifestOlustur(ornekGirdi());
    expect(s.reportData.sema).toBe(REPORT_DATA_SCHEMA);
    expect(s.coreManifest.sema).toBe(CORE_MANIFEST_SCHEMA);
  });

  it("pdfFileHash BAYTLARIN hash'i — veriden bağımsız", async () => {
    const a = await pdfFileHash(new TextEncoder().encode("%PDF-1.4 sahte"));
    const b = await pdfFileHash(new TextEncoder().encode("%PDF-1.4 sahte"));
    const c = await pdfFileHash(new TextEncoder().encode("%PDF-1.4 baska"));
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("DB satır sırası hiçbir hash'i etkilemez (zorunlu test)", () => {
  it("100 farklı rastgele sıralamada aynı reportDataHash ve coreManifestHash", async () => {
    const temel = await coreManifestOlustur(ornekGirdi());

    for (let tohum = 1; tohum <= 100; tohum++) {
      const g = ornekGirdi();
      const karisik: ManifestGirdisi = {
        ...g,
        kararlar: karistir(g.kararlar, tohum),
        aksiyonlar: karistir(g.aksiyonlar, tohum * 7),
        kanitlar: karistir(g.kanitlar, tohum * 13),
        satirlar: karistir(g.satirlar, tohum * 17),
        kurallar: karistir(g.kurallar, tohum * 23),
        kritikBasarisizliklar: karistir(g.kritikBasarisizliklar, tohum * 29),
      };
      const s = await coreManifestOlustur(karisik);
      expect(s.reportDataHash).toBe(temel.reportDataHash);
      expect(s.coreManifestHash).toBe(temel.coreManifestHash);
      expect(s.merkleRoot).toBe(temel.merkleRoot);
    }
  });

  it("Postgres'in +00:00 biçimi ile JS'in Z biçimi aynı hash verir", async () => {
    const a = await coreManifestOlustur(ornekGirdi());
    const b = await coreManifestOlustur({
      ...ornekGirdi(),
      basladiAt: "2026-07-17T09:00:00+00:00",
      bittiAt: "2026-07-17T10:30:00+00:00",
    });
    expect(b.coreManifestHash).toBe(a.coreManifestHash);
  });

  it("numeric'in string hali aynı hash verir (agirlik: '10' vs 10)", async () => {
    const g = ornekGirdi();
    const stringli: ManifestGirdisi = {
      ...g,
      zamanOlcegi: "1",
      kurallar: g.kurallar.map((k) => ({ ...k, agirlik: String(k.agirlik) })),
      satirlar: g.satirlar.map((s) => ({ ...s, puan: s.puan, agirlik: s.agirlik })),
    };
    expect((await coreManifestOlustur(stringli)).coreManifestHash).toBe(
      (await coreManifestOlustur(g)).coreManifestHash,
    );
  });
});

describe("negatif testler — tek alan değişince hash değişir", () => {
  const degisiklikler: [string, (g: ManifestGirdisi) => ManifestGirdisi][] = [
    ["puan", (g) => ({ ...g, puan: 95 })],
    ["durum", (g) => ({ ...g, durum: "BASARILI" })],
    ["kurum adı", (g) => ({ ...g, kurumAdi: "Baska Kurum A.S." })],
    ["şablon sürümü", (g) => ({ ...g, sablonSurum: 2 })],
    ["bir karar silinmiş", (g) => ({ ...g, kararlar: g.kararlar.slice(1) })],
    ["karar cevabı", (g) => ({ ...g, kararlar: [{ ...g.kararlar[0], cevap: "fidyeyi ödedik" }, g.kararlar[1]] })],
    ["bir kanıt silinmiş", (g) => ({ ...g, kanitlar: g.kanitlar.slice(1) })],
    ["kanıt dosya hash'i", (g) => ({ ...g, kanitlar: [{ ...g.kanitlar[0], fileHash: "9".repeat(64) }, g.kanitlar[1]] })],
    ["kanıt zarf hash'i", (g) => ({ ...g, kanitlar: [{ ...g.kanitlar[0], envelopeHash: "9".repeat(64) }, g.kanitlar[1]] })],
    ["bir aksiyon tamamlandı işaretlenmiş", (g) => ({
      ...g,
      aksiyonlar: g.aksiyonlar.map((a) => (a.kod === "DELIL_TOPLANDI" ? { ...a, tamamlandi: true, dakika: 40 } : a)),
    })],
    ["kritik başarısızlık gizlenmiş", (g) => ({ ...g, kritikBasarisizliklar: [] })],
    ["kural ağırlığı", (g) => ({ ...g, kurallar: [{ ...g.kurallar[0], agirlik: 25 }, g.kurallar[1]] })],
    ["kural hedef dakikası", (g) => ({
      ...g,
      kurallar: [{ ...g.kurallar[0], parametreler: { hedef_dakika: 999 } }, g.kurallar[1]],
    })],
  ];

  for (const [ad, degistir] of degisiklikler) {
    it(`${ad} değişince coreManifestHash değişir`, async () => {
      const temel = await coreManifestOlustur(ornekGirdi());
      const degismis = await coreManifestOlustur(degistir(ornekGirdi()));
      expect(degismis.coreManifestHash).not.toBe(temel.coreManifestHash);
    });
  }

  it("puan değişince HEM reportDataHash HEM coreManifestHash değişir", async () => {
    const temel = await coreManifestOlustur(ornekGirdi());
    const degismis = await coreManifestOlustur({ ...ornekGirdi(), puan: 95 });
    expect(degismis.reportDataHash).not.toBe(temel.reportDataHash);
    expect(degismis.coreManifestHash).not.toBe(temel.coreManifestHash);
  });

  it("yalnızca kanıt değişirse reportDataHash AYNI kalır, coreManifestHash değişir", async () => {
    // Kanıtlar rapora görünmüyor ama mühüre giriyor: iki katmanın ayrı
    // şeyleri doğruladığının somut kanıtı.
    const temel = await coreManifestOlustur(ornekGirdi());
    const degismis = await coreManifestOlustur({
      ...ornekGirdi(),
      kanitlar: [{ ...ornekGirdi().kanitlar[0], fileHash: "9".repeat(64) }, ornekGirdi().kanitlar[1]],
    });
    expect(degismis.reportDataHash).toBe(temel.reportDataHash);
    expect(degismis.coreManifestHash).not.toBe(temel.coreManifestHash);
  });
});

describe("kanıt bütünlük durumu", () => {
  it("zarfsız kanıt LEGACY_FILE_HASH_ONLY olarak taşınır — uydurulmaz", async () => {
    const { coreManifest } = await coreManifestOlustur(ornekGirdi());
    const legacy = coreManifest.kanitlar.find((k) => k.evidenceVersionId === "ev-1");
    expect(legacy?.durum).toBe("LEGACY_FILE_HASH_ONLY");
    expect(legacy?.envelopeHash).toBeNull();
    expect(legacy?.envelopeSchemaVersion).toBeNull();
  });

  it("zarflı kanıt hem dosya hem zarf hash'i taşır", async () => {
    const { coreManifest } = await coreManifestOlustur(ornekGirdi());
    const tam = coreManifest.kanitlar.find((k) => k.evidenceVersionId === "ev-2");
    expect(tam?.durum).toBe("FULL_ENVELOPE");
    expect(tam?.fileHash).toMatch(/^[0-9a-f]{64}$/);
    expect(tam?.envelopeHash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("gizlilik", () => {
  it("karar CEVABININ METNİ manifeste girmez — yalnızca hash'i", async () => {
    const { coreManifest } = await coreManifestOlustur(ornekGirdi());
    const serialize = JSON.stringify(coreManifest);
    expect(serialize).not.toContain("fidyeyi ödemedik");
    expect(serialize).not.toContain("olayı kritik sınıfladık");
    expect(coreManifest.kararlar[0].cevapHash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("packageManifestOlustur", () => {
  it("dosya sırası paketin kimliği değil", async () => {
    const dosyalar = [
      { ad: "rapor.pdf", hash: "a".repeat(64), bayt: 10 },
      { ad: "core-manifest.json", hash: "b".repeat(64), bayt: 20 },
    ];
    const a = await packageManifestOlustur({ coreManifestHash: "c".repeat(64), dosyalar });
    const b = await packageManifestOlustur({
      coreManifestHash: "c".repeat(64),
      dosyalar: [...dosyalar].reverse(),
    });
    expect(b.hash).toBe(a.hash);
  });

  it("PDF baytı değişince paket hash'i değişir", async () => {
    const temel = await packageManifestOlustur({
      coreManifestHash: "c".repeat(64),
      dosyalar: [{ ad: "rapor.pdf", hash: "a".repeat(64), bayt: 10 }],
    });
    const degismis = await packageManifestOlustur({
      coreManifestHash: "c".repeat(64),
      dosyalar: [{ ad: "rapor.pdf", hash: "9".repeat(64), bayt: 10 }],
    });
    expect(degismis.hash).not.toBe(temel.hash);
  });

  it("paket manifesti coreManifestHash'i taşır — iki katmanı birbirine bağlar", async () => {
    const { packageManifest } = await packageManifestOlustur({
      coreManifestHash: "c".repeat(64),
      dosyalar: [],
    });
    expect(packageManifest.coreManifestHash).toBe("c".repeat(64));
  });
});

describe("puanlamaKurallariHash", () => {
  const kurallar = [
    { kod: "RTO_HEDEFI", tip: "RTO_WITHIN_TARGET", agirlik: 10, parametreler: { hedef_dakika: 90 } },
    { kod: "DELIL", tip: "MANDATORY_FAIL_IF", agirlik: 0, parametreler: {} },
  ];

  it("kural sırası hash'i etkilemez", async () => {
    expect(await puanlamaKurallariHash([...kurallar].reverse())).toBe(
      await puanlamaKurallariHash(kurallar),
    );
  });

  it("bir kural kaldırılınca değişir", async () => {
    expect(await puanlamaKurallariHash([kurallar[0]])).not.toBe(await puanlamaKurallariHash(kurallar));
  });
});

describe("reportDataHash", () => {
  it("deterministik", async () => {
    const { reportData } = await coreManifestOlustur(ornekGirdi());
    expect(await reportDataHash(reportData)).toBe(await reportDataHash(reportData));
  });

  it("puan satırı değişince değişir — rapora görünen her olgu mühürlü", async () => {
    const { reportData } = await coreManifestOlustur(ornekGirdi());
    const degismis: ReportData = {
      ...reportData,
      satirlar: [{ kod: "RTO_HEDEFI", sonuc: "kaldi", puan: 0, agirlik: 10 }],
    };
    expect(await reportDataHash(degismis)).not.toBe(await reportDataHash(reportData));
  });
});

describe("cevapHash", () => {
  it("aynı cevap aynı hash", async () => {
    expect(await cevapHash("fidyeyi ödemedik")).toBe(await cevapHash("fidyeyi ödemedik"));
  });

  it("Türkçe karakter kaybolmadan hash'lenir", async () => {
    expect(await cevapHash("açık")).not.toBe(await cevapHash("acik"));
  });
});

describe("puanlama motor sürümü", () => {
  it("manifeste yazılır — aynı şablon farklı kodla farklı puan verebilir", async () => {
    const { coreManifest } = await coreManifestOlustur(ornekGirdi());
    expect(coreManifest.puanlamaMotorSurumu).toBe(PUANLAMA_MOTOR_SURUMU);
  });
});
