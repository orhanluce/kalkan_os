-- Dikey E, E2, Kapı 2 (docs/adr/PR0-dikeyE2-telafi-edici-kontrol-proof-room-
-- 2026-07-20.md §3-4): kritik/yüksek tedarikçi bulgusu için telafi edici
-- kontrol bağlantısı. YENİ TEST ALTYAPISI YOK — control_id/test_run_id
-- mevcut M12 kontrol test motoruna (control_test_definitions/test_runs)
-- işaret eder, motor YENİDEN KULLANILIR.
--
-- BU BULGUYU KAPATMAZ: assessment_findings.durum bu tablodan HİÇ etkilenmez;
-- third_party_assessments.durum'a da HİÇ dokunulmaz (ADR §5 — dar
-- hesaplanmış etiket kararı, assessment_tamamla_guard DEĞİŞMEDİ).
--
-- SoD'nin (`sod_telafi_edici_kontroller`) DOĞRUDAN KOPYASI DEĞİL — o
-- tablonun kendi maker-checker'ı yok (güven yalnız test sonucuna dayanıyor),
-- burada telafi KAYDININ KENDİSİ de bağımsız bir insan tarafından
-- incelenmeli (submitted_by != reviewed_by). Yeniden kullanılan ilkeler:
-- test_runs.sonuc=PASSED zorunluluğu, idempotent pg_cron süre-dolumu
-- deseni, kendi-kendine-onay yasağı, karara-bağlanmış-kayıt-donar +
-- uzatma-yeni-kayıt (onceki_id zinciri, sod_istisnalari'nın AYNI deseni).

create table public.assessment_finding_compensating_controls (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  assessment_finding_id uuid not null references public.assessment_findings (id) on delete cascade,
  -- YENİ test altyapısı yok: mevcut M12 kontrol + test koşusuna işaret eder.
  control_id uuid not null references public.controls (id) on delete restrict,
  test_run_id uuid not null references public.test_runs (id) on delete restrict,
  gerekce text not null,
  valid_from date not null default current_date,
  valid_until date not null,
  durum text not null default 'TASLAK'
    check (durum in ('TASLAK', 'INCELEMEDE', 'AKTIF', 'REDDEDILDI', 'SURESI_DOLDU', 'IPTAL_EDILDI')),
  submitted_by uuid references public.profiles (id) on delete restrict,
  reviewed_by uuid references public.profiles (id) on delete restrict,
  reviewed_at timestamptz,
  red_gerekcesi text,
  revoked_by uuid references public.profiles (id) on delete restrict,
  revoked_at timestamptz,
  revocation_reason text,
  -- Uzatma/değişiklik YENİ kayıt zinciriyle yapılır (sod_istisnalari'nın
  -- onceki_istisna_id'sinin AYNI deseni) — AKTIF olmuş bir satır mutasyona
  -- UĞRAMAZ (aşağıdaki guard).
  onceki_id uuid references public.assessment_finding_compensating_controls (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint afcc_gecerlilik_penceresi check (valid_until > valid_from)
);

create index afcc_tenant_idx on public.assessment_finding_compensating_controls (tenant_id, durum);
create index afcc_finding_idx on public.assessment_finding_compensating_controls (assessment_finding_id, durum);

create trigger afcc_set_updated_at
  before update on public.assessment_finding_compensating_controls
  for each row execute function public.set_updated_at();

/**
 * INSERT guard: kimlik atfı (submitted_by istemciden GÜVENİLMEZ) + ilişkisel
 * tutarlılık (bulgu/kontrol/test koşusu aynı kiracıya ait VE test koşusu
 * seçilen kontrole ait) + yalnız TASLAK doğabilir (AKTIF/REDDEDILDI/
 * SURESI_DOLDU/IPTAL_EDILDI doğrudan INSERT edilemez — M12/E1'in "asla
 * doğrudan VERIFIED doğmaz" ilkesinin AYNISI).
 */
create or replace function public.assessment_finding_cc_insert_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_finding_tenant uuid;
  v_test_tenant uuid;
  v_test_control uuid;
begin
  if auth.uid() is not null then
    new.submitted_by := auth.uid();
  end if;
  if new.submitted_by is null then
    raise exception 'submitted_by zorunlu (kimlik atfi)';
  end if;
  if new.durum is distinct from 'TASLAK' then
    raise exception 'Telafi edici kontrol yalnizca TASLAK olarak olusturulabilir (dogrudan AKTIF/REDDEDILDI/SURESI_DOLDU/IPTAL_EDILDI insert edilemez)';
  end if;

  select tenant_id into v_finding_tenant from public.assessment_findings where id = new.assessment_finding_id;
  if v_finding_tenant is null or v_finding_tenant is distinct from new.tenant_id then
    raise exception 'assessment_finding_id farkli bir kiraciya ait olamaz (cross-tenant guard)';
  end if;

  select tenant_id, control_id into v_test_tenant, v_test_control from public.test_runs where id = new.test_run_id;
  if v_test_tenant is null or v_test_tenant is distinct from new.tenant_id then
    raise exception 'test_run_id farkli bir kiraciya ait olamaz (cross-tenant guard)';
  end if;
  if v_test_control is distinct from new.control_id then
    raise exception 'test_run_id secilen control_id''ye ait degil (test kosusu/kontrol uyumsuzlugu)';
  end if;

  return new;
end;
$$;

create trigger afcc_insert_guard_trg
  before insert on public.assessment_finding_compensating_controls
  for each row execute function public.assessment_finding_cc_insert_guard();

/**
 * UPDATE guard — durum geçiş makinesi (kural 11 disiplini, bir DB
 * invariant'ı, uygulama koduna bırakılmaz):
 *   TASLAK -> INCELEMEDE -> AKTIF | REDDEDILDI
 *   TASLAK|INCELEMEDE|AKTIF -> IPTAL_EDILDI
 *   AKTIF -> SURESI_DOLDU (yalnizca cron/idempotent fonksiyon)
 * Terminal durumlar (REDDEDILDI/SURESI_DOLDU/IPTAL_EDILDI) DONAR. AKTIF
 * olmus bir kayitta cekirdek alanlar (control_id/test_run_id/valid_from/
 * valid_until/gerekce) BIR DAHA DEGISTIRILEMEZ. tenant_id ve submitted_by
 * HER ZAMAN donuk (kimlik sahtekarligi/kiraci sicramasi engeli).
 */
create or replace function public.assessment_finding_cc_durum_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_test_sonuc text;
  v_test_tenant uuid;
  v_test_control uuid;
  v_evidence_bitis date;
  v_finding_durum text;
begin
  if new.tenant_id is distinct from old.tenant_id then
    raise exception 'tenant_id degistirilemez';
  end if;
  if new.submitted_by is distinct from old.submitted_by then
    raise exception 'submitted_by degistirilemez (kimlik atfi donuk)';
  end if;

  if old.durum in ('REDDEDILDI', 'SURESI_DOLDU', 'IPTAL_EDILDI') then
    raise exception 'Telafi edici kontrol % durumundan degistirilemez (donuk kayit, yeni kayit acin)', old.durum;
  end if;

  if old.durum = 'AKTIF' then
    if new.control_id is distinct from old.control_id
       or new.test_run_id is distinct from old.test_run_id
       or new.valid_from is distinct from old.valid_from
       or new.valid_until is distinct from old.valid_until
       or new.gerekce is distinct from old.gerekce
    then
      raise exception 'AKTIF telafi edici kontrolun cekirdek alanlari degistirilemez (uzatma icin yeni kayit acin, onceki_id ile zincirleyin)';
    end if;
  end if;

  if new.durum = old.durum then
    return new;
  end if;

  if new.durum = 'INCELEMEDE' then
    if old.durum is distinct from 'TASLAK' then
      raise exception 'INCELEMEDE yalnizca TASLAK''tan ulasilir';
    end if;
    if new.gerekce is null or btrim(new.gerekce) = '' then
      raise exception 'INCELEMEDE: gerekce zorunlu';
    end if;
    if new.valid_from is null or new.valid_until is null then
      raise exception 'INCELEMEDE: gecerlilik penceresi zorunlu';
    end if;
  end if;

  if new.durum = 'AKTIF' then
    if old.durum is distinct from 'INCELEMEDE' then
      raise exception 'AKTIF yalnizca INCELEMEDE''den ulasilir (TASLAK''tan atlanamaz)';
    end if;
    if new.reviewed_by is null then
      raise exception 'AKTIF: reviewed_by (bagimsiz inceleyen) zorunlu';
    end if;
    if new.reviewed_by = new.submitted_by then
      raise exception 'Hazirlayan kendi telafi edici kontrolunu aktive edemez (bagimsiz inceleme, maker-checker)';
    end if;
    if auth.uid() is not null and new.reviewed_by is distinct from auth.uid() then
      raise exception 'Inceleme ancak oturum sahibi adina yapilabilir (kimlik atfi)';
    end if;
    if new.reviewed_at is null then
      new.reviewed_at := now();
    end if;

    select r.sonuc, r.tenant_id, r.control_id, e.gecerlilik_bitis
      into v_test_sonuc, v_test_tenant, v_test_control, v_evidence_bitis
    from public.test_runs r
    left join public.evidences e on e.id = r.evidence_id
    where r.id = new.test_run_id;

    if v_test_tenant is distinct from new.tenant_id then
      raise exception 'AKTIF: test kosusu farkli bir kiraciya ait olamaz';
    end if;
    if v_test_control is distinct from new.control_id then
      raise exception 'AKTIF: test kosusu secilen kontrole ait degil';
    end if;
    if v_test_sonuc is distinct from 'PASSED' then
      raise exception 'AKTIF: baglanan test kosusunun sonucu PASSED degil (%)', coalesce(v_test_sonuc, 'bilinmiyor');
    end if;
    if v_evidence_bitis is not null and v_evidence_bitis < current_date then
      raise exception 'AKTIF: baglanan kanitin suresi gecmis (guncel degil)';
    end if;
    if new.valid_until <= current_date then
      raise exception 'AKTIF: gecerlilik bitis tarihi gecmis olamaz';
    end if;

    select durum into v_finding_durum from public.assessment_findings where id = new.assessment_finding_id;
    if v_finding_durum = 'KAPANDI' then
      raise exception 'AKTIF: bagli bulgu zaten KAPANDI, telafi edici kontrole gerek yok';
    end if;
  end if;

  if new.durum = 'REDDEDILDI' then
    if old.durum is distinct from 'INCELEMEDE' then
      raise exception 'REDDEDILDI yalnizca INCELEMEDE''den ulasilir';
    end if;
    if new.reviewed_by is null then
      raise exception 'REDDEDILDI: reviewed_by zorunlu';
    end if;
    if new.reviewed_by = new.submitted_by then
      raise exception 'Hazirlayan kendi telafi edici kontrolunu reddedemez';
    end if;
    if auth.uid() is not null and new.reviewed_by is distinct from auth.uid() then
      raise exception 'Inceleme ancak oturum sahibi adina yapilabilir (kimlik atfi)';
    end if;
    if new.red_gerekcesi is null or btrim(new.red_gerekcesi) = '' then
      raise exception 'REDDEDILDI: red gerekcesi zorunlu';
    end if;
    if new.reviewed_at is null then
      new.reviewed_at := now();
    end if;
  end if;

  if new.durum = 'IPTAL_EDILDI' then
    if old.durum not in ('TASLAK', 'INCELEMEDE', 'AKTIF') then
      raise exception 'IPTAL_EDILDI yalnizca TASLAK/INCELEMEDE/AKTIF durumundan ulasilir';
    end if;
    if new.revoked_by is null then
      raise exception 'IPTAL_EDILDI: revoked_by zorunlu';
    end if;
    if auth.uid() is not null and new.revoked_by is distinct from auth.uid() then
      raise exception 'Iptal ancak oturum sahibi adina yapilabilir (kimlik atfi)';
    end if;
    if new.revocation_reason is null or btrim(new.revocation_reason) = '' then
      raise exception 'IPTAL_EDILDI: iptal nedeni zorunlu';
    end if;
    if new.revoked_at is null then
      new.revoked_at := now();
    end if;
  end if;

  if new.durum = 'SURESI_DOLDU' then
    if old.durum is distinct from 'AKTIF' then
      raise exception 'SURESI_DOLDU yalnizca AKTIF''ten ulasilir';
    end if;
  end if;

  if new.durum = 'TASLAK' then
    raise exception 'TASLAK''a geri donulemez';
  end if;

  return new;
end;
$$;

create trigger afcc_durum_guard_trg
  before update on public.assessment_finding_compensating_controls
  for each row execute function public.assessment_finding_cc_durum_guard();

-- --- Audit ---
create or replace function public.audit_assessment_finding_cc()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
    values (new.tenant_id, auth.uid(), 'telafi_edici_kontrol_olusturuldu', TG_TABLE_NAME, new.id,
      jsonb_build_object('assessment_finding_id', new.assessment_finding_id, 'durum', new.durum));
    return new;
  end if;
  if new.durum is distinct from old.durum then
    insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
    values (new.tenant_id, auth.uid(), 'telafi_edici_kontrol_durum_degisti', TG_TABLE_NAME, new.id,
      jsonb_build_object('durum_onceki', old.durum, 'durum', new.durum));
  end if;
  return new;
end;
$$;

create trigger audit_afcc_insert after insert on public.assessment_finding_compensating_controls
  for each row execute function public.audit_assessment_finding_cc();
create trigger audit_afcc_update after update on public.assessment_finding_compensating_controls
  for each row execute function public.audit_assessment_finding_cc();

-- --- RLS: tenant'a kilitli; yazma admin/uyum ---
alter table public.assessment_finding_compensating_controls enable row level security;

create policy afcc_select on public.assessment_finding_compensating_controls
  for select using (tenant_id = public.current_tenant_id());
create policy afcc_write on public.assessment_finding_compensating_controls
  for all
  using (tenant_id = public.current_tenant_id() and public.current_user_role() in ('admin', 'uyum'))
  with check (tenant_id = public.current_tenant_id() and public.current_user_role() in ('admin', 'uyum'));

-- ============================================================================
-- Süre dolumu — idempotent, sod_istisna_suresi_dolanlari_isle'nin AYNI deseni
-- (BullMQ DEGIL, kural 4 — pg_cron + idempotent SQL fonksiyonu).
-- ============================================================================
create or replace function public.assessment_finding_cc_suresi_dolanlari_isle()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  r record;
begin
  for r in
    select id from public.assessment_finding_compensating_controls
    where durum = 'AKTIF' and valid_until < current_date
    for update skip locked
  loop
    update public.assessment_finding_compensating_controls
      set durum = 'SURESI_DOLDU'
      where id = r.id and durum = 'AKTIF';
    if found then
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end;
$$;

revoke execute on function public.assessment_finding_cc_suresi_dolanlari_isle() from authenticated, anon;

do $$
begin
  execute 'create extension if not exists pg_cron';
  perform cron.schedule(
    'kalkan-e2-telafi-suresi-dolumu',
    '*/5 * * * *',
    'select public.assessment_finding_cc_suresi_dolanlari_isle();'
  );
  raise notice 'pg_cron zamanlamasi kuruldu: kalkan-e2-telafi-suresi-dolumu';
exception when others then
  raise notice 'pg_cron schedule atlandi (PGlite/local ortam): %', sqlerrm;
end $$;
