// SCITT şeffaflık defteri + RFC 3161 TSA adaptörü (G3) — saf katman.
// Merkle/imza yeniden kullanılıyor; buradaki testler AKIŞI ve DÜRÜSTLÜK
// sınırını (yerel damga nitelikli değil, kurcalama çevrimdışı yakalanır) sınar.
import { describe, expect, it } from "vitest";
import { LocalDevSigner } from "../manifest-signature";
import {
  agacBasiImzala,
  defterKoku,
  ifadeYaprakHash,
  imzaliIfadeDogrula,
  imzaliIfadeOlustur,
  makbuzDogrula,
  makbuzUret,
} from "../transparency";
import { LocalDevTimestampProvider, nitelikliMi } from "../timestamp";

const hash = (n: number) => n.toString(16).padStart(64, "0");

async function ucIfade() {
  const signer = await LocalDevSigner.olustur();
  const ifadeler = [];
  for (let i = 0; i < 3; i++) {
    ifadeler.push(await imzaliIfadeOlustur("SIMULATION_MANIFEST", hash(i + 1), signer));
  }
  const yapraklar = await Promise.all(ifadeler.map(ifadeYaprakHash));
  return { ifadeler, yapraklar };
}

describe("imzalı ifade", () => {
  it("round-trip: imzalanır ve doğrulanır", async () => {
    const signer = await LocalDevSigner.olustur();
    const s = await imzaliIfadeOlustur("POLICY_VERSION", hash(7), signer);
    expect(await imzaliIfadeDogrula(s)).toBe(true);
  });

  it("statementHash kurcalanırsa imza tutmaz", async () => {
    const signer = await LocalDevSigner.olustur();
    const s = await imzaliIfadeOlustur("POLICY_VERSION", hash(7), signer);
    const kurcali = { ...s, statementHash: hash(8) };
    expect(await imzaliIfadeDogrula(kurcali)).toBe(false);
  });

  it("geçersiz statementHash reddedilir", async () => {
    const signer = await LocalDevSigner.olustur();
    await expect(imzaliIfadeOlustur("X", "kisa", signer)).rejects.toThrow();
  });
});

describe("kapsama makbuzu (inclusion receipt)", () => {
  it("geçerli makbuz tüm kontrolleri geçer", async () => {
    const { ifadeler, yapraklar } = await ucIfade();
    const signer = await LocalDevSigner.olustur();
    const root = await defterKoku(yapraklar);
    const { sth, imza } = await agacBasiImzala(yapraklar.length, root, signer);
    const makbuz = await makbuzUret(yapraklar, 1, sth, imza, ifadeler[1]);
    const sonuc = await makbuzDogrula(makbuz);
    expect(sonuc.gecerli).toBe(true);
    expect(sonuc.kontroller.every((k) => k.gecti)).toBe(true);
  });

  it("yaprak kurcalanırsa kapsama düşer (defterde yok)", async () => {
    const { ifadeler, yapraklar } = await ucIfade();
    const signer = await LocalDevSigner.olustur();
    const root = await defterKoku(yapraklar);
    const { sth, imza } = await agacBasiImzala(yapraklar.length, root, signer);
    const makbuz = await makbuzUret(yapraklar, 1, sth, imza, ifadeler[1]);
    // Yaprağı başka bir hash'le değiştir → hem tutarlılık hem inclusion düşer.
    makbuz.leafHash = hash(999);
    const sonuc = await makbuzDogrula(makbuz);
    expect(sonuc.gecerli).toBe(false);
  });

  it("STH kökü kurcalanırsa inclusion düşer", async () => {
    const { ifadeler, yapraklar } = await ucIfade();
    const signer = await LocalDevSigner.olustur();
    const root = await defterKoku(yapraklar);
    const { sth, imza } = await agacBasiImzala(yapraklar.length, root, signer);
    const makbuz = await makbuzUret(yapraklar, 1, sth, imza, ifadeler[1]);
    makbuz.sth = { ...sth, rootHash: hash(123) };
    const sonuc = await makbuzDogrula(makbuz);
    // STH imzası kök değişince tutmaz + inclusion köke ulaşmaz.
    expect(sonuc.gecerli).toBe(false);
    expect(sonuc.kontroller.find((k) => k.ad.includes("STH"))?.gecti).toBe(false);
  });

  it("başka ağacın yaprağı bu STH'de bulunmaz", async () => {
    const { yapraklar } = await ucIfade();
    const signer = await LocalDevSigner.olustur();
    const root = await defterKoku(yapraklar);
    const { sth, imza } = await agacBasiImzala(yapraklar.length, root, signer);
    // Farklı bir ifadeyle (defterde olmayan) makbuz kur.
    const yabanci = await imzaliIfadeOlustur("EVIDENCE_ENVELOPE", hash(500), signer);
    const yabanciYaprak = await ifadeYaprakHash(yabanci);
    const makbuz = await makbuzUret([...yapraklar], 1, sth, imza, yabanci);
    makbuz.leafHash = yabanciYaprak; // ifade doğru ama defterde değil
    const sonuc = await makbuzDogrula(makbuz);
    expect(sonuc.gecerli).toBe(false);
  });
});

describe("RFC 3161 TSA adaptörü (yerel stub)", () => {
  it("damga round-trip; NİTELİKLİ DEĞİL (dürüstlük)", async () => {
    const tsa = await LocalDevTimestampProvider.olustur(() => new Date("2026-07-19T00:00:00.000Z"));
    const token = await tsa.timestamp(hash(42));
    expect(nitelikliMi(token)).toBe(false);
    expect(token.saglayici.startsWith("local-dev")).toBe(true);
    const sonuc = await tsa.verify(hash(42), token);
    expect(sonuc.gecerli).toBe(true);
    expect(sonuc.nitelikli).toBe(false);
  });

  it("özet kurcalanırsa damga doğrulaması düşer", async () => {
    const tsa = await LocalDevTimestampProvider.olustur();
    const token = await tsa.timestamp(hash(42));
    const sonuc = await tsa.verify(hash(43), token);
    expect(sonuc.gecerli).toBe(false);
  });

  it("token durumsuz doğrulanır (publicJwk token içinde)", async () => {
    const tsa = await LocalDevTimestampProvider.olustur();
    const token = await tsa.timestamp(hash(42));
    // Farklı bir instance token'ı yine doğrular (anahtar token'da taşınıyor).
    const baska = await LocalDevTimestampProvider.olustur();
    const sonuc = await baska.verify(hash(42), token);
    expect(sonuc.gecerli).toBe(true);
  });
});
