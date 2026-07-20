-- Dikey F, F1 (docs/adr/PR0-dikeyF-f1-test-manifesti-kritik-hizmet-retest-
-- 2026-07-20.md §7): findings kapanışına BAĞIMSIZLIK kontrolü — öneriyi
-- KABUL eden kişi kendi bulgusunu doğrulanmış biçimde kapatamaz.
--
-- FORWARD-FIX: 20260717240000_control_test_findings.sql'deki
-- finding_verified_closure_guard()'ın TAMAMI temel alınıp create or replace
-- edildi (grep doğrulandı — bu fonksiyon o tarihten beri hiç değişmedi,
-- başka forward-fix yok). Eski migration dosyasına DOKUNULMADI. Mevcut BEŞ
-- kontrol (retest gerekli/dolu + kapatan dolu + PASSED + doğru test tanımı +
-- bulgudan sonra) AYNEN korunuyor, yalnız ALTINCI kontrol EKLENİYOR.
--
-- İLİŞKİ YALNIZ kaynak='kontrol_testi' VE eşleşen bir öneri VARSA uygulanır —
-- diğer kaynaklarda (sizma_testi/denetim/ic_tespit/simulasyon) "öneriyi
-- kabul eden" kavramı YOK; guard onları SESSİZCE atlar, sahte bir kısıtlama
-- İCAT ETMEZ (kurucunun kendi "tahmin yapma" ilkesi).

create or replace function public.finding_verified_closure_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run record;
  v_karar_veren uuid;
begin
  if old.durum = 'acik' and new.durum = 'kapali' then
    if new.retest_gerekli then
      if new.kapatma_retest_run_id is null then
        raise exception 'Bulgu kapatilamaz: retest gerekli ama basarili retest kosusu baglanmamis (kural 14)';
      end if;
      if new.kapatan is null then
        raise exception 'Bulgu kapatilamaz: kapatmayi onaylayan yetkili yok (kural 14)';
      end if;

      select r.sonuc, r.test_definition_id, r.calisti_at into v_run
      from public.test_runs r where r.id = new.kapatma_retest_run_id;

      if v_run is null then
        raise exception 'Retest kosusu bulunamadi';
      end if;
      if v_run.sonuc is distinct from 'PASSED' then
        raise exception 'Bulgu kapatilamaz: baglanan retest PASSED degil (%). Basarisiz/bilinmeyen retest kapatmaz (kural 14)', v_run.sonuc;
      end if;
      if new.kaynak_test_definition_id is not null
         and v_run.test_definition_id is distinct from new.kaynak_test_definition_id then
        raise exception 'Bulgu kapatilamaz: retest baska bir test tanimina ait (kural 14)';
      end if;
      if v_run.calisti_at <= old.created_at then
        raise exception 'Bulgu kapatilamaz: retest bulgudan ONCE kosmus; kapanis icin bulgudan sonra basarili retest gerekir (kural 14)';
      end if;

      -- YENİ (F1): bağımsızlık — öneriyi KABUL eden kişi kendi bulgusunu
      -- kapatamaz. Yalnız kontrol testinden doğan VE eşleşen bir öneri kaydı
      -- olan bulgularda anlamlıdır; diğer kaynaklarda bu ilişki yoktur ve
      -- guard onları etkilemez.
      select p.karar_veren into v_karar_veren
      from public.control_test_finding_proposals p
      where p.finding_id = new.id;

      if v_karar_veren is not null and new.kapatan is distinct from null and new.kapatan = v_karar_veren then
        raise exception 'Bulgu kapatilamaz: oneriyi kabul eden kisi kendi bulgusunu kapatamaz (bagimsizlik/dort goz)';
      end if;
    end if;
  end if;

  return new;
end;
$$;
