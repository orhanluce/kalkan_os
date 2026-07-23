-- FAZ 1 — Kanonik Kanıt (Continuous Assurance OS programı, PR0-devam-sürecliluk
-- 2026-07-23'e bkz.). ROADMAP §2710 / Dikey K ADR §4 "Alternatif A" borcunu
-- kapatır: `evidences.kaynak_kontrol_id` bugüne kadar yoktu, kod zaten bu alanı
-- bekliyordu (`Evidence.kaynakKontrolId`, controls/[id]/page.tsx'teki "Eşlenik
-- kanıt — kaynak kontrolden otomatik yansıtıldı" notu) ama DB'de hep NULL'a
-- sabitleniyordu (src/lib/supabase/veri.ts'teki "ŞEMA EKSİĞİ" yorumu).
--
-- NEDEN self-referencing FK, NEDEN junction table DEĞİL: CLAUDE.md kural 24 +
-- Dikey K ADR §4, self-referencing FK (düşük risk, hiçbir okuyucuyu bozmaz) ile
-- junction table (geniş kapsamlı refactor) arasını AYRI kurucu kararları
-- olarak ayırır. Bu migration yalnız birincisini uygular — `evidences`
-- tablosunda ZATEN ÜÇ KEZ kullanılan self-referencing soy idiomunun
-- (previous_evidence_id: versiyon; redaksiyon_kaynak_id: türetim) DÖRDÜNCÜ
-- örneği. `veri.ts`'in `evidencesByControl` gruplama mantığı DEĞİŞMEDEN kalır:
-- her eşdeğer/kısmi kontrol hâlâ kendi `evidences` satırına sahip, yalnız artık
-- o satır HANGİ orijinal yüklemeden geldiğini dürüstçe taşıyor.
--
-- İKİNCİ ALAN — `kapsam`: her satır (orijinal veya yansıtılmış) kendi
-- control_id'si için kanıtın TAM mı KISMİ mi destek sağladığını taşır.
-- `obligation_control_mappings.kapsam` ile AYNI sözlük (tam/kismi) — yeni bir
-- şekil icat edilmedi. Bu aynı zamanda gerçek bir boşluğu kapatır: bugün
-- `control_mappings.iliski='kismi'` (kısmi eşdeğerlik) şemada var ama HİÇBİR
-- kod yolu onu kanıt yansıtmasında kullanmıyor — yalnızca 'esdeger' yansıtılıyor
-- (`findEquivalentControlIds`). Bu migration'ın KENDİSİ 'kismi' ilişkiyi
-- yansıtmaz (o `src/lib/control-mappings.ts` + `store.tsx` değişikliğidir);
-- yalnızca DB'nin bunu KAYDEDEBİLMESİNİ sağlar.
--
-- ZARF HASH'İNE DAHİL DEĞİL (bilinçli, raporlanan karar): `kaynak_kontrol_id`
-- ve `kapsam` `EvidenceEnvelope`'a (src/lib/evidence-envelope.ts) EKLENMEDİ.
-- Envelope hash'i bir İÇERİK/KÖKEN iddiasını mühürler (bu dosya, şu kaynaktan,
-- şu tarihte) — redaksiyon böyle bir iddiadır (farklı bayt dizisi). Kanıt
-- yansıtması İÇERİK ÜRETMEZ: yansıtılan satır, orijinaliyle AYNI dosya/hash'i
-- (aynı content-addressed Storage nesnesi) taşır; yalnızca HANGİ kontrol için
-- kullanıldığını ve nereden geldiğini kaydeden yönlendirme/ilişki metadatasıdır.
-- Zarf şemasını (KALKAN_EVIDENCE_ENVELOPE_V1) bunun için V2'ye taşımak —
-- Merkle/manifest/ledger/verify-CLI zincirinin tamamını etkiler — bu migration'ın
-- kapsamının dışında tutuldu; ayrı bir karar gerektirir.

alter table public.evidences
  add column kaynak_kontrol_id uuid references public.evidences (id) on delete restrict,
  add column kapsam text not null default 'tam' check (kapsam in ('tam', 'kismi'));

create index evidences_kaynak_kontrol_idx
  on public.evidences (kaynak_kontrol_id)
  where kaynak_kontrol_id is not null;

comment on column public.evidences.kaynak_kontrol_id is
  'Bu satir baska bir kontrolden "bir kanit, dort cerceve" ile yansitildiysa, yansitildigi ORIJINAL evidences satiri. NULL = dogrudan yuklenmis (orijinal).';
comment on column public.evidences.kapsam is
  'Bu satirin KENDI control_id''si icin kanit tam mi kismi mi destek sagliyor. obligation_control_mappings.kapsam ile ayni sozluk.';

/**
 * Zarf guard'ını kaynak_kontrol_id ile genişletir (aynı fonksiyon, redaksiyon
 * genişletmesiyle aynı desen — tek trigger, tek yerde büyüyen kural kümesi).
 *
 * Bir yansıtma (kaynak_kontrol_id dolu) şunları kanıtlamalı:
 *   - Kaynak gerçek ve AYNI kiracıya ait (kural 1: cross-tenant sızıntı yolu
 *     olmasın — bir FK yalnız VARLIĞI kontrol eder, KİME AİT olduğunu değil).
 *   - Kaynak satırın kendisi bir yansıtma OLMAMALI (duz/tek-katman soy: "kimin
 *     yansıması" sorusu her zaman tek adımda, belirsizlik yaratan zincirlere
 *     izin vermeden cevaplanabilmeli).
 *   - Kaynak, YANSITILAN satırla AYNI dosya hash'ini taşımalı (yansıtma yeni
 *     içerik üretmez — farklı hash'li bir "yansıtma" iddiası, redaksiyonla
 *     karıştırılmış olurdu; redaksiyon için redaksiyon_kaynak_id zaten var).
 */
create or replace function public.evidence_envelope_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kaynak_tenant uuid;
  v_kaynak_hash text;
  v_kaynak_ust uuid;
begin
  if new.envelope_schema_version is null then
    raise exception 'Yeni kanit zarfsiz yazilamaz: envelope_schema_version zorunlu (M9)';
  end if;

  if new.classification is null or new.retention_class is null then
    raise exception 'Zarf eksik: classification ve retention_class zorunlu';
  end if;

  if new.tip = 'dosya' then
    if new.hash_sha256 is null or new.mime_type is null or new.file_size is null then
      raise exception 'Dosya kaniti icin hash_sha256, mime_type ve file_size zorunlu';
    end if;
  end if;

  if new.previous_evidence_id is not null and new.previous_envelope_hash is null then
    raise exception 'Onceki surum gosteriliyorsa previous_envelope_hash zorunlu';
  end if;

  -- --- Redaksiyon kuralları (değişmedi) ---
  if new.redaksiyon_kaynak_id is not null then
    select tenant_id, hash_sha256 into v_kaynak_tenant, v_kaynak_hash
    from public.evidences where id = new.redaksiyon_kaynak_id;

    if v_kaynak_tenant is null then
      raise exception 'Redaksiyon kaynagi bulunamadi';
    end if;
    if v_kaynak_tenant is distinct from new.tenant_id then
      raise exception 'Redaksiyon kaynagi baska bir kiraciya ait';
    end if;
    if new.redaksiyon_notu is null or length(trim(new.redaksiyon_notu)) = 0 then
      raise exception 'Redaksiyon icin redaksiyon_notu zorunlu (ne/neden karartildi)';
    end if;
    if new.hash_sha256 is not null and new.hash_sha256 = v_kaynak_hash then
      raise exception 'Redaksiyon dosyasi kaynakla ayni hash''e sahip: karartma yapilmamis';
    end if;
    if new.redaksiyon_kaynak_file_hash is distinct from v_kaynak_hash then
      raise exception 'redaksiyon_kaynak_file_hash kaynagin gercek hash''iyle uyusmuyor';
    end if;
  else
    if new.redaksiyon_notu is not null
       or new.redaksiyon_kaynak_file_hash is not null
       or new.redaksiyon_kaynak_envelope_hash is not null then
      raise exception 'Redaksiyon alanlari yalnizca redaksiyon_kaynak_id ile birlikte doldurulabilir';
    end if;
  end if;

  -- --- Kanıt yansıtması kuralları (FAZ 1, yeni) ---
  if new.kaynak_kontrol_id is not null then
    select tenant_id, hash_sha256, kaynak_kontrol_id into v_kaynak_tenant, v_kaynak_hash, v_kaynak_ust
    from public.evidences where id = new.kaynak_kontrol_id;

    if v_kaynak_tenant is null then
      raise exception 'Yansitma kaynagi bulunamadi';
    end if;
    if v_kaynak_tenant is distinct from new.tenant_id then
      raise exception 'Yansitma kaynagi baska bir kiraciya ait';
    end if;
    if v_kaynak_ust is not null then
      raise exception 'Yansitma kaynagi kendisi bir yansitma olamaz: soy tek katmanli kalmali';
    end if;
    if new.hash_sha256 is not null and new.hash_sha256 is distinct from v_kaynak_hash then
      raise exception 'Yansitilan kanit kaynakla ayni dosya hash''ine sahip olmali: yansitma yeni icerik uretmez';
    end if;
  end if;

  return new;
end;
$$;
