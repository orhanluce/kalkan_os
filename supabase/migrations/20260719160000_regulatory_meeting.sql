-- M38 sonraki dilim — Regülatör toplantı kaydı (RegulatoryMeeting, G7 veri
-- modeli; nihai talimat v3.2 §8.0 sonu öncelik #4, SON).
--
-- NE EKLER: mevcut regülatör matter/request/response zincirine (bir otorite
-- soruşturması/denetimi/bilgi talebi) EKLEMELİ — bir matter kapsamında yapılan
-- TOPLANTININ (görüşme, saha ziyareti, telefon görüşmesi) kaydı. Şu ana kadar
-- yalnız YAZIŞMA (request/response) izleniyordu; toplantı da aynı zincirin
-- parçası olmalı — denetçi "bu konu ne zaman, kimlerle görüşüldü" diye sorabilir.
--
-- İÇERİK UYDURULMAZ (kural 3): toplantı notları/katılımcı listesi tenant
-- tarafından girilir. Mevcut regulatory_matters/requests ile AYNI mutable
-- stil (durum makinesi/immutable DEĞİL) — bu bir kayıt defteri, bir kanıt
-- zinciri değil (kanıt zinciri ihtiyacı response'un gonderim_receipt'inde
-- zaten var).

create table public.regulatory_meetings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  matter_id uuid not null references public.regulatory_matters (id) on delete cascade,
  konu text not null,
  tarih timestamptz not null default now(),
  -- Katılımcılar: serbest metin listesi (ad + rol) — ayrı bir kişi tablosu
  -- gerektirecek kadar karmaşık değil; ExternalProfessional/Organization
  -- (M41 partner ağı) ile eşleme sonraki dilim.
  katilimcilar text[] not null default '{}',
  notlar text,
  kayit_eden uuid references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger regulatory_meetings_set_updated_at
  before update on public.regulatory_meetings
  for each row execute function public.set_updated_at();

create index regulatory_meetings_matter_idx on public.regulatory_meetings (matter_id, tarih desc);

/** Kimlik atfı: kayıt eden istemci bağlamında oturum sahibi (M16 #9 deseni; service/cron muaf). */
create or replace function public.regulatory_meeting_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and new.kayit_eden is not null and new.kayit_eden is distinct from auth.uid() then
    raise exception 'Toplanti kaydi ancak oturum sahibi adina girilebilir (kimlik atfi)';
  end if;
  return new;
end;
$$;

create trigger regulatory_meeting_guard_trg
  before insert or update on public.regulatory_meetings
  for each row execute function public.regulatory_meeting_guard();

create or replace function public.audit_regulatory_meeting()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
    values (new.tenant_id, auth.uid(), 'regulator_toplantisi_kaydedildi', 'regulatory_meetings', new.id,
      jsonb_build_object('matter_id', new.matter_id, 'konu', new.konu));
    return new;
  end if;
  insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
  values (new.tenant_id, auth.uid(), 'regulator_toplantisi_guncellendi', 'regulatory_meetings', new.id, '{}'::jsonb);
  return new;
end;
$$;

create trigger audit_regulatory_meeting_insert
  after insert on public.regulatory_meetings
  for each row execute function public.audit_regulatory_meeting();
create trigger audit_regulatory_meeting_update
  after update on public.regulatory_meetings
  for each row execute function public.audit_regulatory_meeting();

alter table public.regulatory_meetings enable row level security;

create policy regulatory_meetings_select on public.regulatory_meetings
  for select using (tenant_id = public.current_tenant_id());
create policy regulatory_meetings_write on public.regulatory_meetings
  for all using (tenant_id = public.current_tenant_id() and public.current_user_role() in ('admin', 'uyum'))
  with check (tenant_id = public.current_tenant_id() and public.current_user_role() in ('admin', 'uyum'));
