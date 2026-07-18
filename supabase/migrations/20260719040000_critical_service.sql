-- M13 — Critical Business Service & Impact Tolerance (Gate G8 parça 1).
--
-- TENANT'A ÖZGÜ: kritik hizmet, etki toleransı, bağımlılık grafı kurumun kendi
-- operasyonel dayanıklılık verisidir.
--
-- BU DİLİM: critical_business_services (kritik iş hizmeti + sahip) +
-- impact_tolerances (SÜRÜMLÜ, YÖNETİM ONAYLI — değişiklik yönetim kararı + audit
-- olmadan yürürlüğe giremez) + service_dependencies (bağımlılık grafı; M35
-- tedarikçisine bağ + tekil nokta). Yoğunlaşma/tekil-nokta analizi saf.
--
-- ROLLBACK NOTU: ters FK sırasıyla drop (service_dependencies,
-- impact_tolerances, critical_business_services). Üretim verisi yok.
--
-- BİLİNÇLİ SONRAKİ DİLİM: recursive dependency graph görselleştirme, plausible
-- scenario/exercise/actual-result/recovery-strategy (M15 kurtarma kanıtıyla
-- kesişir), RTO/RPO gerçek ölçüm bağlama.

-- --- Kritik iş hizmeti ---
create table public.critical_business_services (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  ad text not null,
  aciklama text,
  sahip uuid references public.profiles (id) on delete set null,
  durum text not null default 'AKTIF' check (durum in ('AKTIF', 'PASIF')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, ad)
);

create trigger critical_business_services_set_updated_at
  before update on public.critical_business_services
  for each row execute function public.set_updated_at();

-- --- Etki toleransı (sürümlü + yönetim onaylı) ---
create table public.impact_tolerances (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  critical_service_id uuid not null references public.critical_business_services (id) on delete cascade,
  surum integer not null check (surum > 0),
  max_kesinti_saat numeric check (max_kesinti_saat is null or max_kesinti_saat >= 0),
  max_veri_kaybi_saat numeric check (max_veri_kaybi_saat is null or max_veri_kaybi_saat >= 0),
  max_mutabakat_farki text,
  -- YÖNETİM ONAYI: yürürlük için ŞART (invariant: tolerans değişikliği yönetim
  -- kararı olmadan yürürlüğe giremez).
  yonetim_onayi boolean not null default false,
  onaylayan uuid references public.profiles (id) on delete restrict,
  onay_zamani timestamptz,
  durum text not null default 'TASLAK' check (durum in ('TASLAK', 'YURURLUKTE', 'SUPERSEDED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (critical_service_id, surum)
);

create trigger impact_tolerances_set_updated_at
  before update on public.impact_tolerances
  for each row execute function public.set_updated_at();

-- Bir hizmetin tek YÜRÜRLÜKTE toleransı (değişiklik = yeni sürüm + supersede).
create unique index impact_tolerances_tek_yururlukte
  on public.impact_tolerances (critical_service_id)
  where durum = 'YURURLUKTE';

/**
 * TOLERANS GUARD'I: YURURLUKTE yalnız YÖNETİM ONAYI (onaylayan + zaman) ile —
 * yönetim kararı ve audit olmadan yürürlüğe giremez. Yürürlükteki toleransın
 * eşik alanları donuk (değişiklik yeni sürüm gerektirir).
 */
create or replace function public.impact_tolerance_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.durum = 'YURURLUKTE' and old.durum is distinct from 'YURURLUKTE' then
    if new.yonetim_onayi is not true or new.onaylayan is null or new.onay_zamani is null then
      raise exception 'Etki toleransi yururluge ancak yonetim onayi (onaylayan + zaman) ile girer';
    end if;
  end if;
  if TG_OP = 'UPDATE' and old.durum = 'YURURLUKTE' and new.durum = 'YURURLUKTE' then
    if new.max_kesinti_saat is distinct from old.max_kesinti_saat
      or new.max_veri_kaybi_saat is distinct from old.max_veri_kaybi_saat
      or new.max_mutabakat_farki is distinct from old.max_mutabakat_farki then
      raise exception 'Yururlukteki toleransin esikleri degistirilemez (yeni surum gerekir)';
    end if;
  end if;
  return new;
end;
$$;

create trigger impact_tolerance_guard_trg
  before insert or update on public.impact_tolerances
  for each row execute function public.impact_tolerance_guard();

-- --- Bağımlılık grafı (hizmet → sistem/ekip/tesis/tedarikçi/bulut) ---
create table public.service_dependencies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  critical_service_id uuid not null references public.critical_business_services (id) on delete cascade,
  bagimlilik_turu text not null default 'SISTEM' check (bagimlilik_turu in ('SISTEM', 'EKIP', 'TESIS', 'TEDARIKCI', 'BULUT')),
  ad text not null,
  -- M35 tedarikçisine opsiyonel bağ (tek graf: hizmet → tedarikçi).
  third_party_id uuid references public.third_parties (id) on delete set null,
  tekil_nokta boolean not null default false,
  created_at timestamptz not null default now()
);

create index service_dependencies_service_idx on public.service_dependencies (critical_service_id);

-- --- Audit: tolerans yürürlük değişimi (yönetim kararı izi) ---
create or replace function public.audit_impact_tolerance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'UPDATE' and new.durum is distinct from old.durum then
    insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
    values (new.tenant_id, auth.uid(), 'etki_toleransi_durum_degisti', 'impact_tolerances', new.id,
      jsonb_build_object('surum', new.surum, 'durum_onceki', old.durum, 'durum', new.durum));
  end if;
  return new;
end;
$$;

create trigger audit_impact_tolerance_update after update on public.impact_tolerances
  for each row execute function public.audit_impact_tolerance();

-- --- RLS: hepsi tenant'a kilitli; yazma admin/uyum ---
alter table public.critical_business_services enable row level security;
alter table public.impact_tolerances enable row level security;
alter table public.service_dependencies enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['critical_business_services', 'impact_tolerances', 'service_dependencies']
  loop
    execute format(
      'create policy %1$s_select on public.%1$s for select using (tenant_id = public.current_tenant_id())', t);
    execute format(
      'create policy %1$s_write on public.%1$s for all using (tenant_id = public.current_tenant_id() and public.current_user_role() in (''admin'', ''uyum'')) with check (tenant_id = public.current_tenant_id() and public.current_user_role() in (''admin'', ''uyum''))', t);
  end loop;
end;
$$;
