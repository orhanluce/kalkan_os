-- Evidence Envelope şema göçü (docs/ROADMAP.md M9 adım 2).
--
-- NEDEN: manifest bugün kanıtın DOSYA hash'ini mühürlüyor, ZARF hash'ini
-- değil — çünkü zarfın alanları bu tabloda yoktu. Dosya hash'i "bu bayt dizisi
-- vardı" der; zarf hash'i "bu dosya, şu kaynaktan, şu tarihte, şu kontrol için,
-- şu saklama sınıfıyla sunuldu" der. Denetimde kanıt değeri olan ikincisidir.
--
-- APPEND-ONLY KORUNUYOR (kural 2): bu tabloya UPDATE/DELETE yolu AÇILMIYOR.
-- Dolayısıyla her satır bir SÜRÜMdür; yeni sürüm = yeni satır + öncekine
-- zincir. `id` bu yüzden envelope'un `evidenceVersionId`'sidir.
--
-- ESKİ SATIRLAR DOKUNULMADAN KALIYOR: alanlar nullable ekleniyor ve guard
-- yalnızca INSERT'te çalışıyor. Böylece bugüne kadar yazılmış kanıtlar
-- `envelope_schema_version IS NULL` ile LEGACY_FILE_HASH_ONLY olarak kalır.
-- Onlara geriye dönük zarf alanı UYDURMUYORUZ — uydurulmuş bir köken
-- iddiası, hiç iddia olmamasından kötüdür.

alter table public.evidences
  -- Sürüm zinciri. version_no default 1: mevcut satırların hepsi ilk sürüm.
  add column version_no integer not null default 1 check (version_no > 0),
  add column previous_evidence_id uuid references public.evidences (id) on delete restrict,
  -- İKİ AYRI ZİNCİR, iki ayrı soru:
  --   previous_file_hash     -> önceki sürümün DOSYASI neydi
  --   previous_envelope_hash -> önceki sürümün KÖKEN İDDİASI neydi
  -- Yalnızca dosya zincirini tutmak, "dosya değişti ama kaynağı/sınıfı da
  -- değişti mi" sorusunu cevapsız bırakırdı.
  add column previous_file_hash text check (previous_file_hash ~ '^[0-9a-f]{64}$'),
  add column previous_envelope_hash text check (previous_envelope_hash ~ '^[0-9a-f]{64}$'),
  add column file_size bigint check (file_size >= 0),
  add column mime_type text,
  -- storage_object_key: Storage'daki nesne anahtarı.
  -- storage_version_id: Storage'ın kendi sürüm kimliği.
  --
  -- İKİSİ DE BUGÜN BOŞ KALACAK ve bu bir eksiklik değil, mevcut bir gerçeğin
  -- kaydı: uygulama dosyayı Storage'a YÜKLEMİYOR. Yükleme formu yalnızca
  -- dosya ADINI ve hash'ini kaydediyor (src/app/(app)/controls/[id]/page.tsx).
  -- Kolonları şimdi açıyoruz ki gerçek yükleme geldiğinde şema değil yalnızca
  -- kod değişsin; ama boş oldukları sürece zarf "dosya şurada duruyor"
  -- diyemez.
  add column storage_object_key text,
  add column storage_version_id text,
  add column source_system text,
  add column captured_at timestamptz,
  add column retention_class text,
  add column classification text,
  add column hash_algorithm text not null default 'sha256'
    check (hash_algorithm in ('sha256')),
  add column legal_hold boolean not null default false,
  -- Bu satırın zarf şema sürümü. NULL = zarfsız (legacy) kayıt.
  add column envelope_schema_version text;

comment on column public.evidences.id is
  'Envelope''un evidenceVersionId''si: tablo append-only oldugu icin her satir bir SURUMdur.';
comment on column public.evidences.storage_version_id is
  'Storage surum kimligi. Uygulama dosyayi Storage''a yuklemedigi surece BOS kalir (M9 borcu).';
comment on column public.evidences.envelope_schema_version is
  'NULL ise bu kayit LEGACY_FILE_HASH_ONLY: dosya butunlugu dogrulanabilir, koken zinciri dogrulanamaz.';

-- `tip` kolonu zaten envelope'un sourceType'ıdır (dosya/link/beyan).
-- Ayrı bir source_type kolonu AÇMIYORUZ: aynı olgunun iki kaynağı, sessizce
-- ayrışabilecekleri bir yer yaratırdı.

/**
 * Zarflı kayıtların eksiksiz olmasını zorlar.
 *
 * NEDEN TRIGGER, NEDEN INSERT'TE: eski satırlar dokunulmadan kalmalı (onlara
 * CHECK constraint uygulanamaz, tablo zaten dolu). Guard yalnızca YENİ
 * satırlara bakar: bundan sonra yazılan bir kanıt ya tam zarflıdır ya da
 * açıkça legacy'dir — "yarım zarf" diye bir şey olamaz.
 *
 * YARIM ZARF NEDEN YASAK: envelope_schema_version dolu ama classification boş
 * bir kayıt, doğrulama ekranında "köken doğrulandı" der ve aslında
 * doğrulamaz. Bütünlük ürününde en kötü durum, yanlış güvence vermektir.
 */
create or replace function public.evidence_envelope_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Zarfsız (legacy tarzı) yeni kayıt: sessizce geçmesin. Bugünden sonra
  -- yazılan her kanıt zarflı olmalı; legacy yalnızca GEÇMİŞ için bir durum.
  if new.envelope_schema_version is null then
    raise exception 'Yeni kanit zarfsiz yazilamaz: envelope_schema_version zorunlu (M9)';
  end if;

  if new.classification is null or new.retention_class is null then
    raise exception 'Zarf eksik: classification ve retention_class zorunlu';
  end if;

  -- Dosya tipi kanıtta dosyanın kendisine dair alanlar zorunlu; link/beyan
  -- tipinde dosya yoktur, onları zorunlu tutmak veri uydurmaya iterdi.
  if new.tip = 'dosya' then
    if new.hash_sha256 is null or new.mime_type is null or new.file_size is null then
      raise exception 'Dosya kaniti icin hash_sha256, mime_type ve file_size zorunlu';
    end if;
  end if;

  -- Zincir tutarlılığı: önceki sürüm gösteriliyorsa hash'leri de gelmeli,
  -- yoksa zincir "vardı ama neydi bilinmiyor" olur.
  if new.previous_evidence_id is not null and new.previous_envelope_hash is null then
    raise exception 'Onceki surum gosteriliyorsa previous_envelope_hash zorunlu';
  end if;

  return new;
end;
$$;

create trigger evidence_envelope_guard_before_insert
  before insert on public.evidences
  for each row execute function public.evidence_envelope_guard();

/**
 * Bir kanıtın bütünlük durumu — manifestteki ManifestKanit.durum'un kaynağı.
 *
 * 'FULL_ENVELOPE'         zarf alanları tam: köken zinciri doğrulanabilir
 * 'LEGACY_FILE_HASH_ONLY' yalnızca dosya hash'i: bu kayıt "dosya bütünlüğü
 *                         doğrulandı" diyebilir, "kanıt kökeni ve zarf zinciri
 *                         doğrulandı" DİYEMEZ
 */
create or replace function public.evidence_butunluk_durumu(target_evidence_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when e.envelope_schema_version is not null then 'FULL_ENVELOPE'
    else 'LEGACY_FILE_HASH_ONLY'
  end
  from public.evidences e
  where e.id = target_evidence_id
$$;
