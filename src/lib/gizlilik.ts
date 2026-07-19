// PrivacyOps saf yardımcıları (M36, G6; kural 11: deterministik, `simdi`
// parametre). Süre saatleri (DSAR/ihlal) SAKLANMAZ — türetilir; gerçek-zamanlı
// alarm (M05 incident clock ilkesi). Veri minimizasyonu için maskeleme.

import { canonicalHash, type CanonicalDeger } from "./canonical";
import { imzaliIfadeDogrula, type MakbuzSonucu, type SignedStatement } from "./transparency";

const SAAT_MS = 60 * 60 * 1000;
const GUN_MS = 24 * SAAT_MS;

/** KVKK ihlal → otorite bildirimi: tespit + 72 saat (varsayılan). */
export const IHLAL_OTORITE_SAAT = 72;

export interface SureSaati {
  sonTarih: string; // ISO
  kalanSaat: number;
  gecikti: boolean;
  mesaj: string;
}

/** DSAR yasal süre saati: alındı + yasal_sure_gun. */
export function dsarSonTarih(
  alindiAt: string,
  yasalSureGun: number,
  simdi: string | Date,
): SureSaati {
  const sonMs = new Date(alindiAt).getTime() + yasalSureGun * GUN_MS;
  const simdiMs = typeof simdi === "string" ? new Date(simdi).getTime() : simdi.getTime();
  const kalanSaat = Math.floor((sonMs - simdiMs) / SAAT_MS);
  const gecikti = kalanSaat < 0;
  const kalanGun = Math.floor(kalanSaat / 24);
  return {
    sonTarih: new Date(sonMs).toISOString(),
    kalanSaat,
    gecikti,
    mesaj: gecikti
      ? `Süre ${Math.abs(kalanGun)} gün aşıldı`
      : `Kalan: ${kalanGun} gün`,
  };
}

/** İhlal otorite bildirim saati: tespit + IHLAL_OTORITE_SAAT saat. */
export function ihlalBildirimSaati(
  tespitAt: string,
  simdi: string | Date,
  bildirildiAt: string | null = null,
  esikSaat: number = IHLAL_OTORITE_SAAT,
): SureSaati {
  const sonMs = new Date(tespitAt).getTime() + esikSaat * SAAT_MS;
  const referansMs = bildirildiAt
    ? new Date(bildirildiAt).getTime()
    : typeof simdi === "string"
      ? new Date(simdi).getTime()
      : simdi.getTime();
  const kalanSaat = Math.floor((sonMs - referansMs) / SAAT_MS);
  const gecikti = kalanSaat < 0;
  return {
    sonTarih: new Date(sonMs).toISOString(),
    kalanSaat,
    gecikti,
    mesaj: bildirildiAt
      ? gecikti
        ? `Bildirim ${Math.abs(kalanSaat)} saat GEÇ yapıldı`
        : "Süresinde bildirildi"
      : gecikti
        ? `Otorite bildirimi ${Math.abs(kalanSaat)} saat gecikti`
        : `Otorite bildirimine ${kalanSaat} saat`,
  };
}

/**
 * Veri sahibi tanımlayıcısını maskeler (veri minimizasyonu). E-posta:
 * ilk karakter + *** + domain; diğer: ilk 2 + *** + son 2.
 */
export function maskele(deger: string): string {
  const s = deger.trim();
  if (s.includes("@")) {
    const [yerel, domain] = s.split("@");
    const bas = yerel.slice(0, 1);
    return `${bas}***@${domain}`;
  }
  if (s.length <= 4) return "***";
  return `${s.slice(0, 2)}***${s.slice(-2)}`;
}

// --- DSAR karşılanma kanıt paketi (M36 sonraki dilim, G3 defterine bağlı) ---
//
// NE İSPATLAR: bir DSAR'ın NE ZAMAN karşılandığını ve HANGİ veri kategorilerinin
// açıklandığını mühürler; kanonik manifest ES256 ile imzalanıp şeffaflık
// defterine yazılır → değişmez + çevrimdışı doğrulanabilir kanıt.
//
// NE SAKLAMAZ (veri minimizasyonu): açıklanan VERİNİN KENDİSİ pakete girmez —
// yalnız kategori ETİKETLERİ + veri sahibinin sha256 HASH'i (ham kimlik değil).
// Paket "şunu şu tarihte karşıladık" der, açıklanan içeriği taşımaz.

export const DSAR_FULFILLMENT_SCHEMA = "KALKAN_DSAR_FULFILLMENT_V1" as const;
export const DSAR_PACKAGE_SCHEMA = "KALKAN_DSAR_PACKAGE_V1" as const;
export const DSAR_FULFILLMENT_KIND = "DSAR_FULFILLMENT" as const;

export interface DsarManifest {
  schema: typeof DSAR_FULFILLMENT_SCHEMA;
  dsarId: string;
  tur: string;
  veriSahibiHash: string | null;
  tamamlandiAt: string;
  aciklananKategoriler: string[];
}

export interface DsarKanitPaketi {
  schema: typeof DSAR_PACKAGE_SCHEMA;
  manifest: DsarManifest;
  manifestHash: string;
  signedStatement: SignedStatement;
  ledgerEntryId: string;
  leafIndex: number;
}

/** Kanonik manifest (deterministik alan sırası + sıralı kategoriler). */
function manifestKanonik(m: DsarManifest): CanonicalDeger {
  return {
    aciklananKategoriler: [...m.aciklananKategoriler].sort(),
    dsarId: m.dsarId,
    schema: DSAR_FULFILLMENT_SCHEMA,
    tamamlandiAt: m.tamamlandiAt,
    tur: m.tur,
    veriSahibiHash: m.veriSahibiHash,
  };
}

export function dsarManifestKur(args: {
  dsarId: string;
  tur: string;
  veriSahibiHash: string | null;
  tamamlandiAt: string;
  aciklananKategoriler: string[];
}): DsarManifest {
  return {
    schema: DSAR_FULFILLMENT_SCHEMA,
    dsarId: args.dsarId,
    tur: args.tur,
    veriSahibiHash: args.veriSahibiHash,
    tamamlandiAt: args.tamamlandiAt,
    aciklananKategoriler: [...args.aciklananKategoriler].sort(),
  };
}

/** Manifestin kanonik SHA-256'sı (statementHash olarak deftere yazılır). */
export function dsarManifestHash(m: DsarManifest): Promise<string> {
  return canonicalHash(manifestKanonik(m));
}

/**
 * DSAR kanıt paketini ÇEVRİMDIŞI doğrular (DB/ağ yok): manifest hash'i yeniden
 * hesaplanır, imzalı ifade doğrulanır ve ifadenin statementHash'i manifest
 * hash'ine BAĞLI mı bakılır. Denetçi paketle tek başına doğrulayabilir.
 */
export async function dsarPaketiDogrula(p: DsarKanitPaketi): Promise<MakbuzSonucu> {
  const k: MakbuzSonucu["kontroller"] = [];

  const semaOk = p.schema === DSAR_PACKAGE_SCHEMA && p.manifest?.schema === DSAR_FULFILLMENT_SCHEMA;
  k.push({
    ad: "Paket şeması",
    gecti: semaOk,
    aciklama: semaOk ? "Beklenen DSAR paket/manifest şeması." : "Şema beklenenden farklı.",
  });

  let hashOk = false;
  if (semaOk) {
    hashOk = (await dsarManifestHash(p.manifest)) === p.manifestHash;
  }
  k.push({
    ad: "Manifest ↔ hash tutarlılığı",
    gecti: hashOk,
    aciklama: hashOk ? "Manifest hash'i içerikten birebir üretiliyor." : "Manifest hash'i içerikle uyuşmuyor.",
  });

  const kindOk = p.signedStatement?.kind === DSAR_FULFILLMENT_KIND;
  k.push({
    ad: "İfade türü DSAR_FULFILLMENT",
    gecti: kindOk,
    aciklama: kindOk ? "İmzalı ifade bir DSAR karşılanmasını mühürlüyor." : "İfade türü beklenenden farklı.",
  });

  const bagOk = p.signedStatement?.statementHash === p.manifestHash;
  k.push({
    ad: "İfade ↔ manifest bağı",
    gecti: bagOk,
    aciklama: bagOk ? "İmzalı ifade tam bu manifesti işaret ediyor." : "İmzalı ifade başka bir özeti işaret ediyor.",
  });

  const imzaOk = semaOk ? await imzaliIfadeDogrula(p.signedStatement) : false;
  k.push({
    ad: "İmza geçerliliği",
    gecti: imzaOk,
    aciklama: imzaOk ? "Manifest özeti geçerli şekilde imzalı." : "İmza tutmadı.",
  });

  return { gecerli: k.every((x) => x.gecti), kontroller: k };
}
