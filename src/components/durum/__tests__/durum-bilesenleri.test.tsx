// PR-1c durum bileşenleri: renk tek sinyal değil (ikon + metin), tazelik
// eşikleri deterministik (kural 11 — enjekte edilen `simdi` ile).
// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EvidenceFreshnessBadge } from "../evidence-freshness-badge";
import { LegalStatusBadge } from "../legal-status-badge";
import { StatusBadge } from "../status-badge";

describe("StatusBadge", () => {
  it("metni ve ikonu birlikte taşır (renk tek sinyal değil)", () => {
    const { container } = render(<StatusBadge durum="unknown">Belirsiz</StatusBadge>);
    expect(screen.getByText("Belirsiz")).toBeInTheDocument();
    expect(container.querySelector("svg")).not.toBeNull();
  });
});

describe("LegalStatusBadge", () => {
  it("TODO_DOGRULA hukuk incelemesi olarak görünür (kural 3)", () => {
    render(<LegalStatusBadge mevzuatDurumu="TODO_DOGRULA" />);
    expect(screen.getByText("Hukuk onayı bekliyor")).toBeInTheDocument();
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
