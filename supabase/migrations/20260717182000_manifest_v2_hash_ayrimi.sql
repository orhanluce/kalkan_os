-- Manifest v2: hash adlarının anlamsal ayrımı (docs/ROADMAP.md M9).
--
-- NEDEN: kolonlar `manifest_hash` ve `rapor_hash` adlarını taşıyordu ve
-- ikincisi yanıltıcıydı — "rapor hash'i" okuyan herkes PDF DOSYASININ hash'i
-- sanıyor. Oysa değer, raporun dayandığı deterministik VERİNİN hash'i. Bir
-- bütünlük ürününde bir hash'in NEYİ doğruladığı hakkındaki belirsizlik,
-- hash'in kendisi kadar önemli bir kusurdur: yanlış şeyi doğruladığını sanan
-- denetçi, doğrulamadığı bir şeye güvenir.
--
-- YENİ ADLAR ve neyi doğruladıkları:
--   report_data_hash    raporun dayandığı deterministik sonuç verisini
--   core_manifest_hash  rapor verisi + kanıt zarflarının bütününü
--   (pdf_file_hash / package_manifest_hash burada YOK — bkz. aşağıda)
--
-- pdf_file_hash NEDEN BU TABLODA DEĞİL: PDF her istekte yeniden üretiliyor ve
-- baytları birebir aynı olmak zorunda değil (PDF üreticisi CreationDate gibi
-- alanlar gömer). Bir tatbikatın "tek bir PDF baytı" yok; olan şey, dışa
-- aktarılan SOMUT bir dosya. Bu yüzden pdf_file_hash ve packageManifestHash
-- dışa aktarma (ZIP paketi) kaydına ait — o adım geldiğinde kendi tablosuyla
-- gelecek. Buraya şimdi koymak, her indirmede değişen bir değeri mühürlenmiş
-- gibi göstermek olurdu.
--
-- GERİYE UYUMLULUK: `alter ... rename` veriyi korur; mevcut satırlar aynı
-- değerlerle yeni adlar altında durur. Hash'lerin KENDİSİ değişmiyor —
-- kanonikleştirme RFC 8785'e taşındı ama canonical.test.ts eski algoritmayla
-- birebir aynı çıktıyı verdiğini kanıtlıyor.

alter table public.simulation_result_manifests
  rename column rapor_hash to report_data_hash;

alter table public.simulation_result_manifests
  rename column manifest_hash to core_manifest_hash;

alter table public.simulation_result_manifests
  rename column rapor_verisi to report_data;

alter table public.simulation_result_manifests
  rename column manifest to core_manifest;

comment on column public.simulation_result_manifests.report_data_hash is
  'Raporun dayandigi deterministik ReportData''nin RFC 8785 kanonik hash''i. PDF baytlarinin hash''i DEGILDIR.';
comment on column public.simulation_result_manifests.core_manifest_hash is
  'Rapor verisi + kanit zarf hash''lerini kapsayan cekirdek manifestin hash''i. QR bunu isaret eder.';
comment on column public.simulation_result_manifests.report_data is
  'Muhurlenen ReportData (src/lib/simulation-manifest.ts). reportDataHash(report_data) = report_data_hash olmali.';

-- İndeks adı da anlamını kaybetmişti.
alter index simulation_result_manifests_hash_idx
  rename to simulation_result_manifests_core_hash_idx;

/**
 * QR DOĞRULAMA — HERKESE AÇIK YÜZEY (v2).
 *
 * Yeniden yaratılıyor çünkü döndürdüğü kolonun adı değişti. Sözleşme aynı:
 * kimlik doğrulaması aramaz, dolayısıyla döndürdüğü her alan fiilen kamuya
 * açıktır (M9 kabul kriteri: "QR doğrulama hassas veri sızdırmıyor").
 *
 * BİLİNÇLİ OLARAK DÖNDÜRÜLMEYENLER: tenant_id, kurum adı, senaryo kodu, puan,
 * kararlar, bulgular, manifestin KENDİSİ. Hash'i eline geçiren biri "hangi
 * kurum hangi tatbikattan kaç aldı" öğrenemez — yalnızca elindeki belgenin
 * sahici olup olmadığını öğrenir. Doğrulama bunu gerektirir, fazlası sızıntıdır.
 */
drop function if exists public.manifest_dogrula(text);

create or replace function public.manifest_dogrula(target_hash text)
returns table (
  report_data_hash text,
  muhurlendi_at timestamptz,
  durum text,
  saglayici text,
  anchored_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    m.report_data_hash,
    m.muhurlendi_at,
    public.simulation_manifest_durumu(m.id),
    (
      select r.saglayici from public.simulation_manifest_receipts r
      where r.manifest_id = m.id order by r.seq desc limit 1
    ),
    (
      select r.anchored_at from public.simulation_manifest_receipts r
      where r.manifest_id = m.id order by r.seq desc limit 1
    )
  from public.simulation_result_manifests m
  where m.core_manifest_hash = target_hash
$$;

grant execute on function public.manifest_dogrula(text) to anon, authenticated;
