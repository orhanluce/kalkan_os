// SCITT şeffaflık defteri + RFC 3161 TSA adaptörü (G3) — saf katman.
// Merkle/imza yeniden kullanılıyor; buradaki testler AKIŞI ve DÜRÜSTLÜK
// sınırını (yerel damga nitelikli değil, kurcalama çevrimdışı yakalanır) sınar.
import { describe, expect, it } from "vitest";
import { LocalDevSigner } from "../manifest-signature";
import {
  agacBasiImzala,
  CONSISTENCY_SCHEMA,
  defterKoku,
  ifadeYaprakHash,
  imzaliIfadeDogrula,
  imzaliIfadeOlustur,
  makbuzDogrula,
  makbuzUret,
  tutarlilikDogrula,
  type TutarlilikKanidi,
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

describe("tutarlılık (append-only) kanıtı", () => {
  async function kanitKur(m: number, n: number): Promise<TutarlilikKanidi> {
    const signer = await LocalDevSigner.olustur();
    const yapraklar: string[] = [];
    for (let i = 0; i < n; i++) {
      yapraklar.push(await ifadeYaprakHash(await imzaliIfadeOlustur("X", hash(i + 1), signer)));
    }
    const eskiRoot = await defterKoku(yapraklar.slice(0, m));
    const yeniRoot = await defterKoku(yapraklar.slice(0, n));
    const eski = await agacBasiImzala(m, eskiRoot, signer);
    const yeni = await agacBasiImzala(n, yeniRoot, signer);
    return {
      schema: CONSISTENCY_SCHEMA,
      eski: { sth: eski.sth, imza: eski.imza },
      yeni: { sth: yeni.sth, imza: yeni.imza },
      leaves: yapraklar,
    };
  }

  it("geçerli: eski ağaç yeni ağacın ön eki → tüm kontroller geçer", async () => {
    const kanit = await kanitKur(2, 5);
    const sonuc = await tutarlilikDogrula(kanit);
    expect(sonuc.gecerli).toBe(true);
  });

  it("yaprak kurcalanırsa (geçmiş yeniden yazılmış) düşer", async () => {
    const kanit = await kanitKur(2, 5);
    kanit.leaves[0] = hash(9999); // ön ekteki bir yaprak değişti
    const sonuc = await tutarlilikDogrula(kanit);
    expect(sonuc.gecerli).toBe(false);
  });

  it("boyut sırası bozuksa (eski > yeni) düşer", async () => {
    const kanit = await kanitKur(2, 5);
    // Eski boyu yeni boydan büyük yap → sıra kontrolü düşer.
    kanit.eski.sth.treeSize = 6;
    const sonuc = await tutarlilikDogrula(kanit);
    expect(sonuc.gecerli).toBe(false);
    expect(sonuc.kontroller.find((k) => k.ad.includes("Boyut"))?.gecti).toBe(false);
  });

  it("eski STH imzası kurcalanırsa düşer", async () => {
    const kanit = await kanitKur(2, 5);
    kanit.eski.sth.rootHash = hash(1234); // imza artık tutmaz
    const sonuc = await tutarlilikDogrula(kanit);
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
