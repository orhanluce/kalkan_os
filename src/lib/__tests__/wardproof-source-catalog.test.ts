import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  csvKayitlariniAyristir,
  wardproofKontrolZinciriOlustur,
  wardproofKaynakKataloguOlustur,
} from "../wardproof-source-catalog";

const BASLIK = [
  "source_id",
  "authority",
  "title",
  "legal_weight",
  "official_url",
  "publication_or_version_date",
  "official_issue",
  "effective_date",
  "applicability_summary",
  "local_file",
  "verification_status",
  "notes",
].join(",");

function envanter(overrides: Partial<Record<string, string>> = {}): string {
  const degerler: Record<string, string> = {
    source_id: "SPK-TEST",
    authority: "SPK",
    title: "Test Tebliği",
    legal_weight: "TEBLIG",
    official_url: "https://example.gov.tr/test",
    publication_or_version_date: "2025-03-13; değişiklik 2026-01-01",
    official_issue: "RG 12345",
    effective_date: "2025-06-30",
    applicability_summary: "Kapsamdaki kuruluşlar",
    local_file: "sources/SPK/test.pdf",
    verification_status: "SOURCE_VERIFIED_LEGAL_REVIEW_REQUIRED",
    notes: "Hukukçu inceleyecek",
    ...overrides,
  };
  const satir = BASLIK.split(",")
    .map((kolon) => `"${degerler[kolon].replaceAll('"', '""')}"`)
    .join(",");
  return `${BASLIK}\n${satir}\n`;
}

const SHA = `relative_path,bytes,sha256\n"sources/SPK/test.pdf","123","${"a".repeat(64)}"\n`;

describe("WARDPROOF kaynak kataloğu", () => {
  it("projedeki kanonik WARDPROOF envanterini 36 doğrulanmamış kayıt olarak yükler", () => {
    const paket = resolve(process.cwd(), "docs", "mevzuat", "wardproof", "2026-07-22");
    const katalog = wardproofKaynakKataloguOlustur(
      readFileSync(resolve(paket, "source_inventory.csv"), "utf8"),
      readFileSync(resolve(paket, "SHA256SUMS.csv"), "utf8"),
    );
    expect(katalog).toHaveLength(36);
    expect(katalog.map((kaynak) => kaynak.artifactDogrulamaDurumu)).not.toContain("VERIFIED");
    expect(katalog.some((kaynak) => kaynak.sourceId === "SPK-VII-128.10")).toBe(true);
    expect(katalog.some((kaynak) => kaynak.sourceId === "BDDK-BANK-BS")).toBe(true);
    expect(katalog.some((kaynak) => kaynak.sourceId === "KVKK-6698")).toBe(true);
    expect(katalog.some((kaynak) => kaynak.sourceId === "WARDPROOF-USER-TIMELINE")).toBe(true);
  });

  it("49 araştırma zincirini DRAFT_RESEARCH üretir ve kontrol eşlemesi kurmaz", () => {
    const paket = resolve(process.cwd(), "docs", "mevzuat", "wardproof", "2026-07-22");
    const katalog = wardproofKaynakKataloguOlustur(
      readFileSync(resolve(paket, "source_inventory.csv"), "utf8"),
      readFileSync(resolve(paket, "SHA256SUMS.csv"), "utf8"),
    );
    const zincir = wardproofKontrolZinciriOlustur(
      readFileSync(resolve(paket, "control_chain.csv"), "utf8"),
      katalog,
    );

    expect(zincir).toHaveLength(49);
    expect(new Set(zincir.map((kayit) => kayit.chainId)).size).toBe(49);
    expect(zincir.map((kayit) => kayit.dogrulamaDurumu)).not.toContain("VERIFIED");
    expect(zincir.every((kayit) => kayit.provisionMetni.startsWith("[ARAŞTIRMA ÖZETİ"))).toBe(true);
    expect(zincir[0]).not.toHaveProperty("controlId");
  });

  it("çoklu yürürlük hükümlerini resmî metindeki madde kurallarıyla ayırır", () => {
    const paket = resolve(process.cwd(), "docs", "mevzuat", "wardproof", "2026-07-22");
    const katalog = wardproofKaynakKataloguOlustur(
      readFileSync(resolve(paket, "source_inventory.csv"), "utf8"),
      readFileSync(resolve(paket, "SHA256SUMS.csv"), "utf8"),
    );
    const zincir = wardproofKontrolZinciriOlustur(
      readFileSync(resolve(paket, "control_chain.csv"), "utf8"),
      katalog,
    );
    const byId = new Map(zincir.map((kayit) => [kayit.chainId, kayit]));

    expect(byId.get("WP-BDDK-015")?.effectiveFrom).toBe("2020-07-01");
    expect(byId.get("WP-BDDK-007")?.effectiveFrom).toBe("2021-01-01");
    expect(byId.get("WP-KVKK-002")?.effectiveFrom).toBe("2024-06-01");
    expect(byId.get("WP-KVKK-008")?.effectiveFrom).toBe("2016-10-07");
    expect(byId.get("WP-SPK-016")?.effectiveFrom).toBe("2025-06-30");
  });

  it("zincirde resmî kaynak dosyası uyuşmazsa seed sözleşmesini reddeder", () => {
    const [kaynak] = wardproofKaynakKataloguOlustur(envanter(), SHA);
    const baslik = [
      "chain_id",
      "official_source",
      "article",
      "obligation",
      "applicability",
      "control",
      "evidence_requirement",
      "test_scenario",
      "source_file",
      "review_status",
    ].join(",");
    const satir = [
      "WP-SPK-001",
      kaynak.sourceId,
      "Madde 1",
      "Yükümlülük",
      "Kapsam",
      "Kontrol amacı",
      "Kanıt",
      "Test",
      "sources/SPK/baska.pdf",
      "LEGAL_REVIEW_REQUIRED",
    ]
      .map((deger) => `"${deger}"`)
      .join(",");

    expect(() => wardproofKontrolZinciriOlustur(`${baslik}\n${satir}\n`, [kaynak])).toThrow(
      "resmî kaynak dosyasıyla eşleşmiyor",
    );
  });

  it("tırnaklı virgül ve satır sonunu RFC 4180 olarak ayrıştırır", () => {
    const sonuc = csvKayitlariniAyristir('a,b\n"x, y","iki\nsatır"\n');
    expect(sonuc).toEqual([{ a: "x, y", b: "iki\nsatır" }]);
  });

  it("resmî kaydı hash manifestiyle eşleyip VERIFIED üretmez", () => {
    const [kaynak] = wardproofKaynakKataloguOlustur(envanter(), SHA);
    expect(kaynak).toMatchObject({
      sourceId: "SPK-TEST",
      jurisdiction: "TR",
      kaynakSeviyesi: "A",
      issuedAt: "2025-03-13",
      effectiveFrom: "2025-06-30",
      sha256: "a".repeat(64),
      artifactDogrulamaDurumu: "TODO_DOGRULA",
    });
  });

  it("bağlayıcı olmayan kaydı araştırma taslağı olarak sınıflar", () => {
    const [kaynak] = wardproofKaynakKataloguOlustur(
      envanter({
        legal_weight: "RESMI_REHBER",
        verification_status: "SOURCE_VERIFIED_NON_BINDING",
      }),
      SHA,
    );
    expect(kaynak.kaynakSeviyesi).toBe("B");
    expect(kaynak.artifactDogrulamaDurumu).toBe("DRAFT_RESEARCH");
  });

  it("paket dışına çıkan dosya yolunu reddeder", () => {
    expect(() =>
      wardproofKaynakKataloguOlustur(envanter({ local_file: "../secret.pdf" }), SHA),
    ).toThrow("paket dışına çıkamaz");
  });

  it("SHA kaydı eksikse sessizce seed etmez", () => {
    const bosSha = `relative_path,bytes,sha256\n"sources/SPK/baska.pdf","1","${"b".repeat(64)}"\n`;
    expect(() => wardproofKaynakKataloguOlustur(envanter(), bosSha)).toThrow(
      "SHA-256 kaydı bulunamadı",
    );
  });
});
