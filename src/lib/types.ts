// Mirrors docs/ROADMAP.md §2. Kept in sync by hand until
// `pnpm supabase gen types` runs against a real project.

export type Segment = "araci_kurum" | "pys" | "kvhs" | "diger";
export type Role = "admin" | "uyum" | "denetci_misafir";
export type FrameworkCode = "VII-128.10" | "7545" | "BDDK" | "DORA";
export type Periyot = "yillik" | "surekli" | "olay_bazli";
export type Durum = "karsilaniyor" | "kismi" | "acik" | "kapsam_disi";
export type EvidenceTip = "dosya" | "link" | "beyan";
export type Onem = "acil" | "kritik" | "yuksek" | "orta" | "dusuk";
export type FindingDurum = "acik" | "kapali";

export interface Tenant {
  id: string;
  name: string;
  segment: Segment;
  createdAt: string;
}

export interface Profile {
  id: string;
  tenantId: string;
  role: Role;
  fullName: string;
  email: string;
}

export interface Framework {
  id: string;
  code: FrameworkCode;
  name: string;
  version: string;
  yururlukTarihi: string | null;
}

export interface Control {
  id: string;
  frameworkId: string;
  maddeRef: string;
  baslik: string;
  aciklama: string;
  kanitTipi: EvidenceTip[];
  periyot: Periyot;
  kritiklik: 1 | 2 | 3 | 4 | 5;
}

export type ControlIliski = "esdeger" | "kismi";

export interface ControlMapping {
  id: string;
  controlIdA: string;
  controlIdB: string;
  iliski: ControlIliski;
}

export interface TenantControl {
  id: string;
  tenantId: string;
  controlId: string;
  durum: Durum;
  sorumluUserId: string | null;
  sonDegerlendirme: string | null;
  notMetni: string | null;
}

export interface Finding {
  id: string;
  tenantId: string;
  kaynak: "sizma_testi" | "denetim" | "ic_tespit";
  onem: Onem;
  baslik: string;
  aksiyonPlani: string | null;
  ykOnayTarihi: string | null;
  hedefKapama: string | null;
  durum: FindingDurum;
}

// supabase/migrations/20260716120008_audit_log.sql ile hizalı.
// Append-only (CLAUDE.md kural 2): bu kayıtlar hiçbir zaman güncellenmez
// veya silinmez — store-logic.ts'te yalnızca ekleme yolu vardır.
export type AuditEylem =
  | "durum_degisti"
  | "kanit_eklendi"
  | "sorumlu_atandi"
  | "not_guncellendi"
  | "kanit_suresi_doldu"
  | "bulgu_eklendi"
  | "bulgu_durumu_degisti"
  | "paylasim_linki_olusturuldu";

export interface AuditLogEntry {
  id: string;
  tenantId: string;
  actorId: string | null;
  eylem: AuditEylem;
  hedefTablo: string | null;
  hedefId: string | null;
  detay: Record<string, unknown> | null;
  createdAt: string;
}

export interface ShareLinkKapsam {
  frameworkId: string;
}

export interface ShareLink {
  id: string;
  tenantId: string;
  token: string;
  kapsam: ShareLinkKapsam;
  olusturan: string | null;
  sonGecerlilik: string; // ISO tarih
  createdAt: string;
}
