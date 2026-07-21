-- Dikey G1: `tenant_provisioning` — bir pilot tenant'ın ONBOARDING SÜRECİNİN
-- (billing/entitlement DEĞİL — bkz. ADR §6) durum makinesi. `tenant_
-- subscriptions`/`subscription_events` (V2 PR-2c) zaten var ve DEĞİŞTİRİLMEZ;
-- "pilot planı/süresi" onlarla karşılanır (trial_bitis + TRIAL_STARTED).

create table public.tenant_provisioning (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null unique references public.tenants (id) on delete cascade,
  durum text not null default 'HAZIRLIK' check (durum in (
    'HAZIRLIK', 'DAVET_GONDERILDI', 'ILK_GIRIS_TAMAMLANDI',
    'KURULUM_DEVAM_EDIYOR', 'KURULUM_INCELEMEDE', 'PILOT_AKTIF',
    'PILOT_DONDURULDU', 'PILOT_SONA_ERDI'
  )),
  -- Kimlik atfı: HER ZAMAN bir platform_operator (DB guard aşağıda zorlar).
  olusturan uuid not null references public.profiles (id) on delete restrict,
  davet_edilen_eposta text,
  davet_edilen_kullanici_id uuid references auth.users (id) on delete set null,
  -- ADR §5.G: pilot tenant'lar varsayılan olarak zorunlu MFA ile açılır.
  mfa_zorunlu boolean not null default true,
  pilot_baslangic date,
  pilot_bitis date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tenant_provisioning_durum_idx on public.tenant_provisioning (durum);

create trigger tenant_provisioning_set_updated_at
  before update on public.tenant_provisioning
  for each row execute function public.set_updated_at();

-- Append-only denetim izi: her INSERT/UPDATE bir satır bırakır. Kanıt
-- niteliği taşıdığından bu tablo da immutable (impact_graph_snapshots
-- deseni) — service_role dahil UPDATE/DELETE reddedilir.
create table public.tenant_provisioning_audit (
  id uuid primary key default gen_random_uuid(),
  tenant_provisioning_id uuid not null references public.tenant_provisioning (id) on delete cascade,
  onceki_durum text,
  yeni_durum text not null,
  aktor uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create or replace function public.tenant_provisioning_immutable()
returns trigger
language plpgsql
as $$
begin
  raise exception 'tenant_provisioning_audit is append-only; UPDATE/DELETE is not permitted';
  return null;
end;
$$;

create trigger tenant_provisioning_audit_no_update
  before update on public.tenant_provisioning_audit
  for each row execute function public.tenant_provisioning_immutable();
create trigger tenant_provisioning_audit_no_delete
  before delete on public.tenant_provisioning_audit
  for each row execute function public.tenant_provisioning_immutable();

-- olusturan HER ZAMAN platform_operator olmalı (kural 14: kimlik atfı
-- sahtelenemez — talep eden kendi kendini yetkilendiremez, buradaki eşdeğeri
-- "yalnız gerçekten platform_operator olan biri provisioning başlatabilir").
create or replace function public.tenant_provisioning_olusturan_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  select role into v_role from public.profiles where id = new.olusturan;
  if v_role is distinct from 'platform_operator' then
    raise exception 'tenant_provisioning.olusturan must be a platform_operator profile';
  end if;
  return new;
end;
$$;

create trigger tenant_provisioning_olusturan_guard_trigger
  before insert on public.tenant_provisioning
  for each row execute function public.tenant_provisioning_olusturan_guard();

-- Durum makinesi guard'ı (ADR §7) — izinsiz geçiş RED. tenant_id/olusturan/
-- created_at immutable (F1'in retest_of_finding_id forward-fix'inde olduğu
-- gibi: yalnız durum + ilgili alanlar değişebilir).
create or replace function public.tenant_provisioning_durum_guard()
returns trigger
language plpgsql
as $$
begin
  if new.tenant_id is distinct from old.tenant_id
    or new.olusturan is distinct from old.olusturan
    or new.created_at is distinct from old.created_at then
    raise exception 'tenant_provisioning: tenant_id/olusturan/created_at are immutable';
  end if;

  if new.durum = old.durum then
    return new;
  end if;

  if not (
    (old.durum = 'HAZIRLIK' and new.durum = 'DAVET_GONDERILDI')
    or (old.durum = 'DAVET_GONDERILDI' and new.durum = 'ILK_GIRIS_TAMAMLANDI')
    or (old.durum = 'ILK_GIRIS_TAMAMLANDI' and new.durum = 'KURULUM_DEVAM_EDIYOR')
    or (old.durum = 'KURULUM_DEVAM_EDIYOR' and new.durum = 'KURULUM_INCELEMEDE')
    or (old.durum = 'KURULUM_INCELEMEDE' and new.durum in ('PILOT_AKTIF', 'KURULUM_DEVAM_EDIYOR'))
    or (old.durum = 'PILOT_AKTIF' and new.durum in ('PILOT_DONDURULDU', 'PILOT_SONA_ERDI'))
    or (old.durum = 'PILOT_DONDURULDU' and new.durum in ('PILOT_AKTIF', 'PILOT_SONA_ERDI'))
  ) then
    raise exception 'tenant_provisioning: % -> % is not an allowed transition', old.durum, new.durum;
  end if;

  return new;
end;
$$;

create trigger tenant_provisioning_durum_guard_trigger
  before update on public.tenant_provisioning
  for each row execute function public.tenant_provisioning_durum_guard();

create or replace function public.tenant_provisioning_audit_yaz()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.tenant_provisioning_audit (tenant_provisioning_id, onceki_durum, yeni_durum, aktor)
  values (new.id, case when tg_op = 'INSERT' then null else old.durum end, new.durum, auth.uid());
  return new;
end;
$$;

create trigger tenant_provisioning_audit_insert
  after insert on public.tenant_provisioning
  for each row execute function public.tenant_provisioning_audit_yaz();
create trigger tenant_provisioning_audit_update
  after update on public.tenant_provisioning
  for each row execute function public.tenant_provisioning_audit_yaz();

alter table public.tenant_provisioning enable row level security;
alter table public.tenant_provisioning_audit enable row level security;

-- Platform operatör: tüm provisioning kayıtlarını görebilir/yönetebilir
-- (bunlar kurum İŞ VERİSİ değil, provisioning sürecinin kendisi).
create policy tenant_provisioning_platform_operator on public.tenant_provisioning
  for all
  using (public.current_role() = 'platform_operator')
  with check (public.current_role() = 'platform_operator');

-- Tenant admin kendi tenant'ının provisioning durumunu OKUYABİLİR (sihirbaz
-- ilerlemesini görmek için) ama YAZAMAZ (durum geçişleri yalnız API/RPC'den,
-- ayrı bir SECURITY DEFINER fonksiyonla — burada authenticated'a UPDATE
-- policy'si açılmıyor, bilinçli).
create policy tenant_provisioning_select_own_tenant on public.tenant_provisioning
  for select
  using (tenant_id = public.current_tenant_id());

create policy tenant_provisioning_audit_platform_operator on public.tenant_provisioning_audit
  for select
  using (public.current_role() = 'platform_operator');

create policy tenant_provisioning_audit_select_own_tenant on public.tenant_provisioning_audit
  for select
  using (
    exists (
      select 1 from public.tenant_provisioning tp
      where tp.id = tenant_provisioning_audit.tenant_provisioning_id
        and tp.tenant_id = public.current_tenant_id()
    )
  );
