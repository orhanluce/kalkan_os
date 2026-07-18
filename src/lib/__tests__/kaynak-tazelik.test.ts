// PR-Q1': kaynak tazeliği — kural 8 (çekim yoksa güncellik iddiası yok) +
// kural 11 (deterministik, simdi parametre).
import { describe, expect, it } from "vitest";
import { kaynakTazeligi } from "../kaynak-tazelik";

const SIMDI = "2026-07-18T12:00:00Z";

describe("kaynakTazeligi (PR-Q1')", () => {
  it("hiç çekim yoksa 'güncellik iddia edilemez' der — 'güncel' DEMEZ", () => {
    const t = kaynakTazeligi(null, SIMDI);
    expect(t.hicCekimYok).toBe(true);
    expect(t.bayat).toBe(false);
    expect(t.sonBasariliYasGun).toBeNull();
    expect(t.mesaj).toContain("iddia edilemez");
  });

  it("eşik içindeki çekim bayat değildir; yaş gün olarak doğru", () => {
    const t = kaynakTazeligi("2026-07-10T12:00:00Z", SIMDI, 30);
    expect(t.bayat).toBe(false);
    expect(t.sonBasariliYasGun).toBe(8);
  });

  it("eşiği aşan çekim BAYAT'tır (SOURCE_STALE)", () => {
    const t = kaynakTazeligi("2026-06-01T12:00:00Z", SIMDI, 30);
    expect(t.bayat).toBe(true);
    expect(t.mesaj).toContain("bayat");
  });

  it("bugünkü çekim 'bugün' der", () => {
    expect(kaynakTazeligi("2026-07-18T09:00:00Z", SIMDI).mesaj).toBe("Son çekim: bugün");
  });

  it("deterministik: aynı girdi aynı sonuç (kural 11)", () => {
    const a = kaynakTazeligi("2026-07-01T00:00:00Z", SIMDI, 10);
    const b = kaynakTazeligi("2026-07-01T00:00:00Z", SIMDI, 10);
    expect(a).toEqual(b);
  });
});
