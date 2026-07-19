// M17 sonraki dilim son madde: WORM export bütünlüğü (ROADMAP §1.29; citation-
// bundle deseninin aynısı).
import { describe, expect, it } from "vitest";
import { auditWormDogrula, auditWormPaketiOlustur, type AuditWormGirdisi } from "../audit-worm-export";

function ornekGirdi(): AuditWormGirdisi {
  return {
    engagement: { id: "e1", ad: "BS Denetimi", kapsam: "IAM", donem: "2026-Q3", riskSeviyesi: "YUKSEK", durum: "DEVAM" },
    ornekler: [{ yontem: "RANDOM", populasyonBoyutu: 100, ornekBoyutu: 10, seed: "s1", secilenIndeksler: [1, 2, 3] }],
    workpaperlar: [
      { baslik: "Erişim testleri", icerik: "MFA sonuçları", durum: "ONAYLANDI", hazirlayanAd: "A", reviewerAd: "B", kontrolBaglari: ["TODO-DOGRULA-01"], bulguBaglari: [] },
    ],
    pbcTalepler: [{ talepMetni: "IAM listesi", sonTarih: null, durum: "KAPANDI", alinanKanit: "export.csv", alindiTarihi: "2026-07-19" }],
    beyanlar: [{ beyanEdenAd: "C", externalEmail: "c@x.com", cikarCatismasiYok: true, beyanAt: "2026-07-19T00:00:00Z" }],
    olusturanAd: "Admin",
    olusturmaZamani: "2026-07-19T12:00:00Z",
  };
}

describe("auditWormPaketiOlustur / auditWormDogrula (M17 sonraki dilim)", () => {
  it("paket şema + imza durumu doğru", async () => {
    const paket = await auditWormPaketiOlustur(ornekGirdi());
    expect(paket.schema).toBe("KALKAN_AUDIT_WORM_EXPORT_V1");
    expect(paket.imzaDurumu).toBe("IMZASIZ_HASH_BUTUNLUKLU");
    expect(paket.paketHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("aynı içerik aynı hash (deterministik)", async () => {
    const p1 = await auditWormPaketiOlustur(ornekGirdi());
    const p2 = await auditWormPaketiOlustur(ornekGirdi());
    expect(p1.paketHash).toBe(p2.paketHash);
  });

  it("dizi sırası hash'i etkilemez (kural 11)", async () => {
    const g = ornekGirdi();
    const p1 = await auditWormPaketiOlustur(g);
    const gTers: AuditWormGirdisi = { ...g, workpaperlar: [...g.workpaperlar].reverse(), beyanlar: [...g.beyanlar].reverse() };
    const p2 = await auditWormPaketiOlustur(gTers);
    expect(p1.paketHash).toBe(p2.paketHash);
  });

  it("bütünlük GEÇER: kurcalanmamış paket doğrulanır", async () => {
    const paket = await auditWormPaketiOlustur(ornekGirdi());
    const sonuc = await auditWormDogrula(paket);
    expect(sonuc.gecerli).toBe(true);
    expect(sonuc.hesaplanan).toBe(sonuc.beklenen);
  });

  it("bütünlük REDDEDER: workpaper içeriği kurcalanınca hash düşer", async () => {
    const paket = await auditWormPaketiOlustur(ornekGirdi());
    const kurcalanmis = { ...paket, workpaperlar: [{ ...paket.workpaperlar[0], icerik: "değiştirildi" }] };
    const sonuc = await auditWormDogrula(kurcalanmis);
    expect(sonuc.gecerli).toBe(false);
  });

  it("bütünlük REDDEDER: bağımsızlık beyanı kurcalanınca hash düşer", async () => {
    const paket = await auditWormPaketiOlustur(ornekGirdi());
    const kurcalanmis = { ...paket, beyanlar: [{ ...paket.beyanlar[0], cikarCatismasiYok: false }] };
    const sonuc = await auditWormDogrula(kurcalanmis);
    expect(sonuc.gecerli).toBe(false);
  });
});
