-- Dikey G1: pilota sunulabilecek mevzuat paketleri kataloğu + tenant'ın
-- hangi paketi seçtiğinin kaydı. Mevzuat İÇERİĞİ burada YOK (kural 3 —
-- data/controls/*.yaml zaten tek kaynak); bu tablo yalnız "hangi madde_ref
-- kümesi bir pakette gruplanmış ve hukukça doğrulanmış mı" sorusunu cevaplar.
--
-- kural 3/6'nın obligations.dogrulama_durumu guard'ıyla AYNI beş durumlu
-- sözleşme (yeni bir doğrulama dili icat edilmedi): hiçbir paket VERIFIED
-- DOĞMAZ, yalnız LEGAL_REVIEW'den + dogrulayan atfıyla VERIFIED olur.

create table public.regulation_packages (
  id uuid primary key default gen_random_uuid(),
  kod text not null unique,
  ad text not null,
  madde_ref_kodlari text[] not null default '{}',
  kaynak_url text,
  yayim_tarihi date,
  surum integer not null default 1 check (surum > 0),
  hukuk_dogrulama_durumu text not null default 'DRAFT_RESEARCH'
    check (hukuk_dogrulama_durumu in ('DRAFT_RESEARCH', 'TODO_DOGRULA', 'LEGAL_REVIEW', 'VERIFIED', 'SUPERSEDED', 'REJECTED')),
  dogrulayan uuid references public.profiles (id) on delete restrict,
  dogrulama_zamani timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger regulation_packages_set_updated_at
  before update on public.regulation_packages
  for each row execute function public.set_updated_at();

create or replace function public.regulation_package_dogrulama_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    if new.hukuk_dogrulama_durumu = 'VERIFIED' then
      raise exception 'regulation_packages: kayit VERIFIED dogamaz (kural 3)';
    end if;
    return new;
  end if;

  if new.hukuk_dogrulama_durumu = 'VERIFIED' and old.hukuk_dogrulama_durumu is distinct from 'VERIFIED' then
    if old.hukuk_dogrulama_durumu is distinct from 'LEGAL_REVIEW' then
      raise exception 'regulation_packages: VERIFIED gecisi yalniz LEGAL_REVIEW uzerinden yapilabilir';
    end if;
    if new.dogrulayan is null or new.dogrulama_zamani is null then
      raise exception 'regulation_packages: VERIFIED gecisi dogrulayan ve dogrulama_zamani gerektirir';
    end if;
  end if;

  if old.hukuk_dogrulama_durumu = 'VERIFIED' and new.hukuk_dogrulama_durumu = 'VERIFIED' then
    if new.kod is distinct from old.kod
      or new.madde_ref_kodlari is distinct from old.madde_ref_kodlari
      or new.kaynak_url is distinct from old.kaynak_url
      or new.yayim_tarihi is distinct from old.yayim_tarihi then
      raise exception 'regulation_packages: VERIFIED paketin icerigi degistirilemez: once dogrulama geri alinmali';
    end if;
  end if;

  return new;
end;
$$;

create trigger regulation_package_dogrulama_guard_trigger
  before insert or update on public.regulation_packages
  for each row execute function public.regulation_package_dogrulama_guard();

alter table public.regulation_packages enable row level security;

-- Katalog TÜM authenticated kullanıcılar için okunur (tenant-scoped değil —
-- global bir katalog, frameworks/controls'un kendi görünürlüğüyle tutarlı).
create policy regulation_packages_select_authenticated on public.regulation_packages
  for select using (auth.role() = 'authenticated');

-- Yazma yalnız service_role (kural: mevzuat içeriği/paket kataloğu insan
-- doğrulamasıyla, script/rota üzerinden girilir — UI'dan serbest CRUD yok).

-- ---------------------------------------------------------------------
-- Tenant'ın seçtiği mevzuat kapsamı — append-only + audit.
create table public.tenant_regulation_scope (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  regulation_package_id uuid not null references public.regulation_packages (id) on delete restrict,
  secen uuid not null references public.profiles (id) on delete restrict,
  secim_zamani timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (tenant_id, regulation_package_id)
);

create index tenant_regulation_scope_tenant_idx on public.tenant_regulation_scope (tenant_id);

-- "Taslak paket varsayılan seçim olamaz" — yalnız VERIFIED paketler
-- tenant'a bağlanabilir (sunucu tarafında, UI gizlemesi değil).
create or replace function public.tenant_regulation_scope_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_durum text;
begin
  select hukuk_dogrulama_durumu into v_durum
  from public.regulation_packages where id = new.regulation_package_id;
  if v_durum is distinct from 'VERIFIED' then
    raise exception 'tenant_regulation_scope: yalniz hukukca VERIFIED paketler secilebilir (mevcut durum: %)', v_durum;
  end if;
  if new.secen <> auth.uid() and auth.role() <> 'service_role' then
    raise exception 'tenant_regulation_scope.secen must be the session holder';
  end if;
  return new;
end;
$$;

create trigger tenant_regulation_scope_guard_trigger
  before insert on public.tenant_regulation_scope
  for each row execute function public.tenant_regulation_scope_guard();

-- Append-only: seçim geri alınmaz, yalnız yeni bir seçim eklenir (tarihsel
-- iz korunur — impact_tolerances'ın supersede yerine burada basitçe "ek
-- kayıt" yeterli, tek bir tenant birden fazla paket seçebilir).
revoke update, delete on public.tenant_regulation_scope from authenticated, anon;

alter table public.tenant_regulation_scope enable row level security;

create policy tenant_regulation_scope_select_own_tenant on public.tenant_regulation_scope
  for select using (tenant_id = public.current_tenant_id());
create policy tenant_regulation_scope_insert_own_tenant on public.tenant_regulation_scope
  for insert with check (tenant_id = public.current_tenant_id());

create or replace function public.audit_tenant_regulation_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
  values (
    new.tenant_id, new.secen, 'tenant_regulation_scope_secildi', 'tenant_regulation_scope', new.id,
    jsonb_build_object('regulation_package_id', new.regulation_package_id)
  );
  return new;
end;
$$;

create trigger audit_tenant_regulation_scope_after_insert
  after insert on public.tenant_regulation_scope
  for each row execute function public.audit_tenant_regulation_scope();
