-- Kanıt dosyaları için özel (private) Storage bucket'ı + tenant-izolasyonlu RLS
-- (docs/ROADMAP.md M11, belge M01 "ham kanıt object storage'da").
--
-- BUGÜNE KADARKİ AÇIK: uygulama dosyayı Storage'a HİÇ yüklemiyordu; yükleme
-- formu yalnızca dosya ADINI ve hash'ini kaydediyordu (CLAUDE.md: "Storage'a
-- gerçek dosya yükleme doğrulanmadı"). Bu migration o borcun şema tarafını
-- açıyor; kod tarafı store.tsx + controls formunda.
--
-- NEDEN PRIVATE: kanıt, kurumun özel iç uyum verisidir — bir sızma testi
-- raporu, bir erişim listesi. public bucket, imzasız bir URL'i bilen herkese
-- açık olurdu. Erişim yalnızca RLS altında, kiracının kendi oturumuyla.
--
-- YOL ŞEMASI: `{tenant_id}/{sha256}`. İki işi birden yapar:
--   1. Tenant izolasyonu — RLS ilk klasör segmentini current_tenant_id ile
--      karşılaştırır; başka kiracının nesnesine erişim yok.
--   2. İçerik-adresleme — aynı bayt dizisi aynı yola gider. Aynı dosyanın
--      yeniden yüklenmesi idempotenttir (kod 409'u başarı sayar) ve iki farklı
--      kanıt satırı aynı dosyaya işaret edebilir ("bir kanıt, dört çerçeve"
--      yansımasında dosya bir kez yüklenir, N satır aynı nesneyi gösterir).
--
-- storage_version_id NEDEN HÂLÂ BOŞ KALIR: Supabase bucket sürümleme varsayılan
-- gelmez. İçerik-adreslemede zaten gereksiz: dosya değişirse hash değişir, yani
-- yol değişir — sürüm kimliği yolun kendisinde. Kolon açık kalır (ileride bucket
-- sürümleme açılırsa), bugün null.

-- Bucket. on conflict: migration idempotent olmalı (yeniden koşarsa patlamasın).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'evidence',
  'evidence',
  false,
  -- src/lib/evidence.ts MAX_EVIDENCE_FILE_SIZE_BYTES ile tutarlı (20 MiB).
  20971520,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/png',
    'image/jpeg',
    'text/plain'
  ]
)
on conflict (id) do nothing;

/**
 * RLS — storage.objects. Supabase bu tabloda RLS'i zaten açık tutar; biz
 * yalnızca 'evidence' bucket'ına politika ekleriz.
 *
 * SINIR RLS'TEDİR, YOLDA DEĞİL: yol şeması `{tenant_id}/...` bir KOLAYLIKTIR
 * (dedup + okunabilirlik). Gerçek koruma aşağıdaki politikalardır — istemci
 * yolu elle başka bir tenant_id ile kursa bile INSERT/SELECT reddedilir,
 * çünkü politika current_tenant_id()'yi klasör segmentiyle karşılaştırır.
 *
 * current_tenant_id(): profiles üzerinden auth.uid()'nin kiracısını döndüren
 * SECURITY DEFINER fonksiyon (RLS'in her yerinde çalışır, storage dahil).
 */

-- SELECT: yalnızca kendi kiracının klasörü.
create policy evidence_objects_select_own_tenant
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'evidence'
    and (storage.foldername(name))[1] = public.current_tenant_id()::text
  );

-- INSERT: yalnızca kendi kiracının klasörüne.
create policy evidence_objects_insert_own_tenant
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'evidence'
    and (storage.foldername(name))[1] = public.current_tenant_id()::text
  );

-- UPDATE/DELETE POLİTİKASI YOK — ve bu bilinçli (kural 2, evidences append-only):
-- kanıt dosyası bir kez yüklendikten sonra değiştirilemez/silinemez. İçerik
-- değişirse yeni hash = yeni nesne, eskisi durur. Legal hold ve saklama
-- politikası zaten silmeyi yasaklıyor; buradan bir UPDATE/DELETE yolu açmak
-- o güvenceyi çelişkiye düşürürdü.
