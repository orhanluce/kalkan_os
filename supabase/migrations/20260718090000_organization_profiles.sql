-- Kurum segmenti / OrganizationProfile (docs/ROADMAP.md V2 PR-2, ADR-V2-1).
--
-- İKİ ÜRÜN HATTI TEK ÇEKİRDEK: KALKAN_OS Regulated + CFO Kalkanı aynı kontrol/
-- test/kanıt motorunu paylaşır; ayrım kurum PROFİLİNDEDİR (organization_type).
--
-- NEDEN AYRI TABLO (tenants.segment'e dokunmuyoruz): tenants.segment mevcut
-- davranış/RLS/e2e'de kullanılıyor (araci_kurum/pys/kvhs/diger); onu genişletmek
-- riskli. organization_type YENİ bir katmandır; segment eski anlamıyla kalır
-- (regulated alt-tür ipucu), organization_type ürün hattını belirler.
--
-- ONBOARDING KİLİTLİ DEĞİL (V2 §6.1): yetkili organization_type'ı değiştirebilir;
-- değişim scope-recalculation gerektirir → transactional-outbox olayı
-- (SOD/entitlement yeniden değerlendirme aynı desen) + audit. Sessiz değişim yok.

create table public.organization_profiles (
  tenant_id uuid primary key references public.tenants (id) on delete cascade,
  organization_type text not null default 'CORPORATE_FINANCE'
    check (organization_type in (
      'REGULATED_FINANCIAL_INSTITUTION', 'CORPORATE_FINANCE', 'MIXED_GROUP'
    )),
  -- V2 §4.1 profil alanları. Diziler text[]; band'ler serbest enum-benzeri text
  -- (kurucu bant değerleri K-kararı olana dek serbest — uydurulmaz, UI seçtirir).
  operating_sectors text[] not null default '{}',
  regulated_status text check (regulated_status is null or regulated_status in (
    'REGULATED', 'NOT_REGULATED', 'PARTIALLY_REGULATED', 'UNKNOWN'
  )),
  regulator_types text[] not null default '{}',
  jurisdictions text[] not null default '{}',
  employee_band text,
  legal_entity_count integer check (legal_entity_count is null or legal_entity_count >= 0),
  -- Finans departmanı (CFO Kalkanı) alanları.
  finance_department_enabled boolean not null default false,
  finance_function_types text[] not null default '{}',
  erp_systems text[] not null default '{}',
  bank_portal_count_band text,
  payment_volume_band text,
  payroll_in_scope boolean not null default false,
  supplier_master_in_scope boolean not null default false,
  critical_supplier_status boolean not null default false,
  -- Profil ne zaman "tamamlandı" işaretlendi (TTV: time_to_profile_complete).
  profil_tamamlandi_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger organization_profiles_set_updated_at
  before update on public.organization_profiles
  for each row execute function public.set_updated_at();

alter table public.organization_profiles enable row level security;

/**
 * current_user_role(): oturum sahibinin rolü (RLS içinde kullanılabilir).
 * SECURITY DEFINER — kendi profiles satırını RLS'i tetiklemeden okur (aksi
 * halde policy içinde profiles'a bakmak özyineleme riski taşırdı). Politikalar
 * bu fonksiyona başvurduğu için ÖNCE tanımlanır.
 */
create or replace function public.current_user_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select role from public.profiles where id = auth.uid()
$$;

-- Okuma: kendi kiracısı. Yazma: yalnız admin/uyum (segment ürün hattını
-- belirler — denetçi misafir değiştiremez). Rol RLS'te de zorlanır, yalnız
-- route'a bırakılmaz.
create policy organization_profiles_select on public.organization_profiles
  for select using (tenant_id = public.current_tenant_id());

create policy organization_profiles_insert on public.organization_profiles
  for insert with check (
    tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('admin', 'uyum')
  );

create policy organization_profiles_update on public.organization_profiles
  for update using (
    tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('admin', 'uyum')
  )
  with check (
    tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('admin', 'uyum')
  );

/**
 * KAPSAM YENİDEN HESAPLAMA: organization_type değişimi (ve finance_department
 * açılışı) uygulanabilirlik/entitlement sonucunu etkiler. Değişim commit
 * olduysa "yeniden değerlendir" borcu da GARANTİ kayıtlı olmalı (SoD tetik
 * deseniyle aynı transactional-outbox). Sadece organization_type VEYA
 * finance_department_enabled değişince olay yazılır (her alan değişiminde değil).
 */
create or replace function public.organization_scope_recalc_kuyrukla()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.organization_type is distinct from old.organization_type
     or new.finance_department_enabled is distinct from old.finance_department_enabled then
    insert into public.sod_outbox (tenant_id, event_type, payload)
    values (
      new.tenant_id, 'ORGANIZATION_SCOPE_DEGISTI',
      jsonb_build_object(
        'organization_type_onceki', old.organization_type,
        'organization_type', new.organization_type,
        'finance_onceki', old.finance_department_enabled,
        'finance', new.finance_department_enabled
      )
    );
  end if;
  return new;
end;
$$;

create trigger organization_scope_recalc_after_update
  after update on public.organization_profiles
  for each row execute function public.organization_scope_recalc_kuyrukla();

/**
 * Denetim izi: profil oluşturma + organization_type/finance değişimi.
 * Serbest metin/dizi İÇERİĞİ yazılmaz (kural 7) — yalnız hangi tür, ne zaman.
 */
create or replace function public.audit_organization_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
    values (
      new.tenant_id, auth.uid(), 'organizasyon_profili_olusturuldu',
      'organization_profiles', new.tenant_id,
      jsonb_build_object('organization_type', new.organization_type)
    );
    return new;
  end if;

  if new.organization_type is distinct from old.organization_type
     or new.finance_department_enabled is distinct from old.finance_department_enabled then
    insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
    values (
      new.tenant_id, auth.uid(), 'organizasyon_profili_degisti',
      'organization_profiles', new.tenant_id,
      jsonb_build_object(
        'organization_type_onceki', old.organization_type, 'organization_type', new.organization_type,
        'finance_onceki', old.finance_department_enabled, 'finance', new.finance_department_enabled
      )
    );
  end if;
  return new;
end;
$$;

create trigger audit_organization_profile_after_insert
  after insert on public.organization_profiles
  for each row execute function public.audit_organization_profile();
create trigger audit_organization_profile_after_update
  after update on public.organization_profiles
  for each row execute function public.audit_organization_profile();
