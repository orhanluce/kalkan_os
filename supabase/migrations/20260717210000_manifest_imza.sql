-- Sonuç manifestinin JWS imzası (docs/ROADMAP.md ADR-M11-01).
--
-- NE EKLER: mühür artık yalnız "içerik değişmedi" (hash) demiyor, "bunu
-- KALKAN_OS/tenant anahtarı imzaladı" da diyor. İmza çekirdek manifestin
-- kanonik temsili üzerinedir (detached JWS, ES256); mantık
-- src/lib/manifest-signature.ts.
--
-- NEDEN AYNI SATIR, AYRI TABLO DEĞİL: imza mühürle AYNI ANDA, aynı INSERT'te
-- yazılır ve manifest zaten immutable (simulation_manifest_immutable trigger'ı
-- UPDATE'i reddediyor). Yani imza da doğal olarak donar. Makbuz (anchor) ve
-- zaman damgası SONRADAN geldiği için ayrı tablodaydı; imza öyle değil.
--
-- NULLABLE ve bilinçli: bu migration'dan ÖNCE mühürlenmiş manifestler imzasız.
-- Onlara geriye dönük imza atmak — hangi anahtarla? — anlamsız; imzasız
-- kalırlar ve doğrulama yüzeyi "imzalanmamış (eski kayıt)" der.
--
-- PRIVATE KEY BURADA YOK VE OLMAYACAK (ADR-M11-01): yalnız public JWK saklanır.
-- Doğrulayıcı imzayı bu public key'le sınar; private key HSM/KMS'te kalır,
-- veritabanına asla düşmez.

alter table public.simulation_result_manifests
  add column signature_jws text,
  add column signature_kid text,
  add column signature_public_jwk jsonb,
  -- Hangi imzalayıcı ürettiği — DÜRÜSTLÜK İŞARETİ. 'local-dev-es256' ise bu
  -- imza production authenticity'si taşımaz; doğrulama yüzeyi bunu söylemeli.
  add column signer_ad text;

comment on column public.simulation_result_manifests.signature_public_jwk is
  'Imzayi dogrulamak icin public JWK. Private key ASLA saklanmaz (ADR-M11-01): HSM/KMS''te kalir.';
comment on column public.simulation_result_manifests.signer_ad is
  'Imzalayici kimligi. local-dev-* ise production degil, sadece hat butunlugunu ispatlar.';

/**
 * Manifestin dış-doğrulanabilirlik durumu (ADR-M11-03).
 *
 *   'imzasiz'          imza yok (bu migration öncesi eski kayıt)
 *   'imzali'           JWS var ama bağımsız zaman damgası yok
 *   'dis_dogrulanabilir' JWS VE bağımsız TSA zaman damgası var
 *
 * NEDEN 'dis_dogrulanabilir' İÇİN TSA ŞART (ADR-M11-03): imza "biz imzaladık"
 * der ama İMZA ZAMANINI bizim saatimizden alır — kendi zaman iddiamız bağımsız
 * değildir. Bağımsız TSA "bu hash şu zamanda görülmüştü" der. İkisi olmadan
 * dışarıya karşı tam doğrulanabilirlik iddia edilemez.
 *
 * Zaman damgası altyapısı (RFC 3161 / Kamu SM) henüz bağlı değil — token tablosu
 * gelene kadar hiçbir manifest 'dis_dogrulanabilir' olamaz. Bu bir eksiklik
 * değil, dürüst durum: damgasız bir paket dışarıya karşı damgalı gibi
 * gösterilmemeli.
 */
create or replace function public.manifest_dogrulama_durumu(target_manifest_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when m.signature_jws is null then 'imzasiz'
    -- TODO(M11): zaman damgası token tablosu bağlanınca 'dis_dogrulanabilir'
    -- kolu eklenecek. Bugün TSA yok, bu yüzden imzalı en üst durumdur.
    else 'imzali'
  end
  from public.simulation_result_manifests m
  where m.id = target_manifest_id
$$;
