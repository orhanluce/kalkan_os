-- Dikey E, E1: proof_room_links.cloud_assurance_profile_id İÇİN cross-tenant
-- guard. Diğer üç polimorfik hedefte (test_run_id/roi_export_run_id/
-- graph_snapshot_id) BENZER bir DB trigger'ı YOK — yalnız RLS'in kendi satır
-- tenant_id'sine dayanıyorlar, FK'lı hedefin tenant'ını doğrulamıyorlar. Bu,
-- mevcut borcu GENİŞLETMEZ (o üç dal dokunulmadı) — yalnız YENİ eklenen 4.
-- dalı kurucunun açık talebiyle ("Cross-tenant linking rejected at DB level")
-- korur.

create or replace function public.proof_room_link_cloud_assurance_tenant_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.cloud_assurance_profile_id is not null then
    if not exists (
      select 1 from public.cloud_assurance_profile_snapshots s
      where s.id = new.cloud_assurance_profile_id and s.tenant_id = new.tenant_id
    ) then
      raise exception 'cloud_assurance_profile_id farkli bir kiraciya ait olamaz (cross-tenant guard)';
    end if;
  end if;
  return new;
end;
$$;

create trigger proof_room_link_cloud_assurance_tenant_guard_trg
  before insert or update on public.proof_room_links
  for each row execute function public.proof_room_link_cloud_assurance_tenant_guard();
