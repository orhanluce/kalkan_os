// RFC 3161 zaman damgası (TSA) adaptör arayüzü (docs/ROADMAP.md ADR-M11-02/03,
// nihai talimat §8 Gate G3).
//
// NE İSPATLAR: nitelikli bir TSA "bu özet ŞU TAKVİM ANINDA vardı" der —
// bağımsız, üçüncü taraf duvar-saati tanıklığı. Şeffaflık defteri
// (transparency.ts) SIRA ve DEĞİŞMEZLİK verir; TSA ZAMAN verir. İkisi ayrı
// güvencedir ve biri diğerinin yerine geçmez.
//
// NE İSPATLAMAZ (yerel stub): aşağıdaki LocalDevTimestampProvider zamanı BİZİM
// saatimizden alır — bağımsız DEĞİLDİR. LocalDevSigner ile aynı dürüstlük
// işareti: 'local-dev' etiketli token nitelikli zaman damgası SAYILMAZ ve
// durum türetimi (transparency_dogrulama_durumu) onu 'dis_zaman_damgali'ya
// YÜKSELTMEZ. Stub'ın tek işi adaptör hattının uçtan uca çalıştığını kanıtlamak.
//
// GERÇEK SAĞLAYICI (OPEN_DECISION #7): TR için TÜBİTAK Kamu SM, AB için EU
// Trusted List QTSP. Gerçek RFC 3161 DER/ASN.1 kodlaması + ağ çağrısı ALTYAPI
// işidir ve kurucu kararı bekler; arayüz o karar gelince yalnız bu dosyaya bir
// sınıf eklenmesini gerektirir (anchor.ts / manifest-signature.ts ile aynı ruh).

import {
  detachedJwsDogrula,
  detachedJwsImzala,
  LocalDevSigner,
  type DetachedImza,
  type ManifestSigner,
} from "./manifest-signature";

const HEX64 = /^[0-9a-f]{64}$/;

/** Yerel damga imzasının kanonik şeması (nitelikli TSA'nın DER token'ı değil). */
export const LOCAL_TSA_SCHEMA = "KALKAN_LOCAL_TSA_V1" as const;

export interface ZamanDamgasiToken {
  /** Sağlayıcı adı; 'local-dev' ile başlarsa nitelikli DEĞİLDİR. */
  saglayici: string;
  /** Damgalanan özet (64 hex). */
  digest: string;
  /** ISO 8601 zaman iddiası. Yerelde bizim saatimiz; nitelikli TSA'da bağımsız. */
  zaman: string;
  /** Sağlayıcıya özgü kanıt: RFC 3161'de DER TimeStampToken; yerelde JWS imza. */
  payload: Record<string, unknown>;
}

export interface DamgaSonucu {
  gecerli: boolean;
  aciklama: string;
  /** Token nitelikli bir TSA'dan mı geldi (dürüstlük işareti). */
  nitelikli: boolean;
}

export interface TimestampProvider {
  readonly ad: string;
  /** Nitelikli TSA mı — durum türetimi buna bakar, token'ın adına da yansır. */
  readonly nitelikli: boolean;
  timestamp(digest: string): Promise<ZamanDamgasiToken>;
  verify(digest: string, token: ZamanDamgasiToken): Promise<DamgaSonucu>;
  health(): Promise<{ saglikli: boolean; aciklama: string }>;
}

/**
 * Bir token nitelikli TSA'dan mı? Tek DÜRÜSTLÜK kapısı: 'local-dev' ile
 * başlayan sağlayıcı hiçbir zaman nitelikli sayılmaz. Durum türetimi ve
 * makbuz üretimi bunu kullanır; başka yerde "nitelikli mi" tahmini yapılmaz.
 */
export function nitelikliMi(token: ZamanDamgasiToken): boolean {
  return !token.saglayici.startsWith("local-dev");
}

/**
 * GELİŞTİRME TSA'sı — production DEĞİLDİR.
 *
 * Zamanı bu sürecin saatinden alır ve bir ES256 anahtarıyla imzalar. "Bu özet
 * bu zamanda imzalandı" der; ama zamanı bağımsız bir tanık değil biz verdiğimiz
 * için nitelikli zaman damgası SAYILMAZ. publicJwk token içinde taşındığı için
 * doğrulama durumsuzdur (LocalDevSigner ile aynı model) — başka bir instance
 * bile token'ı doğrulayabilir.
 */
export class LocalDevTimestampProvider implements TimestampProvider {
  readonly ad = "local-dev-tsa";
  readonly nitelikli = false;

  private constructor(
    private readonly signer: ManifestSigner,
    private readonly saatFn: () => Date,
  ) {}

  static async olustur(saatFn: () => Date = () => new Date()): Promise<LocalDevTimestampProvider> {
    return new LocalDevTimestampProvider(await LocalDevSigner.olustur(), saatFn);
  }

  async timestamp(digest: string): Promise<ZamanDamgasiToken> {
    if (!HEX64.test(digest)) {
      throw new Error(`Damga icin gecersiz ozet (64 hex bekleniyor): ${digest.slice(0, 12)}...`);
    }
    const zaman = this.saatFn().toISOString();
    const imza = await detachedJwsImzala({ digest, schema: LOCAL_TSA_SCHEMA, zaman }, this.signer);
    return {
      saglayici: this.ad,
      digest,
      zaman,
      payload: {
        imza: { jws: imza.jws, kid: imza.kid, publicJwk: imza.publicJwk },
        // Token'ı okuyan herkes bunun bağımsız zaman kanıtı OLMADIĞINI görebilmeli.
        uyari: "Yerel gelistirme damgasi: nitelikli TSA degildir, zaman bagimsiz kanit tasimaz.",
      },
    };
  }

  async verify(digest: string, token: ZamanDamgasiToken): Promise<DamgaSonucu> {
    if (token.saglayici !== this.ad) {
      return { gecerli: false, aciklama: `Token baska saglayiciya ait: ${token.saglayici}`, nitelikli: false };
    }
    if (token.digest !== digest) {
      return { gecerli: false, aciklama: "Token'daki ozet dogrulanan ozetle uyusmuyor", nitelikli: false };
    }
    const imza = token.payload.imza as DetachedImza | undefined;
    if (!imza?.jws) {
      return { gecerli: false, aciklama: "Token imza tasimiyor", nitelikli: false };
    }
    const ok = await detachedJwsDogrula(
      { digest: token.digest, schema: LOCAL_TSA_SCHEMA, zaman: token.zaman },
      imza,
    );
    return {
      gecerli: ok,
      aciklama: ok ? "Yerel damga imzasi dogrulandi" : "Yerel damga imzasi tutmadi",
      nitelikli: false,
    };
  }

  async health(): Promise<{ saglikli: boolean; aciklama: string }> {
    return {
      saglikli: true,
      aciklama: "Yerel TSA stub calisiyor. Uretim icin nitelikli TSA (Kamu SM/QTSP) gerekir.",
    };
  }
}
