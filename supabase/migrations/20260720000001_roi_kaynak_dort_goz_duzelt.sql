-- Forward-fix: roi_kaynak_kayitlari (20260719310000, §1.58 — DÜN ŞİPLENDİ)
-- yanlışlıkla obligations'ın ESKİ (20260718160000, tek-kişili, incelemeye_
-- alan'sız) guard sürümünü kopyalamıştı. `20260718210000_dogrulama_dort_
-- goz.sql` bunu M21'in gerçek şartına ("tek kişi mapping hazırlayıp
-- onaylayamaz" — incelemeye_alan ≠ dogrulayan) yükseltmişti; bu düzeltme
-- roi_kaynak_kayitlari'nı AYNI güncel deseni kullanacak şekilde hizalıyor.
-- Bug, Dikey C'nin (assurance_claims, 20260720000000) kendi PGlite testleri
-- yazılırken canlı geliştirme sırasında yakalandı — bkz. docs/adr/PR0-37-
-- tez-dikeyC-claim-guard-2026-07-20.md §0.
--
-- Şiplenmiş migration'lar DEĞİŞTİRİLMEZ (git geçmişi + supabase db push
-- filename-tracking) — bu FORWARD-FIX, yeni bir migration.

alter table public.roi_kaynak_kayitlari
  add column incelemeye_alan uuid references public.profiles (id) on delete restrict,
  add column incelemeye_alinma_zamani timestamptz;

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
