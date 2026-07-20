-- Dikey E, E2, Kapı 1 (docs/adr/PR0-dikeyE2-telafi-edici-kontrol-proof-room-
-- 2026-07-20.md §1): proof_room_links'in DÖRT polimorfik hedefi için TEK
-- merkezi cross-tenant guard. E1'in dar `proof_room_link_cloud_assurance_
-- tenant_guard()`'ı (yalnız cloud_assurance_profile_id) BURADA KALDIRILIYOR
-- ve yerine dördünü birden (test_run_id/roi_export_run_id/graph_snapshot_id/
-- cloud_assurance_profile_id) doğrulayan TEK fonksiyon konuyor — kurucunun
-- "ayrı ve tekrar eden trigger oluşturma" şartı.
--
-- GÜVENLİK AÇIĞI (E1'in kendi ADR'sinde kayıtlı, şimdi kapatılıyor): eski üç
-- hedefte (test_run_id/roi_export_run_id/graph_snapshot_id) HİÇBİR ZAMAN
-- FK-hedef tenant doğrulaması yoktu — yalnız satırın kendi tenant_id'si
-- RLS'le korunuyordu. Bir kiracı, KENDİ tenant_id'siyle BAŞKA bir kiracının
-- test_run/roi_export/graph_snapshot id'sini vererek link kurabiliyordu.
--
-- INSERT VE UPDATE'te çalışır (hedef alanının sonradan değiştirilme
-- ihtimaline karşı) — security definer + trigger, RLS'e değil trigger'a
-- dayanır, service_role dahil atlanamaz.

drop trigger if exists proof_room_link_cloud_assurance_tenant_guard_trg on public.proof_room_links;
drop function if exists public.proof_room_link_cloud_assurance_tenant_guard();

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

  return new;
end;
$$;

create trigger proof_room_link_target_guard_trg
  before insert or update on public.proof_room_links
  for each row execute function public.proof_room_link_target_guard();
