// PR-1c durum bileşenleri: renk tek sinyal değil (ikon + metin), tazelik
// eşikleri deterministik (kural 11 — enjekte edilen `simdi` ile).
// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EvidenceFreshnessBadge } from "../evidence-freshness-badge";
import { LegalStatusBadge } from "../legal-status-badge";
import { ObligationBasisBadge } from "../obligation-basis-badge";
import { StatusBadge } from "../status-badge";

describe("StatusBadge", () => {
  it("metni ve ikonu birlikte taşır (renk tek sinyal değil)", () => {
    const { container } = render(<StatusBadge durum="unknown">Belirsiz</StatusBadge>);
    expect(screen.getByText("Belirsiz")).toBeInTheDocument();
    expect(container.querySelector("svg")).not.toBeNull();
  });
});

describe("LegalStatusBadge", () => {
  it("TODO_DOGRULA ürün dilindeki etiketiyle görünür (kural 3, ui-labels tek kaynak)", () => {
    render(<LegalStatusBadge mevzuatDurumu="TODO_DOGRULA" />);
    expect(screen.getByText("Doğrulanmadı")).toBeInTheDocument();
  });
});

describe("ObligationBasisBadge (V2 §6.4) — dayanak türü", () => {
  it("BEST_PRACTICE 'İyi uygulama' olarak görünür (mevzuat gibi DEĞİL)", () => {
    const { container } = render(<ObligationBasisBadge basis="BEST_PRACTICE" />);
    expect(screen.getByText("İyi uygulama")).toBeInTheDocument();
    expect(container.querySelector("svg")).not.toBeNull(); // ikon + metin
  });

  it("LEGAL_MANDATORY 'Yasal zorunluluk' etiketi taşır", () => {
    render(<ObligationBasisBadge basis="LEGAL_MANDATORY" />);
    expect(screen.getByText("Yasal zorunluluk")).toBeInTheDocument();
  });

  it("dört dayanak türü dört ayrı etikete düşer", () => {
    const beklenen: Record<string, string> = {
      LEGAL_MANDATORY: "Yasal zorunluluk",
      CONTRACTUAL: "Sözleşmesel zorunluluk",
      BOARD_POLICY: "Yönetim kurulu politikası",
      BEST_PRACTICE: "İyi uygulama",
    };
    for (const [basis, etiket] of Object.entries(beklenen)) {
      const { unmount } = render(<ObligationBasisBadge basis={basis} />);
      expect(screen.getByText(etiket)).toBeInTheDocument();
      unmount();
    }
  });
});

describe("EvidenceFreshnessBadge — deterministik eşikler", () => {
  const simdi = new Date("2026-07-18T12:00:00Z");

  it("null bitiş = Süresiz", () => {
    render(<EvidenceFreshnessBadge gecerlilikBitis={null} simdi={simdi} />);
    expect(screen.getByText("Süresiz")).toBeInTheDocument();
  });

  it("geçmiş tarih = Süresi doldu", () => {
    render(<EvidenceFreshnessBadge gecerlilikBitis="2026-07-01" simdi={simdi} />);
    expect(screen.getByText("Süresi doldu")).toBeInTheDocument();
  });

  it("14 gün içinde = yaklaşıyor uyarısı (gün sayısıyla)", () => {
    render(<EvidenceFreshnessBadge gecerlilikBitis="2026-07-25" simdi={simdi} />);
    expect(screen.getByText(/gün kaldı/)).toBeInTheDocument();
  });

  it("uzak tarih = Taze", () => {
    render(<EvidenceFreshnessBadge gecerlilikBitis="2026-12-31" simdi={simdi} />);
    expect(screen.getByText("Taze")).toBeInTheDocument();
  });
});
