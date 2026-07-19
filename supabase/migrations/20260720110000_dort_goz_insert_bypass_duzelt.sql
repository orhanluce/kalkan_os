-- Forward-fix: SİSTEMİK dört-göz INSERT-anı bypass'ı, beş fonksiyonda birden
-- (obligation_dogrulama_guard, roi_kaynak_dogrulama_guard,
-- assurance_claim_dogrulama_guard, resilience_dogrulama_guard,
-- crosswalk_dogrulama_guard — hepsi AYNI kopyalanan desenden türedi).
--
-- BULGU (20 Temmuz, ict_service_types için YENİ bir kopya yazılırken
-- fark edildi): guard'ın INSERT dalı yalnız dogrulama_durumu='VERIFIED'i
-- reddediyordu. Bir kayıt DOĞRUDAN dogrulama_durumu='LEGAL_REVIEW' ile
-- INSERT edilirse (incelemeye_alan/incelemeye_alinma_zamani NULL bırakılarak)
-- UPDATE-yolundaki "incelemeye_alan ve zaman zorunlu" kontrolü hiç
-- ÇALIŞMIYORDU (old.dogrulama_durumu is distinct from 'LEGAL_REVIEW' şartı
-- INSERT'te old=NULL olduğu için true, ama bu kontrol yalnız UPDATE dalında
-- yaşıyor). Sonuç: aynı kişi (a) satırı LEGAL_REVIEW olarak insert eder
-- (incelemeye_alan=NULL), (b) hemen ardından kendisini dogrulayan yaparak
-- VERIFIED'e taşır — `new.dogrulayan = new.incelemeye_alan` karşılaştırması
-- `x = NULL` olduğundan SQL'de NULL (yani FALSE değil) döner ve guard'ın
-- IF'i bunu "eşit değil" sayıp GEÇİRİR. Yani TEK KİŞİ, gerçek bir ikinci
-- incelemeci olmadan bir kaydı VERIFIED'e taşıyabiliyordu — dört-göz'ün
-- (kural 14, M21) kendisini bypass eden bir açık.
--
-- Etki alanı: obligations/obligation_control_mappings, roi_kaynak_kayitlari,
-- assurance_claims, control_resilience_domains, iso_42001_27001_crosswalk.
-- (ict_service_types migration'ı henüz şiplenmemişti, doğrudan düzeltildi —
-- 20260720100000.) Mevcut PGlite testlerinin HİÇBİRİ bunu yakalamadı çünkü
-- hepsi UPDATE-yoluyla (TODO_DOGRULA→LEGAL_REVIEW→VERIFIED) test ediyordu;
-- yalnız rls-dora-roi-kimlik.test.ts'in "LEGAL_REVIEW → VERIFIED atıfla
-- geçer" testi kazara İNSERT-anı LEGAL_REVIEW kullanıyordu ve bu düzeltmeyle
-- artık (doğru biçimde) reddedilecek — test bu migration'la birlikte
-- güncellendi.
--
-- Şiplenmiş migration'lar DEĞİŞTİRİLMEZ — bu FORWARD-FIX, beş fonksiyonu
-- CREATE OR REPLACE ile günceller (tablo şeması değişmiyor).

create or replace function public.obligation_dogrulama_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    if new.dogrulama_durumu = 'VERIFIED' then
      raise exception 'kayit VERIFIED dogamaz: dogrulama yalniz incelemeyle kazanilir (kural 3)';
    end if;
    if new.dogrulama_durumu = 'REJECTED' then
      raise exception 'kayit REJECTED dogamaz: red karari yalniz LEGAL_REVIEW uzerinden verilebilir';
    end if;
    if new.dogrulama_durumu = 'LEGAL_REVIEW' and (new.incelemeye_alan is null or new.incelemeye_alinma_zamani is null) then
      raise exception 'LEGAL_REVIEW gecisi incelemeye_alan ve zaman olmadan yapilamaz (dort goz)';
    end if;
    return new;
  end if;

  if new.dogrulama_durumu = 'LEGAL_REVIEW' and old.dogrulama_durumu is distinct from 'LEGAL_REVIEW' then
    if new.incelemeye_alan is null or new.incelemeye_alinma_zamani is null then
      raise exception 'LEGAL_REVIEW gecisi incelemeye_alan ve zaman olmadan yapilamaz (dort goz)';
    end if;
  end if;

  if new.dogrulama_durumu = 'VERIFIED' and old.dogrulama_durumu is distinct from 'VERIFIED' then
    if old.dogrulama_durumu is distinct from 'LEGAL_REVIEW' then
      raise exception 'VERIFIED gecisi yalniz LEGAL_REVIEW uzerinden yapilabilir (kural 3)';
    end if;
    if new.dogrulayan is null or new.dogrulama_zamani is null then
      raise exception 'VERIFIED gecisi dogrulayan ve dogrulama_zamani olmadan yapilamaz (kural 3)';
    end if;
    if new.dogrulayan = new.incelemeye_alan then
      raise exception 'Incelemeye alan kendi sunumunu dogrulayamaz (dort goz, M21)';
    end if;
  end if;

  if new.dogrulama_durumu = 'REJECTED' and old.dogrulama_durumu is distinct from 'REJECTED' then
    if old.dogrulama_durumu is distinct from 'LEGAL_REVIEW' then
      raise exception 'REJECTED karari yalniz LEGAL_REVIEW uzerinden verilebilir';
    end if;
    if new.dogrulayan is null then
      raise exception 'REJECTED karari karar sahibi (dogrulayan) olmadan yazilamaz';
    end if;
  end if;

  if old.dogrulama_durumu = 'VERIFIED' and new.dogrulama_durumu = 'VERIFIED' then
    if TG_TABLE_NAME = 'obligations' then
      if new.kod is distinct from old.kod
        or new.baslik is distinct from old.baslik
        or new.amac is distinct from old.amac
        or new.nitelik is distinct from old.nitelik
        or new.provision_id is distinct from old.provision_id then
        raise exception 'VERIFIED yukumlulugun icerigi degistirilemez: once dogrulama geri alinmali';
      end if;
    else
      if new.obligation_id is distinct from old.obligation_id
        or new.control_id is distinct from old.control_id
        or new.kapsam is distinct from old.kapsam then
        raise exception 'VERIFIED eslemenin icerigi degistirilemez: once dogrulama geri alinmali';
      end if;
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.roi_kaynak_dogrulama_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    if new.dogrulama_durumu = 'VERIFIED' then
      raise exception 'kayit VERIFIED dogamaz: dogrulama yalniz incelemeyle kazanilir (kural 3)';
    end if;
    if new.dogrulama_durumu = 'REJECTED' then
      raise exception 'kayit REJECTED dogamaz: red karari yalniz LEGAL_REVIEW uzerinden verilebilir';
    end if;
    if new.dogrulama_durumu = 'LEGAL_REVIEW' and (new.incelemeye_alan is null or new.incelemeye_alinma_zamani is null) then
      raise exception 'LEGAL_REVIEW gecisi incelemeye_alan ve zaman olmadan yapilamaz (dort goz)';
    end if;
    return new;
  end if;

  if new.dogrulama_durumu = 'LEGAL_REVIEW' and old.dogrulama_durumu is distinct from 'LEGAL_REVIEW' then
    if new.incelemeye_alan is null or new.incelemeye_alinma_zamani is null then
      raise exception 'LEGAL_REVIEW gecisi incelemeye_alan ve zaman olmadan yapilamaz (dort goz)';
    end if;
  end if;

  if new.dogrulama_durumu = 'VERIFIED' and old.dogrulama_durumu is distinct from 'VERIFIED' then
    if old.dogrulama_durumu is distinct from 'LEGAL_REVIEW' then
      raise exception 'VERIFIED gecisi yalniz LEGAL_REVIEW uzerinden yapilabilir (kural 3)';
    end if;
    if new.dogrulayan is null or new.dogrulama_zamani is null then
      raise exception 'VERIFIED gecisi dogrulayan ve dogrulama_zamani olmadan yapilamaz (kural 3)';
    end if;
    if new.dogrulayan = new.incelemeye_alan then
      raise exception 'Incelemeye alan kendi sunumunu dogrulayamaz (dort goz, M21)';
    end if;
  end if;

  if new.dogrulama_durumu = 'REJECTED' and old.dogrulama_durumu is distinct from 'REJECTED' then
    if old.dogrulama_durumu is distinct from 'LEGAL_REVIEW' then
      raise exception 'REJECTED karari yalniz LEGAL_REVIEW uzerinden verilebilir';
    end if;
    if new.dogrulayan is null then
      raise exception 'REJECTED karari karar sahibi (dogrulayan) olmadan yazilamaz';
    end if;
  end if;

  if old.dogrulama_durumu = 'VERIFIED' and new.dogrulama_durumu = 'VERIFIED' then
    if new.sablon_kodu is distinct from old.sablon_kodu
      or new.alan_kodu is distinct from old.alan_kodu
      or new.alan_adi is distinct from old.alan_adi
      or new.zorunluluk_aciklamasi is distinct from old.zorunluluk_aciklamasi
      or new.kapali_kume_degerleri is distinct from old.kapali_kume_degerleri then
      raise exception 'VERIFIED RoI kaydinin icerigi degistirilemez: once dogrulama geri alinmali';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.assurance_claim_dogrulama_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kaynak_durumu text;
begin
  if TG_OP = 'INSERT' then
    if new.dogrulama_durumu = 'VERIFIED' then
      raise exception 'iddia VERIFIED dogamaz: dogrulama yalniz incelemeyle kazanilir (kural 3)';
    end if;
    if new.dogrulama_durumu = 'REJECTED' then
      raise exception 'iddia REJECTED dogamaz: red karari yalniz LEGAL_REVIEW uzerinden verilebilir';
    end if;
    if new.dogrulama_durumu = 'LEGAL_REVIEW' and (new.incelemeye_alan is null or new.incelemeye_alinma_zamani is null) then
      raise exception 'LEGAL_REVIEW gecisi incelemeye_alan ve zaman olmadan yapilamaz (dort goz)';
    end if;
    return new;
  end if;

  if new.dogrulama_durumu = 'LEGAL_REVIEW' and old.dogrulama_durumu is distinct from 'LEGAL_REVIEW' then
    if new.incelemeye_alan is null or new.incelemeye_alinma_zamani is null then
      raise exception 'LEGAL_REVIEW gecisi incelemeye_alan ve zaman olmadan yapilamaz (dort goz)';
    end if;
  end if;

  if new.dogrulama_durumu = 'VERIFIED' and old.dogrulama_durumu is distinct from 'VERIFIED' then
    if old.dogrulama_durumu is distinct from 'LEGAL_REVIEW' then
      raise exception 'VERIFIED gecisi yalniz LEGAL_REVIEW uzerinden yapilabilir (kural 3)';
    end if;
    if new.dogrulayan is null or new.dogrulama_zamani is null then
      raise exception 'VERIFIED gecisi dogrulayan ve dogrulama_zamani olmadan yapilamaz (kural 3)';
    end if;
    if new.dogrulayan = new.incelemeye_alan then
      raise exception 'Incelemeye alan kendi sunumunu dogrulayamaz (dort goz, M21)';
    end if;

    if new.kaynak_obligation_id is null then
      raise exception 'kaynaksiz iddia VERIFIED olamaz (kural 4: resmi kaynak yoksa yalniz UNVERIFIED/LEGAL_REVIEW)';
    end if;
    select dogrulama_durumu into v_kaynak_durumu from public.obligations where id = new.kaynak_obligation_id;
    if v_kaynak_durumu is distinct from 'VERIFIED' then
      raise exception 'kaynak yukumluluk VERIFIED degilken (%) iddia VERIFIED olamaz (kural 3)', v_kaynak_durumu;
    end if;

    if jsonb_array_length(new.kanit_referanslari) = 0 then
      raise exception 'kanitsiz iddia VERIFIED olamaz (kural 6)';
    end if;
  end if;

  if new.dogrulama_durumu = 'REJECTED' and old.dogrulama_durumu is distinct from 'REJECTED' then
    if old.dogrulama_durumu is distinct from 'LEGAL_REVIEW' then
      raise exception 'REJECTED karari yalniz LEGAL_REVIEW uzerinden verilebilir';
    end if;
    if new.dogrulayan is null then
      raise exception 'REJECTED karari karar sahibi (dogrulayan) olmadan yazilamaz';
    end if;
  end if;

  if old.dogrulama_durumu = 'VERIFIED' and new.dogrulama_durumu = 'VERIFIED' then
    if new.iddia_turu is distinct from old.iddia_turu
      or new.iddia_metni is distinct from old.iddia_metni
      or new.sonuc is distinct from old.sonuc
      or new.kapsam is distinct from old.kapsam
      or new.kaynak_obligation_id is distinct from old.kaynak_obligation_id
      or new.kanit_referanslari is distinct from old.kanit_referanslari then
      raise exception 'VERIFIED iddianin icerigi degistirilemez: once dogrulama geri alinmali';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.resilience_dogrulama_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    if new.dogrulama_durumu = 'VERIFIED' then
      raise exception 'kayit VERIFIED dogamaz: dogrulama yalniz incelemeyle kazanilir (kural 3)';
    end if;
    if new.dogrulama_durumu = 'REJECTED' then
      raise exception 'kayit REJECTED dogamaz: red karari yalniz LEGAL_REVIEW uzerinden verilebilir';
    end if;
    if new.dogrulama_durumu = 'LEGAL_REVIEW' and (new.incelemeye_alan is null or new.incelemeye_alinma_zamani is null) then
      raise exception 'LEGAL_REVIEW gecisi incelemeye_alan ve zaman olmadan yapilamaz (dort goz)';
    end if;
    return new;
  end if;

  if new.dogrulama_durumu = 'LEGAL_REVIEW' and old.dogrulama_durumu is distinct from 'LEGAL_REVIEW' then
    if new.incelemeye_alan is null or new.incelemeye_alinma_zamani is null then
      raise exception 'LEGAL_REVIEW gecisi incelemeye_alan ve zaman olmadan yapilamaz (dort goz)';
    end if;
  end if;

  if new.dogrulama_durumu = 'VERIFIED' and old.dogrulama_durumu is distinct from 'VERIFIED' then
    if old.dogrulama_durumu is distinct from 'LEGAL_REVIEW' then
      raise exception 'VERIFIED gecisi yalniz LEGAL_REVIEW uzerinden yapilabilir (kural 3)';
    end if;
    if new.dogrulayan is null or new.dogrulama_zamani is null then
      raise exception 'VERIFIED gecisi dogrulayan ve dogrulama_zamani olmadan yapilamaz (kural 3)';
    end if;
    if new.dogrulayan = new.incelemeye_alan then
      raise exception 'Incelemeye alan kendi sunumunu dogrulayamaz (dort goz, M21)';
    end if;
  end if;

  if new.dogrulama_durumu = 'REJECTED' and old.dogrulama_durumu is distinct from 'REJECTED' then
    if old.dogrulama_durumu is distinct from 'LEGAL_REVIEW' then
      raise exception 'REJECTED karari yalniz LEGAL_REVIEW uzerinden verilebilir';
    end if;
    if new.dogrulayan is null then
      raise exception 'REJECTED karari karar sahibi (dogrulayan) olmadan yazilamaz';
    end if;
  end if;

  if old.dogrulama_durumu = 'VERIFIED' and new.dogrulama_durumu = 'VERIFIED' then
    if new.control_id is distinct from old.control_id or new.kategori is distinct from old.kategori then
      raise exception 'VERIFIED siniflandirma degistirilemez: once dogrulama geri alinmali';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.crosswalk_dogrulama_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    if new.dogrulama_durumu = 'VERIFIED' then
      raise exception 'kayit VERIFIED dogamaz: dogrulama yalniz incelemeyle kazanilir (kural 3)';
    end if;
    if new.dogrulama_durumu = 'REJECTED' then
      raise exception 'kayit REJECTED dogamaz: red karari yalniz LEGAL_REVIEW uzerinden verilebilir';
    end if;
    if new.dogrulama_durumu = 'LEGAL_REVIEW' and (new.incelemeye_alan is null or new.incelemeye_alinma_zamani is null) then
      raise exception 'LEGAL_REVIEW gecisi incelemeye_alan ve zaman olmadan yapilamaz (dort goz)';
    end if;
    return new;
  end if;

  if new.dogrulama_durumu = 'LEGAL_REVIEW' and old.dogrulama_durumu is distinct from 'LEGAL_REVIEW' then
    if new.incelemeye_alan is null or new.incelemeye_alinma_zamani is null then
      raise exception 'LEGAL_REVIEW gecisi incelemeye_alan ve zaman olmadan yapilamaz (dort goz)';
    end if;
  end if;

  if new.dogrulama_durumu = 'VERIFIED' and old.dogrulama_durumu is distinct from 'VERIFIED' then
    if old.dogrulama_durumu is distinct from 'LEGAL_REVIEW' then
      raise exception 'VERIFIED gecisi yalniz LEGAL_REVIEW uzerinden yapilabilir (kural 3)';
    end if;
    if new.dogrulayan is null or new.dogrulama_zamani is null then
      raise exception 'VERIFIED gecisi dogrulayan ve dogrulama_zamani olmadan yapilamaz (kural 3)';
    end if;
    if new.dogrulayan = new.incelemeye_alan then
      raise exception 'Incelemeye alan kendi sunumunu dogrulayamaz (dort goz, M21)';
    end if;
  end if;

  if new.dogrulama_durumu = 'REJECTED' and old.dogrulama_durumu is distinct from 'REJECTED' then
    if old.dogrulama_durumu is distinct from 'LEGAL_REVIEW' then
      raise exception 'REJECTED karari yalniz LEGAL_REVIEW uzerinden verilebilir';
    end if;
    if new.dogrulayan is null then
      raise exception 'REJECTED karari karar sahibi (dogrulayan) olmadan yazilamaz';
    end if;
  end if;

  if old.dogrulama_durumu = 'VERIFIED' and new.dogrulama_durumu = 'VERIFIED' then
    if new.iso42001_ref is distinct from old.iso42001_ref
      or new.iso27001_ref is distinct from old.iso27001_ref
      or new.iliski_turu is distinct from old.iliski_turu then
      raise exception 'VERIFIED crosswalk kaydinin icerigi degistirilemez: once dogrulama geri alinmali';
    end if;
  end if;

  return new;
end;
$$;
