-- M18 Training & Competency — "sonraki dilim" borcu (20260719060000'de
-- kaydedildi, ROADMAP §1.30): "retraining otomasyonu (periyot dolunca yeniden
-- atama cron)". SoD süre-dolumu (20260718010000) ve TPR sözleşme süre-dolumu
-- (20260719000000) ile AYNI pg_cron deseni — yeni bir zamanlayıcı altyapısı
-- kurulmadı (kural 4: BullMQ YOK).
--
-- ÖNCE: training_assignments (requirement_id, kullanici) TAM unique'ti — bir
-- kullanıcı bir gereksinimi YALNIZ BİR KEZ tamamlayabiliyordu. Periyodik eğitim
-- (ör. yıllık KVKK, periyot_gun dolu) süresi dolunca YENİDEN atanamıyordu.
-- SONRA: unique kısıt PARTIAL hale getirildi (impact_tolerances "tek
-- yürürlükte" deseninin aynısı — 20260719040000) — yalnız ATANDI durumunda
-- tekil; TAMAMLANDI satırlar TARİHSEL olarak kalır (istisna uzatma deseni:
-- yeni kayıt, geçmiş silinmez), periyot dolunca YENİ bir ATANDI satırı doğar.

alter table public.training_assignments drop constraint training_assignments_requirement_id_kullanici_key;

create unique index training_assignments_tek_aktif
  on public.training_assignments (requirement_id, kullanici)
  where durum = 'ATANDI';

/**
 * RETRAINING CRON'U: periyot_gun dolu bir gereksinimin TAMAMLANDI ataması,
 * son tamamlanmadan periyot_gun kadar süre geçtiyse ve o kullanıcının o
 * gereksinim için hâlâ AKTİF (ATANDI) bir ataması yoksa, YENİ bir ATANDI
 * ataması doğurur (idempotent — for update skip locked, aktif atama varsa
 * tekrar atamaz).
 */
create or replace function public.egitim_periyot_yenile()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kayit record;
  v_yeni_id uuid;
begin
  for v_kayit in
    select ta.id as eski_atama_id, ta.tenant_id, ta.requirement_id, ta.kullanici, tr.periyot_gun, tc.tamamlandi_at
    from public.training_assignments ta
    join public.training_requirements tr on tr.id = ta.requirement_id
    join public.training_completions tc on tc.assignment_id = ta.id
    where ta.durum = 'TAMAMLANDI'
      and tr.periyot_gun is not null
      and tc.tamamlandi_at < now() - (tr.periyot_gun || ' days')::interval
      and not exists (
        select 1 from public.training_assignments ta2
        where ta2.requirement_id = ta.requirement_id
          and ta2.kullanici = ta.kullanici
          and ta2.durum = 'ATANDI'
      )
    for update of ta skip locked
  loop
    begin
      insert into public.training_assignments (tenant_id, requirement_id, kullanici, durum)
      values (v_kayit.tenant_id, v_kayit.requirement_id, v_kayit.kullanici, 'ATANDI')
      returning id into v_yeni_id;

      insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
      values (v_kayit.tenant_id, null, 'egitim_periyot_yenilendi', 'training_assignments', v_yeni_id,
        jsonb_build_object('requirement_id', v_kayit.requirement_id, 'kullanici', v_kayit.kullanici,
          'onceki_atama_id', v_kayit.eski_atama_id, 'onceki_tamamlanma', v_kayit.tamamlandi_at));
    exception when others then
      raise notice 'egitim periyot yenileme (req=%, kullanici=%) basarisiz: %', v_kayit.requirement_id, v_kayit.kullanici, sqlerrm;
    end;
  end loop;
end;
$$;

revoke execute on function public.egitim_periyot_yenile() from authenticated, anon;

do $$
begin
  perform cron.schedule('kalkan-egitim-periyot-yenile', '0 3 * * *', 'select public.egitim_periyot_yenile();');
exception when others then
  raise notice 'pg_cron kullanilamiyor (egitim periyot yenileme zamanlanmadi): %', sqlerrm;
end;
$$;
