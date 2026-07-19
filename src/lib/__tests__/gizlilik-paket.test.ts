// DSAR kanıt zarfı — saf çevrimdışı doğrulama (M36 sonraki dilim; nihai talimat
// v3.2 §8.0: asenkron mühür). İmza+Merkle G3'ten YENİDEN KULLANILIR; test
// zarfın DÜRÜSTLÜĞÜNÜ (manifest↔hash↔makbuz bağı + PENDING ayrımı) sınar.
import { describe, expect, it } from "vitest";
import { LocalDevSigner } from "../manifest-signature";
import { agacBasiImzala, defterKoku, ifadeYaprakHash, imzaliIfadeOlustur, makbuzUret } from "../transparency";
import {
  DSAR_FULFILLMENT_KIND,
  DSAR_PACKAGE_SCHEMA,
  dsarManifestHash,
  dsarManifestKur,
  dsarPaketiDogrula,
  type DsarKanitZarfi,
} from "../gizlilik";

/** Tek yapraklı bir defter kurup ANCHORED bir zarf üretir (G3 makbuz akışı). */
async function ankorluZarfKur(): Promise<DsarKanitZarfi> {
  const manifest = dsarManifestKur({
    dsarId: "11111111-1111-1111-1111-111111111111",
    tur: "ERISIM",
    veriSahibiHash: "a".repeat(64),
    tamamlandiAt: "2026-07-19T00:00:00.000Z",
    aciklananKategoriler: ["iletisim", "kimlik", "islem_gecmisi"],
  });
  const manifestHash = await dsarManifestHash(manifest);
  const signer = await LocalDevSigner.olustur();
  const signedStatement = await imzaliIfadeOlustur(DSAR_FULFILLMENT_KIND, manifestHash, signer);
  const leafHash = await ifadeYaprakHash(signedStatement);
  const root = await defterKoku([leafHash]);
  const { sth, imza } = await agacBasiImzala(1, root, signer);
  const makbuz = await makbuzUret([leafHash], 0, sth, imza, signedStatement);
  return { schema: DSAR_PACKAGE_SCHEMA, manifest, manifestHash, durum: "ANCHORED", makbuz };
}

describe("DSAR kanıt zarfı (saf doğrulama)", () => {
  it("ANCHORED zarf tüm kontrolleri geçer", async () => {
    const sonuc = await dsarPaketiDogrula(await ankorluZarfKur());
    expect(sonuc.gecerli).toBe(true);
    expect(sonuc.kontroller.every((k) => k.gecti)).toBe(true);
  });

  it("PENDING zarf: kurcalama DEĞİL, dürüstçe 'henüz mühürlenmedi' — gecerli false ama farklı gerekçe", async () => {
    const manifest = dsarManifestKur({
      dsarId: "x",
      tur: "ERISIM",
      veriSahibiHash: null,
      tamamlandiAt: "2026-07-19T00:00:00.000Z",
      aciklananKategoriler: ["kimlik"],
    });
    const zarf: DsarKanitZarfi = {
      schema: DSAR_PACKAGE_SCHEMA,
      manifest,
      manifestHash: await dsarManifestHash(manifest),
      durum: "PENDING",
      makbuz: null,
    };
    const sonuc = await dsarPaketiDogrula(zarf);
    expect(sonuc.gecerli).toBe(false);
    expect(sonuc.kontroller.find((k) => k.ad === "Defter mührü")?.aciklama).toContain("kurcalama değil");
    // Manifest hash kontrolü YİNE de geçmeli — PENDING olması manifest'i geçersiz kılmaz.
    expect(sonuc.kontroller.find((k) => k.ad.includes("Manifest"))?.gecti).toBe(true);
  });

  it("manifest kurcalanırsa (kategori eklenince) hash düşer", async () => {
    const zarf = await ankorluZarfKur();
    zarf.manifest.aciklananKategoriler = [...zarf.manifest.aciklananKategoriler, "konum"];
    const sonuc = await dsarPaketiDogrula(zarf);
    expect(sonuc.gecerli).toBe(false);
    expect(sonuc.kontroller.find((k) => k.ad.includes("hash"))?.gecti).toBe(false);
  });

  it("makbuz başka manifesti işaret ederse bağ düşer", async () => {
    const zarf = await ankorluZarfKur();
    zarf.manifestHash = "b".repeat(64); // hash değişti, makbuz eski özeti işaret ediyor
    const sonuc = await dsarPaketiDogrula(zarf);
    expect(sonuc.gecerli).toBe(false);
  });

  it("kanonik manifest sıralı (kategori sırası hash'i değiştirmez)", async () => {
    const m1 = dsarManifestKur({
      dsarId: "x", tur: "ERISIM", veriSahibiHash: null, tamamlandiAt: "2026-07-19T00:00:00.000Z",
      aciklananKategoriler: ["b", "a", "c"],
    });
    const m2 = dsarManifestKur({
      dsarId: "x", tur: "ERISIM", veriSahibiHash: null, tamamlandiAt: "2026-07-19T00:00:00.000Z",
      aciklananKategoriler: ["c", "a", "b"],
    });
    expect(await dsarManifestHash(m1)).toBe(await dsarManifestHash(m2));
  });
});
