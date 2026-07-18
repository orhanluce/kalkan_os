import { describe, expect, it } from "vitest";
import { ibanBicimGecerliMi, ibanHash, ibanMaskele, ibanNormalize } from "../iban";

// V2 PR-3a ADR-V2-4: IBAN maske/hash saf, deterministik; TAM IBAN saklanmaz —
// maske orta haneleri gizler, hash geri döndürülemez ama aynı IBAN'ı tanır.

const IBAN = "TR33 0006 1005 1978 6457 8413 26";

describe("iban maske + hash", () => {
  it("normalize boşluk/tire temizler, büyük harfe indirir", () => {
    expect(ibanNormalize("tr33 0006-1005")).toBe("TR3300061005");
  });

  it("maske: ülke+2 kontrol ve SON 4 görünür, orta gizli", () => {
    const m = ibanMaskele(IBAN);
    expect(m.startsWith("TR33")).toBe(true);
    expect(m.endsWith("1326")).toBe(true);
    expect(m).toContain("*");
    // Orta haneler görünmemeli — tam IBAN'ın ardışık uzun sayısı maskede yok.
    expect(m).not.toContain("0006100519786457841326");
  });

  it("hash deterministik ve geri döndürülemez (64-hex); boşluk farkı hash'i değiştirmez", async () => {
    const h1 = await ibanHash(IBAN);
    const h2 = await ibanHash("TR3300061005197864578413 26");
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
    expect(h1).toBe(h2); // normalize sayesinde aynı
    expect(h1).not.toContain("6457"); // ham haneler hash'te yok
  });

  it("farklı IBAN farklı hash", async () => {
    const h1 = await ibanHash(IBAN);
    const h2 = await ibanHash("DE89370400440532013000");
    expect(h1).not.toBe(h2);
  });

  it("biçim doğrulama: geçerli/geçersiz", () => {
    expect(ibanBicimGecerliMi(IBAN)).toBe(true);
    expect(ibanBicimGecerliMi("TR33")).toBe(false);
    expect(ibanBicimGecerliMi("12345")).toBe(false);
  });
});
