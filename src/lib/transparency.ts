// SCITT tarzı şeffaflık defteri — imzalı ifadeleri append-only, Merkle
// destekli bir kütüğe yazar ve ÇEVRİMDIŞI doğrulanabilir kapsama (inclusion)
// makbuzu üretir (docs/ROADMAP.md M5.5 Merkle'yi YENİDEN KULLANIR; nihai
// talimat §8 Gate G3).
//
// NE İSPATLAR (DÜRÜSTÇE): "bu imzalı ifade, kütüğün N. konumuna eklendi ve
// imzalı ağaç başı (STH) yayınlandığından beri kütük değişmedi." Kapsama
// makbuzu, denetçinin ağacın TAMAMINA sahip OLMADAN — yalnız yaprak + proof +
// STH ile — bunu doğrulamasına izin verir (verify-seffaflik.ts, DB'siz).
//
// NE İSPATLAMAZ: bağımsız DUVAR-SAATİ zamanı. Kütük sırası bizim; "şu hash şu
// takvim anında vardı"yı bağımsız kanıtlayan tek şey nitelikli bir RFC 3161
// TSA'dır (bkz. timestamp.ts). O bağlanana kadar makbuz "defterde" der,
// "dış zaman damgalı" DEMEZ — durum türetimi bu ayrımı korur.
//
// KRİPTO YENİDEN KULLANIMI: hiçbir ilkel burada yeniden yazılmadı. Merkle/proof
// merkle.ts'ten (RFC 6962), imza manifest-signature.ts'ten (ES256 detached JWS),
// kanonik JSON canonical.ts'ten (RFC 8785) gelir.

import { canonicalJson, type CanonicalDeger } from "./canonical";
import { sha256Hex } from "./evidence";
import { inclusionProof, merkleRootHex, verifyInclusion, type ProofStep } from "./merkle";
import {
  detachedJwsDogrula,
  detachedJwsImzala,
  type DetachedImza,
  type ManifestSigner,
} from "./manifest-signature";

const HEX64 = /^[0-9a-f]{64}$/;

export const SIGNED_STATEMENT_SCHEMA = "KALKAN_SCITT_STATEMENT_V1" as const;
export const STH_SCHEMA = "KALKAN_SCITT_STH_V1" as const;
export const RECEIPT_SCHEMA = "KALKAN_SCITT_RECEIPT_V1" as const;

/** İmzalı ifade: bir artefaktın özeti (statementHash) + o özet üzerine imza. */
export interface SignedStatement {
  schema: typeof SIGNED_STATEMENT_SCHEMA;
  /** Ne tür artefakt: 'SIMULATION_MANIFEST' | 'POLICY_VERSION' | 'EVIDENCE_ENVELOPE' | ... */
  kind: string;
  /** İmzalanan artefakt özeti (64 hex). */
  statementHash: string;
  /** {schema, kind, statementHash} üzerine detached JWS. */
  imza: DetachedImza;
}

/** İmzalı ağaç başı (RFC 6962 STH / SCITT checkpoint): defterin o anki kökü. */
export interface AgacBasi {
  schema: typeof STH_SCHEMA;
  treeSize: number;
  rootHash: string;
}

export interface SeffaflikMakbuzu {
  schema: typeof RECEIPT_SCHEMA;
  leafHash: string;
  leafIndex: number;
  proof: ProofStep[];
  sth: AgacBasi;
  sthImza: DetachedImza;
  signedStatement: SignedStatement;
}

/** JWK'yı kanonik dört alana indirger (imza dogrulama yalnız bunları kullanır). */
function jwkCanonical(jwk: JsonWebKey): CanonicalDeger {
  return { crv: jwk.crv ?? "", kty: jwk.kty ?? "", x: jwk.x ?? "", y: jwk.y ?? "" };
}

/** İmzalanan/doğrulanan iddia — statementHash'in kendisi değil, bağlamıyla. */
function statementClaim(s: Pick<SignedStatement, "kind" | "statementHash">): CanonicalDeger {
  return { kind: s.kind, schema: SIGNED_STATEMENT_SCHEMA, statementHash: s.statementHash };
}

/** Bir artefakt özetini imzalayıp imzalı ifade üretir. */
export async function imzaliIfadeOlustur(
  kind: string,
  statementHash: string,
  signer: ManifestSigner,
): Promise<SignedStatement> {
  if (!HEX64.test(statementHash)) {
    throw new Error(`Gecersiz statementHash (64 hex bekleniyor): ${statementHash.slice(0, 12)}...`);
  }
  const imza = await detachedJwsImzala(statementClaim({ kind, statementHash }), signer);
  return { schema: SIGNED_STATEMENT_SCHEMA, kind, statementHash, imza };
}

/** İmzalı ifadenin kendi imzasını doğrular (statementHash bağlamıyla imzalı mı). */
export async function imzaliIfadeDogrula(s: SignedStatement): Promise<boolean> {
  if (s.schema !== SIGNED_STATEMENT_SCHEMA) return false;
  if (!HEX64.test(s.statementHash)) return false;
  return detachedJwsDogrula(statementClaim(s), s.imza);
}

/**
 * Kütük yaprağı: imzalı ifadenin KANONİK SHA-256'sı (hex). merkle.ts bunu
 * 0x00 ön ekiyle sarar. Alan seti sabit ve deterministik olmalı ki bağımsız
 * doğrulayıcı aynı yaprağı yeniden üretebilsin.
 */
export function ifadeYaprakHash(s: SignedStatement): Promise<string> {
  const kanonik: CanonicalDeger = {
    imza: { jws: s.imza.jws, kid: s.imza.kid, publicJwk: jwkCanonical(s.imza.publicJwk) },
    kind: s.kind,
    schema: SIGNED_STATEMENT_SCHEMA,
    statementHash: s.statementHash,
  };
  return sha256Hex(new TextEncoder().encode(canonicalJson(kanonik)).buffer as ArrayBuffer);
}

/** Yaprak hash'lerinden (leaf_index sırasıyla) defter kökünü üretir. */
export function defterKoku(yaprakHashlar: string[]): Promise<string> {
  return merkleRootHex(yaprakHashlar);
}

/** İmzalı ağaç başı (STH) üretir ve imzalar. */
export async function agacBasiImzala(
  treeSize: number,
  rootHash: string,
  signer: ManifestSigner,
): Promise<{ sth: AgacBasi; imza: DetachedImza }> {
  const sth: AgacBasi = { schema: STH_SCHEMA, treeSize, rootHash };
  const imza = await detachedJwsImzala(sth as unknown as CanonicalDeger, signer);
  return { sth, imza };
}

/** STH imzasını doğrular. */
export function agacBasiDogrula(sth: AgacBasi, imza: DetachedImza): Promise<boolean> {
  if (sth.schema !== STH_SCHEMA) return Promise.resolve(false);
  return detachedJwsDogrula(sth as unknown as CanonicalDeger, imza);
}

/**
 * Kapsama makbuzu üretir: yaprak + inclusion proof + imzalı STH + imzalı ifade.
 * Denetçi bunu tek başına (verify-seffaflik.ts) doğrular.
 */
export async function makbuzUret(
  yaprakHashlar: string[],
  leafIndex: number,
  sth: AgacBasi,
  sthImza: DetachedImza,
  signedStatement: SignedStatement,
): Promise<SeffaflikMakbuzu> {
  const proof = await inclusionProof(yaprakHashlar, leafIndex);
  return {
    schema: RECEIPT_SCHEMA,
    leafHash: yaprakHashlar[leafIndex],
    leafIndex,
    proof,
    sth,
    sthImza,
    signedStatement,
  };
}

export interface MakbuzKontrol {
  ad: string;
  gecti: boolean;
  aciklama: string;
}
export interface MakbuzSonucu {
  gecerli: boolean;
  kontroller: MakbuzKontrol[];
}

/**
 * Kapsama makbuzunu ÇEVRİMDIŞI doğrular — DB, ağ, env yok. Her adım ayrı
 * raporlanır (denetçi hangi güvencenin tuttuğunu/düştüğünü görebilsin).
 *
 * DÜRÜSTLÜK: leaf_hash'i makbuzdaki `leafHash` alanına GÜVENMEZ; imzalı
 * ifadeden YENİDEN hesaplar. Böylece defterde saklanan yaprak, imzalı ifadeyle
 * uyuşmuyorsa (kurcalama) burada yakalanır.
 */
export async function makbuzDogrula(m: SeffaflikMakbuzu): Promise<MakbuzSonucu> {
  const k: MakbuzKontrol[] = [];

  const ifadeOk = await imzaliIfadeDogrula(m.signedStatement);
  k.push({
    ad: "İmzalı ifade imzası",
    gecti: ifadeOk,
    aciklama: ifadeOk ? "İfade, statementHash bağlamıyla geçerli şekilde imzalı." : "İfade imzası tutmadı.",
  });

  const beklenenYaprak = await ifadeYaprakHash(m.signedStatement);
  const yaprakOk = beklenenYaprak === m.leafHash;
  k.push({
    ad: "Yaprak ↔ ifade tutarlılığı",
    gecti: yaprakOk,
    aciklama: yaprakOk
      ? "Kütük yaprağı, imzalı ifadenin kanonik özetiyle birebir."
      : "Kütük yaprağı imzalı ifadeyle uyuşmuyor (kurcalama olabilir).",
  });

  const sthOk = await agacBasiDogrula(m.sth, m.sthImza);
  k.push({
    ad: "İmzalı ağaç başı (STH)",
    gecti: sthOk,
    aciklama: sthOk ? "STH imzası geçerli — kök yayınlanmış." : "STH imzası tutmadı.",
  });

  const idxOk = m.leafIndex >= 0 && m.leafIndex < m.sth.treeSize;
  k.push({
    ad: "Yaprak indeksi kapsamda",
    gecti: idxOk,
    aciklama: idxOk
      ? `Yaprak ${m.leafIndex}, ağaç boyu ${m.sth.treeSize} içinde.`
      : `Yaprak indeksi ${m.leafIndex}, ağaç boyu ${m.sth.treeSize} dışında.`,
  });

  const incOk = await verifyInclusion(m.leafHash, m.proof, m.sth.rootHash);
  k.push({
    ad: "Merkle kapsama (inclusion)",
    gecti: incOk,
    aciklama: incOk
      ? "Yaprak, proof ile STH köküne bağlanıyor — kütükte var."
      : "Kapsama kanıtı köke ulaşmadı — yaprak bu kütükte değil ya da kök farklı.",
  });

  return { gecerli: k.every((x) => x.gecti), kontroller: k };
}
