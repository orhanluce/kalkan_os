// DSAR kanıt paketi — saf çevrimdışı doğrulama (M36 sonraki dilim). İmza G3'ten
// yeniden kullanılır; test paketin DÜRÜSTLÜĞÜNÜ (manifest↔hash↔imza bağı) sınar.
import { describe, expect, it } from "vitest";
import { LocalDevSigner } from "../manifest-signature";
import { imzaliIfadeOlustur } from "../transparency";
import {
  DSAR_FULFILLMENT_KIND,
  DSAR_PACKAGE_SCHEMA,
  dsarManifestHash,
  dsarManifestKur,
  dsarPaketiDogrula,
  type DsarKanitPaketi,
} from "../gizlilik";

async function paketKur(): Promise<DsarKanitPaketi> {
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
  return {
    schema: DSAR_PACKAGE_SCHEMA,
    manifest,
    manifestHash,
    signedStatement,
    ledgerEntryId: "22222222-2222-2222-2222-222222222222",
    leafIndex: 0,
  };
}

describe("DSAR kanıt paketi (saf doğrulama)", () => {
  it("geçerli paket tüm kontrolleri geçer", async () => {
    const sonuc = await dsarPaketiDogrula(await paketKur());
    expect(sonuc.gecerli).toBe(true);
    expect(sonuc.kontroller.every((k) => k.gecti)).toBe(true);
  });

  it("manifest kurcalanırsa (kategori eklenince) hash düşer", async () => {
    const p = await paketKur();
    p.manifest.aciklananKategoriler = [...p.manifest.aciklananKategoriler, "konum"];
    const sonuc = await dsarPaketiDogrula(p);
    expect(sonuc.gecerli).toBe(false);
    expect(sonuc.kontroller.find((k) => k.ad.includes("hash"))?.gecti).toBe(false);
  });

  it("imza başka manifesti işaret ederse bağ düşer", async () => {
    const p = await paketKur();
    p.manifestHash = "b".repeat(64); // hash değişti, imza eski özeti işaret ediyor
    const sonuc = await dsarPaketiDogrula(p);
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
