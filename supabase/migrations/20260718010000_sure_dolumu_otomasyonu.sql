-- Süre-dolumu otomasyonu (docs/ROADMAP.md M16 tamamlama + M12 freshness borcu).
--
-- İKİ ZAMAN-TABANLI İŞ, aynı desen (idempotent SECURITY DEFINER fonksiyon):
--   sod_istisna_suresi_dolanlari_isle() — süresi dolan SoD istisnasını
--     'suresi_doldu' yapar ve çatışmayı REOPENED'e döndürür (kurucunun asıl
--     kontrol boşluğu: süre dolan istisna otomatik açılmalı).
--   kanit_suresi_dolanlari_isle()       — kanıtı süresi dolmuş bir kontrolü
--     'karsilaniyor'dan 'kismi'ye düşürür ve "Sistem" adına audit yazar
--     (M2 borcu; e2e/kanit-motoru.spec.ts'teki skip'i çözer).
--
-- NEDEN BullMQ DEĞİL: bu proje saf Postgres (kural 4); Redis/BullMQ
-- package.json'da yok ve ROADMAP §1.5'te ÜÇ kez reddedildi ("pg_cron + route
-- handler; idempotent job deseni korunur"). Bu migration o kararın operasyonel
-- karşılığı: mantık idempotent SQL fonksiyonunda, zamanlama pg_cron'da.
--
-- NEDEN pg_cron DEFANSİF BİR DO BLOĞUNDA: bu migration PGlite test harness'inde
-- de uygulanır (createTestDb tüm migration'ları koşar). PGlite'ta pg_cron yok;
-- doğrudan `create extension pg_cron` tüm RLS testlerini bozardı. DO bloğu +
-- exception handler ile: Supabase'de çalışır, PGlite'ta sessizce no-op olur.
-- Fonksiyonlar pg_cron'a BAĞIMLI DEĞİL — harici cron / route ile de çağrılabilir.

-- ============================================================================
-- 1. SoD istisna süre dolumu
-- ============================================================================

/**
 * Süresi dolan onaylı istisnaları işler.
 *
 * SÜRE DOLUMU TANIMI: `bitis` son GEÇERLİ gündür; istisna o gün hâlâ
 * geçerlidir, ertesi gün dolar. Yani `bitis < current_date` → dolmuş.
 * Karşılaştırma VERİTABANI zamanına göre (current_date), uygulama saatine
 * değil — kurucunun "DB zamanı esas" gereği.
 *
 * İDEMPOTENT: her UPDATE `durum = 'onaylandi'` koşuluyla yapılır; ikinci kez
 * koşulunca 'suresi_doldu' satırlar zaten eşleşmez, tekrar işlenmez. Aynı
 * istisna için tekrar audit/finding üretilmez.
 *
 * EŞZAMANLILIK: `for update skip locked` — iki worker aynı satırı almaz.
 *
 * HATA İZOLASYONU: her satır kendi BEGIN/EXCEPTION bloğunda; bir tenant'ın
 * satırındaki hata diğerlerini durdurmaz (kurucu gereği).
 *
 * GEÇMİŞ KORUNUR: mevcut MITIGATED sonucu GEÇERSİZ KILINMAZ. İşlev yalnız
 * EXCEPTION_APPROVED durumundaki çatışmayı açar — MITIGATED (telafi edici
 * kontrolle kapatılmış) çatışmaya dokunmaz; o ayrı bir mekanizma. Telafi edici
 * kontrol PASSED olsa bile, çatışma EXCEPTION_APPROVED ise istisna dolunca
 * açılır (istisna ile mitigasyon ayrı kapılar).
 */
create or replace function public.sod_istisna_suresi_dolanlari_isle()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  r record;
begin
  for r in
    select i.id, i.conflict_id, i.tenant_id
    from public.sod_istisnalari i
    where i.durum = 'onaylandi'
      and i.bitis < current_date
    for update skip locked
  loop
    begin
      update public.sod_istisnalari
        set durum = 'suresi_doldu'
        where id = r.id and durum = 'onaylandi';

      if found then
        -- Çatışmayı yalnızca istisnaya DAYANIYORSA (EXCEPTION_APPROVED) aç.
        update public.sod_catismalari
          set durum = 'REOPENED', son_gorulme_at = now()
          where id = r.conflict_id and durum = 'EXCEPTION_APPROVED';
        v_count := v_count + 1;
      end if;
    exception when others then
      -- Bir satırın hatası diğerlerini durdurmasın; işaretle, devam et.
      raise notice 'sod istisna % islenemedi: %', r.id, sqlerrm;
    end;
  end loop;
  return v_count;
end;
$$;

-- ============================================================================
-- 2. Kanıt süre dolumu (M2 borcu)
-- ============================================================================

/**
 * Kanıtı süresi dolmuş kontrolleri 'karsilaniyor' -> 'kismi' düşürür.
 *
 * KURAL (M2, deriveDurumFromEvidenceExpiry ile tutarlı): bir kontrol
 * 'karsilaniyor' ve o kontrolün EN AZ BİR süreli kanıtı varken, GEÇERLİ hiçbir
 * kanıtı kalmadıysa (null bitiş = süresiz geçerli; gelecek tarih = hâlâ
 * geçerli) 'kismi'ye düşer. 'acik'/'kapsam_disi' etkilenmez — zaten kanıta
 * dayanmıyorlar.
 *
 * "SİSTEM" ATFI: audit kaydı actor_id = null ile yazılır; audit-log-list bunu
 * "Sistem" gösterir. Bu bir insan eylemi değil, zamanlanmış bir yeniden
 * değerlendirmedir.
 *
 * NOT — İKİ AUDIT KAYDI: tenant_controls UPDATE'i mevcut audit trigger'ını da
 * tetikler ('durum_degisti', yine Sistem). Bizim açık 'kanit_suresi_doldu'
 * kaydımız NEDENİ söyler; trigger'ın 'durum_degisti'si mekanik değişimi. İkisi
 * de doğru; kaldırmıyoruz.
 */
create or replace function public.kanit_suresi_dolanlari_isle()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  r record;
begin
  for r in
    select tc.id, tc.tenant_id, tc.control_id
    from public.tenant_controls tc
    where tc.durum = 'karsilaniyor'
      and exists (
        select 1 from public.evidences e
        where e.tenant_id = tc.tenant_id and e.control_id = tc.control_id
          and e.gecerlilik_bitis is not null
      )
      and not exists (
        select 1 from public.evidences e
        where e.tenant_id = tc.tenant_id and e.control_id = tc.control_id
          and (e.gecerlilik_bitis is null or e.gecerlilik_bitis >= current_date)
      )
    for update skip locked
  loop
    begin
      update public.tenant_controls
        set durum = 'kismi', son_degerlendirme = now()
        where id = r.id and durum = 'karsilaniyor';

      if found then
        insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
        values (r.tenant_id, null, 'kanit_suresi_doldu', 'tenant_controls', r.control_id,
                jsonb_build_object('yeni_durum', 'kismi'));
        v_count := v_count + 1;
      end if;
    exception when others then
      raise notice 'kanit suresi kontrol % islenemedi: %', r.control_id, sqlerrm;
    end;
  end loop;
  return v_count;
end;
$$;

-- Bu fonksiyonlar SİSTEM işidir; istemci rolleri doğrudan çağıramamalı.
-- (service_role / pg_cron / postgres çağırır.)
revoke execute on function public.sod_istisna_suresi_dolanlari_isle() from authenticated, anon;
revoke execute on function public.kanit_suresi_dolanlari_isle() from authenticated, anon;

-- ============================================================================
-- 3. Zamanlama — pg_cron varsa (Supabase); yoksa no-op (PGlite / kısıtlı plan)
-- ============================================================================
do $$
begin
  execute 'create extension if not exists pg_cron';
  -- Günde bir (02:00 UTC) her iki süre-dolumu işini koştur.
  perform cron.schedule(
    'kalkan-sure-dolumu',
    '0 2 * * *',
    'select public.sod_istisna_suresi_dolanlari_isle(); select public.kanit_suresi_dolanlari_isle();'
  );
  raise notice 'pg_cron zamanlamasi kuruldu: kalkan-sure-dolumu';
exception when others then
  raise notice 'pg_cron kullanilamiyor (%). Sure-dolumu fonksiyonlari harici cron/route ile cagrilmali.', sqlerrm;
end $$;
