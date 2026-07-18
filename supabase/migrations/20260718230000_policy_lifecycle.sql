-- Politika & Prosedür Yaşam Döngüsü (G2, M34; nihai talimat §8 Gate G2).
--
-- TENANT'A ÖZGÜ (global referans DEĞİL): bir politika kurumun KENDİ yönetişim
-- belgesidir — her tabloda tenant_id + RLS (kural 1). Regülasyon korpusu
-- (provisions/obligations) global; politika onu YEREL olarak uygular.
--
-- ZİNCİR: PolicyDocument -> PolicyVersion (sürümlü, durum makineli) ->
-- PolicyClause (madde) -> PolicyClauseLink (madde -> hüküm/yükümlülük/kontrol).
-- Ayrıca PolicyAttestation (çalışan okudu-anladı kanıtı).
--
-- DURUM MAKİNESİ (nihai §8): DRAFT -> REVIEW -> APPROVED -> EFFECTIVE -> RETIRED.
-- DÖRT GÖZ (invariant #4): REVIEW->APPROVED'da onaylayan != hazirlayan
-- (service_role bile atlayamaz — DB trigger'ı). EFFECTIVE sürümün maddeleri
-- DONUK: metin değişikliği yeni sürüm ister (sessiz kayma yok, VERIFIED
-- obligations deseni). AI taslağı (eklenme_kaynagi='ai_taslak') doğrudan
-- APPROVED/EFFECTIVE DOĞAMAZ — insan incelemesi şart (invariant #5).

-- --- Belge ---
create table public.policy_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  kod text not null,
  baslik text not null,
  kategori text not null default 'genel'
    check (kategori in ('genel', 'bilgi_guvenligi', 'odeme', 'erisim', 'is_surekliligi', 'gizlilik', 'ai')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, kod)
);

create trigger policy_documents_set_updated_at
  before update on public.policy_documents
  for each row execute function public.set_updated_at();

-- --- Sürüm (durum makinesi + dört göz) ---
create table public.policy_versions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  policy_document_id uuid not null references public.policy_documents (id) on delete cascade,
  surum integer not null check (surum > 0),
  durum text not null default 'DRAFT'
    check (durum in ('DRAFT', 'REVIEW', 'APPROVED', 'EFFECTIVE', 'RETIRED')),
  -- Hazırlayan/onaylayan ayrımı (invariant #4).
  hazirlayan uuid references public.profiles (id) on delete restrict,
  hazirlama_zamani timestamptz,
  onaylayan uuid references public.profiles (id) on delete restrict,
  onay_zamani timestamptz,
  -- Yürürlük tarihi (APPROVED->EFFECTIVE'de zorunlu).
  effective_from date,
  -- Redline/değişiklik notu (nihai §8 "redline ve effective date").
  redline_notu text,
  eklenme_kaynagi text not null default 'manuel'
    check (eklenme_kaynagi in ('manuel', 'ai_taslak')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (policy_document_id, surum)
);

create trigger policy_versions_set_updated_at
  before update on public.policy_versions
  for each row execute function public.set_updated_at();

create index policy_versions_document_idx on public.policy_versions (policy_document_id, surum desc);

-- Bir belgenin tek EFFECTIVE sürümü olur (yeni yürürlüğe girince eski RETIRED).
create unique index policy_versions_tek_effective
  on public.policy_versions (policy_document_id)
  where durum = 'EFFECTIVE';

-- --- Madde ---
create table public.policy_clauses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  policy_version_id uuid not null references public.policy_versions (id) on delete cascade,
  madde_ref text not null,
  metin text not null,
  sira integer not null default 0,
  created_at timestamptz not null default now(),
  unique (policy_version_id, madde_ref)
);

create index policy_clauses_version_idx on public.policy_clauses (policy_version_id, sira);

-- --- Madde bağı: hüküm/yükümlülük/kontrol (nihai §8 "maddeyi ... bağlama") ---
-- Global referans hedeflerine (provisions/obligations) VE kontrole bağ.
create table public.policy_clause_links (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  policy_clause_id uuid not null references public.policy_clauses (id) on delete cascade,
  -- Tam olarak BİR hedef (check ile zorlanır).
  provision_id uuid references public.provisions (id) on delete restrict,
  obligation_id uuid references public.obligations (id) on delete restrict,
  control_id uuid references public.controls (id) on delete restrict,
  constraint pcl_tek_hedef check (
    (case when provision_id is not null then 1 else 0 end)
    + (case when obligation_id is not null then 1 else 0 end)
    + (case when control_id is not null then 1 else 0 end) = 1
  ),
  created_at timestamptz not null default now()
);

create index policy_clause_links_clause_idx on public.policy_clause_links (policy_clause_id);

-- --- Çalışan attestation'ı ---
create table public.policy_attestations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  policy_version_id uuid not null references public.policy_versions (id) on delete cascade,
  attesting_user uuid not null references public.profiles (id) on delete restrict,
  attested_at timestamptz not null default now(),
  -- Bir kullanıcı bir sürümü bir kez attest eder.
  unique (policy_version_id, attesting_user)
);

create index policy_attestations_version_idx on public.policy_attestations (policy_version_id);

/**
 * DURUM MAKİNESİ + DÖRT GÖZ GUARD'I (invariant #3/#4: DB, route değil).
 *
 * Geçerli geçişler:
 *   DRAFT   -> REVIEW    (hazirlayan zorunlu)
 *   REVIEW  -> DRAFT     (geri gönder)
 *   REVIEW  -> APPROVED  (onaylayan zorunlu, onaylayan != hazirlayan)
 *   APPROVED-> EFFECTIVE (effective_from zorunlu)
 *   EFFECTIVE-> RETIRED
 * Diğer her geçiş reddedilir. AI taslağı REVIEW'i geçemeden APPROVED olamaz
 * (zaten yalnız REVIEW'den geçilir; ayrıca doğrudan doğuşta kontrol edilir).
 */
create or replace function public.policy_version_durum_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    -- AI taslağı APPROVED/EFFECTIVE DOĞAMAZ (invariant #5: insan incelemesi).
    if new.durum in ('APPROVED', 'EFFECTIVE') and new.eklenme_kaynagi = 'ai_taslak' then
      raise exception 'AI taslagi dogrudan APPROVED/EFFECTIVE dogamaz (insan incelemesi sart)';
    end if;
    -- Yeni sürüm en fazla REVIEW ile doğabilir (temkinli).
    if new.durum not in ('DRAFT', 'REVIEW') then
      raise exception 'Yeni policy_version yalniz DRAFT veya REVIEW ile dogabilir';
    end if;
    return new;
  end if;

  if new.durum = old.durum then
    return new;
  end if;

  -- Geçerli geçiş matrisi.
  if not (
    (old.durum = 'DRAFT' and new.durum = 'REVIEW')
    or (old.durum = 'REVIEW' and new.durum = 'DRAFT')
    or (old.durum = 'REVIEW' and new.durum = 'APPROVED')
    or (old.durum = 'APPROVED' and new.durum = 'EFFECTIVE')
    or (old.durum = 'EFFECTIVE' and new.durum = 'RETIRED')
  ) then
    raise exception 'Gecersiz policy durum gecisi: % -> %', old.durum, new.durum;
  end if;

  if new.durum = 'REVIEW' and (new.hazirlayan is null or new.hazirlama_zamani is null) then
    raise exception 'REVIEW gecisi hazirlayan + zaman olmadan yapilamaz';
  end if;

  if new.durum = 'APPROVED' then
    if new.onaylayan is null or new.onay_zamani is null then
      raise exception 'APPROVED gecisi onaylayan + zaman olmadan yapilamaz';
    end if;
    if new.onaylayan = new.hazirlayan then
      raise exception 'Hazirlayan kendi surumunu onaylayamaz (dort goz)';
    end if;
  end if;

  if new.durum = 'EFFECTIVE' and new.effective_from is null then
    raise exception 'EFFECTIVE gecisi effective_from olmadan yapilamaz';
  end if;

  return new;
end;
$$;

create trigger policy_version_durum_guard_trg
  before insert or update on public.policy_versions
  for each row execute function public.policy_version_durum_guard();

/**
 * MADDE DONUKLUĞU: EFFECTIVE (veya RETIRED) sürümün maddeleri
 * eklenemez/değiştirilemez/silinemez — yürürlükteki politika sessizce
 * değişemez, yeni sürüm gerekir (VERIFIED obligations deseni).
 */
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
  if v_durum in ('EFFECTIVE', 'RETIRED') then
    raise exception 'Yururlukteki/emekli surumun maddeleri degistirilemez (yeni surum gerekir)';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger policy_clause_donuk_guard_trg
  before insert or update or delete on public.policy_clauses
  for each row execute function public.policy_clause_donuk_guard();

/**
 * ATTESTATION GUARD'I: yalnız EFFECTIVE sürüm attest edilebilir (taslak
 * politikaya "okudum" denmez) + kimlik atfı oturum sahibine sabit (M16 #9
 * deseni; service/cron muaf).
 */
create or replace function public.policy_attestation_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_durum text;
begin
  select durum into v_durum from public.policy_versions where id = new.policy_version_id;
  if v_durum is distinct from 'EFFECTIVE' then
    raise exception 'Yalniz yururlukteki (EFFECTIVE) surum attest edilebilir';
  end if;
  if auth.uid() is not null and new.attesting_user is distinct from auth.uid() then
    raise exception 'Attestation ancak oturum sahibi adina yazilabilir (kimlik atfi)';
  end if;
  return new;
end;
$$;

create trigger policy_attestation_guard_trg
  before insert on public.policy_attestations
  for each row execute function public.policy_attestation_guard();

-- --- Denetim izi: sürüm durum değişimi (invariant #15) ---
create or replace function public.audit_policy_version()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
    values (new.tenant_id, auth.uid(), 'policy_surum_olusturuldu', 'policy_versions', new.id,
      jsonb_build_object('surum', new.surum, 'durum', new.durum, 'kaynak', new.eklenme_kaynagi));
    return new;
  end if;
  if new.durum is distinct from old.durum then
    insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
    values (new.tenant_id, auth.uid(), 'policy_surum_durum_degisti', 'policy_versions', new.id,
      jsonb_build_object('durum_onceki', old.durum, 'durum', new.durum));
  end if;
  return new;
end;
$$;

create trigger audit_policy_version_insert
  after insert on public.policy_versions
  for each row execute function public.audit_policy_version();
create trigger audit_policy_version_update
  after update on public.policy_versions
  for each row execute function public.audit_policy_version();

-- --- RLS: hepsi tenant'a kilitli; yazma admin/uyum, attestation herkes ---
alter table public.policy_documents enable row level security;
alter table public.policy_versions enable row level security;
alter table public.policy_clauses enable row level security;
alter table public.policy_clause_links enable row level security;
alter table public.policy_attestations enable row level security;

-- Belge/sürüm/madde/bağ: okuma kendi kiracısı, yazma admin/uyum.
create policy policy_documents_select on public.policy_documents
  for select using (tenant_id = public.current_tenant_id());
create policy policy_documents_write on public.policy_documents
  for all using (tenant_id = public.current_tenant_id() and public.current_user_role() in ('admin', 'uyum'))
  with check (tenant_id = public.current_tenant_id() and public.current_user_role() in ('admin', 'uyum'));

create policy policy_versions_select on public.policy_versions
  for select using (tenant_id = public.current_tenant_id());
create policy policy_versions_write on public.policy_versions
  for all using (tenant_id = public.current_tenant_id() and public.current_user_role() in ('admin', 'uyum'))
  with check (tenant_id = public.current_tenant_id() and public.current_user_role() in ('admin', 'uyum'));

create policy policy_clauses_select on public.policy_clauses
  for select using (tenant_id = public.current_tenant_id());
create policy policy_clauses_write on public.policy_clauses
  for all using (tenant_id = public.current_tenant_id() and public.current_user_role() in ('admin', 'uyum'))
  with check (tenant_id = public.current_tenant_id() and public.current_user_role() in ('admin', 'uyum'));

create policy policy_clause_links_select on public.policy_clause_links
  for select using (tenant_id = public.current_tenant_id());
create policy policy_clause_links_write on public.policy_clause_links
  for all using (tenant_id = public.current_tenant_id() and public.current_user_role() in ('admin', 'uyum'))
  with check (tenant_id = public.current_tenant_id() and public.current_user_role() in ('admin', 'uyum'));

-- Attestation: kendi kiracısının EFFECTIVE sürümünü HERKES attest edebilir
-- (çalışan okudu-anladı); okuma kendi kiracısı.
create policy policy_attestations_select on public.policy_attestations
  for select using (tenant_id = public.current_tenant_id());
create policy policy_attestations_insert on public.policy_attestations
  for insert with check (tenant_id = public.current_tenant_id() and attesting_user = auth.uid());
