-- Kaynak ingest altyapısı (QRegu PR-Q1', M19 devamı; PRQ0 belgesi §10).
--
-- İKİ PARÇA:
--   1. `regulatory-source-artifacts` private bucket'ı: ham resmî nüsha
--      DEĞİŞTİRİLEMEZ nesne olarak Storage'da durur (V1 §23, M19 "orijinal
--      dosya immutable object storage'da"). Yol İÇERİK-ADRESLİ: `raw/{sha256}`
--      — aynı bayt dizisi aynı yola gider, yeniden yükleme idempotenttir.
--   2. `source_fetch_runs`: her çekim/ingest girişiminin kaydı. QRegu kural 8
--      ("kaynak erişilemiyorsa güncellik iddia edilemez") ancak çekim tarihi
--      KAYITLIYSA uygulanabilir — tazelik bu tablodan türetilir (saf fonksiyon
--      `src/lib/kaynak-tazelik.ts`, kural 11; cron'lu alarm connector'la
--      birlikte gelecek, şimdilik okuma-anı türetimi dürüst olan).
--
-- GLOBAL ORTAK REFERANS (ADR-T3): resmî nüsha ve çekim geçmişi her kiracı
-- için aynıdır — tenant_id YOK; authenticated okur, yazma yalnız küratör
-- script/service (PR-4a kararı: tenant-facing yazma yolu YOK, bir kiracı
-- ortak kataloğu kirletemez; K8 hukuk-küratör rolü hâlâ AÇIK KARAR).

-- --- 1. Bucket (evidence deseni; idempotent) ---
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'regulatory-source-artifacts',
  'regulatory-source-artifacts',
  false,
  -- Resmî Gazete PDF'leri büyük olabilir: 50 MiB.
  52428800,
  array['application/pdf', 'text/html', 'application/xml', 'text/xml', 'text/plain']
)
on conflict (id) do nothing;

-- SELECT: her doğrulanmış kullanıcı ham resmî nüshayı okuyabilir (global
-- hukuk verisi — regulatory_sources/provisions okuma politikasıyla tutarlı).
create policy regsource_objects_select_authenticated
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'regulatory-source-artifacts');

-- INSERT/UPDATE/DELETE politikası YOK (bilinçli): yazma yalnız service_role
-- (küratör scripti). Nesne içerik-adresli ve değişmezdir — içerik değişirse
-- hash değişir, yeni nesne doğar; eski nüsha ve hash geçmişi korunur (M19
-- "kaynak silinse bile alınmış resmî nüsha korunur").

-- --- 2. Çekim koşuları ---
create table public.source_fetch_runs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.regulatory_sources (id) on delete restrict,
  durum text not null check (durum in ('BASARILI', 'BASARISIZ')),
  yontem text not null default 'manuel' check (yontem in ('manuel', 'connector')),
  -- Başarılıysa üretilen/teyit edilen artifact. Başarısızda null.
  artifact_id uuid references public.source_artifacts (id) on delete restrict,
  constraint sfr_basarili_artifactli check (durum = 'BASARISIZ' or artifact_id is not null),
  -- Hata ÖZETİ — secret/ham response dump YAZILMAZ (V1 §9.4, kural 7).
  hata_ozeti text,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index sfr_source_idx on public.source_fetch_runs (source_id, fetched_at desc);

-- --- RLS: global okuma, istemci yazamaz (append-only sicil) ---
alter table public.source_fetch_runs enable row level security;

create policy sfr_select on public.source_fetch_runs
  for select using (auth.role() = 'authenticated');
-- Yazma politikası YOK: küratör script/connector service_role ile yazar.

revoke update, delete on public.source_fetch_runs from authenticated, anon;
