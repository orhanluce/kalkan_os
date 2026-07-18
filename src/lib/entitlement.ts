// Entitlement — saf yetenek yorumlama (docs/ROADMAP.md V2 PR-2c, ADR-V2-3).
//
// TEK KAYNAK: yetenek matrisi (plan_versions.yetkiler jsonb) burada yorumlanır.
// Limitler KODA GÖMÜLÜ DEĞİL (V2 §7) — değerler DB'den gelir; bu modül yalnız
// "bu yetenek açık mı" sorusunu deterministik yanıtlar.
//
// GÜVENLİK SINIRI: bu saf mantıktır, yetki KAPISI değildir. Gerçek zorlama
// server rotalarında (entitlement-server.ts) + RLS'te (istemci abonelik
// yazamaz). UI bu modülü sunum için kullanır (yetenek dışı düğmeyi gizlemek
// meşru ama yetkilendirme DEĞİL).

export type Yetkiler = Record<string, unknown>;

/**
 * VARSAYILAN yetkiler: aboneliği OLMAYAN kiracı için (pilot/mevcut kiracılar
 * henüz faturalanmıyor). Bilinçli PERMISSIVE — mevcut yüzeyler (SoD, kontrol
 * testi) abonelik gelene dek çalışmaya devam etsin; yeni ücretli yetenekler
 * (erp_banka_review, denetci_alani) varsayılanda KAPALI. Abonelik atandığında
 * plan matrisi bunun yerini alır.
 */
export const VARSAYILAN_YETKILER: Yetkiler = {
  finans_baseline: true,
  kanit_kasasi: "tam",
  kontrol_testi: true,
  sod: "tam",
  erp_banka_review: false,
  denetci_alani: false,
  yonetim_raporu: "tam",
  regulasyon_paketi: "baseline",
  connector: "manuel",
  sso: false,
  dedicated: false,
};

/** Boolean yetenek açık mı (true değeri). */
export function yetenekAcik(yetkiler: Yetkiler, anahtar: string): boolean {
  return yetkiler[anahtar] === true;
}

/** Seviyeli yetenek belirli bir değerde/üstünde mi. */
export function yetenekDegeri(yetkiler: Yetkiler, anahtar: string): string | null {
  const v = yetkiler[anahtar];
  return typeof v === "string" ? v : null;
}

// --- Rota kapıları için NAMED yetenek kontrolleri (tek yerde tanımlı) ---

/** SoD yazma işlemleri (kural/atama/import/değerlendirme) tam SoD ister;
 * Starter yalnız "gorunum" (okuma). */
export function sodTamMi(yetkiler: Yetkiler): boolean {
  return yetenekDegeri(yetkiler, "sod") === "tam";
}

/** ERP/banka erişim gözden geçirme (Pro+). */
export function erpBankaReviewAcikMi(yetkiler: Yetkiler): boolean {
  return yetenekAcik(yetkiler, "erp_banka_review");
}

/** Denetçi alanı (Governance / Regulated). */
export function denetciAlaniAcikMi(yetkiler: Yetkiler): boolean {
  return yetenekAcik(yetkiler, "denetci_alani");
}

/** Trial süresi DB zamanına göre dolmuş mu (istemci saatine güvenilmez —
 * `simdi` çağıran tarafından DB now()'dan verilir, saf tutmak için enjekte). */
export function trialDoldu(trialBitis: string | null, simdi: Date): boolean {
  if (!trialBitis) return false;
  return new Date(trialBitis) < simdi;
}
