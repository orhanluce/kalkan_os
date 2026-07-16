// Kanıt sabitleme (anchor) sağlayıcı arayüzü (docs/ROADMAP.md M5.5,
// şartname §2.2.2).
//
// NEDEN ARAYÜZ: sabitlemenin NEREYE yapıldığı (yerel defter, RFC 3161 zaman
// damgası sunucusu, ileride izinli DLT) bir kurulum kararıdır; ürünün geri
// kalanı buna bağlanmamalıdır. Şartname §9'un kararı net: MVP blockchain
// üzerine kurulmaz, çünkü aynı kayda yazan üç bağımsız kurum henüz yok.
// Arayüz, o karar değişirse ürünün tamamının değil yalnızca bir sınıfın
// değişmesini sağlar (CLAUDE.md kural 4 ile aynı ruh: taşınabilir kal).
//
// GÜVEN SINIRI — DÜRÜSTÇE: bir anchor, kökün BELİRLİ BİR ANDA var olduğunu
// kanıtlar; kanıtın İÇERİĞİNİN doğru olduğunu KANITLAMAZ. Yanlış veri de
// pekâlâ geçerli şekilde hash'lenip sabitlenebilir (şartname §2.3'ün açık
// kabulü). Sabitleme, "bu belge doğru" değil "bu belge o tarihten beri
// değişmedi" demektir.

import { merkleRootHex } from "./merkle";

export type AnchorSonuc = "VERIFIED" | "FAILED" | "PENDING";

export interface AnchorMetadata {
  tenantId: string;
  /** Partideki yaprak sayısı — makbuzun neyi kapsadığı makbuzdan okunabilmeli. */
  yaprakSayisi: number;
}

export interface AnchorReceipt {
  /** Makbuzu üreten sağlayıcının adı; doğrulama buna göre yönlendirilir. */
  saglayici: string;
  batchRoot: string;
  anchoredAt: string;
  /** Sağlayıcıya özgü kanıt (RFC 3161'de DER makbuz, yerelde defter kaydı). */
  payload: Record<string, unknown>;
}

export interface VerificationResult {
  sonuc: AnchorSonuc;
  aciklama: string;
}

export interface ProviderHealth {
  saglikli: boolean;
  aciklama: string;
}

export interface EvidenceAnchorProvider {
  readonly ad: string;
  anchor(batchRoot: string, metadata: AnchorMetadata): Promise<AnchorReceipt>;
  verify(batchRoot: string, receipt: AnchorReceipt): Promise<VerificationResult>;
  health(): Promise<ProviderHealth>;
}

/**
 * Kanıt ZARFI hash'lerinden (bkz. evidence-envelope.ts) parti kökü üretir.
 *
 * Yapraklar dosya hash'leri değil zarf hash'leridir (şartname §9.2): dosya
 * hash'ini sabitlemek yalnızca "bu bayt dizisi vardı" der, zarfı sabitlemek
 * "bu dosya şu kaynaktan, şu tarihte, şu kontrol için sunulmuştu" der.
 *
 * Yaprak sırası DETERMİNİSTİK olmalıdır (§9.2) — aynı kanıt kümesi her zaman
 * aynı kökü vermeli, yoksa yeniden üretilen proof'lar tutmaz. Sıralama
 * çağırana bırakılmaz, burada yapılır: hash'e göre artan. Yükleme zamanına
 * göre sıralamak cazip ama kırılgandır — aynı milisaniyede eklenen iki
 * kanıtın sırası veritabanı planına kalırdı.
 */
export async function batchRootFromHashes(envelopeHashes: string[]): Promise<string> {
  return merkleRootHex([...envelopeHashes].sort());
}

/**
 * Yerel, uygulama-içi sabitleme. Yalnızca GELİŞTİRME ve TEST içindir
 * (şartname §2.2.2, ilk sağlayıcı).
 *
 * NE KANITLAR, NE KANITLAMAZ: bu sağlayıcı kökü kendi sürecinde saklar ve
 * kendi kaydına karşı doğrular — yani sistem kendi kendini onaylar. Kazara
 * bozulmayı ve yanlış kök eşleşmesini yakalar; sisteme erişebilen bir
 * saldırgana karşı HİÇBİR ŞEY kanıtlamaz, çünkü saldırgan defteri de
 * makbuzu da yeniden yazabilir. Bağımsız güven ancak üçüncü taraf bir
 * sağlayıcıyla (Rfc3161TimestampAnchorProvider) gelir; üretimde bu sınıf
 * kullanılmamalıdır.
 */
export class LocalAppendOnlyAnchorProvider implements EvidenceAnchorProvider {
  readonly ad = "local-append-only";

  /** Sabitlenmiş kökler: root -> anchoredAt. Süreç belleğinde. */
  private readonly defter = new Map<string, string>();

  constructor(private readonly saatFn: () => Date = () => new Date()) {}

  async anchor(batchRoot: string, metadata: AnchorMetadata): Promise<AnchorReceipt> {
    const anchoredAt = this.saatFn().toISOString();

    // Append-only: bir kök yeniden sabitlenirse İLK zaman korunur. Üzerine
    // yazmak, sabitlemenin tek işini (o an oradaydı) geçersiz kılardı.
    const mevcut = this.defter.get(batchRoot);
    const kesinlesenZaman = mevcut ?? anchoredAt;
    if (!mevcut) this.defter.set(batchRoot, anchoredAt);

    return {
      saglayici: this.ad,
      batchRoot,
      anchoredAt: kesinlesenZaman,
      payload: {
        tenantId: metadata.tenantId,
        yaprakSayisi: metadata.yaprakSayisi,
        // Makbuzu okuyan herkes bunun bağımsız bir kanıt OLMADIĞINI
        // makbuzun kendisinden görebilmeli.
        uyari: "Yerel saglayici: bagimsiz kanit degildir, yalnizca gelistirme/test icindir.",
      },
    };
  }

  async verify(batchRoot: string, receipt: AnchorReceipt): Promise<VerificationResult> {
    if (receipt.saglayici !== this.ad) {
      return {
        sonuc: "FAILED",
        aciklama: `Makbuz baska bir saglayiciya ait: ${receipt.saglayici}`,
      };
    }
    // Makbuzun kökü ile doğrulanan kök ayrı parametreler: uyuşmazlıkları
    // sessizce geçmek yerine açıkça reddet.
    if (receipt.batchRoot !== batchRoot) {
      return { sonuc: "FAILED", aciklama: "Makbuzdaki kok, dogrulanan kok ile uyusmuyor" };
    }

    const kayitliZaman = this.defter.get(batchRoot);
    if (!kayitliZaman) {
      // Kök hiç sabitlenmemiş VEYA defter kaybolmuş. İkisi ayırt edilemez —
      // bu da yerel sağlayıcının neden bağımsız kanıt olmadığının bir yüzü.
      return { sonuc: "FAILED", aciklama: "Kok yerel defterde bulunamadi" };
    }
    if (kayitliZaman !== receipt.anchoredAt) {
      return { sonuc: "FAILED", aciklama: "Makbuzdaki sabitleme zamani defterle uyusmuyor" };
    }

    return { sonuc: "VERIFIED", aciklama: "Kok yerel defterde dogrulandi" };
  }

  async health(): Promise<ProviderHealth> {
    return {
      saglikli: true,
      aciklama: `Yerel defter calisiyor (${this.defter.size} kok). Uretim icin uygun degildir.`,
    };
  }
}
