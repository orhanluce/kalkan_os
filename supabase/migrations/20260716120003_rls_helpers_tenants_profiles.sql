-- RLS helper functions + policies for tenants/profiles.
-- security definer + fixed search_path so the function can read profiles
-- (bypassing the caller's own RLS) without being hijacked via search_path.
create or replace function public.current_tenant_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select tenant_id from public.profiles where id = auth.uid()
$$;

create or replace function public.current_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select role from public.profiles where id = auth.uid()
$$;

alter table public.tenants enable row level security;
alter table public.profiles enable row level security;

-- A user may read only their own tenant row.
create policy tenants_select_own on public.tenants
  for select
  using (id = public.current_tenant_id());

-- Onboarding: any authenticated user may create a new tenant (they become
-- its first admin via the profile row created right after, at the app layer).
create policy tenants_insert_authenticated on public.tenants
  for insert
  with check (auth.role() = 'authenticated');

-- A user may read profiles within their own tenant.
create policy profiles_select_same_tenant on public.profiles
  for select
  using (tenant_id = public.current_tenant_id());

-- A user may update only their own profile row. RLS alone can't express
-- "role/tenant_id must stay the same" (USING/WITH CHECK don't see old+new
-- together), so that's enforced by the trigger below — without it, a user
-- could `update profiles set role = 'admin' where id = auth.uid()` and
-- pass this policy trivially since id never changes.
create policy profiles_update_self on public.profiles
  for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- Self-serve bootstrap only: a brand-new authenticated user may create
-- their own profile as 'admin' of a tenant, but only for a tenant that has
-- no profiles yet (i.e. the tenant they themselves just created via
-- tenants_insert_authenticated). Without the role/emptiness checks, any
-- authenticated user could insert role='admin' against ANY existing
-- tenant_id and hijack that tenant outright.
create policy profiles_insert_self on public.profiles
  for insert
  with check (
    id = auth.uid()
    and role = 'admin'
    and not exists (
      select 1 from public.profiles existing where existing.tenant_id = profiles.tenant_id
    )
  );

-- Inviting additional users (M1: "kullanıcı davet") is NOT this policy's
-- job — that must go through a future SECURITY DEFINER function that
-- verifies the caller is already an admin of the target tenant before
-- creating a profile row for someone else. TODO(M1): add
-- public.invite_user(target_user_id, tenant_id, role).

-- Escape hatch for that future admin-invoked role/tenant_id change function:
-- it can `select set_config('app.bypass_profile_guard', 'true', true)`
-- before its UPDATE so the trigger below lets the change through.
create or replace function public.prevent_profile_privilege_change()
returns trigger
language plpgsql
as $$
begin
  if current_setting('app.bypass_profile_guard', true) = 'true' then
    return new;
  end if;
  if new.role is distinct from old.role or new.tenant_id is distinct from old.tenant_id then
    raise exception 'role and tenant_id are immutable through profiles_update_self; use an admin-invoked function instead';
  end if;
  return new;
end;
$$;

create trigger profiles_prevent_privilege_change
  before update on public.profiles
  for each row execute function public.prevent_profile_privilege_change();
