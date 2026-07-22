// Navigasyon bilgi mimarisi (master talimat §7.4, PR-0 ADR uyarlaması).
//
// YALNIZ MEVCUT route'lar: belgede geçen ama repo'da henüz olmayan modüller
// (Regülasyon, Kanıtlar, Kritik Hizmetler...) ÖLÜ LİNK olarak EKLENMEZ —
// her modül kendi taşında gelirken buraya satırını ekler. "Simülasyonlar"
// belge IA'sında yoktu; canlı modül silinmez, Güvence altında "Tatbikatlar"
// olarak yaşar (PR-0 sapma kaydı).
import {
  Activity,
  Bot,
  Boxes,
  ClipboardCheck,
  FileCheck2,
  FileSpreadsheet,
  FileWarning,
  FlaskConical,
  Gavel,
  GraduationCap,
  LandmarkIcon,
  LayoutDashboard,
  Library,
  ListTree,
  Lock,
  Network,
  ScrollText,
  Share2,
  ShieldCheck,
  TrendingUp,
  UsersRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { cfoOdakliMi, urunHatti, type OrganizationType } from "@/lib/organizasyon";

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
  // Resmî kaynak sicili GLOBAL katalogdur ve her ürün hattında görünür.
  // Doğrulama/uygulanabilirlik/DORA iş akışları ise REGULATED ve KARMA'ya
  // özgü kalır; CFO Starter navigasyonu ileri regülasyon akışlarıyla boğulmaz.
  const hat = organizationType ? urunHatti(organizationType as OrganizationType) : null;
  const ileriRegulasyonGorunur = hat === "REGULATED" || hat === "KARMA";
  const finansGrubu: NavGrubu = {
    baslik: "Finans",
    ogeler: [
      { href: "/cfo", etiket: "Finans Güvence Özeti", Ikon: Wallet },
      { href: "/cfo/iban-degisiklik", etiket: "IBAN Değişikliği", Ikon: LandmarkIcon },
    ],
  };
  const regulasyonGrubu: NavGrubu = {
    baslik: "Mevzuat",
    ogeler: [
      {
        href: "/regulasyon/kaynaklar",
        etiket: "Kanun ve Yönetmelikler",
        Ikon: Library,
      },
      ...(ileriRegulasyonGorunur
        ? [
            {
              href: "/regulasyon/dogrulama",
              etiket: "Doğrulama Kuyruğu",
              Ikon: ShieldCheck,
            },
            {
              href: "/regulasyon/uygulanabilirlik",
              etiket: "Uygulanabilirlik",
              Ikon: ScrollText,
            },
            { href: "/dora-roi", etiket: "DORA RoI Export", Ikon: FileSpreadsheet },
          ]
        : []),
    ],
  };
  return [
    { baslik: null, ogeler: [{ href: "/", etiket: "Pano", Ikon: LayoutDashboard }] },
    // CFO odaklıysa Finans grubu en üstte (ödeme/IBAN/SoD kurumun ana derdi).
    ...(cfo ? [finansGrubu] : []),
    regulasyonGrubu,
    {
      baslik: "Güvence",
      ogeler: [
        { href: "/controls", etiket: "Kontroller", Ikon: ShieldCheck },
        { href: "/findings", etiket: "Bulgular", Ikon: FileWarning },
        { href: "/simulasyonlar", etiket: "Tatbikatlar", Ikon: FlaskConical },
        { href: "/denetim-izi", etiket: "Denetim İzi", Ikon: ScrollText },
        { href: "/seffaflik", etiket: "Şeffaflık Defteri", Ikon: ListTree },
        { href: "/guvence", etiket: "İddia Güvencesi", Ikon: FileCheck2 },
      ],
    },
    {
      baslik: "Yönetişim",
      ogeler: [
        { href: "/sod", etiket: "Görevler Ayrılığı", Ikon: UsersRound },
        { href: "/politikalar", etiket: "Politikalar", Ikon: ScrollText },
        { href: "/egitim", etiket: "Eğitim / Yetkinlik", Ikon: GraduationCap },
        { href: "/risk", etiket: "Risk & KRI", Ikon: TrendingUp },
      ],
    },
    {
      baslik: "Operasyonel Dayanıklılık",
      ogeler: [
        { href: "/kritik-hizmetler", etiket: "Kritik Hizmetler", Ikon: Activity },
        { href: "/tedarikciler", etiket: "Tedarikçiler", Ikon: Boxes },
        { href: "/dayaniklilik", etiket: "Dayanıklılık Etki Grafiği", Ikon: Network },
      ],
    },
    {
      baslik: "Gizlilik",
      ogeler: [{ href: "/gizlilik", etiket: "KVKK / Gizlilik", Ikon: Lock }],
    },
    {
      baslik: "Yapay Zeka",
      ogeler: [{ href: "/ai-guvence", etiket: "AI Güvence", Ikon: Bot }],
    },
    {
      baslik: "Denetim",
      ogeler: [{ href: "/denetim", etiket: "Denetim Çalışma Alanı", Ikon: ClipboardCheck }],
    },
    {
      baslik: "Regülatör",
      ogeler: [{ href: "/regulator", etiket: "Regülatör İşlemleri", Ikon: Gavel }],
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
