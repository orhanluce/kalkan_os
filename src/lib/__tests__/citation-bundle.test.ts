// M24 sitasyon paketi: deterministik üretim, hash yeniden-hesap doğrulaması,
// kurcalama tespiti, "kayıt yok = null, uydurma yok" (kural 15).
import { describe, expect, it } from "vitest";
import {
  hukumSnippet,
  sitasyonDogrula,
  sitasyonPaketiOlustur,
  type SitasyonGirdisi,
} from "../citation-bundle";

function girdi(): SitasyonGirdisi {
  return {
    testRun: {
      id: "run-1",
      sonuc: "PASSED",
      gerekce: "İddia karşılandı",
      calistiAt: "2026-07-18T12:00:00Z",
      tanimAd: "MFA testi",
      kontrolMaddeRef: "md. 26",
      kontrolBaslik: "Erişim kontrolü",
    },
    legalSnapshot: {
      karar: "ALLOW",
      snapshot: { schema: "KALKAN_EXECUTION_LEGAL_SNAPSHOT_V1", asOf: "2026-07-18", karar: "ALLOW" },
    },
    kaynakZinciri: [
      {
        authority: "SPK",
        kaynakAd: "SPK Mevzuat",
        jurisdiction: "TR",
        kaynakSeviyesi: "A",
        canonicalUrl: null,
        artifactBaslik: "Tebliğ v1",
        artifactSha256: "b".repeat(64),
        provisionRef: "md. 26",
        effectiveFrom: "2020-01-01",
        effectiveTo: null,
        provisionDogrulama: "TODO_DOGRULA",
        snippet: "Hüküm metni",
        obligationKod: "YUK-2",
        obligationDogrulama: "VERIFIED",
        mappingDogrulama: "VERIFIED",
        kapsam: "tam",
      },
      {
        authority: "SPK",
        kaynakAd: "SPK Mevzuat",
        jurisdiction: "TR",
        kaynakSeviyesi: "A",
        canonicalUrl: null,
        artifactBaslik: "Tebliğ v1",
        artifactSha256: "a".repeat(64),
        provisionRef: "md. 1",
        effectiveFrom: "2020-01-01",
        effectiveTo: null,
        provisionDogrulama: "VERIFIED",
        snippet: "Başka hüküm",
        obligationKod: "YUK-1",
        obligationDogrulama: "VERIFIED",
        mappingDogrulama: "VERIFIED",
        kapsam: "kismi",
      },
    ],
    applicability: [
      { obligationKod: "YUK-1", durum: "APPLICABLE", gerekce: "x", factSnapshotFingerprint: "c".repeat(64), kararKaynagi: "motor" },
    ],
    kanit: null,
    auditOlaylari: [{ eylem: "uygulanabilirlik_karari_verildi", zaman: "2026-07-18T11:00:00Z" }],
    aktor: { id: "u-1", ad: "Ayşe" },
    olusturmaZamani: "2026-07-18T12:30:00Z",
  };
}

describe("sitasyon paketi (M24)", () => {
  it("aynı içerik farklı dizi sırasıyla AYNI hash'leri verir (kural 11)", async () => {
    const a = await sitasyonPaketiOlustur(girdi());
    const ters = girdi();
    ters.kaynakZinciri.reverse();
    const b = await sitasyonPaketiOlustur(ters);
    expect(a.sourceBundleHash).toBe(b.sourceBundleHash);
    expect(a.legalSnapshotHash).toBe(b.legalSnapshotHash);
    expect(a.applicabilityDecisionHash).toBe(b.applicabilityDecisionHash);
  });

  it("üretilen paket doğrulamadan geçer; hash'ler 64-hex (kural 15 adlandırması)", async () => {
    const p = await sitasyonPaketiOlustur(girdi());
    expect(p.schema).toBe("KALKAN_CITATION_BUNDLE_V1");
    expect(p.imzaDurumu).toBe("IMZASIZ_HASH_BUTUNLUKLU"); // sahte "signed" yok
    expect(p.sourceBundleHash).toMatch(/^[0-9a-f]{64}$/);
    const sonuc = await sitasyonDogrula(p);
    expect(sonuc.gecerli).toBe(true);
    expect(sonuc.alanlar).toHaveLength(3);
  });

  it("kurcalanmış snippet sourceBundleHash'i düşürür; diğer hash'ler etkilenmez", async () => {
    const p = await sitasyonPaketiOlustur(girdi());
    p.kaynakZinciri[0].snippet = "Değiştirilmiş alıntı";
    const sonuc = await sitasyonDogrula(p);
    expect(sonuc.gecerli).toBe(false);
    const alan = Object.fromEntries(sonuc.alanlar.map((a) => [a.alan, a.gecerli]));
    expect(alan.sourceBundleHash).toBe(false);
    expect(alan.legalSnapshotHash).toBe(true);
    expect(alan.applicabilityDecisionHash).toBe(true);
  });

  it("kurcalanmış applicability durumu kendi hash'ini düşürür", async () => {
    const p = await sitasyonPaketiOlustur(girdi());
    p.applicability[0].durum = "NOT_APPLICABLE";
    const sonuc = await sitasyonDogrula(p);
    expect(sonuc.alanlar.find((a) => a.alan === "applicabilityDecisionHash")!.gecerli).toBe(false);
  });

  it("dayanak fotoğrafı OLMAYAN koşuda legalSnapshotHash null'dur — uydurulmaz", async () => {
    const g = girdi();
    g.legalSnapshot = null;
    const p = await sitasyonPaketiOlustur(g);
    expect(p.legalSnapshotHash).toBeNull();
    expect((await sitasyonDogrula(p)).gecerli).toBe(true);
    // "Yok" iddiasına sahte hash eklemek de tutarsızlıktır ve yakalanır.
    p.legalSnapshotHash = "d".repeat(64);
    expect((await sitasyonDogrula(p)).gecerli).toBe(false);
  });

  it("snippet 240 karakteri aşan metni kısaltır, kısa metni aynen taşır", () => {
    expect(hukumSnippet("kısa")).toBe("kısa");
    const uzun = "x".repeat(500);
    expect(hukumSnippet(uzun)).toHaveLength(241); // 240 + elips
    expect(hukumSnippet(uzun).endsWith("…")).toBe(true);
  });
});
