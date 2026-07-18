-- SoD atama içe aktarma — ROLLBACK + bağımsız onay (docs/ROADMAP.md M16 PR-3C).
--
-- İKİ İLKE:
--   (1) TERS DEĞİŞİKLİK SETİ, FİZİKSEL SİLME YOK: rollback hiçbir satırı
--       silmez. Eklenen atama SONA ERDİRİLİR (gecerlilik_bitis), güncellenen
--       atama apply-öncesi değerlerine DÖNDÜRÜLÜR, sona erdirilen atama
--       YENİDEN AÇILIR (bitis=null). Ters set apply ANINDA yakalanır — sonra
--       yeniden hesaplanmaz (araya giren değişiklikler yanlış tersine çevrilirdi).
--   (2) MAKER-CHECKER: rollback'i talep eden UYGULAYAMAZ/ONAYLAYAMAZ — karar
--       veren farklı bir yetkili olmalı. İstisna onayı guard'ıyla aynı disiplin:
--       DB trigger'da, route'a bırakılmaz.

-- ============================================================================
-- 1. Manifest'e ters değişiklik seti kolonu
-- ============================================================================
-- NULLABLE ve DÜRÜST: bu migration'dan ÖNCE uygulanan manifestlerin ters seti
-- yakalanmadı — onlar için uydurulmaz (kural 15 ruhu: LEGACY kayıt olduğu gibi
-- kalır), rollback yalnız ters seti OLAN manifestlerde çalışır (route 409
-- ROLLBACK_DESTEKLENMIYOR döner).
alter table public.sod_import_manifestleri
  add column ters_degisiklik jsonb;

-- ============================================================================
-- 2. sod_import_uygula — ters seti apply ANINDA yakalayacak şekilde değişir
-- ============================================================================
-- PR-3B'deki fonksiyonun davranışı korunur; eklenen tek şey her mutasyondan
-- ÖNCE mevcut satırın yakalanması:
--   - eklenecek kalem HEDEFTE ZATEN VARSA (idempotent upsert-revive: başka
--     bir önizleme daha önce eklemiş) bu bir EKLEME değil GÜNCELLEMEDİR ve
--     ters seti eski değerleri saklar — rollback onu silmeye değil eski
--     haline döndürmeye çalışır (PR-3B bunu ayırt etmiyordu; sayaçlar için
--     önemsizdi, rollback için kritik).
--   - GUNCELLENDI kalemi TÜM alanları (subject_type/display_name/email dahil)
--     to_jsonb ile saklar — MevcutAtama'nın dar alan listesi yetmez.
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
  v_onceki record;
  v_eklenen integer := 0;
  v_guncellenen integer := 0;
  v_sona_erdirilen integer := 0;
  v_manifest_id uuid;
  v_ters jsonb := '[]'::jsonb;
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

  -- (1) EKLENECEK — idempotent upsert; ters seti için önce mevcuda bak.
  for v_rec in select * from jsonb_array_elements(v_o.diff -> 'eklenecek')
  loop
    select * into v_onceki from public.sod_atamalari
    where tenant_id = v_o.tenant_id
      and kaynak_sistem = v_rec ->> 'source'
      and source_record_id = v_rec ->> 'sourceRecordId';

    if found then
      -- Upsert-revive: gerçekte güncelleme — ters seti eski değerleri saklar.
      v_ters := v_ters || jsonb_build_object('tur', 'GUNCELLENDI', 'onceki', to_jsonb(v_onceki));
    else
      v_ters := v_ters || jsonb_build_object(
        'tur', 'EKLENDI',
        'kaynak_sistem', v_rec ->> 'source',
        'source_record_id', v_rec ->> 'sourceRecordId'
      );
    end if;

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

  -- (2) GÜNCELLENECEK — önce eski satırı yakala, sonra güncelle.
  for v_kalem in select * from jsonb_array_elements(v_o.diff -> 'guncellenecek')
  loop
    v_rec := v_kalem -> 'record';

    select * into v_onceki from public.sod_atamalari
    where tenant_id = v_o.tenant_id
      and kaynak_sistem = v_rec ->> 'source'
      and source_record_id = v_rec ->> 'sourceRecordId';

    if found then
      v_ters := v_ters || jsonb_build_object('tur', 'GUNCELLENDI', 'onceki', to_jsonb(v_onceki));

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
      where id = v_onceki.id;
      v_guncellenen := v_guncellenen + 1;
    end if;
  end loop;

  -- (3) SONA ERDİRİLECEK — fiziksel silme yok; ters seti "yeniden aç" bilir.
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
      v_ters := v_ters || jsonb_build_object(
        'tur', 'SONA_ERDIRILDI',
        'kaynak_sistem', v_rec ->> 'kaynak_sistem',
        'source_record_id', v_rec ->> 'source_record_id'
      );
      v_sona_erdirilen := v_sona_erdirilen + 1;
    end if;
  end loop;

  -- (4) MANİFEST — ters değişiklik setiyle birlikte.
  insert into public.sod_import_manifestleri (
    tenant_id, onizleme_id, kaynak, mode,
    file_hash, normalized_records_hash, assignment_snapshot_hash, rule_set_version,
    manifest_hash, eklenen_sayisi, guncellenen_sayisi, sona_erdirilen_sayisi, uygulayan,
    ters_degisiklik
  ) values (
    v_o.tenant_id, v_o.id, v_o.kaynak, v_o.mode,
    v_o.file_hash, v_o.normalized_records_hash, v_o.assignment_snapshot_hash, v_o.rule_set_version,
    p_manifest_hash, v_eklenen, v_guncellenen, v_sona_erdirilen, p_actor,
    v_ters
  )
  returning id into v_manifest_id;

  -- (5) OUTBOX — apply ile AYNI transaction'da.
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

-- ============================================================================
-- 3. Rollback talepleri — maker-checker
-- ============================================================================
create table public.sod_import_rollbacklari (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  manifest_id uuid not null references public.sod_import_manifestleri (id) on delete restrict,
  gerekce text not null,
  talep_eden uuid not null references public.profiles (id) on delete set null,
  onaylayan uuid references public.profiles (id) on delete set null,
  karar_notu text,
  durum text not null default 'TALEP_EDILDI'
    check (durum in ('TALEP_EDILDI', 'REDDEDILDI', 'UYGULANDI')),
  uygulandi_at timestamptz,
  created_at timestamptz not null default now()
);

-- Bir manifest için aynı anda tek AKTİF talep / tek uygulanmış rollback.
-- REDDEDİLEN talep yeni talebe engel değildir (partial index onları dışlar).
create unique index sod_import_rollbacklari_manifest_aktif_idx
  on public.sod_import_rollbacklari (manifest_id)
  where durum <> 'REDDEDILDI';

create index sod_import_rollbacklari_tenant_idx
  on public.sod_import_rollbacklari (tenant_id, created_at desc);

alter table public.sod_import_rollbacklari enable row level security;

create policy sod_import_rollbacklari_select on public.sod_import_rollbacklari
  for select using (tenant_id = public.current_tenant_id());
-- Talep, talep edenin KENDİ kimliğiyle açılır (RLS bunu da zorlar) — audit
-- atfı ve maker-checker'ın "maker"ı DB'de sabitlenir.
create policy sod_import_rollbacklari_insert on public.sod_import_rollbacklari
  for insert with check (
    tenant_id = public.current_tenant_id() and talep_eden = auth.uid()
  );

-- Kararlar (REDDEDILDI/UYGULANDI) istemciden yazılamaz: UPDATE/DELETE yalnız
-- service yolu (route karar rotası + geri-al RPC'si). Guard aşağıda ayrıca
-- service_role'ü de bağlar.
revoke update, delete on public.sod_import_rollbacklari from authenticated, anon;

/**
 * MAKER-CHECKER GUARD (kurucu talimatı: uygulayan kendi rollback'ini
 * onaylayamaz). Service_role bile atlayamaz — istisna onay guard'ıyla aynı
 * disiplin:
 *   - karara (REDDEDILDI/UYGULANDI) geçiş onaylayan İSTER ve onaylayan,
 *     talep edenden FARKLI olmalı;
 *   - karar verilmiş kayıt DEĞİŞMEZ (idempotency: ikinci karar/ikinci
 *     uygulama yolu kapalı);
 *   - talep kimliği (manifest/talep_eden/tenant) sonradan oynanamaz.
 */
create or replace function public.sod_import_rollback_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.durum <> 'TALEP_EDILDI' then
    raise exception 'Karar verilmis rollback kaydi degistirilemez (%)', old.durum;
  end if;
  if new.manifest_id is distinct from old.manifest_id
     or new.talep_eden is distinct from old.talep_eden
     or new.tenant_id is distinct from old.tenant_id then
    raise exception 'Rollback talebinin kimlik alanlari degistirilemez';
  end if;
  if new.durum in ('REDDEDILDI', 'UYGULANDI') then
    if new.onaylayan is null then
      raise exception 'Rollback karari onaylayan olmadan verilemez';
    end if;
    if new.onaylayan = new.talep_eden then
      raise exception 'Talep eden kendi rollback''ini karara baglayamaz (maker-checker)';
    end if;
  end if;
  return new;
end;
$$;

create trigger sod_import_rollback_guard_before_update
  before update on public.sod_import_rollbacklari
  for each row execute function public.sod_import_rollback_guard();

-- ============================================================================
-- 4. ATOMİK GERİ ALMA — sod_import_geri_al()
-- ============================================================================
-- Tek transaction'da: talep kilidi → ters seti uygula → outbox → UYGULANDI.
-- Fiziksel silme YOK (yukarıdaki ilke 1).
create or replace function public.sod_import_geri_al(
  p_rollback_id uuid,
  p_actor uuid,
  p_karar_notu text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_r record;
  v_m record;
  v_kalem jsonb;
  v_onceki jsonb;
  v_sona_erdirilen integer := 0;
  v_geri_yuklenen integer := 0;
  v_yeniden_acilan integer := 0;
begin
  select * into v_r
  from public.sod_import_rollbacklari
  where id = p_rollback_id
  for update;

  if not found then
    raise exception 'ROLLBACK_TALEBI_YOK' using errcode = 'P0002';
  end if;
  if v_r.durum <> 'TALEP_EDILDI' then
    raise exception 'ROLLBACK_UYGULANAMAZ: durum %', v_r.durum using errcode = 'P0001';
  end if;
  -- Guard trigger'ı da zorlar; erken ve anlaşılır hata için burada da.
  if p_actor = v_r.talep_eden then
    raise exception 'Talep eden kendi rollback''ini uygulayamaz (maker-checker)' using errcode = 'P0001';
  end if;

  select * into v_m
  from public.sod_import_manifestleri
  where id = v_r.manifest_id
  for update;

  if v_m.ters_degisiklik is null then
    raise exception 'ROLLBACK_DESTEKLENMIYOR: manifest ters degisiklik seti tasimiyor (legacy)' using errcode = 'P0001';
  end if;

  for v_kalem in select * from jsonb_array_elements(v_m.ters_degisiklik)
  loop
    if v_kalem ->> 'tur' = 'EKLENDI' then
      -- Eklenen atama SİLİNMEZ, sona erdirilir.
      update public.sod_atamalari set
        gecerlilik_bitis = current_date,
        son_senkron_at = now()
      where tenant_id = v_r.tenant_id
        and kaynak_sistem = v_kalem ->> 'kaynak_sistem'
        and source_record_id = v_kalem ->> 'source_record_id'
        and gecerlilik_bitis is null;
      if found then
        v_sona_erdirilen := v_sona_erdirilen + 1;
      end if;

    elsif v_kalem ->> 'tur' = 'GUNCELLENDI' then
      v_onceki := v_kalem -> 'onceki';
      update public.sod_atamalari set
        aktivite_kodu = v_onceki ->> 'aktivite_kodu',
        rol_kodu = v_onceki ->> 'rol_kodu',
        sistem_kapsami = v_onceki ->> 'sistem_kapsami',
        gecerlilik_baslangic = (v_onceki ->> 'gecerlilik_baslangic')::date,
        gecerlilik_bitis = (v_onceki ->> 'gecerlilik_bitis')::date,
        subject_type = v_onceki ->> 'subject_type',
        display_name = v_onceki ->> 'display_name',
        email = v_onceki ->> 'email',
        son_senkron_at = now()
      where tenant_id = v_r.tenant_id
        and kaynak_sistem = v_onceki ->> 'kaynak_sistem'
        and source_record_id = v_onceki ->> 'source_record_id';
      if found then
        v_geri_yuklenen := v_geri_yuklenen + 1;
      end if;

    elsif v_kalem ->> 'tur' = 'SONA_ERDIRILDI' then
      -- Apply'ın sona erdirdiği atama yeniden açılır.
      update public.sod_atamalari set
        gecerlilik_bitis = null,
        son_senkron_at = now()
      where tenant_id = v_r.tenant_id
        and kaynak_sistem = v_kalem ->> 'kaynak_sistem'
        and source_record_id = v_kalem ->> 'source_record_id';
      if found then
        v_yeniden_acilan := v_yeniden_acilan + 1;
      end if;
    end if;
  end loop;

  -- Outbox: rollback sonrası da SoD yeniden değerlendirilmeli (aynı tx).
  insert into public.sod_outbox (tenant_id, event_type, payload)
  values (
    v_r.tenant_id, 'SOD_ATAMALARI_ROLLBACK_EDILDI',
    jsonb_build_object(
      'rollback_id', v_r.id,
      'manifest_id', v_r.manifest_id,
      'sona_erdirilen', v_sona_erdirilen,
      'geri_yuklenen', v_geri_yuklenen,
      'yeniden_acilan', v_yeniden_acilan
    )
  );

  update public.sod_import_rollbacklari set
    durum = 'UYGULANDI',
    onaylayan = p_actor,
    karar_notu = p_karar_notu,
    uygulandi_at = now()
  where id = v_r.id;

  return jsonb_build_object(
    'sona_erdirilen', v_sona_erdirilen,
    'geri_yuklenen', v_geri_yuklenen,
    'yeniden_acilan', v_yeniden_acilan
  );
end;
$$;

revoke execute on function public.sod_import_geri_al(uuid, uuid, text)
  from public, authenticated, anon;

-- ============================================================================
-- 5. Denetim izi
-- ============================================================================
-- gerekce/karar_notu İÇERİĞİ yazılmaz (kural 7) — yalnız kim/hangi manifest/durum.
create or replace function public.audit_sod_import_rollback()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
    values (
      new.tenant_id, new.talep_eden, 'sod_import_rollback_talep_edildi',
      'sod_import_rollbacklari', new.id,
      jsonb_build_object('manifest_id', new.manifest_id)
    );
    return new;
  end if;

  if new.durum is distinct from old.durum then
    insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
    values (
      new.tenant_id, new.onaylayan, 'sod_import_rollback_karari',
      'sod_import_rollbacklari', new.id,
      jsonb_build_object('manifest_id', new.manifest_id, 'onceki', old.durum, 'durum', new.durum)
    );
  end if;
  return new;
end;
$$;

create trigger audit_sod_import_rollback_after_insert
  after insert on public.sod_import_rollbacklari
  for each row execute function public.audit_sod_import_rollback();
create trigger audit_sod_import_rollback_after_update
  after update on public.sod_import_rollbacklari
  for each row execute function public.audit_sod_import_rollback();
