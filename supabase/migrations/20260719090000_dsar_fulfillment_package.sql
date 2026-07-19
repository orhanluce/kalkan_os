-- DSAR karşılanma kanıt paketi (M36 sonraki dilim; G3 şeffaflık defterine bağlı).
--
-- NE EKLER: bir DSAR TAMAMLANDI'ya geçtiğinde, ne zaman karşılandığını ve hangi
-- veri KATEGORİLERİNİN açıklandığını mühürleyen imzalı bir paket üretilir;
-- kanonik manifest ES256 ile imzalanıp transparency_ledger_entries'e yazılır.
-- Mantık uygulama katmanında (imza Web Crypto — DB'de yapılamaz); bu tablo
-- paketi DSAR'a ve defter kaydına BAĞLAR. Mevcut DSAR tablosu/guard'ı
-- DEĞİŞMEZ — bu eklemeli bir kabiliyettir.
--
-- VERİ MİNİMİZASYONU (kural: ham PII saklanmaz): manifest yalnız kategori
-- ETİKETLERİ + veri sahibinin sha256 hash'ini taşır; açıklanan verinin kendisi
-- pakete GİRMEZ (o, veri sahibine doğrudan iletilir).
--
-- APPEND-ONLY: paket bir kez mühürlenir, UPDATE reddedilir (kural 2). Bir DSAR
-- için tek paket (unique dsar_id).

create table public.dsar_fulfillment_packages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  dsar_id uuid not null references public.data_subject_requests (id) on delete cascade,
  -- Ne açıklandığını mühürleyen kanonik manifest + hash'i (statementHash).
  manifest jsonb not null,
  manifest_hash text not null check (manifest_hash ~ '^[0-9a-f]{64}$'),
  aciklanan_kategoriler text[] not null default '{}',
  -- Deftere yazılan imzalı ifadenin tamamı (jws + kid + publicJwk).
  signed_statement jsonb not null,
  ledger_entry_id uuid not null references public.transparency_ledger_entries (id) on delete restrict,
  leaf_index bigint not null,
  olusturuldu_at timestamptz not null default now(),
  -- Bir DSAR için tek kanıt paketi.
  unique (dsar_id)
);

create index dsar_packages_tenant_idx on public.dsar_fulfillment_packages (tenant_id, olusturuldu_at desc);
create index dsar_packages_dsar_idx on public.dsar_fulfillment_packages (dsar_id);

/**
 * GUARD: paket ancak TAMAMLANDI bir DSAR için mühürlenebilir (karşılanmamış
 * talep için kanıt üretmek anlamsız + yanıltıcı). Tenant tutarlılığı ve defter
 * kaydının aynı kiracıya ait olduğu da burada zorlanır (service_role dahil).
 */
create or replace function public.dsar_paket_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_durum text;
  v_tenant uuid;
begin
  select durum, tenant_id into v_durum, v_tenant
  from public.data_subject_requests where id = new.dsar_id;

  if v_tenant is null then
    raise exception 'DSAR bulunamadi';
  end if;
  if v_tenant is distinct from new.tenant_id then
    raise exception 'DSAR baska bir kiraciya ait';
  end if;
  if v_durum is distinct from 'TAMAMLANDI' then
    raise exception 'Kanit paketi yalniz TAMAMLANDI DSAR icin muhurlenebilir (durum: %)', v_durum;
  end if;

  -- Defter kaydı aynı kiracının mı?
  if not exists (
    select 1 from public.transparency_ledger_entries
    where id = new.ledger_entry_id and tenant_id = new.tenant_id
  ) then
    raise exception 'Defter kaydi bulunamadi veya baska kiraciya ait';
  end if;

  return new;
end;
$$;

create trigger dsar_paket_guard_before_insert
  before insert on public.dsar_fulfillment_packages
  for each row execute function public.dsar_paket_guard();

-- Değişmezlik: UPDATE reddedilir (append-only). DELETE yalnız tenant cascade.
create or replace function public.dsar_paket_immutable()
returns trigger
language plpgsql
as $$
begin
  if TG_OP = 'UPDATE' then
    raise exception 'DSAR kanit paketi append-only: UPDATE yasak';
  end if;
  return old;
end;
$$;

create trigger dsar_paket_immutable_trg
  before update on public.dsar_fulfillment_packages
  for each row execute function public.dsar_paket_immutable();

-- Denetim izi: paket mührü (invariant #15, tenant-scope).
create or replace function public.audit_dsar_paket()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
  values (new.tenant_id, auth.uid(), 'dsar_kanit_paketi_muhurlendi', 'dsar_fulfillment_packages', new.id,
    jsonb_build_object('dsar_id', new.dsar_id, 'manifest_hash', new.manifest_hash, 'leaf_index', new.leaf_index));
  return new;
end;
$$;

create trigger audit_dsar_paket_after_insert
  after insert on public.dsar_fulfillment_packages
  for each row execute function public.audit_dsar_paket();

-- RLS: tenant'a kilitli; yazma admin/uyum; UPDATE/DELETE kapalı.
alter table public.dsar_fulfillment_packages enable row level security;

create policy dsar_packages_select on public.dsar_fulfillment_packages
  for select using (tenant_id = public.current_tenant_id());
create policy dsar_packages_insert on public.dsar_fulfillment_packages
  for insert with check (
    tenant_id = public.current_tenant_id() and public.current_user_role() in ('admin', 'uyum')
  );

revoke update, delete on public.dsar_fulfillment_packages from authenticated, anon;
