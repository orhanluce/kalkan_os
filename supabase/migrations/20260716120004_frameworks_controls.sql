-- Global regulatory reference data. NOT tenant-scoped: every tenant reads
-- the same control library. Content is never authored by hand in SQL or by
-- an LLM — rows come only from data/controls/*.yaml via scripts/seed-controls.ts
-- (see CLAUDE.md immutable rule 3).
create table public.frameworks (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code in ('VII-128.10', '7545', 'BDDK', 'DORA')),
  name text not null,
  version text not null,
  yururluk_tarihi date
);

create table public.controls (
  id uuid primary key default gen_random_uuid(),
  framework_id uuid not null references public.frameworks (id) on delete cascade,
  madde_ref text not null,
  baslik text not null,
  aciklama text,
  kanit_tipi text[] not null default '{}',
  periyot text not null check (periyot in ('yillik', 'surekli', 'olay_bazli')),
  kritiklik smallint not null check (kritiklik between 1 and 5),
  unique (framework_id, madde_ref)
);

create index controls_framework_id_idx on public.controls (framework_id);

-- "Bir kanıt, dört çerçeve": symmetric equivalence/partial mapping between
-- controls of different frameworks.
create table public.control_mappings (
  id uuid primary key default gen_random_uuid(),
  control_id_a uuid not null references public.controls (id) on delete cascade,
  control_id_b uuid not null references public.controls (id) on delete cascade,
  iliski text not null check (iliski in ('esdeger', 'kismi')),
  check (control_id_a <> control_id_b),
  unique (control_id_a, control_id_b)
);

alter table public.frameworks enable row level security;
alter table public.controls enable row level security;
alter table public.control_mappings enable row level security;

-- Reference data: readable by any authenticated user, writable only via
-- migrations/seed scripts run with the service role (which bypasses RLS) —
-- deliberately no insert/update/delete policy for regular clients.
create policy frameworks_select_authenticated on public.frameworks
  for select
  using (auth.role() = 'authenticated');

create policy controls_select_authenticated on public.controls
  for select
  using (auth.role() = 'authenticated');

create policy control_mappings_select_authenticated on public.control_mappings
  for select
  using (auth.role() = 'authenticated');
