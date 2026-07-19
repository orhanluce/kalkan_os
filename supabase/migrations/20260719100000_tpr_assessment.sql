-- M35 sonraki dilim — Tedarikçi değerlendirme / anket / bulgu (DORA due-diligence).
--
-- MEVCUT M35 grafına (third_parties/services/...) EKLEMELİ: bir tedarikçi için
-- değerlendirme (assessment) açılır, anket soruları yanıtlanır, bulgular
-- (finding) kaydedilir. third_parties tablosu/guard'ı DEĞİŞMEZ.
--
-- ANAHTAR İNVARYANTLAR:
--  (kural 14) Bulgu kapanışı KANIT + YETKİ ister: KAPANDI'ya geçiş ancak
--    kapanis_kanit + kapatan + zaman ile; ticket kapatmak bulgu kapatmaz.
--  (due-diligence kontrolü) Açık KRİTİK bulgu varken değerlendirme TAMAMLANDI
--    OLAMAZ — çözülmemiş kritik riskle vendor sign-off imzalanamaz.
--  (kimlik atfı, M16 #9 deseni) degerlendiren/kapatan istemci bağlamında
--    oturum sahibine sabit (service/cron muaf).
--
-- İÇERİK UYDURULMAZ (kural 3): anket soruları/cevapları + bulgular tenant
-- tarafından girilir; dış rating otomatik bulgu/karar üretmez (invariant #25).

-- --- Değerlendirme ---
create table public.third_party_assessments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  third_party_id uuid not null references public.third_parties (id) on delete cascade,
  tur text not null default 'OPERASYONEL'
    check (tur in ('GUVENLIK', 'GIZLILIK', 'FINANSAL', 'OPERASYONEL', 'DORA')),
  durum text not null default 'TASLAK' check (durum in ('TASLAK', 'DEVAM', 'TAMAMLANDI')),
  degerlendiren uuid references public.profiles (id) on delete restrict,
  ozet text,
  baslangic_at timestamptz not null default now(),
  tamamlandi_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger third_party_assessments_set_updated_at
  before update on public.third_party_assessments
  for each row execute function public.set_updated_at();

create index tpa_third_party_idx on public.third_party_assessments (third_party_id, baslangic_at desc);

-- --- Anket sorusu (değerlendirme içi) ---
create table public.assessment_questions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  assessment_id uuid not null references public.third_party_assessments (id) on delete cascade,
  soru text not null,
  cevap text,
  -- Risk seviyesi yanıtlanınca dolar (null = henüz değerlendirilmedi ≠ DÜŞÜK).
  risk_seviyesi text check (risk_seviyesi in ('DUSUK', 'ORTA', 'YUKSEK')),
  sira integer not null default 0,
  created_at timestamptz not null default now()
);

create index assessment_questions_idx on public.assessment_questions (assessment_id, sira);

-- --- Bulgu ---
create table public.assessment_findings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  assessment_id uuid not null references public.third_party_assessments (id) on delete cascade,
  -- Sorgu kolaylığı için denormalize (aynı tenant guard'da doğrulanır).
  third_party_id uuid not null references public.third_parties (id) on delete cascade,
  baslik text not null,
  aciklama text,
  ciddiyet text not null default 'ORTA' check (ciddiyet in ('DUSUK', 'ORTA', 'YUKSEK', 'KRITIK')),
  durum text not null default 'ACIK' check (durum in ('ACIK', 'AKSIYON_PLANLI', 'KAPANDI')),
  sahibi uuid references public.profiles (id) on delete restrict,
  hedef_tarih date,
  -- Kapanış (kural 14): kanıt + kapatan + zaman.
  kapanis_kanit text,
  kapatan uuid references public.profiles (id) on delete restrict,
  kapanis_zamani timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger assessment_findings_set_updated_at
  before update on public.assessment_findings
  for each row execute function public.set_updated_at();

create index assessment_findings_assessment_idx on public.assessment_findings (assessment_id);
create index assessment_findings_acik_kritik_idx on public.assessment_findings (assessment_id, ciddiyet, durum);

/**
 * BULGU KAPANIŞ GUARD'I (kural 14): KAPANDI ancak kanıt + kapatan + zaman ile.
 * Kimlik atfı: kapatan istemci bağlamında oturum sahibi (service/cron muaf).
 */
create or replace function public.assessment_finding_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- third_party_id, değerlendirmenin tedarikçisiyle tutarlı olmalı.
  if not exists (
    select 1 from public.third_party_assessments a
    where a.id = new.assessment_id and a.third_party_id = new.third_party_id and a.tenant_id = new.tenant_id
  ) then
    raise exception 'Bulgu, degerlendirmenin tedarikcisi/kiracisiyla tutarsiz';
  end if;

  if new.durum = 'KAPANDI' then
    if new.kapanis_kanit is null or btrim(new.kapanis_kanit) = ''
       or new.kapatan is null or new.kapanis_zamani is null then
      raise exception 'Bulgu kapanisi kanit + kapatan + zaman ister (kural 14: ticket kapatmak bulgu kapatmaz)';
    end if;
    if auth.uid() is not null and new.kapatan is distinct from auth.uid() then
      raise exception 'Bulgu ancak oturum sahibi adina kapatilabilir (kimlik atfi)';
    end if;
  end if;
  return new;
end;
$$;

create trigger assessment_finding_guard_trg
  before insert or update on public.assessment_findings
  for each row execute function public.assessment_finding_guard();

/**
 * DEĞERLENDİRME TAMAMLAMA GUARD'I: TAMAMLANDI ancak degerlendiren + zaman ile
 * VE açık KRİTİK bulgu YOKKEN (çözülmemiş kritik riskle sign-off imzalanamaz).
 * degerlendiren istemci bağlamında oturum sahibi (kimlik atfı).
 */
create or replace function public.assessment_tamamla_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.durum = 'TAMAMLANDI' and (old.durum is distinct from 'TAMAMLANDI') then
    if new.degerlendiren is null then
      raise exception 'Degerlendirme TAMAMLANDI icin degerlendiren zorunlu';
    end if;
    if auth.uid() is not null and new.degerlendiren is distinct from auth.uid() then
      raise exception 'Degerlendirmeyi ancak oturum sahibi tamamlayabilir (kimlik atfi)';
    end if;
    if new.tamamlandi_at is null then
      new.tamamlandi_at := now();
    end if;
    if exists (
      select 1 from public.assessment_findings f
      where f.assessment_id = new.id and f.ciddiyet = 'KRITIK' and f.durum <> 'KAPANDI'
    ) then
      raise exception 'Acik KRITIK bulgu varken degerlendirme TAMAMLANDI olamaz (once kritik bulguyu kapatin)';
    end if;
  end if;
  return new;
end;
$$;

create trigger assessment_tamamla_guard_trg
  before update on public.third_party_assessments
  for each row execute function public.assessment_tamamla_guard();

-- --- Audit: değerlendirme durumu + bulgu durumu ---
create or replace function public.audit_tpr_assessment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
    values (new.tenant_id, auth.uid(), 'tedarikci_degerlendirme_olusturuldu', TG_TABLE_NAME, new.id,
      jsonb_build_object('durum', new.durum));
    return new;
  end if;
  if new.durum is distinct from old.durum then
    insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
    values (new.tenant_id, auth.uid(), 'tedarikci_degerlendirme_durum_degisti', TG_TABLE_NAME, new.id,
      jsonb_build_object('durum_onceki', old.durum, 'durum', new.durum));
  end if;
  return new;
end;
$$;

create trigger audit_tpa_insert after insert on public.third_party_assessments
  for each row execute function public.audit_tpr_assessment();
create trigger audit_tpa_update after update on public.third_party_assessments
  for each row execute function public.audit_tpr_assessment();
create trigger audit_finding_insert after insert on public.assessment_findings
  for each row execute function public.audit_tpr_assessment();
create trigger audit_finding_update after update on public.assessment_findings
  for each row execute function public.audit_tpr_assessment();

-- --- RLS: tenant'a kilitli; yazma admin/uyum ---
alter table public.third_party_assessments enable row level security;
alter table public.assessment_questions enable row level security;
alter table public.assessment_findings enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['third_party_assessments', 'assessment_questions', 'assessment_findings']
  loop
    execute format(
      'create policy %1$s_select on public.%1$s for select using (tenant_id = public.current_tenant_id())', t);
    execute format(
      'create policy %1$s_write on public.%1$s for all using (tenant_id = public.current_tenant_id() and public.current_user_role() in (''admin'', ''uyum'')) with check (tenant_id = public.current_tenant_id() and public.current_user_role() in (''admin'', ''uyum''))', t);
  end loop;
end;
$$;
