-- M37 — AI Assurance & Agent Governance (Gate G5, ilk üretim dikeyi).
--
-- M30 (AB AI Act İÇERİK paketi) ile KARIŞTIRMA: M37 kurumun kullandığı AI
-- sistem/ajanları için OPERASYONEL yönetim düzlemidir. Nihai talimat + PRQ0
-- ADR-2 (AI karar sınırı) burada DB invariant'ına dönüşür.
--
-- ÇEKİRDEK İNVARYANT'lar (DB guard):
--   * PROHIBITED risk sınıfı AKTIF olamaz (yasak uygulama çalıştırılamaz);
--   * yazma yetkisi olan ajan İNSAN ONAYI gerektirir (otonom yazan ajan yok);
--   * AI Decision Receipt: karar SUGGESTED doğar; ACCEPTED/REJECTED yalnız
--     İNSAN reviewer ile (AI kendi önerisini kabul EDEMEZ — kural: AI
--     VERIFIED/PASSED/kabul yapamaz). Karar verilince içerik donuk.
--
-- AI HENÜZ ÜRÜNDE YOK (model sağlayıcı = kurucu kararı #1): bu katman KAYIT +
-- SINIR; AI entegre olunca receipt'ler dolar. Sınır ŞİMDİDEN DB'de.
--
-- ROLLBACK NOTU: ters FK sırasıyla drop (ai_execution_receipts, ai_agents,
-- ai_systems). Üretim verisi yok — fresh drop güvenli.

-- --- AI sistem/model envanteri ---
create table public.ai_systems (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  ad text not null,
  saglayici text,
  -- AB AI Act rolleri.
  rol text not null default 'DEPLOYER' check (rol in ('PROVIDER', 'DEPLOYER', 'IMPORTER', 'DISTRIBUTOR')),
  kullanim_amaci text,
  -- AB AI Act risk sınıfları.
  risk_sinifi text not null default 'MINIMAL' check (risk_sinifi in ('PROHIBITED', 'HIGH', 'LIMITED', 'MINIMAL')),
  owner uuid references public.profiles (id) on delete set null,
  -- FRIA/DPIA ilişkisi (opsiyonel — privacy_assessments'a bağ).
  dpia_assessment_id uuid references public.privacy_assessments (id) on delete set null,
  -- KALKAN_OS'un kendi AI ajanları da AYNI governance altında.
  kendi_ajanimiz boolean not null default false,
  durum text not null default 'KAYITLI' check (durum in ('KAYITLI', 'AKTIF', 'DEVRE_DISI')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, ad)
);

create trigger ai_systems_set_updated_at
  before update on public.ai_systems
  for each row execute function public.set_updated_at();

/**
 * YASAK UYGULAMA GUARD'I: PROHIBITED risk sınıflı sistem AKTIF olamaz.
 */
create or replace function public.ai_system_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.risk_sinifi = 'PROHIBITED' and new.durum = 'AKTIF' then
    raise exception 'PROHIBITED risk sinifli AI sistemi AKTIF edilemez (yasak uygulama)';
  end if;
  return new;
end;
$$;

create trigger ai_system_guard_trg
  before insert or update on public.ai_systems
  for each row execute function public.ai_system_guard();

-- --- AI ajan (yetki + insan gözetimi + kill/disable) ---
create table public.ai_agents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  ai_system_id uuid not null references public.ai_systems (id) on delete cascade,
  ad text not null,
  -- Makine kimliği (service_role VERİLMEZ — dar, görev bazlı; AI raporu §7.3).
  service_identity text,
  -- İzinli araç listesi (tool allowlist).
  izinli_araclar text[] not null default '{}',
  yazma_yetkisi boolean not null default false,
  insan_onay_gerekli boolean not null default true,
  durum text not null default 'AKTIF' check (durum in ('AKTIF', 'DEVRE_DISI')),
  devre_disi_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger ai_agents_set_updated_at
  before update on public.ai_agents
  for each row execute function public.set_updated_at();

create index ai_agents_system_idx on public.ai_agents (ai_system_id);

/**
 * AJAN GUARD'I: yazma yetkisi olan ajan İNSAN ONAYI gerektirir (otonom yazan
 * ajan yasak). Devre dışı bırakma zaman damgası (kill/disable izi).
 */
create or replace function public.ai_agent_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.yazma_yetkisi = true and new.insan_onay_gerekli is not true then
    raise exception 'Yazma yetkisi olan ajan insan onayi gerektirir (otonom yazan ajan yasak)';
  end if;
  if TG_OP = 'UPDATE' and new.durum = 'DEVRE_DISI' and old.durum is distinct from 'DEVRE_DISI' and new.devre_disi_at is null then
    new.devre_disi_at := now();
  end if;
  return new;
end;
$$;

create trigger ai_agent_guard_trg
  before insert or update on public.ai_agents
  for each row execute function public.ai_agent_guard();

-- --- AI Decision Receipt (her AI önerisinin makbuzu) ---
create table public.ai_execution_receipts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  ai_system_id uuid not null references public.ai_systems (id) on delete restrict,
  ai_agent_id uuid references public.ai_agents (id) on delete set null,
  amac text not null,
  model_saglayici text,
  model_id text,
  model_surum text,
  -- Prompt/şablon hash'i + kaynak artifact hash'leri (PII/ham prompt YAZILMAZ).
  prompt_hash text check (prompt_hash is null or prompt_hash ~ '^[0-9a-f]{64}$'),
  kaynak_hash text[] not null default '{}',
  confidence numeric,
  -- KARAR: SUGGESTED doğar; ACCEPTED/REJECTED yalnız İNSAN reviewer ile.
  karar text not null default 'SUGGESTED' check (karar in ('SUGGESTED', 'ACCEPTED', 'REJECTED')),
  reviewer uuid references public.profiles (id) on delete restrict,
  reviewer_karar_zamani timestamptz,
  -- Deterministik parmak izi (RFC 8785; adı neyi doğruladığını söyler).
  fingerprint text check (fingerprint is null or fingerprint ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);

create index ai_receipts_system_idx on public.ai_execution_receipts (ai_system_id, created_at desc);

/**
 * RECEIPT GUARD'I — AI KARAR SINIRI (nihai #5, PRQ0 ADR-2):
 *   * INSERT: karar SUGGESTED doğmalı (AI kabul edilmiş doğmaz).
 *   * SUGGESTED -> ACCEPTED/REJECTED yalnız İNSAN reviewer + zaman ile
 *     (kimlik atfı oturum sahibine sabit; service muaf DEĞİL — AI service
 *     kabul edemez, o yüzden auth.uid() null ise reviewer atanamaz).
 *   * Karar verilince (ACCEPTED/REJECTED) içerik + karar DONUK.
 */
create or replace function public.ai_receipt_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    if new.karar <> 'SUGGESTED' then
      raise exception 'AI receipt SUGGESTED dogmali (AI kendi onerisini kabul edemez)';
    end if;
    return new;
  end if;

  -- Karar verilmiş receipt tamamen donuk.
  if old.karar in ('ACCEPTED', 'REJECTED') then
    raise exception 'Karara baglanmis AI receipt degistirilemez (append-only karar)';
  end if;

  if new.karar in ('ACCEPTED', 'REJECTED') then
    if new.reviewer is null or new.reviewer_karar_zamani is null then
      raise exception 'AI receipt karari INSAN reviewer + zaman ister (AI karar veremez)';
    end if;
    -- Kimlik atfı: kararı ancak oturum sahibi (insan) verebilir; service
    -- (auth.uid null) reviewer atayamaz — AI/otomasyon kabul edemez.
    if auth.uid() is null or new.reviewer is distinct from auth.uid() then
      raise exception 'AI receipt karari ancak oturum sahibi (insan) adina verilebilir';
    end if;
  end if;
  return new;
end;
$$;

create trigger ai_receipt_guard_trg
  before insert or update on public.ai_execution_receipts
  for each row execute function public.ai_receipt_guard();

-- --- Audit: sistem durum + ajan durum + receipt kararı ---
create or replace function public.audit_ai()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
    values (new.tenant_id, auth.uid(), TG_ARGV[0] || '_olusturuldu', TG_TABLE_NAME, new.id, '{}'::jsonb);
    return new;
  end if;
  return new;
end;
$$;

create trigger audit_ai_system_insert after insert on public.ai_systems
  for each row execute function public.audit_ai('ai_sistem');
create trigger audit_ai_agent_insert after insert on public.ai_agents
  for each row execute function public.audit_ai('ai_ajan');

-- Receipt karar değişimi audit'i (SUGGESTED -> karar).
create or replace function public.audit_ai_receipt()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.karar is distinct from old.karar then
    insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
    values (new.tenant_id, auth.uid(), 'ai_receipt_karar', 'ai_execution_receipts', new.id,
      jsonb_build_object('karar', new.karar));
  end if;
  return new;
end;
$$;

create trigger audit_ai_receipt_update after update on public.ai_execution_receipts
  for each row execute function public.audit_ai_receipt();

-- --- RLS: hepsi tenant'a kilitli; yazma admin/uyum ---
alter table public.ai_systems enable row level security;
alter table public.ai_agents enable row level security;
alter table public.ai_execution_receipts enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['ai_systems', 'ai_agents', 'ai_execution_receipts']
  loop
    execute format(
      'create policy %1$s_select on public.%1$s for select using (tenant_id = public.current_tenant_id())', t);
    execute format(
      'create policy %1$s_write on public.%1$s for all using (tenant_id = public.current_tenant_id() and public.current_user_role() in (''admin'', ''uyum'')) with check (tenant_id = public.current_tenant_id() and public.current_user_role() in (''admin'', ''uyum''))', t);
  end loop;
end;
$$;
