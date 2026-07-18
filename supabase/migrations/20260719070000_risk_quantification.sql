-- M40 — Risk Appetite, KRI & Loss Distribution (Gate G8 parça 4).
--
-- TENANT'A ÖZGÜ: risk iştahı, KRI, senaryo kurumun kendi risk verisidir.
--
-- CRQ İLKESİ (AI/Blockchain raporu §3.6 + roadmap M13): SAHTE KESİNLİK YOK.
-- Senaryo kaybı TEK PUAN DEĞİL, bir DAĞILIM (min/olası/max) + ZORUNLU
-- VARSAYIM taşır. "Tek risk puanı"na indirgenmez.
--
-- BU DİLİM: risk_appetites (yönetim onaylı risk iştahı) + key_risk_indicators +
-- kri_readings (trend) + risk_scenarios (kayıp dağılımı + varsayım + kontrol
-- maliyet/azaltma). KRI ihlali ve dağılım özeti saf (src/lib/risk.ts).
--
-- ROLLBACK NOTU: ters FK sırasıyla drop (kri_readings, key_risk_indicators,
-- risk_scenarios, risk_appetites). Üretim verisi yok.

-- --- Risk iştahı (yönetim onaylı) ---
create table public.risk_appetites (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  kategori text not null check (kategori in ('SIBER', 'OPERASYONEL', 'UYUM', 'FINANSAL')),
  esik numeric not null,
  birim text,
  -- Eşiğin hangi yönde aşımı ihlaldir.
  yon text not null default 'UST' check (yon in ('UST', 'ALT')),
  aciklama text,
  yonetim_onayi boolean not null default false,
  onaylayan uuid references public.profiles (id) on delete restrict,
  onay_zamani timestamptz,
  durum text not null default 'TASLAK' check (durum in ('TASLAK', 'YURURLUKTE', 'SUPERSEDED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, kategori)
);

create trigger risk_appetites_set_updated_at
  before update on public.risk_appetites
  for each row execute function public.set_updated_at();

/**
 * RİSK İŞTAHI GUARD'I: YURURLUKTE yalnız YÖNETİM ONAYI (onaylayan + zaman) ile
 * (impact_tolerance deseni — yönetim kararı olmadan risk iştahı yürürlüğe girmez).
 */
create or replace function public.risk_appetite_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.durum = 'YURURLUKTE' and old.durum is distinct from 'YURURLUKTE' then
    if new.yonetim_onayi is not true or new.onaylayan is null or new.onay_zamani is null then
      raise exception 'Risk istahi yururluge ancak yonetim onayi (onaylayan + zaman) ile girer';
    end if;
  end if;
  return new;
end;
$$;

create trigger risk_appetite_guard_trg
  before insert or update on public.risk_appetites
  for each row execute function public.risk_appetite_guard();

-- --- KRI ---
create table public.key_risk_indicators (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  ad text not null,
  kategori text not null default 'SIBER' check (kategori in ('SIBER', 'OPERASYONEL', 'UYUM', 'FINANSAL')),
  esik numeric not null,
  yon text not null default 'UST' check (yon in ('UST', 'ALT')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, ad)
);

create trigger key_risk_indicators_set_updated_at
  before update on public.key_risk_indicators
  for each row execute function public.set_updated_at();

-- --- KRI okumaları (trend) ---
create table public.kri_readings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  kri_id uuid not null references public.key_risk_indicators (id) on delete cascade,
  deger numeric not null,
  olcum_tarihi date not null default current_date,
  created_at timestamptz not null default now()
);

create index kri_readings_kri_idx on public.kri_readings (kri_id, olcum_tarihi desc);

-- --- Senaryo (kayıp DAĞILIMI + zorunlu VARSAYIM + kontrol fayda) ---
create table public.risk_scenarios (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  ad text not null,
  kategori text not null default 'SIBER' check (kategori in ('SIBER', 'OPERASYONEL', 'UYUM', 'FINANSAL')),
  yillik_siklik numeric check (yillik_siklik is null or yillik_siklik >= 0),
  -- Kayıp DAĞILIMI (üçgensel: min ≤ olası ≤ max) — TEK PUAN DEĞİL.
  kayip_min numeric not null check (kayip_min >= 0),
  kayip_olasi numeric not null,
  kayip_max numeric not null,
  -- VARSAYIMLAR ZORUNLU (sahte kesinlik yok — model varsayımı görünür).
  varsayimlar text not null,
  kontrol_maliyeti numeric check (kontrol_maliyeti is null or kontrol_maliyeti >= 0),
  risk_azaltma numeric check (risk_azaltma is null or risk_azaltma >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint risk_scenarios_dagilim check (kayip_min <= kayip_olasi and kayip_olasi <= kayip_max)
);

create trigger risk_scenarios_set_updated_at
  before update on public.risk_scenarios
  for each row execute function public.set_updated_at();

-- --- Audit: risk iştahı yürürlük değişimi (yönetim kararı izi) ---
create or replace function public.audit_risk_appetite()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'UPDATE' and new.durum is distinct from old.durum then
    insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
    values (new.tenant_id, auth.uid(), 'risk_istahi_durum_degisti', 'risk_appetites', new.id,
      jsonb_build_object('durum_onceki', old.durum, 'durum', new.durum));
  end if;
  return new;
end;
$$;

create trigger audit_risk_appetite_update after update on public.risk_appetites
  for each row execute function public.audit_risk_appetite();

-- --- RLS: hepsi tenant'a kilitli; yazma admin/uyum ---
alter table public.risk_appetites enable row level security;
alter table public.key_risk_indicators enable row level security;
alter table public.kri_readings enable row level security;
alter table public.risk_scenarios enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['risk_appetites', 'key_risk_indicators', 'kri_readings', 'risk_scenarios']
  loop
    execute format(
      'create policy %1$s_select on public.%1$s for select using (tenant_id = public.current_tenant_id())', t);
    execute format(
      'create policy %1$s_write on public.%1$s for all using (tenant_id = public.current_tenant_id() and public.current_user_role() in (''admin'', ''uyum'')) with check (tenant_id = public.current_tenant_id() and public.current_user_role() in (''admin'', ''uyum''))', t);
  end loop;
end;
$$;
