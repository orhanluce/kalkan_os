import { describe, expect, it } from "vitest";
import type { CanonicalDeger } from "../canonical";
import {
  JWS_ALG,
  LocalDevSigner,
  detachedJwsDogrula,
  detachedJwsImzala,
} from "../manifest-signature";

const manifest: CanonicalDeger = {
  sema: "KALKAN_CORE_MANIFEST_V1",
  runId: "11111111-1111-1111-1111-111111111111",
  puan: 72,
  durum: "KISMI",
};

describe("detached JWS imzala/doğrula", () => {
  it("imzalanan manifest kendi imzasıyla doğrulanır", async () => {
    const signer = await LocalDevSigner.olustur();
    const imza = await detachedJwsImzala(manifest, signer);
    expect(await detachedJwsDogrula(manifest, imza)).toBe(true);
  });

  it("JWS detached biçiminde: payload segmenti BOŞ", async () => {
    // header..signature — ortada payload yok (manifest ayrıca saklanıyor).
    const signer = await LocalDevSigner.olustur();
    const { jws } = await detachedJwsImzala(manifest, signer);
    const parcalar = jws.split(".");
    expect(parcalar).toHaveLength(3);
    expect(parcalar[1]).toBe("");
  });

  it("header ES256 ve kid taşır", async () => {
    const signer = await LocalDevSigner.olustur();
    const { jws, kid } = await detachedJwsImzala(manifest, signer);
    const header = JSON.parse(
      Buffer.from(jws.split(".")[0].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(),
    );
    expect(header.alg).toBe(JWS_ALG);
    expect(header.kid).toBe(kid);
    expect(kid).toMatch(/^local-dev-/);
  });

  it("manifest tek alanı bile değişirse doğrulama BAŞARISIZ — imzanın varlık sebebi", async () => {
    const signer = await LocalDevSigner.olustur();
    const imza = await detachedJwsImzala(manifest, signer);
    const kurcalanmis = { ...manifest, puan: 100 };
    expect(await detachedJwsDogrula(kurcalanmis, imza)).toBe(false);
  });

  it("alan EKLEME SIRASI imzayı bozmaz — kanonikleştirme sayesinde", async () => {
    const signer = await LocalDevSigner.olustur();
    const imza = await detachedJwsImzala(manifest, signer);
    const tersSira: CanonicalDeger = {
      durum: "KISMI",
      puan: 72,
      runId: "11111111-1111-1111-1111-111111111111",
      sema: "KALKAN_CORE_MANIFEST_V1",
    };
    expect(await detachedJwsDogrula(tersSira, imza)).toBe(true);
  });

  it("BAŞKA anahtarın public JWK'sıyla doğrulama BAŞARISIZ", async () => {
    const signer = await LocalDevSigner.olustur();
    const baska = await LocalDevSigner.olustur();
    const imza = await detachedJwsImzala(manifest, signer);
    // İmza signer'ın, ama başkasının public key'iyle sınanıyor.
    const sahte = { ...imza, publicJwk: await baska.publicKeyJwk() };
    expect(await detachedJwsDogrula(manifest, sahte)).toBe(false);
  });

  it("signature bitleri değiştirilirse doğrulama BAŞARISIZ", async () => {
    const signer = await LocalDevSigner.olustur();
    const imza = await detachedJwsImzala(manifest, signer);
    const [h, , s] = imza.jws.split(".");
    // ORTADAKİ bir karakteri değiştir, sonuncuyu DEĞİL: 64 baytlık r||s'in
    // base64url'ünde son karakterin yalnız 2 biti anlamlı, kalan bitler
    // "umursanmaz" — sonuncuyu değiştirmek aynı baytları çözebilir ve imza
    // hiç değişmeyebilir. Ortadaki karakterin 6 biti de anlamlı, bayt değişimi
    // garanti.
    const orta = Math.floor(s.length / 2);
    const bozukChar = s[orta] === "A" ? "B" : "A";
    const bozukS = s.slice(0, orta) + bozukChar + s.slice(orta + 1);
    const bozuk = { ...imza, jws: `${h}..${bozukS}` };
    expect(await detachedJwsDogrula(manifest, bozuk)).toBe(false);
  });

  it("alg 'none'a çevrilirse REDDEDİLİR — imza atlatma kapalı", async () => {
    // JWS'in klasik zaafı: header'da alg:none diyip imzayı boş bırakmak.
    const signer = await LocalDevSigner.olustur();
    const imza = await detachedJwsImzala(manifest, signer);
    const noneHeader = Buffer.from(JSON.stringify({ alg: "none", kid: signer.kid }))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    const bozuk = { ...imza, jws: `${noneHeader}..` };
    expect(await detachedJwsDogrula(manifest, bozuk)).toBe(false);
  });

  it("bozuk JWS biçimi (yanlış segment sayısı) REDDEDİLİR", async () => {
    const signer = await LocalDevSigner.olustur();
    const imza = await detachedJwsImzala(manifest, signer);
    expect(await detachedJwsDogrula(manifest, { ...imza, jws: "tek-parca" })).toBe(false);
    expect(await detachedJwsDogrula(manifest, { ...imza, jws: "a.b.c.d" })).toBe(false);
  });

  it("deterministik değil ama doğrulanabilir — ECDSA imzası her seferinde farklı", async () => {
    // ECDSA nonce'lu: aynı veri iki farklı imza üretebilir; ikisi de geçerli.
    // Bu bir SORUN DEĞİL — determinizm mühürde (hash), imzada değil.
    const signer = await LocalDevSigner.olustur();
    const a = await detachedJwsImzala(manifest, signer);
    const b = await detachedJwsImzala(manifest, signer);
    expect(await detachedJwsDogrula(manifest, a)).toBe(true);
    expect(await detachedJwsDogrula(manifest, b)).toBe(true);
  });
});
