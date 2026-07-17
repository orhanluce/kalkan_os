import { describe, expect, it } from "vitest";
import { renderSimulasyonRaporuHtml, type SimulasyonRaporuData } from "../simulasyon-raporu";
import { REPORT_DATA_SCHEMA } from "../canonical";
import type { ReportData } from "../simulation-manifest";

function veri(ustu: Partial<ReportData> = {}): ReportData {
  return {
    sema: REPORT_DATA_SCHEMA,
    kurumAdi: "Demo Yatirim A.S.",
    senaryoKodu: "S01",
    senaryoAdi: "Fidye yazılımı",
    sablonSurum: 1,
    tatbikatAdi: "Q3 tatbikatı",
    mod: "canli",
    basladiAt: "2026-07-17T09:00:00.000Z",
    bittiAt: "2026-07-17T10:30:00.000Z",
    puan: 72,
    durum: "KISMI",
    satirlar: [{ kod: "RTO_HEDEFI", sonuc: "gecti", puan: 10, agirlik: 10 }],
    kritikBasarisizliklar: [],
    aksiyonlar: [{ kod: "DELIL_TOPLANDI", tamamlandi: true, dakika: 38 }],
    oneriSayisi: 3,
    ...ustu,
  };
}

function data(ustu: Partial<SimulasyonRaporuData> = {}): SimulasyonRaporuData {
  return {
    veri: veri(),
    coreManifestHash: "a".repeat(64),
    reportDataHash: "b".repeat(64),
    qrDataUrl: "data:image/png;base64,QQ==",
    dogrulamaUrl: "https://ornek.test/dogrula/" + "a".repeat(64),
    muhurDurumu: "sabitlendi",
    anchorSaglayici: "local-append-only",
    ...ustu,
  };
}

describe("renderSimulasyonRaporuHtml", () => {
  it("TATBİKAT etiketi taşır — kural 9", () => {
    // Bir uyum ürününde tatbikat raporunun gerçek olay raporuyla karışması
    // felakettir. Bu etiket süs değil, kuralın kendisi.
    const html = renderSimulasyonRaporuHtml(data());
    expect(html).toContain("TATBİKAT — GERÇEK OLAY DEĞİLDİR");
  });

  it("hızlandırılmış modda süre ölçümünün gerçek olmadığını söyler", () => {
    const html = renderSimulasyonRaporuHtml(data({ veri: veri({ mod: "hizlandirilmis" }) }));
    expect(html).toContain("HIZLANDIRILMIŞ");
    expect(html).toContain("SIMULATED_ACCELERATED");
  });

  it("canlı modda hızlandırma uyarısı basmaz", () => {
    expect(renderSimulasyonRaporuHtml(data())).not.toContain("SIMULATED_ACCELERATED");
  });

  it("puanı, sonucu ve kurumu basar", () => {
    const html = renderSimulasyonRaporuHtml(data());
    expect(html).toContain("72/100");
    expect(html).toContain("Kısmi");
    expect(html).toContain("Demo Yatirim A.S.");
  });

  it("kritik başarısızlığı puandan bağımsız olarak öne çıkarır", () => {
    const html = renderSimulasyonRaporuHtml(
      data({ veri: veri({ puan: 91, durum: "CRITICAL_FAILURE", kritikBasarisizliklar: ["KRİTİK: delil toplanmadı"] }) }),
    );
    expect(html).toContain("Kritik başarısızlık");
    expect(html).toContain("KRİTİK: delil toplanmadı");
    // Yüksek puan kritik başarısızlığı gizlememeli (kural 11).
    expect(html).toContain("91/100");
  });

  it("kritik başarısızlık yoksa o bloğu basmaz", () => {
    // CSS'teki .kritik-baslik sınıfı her zaman var; aranan şey GÖVDEDEKİ blok.
    expect(renderSimulasyonRaporuHtml(data())).not.toContain("Kritik başarısızlık");
  });

  it("her iki hash'i ve doğrulama adresini basar — denetçi karşılaştırabilsin", () => {
    const html = renderSimulasyonRaporuHtml(data());
    expect(html).toContain("a".repeat(64));
    expect(html).toContain("b".repeat(64));
    expect(html).toContain("https://ornek.test/dogrula/");
  });

  it("QR'ı gömer", () => {
    expect(renderSimulasyonRaporuHtml(data())).toContain("data:image/png;base64,QQ==");
  });

  it("mührün bağımsız zaman damgası OLMADIĞINI açıkça söyler", () => {
    // Local provider bir üçüncü taraf değil. Rapor bunu gizlerse, okuyan
    // kişi sahip olmadığı bir güvenceye güvenir.
    const html = renderSimulasyonRaporuHtml(data());
    expect(html).toContain("RFC 3161");
    expect(html).toMatch(/DEĞİLDİR/);
  });

  it("senaryo içeriğinin UNVERIFIED_SAMPLE olduğunu söyler — kural 12", () => {
    expect(renderSimulasyonRaporuHtml(data())).toContain("UNVERIFIED_SAMPLE");
  });

  it("mühür beklemedeyken sağlayıcıyı sabitlenmiş gibi göstermez", () => {
    const html = renderSimulasyonRaporuHtml(data({ muhurDurumu: "beklemede", anchorSaglayici: null }));
    expect(html).toContain("Beklemede");
    expect(html).not.toContain("Sağlayıcı:");
  });

  it("HTML enjeksiyonuna kapalı — kurum adı kaçışlanır", () => {
    const html = renderSimulasyonRaporuHtml(
      data({ veri: veri({ kurumAdi: "<script>alert(1)</script>" }) }),
    );
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
