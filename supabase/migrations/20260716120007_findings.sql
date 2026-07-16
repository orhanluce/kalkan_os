create table public.findings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  kaynak text not null check (kaynak in ('sizma_testi', 'denetim', 'ic_tespit')),
  onem text not null check (onem in ('acil', 'kritik', 'yuksek', 'orta', 'dusuk')),
  baslik text not null,
  aksiyon_plani text,
  yk_onay_tarihi date,
  hedef_kapama date,
  durum text not null default 'acik' check (durum in ('acik', 'kapali')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index findings_tenant_id_idx on public.findings (tenant_id);

create trigger findings_set_updated_at
  before update on public.findings
  for each row execute function public.set_updated_at();

alter table public.findings enable row level security;

create policy findings_all_own_tenant on public.findings
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());
