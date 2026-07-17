import { describe, expect, it } from "vitest";
import { PAKET_DOSYALARI, paketOlustur, paketiDogrula, type PaketGirdisi } from "../audit-package";
import { LocalDevSigner, detachedJwsImzala } from "../manifest-signature";
import { coreManifestOlustur, type ManifestGirdisi } from "../simulation-manifest";

function manifestGirdi(): ManifestGirdisi {
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
    kararlar: [{ kod: "KR-01", senaryoDakika: 12, cevap: "kritik sınıfladık", kanitVar: true }],
    aksiyonlar: [{ kod: "DELIL_TOPLANDI", tamamlandi: true, dakika: 38 }],
    kanitlar: [],
    kurallar: [
      { kod: "RTO_HEDEFI", tip: "RTO_WITHIN_TARGET", agirlik: 10, parametreler: { hedef_dakika: 90 } },
    ],
    puan: 72,
    durum: "KISMI",
    satirlar: [{ kod: "RTO_HEDEFI", sonuc: "gecti", puan: 10, agirlik: 10 }],
    kritikBasarisizliklar: [],
    oneriSayisi: 3,
  };
}

async function paketGirdi(imzali = true): Promise<PaketGirdisi> {
  const muhur = await coreManifestOlustur(manifestGirdi());
  const pdf = new TextEncoder().encode("%PDF-1.4 sahte rapor baytları " + "x".repeat(200));
  let imza = null;
  let signerAd: string | null = null;
  if (imzali) {
    const signer = await LocalDevSigner.olustur();
    imza = await detachedJwsImzala(muhur.coreManifest as never, signer);
    signerAd = signer.ad;
  }
  return {
    coreManifest: muhur.coreManifest,
    coreManifestHash: muhur.coreManifestHash,
    reportData: muhur.reportData,
    imza,
    signerAd,
    pdf,
  };
}

/** Paket dosyalarını doğrulama girdisine (ad -> baytlar) çevirir. */
async function paketMap(imzali = true): Promise<Map<string, Uint8Array>> {
  const { dosyalar } = await paketOlustur(await paketGirdi(imzali));
  return new Map(dosyalar.map((d) => [d.ad, d.icerik]));
}

describe("paketOlustur", () => {
  it("beklenen dosyaları üretir", async () => {
    const { dosyalar } = await paketOlustur(await paketGirdi());
    const adlar = dosyalar.map((d) => d.ad).sort();
    expect(adlar).toEqual(
      [
        PAKET_DOSYALARI.benioku,
        PAKET_DOSYALARI.cekirdek,
        PAKET_DOSYALARI.imza,
        PAKET_DOSYALARI.pdf,
        PAKET_DOSYALARI.paketHash,
        PAKET_DOSYALARI.paketManifesti,
        PAKET_DOSYALARI.rapor,
      ].sort(),
    );
  });

  it("package-manifest kendi hash'ini İÇERMEZ", async () => {
    const { dosyalar, packageManifestHash } = await paketOlustur(await paketGirdi());
    const pm = dosyalar.find((d) => d.ad === PAKET_DOSYALARI.paketManifesti)!;
    expect(new TextDecoder().decode(pm.icerik)).not.toContain(packageManifestHash);
  });

  it("packageManifestHash ayrı dosyada", async () => {
    const { dosyalar, packageManifestHash } = await paketOlustur(await paketGirdi());
    const h = dosyalar.find((d) => d.ad === PAKET_DOSYALARI.paketHash)!;
    expect(new TextDecoder().decode(h.icerik)).toBe(packageManifestHash);
  });
});

describe("paketiDogrula — sağlam paket", () => {
  it("bozulmamış imzalı paket VERIFIED", async () => {
    const sonuc = await paketiDogrula(await paketMap(true));
    expect(sonuc.genel).toBe("VERIFIED");
    expect(sonuc.kontroller.every((k) => k.sonuc === "gecti")).toBe(true);
  });

  it("imzasız paket PARTIAL — imza 'yok', gerisi geçer", async () => {
    const sonuc = await paketiDogrula(await paketMap(false));
    expect(sonuc.genel).toBe("PARTIAL");
    expect(sonuc.kontroller.find((k) => k.ad === "İmza (JWS)")?.sonuc).toBe("yok");
  });
});

describe("paketiDogrula — kurcalama tespiti (paketin varlık sebebi)", () => {
  it("rapor verisi değiştirilirse FAILED", async () => {
    const map = await paketMap();
    map.set(PAKET_DOSYALARI.rapor, new TextEncoder().encode('{"puan":100,"sahte":true}'));
    const sonuc = await paketiDogrula(map);
    expect(sonuc.genel).toBe("FAILED");
    expect(sonuc.kontroller.find((k) => k.ad === "Rapor verisi hash")?.sonuc).toBe("kaldi");
  });

  it("çekirdek manifest tek baytı değişirse FAILED", async () => {
    const map = await paketMap();
    const cekirdek = new TextDecoder().decode(map.get(PAKET_DOSYALARI.cekirdek)!);
    map.set(PAKET_DOSYALARI.cekirdek, new TextEncoder().encode(cekirdek.replace('"puan":72', '"puan":99')));
    const sonuc = await paketiDogrula(map);
    expect(sonuc.genel).toBe("FAILED");
  });

  it("PDF baytı değişirse FAILED — pdfFileHash yakalar", async () => {
    const map = await paketMap();
    map.set(PAKET_DOSYALARI.pdf, new TextEncoder().encode("%PDF-1.4 BASKA icerik"));
    const sonuc = await paketiDogrula(map);
    expect(sonuc.genel).toBe("FAILED");
    expect(sonuc.kontroller.find((k) => k.ad === `Dosya: ${PAKET_DOSYALARI.pdf}`)?.sonuc).toBe("kaldi");
  });

  it("çekirdek değişince İMZA da geçersizleşir — iki bağımsız kapı", async () => {
    // Çekirdek manifest değiştirilince hem hash kontrolü hem imza düşmeli.
    const map = await paketMap();
    const cekirdek = JSON.parse(new TextDecoder().decode(map.get(PAKET_DOSYALARI.cekirdek)!));
    cekirdek.puan = 100;
    map.set(PAKET_DOSYALARI.cekirdek, new TextEncoder().encode(JSON.stringify(cekirdek)));
    const sonuc = await paketiDogrula(map);
    expect(sonuc.kontroller.find((k) => k.ad === "İmza (JWS)")?.sonuc).toBe("kaldi");
  });

  it("imza başka bir anahtarla değiştirilirse FAILED", async () => {
    const map = await paketMap();
    const baska = await LocalDevSigner.olustur();
    const sahteImza = await detachedJwsImzala({ sahte: true }, baska);
    map.set(
      PAKET_DOSYALARI.imza,
      new TextEncoder().encode(
        JSON.stringify({ jws: sahteImza.jws, kid: sahteImza.kid, publicJwk: sahteImza.publicJwk }),
      ),
    );
    const sonuc = await paketiDogrula(map);
    expect(sonuc.kontroller.find((k) => k.ad === "İmza (JWS)")?.sonuc).toBe("kaldi");
  });

  it("manifestte listeli bir dosya paketten çıkarılırsa FAILED", async () => {
    const map = await paketMap();
    map.delete(PAKET_DOSYALARI.pdf);
    const sonuc = await paketiDogrula(map);
    expect(sonuc.genel).toBe("FAILED");
  });
});
