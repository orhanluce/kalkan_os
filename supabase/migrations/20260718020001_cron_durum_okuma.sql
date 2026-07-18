-- pg_cron iş durumu okuma (docs/ROADMAP.md M16 PR-3 §3 doğrulama + iş görünürlüğü).
--
-- NEDEN: kurucu "eski schedule kaldırılıyor mu? duplicate oluşuyor mu?" ve
-- "başarısız işler görünürlüğe sahip olmalı" diyor. Service client cron.job'u
-- doğrudan okuyamaz (cron şeması PostgREST'e açık değil); bu SECURITY DEFINER
-- fonksiyon o pencereyi açar. İleride SoD dashboard'u (#8) bunu kullanabilir.
--
-- PGlite-GÜVENLİ: dinamik EXECUTE + exception handler. cron şeması yoksa
-- (PGlite / pg_cron kapalı plan) boş döner, migration bozulmaz, testler geçer.
-- Statik `from cron.job` yazsaydık SQL fonksiyon gövde-doğrulaması PGlite'ta
-- fonksiyon oluşturmayı patlatırdı.

create or replace function public.sod_cron_durumu()
returns table (jobname text, schedule text, active boolean)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query execute
    'select j.jobname::text, j.schedule::text, j.active from cron.job j where j.jobname = $1'
    using 'kalkan-sure-dolumu';
exception when others then
  return; -- pg_cron yok: boş sonuç (hata değil, bilgi yokluğu)
end;
$$;

-- Yalnız sistem/servis okusun — iş durumu operasyonel bir detay, istemciye açık değil.
revoke execute on function public.sod_cron_durumu() from authenticated, anon;
