-- Test koşusu DEĞİŞMEZ — service_role dahil (docs/ROADMAP.md M12, kural 2/13).
--
-- NEDEN AYRI MIGRATION: 20260717230000 canlıya uygulandı; uygulanmış dosyayı
-- düzenlemek kayıt ile dosyayı ayrıştırır. Ekleme yapılır.
--
-- NEDEN GEREKLİ: 20260717230000 append-only'i yalnız `revoke ... from
-- authenticated, anon` ile kuruyordu. Ama bu service_role'ü DURDURMAZ — canlı
-- doğrulama bunu gösterdi: PGlite testi (authenticated) UPDATE'i reddederken,
-- service_role ile UPDATE geçiyordu. test_runs, kural 13 güvence durumunu
-- besleyen bir bütünlük olgusudur (simulation_result_manifests gibi); sessizce
-- düzeltilebilen bir test sonucu, denetimin dayanağını yok eder.
--
-- Bu yüzden manifest desenini uyguluyoruz: trigger UPDATE'i HER ZAMAN reddeder,
-- DELETE'e yalnız cascade için izin verir (kontrol/kiracı silinince koşular da
-- gitmeli — trigger kendi cascade'ini bloke etmemeli, 20260717170000 dersi).

create or replace function public.test_run_immutable()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    return old;
  end if;
  raise exception 'Test sonucu degistirilemez (M12, append-only, kural 13)';
end;
$$;

create trigger test_run_immutable_before_update
  before update on public.test_runs
  for each row execute function public.test_run_immutable();
