-- simulation_action_result_guard, CASCADE DELETE'i kendi kendine engelliyordu.
--
-- BULUNAN HATA: `simulation_runs` satırı silindiğinde, `on delete cascade`
-- ile `simulation_action_results` satırları da silinir. Bu cascade silme,
-- `simulation_action_result_guard` (before insert/update/DELETE) trigger'ını
-- tetikler. Trigger, DELETE için erken çıkış (`if TG_OP = 'DELETE' then
-- return old`) İÇERİYORDU ama bunu ebeveyn tatbikatı arayan sorgudan SONRA
-- yapıyordu — ebeveyn `simulation_runs` satırı cascade sırasında zaten
-- silinmiş olduğundan sorgu hiçbir şey bulamıyor, trigger "Tatbikat
-- bulunamadi" fırlatıyor ve TÜM DELETE İŞLEMİ (transaction) başarısız oluyor.
--
-- SONUÇ: aksiyon sonucu olan bir tatbikat ASLA silinemiyordu — cascade'in
-- kendisi kendini bloke ediyordu. scripts/setup-e2e-fixtures.ts'in e2e
-- kiracısını sıfırlama adımında bulundu (3 test run'ı hiç silinmeden birikti).
--
-- DÜZELTME: DELETE erken çıkışı fonksiyonun EN BAŞINA taşındı — silinen bir
-- satır için hiçbir doğrulama gerekmez, cascade zaten üst tablonun kendi
-- bütünlük kararının bir sonucudur.
create or replace function public.simulation_action_result_guard()
returns trigger
language plpgsql
as $$
declare
  v_durum text;
  v_version_id uuid;
begin
  if TG_OP = 'DELETE' then
    return old;
  end if;

  select durum, version_id into v_durum, v_version_id
  from public.simulation_runs
  where id = new.run_id;

  if v_durum is null then
    raise exception 'Tatbikat bulunamadi';
  end if;

  if v_durum not in ('calisiyor', 'duraklatildi', 'tamamlandi') then
    raise exception 'Aksiyon sonucu bu asamada isaretlenemez (durum: %)', v_durum;
  end if;

  if not exists (
    select 1 from public.scenario_expected_actions
    where id = new.expected_action_id and version_id = v_version_id
  ) then
    raise exception 'Beklenen aksiyon bu tatbikatin senaryo surumune ait degil';
  end if;

  return new;
end;
$$;
