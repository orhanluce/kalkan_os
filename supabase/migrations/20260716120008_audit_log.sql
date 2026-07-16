-- Append-only per CLAUDE.md immutable rule 2. Rows are written by triggers
-- (wired in M2, when tenant_controls/evidences mutations exist to hang them
-- off of) and by server-side actions using the service role — never edited
-- or deleted, hence no update/delete policy and an explicit revoke.
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  eylem text not null,
  hedef_tablo text,
  hedef_id uuid,
  detay jsonb,
  created_at timestamptz not null default now()
);

create index audit_log_tenant_id_idx on public.audit_log (tenant_id);
create index audit_log_created_at_idx on public.audit_log (created_at);

alter table public.audit_log enable row level security;

create policy audit_log_select_own_tenant on public.audit_log
  for select
  using (tenant_id = public.current_tenant_id());

create policy audit_log_insert_own_tenant on public.audit_log
  for insert
  with check (tenant_id = public.current_tenant_id());

revoke update, delete on public.audit_log from authenticated, anon;
