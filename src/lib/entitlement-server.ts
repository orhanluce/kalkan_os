// Entitlement server-side zorlama (docs/ROADMAP.md V2 PR-2c, ADR-V2-3).
//
// Rota, "bu kiracının aktif planı X yeteneğini içeriyor mu?" sorusunu BURADAN
// sorar. Aktif abonelik yoksa VARSAYILAN_YETKILER (pilot/mevcut kiracı —
// permissive; yeni ücretli yetenekler kapalı). Abonelik varsa plan sürümünün
// matrisi geçerlidir. Yetenek yorumu saf katmanda (entitlement.ts, tek kaynak).
//
// GÜVENLİK: istemci abonelik YAZAMAZ (RLS revoke) — forged plan claim DB'de
// reddedilir. Bu yüzden buradaki okuma güvenilirdir (RLS altında yalnız kendi
// kiracısının aboneliği).
import type { SupabaseClient } from "@supabase/supabase-js";
import { VARSAYILAN_YETKILER, type Yetkiler } from "./entitlement";
import type { Database } from "./supabase/database.types";

/**
 * Kiracının aktif yeteneklerini döndürür. Abonelik yoksa varsayılan.
 * `db` çağıranın (kullanıcı oturumlu) client'ı — RLS abonelikleri kendi
 * kiracısına sınırlar.
 */
export async function aktifYetkiler(db: SupabaseClient<Database>, tenantId: string): Promise<Yetkiler> {
  const { data } = await db
    .from("tenant_subscriptions")
    .select("durum, plan_versions(yetkiler)")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!data || data.durum !== "aktif") {
    return VARSAYILAN_YETKILER;
  }
  const pv = data.plan_versions as unknown as { yetkiler: Yetkiler } | null;
  return pv?.yetkiler ?? VARSAYILAN_YETKILER;
}

/**
 * Rota kapısı: yetenek kontrolü. `kontrol` saf bir predicate (entitlement.ts'ten
 * sodTamMi gibi). İzin yoksa çağıran 403 döner.
 */
export async function entitlementGerekli(
  db: SupabaseClient<Database>,
  tenantId: string,
  kontrol: (y: Yetkiler) => boolean,
): Promise<boolean> {
  const yetkiler = await aktifYetkiler(db, tenantId);
  return kontrol(yetkiler);
}
