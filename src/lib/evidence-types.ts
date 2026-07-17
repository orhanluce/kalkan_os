import type { EvidenceTip } from "./types";

/**
 * Kanıtın gizlilik sınıfı ve saklama süresi — zarfın (M9) zorunlu alanları.
 *
 * NEDEN SEÇENEK LİSTESİ, NEDEN SERBEST METİN DEĞİL: bu alanlar denetimde
 * karşılaştırılacak; serbest metin olsaydı "Gizli"/"gizli"/"GİZLİ" üç ayrı
 * sınıf olurdu ve zarf hash'i de üçünü ayrı sayardı.
 *
 * İÇERİK UYDURULMADI: bunlar mevzuat maddesi değil, kurumun kendi
 * sınıflandırması — kurucu doğrulanmış bir sınıflandırma şeması verdiğinde
 * genişletilir (kural 3'ün konusu controls tablosudur, bu değil).
 */
export const KANIT_SINIFLARI = ["genel", "ic_kullanim", "gizli", "cok_gizli"] as const;
export type KanitSinifi = (typeof KANIT_SINIFLARI)[number];

export const SAKLAMA_SINIFLARI = ["1y", "5y", "10y", "surekli"] as const;
export type SaklamaSinifi = (typeof SAKLAMA_SINIFLARI)[number];

export interface Evidence {
  id: string;
  controlId: string;
  tip: EvidenceTip;
  storagePathOrLink: string;
  hashSha256: string | null;
  gecerlilikBitis: string | null;
  createdAt: string;
  /** Zarf (M9): dosyanın MIME tipi ve boyutu. Dosya olmayan kanıtta null. */
  mimeType: string | null;
  fileSize: number | null;
  /**
   * Storage'daki nesne anahtarı (M11): `{tenant_id}/{sha256}`. İndirme bunun
   * üzerinden imzalı URL ile yapılır. Dosya olmayan veya Storage'a yüklenmeden
   * önce (legacy) yazılmış kanıtta null.
   */
  storageObjectKey: string | null;
  /** Zarf (M9): kanıtın gizlilik sınıfı ve saklama süresi. */
  classification: KanitSinifi;
  retentionClass: SaklamaSinifi;
  /**
   * Zarf (M9): kanıtın ÜRETİLDİĞİ an (yüklendiği değil).
   *
   * Ayrım denetimde önemli: 2024'te alınmış bir sızma testi raporunu bugün
   * yüklemek, raporu bugün üretilmiş yapmaz. Kullanıcı bilmiyorsa null —
   * uydurulmuş bir tarih, olmayan bir güncelliği iddia ederdi.
   */
  capturedAt: string | null;
  /** "Bir kanıt, dört çerçeve": bu kanıt başka bir kontrole yüklenip
   * eşdeğerlik üzerinden buraya otomatik yansıtıldıysa kaynak kontrolün id'si. */
  kaynakKontrolId: string | null;
}
