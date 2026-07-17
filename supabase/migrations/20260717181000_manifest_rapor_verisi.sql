-- Mühürlenen RAPOR VERİSİNİ de sakla (docs/ROADMAP.md M9).
--
-- NEDEN AYRI MIGRATION: 20260717180000 canlıya uygulanmıştı; uygulanmış bir
-- migration dosyasını düzenlemek kayıt tablosuyla dosyayı sessizce ayrıştırır
-- (dosya değişir, Supabase onu "zaten uygulandı" sayıp yeni hali hiç koşmaz).
-- Yani düzeltme değil, ekleme yapılır.
--
-- NEDEN GEREKLİ: manifest raporun HASH'ini tutuyordu ama verisini tutmuyordu.
-- Hash tek başına raporu yeniden ÜRETMEYE yetmez — sadece elindekini
-- doğrulamaya yeter. Rapor PDF'i istendiğinde veriyi canlı tablolardan
-- yeniden toplasaydık, o tablolar sonradan değiştiğinde (kurum adı
-- güncellenir, puan yeniden hesaplanır) rapor mühürle uyuşmaz hale gelir ve
-- "mühür bozuk" derdik — oysa bozulan mühür değil, kaynağın kendisiydi.
-- Mühürlenen veri, mühürle birlikte saklanmalı.
--
-- NULLABLE ve bu bilinçli: bu kolon eklenmeden önce yazılmış manifestler var
-- (M9 geliştirme sırasındaki e2e koşuları). Onlara uydurma bir rapor verisi
-- yazmak, mühürledikleri şeyi tahrif etmek olurdu. Verisi olmayan manifest
-- doğrulanabilir ama raporu yeniden basılamaz — uygulama bunu açıkça söyler.
alter table public.simulation_result_manifests
  add column rapor_verisi jsonb;

comment on column public.simulation_result_manifests.rapor_verisi is
  'Mühürlenen RaporVerisi (src/lib/simulation-manifest.ts). Hash''i rapor_hash kolonudur; '
  'raporVerisiHash(rapor_verisi) = rapor_hash her zaman doğrulanabilir olmalı.';
