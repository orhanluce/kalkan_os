-- Kurum alt turu -> mevzuat izleme kapsami (WardProof, 2026-07-22).
--
-- Hukuki sinir: profil eslesmesi bir kaynagi IZLEME kapsamına alir; tek basina
-- "bu hukum kesin uygulanir" karari vermez. Hukuki uygulanabilirlik karari
-- applicability_decisions zincirinde kalir. Dogrulanmamis kural AUTO_ACTIVE
-- olamaz (kural 3).

alter table public.organization_profiles
  add column regulated_entity_types text[] not null default '{}';

alter table public.organization_profiles
  add constraint organization_profiles_regulated_entity_types_check check (
    regulated_entity_types <@ array[
      'BANKA',
      'ARACI_KURUM',
      'PORTFOY_YONETIM_SIRKETI',
      'ODEME_E_PARA_KURULUSU',
      'KRIPTO_VARLIK_HIZMET_SAGLAYICI',
      'FINANSAL_KIRALAMA_FAKTORING_FINANSMAN',
      'BILGI_ALISVERISI_KURULUSU',
      'SIGORTA_EMEKLILIK',
      'DIGER_DUZENLENEN'
    ]::text[]
  );

-- Global hukuk katalogunun profil-esleme katmani. regulatory_sources gibi
-- tenant'siz ortak referanstir; kiraciya ozel sonuc alttaki tabloda tutulur.
create table public.regulatory_scope_rules (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.regulatory_sources (id) on delete restrict,
  entity_type text,
  required_jurisdiction text,
  module_keys text[] not null default '{}',
  rationale text not null,
  verification_status text not null default 'DRAFT_RESEARCH'
    check (verification_status in ('DRAFT_RESEARCH', 'LEGAL_REVIEW', 'VERIFIED', 'REJECTED')),
  reviewed_by uuid references public.profiles (id) on delete restrict,
  reviewed_at timestamptz,
  verified_by uuid references public.profiles (id) on delete restrict,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  unique (source_id, entity_type, required_jurisdiction)
);

alter table public.regulatory_scope_rules enable row level security;
create policy regulatory_scope_rules_select on public.regulatory_scope_rules
  for select using (auth.role() = 'authenticated');

create or replace function public.regulatory_scope_rule_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    if new.verification_status <> 'DRAFT_RESEARCH' then
      raise exception 'Kapsam kurali DRAFT_RESEARCH disinda dogamaz';
    end if;
    return new;
  end if;

  if old.verification_status = 'VERIFIED' then
    raise exception 'Dogrulanmis kapsam kurali degistirilemez; yeni surum gerekir';
  end if;
  if new.source_id is distinct from old.source_id
     or new.entity_type is distinct from old.entity_type
     or new.required_jurisdiction is distinct from old.required_jurisdiction
     or new.module_keys is distinct from old.module_keys
     or new.rationale is distinct from old.rationale then
    raise exception 'Kapsam kurali icerigi yerinde degistirilemez; yeni surum gerekir';
  end if;
  if old.verification_status = 'DRAFT_RESEARCH' and new.verification_status = 'LEGAL_REVIEW' then
    if new.reviewed_by is null or new.reviewed_at is null then
      raise exception 'LEGAL_REVIEW inceleyen ve zaman atfi ister';
    end if;
    return new;
  end if;
  if old.verification_status = 'LEGAL_REVIEW' and new.verification_status = 'VERIFIED' then
    if new.verified_by is null or new.verified_at is null or new.verified_by = old.reviewed_by then
      raise exception 'VERIFIED bagimsiz ikinci kisi ve zaman atfi ister';
    end if;
    return new;
  end if;
  if new.verification_status = 'REJECTED' then
    return new;
  end if;
  raise exception 'Gecersiz kapsam kurali durum gecisi';
end;
$$;

create trigger regulatory_scope_rule_guard_trg
  before insert or update on public.regulatory_scope_rules
  for each row execute function public.regulatory_scope_rule_guard();

create table public.tenant_regulatory_scopes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  source_id uuid references public.regulatory_sources (id) on delete restrict,
  rule_id uuid references public.regulatory_scope_rules (id) on delete restrict,
  manual_authority text,
  manual_title text,
  manual_url text,
  note text,
  origin text not null check (origin in ('PROFILE_RULE', 'MANUAL')),
  scope_status text not null check (scope_status in ('AUTO_ACTIVE', 'REVIEW_REQUIRED', 'MANUAL_TRACKED')),
  matched_entity_type text,
  module_keys text[] not null default '{}',
  added_by uuid references public.profiles (id) on delete restrict,
  superseded_at timestamptz,
  created_at timestamptz not null default now(),
  constraint tenant_regulatory_scope_shape check (
    (origin = 'PROFILE_RULE' and source_id is not null and rule_id is not null and manual_title is null)
    or
    (origin = 'MANUAL' and rule_id is null and manual_title is not null and length(btrim(manual_title)) > 0)
  ),
  constraint tenant_regulatory_scope_status_origin check (
    (origin = 'PROFILE_RULE' and scope_status in ('AUTO_ACTIVE', 'REVIEW_REQUIRED'))
    or (origin = 'MANUAL' and scope_status = 'MANUAL_TRACKED')
  ),
  constraint tenant_regulatory_scope_manual_url_http check (
    manual_url is null or manual_url ~* '^https://[^[:space:]]+$'
  )
);

create unique index tenant_regulatory_scope_active_rule_uq
  on public.tenant_regulatory_scopes (tenant_id, rule_id)
  where origin = 'PROFILE_RULE' and superseded_at is null;
create index tenant_regulatory_scope_tenant_idx
  on public.tenant_regulatory_scopes (tenant_id, superseded_at, created_at desc);

alter table public.tenant_regulatory_scopes enable row level security;
create policy tenant_regulatory_scopes_select on public.tenant_regulatory_scopes
  for select using (tenant_id = public.current_tenant_id());
create policy tenant_regulatory_scopes_manual_insert on public.tenant_regulatory_scopes
  for insert with check (
    tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('admin', 'uyum')
    and origin = 'MANUAL'
    and scope_status = 'MANUAL_TRACKED'
    and added_by = auth.uid()
  );
-- UPDATE/DELETE politikasi yok: kapsam izi append-only kalir.

create or replace function public.audit_tenant_regulatory_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
  values (
    new.tenant_id, auth.uid(), 'mevzuat_kapsami_eklendi',
    'tenant_regulatory_scopes', new.id,
    jsonb_build_object('origin', new.origin, 'scope_status', new.scope_status, 'source_id', new.source_id)
  );
  return new;
end;
$$;
create trigger audit_tenant_regulatory_scope_after_insert
  after insert on public.tenant_regulatory_scopes
  for each row execute function public.audit_tenant_regulatory_scope();

-- Idempotent profil senkronu. Yalniz VERIFIED kural modul acar; taslak kurallar
-- izlemeye REVIEW_REQUIRED olarak girer ve hukuki sonuc gibi kullanilamaz.
create or replace function public.regulatory_scope_refresh(p_tenant_id uuid)
returns table (eklenen integer, inceleme_gerekli integer, aktif_modul_kurali integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_types text[];
  v_jurisdictions text[];
  v_before integer;
begin
  if auth.uid() is not null then
    if p_tenant_id is distinct from public.current_tenant_id()
       or public.current_user_role() not in ('admin', 'uyum') then
      raise exception 'Mevzuat kapsami yalniz kendi kiracisi icin admin/uyum tarafindan yenilenebilir';
    end if;
  end if;

  select regulated_entity_types, jurisdictions
    into v_types, v_jurisdictions
  from public.organization_profiles
  where tenant_id = p_tenant_id;

  if v_types is null or cardinality(v_types) = 0 then
    return query select 0, 0, 0;
    return;
  end if;

  select count(*) into v_before
  from public.tenant_regulatory_scopes
  where tenant_id = p_tenant_id and origin = 'PROFILE_RULE' and superseded_at is null;

  -- Profil veya kural dogrulama durumu degistiyse eski otomatik satiri kapat;
  -- gecmisi yerinde yeniden yazma. Asagidaki INSERT yeni kapsam dilimini acar.
  update public.tenant_regulatory_scopes s
  set superseded_at = now()
  from public.regulatory_scope_rules r
  where s.rule_id = r.id
    and s.tenant_id = p_tenant_id
    and s.origin = 'PROFILE_RULE'
    and s.superseded_at is null
    and (
      r.verification_status not in ('DRAFT_RESEARCH', 'LEGAL_REVIEW', 'VERIFIED')
      or not (r.entity_type is null or r.entity_type = any(v_types))
      or not (r.required_jurisdiction is null or r.required_jurisdiction = any(v_jurisdictions))
      or s.scope_status is distinct from
        case when r.verification_status = 'VERIFIED' then 'AUTO_ACTIVE' else 'REVIEW_REQUIRED' end
    );

  insert into public.tenant_regulatory_scopes (
    tenant_id, source_id, rule_id, origin, scope_status,
    matched_entity_type, module_keys, added_by
  )
  select
    p_tenant_id, r.source_id, r.id, 'PROFILE_RULE',
    case when r.verification_status = 'VERIFIED' then 'AUTO_ACTIVE' else 'REVIEW_REQUIRED' end,
    r.entity_type,
    case when r.verification_status = 'VERIFIED' then r.module_keys else '{}'::text[] end,
    auth.uid()
  from public.regulatory_scope_rules r
  where r.verification_status in ('DRAFT_RESEARCH', 'LEGAL_REVIEW', 'VERIFIED')
    and (r.entity_type is null or r.entity_type = any(v_types))
    and (r.required_jurisdiction is null or r.required_jurisdiction = any(v_jurisdictions))
  on conflict do nothing;

  return query
  select
    greatest(count(*)::integer - v_before, 0),
    count(*) filter (where scope_status = 'REVIEW_REQUIRED')::integer,
    count(*) filter (where scope_status = 'AUTO_ACTIVE')::integer
  from public.tenant_regulatory_scopes
  where tenant_id = p_tenant_id and origin = 'PROFILE_RULE' and superseded_at is null;
end;
$$;

revoke all on function public.regulatory_scope_refresh(uuid) from public, anon;
grant execute on function public.regulatory_scope_refresh(uuid) to authenticated;

create or replace function public.organization_scope_regulatory_refresh()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' or new.regulated_entity_types is distinct from old.regulated_entity_types
     or new.jurisdictions is distinct from old.jurisdictions then
    perform public.regulatory_scope_refresh(new.tenant_id);
  end if;
  return new;
end;
$$;
create trigger organization_scope_regulatory_refresh_after_write
  after insert or update on public.organization_profiles
  for each row execute function public.organization_scope_regulatory_refresh();

-- Mevcut 36-kaynakli arastirma paketinden ACIK ve izlenebilir aday kurallar.
-- Tamami DRAFT_RESEARCH dogar; hukuk incelemesi olmadan AUTO_ACTIVE/modul acmaz.
with scope_seed(external_id, entity_type, jurisdiction, module_keys, rationale) as (
  values
    ('SPK-VII-128.10', 'ARACI_KURUM', 'TR', array['KONTROLLER','DENETIM'], 'SPK bilgi sistemleri duzenleme adayi'),
    ('SPK-VII-128.10', 'PORTFOY_YONETIM_SIRKETI', 'TR', array['KONTROLLER','DENETIM'], 'SPK bilgi sistemleri duzenleme adayi'),
    ('SPK-III-62.2', 'ARACI_KURUM', 'TR', array['DENETIM'], 'SPK bagimsiz denetim duzenleme adayi'),
    ('SPK-III-62.2', 'PORTFOY_YONETIM_SIRKETI', 'TR', array['DENETIM'], 'SPK bagimsiz denetim duzenleme adayi'),
    ('SPK-III-35B.1', 'KRIPTO_VARLIK_HIZMET_SAGLAYICI', 'TR', array['KONTROLLER'], 'Baslikta KVHS kapsami acik'),
    ('SPK-III-35B.2', 'KRIPTO_VARLIK_HIZMET_SAGLAYICI', 'TR', array['KONTROLLER'], 'Baslikta KVHS kapsami acik'),
    ('SPK-III-42.1', 'ARACI_KURUM', 'TR', array['KONTROLLER'], 'Baslikta araci kurum kapsami acik'),
    ('SPK-III-42.1', 'PORTFOY_YONETIM_SIRKETI', 'TR', array['KONTROLLER'], 'Baslikta portfoy yonetimi kapsami acik'),
    ('SPK-III-42.1', 'KRIPTO_VARLIK_HIZMET_SAGLAYICI', 'TR', array['KONTROLLER'], 'Baslikta KVHS kapsami acik'),
    ('BDDK-BANK-BS', 'BANKA', 'TR', array['KONTROLLER','DENETIM'], 'Baslikta banka kapsami acik'),
    ('BDDK-REMOTE-ID', 'BANKA', 'TR', array['KONTROLLER'], 'Baslikta banka kapsami acik'),
    ('BDDK-PENTEST', 'BANKA', 'TR', array['KONTROLLER','DENETIM'], 'Baslikta banka kapsami acik'),
    ('BDDK-BADES', 'BANKA', 'TR', array['DENETIM'], 'BDDK uyum denetimi aday kapsami'),
    ('BDDK-ELEKTRONIK-ISLEM-GUVENLIGI', 'BANKA', 'TR', array['KONTROLLER'], 'Baslikta elektronik bankacilik kapsami acik'),
    ('BDDK-FKF-BS', 'FINANSAL_KIRALAMA_FAKTORING_FINANSMAN', 'TR', array['KONTROLLER','DENETIM'], 'Baslikta FKF kapsami acik'),
    ('BDDK-BAKIS', 'BILGI_ALISVERISI_KURULUSU', 'TR', array['KONTROLLER','DENETIM'], 'Baslikta bilgi alisverisi kurulusu kapsami acik'),
    ('KVKK-BANK-GUIDE', 'BANKA', 'TR', array['GIZLILIK'], 'Baslikta bankacilik sektoru kapsami acik'),
    ('KVKK-PAY-GUIDE', 'ODEME_E_PARA_KURULUSU', 'TR', array['GIZLILIK'], 'Baslikta odeme/e-para sektoru kapsami acik'),
    ('LAW-7518', 'KRIPTO_VARLIK_HIZMET_SAGLAYICI', 'TR', array['KONTROLLER'], 'Kripto varlik sermaye piyasasi degisikligi aday kapsami')
)
insert into public.regulatory_scope_rules (
  source_id, entity_type, required_jurisdiction, module_keys, rationale
)
select distinct a.source_id, s.entity_type, s.jurisdiction, s.module_keys, s.rationale
from scope_seed s
join public.source_artifacts a on a.external_id = s.external_id
on conflict do nothing;
