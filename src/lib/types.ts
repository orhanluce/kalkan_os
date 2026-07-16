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
