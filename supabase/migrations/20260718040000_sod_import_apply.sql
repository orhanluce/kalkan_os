-- SoD atama içe aktarma — ATOMİK APPLY + idempotency + transactional-outbox
-- + import manifesti (docs/ROADMAP.md M16 PR-3B).
--
-- PR-3A SALT OKURDU (dry-run önizleme). PR-3B önizlemeyi ATAMAYA çevirir. İki
-- korkuluk PR-3B'nin ruhu:
--   (1) ATOMİK: apply tek bir plpgsql fonksiyonunda (= tek transaction) olur.
--       Ekle/güncelle/sona-erdir + manifest + outbox + önizleme durumu ya
--       HEP BİRLİKTE commit olur ya hiçbiri. "Yarı uygulanmış import" olamaz.
--   (2) TRANSACTIONAL-OUTBOX: apply, "bu içe aktarma sonrası SoD yeniden
--       değerlendirilmeli" olayını aynı transaction'da bir outbox satırına
--       yazar. Değerlendirme AYRI bir drenaj rotasında koşar (kural 4: BullMQ
--       yok, saf Postgres). Böylece apply commit olduysa değerlendirme borcu
--       da GARANTİ kayıtlıdır — apply ile değerlendirme arasında olay kaybolmaz.
--
-- İDEMPOTENCY üç katmanlı: (a) önizleme durum kilidi (READY_FOR_REVIEW değilse
-- apply reddedilir, for update ile yarış kapatılır), (b) manifest unique
-- (onizleme_id) — bir önizleme yalnız bir kez manifestlenir, (c) atama partial
-- unique index (tenant, kaynak_sistem, source_record_id) — aynı kaynak kaydı
-- iki atama üretemez; apply ON CONFLICT ile idempotent yazar.

-- ============================================================================
-- 1. Import manifesti — uygulanmış bir içe aktarmanın DEĞİŞMEZ kaydı
-- ============================================================================
-- Diğer manifestlerin (core-manifest, simülasyon mührü) deseni: bütünlük
-- demirleri + sayılar + kim/ne zaman. `manifest_hash` bunları mühürler —
-- kural 15: hash'in NEYİ doğruladığı adında (bu import kararının kendisi).
create table public.sod_import_manifestleri (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  onizleme_id uuid not null references public.sod_import_onizlemeleri (id) on delete restrict,
  kaynak text not null,
  mode text not null check (mode in ('DELTA', 'AUTHORITATIVE_SNAPSHOT')),
  -- PR-3A'nın ürettiği bütünlük demirleri, burada mühürlenir.
  file_hash text not null check (file_hash ~ '^[0-9a-f]{64}$'),
  normalized_records_hash text not null check (normalized_records_hash ~ '^[0-9a-f]{64}$'),
  assignment_snapshot_hash text not null check (assignment_snapshot_hash ~ '^[0-9a-f]{64}$'),
  rule_set_version text not null check (rule_set_version ~ '^[0-9a-f]{64}$'),
  manifest_hash text not null check (manifest_hash ~ '^[0-9a-f]{64}$'),
  eklenen_sayisi integer not null check (eklenen_sayisi >= 0),
  guncellenen_sayisi integer not null check (guncellenen_sayisi >= 0),
  sona_erdirilen_sayisi integer not null check (sona_erdirilen_sayisi >= 0),
  uygulayan uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  -- İDEMPOTENCY (manifest düzeyi): bir önizleme yalnız bir kez uygulanır.
  -- Durum kilidi zaten çift-apply'ı engeller; bu unique ikinci savunma.
  unique (onizleme_id)
);

create index sod_import_manifestleri_tenant_idx
  on public.sod_import_manifestleri (tenant_id, created_at desc);

alter table public.sod_import_manifestleri enable row level security;

create policy sod_import_manifestleri_select on public.sod_import_manifestleri
  for select using (tenant_id = public.current_tenant_id());

-- Manifest yalnızca apply fonksiyonu (security definer) tarafından yazılır;
-- istemci INSERT/UPDATE/DELETE edemez (append-only, mührün özü).
revoke insert, update, delete on public.sod_import_manifestleri from authenticated, anon;

-- ============================================================================
-- 2. Transactional outbox — "SoD yeniden değerlendirilmeli" olayı
-- ============================================================================
-- SAĞLAYICIDAN BAĞIMSIZ olay (kurucu §7): payload yalnız iç kimlikler +
-- sayılar. E-posta/Slack YOK — olay bir kuyruğa değil, KENDİ tablomuza yazılır
-- ve saf Postgres bir drenaj rotasıyla işlenir (kural 4). durum PENDING doğar;
-- drenaj DONE'a taşır (yalnız service_role — istemci UPDATE edemez).
create table public.sod_outbox (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  event_type text not null,
  payload jsonb not null,
  durum text not null default 'PENDING' check (durum in ('PENDING', 'DONE', 'ERROR')),
  deneme_sayisi integer not null default 0,
  islenme_at timestamptz,
  hata text,
  -- Hangi değerlendirme koşusu bu olayı işledi (determinizm/izlenebilirlik).
  degerlendirme_calistirma_id uuid references public.sod_degerlendirme_calistirmalari (id) on delete set null,
  created_at timestamptz not null default now()
);

create index sod_outbox_pending_idx
  on public.sod_outbox (tenant_id, created_at)
  where durum = 'PENDING';

alter table public.sod_outbox enable row level security;

create policy sod_outbox_select on public.sod_outbox
  for select using (tenant_id = public.current_tenant_id());

-- Olay yalnız apply fonksiyonu (definer) yazar; drenaj yalnız service_role
-- günceller. İstemci ne yazar ne günceller ne siler.
revoke insert, update, delete on public.sod_outbox from authenticated, anon;

-- ============================================================================
-- 3. ATOMİK APPLY — sod_import_uygula()
-- ============================================================================
-- Tek transaction'da: (stale yeniden-kontrol) → diff uygula (ekle/güncelle/
-- sona-erdir) → manifest yaz → outbox yaz → önizleme APPLIED. Herhangi biri
-- patlarsa hepsi geri alınır.
--
-- STALE YENİDEN-KONTROL (savunma derinliği): rota, apply'dan ÖNCE güncel atama
-- snapshot + kural seti hash'ini TS'te yeniden hesaplar (onizlemeBayatMi).
-- Fonksiyon bunları argüman alıp önizlemenin sakladığı hash'lerle KİLİT ALTINDA
-- yeniden karşılaştırır — rota kontrolü ile apply arasındaki dar yarışı da
-- kapatmaya çalışır. Kalan yarış (TS okuma ile bu çağrı arası) dürüstçe borç
-- (aşağıda ROADMAP notu); önizleme for update ile kilitli olduğundan çift-apply
-- yarışı tümüyle kapalı.
--
-- SERBEST KOD YOK: diff önizlemede zaten hesaplandı (PR-3A, saf TS). Fonksiyon
-- o diff'i uygular, YENİDEN hesaplamaz — böylece TS diff mantığı ile SQL apply
-- ayrışamaz (tek kaynak).
--
-- KİMLİK (bilinçli borç, PR-3A ile aynı): harici kimlik = kaynak:externalSubjectId.
-- profiles'a otomatik-link yok — tam kimlik çözümlemesi sonraki tur.
create or replace function public.sod_import_uygula(
  p_onizleme_id uuid,
  p_actor uuid,
  p_guncel_atama_snapshot_hash text,
  p_guncel_rule_set_version text,
  p_manifest_hash text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_o record;
  v_rec jsonb;
  v_kalem jsonb;
  v_eklenen integer := 0;
  v_guncellenen integer := 0;
  v_sona_erdirilen integer := 0;
  v_manifest_id uuid;
begin
  -- Önizlemeyi KİLİTLE: iki eşzamanlı apply'dan yalnız biri geçer.
  select * into v_o
  from public.sod_import_onizlemeleri
  where id = p_onizleme_id
  for update;

  if not found then
    raise exception 'ONIZLEME_YOK' using errcode = 'P0002';
  end if;
  if v_o.durum <> 'READY_FOR_REVIEW' then
    raise exception 'ONIZLEME_UYGULANAMAZ: durum %', v_o.durum using errcode = 'P0001';
  end if;

  -- Stale yeniden-kontrol (kilit altında). Rota ayrıca TS'te kontrol eder.
  if v_o.assignment_snapshot_hash <> p_guncel_atama_snapshot_hash
     or v_o.rule_set_version <> p_guncel_rule_set_version then
    raise exception 'IMPORT_PREVIEW_STALE' using errcode = 'P0001';
  end if;

  -- (1) EKLENECEK — idempotent upsert (partial unique index üzerinden).
  for v_rec in select * from jsonb_array_elements(v_o.diff -> 'eklenecek')
  loop
    insert into public.sod_atamalari (
      tenant_id, harici_kullanici_id, aktivite_kodu, rol_kodu, sistem_kapsami,
      gecerlilik_baslangic, gecerlilik_bitis, kaynak_sistem, source_record_id,
      subject_type, display_name, email, son_senkron_at
    ) values (
      v_o.tenant_id,
      (v_rec ->> 'source') || ':' || (v_rec ->> 'externalSubjectId'),
      v_rec ->> 'activityCode',
      v_rec ->> 'roleCode',
      v_rec ->> 'systemCode',
      (v_rec ->> 'validFrom')::date,
      (v_rec ->> 'validTo')::date,
      v_rec ->> 'source',
      v_rec ->> 'sourceRecordId',
      v_rec ->> 'subjectType',
      v_rec ->> 'displayName',
      v_rec ->> 'email',
      now()
    )
    on conflict (tenant_id, kaynak_sistem, source_record_id) where source_record_id is not null
    do update set
      aktivite_kodu = excluded.aktivite_kodu,
      rol_kodu = excluded.rol_kodu,
      sistem_kapsami = excluded.sistem_kapsami,
      gecerlilik_baslangic = excluded.gecerlilik_baslangic,
      gecerlilik_bitis = excluded.gecerlilik_bitis,
      subject_type = excluded.subject_type,
      display_name = excluded.display_name,
      email = excluded.email,
      son_senkron_at = now();
    v_eklenen := v_eklenen + 1;
  end loop;

  -- (2) GÜNCELLENECEK — kaynak kaydına göre eşleşen mevcut atamayı güncelle.
  for v_kalem in select * from jsonb_array_elements(v_o.diff -> 'guncellenecek')
  loop
    v_rec := v_kalem -> 'record';
    update public.sod_atamalari set
      aktivite_kodu = v_rec ->> 'activityCode',
      rol_kodu = v_rec ->> 'roleCode',
      sistem_kapsami = v_rec ->> 'systemCode',
      gecerlilik_baslangic = (v_rec ->> 'validFrom')::date,
      gecerlilik_bitis = (v_rec ->> 'validTo')::date,
      subject_type = v_rec ->> 'subjectType',
      display_name = v_rec ->> 'displayName',
      email = v_rec ->> 'email',
      son_senkron_at = now()
    where tenant_id = v_o.tenant_id
      and kaynak_sistem = v_rec ->> 'source'
      and source_record_id = v_rec ->> 'sourceRecordId';
    if found then
      v_guncellenen := v_guncellenen + 1;
    end if;
  end loop;

  -- (3) SONA ERDİRİLECEK — FİZİKSEL SİLME YOK (kural 2 ruhu): yalnızca
  -- gecerlilik_bitis atanır. Yalnız hâlâ açık (bitis null) olanlar.
  for v_rec in select * from jsonb_array_elements(v_o.diff -> 'sonaErdirilecek')
  loop
    update public.sod_atamalari set
      gecerlilik_bitis = current_date,
      son_senkron_at = now()
    where tenant_id = v_o.tenant_id
      and kaynak_sistem = v_rec ->> 'kaynak_sistem'
      and source_record_id = v_rec ->> 'source_record_id'
      and gecerlilik_bitis is null;
    if found then
      v_sona_erdirilen := v_sona_erdirilen + 1;
    end if;
  end loop;

  -- (4) MANİFEST — uygulanmış içe aktarmanın değişmez kaydı.
  insert into public.sod_import_manifestleri (
    tenant_id, onizleme_id, kaynak, mode,
    file_hash, normalized_records_hash, assignment_snapshot_hash, rule_set_version,
    manifest_hash, eklenen_sayisi, guncellenen_sayisi, sona_erdirilen_sayisi, uygulayan
  ) values (
    v_o.tenant_id, v_o.id, v_o.kaynak, v_o.mode,
    v_o.file_hash, v_o.normalized_records_hash, v_o.assignment_snapshot_hash, v_o.rule_set_version,
    p_manifest_hash, v_eklenen, v_guncellenen, v_sona_erdirilen, p_actor
  )
  returning id into v_manifest_id;

  -- (5) OUTBOX — "yeniden değerlendir" olayı, apply ile AYNI transaction'da.
  insert into public.sod_outbox (tenant_id, event_type, payload)
  values (
    v_o.tenant_id, 'SOD_ATAMALARI_IMPORT_EDILDI',
    jsonb_build_object(
      'onizleme_id', v_o.id,
      'manifest_id', v_manifest_id,
      'kaynak', v_o.kaynak,
      'mode', v_o.mode,
      'eklenen', v_eklenen,
      'guncellenen', v_guncellenen,
      'sona_erdirilen', v_sona_erdirilen
    )
  );

  -- (6) ÖNİZLEME → APPLIED.
  update public.sod_import_onizlemeleri
  set durum = 'APPLIED'
  where id = v_o.id;

  return jsonb_build_object(
    'manifest_id', v_manifest_id,
    'eklenen', v_eklenen,
    'guncellenen', v_guncellenen,
    'sona_erdirilen', v_sona_erdirilen
  );
end;
$$;

-- Fonksiyon tenant sınırını KENDİ okuduğu önizlemeden alıp bütün yazımlara
-- uygular; RLS'i (definer olarak) bypass ettiği için, doğrudan çağrılırsa bir
-- istemci başka kiracının önizlemesini uygulatmayı DENEYEBİLİR — bu yüzden
-- yürütme yalnızca service_role'a bırakılır (rota service_role ile çağırır,
-- ama önce RLS altında önizlemeyi kendi kiracısında OKUYARAK yetkilendirir).
revoke execute on function public.sod_import_uygula(uuid, uuid, text, text, text)
  from public, authenticated, anon;

-- ============================================================================
-- 4. Denetim izi — apply mutasyonu (kurucu: her mutasyon immutable audit)
-- ============================================================================
-- auth.uid() service_role bağlamında NULL olur; bu yüzden actor'ı manifestin
-- `uygulayan` alanından (rotanın geçirdiği gerçek kullanıcı) alıyoruz. Serbest
-- metin İÇERİĞİ yazılmaz (kural 7) — yalnız kaynak/mod/sayılar/manifest hash.
create or replace function public.audit_sod_import_uygulandi()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
  values (
    new.tenant_id, new.uygulayan, 'sod_import_uygulandi', 'sod_import_manifestleri', new.id,
    jsonb_build_object(
      'onizleme_id', new.onizleme_id, 'kaynak', new.kaynak, 'mode', new.mode,
      'eklenen', new.eklenen_sayisi, 'guncellenen', new.guncellenen_sayisi,
      'sona_erdirilen', new.sona_erdirilen_sayisi, 'manifest_hash', new.manifest_hash
    )
  );
  return new;
end;
$$;

create trigger audit_sod_import_uygulandi_after_insert
  after insert on public.sod_import_manifestleri
  for each row execute function public.audit_sod_import_uygulandi();
