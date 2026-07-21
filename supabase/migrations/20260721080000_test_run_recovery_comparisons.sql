-- Dikey F, F5 (docs/adr/PR0-dikeyF-f5-kurtarma-karsilastirmasi-2026-07-21.md):
-- belirli bir F4 ölçüm kaydı ile ölçüm anında yürürlükte olan onaylı F3
-- tolerans sürümü arasında immutable, kaynakları açık bir karşılaştırma
-- artefaktı. F2/F3 Kritik Hizmet Test Paketi'ne SIZMAZ (kurucu kararı — o
-- entegrasyon AYRI bir sonraki dilim, Dikey F5.1).
--
-- TOLERANS EŞİKLERİ MÜHÜRLENİR (yalnız FK bırakılmaz): impact_tolerances
-- sonradan yeni bir sürümle süprese edilse bile bu karşılaştırmanın
-- tarihsel sonucu YENİDEN ÜRETİLEBİLİR kalır.
--
-- RTO ve RPO BAĞIMSIZ değerlendirilir — beş durum, "RTO karşılandı" gibi
-- kaynağı gizleyen kesin ifade motor/UI'da ASLA üretilmez (ADR §5).
--
-- EMSAL: execution_legal_snapshots (test_run'a FK'li, tekil kavramı) +
-- test_run_recovery_measurements'ın KENDİ append-only+supersede deseni
-- (ölçüm veya tolerans revize edilirse karşılaştırma da YENİ kayıtla
-- süprese edilir; eski kayıt tarihsel artefakt olarak kalır, SİLİNMEZ).

create table public.test_run_recovery_comparisons (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,

  test_run_id uuid not null references public.test_runs (id) on delete restrict,
  recovery_measurement_id uuid not null references public.test_run_recovery_measurements (id) on delete restrict,
  impact_tolerance_id uuid not null references public.impact_tolerances (id) on delete restrict,
  critical_service_id uuid not null references public.critical_business_services (id) on delete restrict,

  -- Mühürlenmiş eşikler (ADR §4) — karşılaştırma anında impact_tolerances'tan
  -- KOPYALANIR, sonradan tolerans değişse bile bu satır DEĞİŞMEZ.
  tolerans_max_kesinti_saat numeric,
  tolerans_max_veri_kaybi_saat numeric,
  tolerans_surumu integer not null,

  -- RTO/RPO BAĞIMSIZ sonuçlar (ADR §4).
  rto_sonucu text not null check (rto_sonucu in ('KARSILADI', 'ASTI', 'OLCUM_YOK', 'TOLERANS_YOK', 'KARSILASTIRILAMAZ')),
  rpo_sonucu text not null check (rpo_sonucu in ('KARSILADI', 'ASTI', 'OLCUM_YOK', 'TOLERANS_YOK', 'KARSILASTIRILAMAZ')),

  -- Güvenilirlik katmanı — motor bu alana göre dili değiştirir (ADR §5),
  -- ham ölçüm kaydından KOPYALANIR (recovery_measurement_id her zaman aynı
  -- şeyi söylese de, sorgusuz-erişim + tarihsel değişmezlik için burada durur).
  olcum_kaynagi text not null check (olcum_kaynagi in ('MANUEL_BEYAN', 'OTOMATIK_OLCUM')),

  -- Supersede zinciri (TRRM'nin AYNI deseni) — düzeltme = yeni kayıt.
  supersedes_comparison_id uuid references public.test_run_recovery_comparisons (id) on delete restrict,

  -- Mühürlü kanonik snapshot (WARDPROOF_TEST_RUN_RECOVERY_COMPARISON_V1) + hash.
  karsilastirma jsonb not null,
  karsilastirma_hash text not null check (karsilastirma_hash ~ '^[0-9a-f]{64}$'),

  olusturan uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),

  constraint trrc_self_supersede check (supersedes_comparison_id is null or supersedes_comparison_id <> id)
);

create index trrc_tenant_idx on public.test_run_recovery_comparisons (tenant_id, created_at desc);
create index trrc_test_run_idx on public.test_run_recovery_comparisons (test_run_id);
create index trrc_measurement_idx on public.test_run_recovery_comparisons (recovery_measurement_id);
create index trrc_tolerance_idx on public.test_run_recovery_comparisons (impact_tolerance_id);

-- LİNEER supersede zinciri (TRRM ile aynı desen): bir kayıt en fazla BİR kez
-- supersede edilebilir.
create unique index trrc_supersede_uq
  on public.test_run_recovery_comparisons (supersedes_comparison_id)
  where supersedes_comparison_id is not null;

/**
 * KİMLİK ATFI: olusturan istemci bağlamında oturum sahibine sabitlenir
 * (F2 olusturan deseni).
 */
create or replace function public.trrc_olusturan_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' and auth.uid() is not null then
    new.olusturan := auth.uid();
  end if;
  return new;
end;
$$;

create trigger trrc_olusturan_guard_trg
  before insert on public.test_run_recovery_comparisons
  for each row execute function public.trrc_olusturan_guard();

/**
 * CROSS-TENANT + TUTARLILIK GUARD'I (before insert):
 *  - Dört FK (test_run/ölçüm/tolerans/kritik_hizmet) AYNI tenant'a ait olmalı.
 *  - recovery_measurement_id, BELİRTİLEN test_run_id'ye ait olmalı (başka bir
 *    koşunun ölçümü bu karşılaştırmaya yanlışlıkla bağlanamaz).
 *  - impact_tolerance_id, BELİRTİLEN critical_service_id'ye ait olmalı.
 *  - EN ÖNEMLİSİ (grep sweep §8 riski — F3/F4'te YOKTU): test_run'ın bağlı
 *    olduğu kritik hizmet (DIRECT critical_service_id VEYA VIA_CRITICAL_
 *    SERVICE_CONTROL critical_service_controls) BELİRTİLEN critical_service_
 *    id ile AYNI olmalı — aksi halde bir test koşusu, İLGİSİZ bir hizmetin
 *    toleransıyla yanlışlıkla karşılaştırılabilirdi.
 *  - supersedes_comparison_id (varsa) AYNI test_run_id'ye ait olmalı.
 */
create or replace function public.trrc_tenant_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_test_definition_id uuid;
  v_control_id uuid;
  v_test_run_tenant uuid;
begin
  select test_definition_id, control_id, tenant_id
    into v_test_definition_id, v_control_id, v_test_run_tenant
  from public.test_runs where id = new.test_run_id;

  if v_test_run_tenant is null or v_test_run_tenant <> new.tenant_id then
    raise exception 'test_run_id farkli bir kiraciya ait olamaz (cross-tenant guard)';
  end if;

  if not exists (
    select 1 from public.test_run_recovery_measurements m
    where m.id = new.recovery_measurement_id and m.tenant_id = new.tenant_id and m.test_run_id = new.test_run_id
  ) then
    raise exception 'recovery_measurement_id, belirtilen test_run_id/tenant ile eslesmiyor (cross-tenant veya farkli kosu guard)';
  end if;

  if not exists (
    select 1 from public.impact_tolerances t
    where t.id = new.impact_tolerance_id and t.tenant_id = new.tenant_id and t.critical_service_id = new.critical_service_id
  ) then
    raise exception 'impact_tolerance_id, belirtilen critical_service_id/tenant ile eslesmiyor (cross-tenant guard)';
  end if;

  if not exists (
    select 1 from public.critical_business_services s
    where s.id = new.critical_service_id and s.tenant_id = new.tenant_id
  ) then
    raise exception 'critical_service_id farkli bir kiraciya ait olamaz (cross-tenant guard)';
  end if;

  if not (
    exists (
      select 1 from public.control_test_definitions d
      where d.id = v_test_definition_id and d.critical_service_id = new.critical_service_id
    )
    or exists (
      select 1 from public.critical_service_controls csc
      where csc.critical_service_id = new.critical_service_id and csc.control_id = v_control_id
    )
  ) then
    raise exception 'Bu test kosusu, belirtilen kritik hizmete (DIRECT veya VIA_CRITICAL_SERVICE_CONTROL) bagli degil';
  end if;

  if new.supersedes_comparison_id is not null then
    if not exists (
      select 1 from public.test_run_recovery_comparisons c
      where c.id = new.supersedes_comparison_id and c.tenant_id = new.tenant_id
    ) then
      raise exception 'supersedes_comparison_id farkli bir kiraciya ait olamaz (cross-tenant guard)';
    end if;
    if not exists (
      select 1 from public.test_run_recovery_comparisons c
      where c.id = new.supersedes_comparison_id and c.test_run_id = new.test_run_id
    ) then
      raise exception 'supersede edilen karsilastirma ayni test kosusuna ait olmali';
    end if;
  end if;

  return new;
end;
$$;

create trigger trrc_tenant_guard_trg
  before insert on public.test_run_recovery_comparisons
  for each row execute function public.trrc_tenant_guard();

/** İMMUTABLE: service_role dahil hiçbir UPDATE geçemez (TRRM/F2 deseni). */
create or replace function public.trrc_immutable()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'Kurtarma karsilastirmasi degistirilemez (append-only; duzeltme icin supersede eden yeni kayit)';
end;
$$;

create trigger trrc_immutable_before_update
  before update on public.test_run_recovery_comparisons
  for each row execute function public.trrc_immutable();

-- --- Audit ---
create or replace function public.audit_trrc()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
  values (new.tenant_id, auth.uid(), 'kurtarma_karsilastirmasi_olusturuldu', 'test_run_recovery_comparisons', new.id,
    jsonb_build_object('test_run_id', new.test_run_id, 'rto_sonucu', new.rto_sonucu, 'rpo_sonucu', new.rpo_sonucu,
      'karsilastirma_hash', new.karsilastirma_hash, 'supersedes_comparison_id', new.supersedes_comparison_id));
  return new;
end;
$$;

create trigger audit_trrc_insert after insert on public.test_run_recovery_comparisons
  for each row execute function public.audit_trrc();

-- --- RLS: tenant-scoped select + insert (admin/uyum). UPDATE/DELETE policy YOK ---
alter table public.test_run_recovery_comparisons enable row level security;

create policy trrc_select on public.test_run_recovery_comparisons
  for select using (tenant_id = public.current_tenant_id());
create policy trrc_insert on public.test_run_recovery_comparisons
  for insert with check (
    tenant_id = public.current_tenant_id() and public.current_user_role() in ('admin', 'uyum')
  );

revoke update, delete on public.test_run_recovery_comparisons from authenticated, anon;

/**
 * MERKEZİ "güncel karşılaştırma" fonksiyonu — F5 Karar B'nin AYNISI, aynı
 * dört-durumlu sözleşme (Karar B'nin "F5 üçüncü kopya yazmasın" talimatı
 * BİZZAT bu tablo için de uygulanır: tek yerde tanımlı, Proof Room ve
 * gelecekteki F5.1 AYNI fonksiyonu çağırır).
 */
create or replace function public.test_run_kurtarma_karsilastirmasi_guncel(
  p_test_run_id uuid,
  p_tenant_id uuid
)
returns table (
  durum text,
  id uuid,
  tenant_id uuid,
  test_run_id uuid,
  recovery_measurement_id uuid,
  impact_tolerance_id uuid,
  critical_service_id uuid,
  tolerans_max_kesinti_saat numeric,
  tolerans_max_veri_kaybi_saat numeric,
  tolerans_surumu integer,
  rto_sonucu text,
  rpo_sonucu text,
  olcum_kaynagi text,
  supersedes_comparison_id uuid,
  karsilastirma_hash text,
  created_at timestamptz
)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_sayi integer;
begin
  if exists (
    select 1
    from public.test_run_recovery_comparisons c
    where c.test_run_id = p_test_run_id
      and c.tenant_id = p_tenant_id
      and c.supersedes_comparison_id is not null
      and not exists (
        select 1 from public.test_run_recovery_comparisons hedef
        where hedef.id = c.supersedes_comparison_id
          and hedef.test_run_id = p_test_run_id
          and hedef.tenant_id = p_tenant_id
      )
  ) then
    return query select 'ZINCIR_HATASI'::text, null::uuid, null::uuid, null::uuid, null::uuid, null::uuid, null::uuid,
      null::numeric, null::numeric, null::integer, null::text, null::text, null::text, null::uuid, null::text, null::timestamptz;
    return;
  end if;

  select count(*) into v_sayi
  from public.test_run_recovery_comparisons c
  where c.test_run_id = p_test_run_id
    and c.tenant_id = p_tenant_id
    and not exists (
      select 1 from public.test_run_recovery_comparisons c2
      where c2.supersedes_comparison_id = c.id
    );

  if v_sayi = 0 then
    return query select 'KAYIT_YOK'::text, null::uuid, null::uuid, null::uuid, null::uuid, null::uuid, null::uuid,
      null::numeric, null::numeric, null::integer, null::text, null::text, null::text, null::uuid, null::text, null::timestamptz;
    return;
  end if;

  if v_sayi > 1 then
    return query select 'BIRDEN_FAZLA_GUNCEL_KAYIT'::text, null::uuid, null::uuid, null::uuid, null::uuid, null::uuid, null::uuid,
      null::numeric, null::numeric, null::integer, null::text, null::text, null::text, null::uuid, null::text, null::timestamptz;
    return;
  end if;

  return query
    select 'GUNCEL_KAYIT_VAR'::text, c.id, c.tenant_id, c.test_run_id, c.recovery_measurement_id, c.impact_tolerance_id,
           c.critical_service_id, c.tolerans_max_kesinti_saat, c.tolerans_max_veri_kaybi_saat, c.tolerans_surumu,
           c.rto_sonucu, c.rpo_sonucu, c.olcum_kaynagi, c.supersedes_comparison_id, c.karsilastirma_hash, c.created_at
    from public.test_run_recovery_comparisons c
    where c.test_run_id = p_test_run_id
      and c.tenant_id = p_tenant_id
      and not exists (
        select 1 from public.test_run_recovery_comparisons c2
        where c2.supersedes_comparison_id = c.id
      );
end;
$$;

-- --- Şeffaflık defteri: generic outbox enqueue (RECOVERY_COMPARISON kind) ---
create trigger test_run_recovery_comparisons_ledger_outbox_enqueue
  after insert on public.test_run_recovery_comparisons
  for each row execute function public.ledger_outbox_enqueue_trg('RECOVERY_COMPARISON');
