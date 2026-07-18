-- M36 — PrivacyOps (KVKK/GDPR) — Gate G6, ilk üretim dikeyi.
--
-- TENANT'A ÖZGÜ: işleme envanteri, veri sahibi başvurusu, ihlal ve gizlilik
-- değerlendirmesi kurumun kendi verisidir — her tabloda tenant_id + RLS.
--
-- BU DİLİM (dar-ama-çalışan): ROPA (işleme faaliyeti + hukuki dayanak + kaynak
-- soyu + saklama + sınır-ötesi), DSAR (veri sahibi başvurusu + KİMLİK
-- DOĞRULAMA şartı + süre saati), ihlal (breach + otorite/veri-sahibi bildirim
-- saati), gizlilik değerlendirmesi (DPIA/LIA/TIA + dört-göz tamamlama).
--
-- VERİ MİNİMİZASYONU (kural 7 + CFO §5.1 deseni): DSAR'da veri sahibinin TAM
-- kimliği saklanmaz — maskeli referans + hash. Süre saatleri (deadline)
-- SAKLANMAZ, türetilir (saf `src/lib/gizlilik.ts`, kural 11) — gerçek-zamanlı
-- alarm (M05 incident clock ilkesi). Connector/data-discovery bu dilimde YOK
-- (read-only, ayrı iş — bilinçli).
--
-- ROLLBACK NOTU: eklemeli bağımsız tablolar. Ters FK sırasıyla drop:
-- privacy_assessments, privacy_incidents, data_subject_requests,
-- processing_activities. Üretim verisi yok — fresh drop güvenli.

-- --- İşleme faaliyeti (ROPA) ---
create table public.processing_activities (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  ad text not null,
  amac text not null,
  -- KVKK/GDPR hukuki dayanağı.
  hukuki_dayanak text not null check (hukuki_dayanak in (
    'RIZA', 'SOZLESME', 'HUKUKI_YUKUMLULUK', 'MESRU_MENFAAT', 'KAMU_GOREVI', 'HAYATI_MENFAAT'
  )),
  -- Kaynak soyu (KVKK/GDPR madde bağı — opsiyonel, global hüküm).
  dayanak_provision_id uuid references public.provisions (id) on delete restrict,
  veri_kategorileri text[] not null default '{}',
  veri_sahibi_kategorileri text[] not null default '{}',
  alicilar text[] not null default '{}',
  saklama_suresi text,
  saklama_dayanagi text,
  sinir_otesi_transfer boolean not null default false,
  transfer_ulkeleri text[] not null default '{}',
  durum text not null default 'TASLAK' check (durum in ('TASLAK', 'AKTIF', 'ARSIV')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, ad)
);

create trigger processing_activities_set_updated_at
  before update on public.processing_activities
  for each row execute function public.set_updated_at();

-- --- Veri sahibi başvurusu (DSAR) ---
create table public.data_subject_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  tur text not null check (tur in ('ERISIM', 'SILME', 'DUZELTME', 'ITIRAZ', 'TASIMA', 'KISITLAMA')),
  -- Veri minimizasyonu: TAM kimlik saklanmaz (maskeli + hash).
  veri_sahibi_maskeli text not null,
  veri_sahibi_hash text check (veri_sahibi_hash is null or veri_sahibi_hash ~ '^[0-9a-f]{64}$'),
  -- Kimlik doğrulaması: TAMAMLANDI için ŞART (guard).
  kimlik_dogrulandi boolean not null default false,
  durum text not null default 'ALINDI'
    check (durum in ('ALINDI', 'KIMLIK_BEKLIYOR', 'ISLENIYOR', 'TAMAMLANDI', 'REDDEDILDI')),
  alindi_at timestamptz not null default now(),
  -- KVKK yasal süre (gün) — deadline türetimin girdisi (SAKLANMAZ, türetilir).
  yasal_sure_gun integer not null default 30 check (yasal_sure_gun > 0),
  tamamlandi_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger data_subject_requests_set_updated_at
  before update on public.data_subject_requests
  for each row execute function public.set_updated_at();

create index dsar_durum_idx on public.data_subject_requests (tenant_id, durum);

/**
 * DSAR GUARD'I: TAMAMLANDI yalnız KİMLİK DOĞRULANDIYSA (veri sahibinin
 * kimliği doğrulanmadan hakkı işletilemez — yanlış kişiye veri sızması riski).
 */
create or replace function public.dsar_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.durum = 'TAMAMLANDI' and new.kimlik_dogrulandi is not true then
    raise exception 'DSAR TAMAMLANDI icin kimlik dogrulama sart (yanlis kisiye veri riski)';
  end if;
  if new.durum = 'TAMAMLANDI' and new.tamamlandi_at is null then
    new.tamamlandi_at := now();
  end if;
  return new;
end;
$$;

create trigger dsar_guard_trg
  before insert or update on public.data_subject_requests
  for each row execute function public.dsar_guard();

-- --- Gizlilik ihlali (breach) ---
create table public.privacy_incidents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  ozet text not null,
  tespit_at timestamptz not null,
  siniflandirma text not null default 'ORTA' check (siniflandirma in ('DUSUK', 'ORTA', 'YUKSEK')),
  otorite_bildirim_gerekli boolean not null default true,
  veri_sahibi_bildirim_gerekli boolean not null default false,
  -- Bildirim süre saati SAKLANMAZ (tespit_at + yasal süreden türetilir).
  otorite_bildirildi_at timestamptz,
  veri_sahibi_bildirildi_at timestamptz,
  durum text not null default 'ACIK' check (durum in ('ACIK', 'DEGERLENDIRILIYOR', 'BILDIRILDI', 'KAPANDI')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger privacy_incidents_set_updated_at
  before update on public.privacy_incidents
  for each row execute function public.set_updated_at();

-- --- Gizlilik değerlendirmesi (DPIA/LIA/TIA) ---
create table public.privacy_assessments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  processing_activity_id uuid not null references public.processing_activities (id) on delete cascade,
  tur text not null check (tur in ('DPIA', 'LIA', 'TIA')),
  sonuc text,
  durum text not null default 'TASLAK' check (durum in ('TASLAK', 'INCELEME', 'TAMAMLANDI')),
  hazirlayan uuid references public.profiles (id) on delete restrict,
  onaylayan uuid references public.profiles (id) on delete restrict,
  onay_zamani timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger privacy_assessments_set_updated_at
  before update on public.privacy_assessments
  for each row execute function public.set_updated_at();

create index privacy_assessments_pa_idx on public.privacy_assessments (processing_activity_id);

/**
 * DEĞERLENDİRME GUARD'I (dört göz): TAMAMLANDI yalnız sonuç + onaylayan +
 * zaman ile ve onaylayan ≠ hazırlayan.
 */
create or replace function public.privacy_assessment_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.durum = 'TAMAMLANDI' then
    if new.sonuc is null or new.onaylayan is null or new.onay_zamani is null then
      raise exception 'Degerlendirme TAMAMLANDI icin sonuc + onaylayan + zaman zorunlu';
    end if;
    if new.onaylayan = new.hazirlayan then
      raise exception 'Hazirlayan kendi degerlendirmesini onaylayamaz (dort goz)';
    end if;
  end if;
  return new;
end;
$$;

create trigger privacy_assessment_guard_trg
  before insert or update on public.privacy_assessments
  for each row execute function public.privacy_assessment_guard();

-- --- Audit: DSAR ve ihlal durum değişimleri ---
create or replace function public.audit_privacy()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
    values (new.tenant_id, auth.uid(), TG_ARGV[0] || '_olusturuldu', TG_TABLE_NAME, new.id,
      jsonb_build_object('durum', new.durum));
    return new;
  end if;
  if new.durum is distinct from old.durum then
    insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
    values (new.tenant_id, auth.uid(), TG_ARGV[0] || '_durum_degisti', TG_TABLE_NAME, new.id,
      jsonb_build_object('durum_onceki', old.durum, 'durum', new.durum));
  end if;
  return new;
end;
$$;

create trigger audit_dsar_insert after insert on public.data_subject_requests
  for each row execute function public.audit_privacy('dsar');
create trigger audit_dsar_update after update on public.data_subject_requests
  for each row execute function public.audit_privacy('dsar');
create trigger audit_incident_insert after insert on public.privacy_incidents
  for each row execute function public.audit_privacy('ihlal');
create trigger audit_incident_update after update on public.privacy_incidents
  for each row execute function public.audit_privacy('ihlal');

-- --- RLS: hepsi tenant'a kilitli; yazma admin/uyum ---
alter table public.processing_activities enable row level security;
alter table public.data_subject_requests enable row level security;
alter table public.privacy_incidents enable row level security;
alter table public.privacy_assessments enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['processing_activities', 'data_subject_requests', 'privacy_incidents', 'privacy_assessments']
  loop
    execute format(
      'create policy %1$s_select on public.%1$s for select using (tenant_id = public.current_tenant_id())', t);
    execute format(
      'create policy %1$s_write on public.%1$s for all using (tenant_id = public.current_tenant_id() and public.current_user_role() in (''admin'', ''uyum'')) with check (tenant_id = public.current_tenant_id() and public.current_user_role() in (''admin'', ''uyum''))', t);
  end loop;
end;
$$;
