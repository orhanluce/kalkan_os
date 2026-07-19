-- Nihai talimat v3.3 §8.0 Dikey 4 KALANI (§1.45'te bilinçli sonraki dilim
-- olarak kaydedildi): segment-bazlı drift sonucu + insan override gerekçesi +
-- model rollback/son test + ISO 42001↔27001 crosswalk. Mevcut ai_drift_readings
-- (20260719200000) YENİDEN YAZILMADAN genişletildi.
--
-- SEGMENT-BAZLI SONUÇ: `segment` opsiyonel kolon — null=agregat, dolu=alt
-- grup (ör. demografik segment). Aynı metrik farklı segmentlerde farklı drift
-- gösterebilir; tek bir agregat sayı bunu gizleyebilir (adalet/bias izleme).
--
-- İNSAN OVERRIDE GEREKÇESİ: eşik aşan bir okumayı insan bilinçli olarak göz
-- ardı edebilir ama SESSİZCE değil — gerekçe + kimlik atfı + zaman zorunlu
-- (guard), karar verilince DONUK (ai_execution_receipts deseninin aynısı).
--
-- MODEL ROLLBACK: exit_plans (M35) deseninin aynısı — "tamamlandı" kanıtsız
-- olamaz (test edildi iddiası kanıt+tarih ister).
--
-- ISO 42001↔27001 CROSSWALK: control_resilience_domains (Dikey 5) dört-göz
-- deseninin aynısı, GLOBAL katalog. KURAL 3 + TELİF: KALKAN_OS standartların
-- METNİNİ SEED ETMEZ/UYDURMAZ — yalnız kısa madde referans kodları (ör.
-- "A.5.1") + ilişki türü + küratörün kendi gerekçe metni. VERIFIED seed YOK.

-- --- Segment-bazlı sonuç + insan override gerekçesi ---
alter table public.ai_drift_readings
  add column segment text,
  add column override_edildi boolean not null default false,
  add column override_gerekce text,
  add column override_eden uuid references public.profiles (id) on delete restrict,
  add column override_zamani timestamptz;

create index ai_drift_readings_segment_idx on public.ai_drift_readings (ai_system_id, metrik, segment, olcum_tarihi desc);

/**
 * OVERRIDE GUARD'I: eşik aşımını göz ardı etmek gerekçe + insan atfı + zaman
 * ister (service/AI atlayamaz — kimlik atfı oturum sahibine sabit). Override
 * edilmiş okuma DONUK (bir kez karar verilince sessizce geri alınamaz).
 */
create or replace function public.ai_drift_override_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.override_edildi = true then
    if new.override_edildi is distinct from old.override_edildi
      or new.override_gerekce is distinct from old.override_gerekce
      or new.override_eden is distinct from old.override_eden then
      raise exception 'Override edilmis drift okumasi degistirilemez (karar donuk)';
    end if;
    return new;
  end if;
  if new.override_edildi = true then
    if new.override_gerekce is null or btrim(new.override_gerekce) = '' then
      raise exception 'Override gerekce zorunlu (insan override gerekcesi olmadan esik asimi goz ardi edilemez)';
    end if;
    if new.override_eden is null or new.override_zamani is null then
      raise exception 'Override insan karari ister: override_eden ve zaman zorunlu';
    end if;
    if auth.uid() is not null and new.override_eden is distinct from auth.uid() then
      raise exception 'Override ancak oturum sahibi (insan) adina yapilabilir';
    end if;
  end if;
  return new;
end;
$$;

create trigger ai_drift_override_guard_trg
  before update on public.ai_drift_readings
  for each row execute function public.ai_drift_override_guard();

create or replace function public.audit_ai_drift_override()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.override_edildi = true and old.override_edildi is distinct from true then
    insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
    values (new.tenant_id, auth.uid(), 'ai_drift_override_edildi', 'ai_drift_readings', new.id,
      jsonb_build_object('metrik', new.metrik, 'gerekce', new.override_gerekce));
  end if;
  return new;
end;
$$;

create trigger audit_ai_drift_override_update
  after update on public.ai_drift_readings
  for each row execute function public.audit_ai_drift_override();

-- --- Model rollback + son test (exit_plans "tested" deseninin aynısı) ---
create table public.ai_model_rollbacks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  ai_system_id uuid not null references public.ai_systems (id) on delete cascade,
  onceki_surum text not null,
  yeni_surum text not null,
  sebep text not null,
  -- Rollback'i tetikleyen drift okuması (opsiyonel — her rollback drift kaynaklı değil).
  kaynak_drift_reading_id uuid references public.ai_drift_readings (id) on delete set null,
  durum text not null default 'TASLAK' check (durum in ('TASLAK', 'TAMAMLANDI')),
  son_test_kaniti text,
  son_test_tarihi date,
  karar_veren uuid references public.profiles (id) on delete restrict,
  karar_zamani timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- INVARYANT (M35 exit_plans deseni): "TAMAMLANDI" yalnız kanıt+tarih+karar ile.
  constraint ai_model_rollbacks_tamamlanma_kaniti check (
    durum = 'TASLAK' or (son_test_kaniti is not null and son_test_tarihi is not null and karar_veren is not null and karar_zamani is not null)
  )
);

create trigger ai_model_rollbacks_set_updated_at
  before update on public.ai_model_rollbacks
  for each row execute function public.set_updated_at();

create index ai_model_rollbacks_system_idx on public.ai_model_rollbacks (ai_system_id);

/**
 * ROLLBACK GUARD'I: kaynak drift okuması aynı kiracıya ait olmalı; tamamlama
 * kararı yalnız oturum sahibi (insan) adına verilebilir; tamamlanmış kayıt DONUK.
 */
create or replace function public.ai_rollback_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
begin
  if TG_OP = 'UPDATE' and old.durum = 'TAMAMLANDI' then
    raise exception 'Tamamlanmis rollback kaydi degistirilemez';
  end if;
  if new.kaynak_drift_reading_id is not null then
    select tenant_id into v_tenant from public.ai_drift_readings where id = new.kaynak_drift_reading_id;
    if v_tenant is null or v_tenant is distinct from new.tenant_id then
      raise exception 'Rollback kaydi, kaynak drift okumasiyla ayni kiraciya ait olmalidir';
    end if;
  end if;
  if new.durum = 'TAMAMLANDI' and new.karar_veren is not null and auth.uid() is not null and new.karar_veren is distinct from auth.uid() then
    raise exception 'Rollback tamamlama karari ancak oturum sahibi adina verilebilir';
  end if;
  return new;
end;
$$;

create trigger ai_rollback_guard_trg
  before insert or update on public.ai_model_rollbacks
  for each row execute function public.ai_rollback_guard();

create or replace function public.audit_ai_rollback()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
    values (new.tenant_id, auth.uid(), 'ai_rollback_olusturuldu', 'ai_model_rollbacks', new.id,
      jsonb_build_object('onceki_surum', new.onceki_surum, 'yeni_surum', new.yeni_surum));
    return new;
  end if;
  if new.durum is distinct from old.durum then
    insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
    values (new.tenant_id, auth.uid(), 'ai_rollback_durum_degisti', 'ai_model_rollbacks', new.id,
      jsonb_build_object('durum_onceki', old.durum, 'durum', new.durum));
  end if;
  return new;
end;
$$;

create trigger audit_ai_rollback_insert after insert on public.ai_model_rollbacks
  for each row execute function public.audit_ai_rollback();
create trigger audit_ai_rollback_update after update on public.ai_model_rollbacks
  for each row execute function public.audit_ai_rollback();

alter table public.ai_model_rollbacks enable row level security;

create policy ai_model_rollbacks_select on public.ai_model_rollbacks
  for select using (tenant_id = public.current_tenant_id());
create policy ai_model_rollbacks_write on public.ai_model_rollbacks
  for all
  using (tenant_id = public.current_tenant_id() and public.current_user_role() in ('admin', 'uyum'))
  with check (tenant_id = public.current_tenant_id() and public.current_user_role() in ('admin', 'uyum'));

-- --- ISO 42001↔27001 crosswalk (GLOBAL, obligations/control_resilience_domains dört-göz deseni) ---
create table public.iso_42001_27001_crosswalk (
  id uuid primary key default gen_random_uuid(),
  -- Kısa madde referans kodu (ör. "A.5.1"), METİN DEĞİL — kural 3 + telif.
  iso42001_ref text not null,
  iso27001_ref text not null,
  iliski_turu text not null default 'KISMEN_ORTUSUYOR'
    check (iliski_turu in ('ESDEGER', 'KISMEN_ORTUSUYOR', 'DESTEKLER')),
  -- Küratörün KENDİ gerekçe metni — standart metninin alıntısı değil.
  gerekce text,

  dogrulama_durumu text not null default 'TODO_DOGRULA'
    check (dogrulama_durumu in ('DRAFT_RESEARCH', 'TODO_DOGRULA', 'LEGAL_REVIEW', 'VERIFIED', 'SUPERSEDED', 'REJECTED')),
  incelemeye_alan uuid references public.profiles (id) on delete restrict,
  incelemeye_alinma_zamani timestamptz,
  dogrulayan uuid references public.profiles (id) on delete restrict,
  dogrulama_zamani timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (iso42001_ref, iso27001_ref)
);

create trigger iso_crosswalk_set_updated_at
  before update on public.iso_42001_27001_crosswalk
  for each row execute function public.set_updated_at();

/**
 * DOĞRULAMA DURUMU GUARD'I (kural 3, obligations/control_resilience_domains
 * dört-göz deseninin aynısı — ayrı fonksiyon: alan adları farklı).
 */
create or replace function public.crosswalk_dogrulama_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    if new.dogrulama_durumu = 'VERIFIED' then
      raise exception 'kayit VERIFIED dogamaz: dogrulama yalniz incelemeyle kazanilir (kural 3)';
    end if;
    return new;
  end if;

  if new.dogrulama_durumu = 'LEGAL_REVIEW' and old.dogrulama_durumu is distinct from 'LEGAL_REVIEW' then
    if new.incelemeye_alan is null or new.incelemeye_alinma_zamani is null then
      raise exception 'LEGAL_REVIEW gecisi incelemeye_alan ve zaman olmadan yapilamaz (dort goz)';
    end if;
  end if;

  if new.dogrulama_durumu = 'VERIFIED' and old.dogrulama_durumu is distinct from 'VERIFIED' then
    if old.dogrulama_durumu is distinct from 'LEGAL_REVIEW' then
      raise exception 'VERIFIED gecisi yalniz LEGAL_REVIEW uzerinden yapilabilir (kural 3)';
    end if;
    if new.dogrulayan is null or new.dogrulama_zamani is null then
      raise exception 'VERIFIED gecisi dogrulayan ve dogrulama_zamani olmadan yapilamaz (kural 3)';
    end if;
    if new.dogrulayan = new.incelemeye_alan then
      raise exception 'Incelemeye alan kendi sunumunu dogrulayamaz (dort goz, M21 deseni)';
    end if;
  end if;

  if new.dogrulama_durumu = 'REJECTED' and old.dogrulama_durumu is distinct from 'REJECTED' then
    if old.dogrulama_durumu is distinct from 'LEGAL_REVIEW' then
      raise exception 'REJECTED karari yalniz LEGAL_REVIEW uzerinden verilebilir';
    end if;
    if new.dogrulayan is null then
      raise exception 'REJECTED karari karar sahibi (dogrulayan) olmadan yazilamaz';
    end if;
  end if;

  if old.dogrulama_durumu = 'VERIFIED' and new.dogrulama_durumu = 'VERIFIED' then
    if new.iso42001_ref is distinct from old.iso42001_ref
      or new.iso27001_ref is distinct from old.iso27001_ref
      or new.iliski_turu is distinct from old.iliski_turu then
      raise exception 'VERIFIED crosswalk kaydinin icerigi degistirilemez: once dogrulama geri alinmali';
    end if;
  end if;

  return new;
end;
$$;

create trigger iso_crosswalk_dogrulama_guard
  before insert or update on public.iso_42001_27001_crosswalk
  for each row execute function public.crosswalk_dogrulama_guard();

alter table public.iso_42001_27001_crosswalk enable row level security;

create policy iso_crosswalk_select on public.iso_42001_27001_crosswalk
  for select using (auth.role() = 'authenticated');
-- Yazma politikası YOK: obligations/control_resilience_domains deseni — service_role yazar.
