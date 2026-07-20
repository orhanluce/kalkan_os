-- 37 Tez Dikey B, Faz 4 (20 Temmuz 2026, docs/adr/PR0-37-tez-dikeyB-faz4-
-- kanit-zinciri-2026-07-20.md): DORA RoI export alanları için kanıt zinciri.
--
-- YENİ İLİŞKİSEL MODEL YOK (ADR §1): provenance, export ÜRETİLİRKEN saf bir
-- fonksiyonun (src/lib/roi-export-provenance.ts) mevcut roi_kaynak_kayitlari
-- + ict_service_types + assurance_claims'ten hesapladığı TÜRETİLMİŞ ve
-- MÜHÜRLENMİŞ bir görünümdür — `on_kontrol_raporu` (Faz 3) ile AYNI desen.
--
-- FORWARD-FIX DİSİPLİNİ (ADR §0 grep sweep, kural: yalnız ilk migration
-- değil GÜNCEL hali temel al): `roi_export_run_guard()` yalnız 20260720130000
-- tarafından tanımlandı, sonraki hiçbir migration dokunmadı (grep -rl
-- doğrulandı) — bu migration o GÜNCEL (ve zaten INSERT-anı doğru yazılmış)
-- sürümü temel alıyor.

-- =====================================================================
-- 1) Mühürlü provenance alanları — NULLABLE (kural 15'in AYNI ilkesi:
--    zarfsız/provenance'sız ESKİ export satırı LEGACY kalır, uydurulmaz;
--    Faz 4 sonrası TÜM yeni export'lar route seviyesinde doldurur).
-- =====================================================================
alter table public.roi_export_runs
  add column provenance_raporu jsonb,
  add column provenance_hash text check (provenance_hash is null or provenance_hash ~ '^[0-9a-f]{64}$'),
  add column yeniden_inceleme_gerekli boolean not null default false,
  add column yeniden_inceleme_nedeni text;

create index roi_export_runs_inceleme_idx on public.roi_export_runs (tenant_id, yeniden_inceleme_gerekli) where yeniden_inceleme_gerekli;

-- =====================================================================
-- 2) Guard forward-fix: provenance_raporu/provenance_hash de MÜHÜRLÜ
--    içerik listesine eklendi; TERMİNAL durum artık TAMAMEN kilitli değil
--    — yeniden_inceleme_gerekli/nedeni İSTİSNASI (assurance_claims'in AYNI
--    ilkesi: DB guard geçmiş karari SİLMEZ, yalnız işaretler; §4).
-- =====================================================================
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
    if new.durum is distinct from old.durum
      or new.paket is distinct from old.paket
      or new.paket_hash is distinct from old.paket_hash
      or new.on_kontrol_raporu is distinct from old.on_kontrol_raporu
      or new.provenance_raporu is distinct from old.provenance_raporu
      or new.provenance_hash is distinct from old.provenance_hash
      or new.talep_eden is distinct from old.talep_eden
      or new.tenant_id is distinct from old.tenant_id
      or new.onaylayan is distinct from old.onaylayan
      or new.onay_zamani is distinct from old.onay_zamani
      or new.red_notu is distinct from old.red_notu
      or new.engelleyici_sorun_sayisi is distinct from old.engelleyici_sorun_sayisi
      or new.format is distinct from old.format
    then
      raise exception 'Karara baglanmis export kaydi degistirilemez (%)', old.durum;
    end if;
    -- Buraya yalniz yeniden_inceleme_gerekli/nedeni degisimiyle ulasilir.
    return new;
  end if;

  if new.paket is distinct from old.paket
    or new.paket_hash is distinct from old.paket_hash
    or new.on_kontrol_raporu is distinct from old.on_kontrol_raporu
    or new.provenance_raporu is distinct from old.provenance_raporu
    or new.provenance_hash is distinct from old.provenance_hash
    or new.talep_eden is distinct from old.talep_eden
    or new.tenant_id is distinct from old.tenant_id then
    raise exception 'Muhurlenmis export icerigi (paket/hash/on-kontrol/provenance/talep_eden) degistirilemez';
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

-- =====================================================================
-- 3) SCITT/şeffaflık defteri — MEVCUT mekanizma genişletildi, yeni desen
--    YOK (20260719170000'in BİREBİR AFTER UPDATE WHEN deseni, ADR §3).
--    HAM İÇERİK DEFTERE GİRMEZ: statement_kind + artefakt referansı.
-- =====================================================================
create trigger roi_export_runs_ledger_outbox_enqueue
  after update on public.roi_export_runs
  for each row
  when (new.durum = 'YAYINLANDI' and old.durum is distinct from 'YAYINLANDI')
  execute function public.ledger_outbox_enqueue_trg('ROI_EXPORT_PUBLISHED');

-- =====================================================================
-- 4) Yeniden inceleme cron — assurance_claims'in AYNI deseni. YAYINLANDI
--    export'un MÜHÜRLENEN provenance_raporu.izlenenler'inde kayıtlı GERÇEK
--    kaynak/iddia kimlikleri (motor tarafından üretildi, TAHMİN EDİLMEDİ)
--    ile bugünkü canlı durumu karşılaştırır. Durum GERİYE DÖNÜK
--    DEĞİŞTİRİLMEZ — yalnız bayrak.
-- =====================================================================
create or replace function public.roi_export_runs_yeniden_inceleme_isle()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_export record;
  v_dusmus boolean;
  v_nedeni text;
begin
  for v_export in
    select id, tenant_id, provenance_raporu
    from public.roi_export_runs
    where durum = 'YAYINLANDI'
      and yeniden_inceleme_gerekli = false
      and provenance_raporu is not null
    for update skip locked
  loop
    begin
      v_dusmus := false;
      v_nedeni := null;

      if exists (
        select 1 from public.assurance_claims c
        where c.id in (
          select jsonb_array_elements_text(v_export.provenance_raporu -> 'izlenenler' -> 'iddiaIdleri')
        )
        and (c.dogrulama_durumu in ('SUPERSEDED', 'REJECTED') or c.yeniden_inceleme_gerekli = true)
      ) then
        v_dusmus := true;
        v_nedeni := 'Iliskili iddia sonradan SUPERSEDED/REJECTED oldu veya yeniden incelemeye alindi';
      end if;

      if not v_dusmus and exists (
        select 1 from public.roi_kaynak_kayitlari k
        join jsonb_to_recordset(v_export.provenance_raporu -> 'izlenenler' -> 'roiKaynaklari')
          as ref(sablonKodu text, alanKodu text) on true
        where k.sablon_kodu = ref."sablonKodu"
          and k.alan_kodu is not distinct from ref."alanKodu"
          and k.dogrulama_durumu in ('SUPERSEDED', 'REJECTED')
      ) then
        v_dusmus := true;
        v_nedeni := 'Dayanilan roi_kaynak_kayitlari satiri sonradan SUPERSEDED/REJECTED oldu';
      end if;

      if not v_dusmus and exists (
        select 1 from public.ict_service_types t
        where t.kod in (
          select jsonb_array_elements_text(v_export.provenance_raporu -> 'izlenenler' -> 'ictHizmetKodlari')
        )
        and t.dogrulama_durumu in ('SUPERSEDED', 'REJECTED')
      ) then
        v_dusmus := true;
        v_nedeni := 'Dayanilan ICT hizmet turu sonradan SUPERSEDED/REJECTED oldu';
      end if;

      if v_dusmus then
        update public.roi_export_runs
          set yeniden_inceleme_gerekli = true, yeniden_inceleme_nedeni = v_nedeni
          where id = v_export.id;
        insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
        values (v_export.tenant_id, null, 'roi_export_yeniden_inceleme_kuyruguna_alindi', 'roi_export_runs', v_export.id,
          jsonb_build_object('nedeni', v_nedeni));
      end if;
    exception when others then
      raise notice 'roi_export_runs_yeniden_inceleme_isle: % icin hata: %', v_export.id, sqlerrm;
    end;
  end loop;
end;
$$;

revoke execute on function public.roi_export_runs_yeniden_inceleme_isle() from authenticated, anon;

do $$
begin
  perform cron.schedule('kalkan-roi-export-yeniden-inceleme', '0 5 * * *', 'select public.roi_export_runs_yeniden_inceleme_isle();');
exception when others then
  raise notice 'pg_cron schedule atlandi (PGlite/local ortam): %', sqlerrm;
end;
$$;
