-- İstisna süre-kilidi + pg_cron sıklığı (docs/ROADMAP.md M16 PR-3 ön koruma).
--
-- İKİ KORKULUK, kurucu talimatı 18 Temmuz (PR-3 §2 ve §3):
--
--   1. ONAYLI/DOLMUŞ İSTİSNA DEĞİŞTİRİLEMEZ: EXCEPTION_APPROVED (durum
--      'onaylandi') veya EXPIRED (durum 'suresi_doldu') bir istisnanın süre ve
--      kimlik alanları (bitis/talep_eden_id/onaylayan_id/conflict_id/tenant_id)
--      UPDATE ile değiştirilemez. Süre uzatmak için mevcut kaydı düzenleme yolu
--      KAPALI — uzatma ayrı bir PR'da yeni talep + bağımsız onayla gelecek (#3).
--      Bu, CSV import tamamlanana kadar bir yönetişim açığı oluşmasını önler.
--
--   2. pg_cron SIKLIĞI 5 DAKİKA: günde bir tarama (02:00) fazla seyrekti —
--      istisna dolduktan sonra çatışma ~24 saat kapalı görünebilirdi. Artık
--      */5 (5 dakikada bir). Aynı isim (kalkan-sure-dolumu), duplicate yok.

-- ============================================================================
-- 1. Onaylı/dolmuş istisna süre-kimlik kilidi
-- ============================================================================

/**
 * DURUM GEÇİŞİNE DOKUNMAZ, ALANLARI DONDURUR: `durum` frozen listede DEĞİL —
 * yani onaylandi -> suresi_doldu (süre-dolumu işi) ve onaylandi -> iptal
 * (bilinçli iptal, iptal_eden kaydıyla) hâlâ mümkün. Kilitlenen yalnızca süre
 * ve KİMLİK alanlarıdır. Böylece uzatma (bitis değiştirme) engellenir ama
 * meşru durum geçişleri çalışmaya devam eder.
 */
create or replace function public.sod_istisna_kilit_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.durum in ('onaylandi', 'suresi_doldu') then
    if new.bitis is distinct from old.bitis
       or new.talep_eden_id is distinct from old.talep_eden_id
       or new.onaylayan_id is distinct from old.onaylayan_id
       or new.conflict_id is distinct from old.conflict_id
       or new.tenant_id is distinct from old.tenant_id then
      raise exception 'Onaylanmis/suresi dolmus istisnanin sure/kimlik alanlari degistirilemez; uzatma icin ayri talep+onay gerekir (M16 #3)';
    end if;
  end if;
  return new;
end;
$$;

create trigger sod_istisna_kilit_guard_before_update
  before update on public.sod_istisnalari
  for each row execute function public.sod_istisna_kilit_guard();

-- ============================================================================
-- 2. pg_cron sıklığı: günlük -> her 5 dakika
-- ============================================================================
-- Aynı iş adı (kalkan-sure-dolumu) ile yeniden zamanlama pg_cron'da UPSERT'tir
-- (isme göre), duplicate oluşmaz. Yine de eski kaydı önce kaldırıp temizce
-- yeniden kuruyoruz (eski pg_cron sürümlerinde upsert garantisi yok diye).
-- Hepsi defansif: PGlite'ta pg_cron yok, DO bloğu no-op olur ve testler bozulmaz.
do $$
begin
  perform cron.unschedule('kalkan-sure-dolumu');
exception when others then
  null; -- iş yoksa / pg_cron yoksa sessiz geç
end $$;

do $$
begin
  execute 'create extension if not exists pg_cron';
  perform cron.schedule(
    'kalkan-sure-dolumu',
    '*/5 * * * *',
    'select public.sod_istisna_suresi_dolanlari_isle(); select public.kanit_suresi_dolanlari_isle();'
  );
  raise notice 'pg_cron yeniden zamanlandi: kalkan-sure-dolumu her 5 dakika';
exception when others then
  raise notice 'pg_cron kullanilamiyor (%); sure-dolumu harici cron/route ile cagrilmali.', sqlerrm;
end $$;
