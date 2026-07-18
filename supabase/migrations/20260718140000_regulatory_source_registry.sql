-- Resmî kaynak sicili (V2 PR-4a, M19; V1 §13, ADR-T3).
--
-- ORTAK REFERANS VERİSİ, TENANT'SIZ (ADR-T3): resmî hukuk kaynağı/artifact'ı
-- her kiracı için AYNIDIR — bu tablolar frameworks/controls gibi global
-- kataloğdur, tenant_id TAŞIMAZ. "Ortak tabloya tenant RLS uydurma" (V1 §13).
-- Tenant'a özgü KARARLAR (applicability, mapping onayı) ayrı tenant
-- tablolarında (PR-4b).
--
-- KURAL 3 + V1 §29: kaynak İÇERİĞİ uydurulmaz; artifact bir hash + künye ile
-- KAYIT edilir, gerçek çekim SourceAccessPolicy onayı olmadan otomatikleşmez
-- (connector ayrı iş). dogrulama_durumu TODO_DOGRULA doğar — VERIFIED ayrı
-- hukuk yetkisi ister (PR-4b knowledge graph).

create table public.regulatory_sources (
  id uuid primary key default gen_random_uuid(),
  authority text not null,          -- ör. "SPK", "Resmî Gazete", "EUR-Lex"
  jurisdiction text not null,       -- ör. "TR", "EU"
  -- Kaynak seviyesi (V1 §13): A birincil hukuk, B resmî rehber, C standart,
  -- D akademik (tek başına hukuk doğrulaması için YETMEZ).
  kaynak_seviyesi text not null check (kaynak_seviyesi in ('A', 'B', 'C', 'D')),
  ad text not null,
  canonical_url text,
  -- SourceAccessPolicy durumu: connector üretime çıkmadan önce ONAYLI olmalı
  -- (lisans/robots/arşiv hakkı). Manuel ingest için 'manuel' yeterli.
  erisim_politikasi_durumu text not null default 'onay_bekliyor'
    check (erisim_politikasi_durumu in ('onay_bekliyor', 'onaylandi', 'manuel', 'reddedildi')),
  aktif boolean not null default true,
  created_at timestamptz not null default now()
);

-- Değişmez artifact: bir kaynağın belirli bir sürümünün ham kaydı. Hash
-- bütünlüğü (sha256). Fiziksel dosya Storage'da (regulatory-source-artifacts
-- bucket — bu migration bucket kurmaz, yol referansı tutar).
create table public.source_artifacts (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.regulatory_sources (id) on delete restrict,
  external_id text,                 -- ör. CELEX/ELI, Resmî Gazete sayısı
  baslik text not null,
  media_type text,
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  raw_object_path text,             -- Storage yolu (nullable — henüz yüklenmemiş olabilir)
  fetched_at timestamptz,
  issued_at date,
  effective_from date,
  effective_to date,
  language text,
  parser_version text,
  -- Öncül/ardıl (sürüm zinciri). predecessor'a on delete restrict — geçmiş
  -- silinmez (kural 2 ruhu).
  predecessor_id uuid references public.source_artifacts (id) on delete restrict,
  -- Kural 3: uydurulmuş kaynak VERIFIED doğmaz.
  dogrulama_durumu text not null default 'TODO_DOGRULA'
    check (dogrulama_durumu in ('DRAFT_RESEARCH', 'TODO_DOGRULA', 'VERIFIED', 'SUPERSEDED')),
  eklenme_kaynagi text not null default 'manuel'
    check (eklenme_kaynagi in ('manuel', 'connector')),
  created_at timestamptz not null default now(),
  unique (source_id, sha256)
);

create index source_artifacts_source_idx on public.source_artifacts (source_id, created_at desc);

-- --- RLS: global referans — authenticated okur, yazma seed/service ---
alter table public.regulatory_sources enable row level security;
alter table public.source_artifacts enable row level security;

create policy regulatory_sources_select on public.regulatory_sources
  for select using (auth.role() = 'authenticated');
create policy source_artifacts_select on public.source_artifacts
  for select using (auth.role() = 'authenticated');
-- Yazma politikası YOK (frameworks/controls deseni): manuel ingest rotası
-- service_role ile yazar, connector de öyle. İstemci global hukuk verisi
-- yazamaz.
