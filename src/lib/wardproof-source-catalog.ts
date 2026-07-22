// WARDPROOF mevzuat kaynak paketi için saf dosya sözleşmesi.
//
// Kural 3: bu modül hukuki içerik üretmez. Araştırma paketindeki künye ve
// SHA-256 kayıtlarını doğrular, DB seed'inin tüketebileceği deterministik bir
// kataloğa çevirir. Hiçbir kayıt burada VERIFIED yapılmaz.

export const WARDPROOF_KAYNAK_KESIM_TARIHI = "2026-07-22";

const ZORUNLU_ENVANTER_KOLONLARI = [
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
] as const;

const ZORUNLU_HASH_KOLONLARI = ["relative_path", "bytes", "sha256"] as const;

const ZORUNLU_KONTROL_ZINCIRI_KOLONLARI = [
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
] as const;

export type WardproofKaynakSeviyesi = "A" | "B" | "C" | "D";
export type WardproofArtifactDogrulama = "DRAFT_RESEARCH" | "TODO_DOGRULA";

export interface WardproofKaynakKaydi {
  sourceId: string;
  authority: string;
  jurisdiction: "TR" | "EU";
  kaynakSeviyesi: WardproofKaynakSeviyesi;
  ad: string;
  canonicalUrl: string | null;
  legalWeight: string;
  officialIssue: string;
  publicationOrVersionDate: string;
  issuedAt: string | null;
  effectiveDateText: string;
  effectiveFrom: string | null;
  applicabilitySummary: string;
  localFile: string;
  bytes: number;
  sha256: string;
  mediaType: string;
  artifactDogrulamaDurumu: WardproofArtifactDogrulama;
  verificationStatus: string;
  notes: string;
}

export interface WardproofKontrolZinciriKaydi {
  chainId: string;
  sourceId: string;
  sourceFile: string;
  provisionRef: string;
  provisionBaslik: string;
  provisionMetni: string;
  effectiveFrom: string;
  obligationBaslik: string;
  obligationAmac: string;
  applicabilityResearchNote: string;
  evidenceRequirement: string;
  testScenarioResearchNote: string;
  dogrulamaDurumu: "DRAFT_RESEARCH";
}

/** RFC 4180: tırnak, çift tırnak kaçışı ve tırnak içi satır sonunu destekler. */
export function csvKayitlariniAyristir(metin: string): Record<string, string>[] {
  if (metin.includes("\0")) throw new Error("CSV null byte içeriyor.");
  const temiz = metin.charCodeAt(0) === 0xfeff ? metin.slice(1) : metin;
  const satirlar: string[][] = [];
  let satir: string[] = [];
  let alan = "";
  let tirnakIcinde = false;

  for (let i = 0; i < temiz.length; i++) {
    const karakter = temiz[i];
    if (tirnakIcinde) {
      if (karakter === '"') {
        if (temiz[i + 1] === '"') {
          alan += '"';
          i++;
        } else {
          tirnakIcinde = false;
        }
      } else {
        alan += karakter;
      }
      continue;
    }

    if (karakter === '"') tirnakIcinde = true;
    else if (karakter === ",") {
      satir.push(alan);
      alan = "";
    } else if (karakter === "\n" || karakter === "\r") {
      if (karakter === "\r" && temiz[i + 1] === "\n") i++;
      satir.push(alan);
      if (satir.some((hucre) => hucre !== "")) satirlar.push(satir);
      satir = [];
      alan = "";
    } else alan += karakter;
  }
  if (tirnakIcinde) throw new Error("CSV kapanmamış tırnak içeriyor.");
  satir.push(alan);
  if (satir.some((hucre) => hucre !== "")) satirlar.push(satir);
  if (satirlar.length === 0) throw new Error("CSV boş.");

  const basliklar = satirlar[0].map((baslik) => baslik.trim());
  if (new Set(basliklar).size !== basliklar.length)
    throw new Error("CSV yinelenen başlık içeriyor.");

  return satirlar.slice(1).map((degerler, satirNo) => {
    if (degerler.length !== basliklar.length) {
      throw new Error(`CSV ${satirNo + 2}. satır kolon sayısı başlıkla eşleşmiyor.`);
    }
    return Object.fromEntries(basliklar.map((baslik, i) => [baslik, degerler[i]]));
  });
}

function zorunluKolonlariDogrula(
  kayitlar: Record<string, string>[],
  kolonlar: readonly string[],
  ad: string,
): void {
  if (kayitlar.length === 0) throw new Error(`${ad} veri satırı içermiyor.`);
  const ilk = kayitlar[0];
  const eksik = kolonlar.filter((kolon) => !(kolon in ilk));
  if (eksik.length > 0) throw new Error(`${ad} eksik kolon içeriyor: ${eksik.join(", ")}`);
}

function isoTarihBasi(deger: string): string | null {
  const eslesme = deger.match(/^(\d{4}-\d{2}-\d{2})(?:$|[; ])/);
  if (!eslesme) return null;
  const tarih = new Date(`${eslesme[1]}T00:00:00Z`);
  return Number.isNaN(tarih.getTime()) ? null : eslesme[1];
}

function seviye(legalWeight: string): WardproofKaynakSeviyesi {
  if (["EGITIM_NOTU", "GORSEL_REFERANS"].includes(legalWeight)) return "D";
  if (
    [
      "RESMI_REHBER",
      "RESMI_DUYURU",
      "RESMI_KURUL_ACIKLAMASI",
      "RESMI_LISTE_SUPPORTING",
      "STRATEJI",
    ].includes(legalWeight)
  )
    return "B";
  return "A";
}

function jurisdiction(sourceId: string): "TR" | "EU" {
  return sourceId.startsWith("EU-") ? "EU" : "TR";
}

function mediaType(yol: string): string {
  const uzanti = yol.toLowerCase().split(".").pop();
  if (uzanti === "pdf") return "application/pdf";
  if (uzanti === "html" || uzanti === "htm") return "text/html";
  if (uzanti === "xml") return "application/xml";
  if (uzanti === "txt") return "text/plain";
  if (uzanti === "png") return "image/png";
  throw new Error(`Desteklenmeyen kaynak dosyası türü: ${yol}`);
}

function resmiUrl(deger: string): string | null {
  if (!/^https:\/\//i.test(deger)) return null;
  return new URL(deger).toString();
}

function zincirEffectiveFrom(kaynak: WardproofKaynakKaydi, article: string): string | null {
  if (kaynak.sourceId === "SPK-III-62.2") return "2025-06-30";

  if (kaynak.sourceId === "BDDK-BANK-BS") {
    // Resmî metin md.46: md.29 2020-07-01; zincirdeki diğer hükümler
    // 2021-01-01. "Madde 12-13" bileşik kaydı, iki hükmün de yürürlükte
    // olduğu en erken tarih olan 2021-01-01'i kullanır.
    return article === "Madde 29" ? "2020-07-01" : "2021-01-01";
  }

  if (kaynak.sourceId === "KVKK-6698") {
    // Konsolide metin md.32 + 7499 yürürlük tablosu. Bileşik referanslarda
    // özetin tüm parçalarının yürürlükte olduğu en erken tarih kullanılır.
    if (/Madde (?:6|9)(?:\D|$)/.test(article)) return "2024-06-01";
    if (/Madde (?:8|10|11|12|13)(?:\D|$)/.test(article) || article === "Madde 10-13")
      return "2016-10-07";
    return "2016-04-07";
  }

  return kaynak.effectiveFrom;
}

/**
 * Araştırma zincirini global hüküm/yükümlülük seed sözleşmesine çevirir.
 * `control` yalnız yükümlülüğün kısa başlığıdır; katalog kontrol kimliği
 * üretilmez ve obligation_control_mappings'e eşleme yapılmaz.
 */
export function wardproofKontrolZinciriOlustur(
  kontrolZinciriCsv: string,
  kaynakKatalogu: WardproofKaynakKaydi[],
): WardproofKontrolZinciriKaydi[] {
  const kayitlar = csvKayitlariniAyristir(kontrolZinciriCsv);
  zorunluKolonlariDogrula(kayitlar, ZORUNLU_KONTROL_ZINCIRI_KOLONLARI, "Kontrol zinciri");

  const kaynakById = new Map(kaynakKatalogu.map((kaynak) => [kaynak.sourceId, kaynak]));
  const chainIds = new Set<string>();
  const provisionKeys = new Set<string>();

  return kayitlar
    .map((kayit) => {
      for (const kolon of ZORUNLU_KONTROL_ZINCIRI_KOLONLARI) {
        if (!kayit[kolon]?.trim())
          throw new Error(`Kontrol zinciri boş zorunlu alan içeriyor: ${kolon}`);
      }
      if (!/^WP-[A-Z0-9]+-\d{3}$/.test(kayit.chain_id) || chainIds.has(kayit.chain_id))
        throw new Error(`Geçersiz/yinelenen chain_id: ${kayit.chain_id}`);
      chainIds.add(kayit.chain_id);

      if (kayit.review_status !== "LEGAL_REVIEW_REQUIRED") {
        throw new Error(
          `Kontrol zinciri hukuk incelemesi dışında doğamaz: ${kayit.chain_id} (${kayit.review_status})`,
        );
      }

      const kaynak = kaynakById.get(kayit.official_source);
      if (!kaynak)
        throw new Error(`Kontrol zinciri kaynağı envanterde yok: ${kayit.official_source}`);

      const kaynakDosyalari = kayit.source_file.split(";").map((yol) => yol.trim());
      if (
        kaynakDosyalari.some((yol) => !yol.startsWith("sources/") || yol.split("/").includes(".."))
      )
        throw new Error(`Kontrol zinciri paket dışı kaynak yolu içeriyor: ${kayit.chain_id}`);
      if (!kaynakDosyalari.includes(kaynak.localFile)) {
        throw new Error(`Kontrol zinciri resmî kaynak dosyasıyla eşleşmiyor: ${kayit.chain_id}`);
      }

      const provisionKey = `${kaynak.sourceId}|${kayit.article}`;
      if (provisionKeys.has(provisionKey))
        throw new Error(`Yinelenen kaynak/madde zinciri: ${provisionKey}`);
      provisionKeys.add(provisionKey);

      const effectiveFrom = zincirEffectiveFrom(kaynak, kayit.article);
      if (!effectiveFrom) {
        throw new Error(
          `Hüküm yürürlük tarihi belirsiz; seed edilemez: ${kayit.chain_id} (${kaynak.effectiveDateText})`,
        );
      }

      return {
        chainId: kayit.chain_id,
        sourceId: kaynak.sourceId,
        sourceFile: kaynak.localFile,
        provisionRef: kayit.article,
        provisionBaslik: `${kaynak.sourceId} — ${kayit.article}`,
        provisionMetni: `[ARAŞTIRMA ÖZETİ — RESMÎ HÜKÜM METNİ DEĞİLDİR] ${kayit.obligation}`,
        effectiveFrom,
        obligationBaslik: kayit.control,
        obligationAmac: kayit.obligation,
        applicabilityResearchNote: kayit.applicability,
        evidenceRequirement: kayit.evidence_requirement,
        testScenarioResearchNote: kayit.test_scenario,
        dogrulamaDurumu: "DRAFT_RESEARCH" as const,
      };
    })
    .sort((a, b) => a.chainId.localeCompare(b.chainId, "en"));
}

export function wardproofKaynakKataloguOlustur(
  envanterCsv: string,
  shaCsv: string,
): WardproofKaynakKaydi[] {
  const envanter = csvKayitlariniAyristir(envanterCsv);
  const hashler = csvKayitlariniAyristir(shaCsv);
  zorunluKolonlariDogrula(envanter, ZORUNLU_ENVANTER_KOLONLARI, "Kaynak envanteri");
  zorunluKolonlariDogrula(hashler, ZORUNLU_HASH_KOLONLARI, "SHA-256 manifesti");

  const hashByPath = new Map(
    hashler.map((kayit) => [kayit.relative_path.replaceAll("\\", "/"), kayit]),
  );
  const sourceIds = new Set<string>();

  const katalog = envanter.map((kayit) => {
    const localFile = kayit.local_file.replaceAll("\\", "/");
    if (!localFile.startsWith("sources/") || localFile.split("/").includes("..")) {
      throw new Error(`Kaynak dosyası paket dışına çıkamaz: ${kayit.local_file}`);
    }
    if (!kayit.source_id || sourceIds.has(kayit.source_id))
      throw new Error(`Geçersiz/yinelenen source_id: ${kayit.source_id}`);
    sourceIds.add(kayit.source_id);

    const hashKaydi = hashByPath.get(localFile);
    if (!hashKaydi) throw new Error(`SHA-256 kaydı bulunamadı: ${localFile}`);
    if (!/^[0-9a-f]{64}$/.test(hashKaydi.sha256)) throw new Error(`Geçersiz SHA-256: ${localFile}`);
    const bytes = Number(hashKaydi.bytes);
    if (!Number.isSafeInteger(bytes) || bytes <= 0)
      throw new Error(`Geçersiz dosya boyutu: ${localFile}`);

    return {
      sourceId: kayit.source_id,
      authority: kayit.authority,
      jurisdiction: jurisdiction(kayit.source_id),
      kaynakSeviyesi: seviye(kayit.legal_weight),
      ad: kayit.title,
      canonicalUrl: resmiUrl(kayit.official_url),
      legalWeight: kayit.legal_weight,
      officialIssue: kayit.official_issue,
      publicationOrVersionDate: kayit.publication_or_version_date,
      issuedAt: isoTarihBasi(kayit.publication_or_version_date),
      effectiveDateText: kayit.effective_date,
      effectiveFrom: isoTarihBasi(kayit.effective_date),
      applicabilitySummary: kayit.applicability_summary,
      localFile,
      bytes,
      sha256: hashKaydi.sha256,
      mediaType: mediaType(localFile),
      artifactDogrulamaDurumu:
        kayit.verification_status.includes("NON_BINDING") ||
        kayit.verification_status === "REFERENCE_ONLY"
          ? "DRAFT_RESEARCH"
          : "TODO_DOGRULA",
      verificationStatus: kayit.verification_status,
      notes: kayit.notes,
    } satisfies WardproofKaynakKaydi;
  });

  return katalog.sort((a, b) => a.sourceId.localeCompare(b.sourceId, "en"));
}
