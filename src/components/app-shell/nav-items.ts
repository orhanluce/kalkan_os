// Navigasyon bilgi mimarisi (master talimat §7.4, PR-0 ADR uyarlaması).
//
// YALNIZ MEVCUT route'lar: belgede geçen ama repo'da henüz olmayan modüller
// (Regülasyon, Kanıtlar, Kritik Hizmetler...) ÖLÜ LİNK olarak EKLENMEZ —
// her modül kendi taşında gelirken buraya satırını ekler. "Simülasyonlar"
// belge IA'sında yoktu; canlı modül silinmez, Güvence altında "Tatbikatlar"
// olarak yaşar (PR-0 sapma kaydı).
import {
  FileWarning,
  FlaskConical,
  LandmarkIcon,
  LayoutDashboard,
  ScrollText,
  Share2,
  ShieldCheck,
  UsersRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { cfoOdakliMi, type OrganizationType } from "@/lib/organizasyon";

export interface NavItem {
  href: string;
  etiket: string;
  Ikon: LucideIcon;
}

export interface NavGrubu {
  baslik: string | null; // null = grup başlıksız (Genel Bakış)
  ogeler: NavItem[];
}

/**
 * Navigasyon org-type'a DUYARLI (V2 §6.2): CFO odaklı kurumda Finans grubu
 * (dashboard + IBAN) öne çıkar. Bu SUNUM tercihidir — yetkisiz modül gizleme
 * DEĞİL (entitlement server/DB'de). org_type null (onboarding öncesi) ise CFO
 * grubu gösterilmez. Kararı saf katman (`cfoOdakliMi`) verir.
 */
export function navGruplari(organizationType: string | null | undefined): NavGrubu[] {
  const cfo = organizationType ? cfoOdakliMi(organizationType as OrganizationType) : false;
  const finansGrubu: NavGrubu = {
    baslik: "Finans",
    ogeler: [
      { href: "/cfo", etiket: "Finans Güvence Özeti", Ikon: Wallet },
      { href: "/cfo/iban-degisiklik", etiket: "IBAN Değişikliği", Ikon: LandmarkIcon },
    ],
  };
  return [
    { baslik: null, ogeler: [{ href: "/", etiket: "Pano", Ikon: LayoutDashboard }] },
    // CFO odaklıysa Finans grubu en üstte (ödeme/IBAN/SoD kurumun ana derdi).
    ...(cfo ? [finansGrubu] : []),
    {
      baslik: "Güvence",
      ogeler: [
        { href: "/controls", etiket: "Kontroller", Ikon: ShieldCheck },
        { href: "/findings", etiket: "Bulgular", Ikon: FileWarning },
        { href: "/simulasyonlar", etiket: "Tatbikatlar", Ikon: FlaskConical },
        { href: "/denetim-izi", etiket: "Denetim İzi", Ikon: ScrollText },
      ],
    },
    {
      baslik: "Yönetişim",
      ogeler: [{ href: "/sod", etiket: "Görevler Ayrılığı", Ikon: UsersRound }],
    },
    { baslik: "Yönetim", ogeler: [{ href: "/paylasim", etiket: "Paylaşım", Ikon: Share2 }] },
  ];
}

/** Mobil alt navigasyon: en fazla 5 hedef (belge §7.3); gerisi Menü'de. */
export const MOBIL_ANA_HEDEFLER: NavItem[] = [
  { href: "/", etiket: "Pano", Ikon: LayoutDashboard },
  { href: "/controls", etiket: "Kontroller", Ikon: ShieldCheck },
  { href: "/findings", etiket: "Bulgular", Ikon: FileWarning },
  { href: "/sod", etiket: "SoD", Ikon: UsersRound },
];

/** Aktiflik: tam eşleşme veya alt yol (/, yalnız tam eşleşme). */
export function aktifMi(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}
