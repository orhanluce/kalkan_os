// LOKAL MOCK VERİ — gerçek Supabase projesi bağlanana kadar UI'ı
// beslemek için kullanılır. GERÇEK MEVZUAT İÇERİĞİ DEĞİLDİR: madde_ref
// alanları data/controls/vii-128-10.yaml ile aynı TODO-DOGRULA
// disiplinini taşır. Bu dosya seed script'i tarafından KULLANILMAZ.
import type { Control, ControlMapping, Finding, Framework, Tenant, TenantControl } from "./types";

export const mockTenant: Tenant = {
  id: "t-demo",
  name: "Demo Aracı Kurum A.Ş.",
  segment: "araci_kurum",
  createdAt: "2026-01-15T00:00:00Z",
};

export const mockFramework: Framework = {
  id: "f-vii128",
  code: "VII-128.10",
  name: "VII-128.10 (TASLAK BAŞLIK — DOĞRULANACAK)",
  version: "TODO-DOGRULA",
  yururlukTarihi: null,
};

export const mockFramework7545: Framework = {
  id: "f-7545",
  code: "7545",
  name: "7545 sayılı Kanun İkincil Mevzuatı (TASLAK — DOĞRULANACAK)",
  version: "v0-taslak",
  yururlukTarihi: null,
};

export const mockFrameworks: Framework[] = [mockFramework, mockFramework7545];

export const mockControls: Control[] = [
  {
    id: "c-01",
    frameworkId: "f-vii128",
    maddeRef: "TODO-DOGRULA-01",
    baslik: "Yönetim kurulu uyum sorumluluğu",
    aciklama: "Yönetim kurulunun mevzuata sürekli uyumdan sorumlu olduğuna dair beyan ve karar kaydı.",
    kanitTipi: ["beyan", "dosya"],
    periyot: "yillik",
    kritiklik: 5,
  },
  {
    id: "c-05",
    frameworkId: "f-vii128",
    maddeRef: "TODO-DOGRULA-05",
    baslik: "Bilgi sistemleri güvenlik politikası",
    aciklama: "Bilgi güvenliği politika dokümanı ve onay kaydı.",
    kanitTipi: ["dosya"],
    periyot: "yillik",
    kritiklik: 5,
  },
  {
    id: "c-06",
    frameworkId: "f-vii128",
    maddeRef: "TODO-DOGRULA-06",
    baslik: "Sızma testi / güvenlik testi",
    aciklama: "Yılda en az bir kez yaptırılan sızma testi raporu (geçerlilik süresi 1 yıl).",
    kanitTipi: ["dosya"],
    periyot: "yillik",
    kritiklik: 5,
  },
  {
    id: "c-07",
    frameworkId: "f-vii128",
    maddeRef: "TODO-DOGRULA-07",
    baslik: "İş sürekliliği ve felaket kurtarma planı",
    aciklama: "İş sürekliliği planı ve en güncel tatbikat raporu (RTO/RPO alanları dahil).",
    kanitTipi: ["dosya"],
    periyot: "yillik",
    kritiklik: 5,
  },
  {
    id: "c-09",
    frameworkId: "f-vii128",
    maddeRef: "TODO-DOGRULA-09",
    baslik: "Veri yerelleştirme / birincil-ikincil sistem konumu",
    aciklama: "Birincil ve ikincil sistemlerin yurt içinde bulunduğuna dair teknik/sözleşmesel kanıt.",
    kanitTipi: ["dosya", "beyan"],
    periyot: "surekli",
    kritiklik: 5,
  },
  {
    id: "c-10",
    frameworkId: "f-vii128",
    maddeRef: "TODO-DOGRULA-10",
    baslik: "Personel yetkinlik ve lisanslama",
    aciklama: "İlgili personelin SPK lisans/yetkinlik belgelerinin güncelliği.",
    kanitTipi: ["dosya"],
    periyot: "surekli",
    kritiklik: 2,
  },
  {
    id: "c-11",
    frameworkId: "f-vii128",
    maddeRef: "TODO-DOGRULA-11",
    baslik: "Müşteri şikayetleri yönetimi",
    aciklama: "Şikayet kayıt, takip ve çözüm süreci işleyiş kanıtı.",
    kanitTipi: ["dosya"],
    periyot: "surekli",
    kritiklik: 2,
  },
  {
    id: "c-12",
    frameworkId: "f-vii128",
    maddeRef: "TODO-DOGRULA-12",
    baslik: "Çıkar çatışması politikası",
    aciklama: "Çıkar çatışması politikası dokümanı ve ihlal kayıtları.",
    kanitTipi: ["dosya"],
    periyot: "yillik",
    kritiklik: 3,
  },
  // 7545 — taslak/v0, data/controls/7545.yaml ile aynı disiplin.
  {
    id: "c-7545-01",
    frameworkId: "f-7545",
    maddeRef: "TODO-DOGRULA-7545-01",
    baslik: "Bilgi güvenliği politikası (7545 karşılığı)",
    aciklama: "VII-128.10 TODO-DOGRULA-05 ile eşdeğer olması beklenen bilgi güvenliği politikası şartı.",
    kanitTipi: ["dosya"],
    periyot: "yillik",
    kritiklik: 5,
  },
  {
    id: "c-7545-02",
    frameworkId: "f-7545",
    maddeRef: "TODO-DOGRULA-7545-02",
    baslik: "İş sürekliliği planı (7545 karşılığı)",
    aciklama: "VII-128.10 TODO-DOGRULA-07 ile eşdeğer olması beklenen iş sürekliliği/felaket kurtarma şartı.",
    kanitTipi: ["dosya"],
    periyot: "yillik",
    kritiklik: 5,
  },
];

// "Bir kanıt, dört çerçeve": VII-128.10 kontrolüne yüklenen kanıt, eşlenik
// 7545 kontrolünde de görünür (bkz. src/lib/store.tsx addEvidence).
export const mockControlMappings: ControlMapping[] = [
  { id: "cm-01", controlIdA: "c-05", controlIdB: "c-7545-01", iliski: "esdeger" },
  { id: "cm-02", controlIdA: "c-07", controlIdB: "c-7545-02", iliski: "esdeger" },
];

export const mockTenantControls: TenantControl[] = [
  { id: "tc-01", tenantId: "t-demo", controlId: "c-01", durum: "karsilaniyor", sorumluUserId: null, sonDegerlendirme: "2026-06-01", notMetni: null },
  { id: "tc-05", tenantId: "t-demo", controlId: "c-05", durum: "kismi", sorumluUserId: null, sonDegerlendirme: "2026-05-10", notMetni: "Politika güncelleniyor" },
  { id: "tc-06", tenantId: "t-demo", controlId: "c-06", durum: "acik", sorumluUserId: null, sonDegerlendirme: null, notMetni: null },
  { id: "tc-07", tenantId: "t-demo", controlId: "c-07", durum: "acik", sorumluUserId: null, sonDegerlendirme: null, notMetni: null },
  { id: "tc-09", tenantId: "t-demo", controlId: "c-09", durum: "kismi", sorumluUserId: null, sonDegerlendirme: "2026-03-01", notMetni: "Supabase yurt içi taşıma bekleniyor" },
  { id: "tc-10", tenantId: "t-demo", controlId: "c-10", durum: "karsilaniyor", sorumluUserId: null, sonDegerlendirme: "2026-04-01", notMetni: null },
  { id: "tc-11", tenantId: "t-demo", controlId: "c-11", durum: "karsilaniyor", sorumluUserId: null, sonDegerlendirme: "2026-04-01", notMetni: null },
  { id: "tc-12", tenantId: "t-demo", controlId: "c-12", durum: "kapsam_disi", sorumluUserId: null, sonDegerlendirme: null, notMetni: "Bu segment için uygulanmıyor" },
  { id: "tc-7545-01", tenantId: "t-demo", controlId: "c-7545-01", durum: "acik", sorumluUserId: null, sonDegerlendirme: null, notMetni: null },
  { id: "tc-7545-02", tenantId: "t-demo", controlId: "c-7545-02", durum: "acik", sorumluUserId: null, sonDegerlendirme: null, notMetni: null },
];

export const mockFindings: Finding[] = [
  {
    id: "fn-01",
    tenantId: "t-demo",
    kaynak: "sizma_testi",
    onem: "kritik",
    baslik: "Harici ağ segmentasyonu eksikliği",
    aksiyonPlani: "Güvenlik duvarı kuralları gözden geçirilecek",
    ykOnayTarihi: "2026-06-15",
    hedefKapama: "2026-09-30",
    durum: "acik",
  },
  {
    id: "fn-02",
    tenantId: "t-demo",
    kaynak: "ic_tespit",
    onem: "orta",
    baslik: "Şikayet kayıt formunda eksik alan",
    aksiyonPlani: "Form güncellenecek",
    ykOnayTarihi: null,
    hedefKapama: "2026-08-01",
    durum: "kapali",
  },
];
