// Manifest imzalama — ES256 detached JWS (docs/ROADMAP.md ADR-M11-01).
//
// NE İSPATLAR: "bu paketi KALKAN_OS/tenant anahtarı imzaladı." Paketin
// KALKAN_OS tarafından üretildiğinin ve imzadan sonra değişmediğinin kanıtı.
//
// NE İSPATLAMAZ: nitelikli elektronik imza / kurumsal elektronik mühür DEĞİLDİR.
// Hukuken kurumu bağlayan bir imza gerekiyorsa yetkili kişi NES'i veya kurumsal
// e-mühür entegrasyonu ayrıca gerekir (ADR-M11-01 hukuki ayrım). Bu uyarı hem
// kodda hem doğrulama yüzeyinde korunmalı.
//
// ANAHTAR NEREDE (ADR-M11-01): production'da anahtar HSM destekli KMS'te
// üretilir/saklanır ve DIŞARI AKTARILAMAZ; KALKAN_OS yalnız KMS imzalama
// API'sini çağırır. private key ASLA veritabanında veya env'de tutulmaz. Bu
// modül o sınırı bir SOYUTLAMAYLA korur: `ManifestSigner` yalnızca sign() ve
// publicKeyJwk() sunar — private key'e erişim yoktur. KMS imzalayıcı bu
// arayüzü uygular; aşağıdaki LocalDevSigner yalnız geliştirme içindir.
//
// DETACHED: JWS payload'ı (kanonik manifest) imzanın içine gömülmez —
// manifest zaten ayrıca saklanıyor, iki kez taşımak gereksiz. Doğrulayıcı
// kanonik manifesti yeniden üretip imzayı ona karşı sınar.

import { canonicalJson, type CanonicalDeger } from "./canonical";

/** JWS imza algoritması. ADR-M11-01: ES256 / NIST P-256, sabit. */
export const JWS_ALG = "ES256" as const;

export interface DetachedImza {
  /** `${protectedHeaderB64}..${signatureB64}` — RFC 7515 detached compact. */
  jws: string;
  /** Hangi anahtarın imzaladığı. Rotasyonda eski kid'lerle doğrulama sürer. */
  kid: string;
  /** Doğrulayıcı bunu kullanır; bize ulaşmadan imzayı sınayabilsin diye saklanır. */
  publicJwk: JsonWebKey;
}

/**
 * İmzalayıcı soyutlaması. private key'e ERİŞİM YOKTUR — yalnız imzalama ve
 * public key. KMS imzalayıcı bunu uygular (sign() KMS API'sine gider);
 * LocalDevSigner bellekte geçici anahtarla uygular.
 */
export interface ManifestSigner {
  readonly kid: string;
  readonly ad: string;
  /** Ham P1363 (r||s, 64 bayt) imza döndürür — JWS ES256'nın beklediği biçim. */
  sign(signingInput: Uint8Array): Promise<Uint8Array>;
  publicKeyJwk(): Promise<JsonWebKey>;
}

function b64url(data: Uint8Array): string {
  let s = "";
  for (const b of data) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function utf8(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

/**
 * Web Crypto'nun BufferSource beklediği yerlerde Uint8Array'i geçirmek için.
 * TS'in yeni lib tipleri Uint8Array'i `Uint8Array<ArrayBufferLike>` sayıyor ve
 * bu, sade `ArrayBuffer` bekleyen BufferSource ile sürtüşüyor. Baytları taze
 * bir ArrayBuffer'a kopyalayıp kesin bir BufferSource döndürüyoruz.
 */
function bufKaynak(u: Uint8Array): ArrayBuffer {
  return u.slice().buffer;
}

/**
 * Kanonik manifesti detached JWS olarak imzalar.
 *
 * İmzalanan şey manifestin RFC 8785 kanonik temsili — hangi kod yolundan
 * geçtiğinden bağımsız aynı baytlar (bkz. canonical.ts). İmza bu yüzden
 * içeriğe bağlıdır, nesnenin nasıl kurulduğuna değil.
 */
export async function detachedJwsImzala(
  manifest: CanonicalDeger,
  signer: ManifestSigner,
): Promise<DetachedImza> {
  const header = { alg: JWS_ALG, kid: signer.kid };
  const protectedB64 = b64url(utf8(canonicalJson(header as CanonicalDeger)));
  const payloadB64 = b64url(utf8(canonicalJson(manifest)));
  const signingInput = utf8(`${protectedB64}.${payloadB64}`);

  const signature = await signer.sign(signingInput);
  const jws = `${protectedB64}..${b64url(signature)}`;

  return { jws, kid: signer.kid, publicJwk: await signer.publicKeyJwk() };
}

/**
 * Detached JWS'i doğrular. Doğrulayıcı BİZE ULAŞMADAN bunu koşabilsin diye
 * public JWK dışarıdan gelir (imzayla birlikte saklanan) — kendi
 * veritabanımıza sormak, doğrulamanın kanıtlaması gereken şeyi baştan
 * varsaymak olurdu (verification.ts ile aynı ilke).
 */
export async function detachedJwsDogrula(
  manifest: CanonicalDeger,
  imza: DetachedImza,
): Promise<boolean> {
  const [protectedB64, bos, sigB64] = imza.jws.split(".");
  if (bos !== "" || !protectedB64 || !sigB64) return false;

  let header: { alg?: string; kid?: string };
  try {
    header = JSON.parse(new TextDecoder().decode(b64urlDecode(protectedB64)));
  } catch {
    return false;
  }
  // Algoritma sabit: "none" veya beklenmeyen alg ile imza atlatma yolunu kapat.
  if (header.alg !== JWS_ALG) return false;

  const payloadB64 = b64url(utf8(canonicalJson(manifest)));
  const signingInput = utf8(`${protectedB64}.${payloadB64}`);

  let key: CryptoKey;
  try {
    key = await crypto.subtle.importKey(
      "jwk",
      imza.publicJwk,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );
  } catch {
    return false;
  }

  return crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    bufKaynak(b64urlDecode(sigB64)),
    bufKaynak(signingInput),
  );
}

/**
 * RFC 7638 JWK thumbprint (SHA-256) — anahtarın kararlı kimliği.
 * P-256 için kanonik alanlar: crv, kty, x, y (sıralı, boşluksuz).
 */
async function jwkThumbprint(jwk: JsonWebKey): Promise<string> {
  const kanonik = `{"crv":"${jwk.crv}","kty":"${jwk.kty}","x":"${jwk.x}","y":"${jwk.y}"}`;
  const digest = await crypto.subtle.digest("SHA-256", bufKaynak(utf8(kanonik)));
  return b64url(new Uint8Array(digest));
}

/**
 * GELİŞTİRME imzalayıcısı — production DEĞİLDİR.
 *
 * Anahtar bu süreçte, bellekte, geçici olarak üretilir. Production'da bunun
 * yerine KMS/HSM imzalayıcı gelir (private key dışarı çıkmaz, DB'ye/env'e
 * yazılmaz). Bu sınıf o soyutlamanın çalıştığını ve imza hattının uçtan uca
 * doğru olduğunu kanıtlar; ürettiği imza "bu geliştirme anahtarı imzaladı"
 * der — production authenticity'si DEĞİL. Doğrulama yüzeyi bunu açıkça söyler.
 *
 * NEDEN GEÇİCİ ANAHTAR SORUN DEĞİL: her imza, doğrulama için gereken public
 * JWK ile birlikte saklanır. private key kaybolsa bile doğrulama saklanan
 * public JWK'yı kullanır — gerçek KMS modeli de böyle çalışır.
 */
export class LocalDevSigner implements ManifestSigner {
  readonly ad = "local-dev-es256";
  private constructor(
    readonly kid: string,
    private readonly privateKey: CryptoKey,
    private readonly jwk: JsonWebKey,
  ) {}

  static async olustur(): Promise<LocalDevSigner> {
    const pair = await crypto.subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-256" },
      true,
      ["sign", "verify"],
    );
    const jwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
    const kid = `local-dev-${await jwkThumbprint(jwk)}`;
    return new LocalDevSigner(kid, pair.privateKey, jwk);
  }

  async sign(signingInput: Uint8Array): Promise<Uint8Array> {
    const sig = await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      this.privateKey,
      bufKaynak(signingInput),
    );
    return new Uint8Array(sig);
  }

  async publicKeyJwk(): Promise<JsonWebKey> {
    return this.jwk;
  }
}
