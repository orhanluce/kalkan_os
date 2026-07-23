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

/**
 * FAZ 1 (Kanonik Kanıt): bu SATIRIN kendi control_id'si için kanıt tam mı
 * kısmi mi destek sağlıyor. `obligation_control_mappings.kapsam` ile aynı
 * sözlük — yeni bir şekil icat edilmedi.
 */
export const KANIT_KAPSAMLARI = ["tam", "kismi"] as const;
export type KanitKapsami = (typeof KANIT_KAPSAMLARI)[number];

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
  /** "Bir kanıt, dört çerçeve": bu satır başka bir kontrolden eşdeğerlik/
   * kısmi eşdeğerlik üzerinden yansıtıldıysa, yansıtıldığı ORİJİNAL
   * `evidences` satırının id'si. NULL = doğrudan yüklenmiş (orijinal). */
  kaynakKontrolId: string | null;
  /** Bu satırın kendi controlId'si için kanıt tam mı kısmi mi destek sağlıyor. */
  kapsam: KanitKapsami;
}
