import { describe, it, expect } from "vitest";
import { renderYkBeyaniHtml } from "../yk-beyani";

const baseData = {
  tenantName: "Demo Aracı Kurum A.Ş.",
  donemEtiketi: "2026 Q3",
  hazirlanmaTarihi: "2026-07-16",
  olgunlukSkoru: 48,
  acikBulgularSayisi: 1,
  kritikBulgularSayisi: 1,
  sonSizmaTestiTarihi: "2026-05-01",
  toplamKanitSayisi: 3,
  rtoSaat: 4,
  rpoSaat: 1,
};

describe("renderYkBeyaniHtml", () => {
  it("includes the tenant name, score, and finding counts", () => {
    const html = renderYkBeyaniHtml(baseData);
    expect(html).toContain("Demo Ar");
    expect(html).toContain("48/100");
    expect(html).toContain(">1<");
  });

  it("escapes HTML-significant characters in the tenant name", () => {
    const html = renderYkBeyaniHtml({ ...baseData, tenantName: "<script>alert(1)</script>" });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("renders an em dash placeholder for null dates and RTO/RPO", () => {
    const html = renderYkBeyaniHtml({
      ...baseData,
      sonSizmaTestiTarihi: null,
      rtoSaat: null,
      rpoSaat: null,
    });
    expect(html).toContain(">—<");
  });

  it("produces valid, parseable HTML", () => {
    const html = renderYkBeyaniHtml(baseData);
    const doc = new DOMParser().parseFromString(html, "text/html");
    expect(doc.querySelector("h1")?.textContent).toContain(baseData.tenantName);
  });
});
