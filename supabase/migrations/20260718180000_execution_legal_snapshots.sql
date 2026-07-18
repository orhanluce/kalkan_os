-- Koşu dayanak fotoğrafı (V2 PR-4b adım 4, M23): her kontrol testi koşusunun
-- (ya da BLOK edilen koşu girişiminin) yasal dayanak zinciri, karar anında
-- DEĞİŞMEZ bir fotoğraf olarak mühürlenir.
--
-- NEDEN: "o gün bu testi hangi hukuki dayanakla koştuk / neden koşturmadık"
-- sorusu sonradan yeniden kurgulanamaz — koşu anındaki zincir (hüküm yürürlüğü,
-- eşleme doğrulama durumu, applicability kararı) buraya yazılır ve donar.
-- Karar mantığı TS'te tek yerde (src/lib/legal-basis.ts, kural 11); SQL yalnız
-- ham malzeme + değişmezlik. İKİNCİ TEST MOTORU YOK — bu tablo M12'nin
-- test_runs'ına EK bir dayanak kaydıdır, sonuç üretmez.
--
-- BLOK kayıtları: BLOCK kararında test koşusu HİÇ başlamaz (test_run yok) —
-- o yüzden test_run_id yalnız BLOCK'ta null olabilir. Engellenen girişim de
-- kayıt altındadır (denetimde "neden koşulmadı" da kanıtlıdır).

create table public.execution_legal_snapshots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  control_id uuid not null references public.controls (id) on delete cascade,
  test_definition_id uuid not null references public.control_test_definitions (id) on delete cascade,
  -- Koşu gerçekleştiyse ilgili test_runs kaydı; BLOCK'ta null (koşu yok).
  test_run_id uuid references public.test_runs (id) on delete restrict,
  karar text not null check (karar in ('ALLOW', 'ALLOW_WITH_WARNING', 'BLOCK')),
  constraint els_block_kosusuz check ((karar = 'BLOCK') = (test_run_id is null)),
  -- KALKAN_EXECUTION_LEGAL_SNAPSHOT_V1: eşlemeler + karar + sebepler + asOf.
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);

-- Bir koşuya en fazla BİR dayanak fotoğrafı.
create unique index els_test_run_uq
  on public.execution_legal_snapshots (test_run_id)
  where test_run_id is not null;

create index els_tenant_control_idx
  on public.execution_legal_snapshots (tenant_id, control_id, created_at desc);

/**
 * DEĞİŞMEZLİK — manifest deseni (M9/M12): UPDATE/DELETE service_role DAHİL
 * herkese kapalı. Fotoğraf çekildiği anda donar; düzeltme diye bir şey yoktur
 * (yanlışsa yeni koşu yeni fotoğraf üretir).
 */
create or replace function public.execution_legal_snapshot_immutable()
returns trigger
language plpgsql
as $$
begin
  raise exception 'execution_legal_snapshots kaydi degistirilemez/silinemez (immutable)';
end;
$$;

create trigger els_immutable_update
  before update on public.execution_legal_snapshots
  for each row execute function public.execution_legal_snapshot_immutable();
create trigger els_immutable_delete
  before delete on public.execution_legal_snapshots
  for each row execute function public.execution_legal_snapshot_immutable();

-- --- RLS: test_runs deseni — kiracı okur ve ekler; değişiklik yolu yok ---
alter table public.execution_legal_snapshots enable row level security;

create policy els_select on public.execution_legal_snapshots
  for select using (tenant_id = public.current_tenant_id());
create policy els_insert on public.execution_legal_snapshots
  for insert with check (tenant_id = public.current_tenant_id());

revoke update, delete on public.execution_legal_snapshots from authenticated, anon;
