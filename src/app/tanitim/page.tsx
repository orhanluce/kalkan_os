import type { Metadata } from "next";
import {
  AlertTriangle,
  ArrowRight,
  BookOpenCheck,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  FileSearch,
  FileSpreadsheet,
  FolderOpen,
  Gauge,
  HelpCircle,
  Landmark,
  LineChart,
  Lock,
  Mail,
  PackageCheck,
  Scale,
  ShieldCheck,
  SplitSquareHorizontal,
  Timer,
  UserCheck,
  Users,
  Vault,
  XCircle,
} from "lucide-react";
import { WardproofGlyph } from "@/components/brand";

export const metadata: Metadata = {
  title: "Wardproof — Finans kurumları için sürekli uyum ve kanıt yönetimi",
  description:
    "Wardproof, uyum süreçlerini Excel, e-posta ve klasörlerden çıkarıp izlenebilir, kanıtlı ve denetlenebilir tek bir sisteme taşır.",
};

// ---------------------------------------------------------------------------
// İçerik verisi — tek yerde dursun ki metin düzenlemek işaretlemeye dokunmasın.
// ---------------------------------------------------------------------------

const NAV_BAGLANTILARI = [
  { href: "#sorun", etiket: "Sorun" },
  { href: "#cozum", etiket: "Çözüm" },
  { href: "#moduller", etiket: "Modüller" },
  { href: "#planlar", etiket: "Planlar" },
  { href: "#guven", etiket: "Denetlenebilirlik" },
];

const DEMO_MAILTO =
  "mailto:info@wardproof.com?subject=Wardproof%20demo%20talebi";

// Hero önizlemesindeki durum rozetleri ürünün GERÇEK durum sözlüğüdür
// (Failed ≠ Unknown ≠ Stale ≠ Exception ≠ Verified) — pazarlama için
// birleştirilmez, renkler uygulamanın koyu tema token değerleriyle aynıdır.
const ONIZLEME_DURUMLARI = [
  { etiket: "Doğrulandı", adet: 9, renk: "#4cc38a", Ikon: CheckCircle2 },
  { etiket: "Kaldı", adet: 2, renk: "#f97066", Ikon: XCircle },
  { etiket: "Bilinmiyor", adet: 3, renk: "#8e9bc7", Ikon: HelpCircle },
  { etiket: "Bayat", adet: 1, renk: "#e5a155", Ikon: Timer },
  { etiket: "İstisna", adet: 1, renk: "#a48afb", Ikon: Scale },
];

const ONIZLEME_IZ_KAYITLARI = [
  { saat: "09:12", olay: "Kontrol testi çalıştırıldı", hash: "3f9c…a1d2" },
  { saat: "09:14", olay: "Kanıt yüklendi · dört göz onayı bekliyor", hash: "b7e0…44f9" },
  { saat: "09:31", olay: "Onay verildi · farklı kullanıcı", hash: "912a…c6b3" },
  { saat: "09:32", olay: "Denetim paketi mühürlendi", hash: "e5d8…07aa" },
];

const SORUNLAR = [
  {
    baslik: "Excel ve sürüm karmaşası",
    metin:
      "Kontrol takibi 'uyum_takip_v7_SON.xlsx' gibi dosyalarda yaşıyor; hangi sürümün geçerli olduğunu kimse bilmiyor.",
    Ikon: FileSpreadsheet,
  },
  {
    baslik: "Onaylar e-postada kayboluyor",
    metin:
      "Kimin, neyi, ne zaman onayladığı 'Re: Re: FW:' zincirlerinde. Denetimde bu zinciri geriye sarmak saatler alıyor.",
    Ikon: Mail,
  },
  {
    baslik: "Denetim günü kanıt bulunamıyor",
    metin:
      "Kanıt var ama hangi klasörde, hangi tarihli kopyası geçerli, kim yükledi — bu sorulara hızlı yanıt yok.",
    Ikon: FolderOpen,
  },
  {
    baslik: "Mevzuat dayanağı kopuk",
    metin:
      "Kontrol var, test var; ama hangi mevzuat maddesine dayandığı ayrı bir dokümanda — güncelliği belirsiz.",
    Ikon: BookOpenCheck,
  },
  {
    baslik: "Görevler ayrılığı ihlali geç fark ediliyor",
    metin:
      "Aynı kişinin hem talep edip hem onayladığı ancak denetim bulgusuna dönüşünce görülüyor.",
    Ikon: SplitSquareHorizontal,
  },
];

const ZINCIR_ADIMLARI = [
  { numara: "01", etiket: "Mevzuat", metin: "Dayanak maddeyle kayıt altında" },
  { numara: "02", etiket: "Kontrol", metin: "Kütüphaneden atanır, uydurulmaz" },
  { numara: "03", etiket: "Test", metin: "Sonuç beş ayrı durumla ölçülür" },
  { numara: "04", etiket: "Kanıt", metin: "Hash'li, tarihli, onaylı" },
  { numara: "05", etiket: "Denetim", metin: "Paket bağımsız doğrulanır" },
];

const COZUMLER = [
  {
    baslik: "Kontrol kütüphanesi",
    metin: "Mevzuattan türetilen kontroller tek kütüphanede; her kurum kendi kapsamına atar.",
  },
  {
    baslik: "Kanıt yönetimi",
    metin: "Her kanıt içerik hash'i, tarih ve yükleyen bilgisiyle saklanır; süresi dolunca durum kendiliğinden düşer.",
  },
  {
    baslik: "Görevler ayrılığı motoru",
    metin: "Çatışan yetki kombinasyonları kurala bağlanır; ihlal denetimden önce görünür olur.",
  },
  {
    baslik: "Kontrol testleri",
    metin: "Testler tanımlı gözlemlerle çalışır; 'ölçemedik' asla 'kaldı' sayılmaz.",
  },
  {
    baslik: "Bulgu ve kapanış takibi",
    metin: "Başarısız test önce öneri olur, insan onayıyla bulguya dönüşür; kapanış yeniden test ister.",
  },
  {
    baslik: "Denetim paketi ve doğrulama izi",
    metin: "Mühürlü paket, Wardproof'a erişmeden bağımsız bir betikle doğrulanabilir.",
  },
  {
    baslik: "Mevzuat dayanağı ve sitasyon",
    metin: "Her kontrolün hangi hükme dayandığı görünür; sitasyon paketi denetçiye tek dosyada gider.",
  },
];

const MODULLER = [
  {
    baslik: "Sürekli Uyum Panosu",
    metin: "Kontrollerin güncel durumu, çerçeve bazında dağılım ve açık bulgular tek ekranda.",
    Ikon: Gauge,
  },
  {
    baslik: "Kanıt Kasası",
    metin: "İçerik adresli saklama, dört göz onayı, süre takibi ve redaksiyon soy bağı.",
    Ikon: Vault,
  },
  {
    baslik: "Görevler Ayrılığı",
    metin: "Kural motoru, istisna yaşam döngüsü, CSV atama import'u ve bağımsız onay.",
    Ikon: SplitSquareHorizontal,
  },
  {
    baslik: "Kontrol Test Motoru",
    metin: "Deterministik değerlendirme; Kaldı, Bilinmiyor, Bayat ve İstisna birbirine karışmaz.",
    Ikon: ClipboardCheck,
  },
  {
    baslik: "Bulgu Yönetimi",
    metin: "Öneriden bulguya, bulgudan doğrulanmış kapanışa izlenebilir zincir.",
    Ikon: FileSearch,
  },
  {
    baslik: "Denetim Paketi",
    metin: "Hash zinciri ve imzayla mühürlenmiş, sistemden bağımsız doğrulanabilir ZIP çıktısı.",
    Ikon: PackageCheck,
  },
  {
    baslik: "Mevzuat Dayanakları",
    metin: "Hüküm, yükümlülük ve uygulanabilirlik kararları; doğrulanmamış eşleme etiketiyle dürüst kalır.",
    Ikon: Scale,
  },
  {
    baslik: "Raporlama ve YK Çıktıları",
    metin: "Yönetim kurulu ve denetçi için özet çıktılar; her sayı gerekçesini taşır.",
    Ikon: LineChart,
  },
];

const HEDEF_KITLE = [
  { etiket: "Finans kurumları", Ikon: Landmark },
  { etiket: "Katılım finans kurumları", Ikon: Building2 },
  { etiket: "Aracı kurumlar ve portföy yönetimi", Ikon: LineChart },
  { etiket: "Regülasyona tabi şirketler", Ikon: Scale },
  { etiket: "CFO ve iç kontrol ekipleri", Ikon: UserCheck },
  { etiket: "Uyum, risk ve iç denetim ekipleri", Ikon: Users },
];

const PLANLAR = [
  {
    ad: "Starter",
    kapsam: "Küçük ekipler için temel kontrol ve kanıt takibi.",
    maddeler: ["Kontrol kütüphanesi", "Kanıt yükleme ve süre takibi", "Temel uyum panosu"],
  },
  {
    ad: "Professional",
    kapsam: "Büyüyen uyum ekipleri için test ve bulgu disiplini.",
    maddeler: ["Starter kapsamı", "Görevler ayrılığı motoru", "Kontrol testleri ve bulgu takibi"],
  },
  {
    ad: "Enterprise",
    kapsam: "Çok kiracılı yapılar ve gelişmiş denetim izi.",
    maddeler: ["Professional kapsamı", "Gelişmiş denetim izi", "Özel raporlar"],
  },
  {
    ad: "Regulated",
    kapsam: "Finans ve regülasyon yoğun kurumlar için kapsamlı paket.",
    maddeler: ["Enterprise kapsamı", "Mevzuat dayanağı ve sitasyon", "Denetim paketi ve doğrulama izi"],
  },
];

const PILOT_PLANI = {
  ad: "Pilot",
  kapsam: "Erken kullanıcılar ve PoC süreçleri için sınırlı süreli pilot kullanım.",
  maddeler: [
    "Birlikte kapsam belirleme",
    "Gerçek verinizle sınırlı süreli deneme",
    "Pilot sonunda dürüst değerlendirme",
  ],
};

const GUVEN_ILKELERI = [
  {
    baslik: "Yalnızca ekleyen denetim izi",
    metin:
      "Kanıtlar ve denetim kayıtları üzerine yazılmaz, silinmez; düzeltme yeni kayıt olarak eklenir ve eskisi görünür kalır.",
    Ikon: ShieldCheck,
  },
  {
    baslik: "Hash ile bütünlük",
    metin:
      "Her kanıt ve rapor içerik özetiyle (SHA-256) saklanır. Bir bayt değişse doğrulama başarısız olur — ve bunu sistem dışında da kontrol edebilirsiniz.",
    Ikon: Lock,
  },
  {
    baslik: "Değişmez mühürlü kayıtlar",
    metin:
      "Mühürlenen test sonucu ve denetim paketi sonradan değiştirilemez; sistem yöneticisi için bile yazma yolu kapalıdır.",
    Ikon: PackageCheck,
  },
  {
    baslik: "Kurum ve yetki ayrımı",
    metin:
      "Her kurumun verisi satır seviyesinde izole edilir; yetkiler roller üzerinden tanımlanır ve veritabanı katmanında uygulanır.",
    Ikon: Building2,
  },
  {
    baslik: "Kritik kararlar insanda",
    metin:
      "Bulgu kabulü, istisna onayı ve kapanış gibi kararlar iki ayrı insan ister. Sistem öneri üretir; hükmü insan verir.",
    Ikon: UserCheck,
  },
];

// ---------------------------------------------------------------------------
// Yardımcı parçalar
// ---------------------------------------------------------------------------

function BolumBasligi({
  id,
  eyebrow,
  baslik,
  metin,
}: {
  id?: string;
  eyebrow: string;
  baslik: string;
  metin?: string;
}) {
  return (
    <div id={id} className="mx-auto max-w-3xl scroll-mt-28 text-center">
      <p className="font-mono text-[11px] font-medium tracking-[0.28em] text-cyan-300/90 uppercase">
        {eyebrow}
      </p>
      <h2 className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-balance sm:text-4xl">
        {baslik}
      </h2>
      {metin ? (
        <p className="mt-4 text-base leading-7 text-slate-300/90 sm:text-lg sm:leading-8">{metin}</p>
      ) : null}
    </div>
  );
}

function UrunOnizleme() {
  return (
    <div
      aria-label="Wardproof ürün önizlemesi — örnek veriler"
      className="relative rounded-2xl border border-white/10 bg-[#0b1826]/90 shadow-[0_40px_120px_rgba(0,0,0,.45)] backdrop-blur-sm"
    >
      {/* Pencere çubuğu */}
      <div className="flex items-center justify-between gap-3 border-b border-white/8 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="grid size-6 place-items-center rounded-md bg-cyan-300/10 text-cyan-200 ring-1 ring-cyan-200/20">
            <WardproofGlyph className="size-4" />
          </span>
          <span className="text-xs font-semibold tracking-tight text-slate-200">Uyum Panosu</span>
        </div>
        <span className="rounded-full border border-white/10 px-2 py-0.5 font-mono text-[9px] tracking-[0.14em] text-slate-400 uppercase">
          Örnek veri
        </span>
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        {/* Beş AYRI durum — ürünün gerçek durum sözlüğü */}
        <div>
          <p className="mb-2 font-mono text-[10px] tracking-[0.18em] text-slate-400 uppercase">
            Kontrol durumları — birleştirilmez
          </p>
          <div className="flex flex-wrap gap-1.5">
            {ONIZLEME_DURUMLARI.map(({ etiket, adet, renk, Ikon }) => (
              <span
                key={etiket}
                className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium"
                style={{
                  color: renk,
                  borderColor: `${renk}4d`,
                  backgroundColor: `${renk}1a`,
                }}
              >
                <Ikon className="size-3 shrink-0" aria-hidden="true" />
                {etiket}
                <span className="font-mono tabular-nums">{adet}</span>
              </span>
            ))}
          </div>
        </div>

        {/* Denetim izi */}
        <div className="rounded-xl border border-white/8 bg-[#081420] p-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="font-mono text-[10px] tracking-[0.18em] text-slate-400 uppercase">
              Denetim izi — yalnızca eklenir
            </p>
            <span className="inline-flex items-center gap-1 font-mono text-[9px] tracking-[0.12em] text-[#d49a6a] uppercase">
              <Lock className="size-3" aria-hidden="true" /> Mühürlü · SHA-256
            </span>
          </div>
          <ol className="space-y-1.5">
            {ONIZLEME_IZ_KAYITLARI.map((kayit) => (
              <li
                key={kayit.hash}
                className="flex items-baseline gap-2.5 border-l-2 border-cyan-300/25 pl-2.5 text-[11px] leading-5"
              >
                <span className="shrink-0 font-mono tabular-nums text-slate-400">{kayit.saat}</span>
                <span className="min-w-0 flex-1 truncate text-slate-300">{kayit.olay}</span>
                <span className="hidden shrink-0 font-mono text-[10px] text-slate-400 sm:inline">
                  {kayit.hash}
                </span>
              </li>
            ))}
          </ol>
        </div>

        {/* Dört göz şeridi */}
        <div className="flex items-center gap-2.5 rounded-xl border border-[#d49a6a]/25 bg-[#d49a6a]/8 px-3 py-2.5">
          <UserCheck className="size-4 shrink-0 text-[#d49a6a]" aria-hidden="true" />
          <p className="text-[11px] leading-4 text-slate-300">
            Kritik kapanış <span className="font-medium text-[#e8b98f]">ikinci bir insanın onayını</span>{" "}
            bekliyor — sistem kendi kendine karar vermez.
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sayfa
// ---------------------------------------------------------------------------

export default function TanitimSayfasi() {
  return (
    <main className="relative isolate min-h-svh overflow-hidden bg-[#07111b] text-[#edf5f7]">
      {/* Arka doku: ince ölçüm ızgarası + iki ışık lekesi (giriş sayfasıyla aynı aile) */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-20 opacity-40"
        style={{
          backgroundImage:
            "linear-gradient(rgba(134,203,218,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(134,203,218,.05) 1px,transparent 1px)",
          backgroundSize: "56px 56px",
        }}
      />
      <div aria-hidden="true" className="absolute -top-40 left-[6%] -z-10 size-[560px] rounded-full bg-cyan-400/10 blur-[140px]" />
      <div aria-hidden="true" className="absolute top-[30%] -right-64 -z-10 size-[640px] rounded-full bg-blue-500/12 blur-[150px]" />
      <div aria-hidden="true" className="absolute bottom-[-200px] left-[30%] -z-10 size-[520px] rounded-full bg-[#d49a6a]/8 blur-[150px]" />

      {/* Üst çubuk */}
      <header className="sticky top-0 z-40 border-b border-white/8 bg-[#07111b]/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-[1240px] items-center justify-between gap-4 px-5 sm:px-8">
          <a
            href="#"
            aria-label="Wardproof ana sayfa"
            className="flex items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-[11px] border border-cyan-200/20 bg-cyan-300/10 text-cyan-200">
              <WardproofGlyph className="size-6" />
            </span>
            <span className="text-[16px] font-semibold tracking-[-0.02em]">Wardproof</span>
          </a>
          <nav aria-label="Sayfa bölümleri" className="hidden items-center gap-1 lg:flex">
            {NAV_BAGLANTILARI.map((b) => (
              <a
                key={b.href}
                href={b.href}
                className="rounded-md px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
              >
                {b.etiket}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2.5">
            <a
              href="/giris"
              className="rounded-lg border border-white/12 px-3.5 py-2 text-sm font-medium text-slate-200 transition-colors hover:border-white/25 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
            >
              Giriş Yap
            </a>
            <a
              href={DEMO_MAILTO}
              className="hidden rounded-lg bg-[#69d7dc] px-3.5 py-2 text-sm font-semibold text-[#061319] shadow-[0_10px_28px_rgba(59,210,210,.18)] transition-colors hover:bg-[#8be7e9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 sm:inline-flex"
            >
              Demo Talep Et
            </a>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[1240px] px-5 sm:px-8">
        {/* ------------------------------------------------ 1 · HERO */}
        <section className="grid items-center gap-12 py-16 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)] lg:gap-16 lg:py-24">
          <div className="wardproof-enter">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-200/15 bg-cyan-300/6 px-3 py-1.5 font-mono text-[11px] font-medium tracking-[0.14em] text-cyan-100 uppercase">
              <span className="size-1.5 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(103,232,249,.8)]" />
              Sürekli uyum çalışma alanı
            </div>
            <h1 className="text-[clamp(2.4rem,4.6vw,3.9rem)] leading-[1.04] font-semibold tracking-[-0.045em] text-balance">
              Finans kurumları için sürekli uyum ve{" "}
              <span className="bg-gradient-to-r from-cyan-200 via-sky-200 to-blue-300 bg-clip-text text-transparent">
                kanıt yönetimi
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-slate-300 sm:text-lg sm:leading-8">
              Wardproof, uyum süreçlerini Excel&apos;lerden, e-posta zincirlerinden ve klasörlerden
              çıkarır; izlenebilir, kanıtlı ve denetlenebilir tek bir sisteme taşır.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                href={DEMO_MAILTO}
                className="group inline-flex h-12 items-center gap-1.5 rounded-xl bg-[#69d7dc] px-6 text-sm font-semibold text-[#061319] shadow-[0_12px_32px_rgba(59,210,210,.16)] transition-all hover:bg-[#8be7e9] hover:shadow-[0_16px_40px_rgba(59,210,210,.22)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
              >
                Demo Talep Et
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </a>
              <a
                href="/giris"
                className="inline-flex h-12 items-center rounded-xl border border-white/15 px-6 text-sm font-medium text-slate-200 transition-colors hover:border-white/30 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
              >
                Giriş Yap
              </a>
            </div>
            <p className="mt-6 font-mono text-[11px] tracking-[0.1em] text-slate-400 uppercase">
              Denetim, onay ve mevzuat dayanağı — tek izlenebilir zincirde
            </p>
          </div>
          <div className="wardproof-enter-delay">
            <UrunOnizleme />
          </div>
        </section>

        {/* ------------------------------------------------ 2 · SORUN */}
        <section aria-labelledby="sorun-baslik" className="border-t border-white/8 py-20 lg:py-24">
          <BolumBasligi
            id="sorun"
            eyebrow="Sorun"
            baslik="Denetim günü her şey dağınıksa, uyum bir iddiadan ibarettir"
            metin="Kurumlar uyum süreçlerini çoğunlukla dosyalar, e-postalar ve manuel takiplerle yürütüyor. Süreç işliyor gibi görünür — denetim gelene kadar."
          />
          <h2 id="sorun-baslik" className="sr-only">
            Sorun
          </h2>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SORUNLAR.map(({ baslik, metin, Ikon }) => (
              <div
                key={baslik}
                className="rounded-2xl border border-white/8 bg-white/[0.03] p-5 transition-colors hover:border-white/15"
              >
                <span className="mb-4 grid size-9 place-items-center rounded-lg bg-red-400/10 text-red-300 ring-1 ring-red-300/20">
                  <Ikon className="size-4.5" aria-hidden="true" />
                </span>
                <h3 className="text-[15px] font-semibold tracking-[-0.01em]">{baslik}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">{metin}</p>
              </div>
            ))}
            {/* Dağınık artefakt kartı — sorunun kendisi görsel olarak */}
            <div className="flex flex-col justify-center gap-2 rounded-2xl border border-dashed border-white/15 bg-transparent p-5">
              <p className="mb-1 font-mono text-[10px] tracking-[0.18em] text-slate-400 uppercase">
                Bugünün &quot;sistemi&quot;
              </p>
              {["uyum_takip_v7_SON(2).xlsx", "Re: Re: FW: kanıt rica ederim", "Klasör: Denetim_2025_YENI"].map(
                (etiket) => (
                  <span
                    key={etiket}
                    className="inline-flex w-fit max-w-full items-center gap-2 truncate rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1.5 font-mono text-[11px] text-slate-400"
                  >
                    <AlertTriangle className="size-3 shrink-0 text-[#e5a155]" aria-hidden="true" />
                    {etiket}
                  </span>
                ),
              )}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------ 3 · ÇÖZÜM */}
        <section aria-labelledby="cozum-baslik" className="border-t border-white/8 py-20 lg:py-24">
          <BolumBasligi
            id="cozum"
            eyebrow="Çözüm"
            baslik="Mevzuattan kanıta, kopmayan tek zincir"
            metin="Wardproof her adımı bir sonrakine bağlar: dayanak görünür, test ölçülür, kanıt mühürlenir, denetim bağımsız doğrulanır."
          />
          <h2 id="cozum-baslik" className="sr-only">
            Çözüm
          </h2>

          {/* Zincir — gerçek bir sıra olduğu için numaralı */}
          <div className="mx-auto mt-12 max-w-4xl rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
            <ol className="grid gap-6 sm:grid-cols-5 sm:gap-2">
              {ZINCIR_ADIMLARI.map((adim, index) => (
                <li key={adim.etiket} className="relative min-w-0">
                  {index < ZINCIR_ADIMLARI.length - 1 ? (
                    <span
                      aria-hidden="true"
                      className="absolute top-3 left-[calc(50%+18px)] hidden h-px w-[calc(100%-36px)] bg-gradient-to-r from-cyan-300/60 to-blue-300/15 sm:block"
                    />
                  ) : null}
                  <div className="flex items-start gap-3 sm:flex-col sm:items-center sm:text-center">
                    <span className="grid size-6 shrink-0 place-items-center rounded-full border border-cyan-200/30 bg-[#0b1b27] font-mono text-[10px] text-cyan-200">
                      {adim.numara}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{adim.etiket}</p>
                      <p className="mt-0.5 text-xs leading-5 text-slate-400">{adim.metin}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <ul className="mt-10 grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
            {COZUMLER.map(({ baslik, metin }) => (
              <li key={baslik} className="flex gap-3">
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-cyan-300/10 text-cyan-200">
                  <CheckCircle2 className="size-3.5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-semibold">{baslik}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-400">{metin}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* ------------------------------------------------ 4 · MODÜLLER */}
        <section aria-labelledby="moduller-baslik" className="border-t border-white/8 py-20 lg:py-24">
          <BolumBasligi
            id="moduller"
            eyebrow="Ürün modülleri"
            baslik="Uyumun her parçası için ayrı bir oda, hepsi aynı zincirde"
          />
          <h2 id="moduller-baslik" className="sr-only">
            Ürün modülleri
          </h2>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {MODULLER.map(({ baslik, metin, Ikon }) => (
              <div
                key={baslik}
                className="group rounded-2xl border border-white/8 bg-[#0b1826]/70 p-5 transition-colors hover:border-cyan-200/25"
              >
                <span className="mb-4 grid size-9 place-items-center rounded-lg bg-cyan-300/8 text-cyan-200 ring-1 ring-cyan-200/15 transition-colors group-hover:bg-cyan-300/12">
                  <Ikon className="size-4.5" aria-hidden="true" />
                </span>
                <h3 className="text-[15px] font-semibold tracking-[-0.01em]">{baslik}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">{metin}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ------------------------------------------------ 5 · KİMLER İÇİN */}
        <section aria-labelledby="kimler-baslik" className="border-t border-white/8 py-20 lg:py-24">
          <BolumBasligi
            eyebrow="Kimler için"
            baslik="Uyumu kanıtla yönetmek zorunda olan herkes için"
          />
          <h2 id="kimler-baslik" className="sr-only">
            Kimler için
          </h2>
          <ul className="mx-auto mt-10 grid max-w-4xl gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {HEDEF_KITLE.map(({ etiket, Ikon }) => (
              <li
                key={etiket}
                className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3.5"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-blue-400/10 text-blue-300 ring-1 ring-blue-300/20">
                  <Ikon className="size-4" aria-hidden="true" />
                </span>
                <span className="text-sm font-medium">{etiket}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* ------------------------------------------------ 6 · PLANLAR */}
        <section aria-labelledby="planlar-baslik" className="border-t border-white/8 py-20 lg:py-24">
          <BolumBasligi
            id="planlar"
            eyebrow="Plan türleri"
            baslik="Kurumunuzun ölçeğine göre kapsam"
            metin="Fiyatlandırma kurum büyüklüğüne ve kapsama göre birlikte belirlenir."
          />
          <h2 id="planlar-baslik" className="sr-only">
            Plan türleri
          </h2>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PLANLAR.map(({ ad, kapsam, maddeler }) => (
              <div key={ad} className="flex flex-col rounded-2xl border border-white/8 bg-white/[0.03] p-5">
                <h3 className="text-lg font-semibold tracking-[-0.02em]">{ad}</h3>
                <p className="mt-1.5 min-h-10 text-sm leading-6 text-slate-400">{kapsam}</p>
                <ul className="mt-4 space-y-2.5 border-t border-white/8 pt-4">
                  {maddeler.map((madde) => (
                    <li key={madde} className="flex items-start gap-2 text-sm leading-5 text-slate-300">
                      <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-cyan-300" aria-hidden="true" />
                      {madde}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Pilot — bakır vurgulu erken erişim şeridi */}
          <div className="mt-4 flex flex-col gap-5 rounded-2xl border border-[#d49a6a]/30 bg-[#d49a6a]/6 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[#d49a6a]/30 bg-[#d49a6a]/10 px-2.5 py-1 font-mono text-[10px] font-medium tracking-[0.16em] text-[#e8b98f] uppercase">
                Erken erişim
              </div>
              <h3 className="text-lg font-semibold tracking-[-0.02em]">{PILOT_PLANI.ad}</h3>
              <p className="mt-1 text-sm leading-6 text-slate-300">{PILOT_PLANI.kapsam}</p>
              <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
                {PILOT_PLANI.maddeler.map((madde) => (
                  <li key={madde} className="flex items-center gap-2 text-sm text-slate-300">
                    <CheckCircle2 className="size-3.5 shrink-0 text-[#d49a6a]" aria-hidden="true" />
                    {madde}
                  </li>
                ))}
              </ul>
            </div>
            <a
              href={DEMO_MAILTO}
              className="inline-flex h-11 w-fit shrink-0 items-center gap-1.5 rounded-xl border border-[#d49a6a]/40 px-5 text-sm font-semibold text-[#e8b98f] transition-colors hover:bg-[#d49a6a]/12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d49a6a]"
            >
              Fiyatlandırma için iletişime geçin
              <ArrowRight className="size-4" aria-hidden="true" />
            </a>
          </div>
        </section>

        {/* ------------------------------------------------ 7 · GÜVEN */}
        <section aria-labelledby="guven-baslik" className="border-t border-white/8 py-20 lg:py-24">
          <BolumBasligi
            id="guven"
            eyebrow="Güven ve denetlenebilirlik"
            baslik="Güven, sözle değil mimariyle kurulur"
            metin="Wardproof'un güvence iddiaları ürünün pazarlamasında değil, veri modelinde yaşar. Beş ilke, sistemin her katmanında uygulanır."
          />
          <h2 id="guven-baslik" className="sr-only">
            Güven ve denetlenebilirlik
          </h2>
          <div className="mx-auto mt-12 grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {GUVEN_ILKELERI.map(({ baslik, metin, Ikon }, index) => (
              <div
                key={baslik}
                className={`rounded-2xl border border-white/8 bg-white/[0.03] p-5 ${
                  index === GUVEN_ILKELERI.length - 1 ? "sm:col-span-2 lg:col-span-1" : ""
                }`}
              >
                <span className="mb-4 grid size-9 place-items-center rounded-lg bg-emerald-400/8 text-emerald-300 ring-1 ring-emerald-300/20">
                  <Ikon className="size-4.5" aria-hidden="true" />
                </span>
                <h3 className="text-[15px] font-semibold tracking-[-0.01em]">{baslik}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">{metin}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ------------------------------------------------ 8 · SON CTA */}
        <section aria-labelledby="cta-baslik" className="border-t border-white/8 py-20 lg:py-28">
          <div className="relative overflow-hidden rounded-3xl border border-cyan-200/15 bg-gradient-to-br from-[#0b1c2a] via-[#0a1622] to-[#101a2c] px-6 py-14 text-center sm:px-12">
            <div aria-hidden="true" className="absolute -top-24 left-1/2 size-[420px] -translate-x-1/2 rounded-full bg-cyan-400/10 blur-[110px]" />
            <p className="font-mono text-[11px] font-medium tracking-[0.28em] text-cyan-300/90 uppercase">
              Pilot programı
            </p>
            <h2 id="cta-baslik" className="mx-auto mt-4 max-w-2xl text-3xl font-semibold tracking-[-0.03em] text-balance sm:text-4xl">
              Wardproof&apos;u kurumunuzda pilot olarak deneyin
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-slate-300">
              Kapsamı birlikte belirleyelim; süreçlerinizin ne kadarının izlenebilir hale
              geldiğini kendi verinizle görün.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <a
                href={DEMO_MAILTO}
                className="group inline-flex h-12 items-center gap-1.5 rounded-xl bg-[#69d7dc] px-6 text-sm font-semibold text-[#061319] shadow-[0_12px_32px_rgba(59,210,210,.16)] transition-all hover:bg-[#8be7e9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
              >
                Demo Talep Et
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </a>
              <a
                href="/giris"
                className="inline-flex h-12 items-center rounded-xl border border-white/15 px-6 text-sm font-medium text-slate-200 transition-colors hover:border-white/30 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
              >
                Giriş Yap
              </a>
            </div>
          </div>
        </section>
      </div>

      {/* Alt bilgi */}
      <footer className="border-t border-white/8">
        <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-6 px-5 py-10 sm:px-8 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-md">
            <div className="flex items-center gap-2.5">
              <span className="grid size-7 shrink-0 place-items-center rounded-md border border-cyan-200/20 bg-cyan-300/10 text-cyan-200">
                <WardproofGlyph className="size-4.5" />
              </span>
              <span className="text-sm font-semibold tracking-[-0.01em]">Wardproof</span>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              Wardproof, kurumların uyum süreçlerini daha izlenebilir hale getirmek için
              geliştiriliyor ve pilot kullanım için hazırlanıyor.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm text-slate-400">
            {NAV_BAGLANTILARI.map((b) => (
              <a key={b.href} href={b.href} className="transition-colors hover:text-white">
                {b.etiket}
              </a>
            ))}
            <a href="/giris" className="transition-colors hover:text-white">
              Giriş Yap
            </a>
          </div>
        </div>
        <div className="border-t border-white/6">
          <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-2 px-5 py-5 font-mono text-[11px] tracking-[0.08em] text-slate-400 uppercase sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <span>Wardproof · Continuous compliance</span>
            <span>Finans kuruluşları için tasarlandı</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
