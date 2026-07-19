// PrivacyOps saf yardımcıları (M36, G6; kural 11: deterministik, `simdi`
// parametre). Süre saatleri (DSAR/ihlal) SAKLANMAZ — türetilir; gerçek-zamanlı
// alarm (M05 incident clock ilkesi). Veri minimizasyonu için maskeleme.

import { canonicalHash, type CanonicalDeger } from "./canonical";
import { makbuzDogrula, type MakbuzSonucu, type SeffaflikMakbuzu } from "./transparency";

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
//
// ASENKRON MÜHÜR (nihai talimat v3.2 §8.0): domain satırı (manifest + hash)
// ile ledger mühürü artık AYRI adımlardır — biri transactional-outbox'a
// (ledger_outbox), diğeri drenaja (ledger-outbox.ts) aittir. Paket zarfı bu
// yüzden `durum` taşır (PENDING/ANCHORED/FAILED) ve `makbuz` yalnız ANCHORED
// olunca dolar — mühür gecikirse zarf SAHTE "mühürlü" GÖRÜNMEZ.

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

/** Defter mührü durumu — artifact_ledger_durumu() ile birebir. */
export type DsarLedgerDurumu = "PENDING" | "ANCHORED" | "FAILED" | "KAYITSIZ";

export interface DsarKanitZarfi {
  schema: typeof DSAR_PACKAGE_SCHEMA;
  manifest: DsarManifest;
  manifestHash: string;
  durum: DsarLedgerDurumu;
  /** Yalnız durum === 'ANCHORED' iken dolu (G3 kapsama makbuzu, transparency.ts). */
  makbuz: SeffaflikMakbuzu | null;
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
 * DSAR kanıt zarfını ÇEVRİMDIŞI doğrular (DB/ağ yok): (1) manifest hash'i
 * içerikten yeniden hesaplanır; (2) durum ANCHORED değilse dürüstçe "henüz
 * mühürlenmedi" denir — bu bir KURCALAMA değil, bir BEKLEME durumudur, ayrı
 * raporlanır; (3) ANCHORED ise makbuzun statementHash'i manifest hash'ine
 * BAĞLI mı ve doğru KIND'i taşıyor mu bakılır, ardından Merkle/STH/imza
 * doğrulaması (makbuzDogrula, G3'ten YENİDEN KULLANILIR) devralır.
 */
export async function dsarPaketiDogrula(p: DsarKanitZarfi): Promise<MakbuzSonucu> {
  const k: MakbuzSonucu["kontroller"] = [];

  const semaOk = p.schema === DSAR_PACKAGE_SCHEMA && p.manifest?.schema === DSAR_FULFILLMENT_SCHEMA;
  k.push({
    ad: "Paket şeması",
    gecti: semaOk,
    aciklama: semaOk ? "Beklenen DSAR paket/manifest şeması." : "Şema beklenenden farklı.",
  });

  const hashOk = semaOk && (await dsarManifestHash(p.manifest)) === p.manifestHash;
  k.push({
    ad: "Manifest ↔ hash tutarlılığı",
    gecti: hashOk,
    aciklama: hashOk ? "Manifest hash'i içerikten birebir üretiliyor." : "Manifest hash'i içerikle uyuşmuyor.",
  });

  if (p.durum !== "ANCHORED" || !p.makbuz) {
    k.push({
      ad: "Defter mührü",
      gecti: false,
      aciklama: `Henüz mühürlenmedi (durum: ${p.durum}) — kapsama doğrulanamaz. Bu bir kurcalama değil, bekleme durumudur; daha sonra tekrar deneyin.`,
    });
    return { gecerli: false, kontroller: k };
  }

  const kindOk = p.makbuz.signedStatement.kind === DSAR_FULFILLMENT_KIND;
  k.push({
    ad: "İfade türü DSAR_FULFILLMENT",
    gecti: kindOk,
    aciklama: kindOk ? "İmzalı ifade bir DSAR karşılanmasını mühürlüyor." : "İfade türü beklenenden farklı.",
  });

  const bagOk = p.makbuz.signedStatement.statementHash === p.manifestHash;
  k.push({
    ad: "İfade ↔ manifest bağı",
    gecti: bagOk,
    aciklama: bagOk ? "İmzalı ifade tam bu manifesti işaret ediyor." : "İmzalı ifade başka bir özeti işaret ediyor.",
  });

  const makbuzSonuc = await makbuzDogrula(p.makbuz);
  k.push(...makbuzSonuc.kontroller);

  return { gecerli: hashOk && kindOk && bagOk && makbuzSonuc.gecerli, kontroller: k };
}
