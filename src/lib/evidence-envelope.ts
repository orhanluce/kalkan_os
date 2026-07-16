// Kanıt zarfı (Evidence Envelope) — şartname §2.4, docs/ROADMAP.md M5.5.
//
// Zarf, kanıt DOSYASININ değil, kanıtın KİMLİĞİNİN kaydıdır: hangi dosya
// (sha256), nereden geldi, ne zaman yakalandı, kim yükledi, hangi kontrollere
// dayanıyor. Merkle ağacının hash'lediği yapraklar bu zarfların hash'leridir
// — dosyaların değil.
//
// NEDEN DOSYA DEĞİL DE ZARF: dosyanın hash'ini sabitlemek yalnızca "bu bayt
// dizisi vardı" der. Zarfı sabitlemek "bu dosya, şu kaynaktan, şu tarihte,
// şu kontrol için sunulmuştu" der. Denetimde kanıt değeri olan ikincisidir —
// bir sızma testi raporunun değişmediğini göstermek, onun HANGİ TARİHTE ve
// HANGİ kontrol için sunulduğunu göstermeden yarım kalır.

import { sha256Hex } from "./evidence";

/** Şartname §2.4'teki zarf yapısı. */
export interface EvidenceEnvelope {
  evidenceId: string;
  tenantId: string;
  version: number;
  sha256: string;
  sizeBytes: number;
  mimeType: string;
  sourceType: string;
  sourceSystem: string | null;
  capturedAt: string | null;
  uploadedAt: string;
  uploadedBy: string | null;
  retentionClass: string;
  classification: string;
  /** Önceki versiyonun ZARF hash'i — versiyon zincirini kurar. İlkinde null. */
  previousVersionHash: string | null;
  controlRefs: string[];
  legalHold: boolean;
}

type CanonicalDeger = string | number | boolean | null | CanonicalDeger[];

/**
 * Deterministik JSON temsili.
 *
 * NEDEN JSON.stringify YETMEZ: anahtar sırasını ekleme sırasına göre korur.
 * Aynı zarf, alanları farklı sırayla kurulmuş iki kod yolundan geçtiğinde
 * farklı metin — dolayısıyla farklı hash — üretirdi. O noktada "hash
 * eşleşmiyor" bulgusu kurcalamayı değil, nesnenin nasıl inşa edildiğini
 * gösterirdi ve tüm bütünlük iddiası anlamsızlaşırdı.
 *
 * SINIR — DÜRÜSTÇE: bu RFC 8785'in (JSON Canonicalization Scheme) tamamı
 * DEĞİLDİR. Anahtarları sıralar ve boşluk bırakmaz; RFC 8785'in kayan nokta
 * normalleştirmesi ve unicode escape kuralları uygulanmaz. Zarf alanları
 * yalnızca string, tam sayı, boolean, null ve string[] tiplerinde olduğu
 * için bu fark bugün ürüne yansımaz. Zarfa kayan nokta veya iç içe nesne
 * eklenecek olursa burası gerçek bir RFC 8785 implementasyonuyla
 * değiştirilmelidir.
 */
export function canonicalJson(value: CanonicalDeger | Record<string, CanonicalDeger>): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    // Dizi sırası ANLAMLIDIR ve korunur: controlRefs'in sırası çağıranın
    // verisidir, sıralamak veriyi değiştirmek olurdu.
    return `[${value.map((v) => canonicalJson(v)).join(",")}]`;
  }

  const keys = Object.keys(value).sort();
  const parts = keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`);
  return `{${parts.join(",")}}`;
}

/** Zarfın kanonik temsilinin SHA-256'sı. Merkle yaprağı budur. */
export async function envelopeHash(envelope: EvidenceEnvelope): Promise<string> {
  const canonical = canonicalJson(envelope as unknown as Record<string, CanonicalDeger>);
  return sha256Hex(new TextEncoder().encode(canonical).buffer as ArrayBuffer);
}
