-- Dikey E, E1 (kurucu kararı #1, KESİN): tedarikçi bulgusunun SAHİBİ aynı
-- bulguyu KAPATAMAZ — bağımsız kapanış invaryantı (M12/SoD'nin "kendi işini
-- kendi kapatamaz" deseninin AYNISI, YENİ bir mekanizma İCAT EDİLMEDİ).
--
-- GÜNCEL SÜRÜM temel alındı (grep doğrulandı: assessment_finding_guard
-- yalnız 20260719100000'de tanımlı, başka forward-fix YOK).
--
-- NULL GÜVENLİĞİ (kurucunun kendi test isteği): `kapatan IS DISTINCT FROM
-- sahibi` TEK BAŞINA YETERSİZDİR — SQL'de `X IS DISTINCT FROM NULL` HER
-- ZAMAN true döner (X gerçek bir değerken), yani sahibi NULL bırakılırsa bu
-- karşılaştırma "farklı kişi" gibi YANLIŞ bir sonuç verip guard'ı BYPASS
-- ederdi. Bu yüzden ÖNCE `sahibi is null` AÇIKÇA reddedilir, ANCAK ONDAN
-- SONRA düz `=` karşılaştırması güvenlidir (ikisi de bu noktada NOT NULL).
--
-- MEVCUT BULGULAR DOKUNULMAZ: bu migration yalnız trigger fonksiyonunu
-- CREATE OR REPLACE eder — hiçbir UPDATE/backfill İÇERMEZ, açık/taslak
-- bulgular otomatik kapatılmaz veya değiştirilmez.

create or replace function public.assessment_finding_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- third_party_id, değerlendirmenin tedarikçisiyle tutarlı olmalı.
  if not exists (
    select 1 from public.third_party_assessments a
    where a.id = new.assessment_id and a.third_party_id = new.third_party_id and a.tenant_id = new.tenant_id
  ) then
    raise exception 'Bulgu, degerlendirmenin tedarikcisi/kiracisiyla tutarsiz';
  end if;

  if new.durum = 'KAPANDI' then
    if new.kapanis_kanit is null or btrim(new.kapanis_kanit) = ''
       or new.kapatan is null or new.kapanis_zamani is null then
      raise exception 'Bulgu kapanisi kanit + kapatan + zaman ister (kural 14: ticket kapatmak bulgu kapatmaz)';
    end if;
    if auth.uid() is not null and new.kapatan is distinct from auth.uid() then
      raise exception 'Bulgu ancak oturum sahibi adina kapatilabilir (kimlik atfi)';
    end if;

    -- BAĞIMSIZ KAPANIŞ (Dikey E kurucu kararı #1): sahibi eksikse kapanamaz,
    -- doluysa kapatan ≠ sahibi olmalı. service_role dahil hiçbir rol atlayamaz
    -- (security definer + trigger, RLS'e değil trigger'a dayanır).
    if new.sahibi is null then
      raise exception 'Bulgu kapanisi sahibi atanmadan yapilamaz (bagimsiz kapanis invaryanti)';
    end if;
    if new.kapatan = new.sahibi then
      raise exception 'Bulgunun sahibi kendi bulgusunu kapatamaz (bagimsiz kapanis, maker-checker)';
    end if;
  end if;
  return new;
end;
$$;
