// Şartname §2.1 kabul kriteri: "Bir dosyanın tek biti değişirse doğrulama
// başarısız olmalıdır." Bu dosyanın asıl işi o iddiayı sınamaktır.
import { beforeEach, describe, expect, it } from "vitest";
import { batchRootFromHashes, LocalAppendOnlyAnchorProvider, type AnchorReceipt } from "../anchor";
import { envelopeHash, type EvidenceEnvelope } from "../evidence-envelope";
import { inclusionProof } from "../merkle";
import { verifyEvidence, type DogrulamaGirdisi } from "../verification";

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

let provider: LocalAppendOnlyAnchorProvider;

beforeEach(() => {
  provider = new LocalAppendOnlyAnchorProvider();
});

/** Zarfı gerçekten sabitler ve tam (VERIFIED beklenen) bir girdi kurar. */
async function sabitlenmisGirdi(
  hedefZarf: EvidenceEnvelope,
  digerZarflar: EvidenceEnvelope[] = [],
): Promise<DogrulamaGirdisi> {
  const hashler = await Promise.all([hedefZarf, ...digerZarflar].map(envelopeHash));
  const sirali = [...hashler].sort();
  const batchRoot = await batchRootFromHashes(hashler);
  const index = sirali.indexOf(await envelopeHash(hedefZarf));
  const proof = await inclusionProof(sirali, index);
  const receipt = await provider.anchor(batchRoot, {
    tenantId: hedefZarf.tenantId,
    yaprakSayisi: hashler.length,
  });

  return {
    zarf: hedefZarf,
    dosyadanHesaplananHash: hedefZarf.sha256,
    oncekiZarf: null,
    proof,
    batchRoot,
    receipt,
  };
}

function kontrolSonucu(sonuc: Awaited<ReturnType<typeof verifyEvidence>>, ad: string) {
  return sonuc.kontroller.find((k) => k.ad.startsWith(ad))?.sonuc;
}

describe("verifyEvidence — sağlam kanıt", () => {
  it("bozulmamış, sabitlenmiş kanıt VERIFIED verir", async () => {
    const sonuc = await verifyEvidence(await sabitlenmisGirdi(zarf()), provider);

    expect(sonuc.genel).toBe("VERIFIED");
    expect(sonuc.kontroller.every((k) => k.sonuc === "gecti")).toBe(true);
  });

  it("kalabalık bir partideki kanıt da doğrulanır", async () => {
    const hedef = zarf();
    const digerleri = [1, 2, 3, 4, 5].map((n) => zarf({ evidenceId: `e-${n}`, sha256: "cd".repeat(32) }));

    expect((await verifyEvidence(await sabitlenmisGirdi(hedef, digerleri), provider)).genel).toBe(
      "VERIFIED",
    );
  });
});

describe("verifyEvidence — kurcalama tespiti", () => {
  it("dosyanın tek biti değişirse FAILED (şartname §2.1 kabul kriteri)", async () => {
    const girdi = await sabitlenmisGirdi(zarf());

    // Denetçinin indirdiği dosya, zarftakinden farklı bir hash veriyor.
    const bozuk: DogrulamaGirdisi = {
      ...girdi,
      dosyadanHesaplananHash: "ab".repeat(31) + "ac", // son bayt farklı
    };

    const sonuc = await verifyEvidence(bozuk, provider);
    expect(sonuc.genel).toBe("FAILED");
    expect(kontrolSonucu(sonuc, "Dosya hash")).toBe("kaldi");
  });

  it("zarf metadata'sı değiştirilirse FAILED", async () => {
    const girdi = await sabitlenmisGirdi(zarf());

    // Dosya aynı, ama iddia değişmiş: kanıt başka bir kaynaktan gelmiş gibi
    // gösteriliyor. Sabitlenen zarf olduğu için Merkle proof bunu yakalar.
    const sonuc = await verifyEvidence(
      { ...girdi, zarf: zarf({ sourceSystem: "BASKA_TEDARIKCI" }) },
      provider,
    );

    expect(sonuc.genel).toBe("FAILED");
    expect(kontrolSonucu(sonuc, "Merkle proof")).toBe("kaldi");
  });

  it("yükleme tarihi geriye alınırsa FAILED", async () => {
    const girdi = await sabitlenmisGirdi(zarf());

    // Kanıtı olduğundan eski göstermek: denetimde en cazip kurcalama.
    const sonuc = await verifyEvidence(
      { ...girdi, zarf: zarf({ uploadedAt: "2026-01-01T00:00:00.000Z" }) },
      provider,
    );

    expect(sonuc.genel).toBe("FAILED");
  });

  it("kanıt başka bir kontrole bağlanmış gibi gösterilirse FAILED", async () => {
    const girdi = await sabitlenmisGirdi(zarf());

    const sonuc = await verifyEvidence(
      { ...girdi, zarf: zarf({ controlRefs: ["CTRL-BASKA-999"] }) },
      provider,
    );

    expect(sonuc.genel).toBe("FAILED");
  });

  it("kurcalanan makbuz FAILED verir", async () => {
    const girdi = await sabitlenmisGirdi(zarf());
    const sahte: AnchorReceipt = { ...girdi.receipt!, anchoredAt: "2020-01-01T00:00:00.000Z" };

    const sonuc = await verifyEvidence({ ...girdi, receipt: sahte }, provider);
    expect(sonuc.genel).toBe("FAILED");
    expect(kontrolSonucu(sonuc, "Anchor makbuzu")).toBe("kaldi");
  });

  it("başka bir partinin proof'u FAILED verir", async () => {
    // Her iki parti de ÇOK yapraklı olmalı: tek yapraklı ağaçta proof boş
    // dizidir, dolayısıyla "başka partinin proof'u" ile kendi proof'u
    // ayırt edilemez ve test hiçbir şey sınamamış olurdu.
    const dolgu = (n: number) => [1, 2, 3].map((i) => zarf({ evidenceId: `e-${n}-${i}` }));

    const girdi = await sabitlenmisGirdi(zarf(), dolgu(1));
    const baska = await sabitlenmisGirdi(zarf({ evidenceId: "e-baska" }), dolgu(2));

    expect(baska.proof).not.toEqual(girdi.proof); // test gerçekten bir şey değiştiriyor mu

    const sonuc = await verifyEvidence({ ...girdi, proof: baska.proof }, provider);
    expect(sonuc.genel).toBe("FAILED");
    expect(kontrolSonucu(sonuc, "Merkle proof")).toBe("kaldi");
  });

  it("tek bir kontrol kalsa bile sonuç FAILED'dir (çoğunluk oyu yok)", async () => {
    const girdi = await sabitlenmisGirdi(zarf());
    const sonuc = await verifyEvidence({ ...girdi, dosyadanHesaplananHash: "ff".repeat(32) }, provider);

    // Diğer üç kontrol geçiyor; yine de FAILED.
    expect(sonuc.kontroller.filter((k) => k.sonuc === "gecti")).toHaveLength(3);
    expect(sonuc.genel).toBe("FAILED");
  });
});

describe("verifyEvidence — eksik girdiler", () => {
  it("sabitlenmemiş kanıt PENDING verir (FAILED değil)", async () => {
    // Sağlayıcı gecikmesi, kanıt sorunu değildir (şartname §9.2).
    const sonuc = await verifyEvidence(
      {
        zarf: zarf(),
        dosyadanHesaplananHash: zarf().sha256,
        oncekiZarf: null,
        proof: null,
        batchRoot: null,
        receipt: null,
      },
      provider,
    );

    expect(sonuc.genel).toBe("PENDING");
    expect(kontrolSonucu(sonuc, "Dosya hash")).toBe("gecti");
  });

  it("dosya sunulmadan doğrulanırsa PARTIAL verir", async () => {
    const girdi = await sabitlenmisGirdi(zarf());
    const sonuc = await verifyEvidence({ ...girdi, dosyadanHesaplananHash: null }, provider);

    // Zarf bütünlüğü doğrulandı ama dosyanın o dosya olduğu gösterilemedi.
    expect(sonuc.genel).toBe("PARTIAL");
    expect(kontrolSonucu(sonuc, "Dosya hash")).toBe("yok");
  });

  it("sabitlenmemiş VE kurcalanmış kanıt yine de FAILED verir", async () => {
    // PENDING, kurcalamayı gizlememelidir.
    const sonuc = await verifyEvidence(
      {
        zarf: zarf(),
        dosyadanHesaplananHash: "ff".repeat(32),
        oncekiZarf: null,
        proof: null,
        batchRoot: null,
        receipt: null,
      },
      provider,
    );

    expect(sonuc.genel).toBe("FAILED");
  });
});

describe("verifyEvidence — versiyon zinciri", () => {
  it("geçerli versiyon zinciri doğrulanır", async () => {
    const v1 = zarf({ version: 1 });
    const v2 = zarf({ version: 2, previousVersionHash: await envelopeHash(v1) });

    const girdi = await sabitlenmisGirdi(v2);
    const sonuc = await verifyEvidence({ ...girdi, oncekiZarf: v1 }, provider);

    expect(kontrolSonucu(sonuc, "Versiyon zinciri")).toBe("gecti");
    expect(sonuc.genel).toBe("VERIFIED");
  });

  it("önceki versiyon değiştirilmişse FAILED", async () => {
    const v1 = zarf({ version: 1 });
    const v2 = zarf({ version: 2, previousVersionHash: await envelopeHash(v1) });

    const girdi = await sabitlenmisGirdi(v2);
    // Geçmişi yeniden yazma girişimi: v1 artık başka bir şey.
    const sonuc = await verifyEvidence(
      { ...girdi, oncekiZarf: zarf({ version: 1, sha256: "ff".repeat(32) }) },
      provider,
    );

    expect(sonuc.genel).toBe("FAILED");
    expect(kontrolSonucu(sonuc, "Versiyon zinciri")).toBe("kaldi");
  });

  it("öncüle işaret eden zarfın öncülü sunulmazsa kontrol yapılamaz", async () => {
    const v2 = zarf({ version: 2, previousVersionHash: "cd".repeat(32) });
    const girdi = await sabitlenmisGirdi(v2);

    const sonuc = await verifyEvidence({ ...girdi, oncekiZarf: null }, provider);
    expect(kontrolSonucu(sonuc, "Versiyon zinciri")).toBe("yok");
    expect(sonuc.genel).toBe("PARTIAL");
  });

  it("versiyon 2 olduğu halde öncül hash'i boşsa FAILED", async () => {
    // İçsel olarak tutarsız zarf: zincirden kopmuş bir versiyon.
    const girdi = await sabitlenmisGirdi(zarf({ version: 2, previousVersionHash: null }));
    const sonuc = await verifyEvidence(girdi, provider);

    expect(sonuc.genel).toBe("FAILED");
    expect(kontrolSonucu(sonuc, "Versiyon zinciri")).toBe("kaldi");
  });

  it("ilk versiyon olduğunu söyleyip öncül sunan zarf FAILED", async () => {
    const girdi = await sabitlenmisGirdi(zarf({ version: 1, previousVersionHash: null }));
    const sonuc = await verifyEvidence({ ...girdi, oncekiZarf: zarf({ version: 0 }) }, provider);

    expect(sonuc.genel).toBe("FAILED");
  });
});

describe("verifyEvidence — gizlilik", () => {
  it("sonuç, hassas metadata sızdırmaz", async () => {
    // Doğrulama ekranı herkese açık bir yüzeydir (şartname §9.4): oradan
    // sızan her alan, kanıtı görmeye yetkisi olmayan birine bilgi verir.
    const gizli = zarf({ sourceSystem: "GIZLI_TEDARIKCI_AS", uploadedBy: "gizli-kullanici-id" });
    const sonuc = await verifyEvidence(await sabitlenmisGirdi(gizli), provider);

    const metin = JSON.stringify(sonuc);
    expect(metin).not.toContain("GIZLI_TEDARIKCI_AS");
    expect(metin).not.toContain("gizli-kullanici-id");
    expect(metin).not.toContain(gizli.sha256);
  });
});
