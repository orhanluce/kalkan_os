import { describe, expect, it } from "vitest";
import {
  batchRootFromHashes,
  LocalAppendOnlyAnchorProvider,
  type AnchorReceipt,
} from "../anchor";
import { inclusionProof, verifyInclusion } from "../merkle";

function hash(n: number): string {
  return n.toString(16).padStart(2, "0").repeat(32);
}

const META = { tenantId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", yaprakSayisi: 3 };

describe("batchRootFromHashes", () => {
  it("kanıtların veriliş sırası kökü etkilemez", async () => {
    const a = await batchRootFromHashes([hash(1), hash(2), hash(3)]);
    const b = await batchRootFromHashes([hash(3), hash(1), hash(2)]);
    expect(a).toBe(b);
  });

  it("girdi dizisini değiştirmez", async () => {
    const girdi = [hash(3), hash(1)];
    await batchRootFromHashes(girdi);
    expect(girdi).toEqual([hash(3), hash(1)]);
  });

  it("parti içeriği değişirse kök değişir", async () => {
    const a = await batchRootFromHashes([hash(1), hash(2)]);
    const b = await batchRootFromHashes([hash(1), hash(2), hash(3)]);
    expect(a).not.toBe(b);
  });

  it("sabitlenen köke karşı her kanıtın proof'u doğrulanır", async () => {
    // Asıl vaat bu: TEK kök sabitlenir, ama partideki HER kanıt için ayrı
    // ayrı "bu partideydi" kanıtı üretilebilir.
    const sirali = [hash(3), hash(1), hash(2)].sort();
    const root = await batchRootFromHashes([hash(3), hash(1), hash(2)]);

    for (let i = 0; i < sirali.length; i++) {
      expect(await verifyInclusion(sirali[i], await inclusionProof(sirali, i), root)).toBe(true);
    }
  });
});

describe("LocalAppendOnlyAnchorProvider", () => {
  it("sabitlenen kök doğrulanır", async () => {
    const p = new LocalAppendOnlyAnchorProvider();
    const root = await batchRootFromHashes([hash(1), hash(2)]);
    const receipt = await p.anchor(root, META);

    expect(receipt.saglayici).toBe("local-append-only");
    expect(receipt.batchRoot).toBe(root);
    expect(await p.verify(root, receipt)).toMatchObject({ sonuc: "VERIFIED" });
  });

  it("sabitlenmemiş kök doğrulanmaz", async () => {
    const p = new LocalAppendOnlyAnchorProvider();
    const root = await batchRootFromHashes([hash(1)]);
    const receipt = await p.anchor(root, META);

    const baskaKok = await batchRootFromHashes([hash(9)]);
    const sahteMakbuz: AnchorReceipt = { ...receipt, batchRoot: baskaKok };

    expect(await p.verify(baskaKok, sahteMakbuz)).toMatchObject({ sonuc: "FAILED" });
  });

  it("makbuzdaki kök ile doğrulanan kök uyuşmazsa reddedilir", async () => {
    const p = new LocalAppendOnlyAnchorProvider();
    const root = await batchRootFromHashes([hash(1)]);
    const receipt = await p.anchor(root, META);

    const baska = await batchRootFromHashes([hash(2)]);
    await p.anchor(baska, META);

    // Geçerli bir makbuz, BAŞKA bir kökü doğrulamak için kullanılamamalı.
    const sonuc = await p.verify(baska, receipt);
    expect(sonuc.sonuc).toBe("FAILED");
    expect(sonuc.aciklama).toMatch(/uyusmuyor/i);
  });

  it("kurcalanan sabitleme zamanı reddedilir", async () => {
    const p = new LocalAppendOnlyAnchorProvider();
    const root = await batchRootFromHashes([hash(1)]);
    const receipt = await p.anchor(root, META);

    // Kanıtı olduğundan eski göstermeye çalışmak: sabitlemenin tek işi
    // zamanı kanıtlamak olduğu için bu tespit edilmeli.
    const geriAlinmis: AnchorReceipt = { ...receipt, anchoredAt: "2020-01-01T00:00:00.000Z" };
    expect(await p.verify(root, geriAlinmis)).toMatchObject({ sonuc: "FAILED" });
  });

  it("başka sağlayıcının makbuzu reddedilir", async () => {
    const p = new LocalAppendOnlyAnchorProvider();
    const root = await batchRootFromHashes([hash(1)]);
    const receipt = await p.anchor(root, META);

    const yabanci: AnchorReceipt = { ...receipt, saglayici: "rfc3161-test" };
    expect(await p.verify(root, yabanci)).toMatchObject({ sonuc: "FAILED" });
  });

  it("aynı kök yeniden sabitlenirse İLK zaman korunur (append-only)", async () => {
    let an = new Date("2026-07-16T10:00:00.000Z");
    const p = new LocalAppendOnlyAnchorProvider(() => an);
    const root = await batchRootFromHashes([hash(1)]);

    const ilk = await p.anchor(root, META);
    an = new Date("2026-07-17T10:00:00.000Z");
    const ikinci = await p.anchor(root, META);

    // Üzerine yazılsaydı, kanıt olduğundan daha YENİ görünürdü — yani
    // sabitlemenin kanıtladığı tek şey bozulurdu.
    expect(ikinci.anchoredAt).toBe(ilk.anchoredAt);
    expect(await p.verify(root, ilk)).toMatchObject({ sonuc: "VERIFIED" });
  });

  it("makbuz, bağımsız kanıt olmadığını kendi içinde belirtir", async () => {
    const p = new LocalAppendOnlyAnchorProvider();
    const receipt = await p.anchor(await batchRootFromHashes([hash(1)]), META);

    // Makbuzu okuyan (örn. denetçi) bunun güven değeri hakkında
    // yanılmamalı — uyarı makbuzun kendisinde taşınır.
    expect(String(receipt.payload.uyari)).toMatch(/gelistirme|test/i);
  });

  it("health, üretime uygun olmadığını bildirir", async () => {
    const durum = await new LocalAppendOnlyAnchorProvider().health();
    expect(durum.saglikli).toBe(true);
    expect(durum.aciklama).toMatch(/uretim/i);
  });
});
