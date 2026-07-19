// Denetim WORM export (M17 "sonraki dilim" son madde, ROADMAP §1.29). M11/M24
// desenindeki hash-bütünlüklü paket ilkesinin AYNISI (citation-bundle.ts) —
// yeni bir mühür mekanizması icat edilmedi. Farkı: burada mühürlenen tek bir
// koşu/testin dayanağı değil, bir denetim işinin (audit_engagements) TÜM
// kaydının (örnekleme + çalışma kağıtları + PBC + bağımsızlık beyanları)
// belirli bir andaki görünümü — mühürlendiği an DEĞİŞMEZ (DB guard),
// dolayısıyla "WORM" (write once, read many).
//
// İMZA YOK (aynı uyarı, master §18): gerçek anahtar/TSA kararı verilmeden
// sahte "signed" davranışı üretilmez — yalnız hash bütünlüğü.

import { canonicalHash, type CanonicalDeger } from "./canonical";

export const AUDIT_WORM_EXPORT_SCHEMA = "KALKAN_AUDIT_WORM_EXPORT_V1";

export interface AuditWormOrnek {
  yontem: string;
  populasyonBoyutu: number;
  ornekBoyutu: number;
  seed: string;
  secilenIndeksler: number[];
}

export interface AuditWormWorkpaper {
  baslik: string;
  icerik: string;
  durum: string;
  hazirlayanAd: string | null;
  reviewerAd: string | null;
  kontrolBaglari: string[];
  bulguBaglari: string[];
}

export interface AuditWormPbc {
  talepMetni: string;
  sonTarih: string | null;
  durum: string;
  alinanKanit: string | null;
  alindiTarihi: string | null;
}

export interface AuditWormBeyan {
  beyanEdenAd: string;
  externalEmail: string;
  cikarCatismasiYok: boolean;
  beyanAt: string;
}

export interface AuditWormGirdisi {
  engagement: {
    id: string;
    ad: string;
    kapsam: string | null;
    donem: string | null;
    riskSeviyesi: string;
    durum: string;
  };
  ornekler: AuditWormOrnek[];
  workpaperlar: AuditWormWorkpaper[];
  pbcTalepler: AuditWormPbc[];
  beyanlar: AuditWormBeyan[];
  olusturanAd: string;
  olusturmaZamani: string;
}

export interface AuditWormPaketi extends AuditWormGirdisi {
  schema: typeof AUDIT_WORM_EXPORT_SCHEMA;
  imzaDurumu: "IMZASIZ_HASH_BUTUNLUKLU";
  paketHash: string;
}

/** Dizi alanlarını deterministik sıraya sokar (kural 11 — girdi sırası önemsiz). */
function normalize(g: AuditWormGirdisi): AuditWormGirdisi {
  return {
    ...g,
    ornekler: [...g.ornekler].sort((a, b) => a.seed.localeCompare(b.seed)),
    workpaperlar: [...g.workpaperlar].sort((a, b) => a.baslik.localeCompare(b.baslik)),
    pbcTalepler: [...g.pbcTalepler].sort((a, b) => a.talepMetni.localeCompare(b.talepMetni)),
    beyanlar: [...g.beyanlar].sort((a, b) => a.externalEmail.localeCompare(b.externalEmail)),
  };
}

export async function auditWormPaketiOlustur(girdi: AuditWormGirdisi): Promise<AuditWormPaketi> {
  const n = normalize(girdi);
  const paketHash = await canonicalHash(n as unknown as CanonicalDeger);
  return { schema: AUDIT_WORM_EXPORT_SCHEMA, imzaDurumu: "IMZASIZ_HASH_BUTUNLUKLU", ...n, paketHash };
}

export interface AuditWormDogrulamaSonucu {
  gecerli: boolean;
  beklenen: string;
  hesaplanan: string;
}

/**
 * Paketi DB'siz doğrular: içerikten hash'i yeniden hesaplar, kayıtlı
 * `paketHash` ile karşılaştırır. Herhangi bir alan (workpaper içeriği,
 * bağ listesi, beyan...) değişmişse hash düşer.
 */
export async function auditWormDogrula(paket: AuditWormPaketi): Promise<AuditWormDogrulamaSonucu> {
  const { schema, imzaDurumu, paketHash, ...girdi } = paket;
  void schema;
  void imzaDurumu;
  const n = normalize(girdi as AuditWormGirdisi);
  const hesaplanan = await canonicalHash(n as unknown as CanonicalDeger);
  return { gecerli: hesaplanan === paketHash, beklenen: paketHash, hesaplanan };
}
