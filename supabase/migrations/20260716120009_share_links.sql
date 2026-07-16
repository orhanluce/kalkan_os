-- Auditor read-only sharing (M4 feature). Table + tenant-management RLS
-- land now; the guest-read policy (token holder reads only the scoped rows,
-- without being an authenticated tenant member) is deliberately deferred to
-- the M4 migration since it needs the actual share flow to design against —
-- see docs/ROADMAP.md M4. TODO(M4): add anon-token read policies here and
-- on the tables a share exposes (controls, tenant_controls, evidences).
create table public.share_links (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  token text not null unique default encode(gen_random_bytes(32), 'hex'),
  kapsam jsonb not null default '{}',
  olusturan uuid references public.profiles (id) on delete set null,
  son_gecerlilik timestamptz not null,
  created_at timestamptz not null default now()
);

create index share_links_tenant_id_idx on public.share_links (tenant_id);
create index share_links_token_idx on public.share_links (token);

alter table public.share_links enable row level security;

-- Tenant admin/uyum manage their own tenant's share links.
create policy share_links_all_own_tenant on public.share_links
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());
