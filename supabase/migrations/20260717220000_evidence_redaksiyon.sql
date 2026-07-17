-- Kanıt redaksiyonu (docs/ROADMAP.md M11, belge M01).
--
-- NE İŞE YARAR: bir kanıt (ör. sızma testi raporu) denetçiyle paylaşılmadan
-- önce hassas bölümleri (IP'ler, kişi adları, iç mimari) karartılabilir.
-- Redakte edilmiş sürüm AYRI bir kanıttır: farklı baytlar, farklı hash — ama
-- ORİJİNALLE soy bağını korur. Belge M01 kabul kriteri: "redacted sürüm
-- orijinal kanıtla soy ilişkisini korur ancak farklı hash taşır."
--
-- NEDEN VERSİYON DEĞİL DE TÜRETİM: redaksiyon, orijinalin YERİNE geçmez.
-- Orijinal (ham) sürüm geçerli ve saklanır kalır; redakte sürüm paylaşım için
-- PARALEL bir artefakttır. Bu yüzden `previous_evidence_id` (versiyon ardılı)
-- DEĞİL, ayrı bir `redaksiyon_kaynak_id` (türetim) kullanılır. İkisini
-- karıştırmak "bu X'i değiştirdi" ile "bu X'in paylaşılabilir kopyası" ayrımını
-- bulanıklaştırırdı.
--
-- APPEND-ONLY KORUNUR (kural 2): redaksiyon yeni bir satırdır, orijinale
-- dokunulmaz. on delete RESTRICT: kaynağı olan bir redaksiyon dururken orijinal
-- silinemez — soy bağı kopmasın.

alter table public.evidences
  add column redaksiyon_kaynak_id uuid references public.evidences (id) on delete restrict,
  -- NE karartıldı ve NEDEN. Zorunlu (guard): "redakte edildi" demek yetmez,
  -- neyin neden gizlendiği denetim değeri taşır.
  add column redaksiyon_notu text,
  -- Kaynağın redaksiyon ANINDAKİ hash'leri: soy bağının kriptografik demiri.
  -- Kaynak sonradan bir şekilde değişse (ki append-only'de değişemez) bile,
  -- redaksiyonun HANGİ sürümden türediği bu değerlerle sabittir.
  add column redaksiyon_kaynak_file_hash text check (redaksiyon_kaynak_file_hash ~ '^[0-9a-f]{64}$'),
  add column redaksiyon_kaynak_envelope_hash text check (redaksiyon_kaynak_envelope_hash ~ '^[0-9a-f]{64}$');

create index evidences_redaksiyon_kaynak_idx
  on public.evidences (redaksiyon_kaynak_id)
  where redaksiyon_kaynak_id is not null;

comment on column public.evidences.redaksiyon_kaynak_id is
  'Bu satir bir redaksiyon ise, tuuretildigi ORIJINAL kanit. Versiyon ardili degil, paralel turetim.';

/**
 * Zarf guard'ını redaksiyon kurallarıyla genişletir.
 *
 * Bir redaksiyon (redaksiyon_kaynak_id dolu) şunları KANITLAMALI:
 *   - Kaynak gerçek ve AYNI kiracıya ait (başka kurumun kanıtını redakte
 *     ediyormuş gibi görünmek bir sızıntı yoludur).
 *   - redaksiyon_notu dolu — ne/neden karartıldığı kayıtlı.
 *   - Redakte dosyanın hash'i kaynağınkinden FARKLI. Aynı baytlar "redaksiyon"
 *     değildir; farklı hash iddiası boş olurdu ve denetçi karartılmamış bir
 *     dosyayı redakte sanırdı.
 *   - Kaynağın hash'leri (redaksiyon_kaynak_*_hash) kaynağın GERÇEK
 *     hash'leriyle tutmalı — soy bağı uydurulmasın.
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

  -- --- Redaksiyon kuralları ---
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
    -- Soy bağı demiri: kaydedilen kaynak hash'i kaynağın gerçek hash'iyle tutmalı.
    if new.redaksiyon_kaynak_file_hash is distinct from v_kaynak_hash then
      raise exception 'redaksiyon_kaynak_file_hash kaynagin gercek hash''iyle uyusmuyor';
    end if;
  else
    -- Redaksiyon değilse redaksiyon alanları boş olmalı — yarı-dolu bir
    -- redaksiyon iddiası, olmayan bir soy bağı gösterirdi.
    if new.redaksiyon_notu is not null
       or new.redaksiyon_kaynak_file_hash is not null
       or new.redaksiyon_kaynak_envelope_hash is not null then
      raise exception 'Redaksiyon alanlari yalnizca redaksiyon_kaynak_id ile birlikte doldurulabilir';
    end if;
  end if;

  return new;
end;
$$;

/**
 * Bir kanıtın redaksiyon soyu: kaynaktan (ham) redakte sürüme.
 * Redaksiyon değilse tek satır (kendisi) döner; öyleyse kaynağı da gösterir.
 */
create or replace function public.evidence_redaksiyon_soyu(target_evidence_id uuid)
returns table (evidence_id uuid, redaksiyon_mi boolean, kaynak_id uuid, not_metni text)
language sql
stable
security definer
set search_path = public
as $$
  select
    e.id,
    e.redaksiyon_kaynak_id is not null,
    e.redaksiyon_kaynak_id,
    e.redaksiyon_notu
  from public.evidences e
  where e.id = target_evidence_id
$$;
