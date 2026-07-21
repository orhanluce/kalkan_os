-- Dikey F, F4 (docs/adr/PR0-dikeyF-f4-kurtarma-olcumu-yakalama-2026-07-21.md):
-- bir kontrol testi koşusuna bağlı, ÖLÇÜLEN gerçek kesinti/veri-kaybı verisinin
-- güvenilir, immutable ve kanıtlı KAYDI. KARŞILAŞTIRMA MOTORU DEĞİL — hiçbir
-- "RTO/RPO karşılandı" hükmü üretmez; impact_tolerances'a BAĞLANMAZ.
--
-- NEDEN AYRI TABLO (test_runs'a kolon değil): test_runs immutable ve INSERT
-- anında donar; kurtarma ölçümü koşu satırından SONRA netleşebilir. Ayrıca
-- düzeltme = yeni INSERT + supersede soyu; eski kayıt fiziksel korunur.
-- execution_legal_snapshots deseninin AYNISI (koşuya FK + immutable + kanonik
-- mühürlü snapshot), + supersede zinciri + güvenilirlik katmanı.
--
-- GÜVENİLİRLİK KATMANI (kural: beyanı ölçüm gibi sunma):
--   MANUEL_BEYAN  — insan beyanı (form; auth.uid() ile beyan_eden sabitlenir).
--   OTOMATIK_OLCUM — yalnız güvenilir sunucu (service_role) INSERT edebilir;
--                    sahte yükseltme DB guard'ıyla reddedilir. Bu dilimde
--                    gerçek connector YOK — fiilen üretilen kayıtlar MANUEL_BEYAN.
--
-- BİRİM: SAAT (kalıcı sözleşme). NULL ≠ sıfır. Süreler SUNUCUDA türetilir
-- (generated column) — istemci süresine güvenilmez.

create table public.test_run_recovery_measurements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  -- Ölçüm kalıcı bir uyum izidir; bağlı koşu silinemez sayılır.
  test_run_id uuid not null references public.test_runs (id) on delete restrict,

  olcum_kaynagi text not null check (olcum_kaynagi in ('MANUEL_BEYAN', 'OTOMATIK_OLCUM')),
  girdi_modu text not null check (girdi_modu in ('EVENT_TIMESTAMPS', 'DURATION_DECLARATION')),

  -- Ham olay zamanları (EVENT_TIMESTAMPS modu)
  kesinti_baslangic_at timestamptz,
  hizmet_geri_geldi_at timestamptz,
  son_tutarli_veri_at timestamptz,
  kurtarma_noktasi_at timestamptz,

  -- Süre-yalnız beyan (DURATION_DECLARATION modu) — AÇIKÇA beyan
  beyan_kesinti_saat numeric check (beyan_kesinti_saat is null or beyan_kesinti_saat >= 0),
  beyan_veri_kaybi_saat numeric check (beyan_veri_kaybi_saat is null or beyan_veri_kaybi_saat >= 0),

  -- Türetilmiş süreler — SUNUCU hesaplar, istemci ASLA yazamaz (generated stored).
  olculen_kesinti_saat numeric generated always as (
    case when kesinti_baslangic_at is not null and hizmet_geri_geldi_at is not null
      then (extract(epoch from (hizmet_geri_geldi_at - kesinti_baslangic_at)) / 3600.0)::numeric
      else null end
  ) stored,
  olculen_veri_kaybi_saat numeric generated always as (
    case when son_tutarli_veri_at is not null and kurtarma_noktasi_at is not null
      then (extract(epoch from (kurtarma_noktasi_at - son_tutarli_veri_at)) / 3600.0)::numeric
      else null end
  ) stored,

  -- Provenance
  evidence_id uuid references public.evidences (id) on delete restrict,
  source_system text,
  source_event_id text,
  source_payload_hash text check (source_payload_hash is null or source_payload_hash ~ '^[0-9a-f]{64}$'),
  beyan_eden uuid references public.profiles (id) on delete set null,
  declarant_present boolean not null default false,

  -- Supersede soyu (düzeltme = yeni kayıt). LİNEER zincir (partial unique index).
  supersedes_measurement_id uuid references public.test_run_recovery_measurements (id) on delete restrict,

  -- Mühürlü kanonik snapshot (WARDPROOF_TEST_RUN_RECOVERY_MEASUREMENT_V1) + hash.
  olcum jsonb not null,
  olcum_hash text not null check (olcum_hash ~ '^[0-9a-f]{64}$'),

  measured_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  -- Mod ile alanların tutarlılığı: aynı olgu için ham zaman + süre-beyan BİRLİKTE olmaz.
  constraint trrm_mod_event check (
    girdi_modu <> 'EVENT_TIMESTAMPS' or (beyan_kesinti_saat is null and beyan_veri_kaybi_saat is null)
  ),
  constraint trrm_mod_duration check (
    girdi_modu <> 'DURATION_DECLARATION' or
      (kesinti_baslangic_at is null and hizmet_geri_geldi_at is null
       and son_tutarli_veri_at is null and kurtarma_noktasi_at is null)
  ),
  -- Negatif süre yok: başlangıç bitişten sonra olamaz.
  constraint trrm_kesinti_sira check (
    kesinti_baslangic_at is null or hizmet_geri_geldi_at is null or kesinti_baslangic_at <= hizmet_geri_geldi_at
  ),
  constraint trrm_veri_sira check (
    son_tutarli_veri_at is null or kurtarma_noktasi_at is null or son_tutarli_veri_at <= kurtarma_noktasi_at
  ),
  -- Kendini supersede edemez.
  constraint trrm_self_supersede check (supersedes_measurement_id is null or supersedes_measurement_id <> id),
  -- OTOMATIK_OLCUM zorunlu provenance.
  constraint trrm_otomatik_provenance check (
    olcum_kaynagi <> 'OTOMATIK_OLCUM' or (source_system is not null and source_event_id is not null and evidence_id is not null)
  ),
  -- Tamamen boş kayıt anlamsız — en az bir ölçüm boyutu dolu olmalı.
  constraint trrm_en_az_bir check (
    kesinti_baslangic_at is not null or son_tutarli_veri_at is not null
    or beyan_kesinti_saat is not null or beyan_veri_kaybi_saat is not null
  )
);

create index trrm_tenant_idx on public.test_run_recovery_measurements (tenant_id, created_at desc);
create index trrm_test_run_idx on public.test_run_recovery_measurements (test_run_id);
-- LİNEER supersede zinciri: her kayıt en fazla BİR kez supersede edilebilir
-- (aynı soyda iki "güncel" olamaz). "Güncel" = kimse supersede etmemiş kayıt (türetilir).
create unique index trrm_supersede_uq
  on public.test_run_recovery_measurements (supersedes_measurement_id)
  where supersedes_measurement_id is not null;

/**
 * KAYNAK + KİMLİK GUARD'I (before insert):
 *  - OTOMATIK_OLCUM yalnız service_role ile — sahte yükseltme reddedilir
 *    (istemcinin olcum_kaynagi='OTOMATIK_OLCUM' göndermesi yeterli DEĞİL).
 *  - MANUEL_BEYAN'da beyan_eden oturum sahibine sabitlenir (F2 olusturan deseni).
 */
create or replace function public.trrm_kaynak_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.olcum_kaynagi = 'OTOMATIK_OLCUM' and auth.role() is distinct from 'service_role' then
    raise exception 'OTOMATIK_OLCUM yalnizca guvenilir sunucu (service_role) ile olusturulabilir';
  end if;
  if new.olcum_kaynagi = 'MANUEL_BEYAN' and auth.uid() is not null then
    new.beyan_eden := auth.uid();
  end if;
  return new;
end;
$$;

create trigger trrm_kaynak_guard_trg
  before insert on public.test_run_recovery_measurements
  for each row execute function public.trrm_kaynak_guard();

/**
 * CROSS-TENANT + SOY GUARD'I (before insert): test_run_id, evidence_id ve
 * supersedes_measurement_id AYNI kiracıya ait olmalı; supersede edilen kayıt
 * AYNI koşuya ait olmalı (soy koşu değiştiremez). service_role dahil çalışır.
 */
create or replace function public.trrm_tenant_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.test_runs r where r.id = new.test_run_id and r.tenant_id = new.tenant_id
  ) then
    raise exception 'test_run_id farkli bir kiraciya ait olamaz (cross-tenant guard)';
  end if;

  if new.evidence_id is not null and not exists (
    select 1 from public.evidences e where e.id = new.evidence_id and e.tenant_id = new.tenant_id
  ) then
    raise exception 'evidence_id farkli bir kiraciya ait olamaz (cross-tenant guard)';
  end if;

  if new.supersedes_measurement_id is not null then
    if not exists (
      select 1 from public.test_run_recovery_measurements m
      where m.id = new.supersedes_measurement_id and m.tenant_id = new.tenant_id
    ) then
      raise exception 'supersedes_measurement_id farkli bir kiraciya ait olamaz (cross-tenant guard)';
    end if;
    if not exists (
      select 1 from public.test_run_recovery_measurements m
      where m.id = new.supersedes_measurement_id and m.test_run_id = new.test_run_id
    ) then
      raise exception 'supersede edilen olcum ayni test kosusuna ait olmali';
    end if;
  end if;

  return new;
end;
$$;

create trigger trrm_tenant_guard_trg
  before insert on public.test_run_recovery_measurements
  for each row execute function public.trrm_tenant_guard();

/**
 * İMMUTABLE: UPDATE service_role dahil HER ZAMAN reddedilir (execution_legal_
 * snapshots / kritik_hizmet_test_paketi deseni). DELETE authenticated/anon'a
 * açılmaz (aşağıda revoke + delete policy YOK); düzeltme yalnız yeni INSERT +
 * supersede ile yapılır.
 */
create or replace function public.trrm_immutable()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'Kurtarma olcumu degistirilemez (append-only; duzeltme icin supersede eden yeni kayit)';
end;
$$;

create trigger trrm_immutable_before_update
  before update on public.test_run_recovery_measurements
  for each row execute function public.trrm_immutable();

-- --- Audit ---
create or replace function public.audit_trrm()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
  values (new.tenant_id, auth.uid(), 'kurtarma_olcumu_kaydedildi', 'test_run_recovery_measurements', new.id,
    jsonb_build_object('test_run_id', new.test_run_id, 'olcum_kaynagi', new.olcum_kaynagi, 'olcum_hash', new.olcum_hash,
      'supersedes_measurement_id', new.supersedes_measurement_id));
  return new;
end;
$$;

create trigger audit_trrm_insert after insert on public.test_run_recovery_measurements
  for each row execute function public.audit_trrm();

-- --- Şeffaflık defteri: generic outbox enqueue (RECOVERY_MEASUREMENT kind) ---
create trigger test_run_recovery_measurements_ledger_outbox_enqueue
  after insert on public.test_run_recovery_measurements
  for each row execute function public.ledger_outbox_enqueue_trg('RECOVERY_MEASUREMENT');

-- --- RLS: tenant-scoped select + insert (admin/uyum). UPDATE/DELETE policy YOK ---
alter table public.test_run_recovery_measurements enable row level security;

create policy trrm_select on public.test_run_recovery_measurements
  for select using (tenant_id = public.current_tenant_id());
create policy trrm_insert on public.test_run_recovery_measurements
  for insert with check (
    tenant_id = public.current_tenant_id() and public.current_user_role() in ('admin', 'uyum')
  );

revoke update, delete on public.test_run_recovery_measurements from authenticated, anon;
