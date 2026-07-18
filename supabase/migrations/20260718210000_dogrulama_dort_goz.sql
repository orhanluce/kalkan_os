-- Dört-göz hukuk doğrulama iş akışı (QRegu PR-Q2a'; M21 "dört göz ilkesi",
-- V1 §15: VERIFIED geçişi ayrı hukuk yetkisi + audit ister).
--
-- M21 belgesi: "Tek kişi mapping hazırlayıp onaylayamaz." Mevcut guard
-- (20260718160000) VERIFIED'i LEGAL_REVIEW + dogrulayan atfına bağlıyordu ama
-- İNCELEMEYE ALAN kişiyi kaydetmiyordu — aynı kişi hem incelemeye alıp hem
-- doğrulayabilirdi (SoD M16 #9'daki "dolaylı özdeşlik" açığının hukuk-katmanı
-- karşılığı). Bu migration:
--   1. obligations + obligation_control_mappings'e inceleme atfı kolonları
--      ekler (incelemeye_alan / incelemeye_alinma_zamani);
--   2. ortak guard'ı genişletir:
--      * LEGAL_REVIEW'e geçiş inceleme atfı olmadan yapılamaz;
--      * VERIFIED'de dogrulayan ≠ incelemeye_alan (DÖRT GÖZ — service_role
--        bile atlayamaz);
--      * REJECTED yalnız LEGAL_REVIEW'den ve karar atfıyla (dogrulayan alanı
--        karar sahibini taşır — reddeden kişi kayıtsız kalamaz).
-- Rol kapısı route seviyesinde (bugün: VERIFIED/REJECTED kararı admin,
-- incelemeye alma admin/uyum — K8 hukuk-küratör rolü AÇIK KARAR, uydurulmadı).

alter table public.obligations
  add column incelemeye_alan uuid references public.profiles (id) on delete restrict,
  add column incelemeye_alinma_zamani timestamptz;

alter table public.obligation_control_mappings
  add column incelemeye_alan uuid references public.profiles (id) on delete restrict,
  add column incelemeye_alinma_zamani timestamptz;

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
    return new;
  end if;

  -- LEGAL_REVIEW'e geçiş: incelemeye alan kişi + zaman zorunlu (dört-göz
  -- zincirinin ilk halkası — kimin sunduğu kayıtsız kalamaz).
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
    -- DÖRT GÖZ: inceleme sunan kişi kendi sunumunu doğrulayamaz.
    if new.dogrulayan = new.incelemeye_alan then
      raise exception 'Incelemeye alan kendi sunumunu dogrulayamaz (dort goz, M21)';
    end if;
  end if;

  -- REJECTED: yalnız incelemeden ve karar atfıyla (kim reddetti).
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
