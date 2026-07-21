-- Dikey F, F2: proof_room_link_target_guard() BEŞİNCİ hedefe (kritik_hizmet_
-- test_paketi_snapshot_id) genişler. GÜNCEL sürüm (20260720280000, grep
-- doğrulandı — bu, fonksiyona yapılan tek ve en son forward-fix) TAM olarak
-- temel alındı; yalnız beşinci if bloğu eklendi. Diğer dört kontrol DEĞİŞMEDİ.

create or replace function public.proof_room_link_target_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.test_run_id is not null then
    if not exists (
      select 1 from public.test_runs r where r.id = new.test_run_id and r.tenant_id = new.tenant_id
    ) then
      raise exception 'test_run_id farkli bir kiraciya ait olamaz (cross-tenant guard)';
    end if;
  end if;

  if new.roi_export_run_id is not null then
    if not exists (
      select 1 from public.roi_export_runs r where r.id = new.roi_export_run_id and r.tenant_id = new.tenant_id
    ) then
      raise exception 'roi_export_run_id farkli bir kiraciya ait olamaz (cross-tenant guard)';
    end if;
  end if;

  if new.graph_snapshot_id is not null then
    if not exists (
      select 1 from public.impact_graph_snapshots s where s.id = new.graph_snapshot_id and s.tenant_id = new.tenant_id
    ) then
      raise exception 'graph_snapshot_id farkli bir kiraciya ait olamaz (cross-tenant guard)';
    end if;
  end if;

  if new.cloud_assurance_profile_id is not null then
    if not exists (
      select 1 from public.cloud_assurance_profile_snapshots s where s.id = new.cloud_assurance_profile_id and s.tenant_id = new.tenant_id
    ) then
      raise exception 'cloud_assurance_profile_id farkli bir kiraciya ait olamaz (cross-tenant guard)';
    end if;
  end if;

  if new.kritik_hizmet_test_paketi_snapshot_id is not null then
    if not exists (
      select 1 from public.kritik_hizmet_test_paketi_snapshots s
      where s.id = new.kritik_hizmet_test_paketi_snapshot_id and s.tenant_id = new.tenant_id
    ) then
      raise exception 'kritik_hizmet_test_paketi_snapshot_id farkli bir kiraciya ait olamaz (cross-tenant guard)';
    end if;
  end if;

  return new;
end;
$$;
