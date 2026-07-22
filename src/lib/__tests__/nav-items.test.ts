import { describe, expect, it } from "vitest";
import { navGruplari } from "@/components/app-shell/nav-items";

function mevzuatHedefleri(organizationType: string | null | undefined): string[] {
  return (
    navGruplari(organizationType)
      .find((grup) => grup.baslik === "Mevzuat")
      ?.ogeler.map((oge) => oge.href) ?? []
  );
}

describe("uygulama navigasyonu — mevzuat görünürlüğü", () => {
  it("kurum profili henüz yokken resmî kaynak sicilini gösterir", () => {
    expect(mevzuatHedefleri(null)).toEqual(["/regulasyon/kaynaklar"]);
  });

  it("CFO kurumunda kanun ve yönetmelikleri gösterir, ileri akışları gizler", () => {
    expect(mevzuatHedefleri("CORPORATE_FINANCE")).toEqual(["/regulasyon/kaynaklar"]);
  });

  it("regüle kurumda kaynaklarla birlikte doğrulama akışlarını gösterir", () => {
    expect(mevzuatHedefleri("REGULATED_FINANCIAL_INSTITUTION")).toEqual([
      "/regulasyon/kaynaklar",
      "/regulasyon/dogrulama",
      "/regulasyon/uygulanabilirlik",
      "/dora-roi",
    ]);
  });
});
