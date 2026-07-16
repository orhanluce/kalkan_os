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

-- A user may update only their own profile row (not role/tenant_id changes;
-- enforce role/tenant_id immutability at the application layer for now).
create policy profiles_update_self on public.profiles
  for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- New profile row is created by the signup flow for the user themselves.
create policy profiles_insert_self on public.profiles
  for insert
  with check (id = auth.uid());
