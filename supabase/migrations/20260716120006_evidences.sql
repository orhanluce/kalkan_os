-- Append-only per CLAUDE.md immutable rule 2: no update/delete policy is
-- ever created for this table, and UPDATE/DELETE are revoked outright from
-- the client-facing roles so a future migration can't silently add one back
-- without also touching this revoke.
create table public.evidences (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  control_id uuid not null references public.controls (id) on delete cascade,
  tip text not null check (tip in ('dosya', 'link', 'beyan')),
  storage_path text,
  hash_sha256 text,
  yukleyen uuid references public.profiles (id) on delete set null,
  gecerlilik_bitis date,
  created_at timestamptz not null default now()
);

create index evidences_tenant_id_idx on public.evidences (tenant_id);
create index evidences_control_id_idx on public.evidences (control_id);

alter table public.evidences enable row level security;

create policy evidences_select_own_tenant on public.evidences
  for select
  using (tenant_id = public.current_tenant_id());

create policy evidences_insert_own_tenant on public.evidences
  for insert
  with check (tenant_id = public.current_tenant_id());

revoke update, delete on public.evidences from authenticated, anon;
