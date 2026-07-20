-- Forward-fix: 20260720170000'in roi_export_runs_yeniden_inceleme_isle()
-- fonksiyonu assurance_claims.id (uuid) ile jsonb_array_elements_text
-- çıktısını (text) örtük karşılaştırmaya çalışıyordu — Postgres 42883
-- "operator does not exist: uuid = text" ile patlıyordu (PGlite testinde
-- exception-yutan try/catch bunu SESSİZCE yutuyordu, testler false/false
-- görüp "kaynak düşmedi" sanıyordu — DERS: bir cron/otomasyon fonksiyonunun
-- exception-yutma davranışı testte "hata yok" ile "iş yapıldı"yı
-- ayırt edilemez kılabilir; debug için exception-yutmasız bir kopya
-- kullanılarak gerçek hata (42883) yakalandı).
--
-- İKİNCİ hata (aynı testte ardışık yakalandı): jsonb_to_recordset'in ALIAS
-- listesinde `ref(sablonKodu text, ...)` TIRNAKSIZ yazılmıştı — Postgres
-- tanımlayıcıları küçük harfe çevirir (sablonKodu -> sablonkodu), ama WHERE
-- yan tümcesindeki `ref."sablonKodu"` TIRNAKLI (case-sensitive) referans
-- veriyordu — 42703 "column ref.sablonKodu does not exist". Alias listesi de
-- tırnaklı yazıldı (`ref("sablonKodu" text, ...)`), ikisi artık eşleşiyor.
--
-- Yalnız iddiaIdleri karşılaştırmasına ::uuid cast eklendi — ictHizmetKodlari
-- (kod: text) zaten doğru tipteydi, DOKUNULMADI.

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
          select jsonb_array_elements_text(v_export.provenance_raporu -> 'izlenenler' -> 'iddiaIdleri')::uuid
        )
        and (c.dogrulama_durumu in ('SUPERSEDED', 'REJECTED') or c.yeniden_inceleme_gerekli = true)
      ) then
        v_dusmus := true;
        v_nedeni := 'Iliskili iddia sonradan SUPERSEDED/REJECTED oldu veya yeniden incelemeye alindi';
      end if;

      if not v_dusmus and exists (
        select 1 from public.roi_kaynak_kayitlari k
        join jsonb_to_recordset(v_export.provenance_raporu -> 'izlenenler' -> 'roiKaynaklari')
          as ref("sablonKodu" text, "alanKodu" text) on true
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
