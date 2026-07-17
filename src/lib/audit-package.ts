// Denetim paketi — üretim ve BAĞIMSIZ doğrulama (docs/ROADMAP.md M9 adım 12, M11).
//
// NE İŞE YARAR: denetçiye verilen ZIP'in içeriğini ve doğrulama mantığını tek
// yerde tanımlar. Paketin tüm değeri şudur: denetçi, KALKAN_OS'a ULAŞMADAN,
// yalnız elindeki dosyalarla bütünlüğü ve imzayı doğrulayabilir. Bu modül hem
// paketi üretir hem de o doğrulamanın mantığını saf bir fonksiyon olarak sunar
// — CLI (scripts/verify-paket.ts) yalnızca dosyaları okuyup buraya verir.
//
// NEDEN SAF JS VE DIŞ BAĞIMLILIKSIZ: verify CLI "temiz bir Node ortamında, repo
// DIŞINDA" koşabilmeli (belge M01 kabul kriteri). canonical.ts ve
// manifest-signature.ts zaten runtime bağımlılığı taşımıyor (canonicalize
// çıkarıldı, §1.5); bu modül de öyle. Denetçinin güvenmesi gereken kod yüzeyi
// ne kadar küçükse doğrulama o kadar inandırıcı.

import { bytesHash, canonicalHash, canonicalJson, type CanonicalDeger } from "./canonical";
import { detachedJwsDogrula, type DetachedImza } from "./manifest-signature";
import { packageManifestOlustur, type CoreManifest, type ReportData } from "./simulation-manifest";

/** Paketteki bir dosya. */
export interface PaketDosya {
  ad: string;
  icerik: Uint8Array;
}

/** Paketin sabit dosya adları — üretim ve doğrulama aynı adları kullanmalı. */
export const PAKET_DOSYALARI = {
  cekirdek: "core-manifest.json",
  rapor: "report-data.json",
  imza: "signature.json",
  pdf: "rapor.pdf",
  paketManifesti: "package-manifest.json",
  paketHash: "package-manifest.sha256",
  benioku: "BENIOKU.txt",
} as const;

export interface PaketGirdisi {
  coreManifest: CoreManifest;
  coreManifestHash: string;
  reportData: ReportData;
  imza: DetachedImza | null;
  signerAd: string | null;
  pdf: Uint8Array;
}

function jsonBytes(deger: CanonicalDeger): Uint8Array {
  // KANONİK baytlar yazılır: doğrulayıcı yeniden kanonikleştirdiğinde aynı
  // sonucu alsın. Pretty-print de doğrulanabilirdi (parse+canonicalize) ama
  // kanonik yazmak paketi deterministik kılar — aynı sonuç aynı ZIP.
  return new TextEncoder().encode(canonicalJson(deger));
}

const BENIOKU = `KALKAN-OS DENETIM PAKETI
========================

Bu paket bir tatbikat sonucunun DEGISMEZ kaydidir. Icerigi KALKAN-OS'a
ulasmadan, yalniz bu dosyalarla dogrulayabilirsiniz.

DOGRULAMA (repo disinda, temiz bir Node ortaminda):

  1. Bu ZIP'i bir klasore acin.
  2. KALKAN-OS deposundan verify betigini alin:
       npx tsx scripts/verify-paket.ts <klasor-yolu>
  3. Cikti VERIFIED ise: rapor verisi, cekirdek manifest, PDF ve (varsa)
     imza muhurlendigi andan beri degismemistir.

NE DOGRULANIR:
  - report-data.json'un hash'i, cekirdek manifestteki reportDataHash ile ayni mi
  - core-manifest.json'un hash'i, package-manifest.json'daki deger ile ayni mi
  - rapor.pdf'in bayt hash'i, package-manifest.json'daki deger ile ayni mi
  - signature.json'daki JWS, saklanan public anahtarla cekirdek manifesti
    dogruluyor mu (imza varsa)

NE DOGRULANMAZ:
  - Icerigin DOGRU oldugu. Dogrulama "degismedi" der, "dogru" demez.
  - Imza local-dev-* ise: production authenticity'si tasimaz, nitelikli
    elektronik imza yerine gecmez (yalnizca hattin butunlugunu gosterir).
`;

/**
 * Denetim paketinin dosyalarını üretir.
 *
 * package-manifest.json, KENDİ hash'ini İÇERMEZ (bir dosya kendi hash'ini
 * içeremez): diğer dosyaların hash'lerini + coreManifestHash'i tutar. Kendi
 * hash'i (packageManifestHash) ayrı bir dosyada (package-manifest.sha256) ve
 * anchor/audit zincirine yazılmak üzere döndürülür.
 */
export async function paketOlustur(
  girdi: PaketGirdisi,
): Promise<{ dosyalar: PaketDosya[]; packageManifestHash: string }> {
  const cekirdekBytes = jsonBytes(girdi.coreManifest as unknown as CanonicalDeger);
  const raporBytes = jsonBytes(girdi.reportData as unknown as CanonicalDeger);
  const imzaBytes = girdi.imza
    ? new TextEncoder().encode(
        canonicalJson({
          jws: girdi.imza.jws,
          kid: girdi.imza.kid,
          publicJwk: girdi.imza.publicJwk as unknown as CanonicalDeger,
          signerAd: girdi.signerAd,
        }),
      )
    : null;

  // package-manifest'e giren dosya listesi: içeriği hash'lenen her dosya.
  // package-manifest.json ve .sha256 ve BENIOKU listeye GİRMEZ — biri kendini,
  // ikisi de doğrulama dışı yardımcılar.
  const hashlananlar: { ad: string; icerik: Uint8Array }[] = [
    { ad: PAKET_DOSYALARI.cekirdek, icerik: cekirdekBytes },
    { ad: PAKET_DOSYALARI.rapor, icerik: raporBytes },
    { ad: PAKET_DOSYALARI.pdf, icerik: girdi.pdf },
  ];
  if (imzaBytes) hashlananlar.push({ ad: PAKET_DOSYALARI.imza, icerik: imzaBytes });

  const dosyaHashleri = await Promise.all(
    hashlananlar.map(async (d) => ({
      ad: d.ad,
      hash: await bytesHash(d.icerik),
      bayt: d.icerik.byteLength,
    })),
  );

  const { packageManifest, hash } = await packageManifestOlustur({
    coreManifestHash: girdi.coreManifestHash,
    dosyalar: dosyaHashleri,
  });

  const paketManifestBytes = jsonBytes(packageManifest as unknown as CanonicalDeger);

  const dosyalar: PaketDosya[] = [
    ...hashlananlar,
    { ad: PAKET_DOSYALARI.paketManifesti, icerik: paketManifestBytes },
    { ad: PAKET_DOSYALARI.paketHash, icerik: new TextEncoder().encode(hash) },
    { ad: PAKET_DOSYALARI.benioku, icerik: new TextEncoder().encode(BENIOKU) },
  ];

  return { dosyalar, packageManifestHash: hash };
}

export type KontrolSonuc = "gecti" | "kaldi" | "yok";

export interface PaketKontrolu {
  ad: string;
  sonuc: KontrolSonuc;
  aciklama: string;
}

export interface PaketDogrulamaSonucu {
  genel: "VERIFIED" | "FAILED" | "PARTIAL";
  kontroller: PaketKontrolu[];
}

function k(ad: string, sonuc: KontrolSonuc, aciklama: string): PaketKontrolu {
  return { ad, sonuc, aciklama };
}

function parseJson(dosyalar: Map<string, Uint8Array>, ad: string): unknown {
  const bytes = dosyalar.get(ad);
  if (!bytes) throw new Error(`eksik: ${ad}`);
  return JSON.parse(new TextDecoder().decode(bytes));
}

/**
 * Paketi BAĞIMSIZ doğrular — CLI'nin çekirdeği.
 *
 * Girdi: dosya adı -> ham baytlar (CLI diskten okur). Hiçbir DB sorgusu yok;
 * doğrulama yalnız pakete bakar. Bir "kaldi" tüm sonucu FAILED yapar
 * (verification.ts ile aynı ilke: bütünlükte çoğunluk oyu yoktur).
 */
export async function paketiDogrula(
  dosyalar: Map<string, Uint8Array>,
): Promise<PaketDogrulamaSonucu> {
  const kontroller: PaketKontrolu[] = [];

  type PaketManifesti = { coreManifestHash?: string; dosyalar?: { ad: string; hash: string }[] };
  let cekirdek: CoreManifest | null = null;
  let paketManifesti: PaketManifesti | null = null;

  // 1) Rapor verisi hash'i çekirdekteki reportDataHash ile eşleşmeli.
  try {
    const rapor = parseJson(dosyalar, PAKET_DOSYALARI.rapor) as CanonicalDeger;
    cekirdek = parseJson(dosyalar, PAKET_DOSYALARI.cekirdek) as CoreManifest;
    const hesap = await canonicalHash(rapor);
    kontroller.push(
      hesap === cekirdek.reportDataHash
        ? k("Rapor verisi hash", "gecti", "report-data.json, çekirdekteki reportDataHash ile eşleşiyor.")
        : k("Rapor verisi hash", "kaldi", "report-data.json HASH'İ UYUŞMUYOR: rapor verisi değiştirilmiş."),
    );
  } catch (e) {
    kontroller.push(k("Rapor verisi hash", "kaldi", `Okunamadı: ${(e as Error).message}`));
  }

  // 2) Çekirdek manifest hash'i package-manifest'teki değerle eşleşmeli.
  try {
    paketManifesti = parseJson(dosyalar, PAKET_DOSYALARI.paketManifesti) as PaketManifesti;
    if (cekirdek && paketManifesti) {
      const hesap = await canonicalHash(cekirdek as unknown as CanonicalDeger);
      kontroller.push(
        hesap === paketManifesti.coreManifestHash
          ? k("Çekirdek manifest hash", "gecti", "core-manifest.json, package-manifest'teki hash ile eşleşiyor.")
          : k("Çekirdek manifest hash", "kaldi", "core-manifest.json HASH'İ UYUŞMUYOR: çekirdek manifest değiştirilmiş."),
      );
    }
  } catch (e) {
    kontroller.push(k("Çekirdek manifest hash", "kaldi", `Okunamadı: ${(e as Error).message}`));
  }

  // 3) Listelenen her dosyanın bayt hash'i tutmalı (PDF dahil).
  if (paketManifesti?.dosyalar) {
    for (const d of paketManifesti.dosyalar) {
      const bytes = dosyalar.get(d.ad);
      if (!bytes) {
        kontroller.push(k(`Dosya: ${d.ad}`, "kaldi", "Pakette YOK ama manifestte listeli."));
        continue;
      }
      const hesap = await bytesHash(bytes);
      kontroller.push(
        hesap === d.hash
          ? k(`Dosya: ${d.ad}`, "gecti", "Bayt hash'i manifestteki değerle eşleşiyor.")
          : k(`Dosya: ${d.ad}`, "kaldi", "BAYT HASH'İ UYUŞMUYOR: dosya değiştirilmiş."),
      );
    }
  }

  // 4) İmza (varsa) çekirdek manifesti doğrulamalı.
  const imzaBytes = dosyalar.get(PAKET_DOSYALARI.imza);
  if (!imzaBytes) {
    kontroller.push(k("İmza (JWS)", "yok", "Pakette imza yok (imzasız/eski manifest)."));
  } else if (cekirdek) {
    try {
      const imzaObj = JSON.parse(new TextDecoder().decode(imzaBytes)) as {
        jws: string;
        kid: string;
        publicJwk: JsonWebKey;
        signerAd?: string | null;
      };
      const gecerli = await detachedJwsDogrula(cekirdek as unknown as CanonicalDeger, {
        jws: imzaObj.jws,
        kid: imzaObj.kid,
        publicJwk: imzaObj.publicJwk,
      });
      const devNot =
        imzaObj.signerAd && imzaObj.signerAd.startsWith("local-dev")
          ? " (GELİŞTİRME anahtarı — production authenticity'si değil)"
          : "";
      kontroller.push(
        gecerli
          ? k("İmza (JWS)", "gecti", `Çekirdek manifest imzası geçerli${devNot}.`)
          : k("İmza (JWS)", "kaldi", "İMZA GEÇERSİZ: manifest imzadan sonra değişmiş veya anahtar uyuşmuyor."),
      );
    } catch (e) {
      kontroller.push(k("İmza (JWS)", "kaldi", `İmza okunamadı: ${(e as Error).message}`));
    }
  }

  const genel = kontroller.some((x) => x.sonuc === "kaldi")
    ? "FAILED"
    : kontroller.some((x) => x.sonuc === "yok")
      ? "PARTIAL"
      : "VERIFIED";

  return { genel, kontroller };
}
