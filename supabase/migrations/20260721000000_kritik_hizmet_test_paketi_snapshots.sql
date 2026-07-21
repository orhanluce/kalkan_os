-- Dikey F, F2 (docs/adr/PR0-dikeyF-f2-kritik-hizmet-test-paketi-2026-07-21.md):
-- tek bir kritik hizmet için mevcut M12 kontrol/test/bulgu/retest verilerinin
-- MÜHÜRLÜ, DETERMİNİSTİK fotoğrafı.
--
-- YENİ TEST MOTORU YOK: bu tablo hiçbir ilişkiyi KENDİSİ taşımaz — yalnız
-- src/lib/kritik-hizmet-test-paketi.ts'in critical_service_controls/
-- control_test_definitions/test_runs/control_test_finding_proposals/findings
-- gibi ZATEN VAR olan tablolardan hesapladığı SONUCU mühürler
-- (impact_graph_snapshots/cloud_assurance_profile_snapshots'ın AYNI deseni).
--
-- MAKER-CHECKER YOK (bilinçli, roi_export_runs'tan FARK): bu bir yeni uyum
-- iddiası değil, zaten guard'lı verilerin deterministik bir fotoğrafı.
--
-- İMMUTABLE BY DESIGN: UPDATE trigger'ı service_role dahil HER ZAMAN
-- reddeder (test_runs/impact_graph_snapshots'ın AYNI dersi). DELETE yalnız
-- tenant cascade için serbest; RLS authenticated'a delete policy'si açmıyor.

create table public.kritik_hizmet_test_paketi_snapshots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  -- Snapshot'ın SAHİBİ kritik hizmet silinemez sayılır (compliance izi bozulmasın).
  critical_service_id uuid not null references public.critical_business_services (id) on delete restrict,
  olusturan uuid references public.profiles (id) on delete set null,

  -- Mühürlü içerik: src/lib/kritik-hizmet-test-paketi.ts çıktısı, INSERT anında donar.
  paket jsonb not null,
  paket_hash text not null check (paket_hash ~ '^[0-9a-f]{64}$'),
  hesaplama_yontemi jsonb not null,

  created_at timestamptz not null default now()
);

create index kritik_hizmet_test_paketi_snapshots_tenant_idx
  on public.kritik_hizmet_test_paketi_snapshots (tenant_id, created_at desc);
create index kritik_hizmet_test_paketi_snapshots_service_idx
  on public.kritik_hizmet_test_paketi_snapshots (critical_service_id);

/** Kimlik atfı: olusturan istemci bağlamında oturum sahibine sabitlenir. */
create or replace function public.kritik_hizmet_test_paketi_olusturan_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' and auth.uid() is not null then
    new.olusturan := auth.uid();
  end if;
  return new;
end;
$$;

create trigger kritik_hizmet_test_paketi_olusturan_guard_trg
  before insert on public.kritik_hizmet_test_paketi_snapshots
  for each row execute function public.kritik_hizmet_test_paketi_olusturan_guard();

/** Cross-tenant guard: critical_service_id AYNI kiracıya ait olmalı. */
create or replace function public.kritik_hizmet_test_paketi_tenant_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.critical_business_services s
    where s.id = new.critical_service_id and s.tenant_id = new.tenant_id
  ) then
    raise exception 'critical_service_id farkli bir kiraciya ait olamaz (cross-tenant guard)';
  end if;
  return new;
end;
$$;

create trigger kritik_hizmet_test_paketi_tenant_guard_trg
  before insert on public.kritik_hizmet_test_paketi_snapshots
  for each row execute function public.kritik_hizmet_test_paketi_tenant_guard();

/** İMMUTABLE: service_role dahil hiçbir UPDATE geçemez. */
create or replace function public.kritik_hizmet_test_paketi_immutable()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'Kritik hizmet test paketi degistirilemez (append-only)';
end;
$$;

create trigger kritik_hizmet_test_paketi_immutable_before_update
  before update on public.kritik_hizmet_test_paketi_snapshots
  for each row execute function public.kritik_hizmet_test_paketi_immutable();

-- --- Audit ---
create or replace function public.audit_kritik_hizmet_test_paketi()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
  values (new.tenant_id, auth.uid(), 'kritik_hizmet_test_paketi_olusturuldu', 'kritik_hizmet_test_paketi_snapshots', new.id,
    jsonb_build_object('critical_service_id', new.critical_service_id, 'paket_hash', new.paket_hash));
  return new;
end;
$$;

create trigger audit_kritik_hizmet_test_paketi_insert after insert on public.kritik_hizmet_test_paketi_snapshots
  for each row execute function public.audit_kritik_hizmet_test_paketi();

-- --- RLS: tenant-scoped select+insert (admin/uyum); UPDATE/DELETE policy YOK ---
alter table public.kritik_hizmet_test_paketi_snapshots enable row level security;

create policy kritik_hizmet_test_paketi_snapshots_select on public.kritik_hizmet_test_paketi_snapshots
  for select using (tenant_id = public.current_tenant_id());
create policy kritik_hizmet_test_paketi_snapshots_insert on public.kritik_hizmet_test_paketi_snapshots
  for insert with check (
    tenant_id = public.current_tenant_id() and public.current_user_role() in ('admin', 'uyum')
  );

-- =====================================================================
-- Proof Room bağlantısı — BEŞİNCİ dal (GENİŞLETME, mevcut dört-hedefli
-- polimorfik desenin AYNISI, güncel sürüm 20260720250000 temel alındı)
-- =====================================================================
alter table public.proof_room_links
  drop constraint proof_room_links_tek_hedef,
  add column kritik_hizmet_test_paketi_snapshot_id uuid references public.kritik_hizmet_test_paketi_snapshots (id) on delete cascade,
  add constraint proof_room_links_tek_hedef check (
    (case when test_run_id is not null then 1 else 0 end)
    + (case when roi_export_run_id is not null then 1 else 0 end)
    + (case when graph_snapshot_id is not null then 1 else 0 end)
    + (case when cloud_assurance_profile_id is not null then 1 else 0 end)
    + (case when kritik_hizmet_test_paketi_snapshot_id is not null then 1 else 0 end)
    = 1
  );

create index proof_room_links_kritik_hizmet_test_paketi_idx
  on public.proof_room_links (kritik_hizmet_test_paketi_snapshot_id) where kritik_hizmet_test_paketi_snapshot_id is not null;
