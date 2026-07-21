-- Dikey F, F5 hazırlık — kurucu Karar A (docs/adr/PR0-dikeyF-f5-kurtarma-
-- karsilastirmasi-2026-07-21.md): `impact_tolerances`'a açık bitemporal
-- geçerlilik sonu eklenir. NEDEN: yalnız `onay_zamani` ile "ölçüm anında
-- yürürlükte olan sürüm" sorgusu iki garanti edilmeyen varsayıma dayanırdı
-- (monoton aktivasyon, süprese anının dolaylı çıkarımı). Emsal:
-- `applicability_decisions` (20260718170000) — `superseded_at` yalnız
-- NULL→dolu geçişine izin verir, DİĞER HER ALAN DONAR.
--
-- SUNUCU TARAFINDA OTOMATİK DOLDURMA: yeni bir sürüm YURURLUKTE olduğunda,
-- aynı hizmetin SÜPRESE EDİLMİŞ AMA henüz damgalanmamış sürümünün
-- `superseded_at`'i server-side, yeni sürümün `onay_zamani`'yla doldurulur —
-- istemcinin iki-UPDATE akışının (ADR'da tespit edilen atomiklik riski)
-- SONUCU artık DB'de garanti altına alınır (istemci sırası ne olursa olsun).
--
-- SINIR SEMANTİĞİ (kurucu kararı): onay_zamani DAHİL, superseded_at HARİÇ —
-- as-of sorgusu bu yüzden `onay_zamani <= asOf and (superseded_at is null or
-- asOf < superseded_at)` biçimindedir (bkz. impact_tolerance_asof aşağıda).

alter table public.impact_tolerances
  add column superseded_at timestamptz;

/**
 * AS-OF ÇÖZÜMLEME: belirli bir anda (`p_as_of`) bir kritik hizmet için
 * YÜRÜRLÜKTE OLAN tolerans sürümünü döndürür — kural 11 (uydurma yok):
 * belirsizse (birden fazla veya sıfır aday) NULL döner, motor rastgele
 * seçmez. Yalnız SELECT — DB/ağ yan etkisi yok, saf sorgu.
 */
create or replace function public.impact_tolerance_asof(
  p_critical_service_id uuid,
  p_as_of timestamptz
)
returns public.impact_tolerances
language sql
stable
security invoker
set search_path = public
as $$
  select t.*
  from public.impact_tolerances t
  where t.critical_service_id = p_critical_service_id
    and t.onay_zamani is not null
    and t.onay_zamani <= p_as_of
    and (t.superseded_at is null or p_as_of < t.superseded_at)
  order by t.onay_zamani desc
  limit 1;
$$;

/**
 * SUNUCU-TARAFI OTOMATİK KAPAMA: bir sürüm YURURLUKTE olduğunda, aynı
 * hizmetin süprese edilmiş ama superseded_at'i henüz boş olan sürümünü
 * yeni sürümün onay_zamani'yla kapatır. Kronoloji ihlali (yeni sürümün
 * onay_zamani, kapatılacak sürümün onay_zamanindan ÖNCEyse) reddedilir —
 * sessizce tarih uydurulmaz.
 */
create or replace function public.impact_tolerance_superseded_at_doldur()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.durum = 'YURURLUKTE' and (TG_OP = 'INSERT' or old.durum is distinct from 'YURURLUKTE') then
    if exists (
      select 1 from public.impact_tolerances
      where critical_service_id = new.critical_service_id
        and id <> new.id
        and durum = 'SUPERSEDED'
        and superseded_at is null
        and onay_zamani > new.onay_zamani
    ) then
      raise exception 'Yeni surumun onay_zamani, kapatilan onceki surumun onay_zamanindan once olamaz';
    end if;

    update public.impact_tolerances
    set superseded_at = new.onay_zamani
    where critical_service_id = new.critical_service_id
      and id <> new.id
      and durum = 'SUPERSEDED'
      and superseded_at is null;
  end if;
  return new;
end;
$$;

create trigger impact_tolerance_superseded_at_doldur_trg
  after insert or update on public.impact_tolerances
  for each row execute function public.impact_tolerance_superseded_at_doldur();

/**
 * TOLERANS GUARD'I (forward-fix — güncel sürüm 20260719040000'i EZER):
 * mevcut iki kural (yürürlüğe onaysız giremez; yürürlükteki eşikler donuk)
 * AYNEN korunur; superseded_at için üç yeni kural eklenir:
 *   1) NULL→dolu geçişi serbest, dolu→başka bir şey YASAK (geri alınamaz).
 *   2) superseded_at, kaydın KENDİ onay_zamanindan önce olamaz.
 *   3) durum='SUPERSEDED' olan bir kayıtta superseded_at doldurulması
 *      DIŞINDA hiçbir alan değişemez (applicability_karar_guard deseni).
 */
create or replace function public.impact_tolerance_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    if new.durum = 'YURURLUKTE'
       and (new.yonetim_onayi is not true or new.onaylayan is null or new.onay_zamani is null) then
      raise exception 'Etki toleransi yururluge ancak yonetim onayi (onaylayan + zaman) ile girer';
    end if;
    return new;
  end if;

  -- TG_OP = 'UPDATE'
  if new.durum = 'YURURLUKTE' and old.durum is distinct from 'YURURLUKTE' then
    if new.yonetim_onayi is not true or new.onaylayan is null or new.onay_zamani is null then
      raise exception 'Etki toleransi yururluge ancak yonetim onayi (onaylayan + zaman) ile girer';
    end if;
  end if;

  if old.durum = 'YURURLUKTE' and new.durum = 'YURURLUKTE' then
    if new.max_kesinti_saat is distinct from old.max_kesinti_saat
      or new.max_veri_kaybi_saat is distinct from old.max_veri_kaybi_saat
      or new.max_mutabakat_farki is distinct from old.max_mutabakat_farki then
      raise exception 'Yururlukteki toleransin esikleri degistirilemez (yeni surum gerekir)';
    end if;
  end if;

  -- superseded_at: yalniz NULL -> dolu gecisi serbest; bir kez yazilinca donuk.
  if old.superseded_at is not null and new.superseded_at is distinct from old.superseded_at then
    raise exception 'superseded_at bir kez yazildiktan sonra degistirilemez';
  end if;
  if old.superseded_at is null and new.superseded_at is not null
     and old.onay_zamani is not null and new.superseded_at < old.onay_zamani then
    raise exception 'superseded_at, kaydin onay_zamanindan once olamaz';
  end if;

  -- SUPERSEDED kayit: superseded_at doldurulmasi DISINDA hicbir alan degismemeli.
  if old.durum = 'SUPERSEDED' then
    if new.durum is distinct from old.durum
      or new.tenant_id is distinct from old.tenant_id
      or new.critical_service_id is distinct from old.critical_service_id
      or new.surum is distinct from old.surum
      or new.max_kesinti_saat is distinct from old.max_kesinti_saat
      or new.max_veri_kaybi_saat is distinct from old.max_veri_kaybi_saat
      or new.max_mutabakat_farki is distinct from old.max_mutabakat_farki
      or new.yonetim_onayi is distinct from old.yonetim_onayi
      or new.onaylayan is distinct from old.onaylayan
      or new.onay_zamani is distinct from old.onay_zamani
      or new.created_at is distinct from old.created_at then
      raise exception 'Supersede edilmis tolerans kaydi duzenlenemez (yalniz superseded_at doldurulabilir)';
    end if;
  end if;

  return new;
end;
$$;
