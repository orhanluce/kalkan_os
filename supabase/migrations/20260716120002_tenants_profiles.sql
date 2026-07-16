-- Tenants and user profiles. profiles.id mirrors auth.users.id (Supabase Auth).
create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  segment text not null check (segment in ('araci_kurum', 'pys', 'kvhs', 'diger')),
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  role text not null check (role in ('admin', 'uyum', 'denetci_misafir')),
  full_name text,
  created_at timestamptz not null default now()
);

create index profiles_tenant_id_idx on public.profiles (tenant_id);

-- updated_at helper reused by later migrations
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
