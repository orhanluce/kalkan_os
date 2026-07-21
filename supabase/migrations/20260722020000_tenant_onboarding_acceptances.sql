-- Dikey G1: ilk girişte KVKK + pilot kullanım şartları kabulü — hukuki delil
-- niteliğinde, append-only (bir kabul kaydı asla silinmez/değiştirilmez).

create table public.tenant_onboarding_acceptances (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete restrict,
  kabul_edilen_belge text not null check (kabul_edilen_belge in ('KVKK', 'PILOT_KULLANIM_SARTLARI')),
  belge_surumu text not null,
  kabul_zamani timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (tenant_id, profile_id, kabul_edilen_belge, belge_surumu)
);

create index tenant_onboarding_acceptances_tenant_idx on public.tenant_onboarding_acceptances (tenant_id);

create or replace function public.tenant_onboarding_acceptances_immutable()
returns trigger
language plpgsql
as $$
begin
  raise exception 'tenant_onboarding_acceptances is append-only; UPDATE/DELETE is not permitted';
  return null;
end;
$$;

create trigger tenant_onboarding_acceptances_no_update
  before update on public.tenant_onboarding_acceptances
  for each row execute function public.tenant_onboarding_acceptances_immutable();
create trigger tenant_onboarding_acceptances_no_delete
  before delete on public.tenant_onboarding_acceptances
  for each row execute function public.tenant_onboarding_acceptances_immutable();

-- Kimlik atfı: kabul eden HER ZAMAN oturum sahibi (sahte "başkası adına
-- kabul" imkansız — M16'nın istisna/rollback guard'larıyla AYNI desen).
create or replace function public.tenant_onboarding_acceptance_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
begin
  if new.profile_id <> auth.uid() and auth.role() <> 'service_role' then
    raise exception 'tenant_onboarding_acceptances.profile_id must be the session holder';
  end if;
  select tenant_id into v_tenant_id from public.profiles where id = new.profile_id;
  if v_tenant_id is distinct from new.tenant_id then
    raise exception 'tenant_onboarding_acceptances: profile_id does not belong to tenant_id';
  end if;
  return new;
end;
$$;

create trigger tenant_onboarding_acceptance_guard_trigger
  before insert on public.tenant_onboarding_acceptances
  for each row execute function public.tenant_onboarding_acceptance_guard();

alter table public.tenant_onboarding_acceptances enable row level security;

create policy tenant_onboarding_acceptances_insert_self on public.tenant_onboarding_acceptances
  for insert
  with check (tenant_id = public.current_tenant_id() and profile_id = auth.uid());

create policy tenant_onboarding_acceptances_select_own_tenant on public.tenant_onboarding_acceptances
  for select
  using (tenant_id = public.current_tenant_id());

create policy tenant_onboarding_acceptances_select_platform_operator on public.tenant_onboarding_acceptances
  for select
  using (public.current_role() = 'platform_operator');
