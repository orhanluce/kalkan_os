-- 37 Tez Dikey B, Faz 3 ilk dilim (20 Temmuz 2026, docs/adr/PR0-37-tez-
-- dikeyB-faz3-export-2026-07-20.md): DORA RoI export motoru — sealed
-- snapshot + maker-checker yayın onayı.
--
-- ALTI-DURUMLU dogrulama_durumu SÖZLÜĞÜ BURADA KULLANILMADI (bilinçli):
-- export onayı "bu içerik regülasyon olarak doğrulandı mı" sorusuna değil
-- "bu export denetçiye gösterilsin mi" sorusuna cevap verir — SoD import
-- rollback'in maker-checker ailesiyle AYNI KAVRAM (talep_eden/onaylayan).
--
-- GUARD BAŞTAN DOĞRU YAZILDI (ders: sod_import_rollbacklari'nın guard'ı
-- yalnız `before update` tetikleniyor, INSERT-anı hiç kontrol edilmiyor —
-- bu ayrı bir görev olarak işaretlendi, BURADA tekrarlanmadı): trigger
-- `before insert or update`, INSERT dalı yalnız TASLAK'a izin verir.

create table public.roi_export_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  talep_eden uuid not null references public.profiles (id) on delete set null,

  -- Mühürlü içerik (audit_worm_exports deseni): INSERT anında donar, bir
  -- daha DEĞİŞMEZ. paket = roiSablonSatirlariUret() çıktısı; paket_hash =
  -- RFC 8785 canonicalHash (src/lib/canonical.ts, ikinci hash şeması YOK).
  paket jsonb not null,
  paket_hash text not null check (paket_hash ~ '^[0-9a-f]{64}$'),
  on_kontrol_raporu jsonb not null,
  engelleyici_sorun_sayisi integer not null default 0 check (engelleyici_sorun_sayisi >= 0),
  format text not null default 'json' check (format in ('json')),

  durum text not null default 'TASLAK'
    check (durum in ('TASLAK', 'ONAY_TALEP_EDILDI', 'YAYINLANDI', 'REDDEDILDI')),
  onaylayan uuid references public.profiles (id) on delete set null,
  onay_zamani timestamptz,
  red_notu text,

  created_at timestamptz not null default now()
);

create index roi_export_runs_tenant_idx on public.roi_export_runs (tenant_id, created_at desc);

/**
 * MAKER-CHECKER GUARD (SoD import rollback ailesinin aynısı, INSERT-anı
 * kapatılarak BAŞTAN doğru yazıldı):
 *   - INSERT: yalnız TASLAK doğabilir (ONAY_TALEP_EDILDI/YAYINLANDI/
 *     REDDEDILDI doğrudan INSERT'te REDDEDİLİR).
 *   - TASLAK -> ONAY_TALEP_EDILDI: engelleyici_sorun_sayisi = 0 DEĞİLSE
 *     reddedilir (export öncesi engelleme, kurucu talimatı).
 *   - ONAY_TALEP_EDILDI -> YAYINLANDI/REDDEDILDI: onaylayan zorunlu,
 *     onaylayan <> talep_eden zorunlu (dört-göz/maker-checker).
 *   - YAYINLANDI/REDDEDILDI TERMİNAL: bir daha değişmez.
 *   - İçerik alanları (paket/paket_hash/on_kontrol_raporu/talep_eden/
 *     tenant_id) her zaman donuk.
 */
create or replace function public.roi_export_run_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    if new.durum <> 'TASLAK' then
      raise exception 'roi_export_runs INSERT anında yalniz TASLAK doganabilir (dort goz/maker-checker INSERT-bypass korumasi)';
    end if;
    return new;
  end if;

  if old.durum in ('YAYINLANDI', 'REDDEDILDI') then
    raise exception 'Karara baglanmis export kaydi degistirilemez (%)', old.durum;
  end if;

  if new.paket is distinct from old.paket
    or new.paket_hash is distinct from old.paket_hash
    or new.on_kontrol_raporu is distinct from old.on_kontrol_raporu
    or new.talep_eden is distinct from old.talep_eden
    or new.tenant_id is distinct from old.tenant_id then
    raise exception 'Muhurlenmis export icerigi (paket/hash/on-kontrol/talep_eden) degistirilemez';
  end if;

  if new.durum = 'ONAY_TALEP_EDILDI' and old.durum = 'TASLAK' then
    if new.engelleyici_sorun_sayisi > 0 then
      raise exception 'Engelleyici sorun (%) varken onay talebi acilamaz (export oncesi engelleme, kural 3)', new.engelleyici_sorun_sayisi;
    end if;
  end if;

  if new.durum in ('YAYINLANDI', 'REDDEDILDI') then
    if old.durum <> 'ONAY_TALEP_EDILDI' then
      raise exception 'YAYINLANDI/REDDEDILDI yalniz ONAY_TALEP_EDILDI uzerinden verilebilir';
    end if;
    if new.onaylayan is null or new.onay_zamani is null then
      raise exception 'Karar onaylayan ve onay_zamani olmadan verilemez';
    end if;
    if new.onaylayan = new.talep_eden then
      raise exception 'Talep eden kendi export talebini karara baglayamaz (maker-checker)';
    end if;
  end if;

  return new;
end;
$$;

create trigger roi_export_run_guard_trg
  before insert or update on public.roi_export_runs
  for each row execute function public.roi_export_run_guard();

/** Kimlik atfı: talep_eden istemci bağlamında oturum sahibine sabitlenir. */
create or replace function public.roi_export_run_talep_atif_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' and auth.uid() is not null then
    new.talep_eden := auth.uid();
  end if;
  return new;
end;
$$;

create trigger roi_export_run_talep_atif_guard_trg
  before insert on public.roi_export_runs
  for each row execute function public.roi_export_run_talep_atif_guard();

-- --- Audit: oluşturma + durum değişimi ---
create or replace function public.audit_roi_export_run()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
    values (new.tenant_id, auth.uid(), 'roi_export_olusturuldu', 'roi_export_runs', new.id,
      jsonb_build_object('engelleyici_sorun_sayisi', new.engelleyici_sorun_sayisi, 'paket_hash', new.paket_hash));
    return new;
  end if;
  if new.durum is distinct from old.durum then
    insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
    values (new.tenant_id, auth.uid(), 'roi_export_durum_degisti', 'roi_export_runs', new.id,
      jsonb_build_object('durum_onceki', old.durum, 'durum', new.durum));
  end if;
  return new;
end;
$$;

create trigger audit_roi_export_run_insert after insert on public.roi_export_runs
  for each row execute function public.audit_roi_export_run();
create trigger audit_roi_export_run_update after update on public.roi_export_runs
  for each row execute function public.audit_roi_export_run();

-- --- RLS: tenant-scoped, admin/uyum select+insert+update (guard geçişleri kilitliyor) ---
alter table public.roi_export_runs enable row level security;

create policy roi_export_runs_select on public.roi_export_runs
  for select using (tenant_id = public.current_tenant_id());
create policy roi_export_runs_insert on public.roi_export_runs
  for insert with check (
    tenant_id = public.current_tenant_id() and public.current_user_role() in ('admin', 'uyum')
  );
create policy roi_export_runs_update on public.roi_export_runs
  for update using (
    tenant_id = public.current_tenant_id() and public.current_user_role() in ('admin', 'uyum')
  )
  with check (tenant_id = public.current_tenant_id());

-- =====================================================================
-- Proof Room bağlantısı — GENİŞLETME, yeni paylaşım mekanizması YOK
-- (rota kablolanması bu dilimin kapsamı DIŞINDA — ADR §4/§5)
-- =====================================================================
alter table public.proof_room_links
  alter column test_run_id drop not null,
  add column roi_export_run_id uuid references public.roi_export_runs (id) on delete cascade,
  add constraint proof_room_links_tek_hedef check (
    (test_run_id is not null and roi_export_run_id is null)
    or (test_run_id is null and roi_export_run_id is not null)
  );

create index proof_room_links_roi_export_idx on public.proof_room_links (roi_export_run_id) where roi_export_run_id is not null;
