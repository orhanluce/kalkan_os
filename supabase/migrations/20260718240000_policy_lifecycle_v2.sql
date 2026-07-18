-- Policy Lifecycle v2 — kurucunun M34 tam kapsam talimatı (G2 üretim dikeyi).
--
-- Bu migration `20260718230000`'i GENİŞLETİR (yerine geçmez; o canlıda). Eklenen:
--   * REVIEW -> IN_REVIEW (kurucu yaşam döngüsü: DRAFT→IN_REVIEW→APPROVED→
--     EFFECTIVE→RETIRED);
--   * PolicyApproval: ÇOKLU BAĞIMSIZ onay (tek onaylayan kolonu yerine tablo) —
--     EFFECTIVE için gerekli bağımsız onaylar tamamlanmalı (invariant);
--   * geriye-tarihli yürürlük YASAK (effective_from >= current_date);
--   * PolicyException (gerekçe/sahip/onaylayan/başlangıç/bitiş/telafi kontrolü;
--     dört-göz; süre-dolumu → yeniden değerlendirme kuyruğu, pg_cron);
--   * PolicyImpact (mevzuat değişikliği → madde etkisi; PROPOSED doğar, AI
--     APPLIED yapamaz);
--   * madde+bağ donukluğu APPROVED'da da geçerli (yalnız EFFECTIVE değil).
--
-- ROLLBACK NOTU: bu migration eklemeli + bir enum-değeri yeniden adlandırma
-- içerir. Geri almak için: (1) yeni tabloları drop et (policy_impacts,
-- policy_exceptions, policy_approvals); (2) IN_REVIEW satırlarını REVIEW'e
-- geri güncelle + check'i eski haline al; (3) guard fonksiyonlarını
-- 20260718230000'deki sürümlerine CREATE OR REPLACE ile döndür; (4) cron
-- işini unschedule et. Tablo yeni (üretim verisi yok) — pratikte fresh drop
-- güvenli.

-- ============================================================
-- PART A — IN_REVIEW yeniden adlandırma + çoklu onay
-- ============================================================

-- Gerekli bağımsız onay sayısı (varsayılan 1; kurum daha fazlasını isteyebilir).
alter table public.policy_versions
  add column gerekli_onay_sayisi integer not null default 1 check (gerekli_onay_sayisi >= 1);

-- Onaylayan kolonları PolicyApproval'a taşındı — kaldır (fresh tablo, veri yok).
alter table public.policy_versions drop column if exists onaylayan;
alter table public.policy_versions drop column if exists onay_zamani;

-- REVIEW -> IN_REVIEW (check'i yeniden kur; varsa eski satırları güncelle).
alter table public.policy_versions drop constraint if exists policy_versions_durum_check;
update public.policy_versions set durum = 'IN_REVIEW' where durum = 'REVIEW';
alter table public.policy_versions
  add constraint policy_versions_durum_check
  check (durum in ('DRAFT', 'IN_REVIEW', 'APPROVED', 'EFFECTIVE', 'RETIRED'));

-- --- PolicyApproval: bağımsız onaylar (maker-checker, SoD deseni) ---
create table public.policy_approvals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  policy_version_id uuid not null references public.policy_versions (id) on delete cascade,
  approver uuid not null references public.profiles (id) on delete restrict,
  karar text not null check (karar in ('APPROVE', 'REJECT')),
  gerekce text,
  created_at timestamptz not null default now(),
  -- Bir onaylayan bir sürüm için tek karar verir.
  unique (policy_version_id, approver)
);

create index policy_approvals_version_idx on public.policy_approvals (policy_version_id);

/**
 * ONAY GUARD'I: onay yalnız IN_REVIEW sürüme kaydedilir; onaylayan hazırlayan
 * OLAMAZ (dört göz); kimlik atfı oturum sahibine sabit (M16 #9; service muaf).
 */
create or replace function public.policy_approval_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_durum text;
  v_hazirlayan uuid;
begin
  select durum, hazirlayan into v_durum, v_hazirlayan
  from public.policy_versions where id = new.policy_version_id;

  if v_durum is distinct from 'IN_REVIEW' then
    raise exception 'Onay yalniz IN_REVIEW surume kaydedilebilir (durum: %)', coalesce(v_durum, 'yok');
  end if;
  if new.approver = v_hazirlayan then
    raise exception 'Hazirlayan kendi surumunu onaylayamaz (dort goz)';
  end if;
  if auth.uid() is not null and new.approver is distinct from auth.uid() then
    raise exception 'Onay ancak oturum sahibi adina yazilabilir (kimlik atfi)';
  end if;
  return new;
end;
$$;

create trigger policy_approval_guard_trg
  before insert on public.policy_approvals
  for each row execute function public.policy_approval_guard();

-- --- Sürüm durum makinesi guard'ı — IN_REVIEW + çoklu onay + geriye-tarih ---
create or replace function public.policy_version_durum_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_onay_sayisi integer;
begin
  if TG_OP = 'INSERT' then
    if new.durum in ('APPROVED', 'EFFECTIVE') and new.eklenme_kaynagi = 'ai_taslak' then
      raise exception 'AI taslagi dogrudan APPROVED/EFFECTIVE dogamaz (insan incelemesi sart)';
    end if;
    if new.durum not in ('DRAFT', 'IN_REVIEW') then
      raise exception 'Yeni policy_version yalniz DRAFT veya IN_REVIEW ile dogabilir';
    end if;
    return new;
  end if;

  if new.durum = old.durum then
    return new;
  end if;

  if not (
    (old.durum = 'DRAFT' and new.durum = 'IN_REVIEW')
    or (old.durum = 'IN_REVIEW' and new.durum = 'DRAFT')
    or (old.durum = 'IN_REVIEW' and new.durum = 'APPROVED')
    or (old.durum = 'APPROVED' and new.durum = 'EFFECTIVE')
    or (old.durum = 'EFFECTIVE' and new.durum = 'RETIRED')
  ) then
    raise exception 'Gecersiz policy durum gecisi: % -> %', old.durum, new.durum;
  end if;

  if new.durum = 'IN_REVIEW' and (new.hazirlayan is null or new.hazirlama_zamani is null) then
    raise exception 'IN_REVIEW gecisi hazirlayan + zaman olmadan yapilamaz';
  end if;

  -- IN_REVIEW -> APPROVED: gerekli sayıda BAĞIMSIZ (hazırlayan olmayan) APPROVE.
  if new.durum = 'APPROVED' then
    select count(distinct approver) into v_onay_sayisi
    from public.policy_approvals
    where policy_version_id = new.id and karar = 'APPROVE' and approver is distinct from new.hazirlayan;
    if v_onay_sayisi < new.gerekli_onay_sayisi then
      raise exception 'APPROVED icin yeterli bagimsiz onay yok (% / %)', v_onay_sayisi, new.gerekli_onay_sayisi;
    end if;
  end if;

  -- APPROVED -> EFFECTIVE: yürürlük tarihi + GERİYE-TARİH YASAĞI.
  if new.durum = 'EFFECTIVE' then
    if new.effective_from is null then
      raise exception 'EFFECTIVE gecisi effective_from olmadan yapilamaz';
    end if;
    if new.effective_from < current_date then
      raise exception 'Geriye-tarihli yururluge alma yasak (effective_from gecmis)';
    end if;
  end if;

  return new;
end;
$$;

-- Madde + bağ donukluğu artık APPROVED'da da (yalnız EFFECTIVE değil).
create or replace function public.policy_clause_donuk_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_durum text;
  v_version uuid;
begin
  v_version := coalesce(new.policy_version_id, old.policy_version_id);
  select durum into v_durum from public.policy_versions where id = v_version;
  if v_durum in ('APPROVED', 'EFFECTIVE', 'RETIRED') then
    raise exception 'Onaylanmis/yururlukteki surumun maddeleri degistirilemez (yeni surum gerekir)';
  end if;
  return coalesce(new, old);
end;
$$;

-- Madde bağı donukluğu (madde üzerinden sürüm durumunu çöz).
create or replace function public.policy_clause_link_donuk_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_durum text;
  v_clause uuid;
begin
  v_clause := coalesce(new.policy_clause_id, old.policy_clause_id);
  select pv.durum into v_durum
  from public.policy_clauses pc join public.policy_versions pv on pv.id = pc.policy_version_id
  where pc.id = v_clause;
  if v_durum in ('APPROVED', 'EFFECTIVE', 'RETIRED') then
    raise exception 'Onaylanmis/yururlukteki surumun madde baglari degistirilemez (yeni surum gerekir)';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger policy_clause_link_donuk_guard_trg
  before insert or update or delete on public.policy_clause_links
  for each row execute function public.policy_clause_link_donuk_guard();

-- Onay kaydı audit'i.
create or replace function public.audit_policy_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
  values (new.tenant_id, auth.uid(), 'policy_onay_kaydedildi', 'policy_approvals', new.id,
    jsonb_build_object('policy_version_id', new.policy_version_id, 'karar', new.karar));
  return new;
end;
$$;

create trigger audit_policy_approval_insert
  after insert on public.policy_approvals
  for each row execute function public.audit_policy_approval();

-- ============================================================
-- PART B — PolicyException (SoD istisna deseni)
-- ============================================================

create table public.policy_exceptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  policy_version_id uuid not null references public.policy_versions (id) on delete restrict,
  gerekce text not null,
  -- Sahip (talep eden) ve onaylayan AYRI kişiler (dört göz).
  sahip uuid not null references public.profiles (id) on delete restrict,
  onaylayan uuid references public.profiles (id) on delete restrict,
  onay_zamani timestamptz,
  baslangic date not null default current_date,
  bitis date not null,
  -- Telafi edici kontrol: M12 test tanımına bağ (yeni test altyapısı YOK).
  telafi_test_definition_id uuid references public.control_test_definitions (id) on delete restrict,
  durum text not null default 'TALEP'
    check (durum in ('TALEP', 'ONAYLANDI', 'REDDEDILDI', 'YENIDEN_DEGERLENDIR', 'IPTAL')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Süresiz istisna yasak (SoD deseni).
  constraint policy_exceptions_sure check (bitis > baslangic)
);

create trigger policy_exceptions_set_updated_at
  before update on public.policy_exceptions
  for each row execute function public.set_updated_at();

create index policy_exceptions_version_idx on public.policy_exceptions (policy_version_id);
create index policy_exceptions_suresi_idx on public.policy_exceptions (durum, bitis);

/**
 * İSTİSNA GUARD'I (SoD sod_istisna_onay_guard deseni):
 *   * ONANLANDI: onaylayan + zaman zorunlu; onaylayan != sahip (dört göz);
 *   * kimlik atfı: talep (INSERT) ancak sahip = oturum sahibi; onay ancak
 *     onaylayan = oturum sahibi (service/cron muaf).
 */
create or replace function public.policy_exception_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' and auth.uid() is not null and new.sahip is distinct from auth.uid() then
    raise exception 'Istisna ancak oturum sahibi adina talep edilebilir (kimlik atfi)';
  end if;

  if new.durum = 'ONAYLANDI' then
    if new.onaylayan is null or new.onay_zamani is null then
      raise exception 'ONAYLANDI istisnada onaylayan + zaman zorunlu';
    end if;
    if new.onaylayan = new.sahip then
      raise exception 'Istisna sahibi kendi istisnasini onaylayamaz (dort goz)';
    end if;
    if auth.uid() is not null and new.onaylayan is distinct from auth.uid() then
      raise exception 'Onay ancak oturum sahibi adina yazilabilir (kimlik atfi)';
    end if;
  end if;
  return new;
end;
$$;

create trigger policy_exception_guard_trg
  before insert or update on public.policy_exceptions
  for each row execute function public.policy_exception_guard();

create or replace function public.audit_policy_exception()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
    values (new.tenant_id, auth.uid(), 'policy_istisna_talep', 'policy_exceptions', new.id,
      jsonb_build_object('policy_version_id', new.policy_version_id, 'durum', new.durum));
    return new;
  end if;
  if new.durum is distinct from old.durum then
    insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
    values (new.tenant_id, auth.uid(), 'policy_istisna_durum_degisti', 'policy_exceptions', new.id,
      jsonb_build_object('durum_onceki', old.durum, 'durum', new.durum));
  end if;
  return new;
end;
$$;

create trigger audit_policy_exception_insert
  after insert on public.policy_exceptions
  for each row execute function public.audit_policy_exception();
create trigger audit_policy_exception_update
  after update on public.policy_exceptions
  for each row execute function public.audit_policy_exception();

-- ============================================================
-- PART C — İstisna süre-dolumu → yeniden değerlendirme kuyruğu (pg_cron)
-- ============================================================
-- SoD sod_istisna_suresi_dolanlari_isle deseni: idempotent, for-update-skip-
-- locked, per-row exception. Dolan onaylı istisna → YENIDEN_DEGERLENDIR
-- (kuyruk = bu durumdaki satırlar). İdempotent: ikinci koşuda ONAYLANDI yok.

create or replace function public.policy_istisna_suresi_dolanlari_isle()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kayit record;
begin
  for v_kayit in
    select id from public.policy_exceptions
    where durum = 'ONAYLANDI' and bitis < current_date
    for update skip locked
  loop
    begin
      update public.policy_exceptions
        set durum = 'YENIDEN_DEGERLENDIR'
        where id = v_kayit.id;
    exception when others then
      raise notice 'policy istisna % islenemedi: %', v_kayit.id, sqlerrm;
    end;
  end loop;
end;
$$;

revoke execute on function public.policy_istisna_suresi_dolanlari_isle() from authenticated, anon;

-- Defansif cron kaydı (PGlite'ta no-op; canlıda günlük 02:15 UTC).
do $$
begin
  perform cron.schedule(
    'kalkan-policy-sure-dolumu',
    '15 2 * * *',
    'select public.policy_istisna_suresi_dolanlari_isle();'
  );
exception when others then
  raise notice 'pg_cron kullanilamiyor (policy sure dolumu zamanlanmadi): %', sqlerrm;
end;
$$;

-- ============================================================
-- PART D — PolicyImpact (mevzuat değişikliği → madde etkisi)
-- ============================================================
-- AI/parser YALNIZ öneri üretir: kayıt PROPOSED doğar, ai_taslak APPLIED
-- doğamaz (invariant: AI politikayı/etkiyi onaylayamaz, kaynak gösterir).

create table public.policy_impacts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  policy_clause_id uuid not null references public.policy_clauses (id) on delete cascade,
  -- Etkinin kaynağı: değişen/ilgili hüküm (kaynak gösterilmeden etki üretilemez).
  provision_id uuid not null references public.provisions (id) on delete restrict,
  etki_ozeti text,
  durum text not null default 'PROPOSED'
    check (durum in ('PROPOSED', 'REVIEWED', 'APPLIED', 'DISMISSED')),
  oneren_kaynak text not null default 'manuel'
    check (oneren_kaynak in ('manuel', 'ai_taslak')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger policy_impacts_set_updated_at
  before update on public.policy_impacts
  for each row execute function public.set_updated_at();

create index policy_impacts_clause_idx on public.policy_impacts (policy_clause_id);

create or replace function public.policy_impact_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    -- Doğuşta yalnız PROPOSED (AI/insan farkı gözetmeksizin önce öneri).
    if new.durum is distinct from 'PROPOSED' then
      raise exception 'PolicyImpact yalniz PROPOSED dogabilir (once oneri, sonra insan incelemesi)';
    end if;
    return new;
  end if;
  -- AI taslağı APPLIED yapamaz (insan onayı şart).
  if new.durum = 'APPLIED' and new.oneren_kaynak = 'ai_taslak' then
    raise exception 'AI onerisi APPLIED yapilamaz (insan incelemesi sart)';
  end if;
  return new;
end;
$$;

create trigger policy_impact_guard_trg
  before insert or update on public.policy_impacts
  for each row execute function public.policy_impact_guard();

-- ============================================================
-- PART E — RLS (hepsi tenant'a kilitli; yazma admin/uyum) + cross-tenant
-- ============================================================
alter table public.policy_approvals enable row level security;
alter table public.policy_exceptions enable row level security;
alter table public.policy_impacts enable row level security;

-- Onaylar: okuma kendi kiracısı; ekleme admin/uyum + kendi adına (approver=uid).
create policy policy_approvals_select on public.policy_approvals
  for select using (tenant_id = public.current_tenant_id());
create policy policy_approvals_insert on public.policy_approvals
  for insert with check (
    tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('admin', 'uyum')
    and approver = auth.uid()
  );

create policy policy_exceptions_select on public.policy_exceptions
  for select using (tenant_id = public.current_tenant_id());
create policy policy_exceptions_write on public.policy_exceptions
  for all using (tenant_id = public.current_tenant_id() and public.current_user_role() in ('admin', 'uyum'))
  with check (tenant_id = public.current_tenant_id() and public.current_user_role() in ('admin', 'uyum'));

create policy policy_impacts_select on public.policy_impacts
  for select using (tenant_id = public.current_tenant_id());
create policy policy_impacts_write on public.policy_impacts
  for all using (tenant_id = public.current_tenant_id() and public.current_user_role() in ('admin', 'uyum'))
  with check (tenant_id = public.current_tenant_id() and public.current_user_role() in ('admin', 'uyum'));
