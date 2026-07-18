-- M38 Regulatory Engagement + M41 Partner (dış erişim) — Gate G7, ilk dikey.
--
-- TENANT'A ÖZGÜ: otorite yazışması, PBC/talep, yanıt kurumun kendi verisidir.
--
-- BU DİLİM (dar-ama-çalışan): regulatory_matters (otorite incelemesi/denetimi)
-- + regulatory_requests (PBC/talep + son tarih saati) + regulatory_responses
-- (SÜRÜMLÜ yanıt + DÖRT-GÖZ onay + GÖNDERİM MAKBUZU hash) + independence_
-- declarations (dış uzman bağımsızlık/çıkar-çatışması beyanı) + matter_access_
-- grants (matter-kapsamlı süreli/iptal edilebilir DIŞ erişim) + oturumsuz
-- görünüm RPC (Proof Room deseni). Tüm görüntüleme audit'e (nihai kabul).
--
-- ROLLBACK NOTU: ters FK sırasıyla drop (matter_access_grants,
-- independence_declarations, regulatory_responses, regulatory_requests,
-- regulatory_matters). Üretim verisi yok — fresh drop güvenli.
--
-- BİLİNÇLİ SONRAKİ DİLİM: RegulatoryMeeting, ExternalOrganization/Professional
-- tam sicili, ExternalReview/ReviewNote detay iş akışı, gerçek dış otorite
-- gönderim connector'ı (AÇIK KARAR — otomatik gönderim YOK, yalnız export+makbuz).

-- --- Otorite yazışması (matter) ---
create table public.regulatory_matters (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  otorite text not null,
  tur text not null default 'BILGI_TALEBI' check (tur in ('INCELEME', 'DENETIM', 'BILGI_TALEBI', 'OLAY')),
  konu text not null,
  durum text not null default 'ACIK' check (durum in ('ACIK', 'DEVAM', 'KAPANDI')),
  acilis_tarihi date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger regulatory_matters_set_updated_at
  before update on public.regulatory_matters
  for each row execute function public.set_updated_at();

-- --- PBC / talep (son tarih) ---
create table public.regulatory_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  matter_id uuid not null references public.regulatory_matters (id) on delete cascade,
  talep_metni text not null,
  son_tarih date,
  durum text not null default 'ACIK' check (durum in ('ACIK', 'YANITLANDI', 'KAPANDI')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger regulatory_requests_set_updated_at
  before update on public.regulatory_requests
  for each row execute function public.set_updated_at();

create index regulatory_requests_matter_idx on public.regulatory_requests (matter_id);

-- --- Yanıt (sürümlü + dört-göz onay + gönderim makbuzu) ---
create table public.regulatory_responses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  request_id uuid not null references public.regulatory_requests (id) on delete cascade,
  surum integer not null check (surum > 0),
  icerik text not null,
  durum text not null default 'TASLAK' check (durum in ('TASLAK', 'ONAY_BEKLIYOR', 'ONAYLANDI', 'GONDERILDI')),
  hazirlayan uuid references public.profiles (id) on delete restrict,
  onaylayan uuid references public.profiles (id) on delete restrict,
  onay_zamani timestamptz,
  -- Gönderim makbuzu: gönderilen içeriğin hash'i (ne gönderdik, kanıt).
  gonderim_receipt text check (gonderim_receipt is null or gonderim_receipt ~ '^[0-9a-f]{64}$'),
  gonderildi_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (request_id, surum)
);

create trigger regulatory_responses_set_updated_at
  before update on public.regulatory_responses
  for each row execute function public.set_updated_at();

/**
 * YANIT GUARD'I: ONAYLANDI dört-göz (onaylayan + zaman + onaylayan≠hazırlayan);
 * GONDERILDI yalnız ONAYLANDI'dan + gönderim makbuzu (hash) ile; onaylanmış/
 * gönderilmiş yanıtın İÇERİĞİ donuk (ne onaylandıysa o gönderilir).
 */
create or replace function public.regulatory_response_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    return new;
  end if;

  if new.durum = 'ONAYLANDI' and old.durum is distinct from 'ONAYLANDI' then
    if new.onaylayan is null or new.onay_zamani is null then
      raise exception 'ONAYLANDI icin onaylayan + zaman zorunlu';
    end if;
    if new.onaylayan = new.hazirlayan then
      raise exception 'Hazirlayan kendi yanitini onaylayamaz (dort goz)';
    end if;
  end if;

  if new.durum = 'GONDERILDI' and old.durum is distinct from 'GONDERILDI' then
    if old.durum is distinct from 'ONAYLANDI' then
      raise exception 'GONDERILDI yalniz ONAYLANDI yanittan yapilir';
    end if;
    if new.gonderim_receipt is null then
      raise exception 'GONDERILDI icin gonderim makbuzu (hash) zorunlu';
    end if;
  end if;

  -- İçerik donukluğu: onaylanmış/gönderilmiş yanıt değişmez.
  if old.durum in ('ONAYLANDI', 'GONDERILDI') and new.icerik is distinct from old.icerik then
    raise exception 'Onaylanmis/gonderilmis yanitin icerigi degistirilemez (yeni surum gerekir)';
  end if;
  return new;
end;
$$;

create trigger regulatory_response_guard_trg
  before insert or update on public.regulatory_responses
  for each row execute function public.regulatory_response_guard();

-- --- Bağımsızlık beyanı (dış uzman) ---
create table public.independence_declarations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  matter_id uuid not null references public.regulatory_matters (id) on delete cascade,
  external_email text not null,
  beyan_eden_ad text not null,
  cikar_catismasi_yok boolean not null,
  beyan_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index independence_declarations_matter_idx on public.independence_declarations (matter_id, external_email);

-- --- Matter-kapsamlı dış erişim izni (Proof Room deseni) ---
create table public.matter_access_grants (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  matter_id uuid not null references public.regulatory_matters (id) on delete cascade,
  external_email text not null,
  token text not null unique default encode(gen_random_bytes(32), 'hex'),
  -- Bağımsızlık beyanı ŞART: beyan olmadan erişim ÇALIŞMAZ (RPC guard).
  bagimsizlik_beyani_id uuid references public.independence_declarations (id) on delete restrict,
  son_gecerlilik timestamptz not null,
  iptal_edildi boolean not null default false,
  olusturan uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index matter_access_grants_token_idx on public.matter_access_grants (token);

/**
 * Oturumsuz matter görünümü (Proof Room disiplini): geçersiz/dolmuş/iptal
 * token AYNI null; BAĞIMSIZLIK BEYANI YOKSA da null (çıkar-çatışması beyanı
 * olmadan dış erişim yok); her görüntüleme audit'e (aktör yok). Veri
 * minimizasyonu: talep/yanıt ÖZETİ (durum + son tarih), tam içerik değil.
 */
create or replace function public.matter_goruntule(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_grant record;
  v_matter record;
  v_talepler jsonb;
begin
  select * into v_grant from public.matter_access_grants where token = p_token;
  if v_grant is null or v_grant.son_gecerlilik < now() or v_grant.iptal_edildi
     or v_grant.bagimsizlik_beyani_id is null then
    return null;
  end if;

  select id, otorite, konu, durum into v_matter
  from public.regulatory_matters where id = v_grant.matter_id and tenant_id = v_grant.tenant_id;
  if v_matter is null then
    return null;
  end if;

  select coalesce(jsonb_agg(t order by t."sonTarih"), '[]'::jsonb) into v_talepler
  from (
    select r.talep_metni as "talepMetni", r.son_tarih as "sonTarih", r.durum,
      (select max(rr.surum) from public.regulatory_responses rr where rr.request_id = r.id and rr.durum = 'GONDERILDI') as "gonderilenSurum"
    from public.regulatory_requests r
    where r.matter_id = v_matter.id
  ) t;

  insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
  values (v_grant.tenant_id, null, 'matter_dis_goruntulendi', 'matter_access_grants', v_grant.id,
    jsonb_build_object('matter_id', v_matter.id));

  return jsonb_build_object(
    'otorite', v_matter.otorite, 'konu', v_matter.konu, 'durum', v_matter.durum,
    'sonGecerlilik', v_grant.son_gecerlilik, 'talepler', v_talepler
  );
end;
$$;

grant execute on function public.matter_goruntule(text) to anon, authenticated;

-- --- Audit: matter/yanıt durum değişimleri ---
create or replace function public.audit_regulatory_response()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
    values (new.tenant_id, auth.uid(), 'reg_yanit_olusturuldu', 'regulatory_responses', new.id,
      jsonb_build_object('surum', new.surum, 'durum', new.durum));
    return new;
  end if;
  if new.durum is distinct from old.durum then
    insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
    values (new.tenant_id, auth.uid(), 'reg_yanit_durum_degisti', 'regulatory_responses', new.id,
      jsonb_build_object('durum_onceki', old.durum, 'durum', new.durum));
  end if;
  return new;
end;
$$;

create trigger audit_regulatory_response_insert after insert on public.regulatory_responses
  for each row execute function public.audit_regulatory_response();
create trigger audit_regulatory_response_update after update on public.regulatory_responses
  for each row execute function public.audit_regulatory_response();

-- --- RLS: hepsi tenant'a kilitli; yazma admin/uyum ---
alter table public.regulatory_matters enable row level security;
alter table public.regulatory_requests enable row level security;
alter table public.regulatory_responses enable row level security;
alter table public.independence_declarations enable row level security;
alter table public.matter_access_grants enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['regulatory_matters', 'regulatory_requests', 'regulatory_responses', 'independence_declarations', 'matter_access_grants']
  loop
    execute format(
      'create policy %1$s_select on public.%1$s for select using (tenant_id = public.current_tenant_id())', t);
    execute format(
      'create policy %1$s_write on public.%1$s for all using (tenant_id = public.current_tenant_id() and public.current_user_role() in (''admin'', ''uyum'')) with check (tenant_id = public.current_tenant_id() and public.current_user_role() in (''admin'', ''uyum''))', t);
  end loop;
end;
$$;
