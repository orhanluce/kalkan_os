create table public.tenant_controls (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  control_id uuid not null references public.controls (id) on delete cascade,
  durum text not null default 'acik' check (durum in ('karsilaniyor', 'kismi', 'acik', 'kapsam_disi')),
  sorumlu_user_id uuid references public.profiles (id) on delete set null,
  son_degerlendirme timestamptz,
  not_metni text,
  updated_at timestamptz not null default now(),
  unique (tenant_id, control_id)
);

create index tenant_controls_tenant_id_idx on public.tenant_controls (tenant_id);
create index tenant_controls_control_id_idx on public.tenant_controls (control_id);

create trigger tenant_controls_set_updated_at
  before update on public.tenant_controls
  for each row execute function public.set_updated_at();

alter table public.tenant_controls enable row level security;

create policy tenant_controls_all_own_tenant on public.tenant_controls
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());
