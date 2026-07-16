import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { inclusionProof, merkleRootHex, verifyInclusion, type ProofStep } from "../merkle";

/** Test yaprakları: gerçekte bunlar kanıt zarfı SHA-256'larıdır. */
function yaprak(n: number): string {
  return n.toString(16).padStart(2, "0").repeat(32);
}

function yapraklar(adet: number): string[] {
  return Array.from({ length: adet }, (_, i) => yaprak(i + 1));
}

// Bağımsız referans: merkle.ts Web Crypto (crypto.subtle) kullanır, bu
// yardımcılar Node'un crypto modülünü. Amaç, kodun kendi beklentilerini
// onaylamasını değil, RFC 6962 §2.1'in hash yapısını AYRI bir yoldan
// yeniden kurup değerlerin çakıştığını görmek. Bu olmadan tüm testler
// "kök değişiyor mu" gibi özellikleri sınar ve yanlış ama tutarlı bir
// ağaç yapısı sessizce yeşil kalırdı.
function nodeSha256(hex: string): string {
  return createHash("sha256").update(Buffer.from(hex, "hex")).digest("hex");
}

/** RFC 6962: MTH({d0}) = SHA-256(0x00 || d0) */
function beklenenYaprakHash(leafHex: string): string {
  return nodeSha256("00" + leafHex);
}

/** RFC 6962: MTH(D) = SHA-256(0x01 || sol || sag) */
function beklenenDugumHash(solHex: string, sagHex: string): string {
  return nodeSha256("01" + solHex + sagHex);
}

describe("RFC 6962 hash yapısı (bağımsız referansa karşı)", () => {
  it("tek yaprak: kök = SHA-256(0x00 || yaprak)", async () => {
    expect(await merkleRootHex([yaprak(1)])).toBe(beklenenYaprakHash(yaprak(1)));
  });

  it("iki yaprak: kök = SHA-256(0x01 || H(yaprak0) || H(yaprak1))", async () => {
    expect(await merkleRootHex([yaprak(1), yaprak(2)])).toBe(
      beklenenDugumHash(beklenenYaprakHash(yaprak(1)), beklenenYaprakHash(yaprak(2))),
    );
  });

  it("boş ağaç: kök = SHA-256() (boş girdi)", async () => {
    expect(await merkleRootHex([])).toBe(createHash("sha256").digest("hex"));
  });

  it("üç yaprak: bölme noktası 2 (kopyalama yok), sol dolu alt ağaç", async () => {
    // RFC 6962: k = 2'nin n'den küçük en büyük kuvveti = 2.
    // Yani ağaç ((d0,d1), d2) — yaygın hatalı kurgudaki ((d0,d1),(d2,d2)) DEĞİL.
    const sol = beklenenDugumHash(beklenenYaprakHash(yaprak(1)), beklenenYaprakHash(yaprak(2)));
    const sag = beklenenYaprakHash(yaprak(3));

    expect(await merkleRootHex([yaprak(1), yaprak(2), yaprak(3)])).toBe(
      beklenenDugumHash(sol, sag),
    );
  });
});

describe("merkleRootHex", () => {
  it("aynı girdi her zaman aynı kökü verir", async () => {
    const a = await merkleRootHex(yapraklar(5));
    const b = await merkleRootHex(yapraklar(5));
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("tek bir yaprak değişirse kök değişir", async () => {
    const temiz = await merkleRootHex(yapraklar(4));
    const kurcalanmis = await merkleRootHex([yaprak(1), yaprak(2), yaprak(99), yaprak(4)]);
    expect(kurcalanmis).not.toBe(temiz);
  });

  it("yaprak sırası köke dahildir", async () => {
    const a = await merkleRootHex([yaprak(1), yaprak(2)]);
    const b = await merkleRootHex([yaprak(2), yaprak(1)]);
    expect(a).not.toBe(b);
  });

  it("yaprak eklenirse kök değişir", async () => {
    expect(await merkleRootHex(yapraklar(3))).not.toBe(await merkleRootHex(yapraklar(4)));
  });

  // RFC 6962 alan ayrımının (0x00/0x01) asıl amacı: bir iç düğümün hash'i,
  // yaprak verisi kılığında sunulup aynı kökü üretememelidir. Ön ek olmasaydı
  // iki yapraklı bir ağacın kökü, o kökü tek yaprak olarak içeren bir ağacın
  // köküyle çakışırdı (ikinci önimge).
  it("iç düğüm hash'i yaprak gibi sunulup aynı kökü üretemez", async () => {
    const ikiYaprakliKok = await merkleRootHex([yaprak(1), yaprak(2)]);
    const oKokuYaprakYapan = await merkleRootHex([ikiYaprakliKok]);
    expect(oKokuYaprakYapan).not.toBe(ikiYaprakliKok);
  });

  // CVE-2012-2459 sınıfı: "tek kalırsa son yaprağı kopyala" yaklaşımında
  // [a,b,c] ile [a,b,c,c] aynı kökü verir ve bir saldırgan parti içeriğini
  // değiştirip aynı kökü koruyabilir. Bölme noktası 2'nin kuvveti olduğu
  // için burada kopyalama yoktur.
  it("son yaprağı kopyalayan bir liste aynı kökü vermez", async () => {
    const uc = await merkleRootHex([yaprak(1), yaprak(2), yaprak(3)]);
    const ucArtiKopya = await merkleRootHex([yaprak(1), yaprak(2), yaprak(3), yaprak(3)]);
    expect(ucArtiKopya).not.toBe(uc);
  });

  it("geçersiz hex reddedilir", async () => {
    await expect(merkleRootHex(["zz"])).rejects.toThrow(/hex/i);
    await expect(merkleRootHex(["abc"])).rejects.toThrow(/hex/i);
  });
});

describe("inclusionProof / verifyInclusion", () => {
  // 2'nin kuvveti olan ve olmayan boyutlar birlikte: dengesiz ağaçlarda
  // proof uzunluğu yapraktan yaprağa değişir, hatalar orada saklanır.
  for (const adet of [1, 2, 3, 4, 5, 7, 8, 9, 16, 17]) {
    it(`${adet} yapraklı ağaçta her yaprağın proof'u doğrulanır`, async () => {
      const leaves = yapraklar(adet);
      const root = await merkleRootHex(leaves);

      for (let i = 0; i < adet; i++) {
        const proof = await inclusionProof(leaves, i);
        expect(await verifyInclusion(leaves[i], proof, root)).toBe(true);
      }
    });
  }

  it("ağaçta olmayan bir yaprağın proof'u doğrulanmaz", async () => {
    const leaves = yapraklar(4);
    const root = await merkleRootHex(leaves);
    const proof = await inclusionProof(leaves, 2);

    expect(await verifyInclusion(yaprak(99), proof, root)).toBe(false);
  });

  it("kurcalanan bir proof adımı doğrulanmaz", async () => {
    const leaves = yapraklar(8);
    const root = await merkleRootHex(leaves);
    const proof = await inclusionProof(leaves, 3);

    const bozuk: ProofStep[] = [{ ...proof[0], hash: yaprak(99) }, ...proof.slice(1)];
    expect(await verifyInclusion(leaves[3], bozuk, root)).toBe(false);
  });

  it("proof adımının yönü değiştirilirse doğrulanmaz", async () => {
    const leaves = yapraklar(8);
    const root = await merkleRootHex(leaves);
    const proof = await inclusionProof(leaves, 3);

    const tersYon: ProofStep[] = proof.map((s, i) =>
      i === 0 ? { ...s, yon: s.yon === "sol" ? "sag" : "sol" } : s,
    );
    expect(await verifyInclusion(leaves[3], tersYon, root)).toBe(false);
  });

  it("bir yaprağın proof'u başka bir yaprak için geçerli değildir", async () => {
    const leaves = yapraklar(8);
    const root = await merkleRootHex(leaves);
    const proof = await inclusionProof(leaves, 3);

    expect(await verifyInclusion(leaves[4], proof, root)).toBe(false);
  });

  it("proof başka bir ağacın kökünü doğrulamaz", async () => {
    const leaves = yapraklar(4);
    const proof = await inclusionProof(leaves, 1);
    const baskaKok = await merkleRootHex(yapraklar(5));

    expect(await verifyInclusion(leaves[1], proof, baskaKok)).toBe(false);
  });

  it("tek yapraklı ağacın proof'u boştur ve yine de doğrulanır", async () => {
    const leaves = [yaprak(1)];
    const proof = await inclusionProof(leaves, 0);

    expect(proof).toEqual([]);
    expect(await verifyInclusion(leaves[0], proof, await merkleRootHex(leaves))).toBe(true);
  });

  it("kapsam dışı indeks reddedilir", async () => {
    await expect(inclusionProof(yapraklar(4), 4)).rejects.toThrow(/kapsam disi/i);
    await expect(inclusionProof(yapraklar(4), -1)).rejects.toThrow(/kapsam disi/i);
  });
});
