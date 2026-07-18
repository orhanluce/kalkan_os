// Sitasyon/kanıt paketi (V2 PR-4b adım 5, M24 — master §18).
//
// NE İŞE YARAR: bir kontrol testi KOŞUSUNDAN taşınabilir bir "citation bundle"
// üretir — resmî kaynak künyesi, hüküm yolu + kısa alıntı, artifact SHA-256,
// eşleme/doğrulama durumları, applicability gerekçesi, test sonucu, kanıt
// referansı, audit olayları, oluşturma zamanı ve aktör. Denetçi bu JSON'u
// KALKAN_OS'suz doğrulayabilir (scripts/verify-sitasyon.ts).
//
// HASH SÖZLEŞMESİ (kural 15 — mevcut dörtlüye DOKUNULMAZ, üç EK alan):
//   * legalSnapshotHash          → yalnız `legalSnapshot.snapshot` içeriğini
//   * sourceBundleHash           → yalnız `kaynakZinciri` dizisini
//   * applicabilityDecisionHash  → yalnız `applicability` dizisini
// doğrular. Her hash RFC 8785 kanonik JSON üzerinden sha256'dır ve adı neyi
// doğruladığını söyler. Kayıt yoksa alan NULL kalır — uydurulmaz (LEGACY
// deseni: eski koşunun dayanak fotoğrafı yoksa "yokmuş" denir).
//
// İMZA YOK (master §18 uyarısı): gerçek anahtar/TSA kararı verilmeden sahte
// "production signed" davranışı üretilmez — bu paket hash-bütünlüklüdür,
// imzalı DEĞİLDİR ve bunu alanında açıkça söyler.

import { canonicalHash, type CanonicalDeger } from "./canonical";

export const CITATION_BUNDLE_SCHEMA = "KALKAN_CITATION_BUNDLE_V1";

/** Kaynak zinciri halkası: resmî künye + hüküm yolu + eşleme durumu. */
export interface SitasyonKaynakHalkasi {
  authority: string;
  kaynakAd: string;
  jurisdiction: string;
  kaynakSeviyesi: string;
  canonicalUrl: string | null;
  artifactBaslik: string;
  artifactSha256: string;
  provisionRef: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  provisionDogrulama: string;
  /** Hüküm metninden kısa alıntı (ilk 240 karakter) — kayıtlı metin, üretilmiş değil. */
  snippet: string;
  obligationKod: string;
  obligationDogrulama: string;
  mappingDogrulama: string;
  kapsam: string;
}

export interface SitasyonApplicability {
  obligationKod: string;
  durum: string;
  gerekce: string | null;
  factSnapshotFingerprint: string;
  kararKaynagi: string;
}

export interface SitasyonGirdisi {
  testRun: {
    id: string;
    sonuc: string;
    gerekce: string;
    calistiAt: string;
    tanimAd: string;
    kontrolMaddeRef: string;
    kontrolBaslik: string;
  };
  /** Koşunun mühürlü dayanak fotoğrafı; eski koşularda olmayabilir (null). */
  legalSnapshot: { karar: string; snapshot: CanonicalDeger } | null;
  kaynakZinciri: SitasyonKaynakHalkasi[];
  applicability: SitasyonApplicability[];
  kanit: { evidenceId: string; dosyaHashSha256: string | null } | null;
  auditOlaylari: { eylem: string; zaman: string }[];
  aktor: { id: string; ad: string | null };
  olusturmaZamani: string;
}

export interface SitasyonPaketi extends SitasyonGirdisi {
  schema: typeof CITATION_BUNDLE_SCHEMA;
  imzaDurumu: "IMZASIZ_HASH_BUTUNLUKLU";
  legalSnapshotHash: string | null;
  sourceBundleHash: string;
  applicabilityDecisionHash: string;
}

/** Dizi alanlarını deterministik sıraya sokar (kural 11 — girdi sırası önemsiz). */
function normalize(g: SitasyonGirdisi): SitasyonGirdisi {
  return {
    ...g,
    kaynakZinciri: [...g.kaynakZinciri].sort((a, b) =>
      `${a.artifactSha256}|${a.provisionRef}|${a.obligationKod}`.localeCompare(
        `${b.artifactSha256}|${b.provisionRef}|${b.obligationKod}`,
      ),
    ),
    applicability: [...g.applicability].sort((a, b) => a.obligationKod.localeCompare(b.obligationKod)),
    auditOlaylari: [...g.auditOlaylari].sort((a, b) => `${a.zaman}|${a.eylem}`.localeCompare(`${b.zaman}|${b.eylem}`)),
  };
}

export async function sitasyonPaketiOlustur(girdi: SitasyonGirdisi): Promise<SitasyonPaketi> {
  const n = normalize(girdi);
  return {
    schema: CITATION_BUNDLE_SCHEMA,
    imzaDurumu: "IMZASIZ_HASH_BUTUNLUKLU",
    ...n,
    legalSnapshotHash: n.legalSnapshot ? await canonicalHash(n.legalSnapshot.snapshot) : null,
    sourceBundleHash: await canonicalHash(n.kaynakZinciri as unknown as CanonicalDeger),
    applicabilityDecisionHash: await canonicalHash(n.applicability as unknown as CanonicalDeger),
  };
}

export interface SitasyonDogrulamaSonucu {
  gecerli: boolean;
  alanlar: { alan: string; beklenen: string | null; hesaplanan: string | null; gecerli: boolean }[];
}

/**
 * Paketi DB'siz doğrular: üç hash'i içerikten yeniden hesaplar ve kayıtlıyla
 * karşılaştırır. Kurcalanmış içerik (snippet, durum, fingerprint...) ilgili
 * hash'i düşürür. legalSnapshot yoksa hash'i null olmalı — "yok"un da tutarlı
 * olması doğrulanır.
 */
export async function sitasyonDogrula(paket: SitasyonPaketi): Promise<SitasyonDogrulamaSonucu> {
  const n = normalize(paket);
  const alanlar: SitasyonDogrulamaSonucu["alanlar"] = [];

  const legalHesap = n.legalSnapshot ? await canonicalHash(n.legalSnapshot.snapshot) : null;
  alanlar.push({
    alan: "legalSnapshotHash",
    beklenen: paket.legalSnapshotHash,
    hesaplanan: legalHesap,
    gecerli: paket.legalSnapshotHash === legalHesap,
  });

  const kaynakHesap = await canonicalHash(n.kaynakZinciri as unknown as CanonicalDeger);
  alanlar.push({
    alan: "sourceBundleHash",
    beklenen: paket.sourceBundleHash,
    hesaplanan: kaynakHesap,
    gecerli: paket.sourceBundleHash === kaynakHesap,
  });

  const applHesap = await canonicalHash(n.applicability as unknown as CanonicalDeger);
  alanlar.push({
    alan: "applicabilityDecisionHash",
    beklenen: paket.applicabilityDecisionHash,
    hesaplanan: applHesap,
    gecerli: paket.applicabilityDecisionHash === applHesap,
  });

  return { gecerli: alanlar.every((a) => a.gecerli), alanlar };
}

/** Hüküm metninden kısa alıntı üretir (kayıtlı metnin ilk 240 karakteri). */
export function hukumSnippet(metin: string): string {
  return metin.length <= 240 ? metin : `${metin.slice(0, 240)}…`;
}
