-- Hükümler (V2 PR-4b, M20; bitemporal). Bir source_artifact içindeki belirli
-- bir hükmün (madde/fıkra) metnini KAYIT eder.
--
-- ORTAK REFERANS VERİSİ, TENANT'SIZ (ADR-T3): bir hüküm her kiracı için
-- aynıdır — regulatory_sources/source_artifacts gibi global kataloğdur,
-- tenant_id TAŞIMAZ. Tenant'a özgü KARARLAR (applicability) PR-4b adım 3'te
-- ayrı tenant tablosunda.
--
-- KURAL 3 + V1 §29: hüküm metni uydurulmaz — bir source_artifact'a (hash'li,
-- künyeli değişmez kayıt) bağlıdır ve dogrulama_durumu TODO_DOGRULA doğar.
-- VERIFIED ayrı hukuk yetkisi ister (parser/seed VERIFIED yapamaz); bu yetki
-- kapısı obligations katmanında (adım 2) ve K8 (hukuk rolü) açık kararında.
--
-- NEDEN BİTEMPORAL (iki zaman ekseni birbirinden AYRI):
--   * valid-time  (effective_from/effective_to): hükmün YÜRÜRLÜKTE olduğu
--     dönem — gerçek hukuki gerçeklik. effective_to null = hâlâ yürürlükte.
--   * system-time (system_from/system_to): bu kaydı BİZİM sistemimizde bildiğimiz
--     dönem — bilgi ekseni. system_to null = güncel (geçerli) kayıt.
-- Düzeltme = fiziksel UPDATE/DELETE değil (kural 2 ruhu): eski kaydın
-- system_to'su kapatılır, düzeltilmiş yeni bir kayıt açılır. Böylece "ne zaman,
-- neyi bildiğimiz" geçmişi silinmez.

create table public.provisions (
  id uuid primary key default gen_random_uuid(),
  -- Hükmün metninin geldiği değişmez artifact. on delete restrict: kaynak
  -- artifact'ı silinemez (soy zinciri korunur).
  source_artifact_id uuid not null references public.source_artifacts (id) on delete restrict,
  -- Hükmün artifact içindeki referansı, ör. "md. 26", "Art. 4(1)". Mantıksal
  -- kimlik (source_artifact_id, provision_ref) çiftidir.
  provision_ref text not null,
  baslik text,
  metin text not null,

  -- --- valid-time (yürürlük ekseni) ---
  effective_from date not null,
  effective_to date,
  -- Yürürlük dönemi tutarlı: bitiş >= başlangıç.
  constraint provisions_valid_time_sane check (effective_to is null or effective_to >= effective_from),

  -- --- system-time (bilgi ekseni) ---
  system_from timestamptz not null default now(),
  system_to timestamptz,
  constraint provisions_system_time_sane check (system_to is null or system_to >= system_from),

  -- Kural 3: uydurulmuş/parser'la türetilmiş hüküm VERIFIED doğmaz.
  dogrulama_durumu text not null default 'TODO_DOGRULA'
    check (dogrulama_durumu in ('DRAFT_RESEARCH', 'TODO_DOGRULA', 'LEGAL_REVIEW', 'VERIFIED', 'SUPERSEDED')),
  eklenme_kaynagi text not null default 'manuel'
    check (eklenme_kaynagi in ('manuel', 'connector')),
  created_at timestamptz not null default now()
);

-- Güncel (system_to null) kayıtlar için: aynı mantıksal hükmün aynı yürürlük
-- diliminin İKİ güncel kaydı olamaz. Farklı effective_from'lar (farklı yürürlük
-- dilimleri) güncelde bir arada durabilir; system-time düzeltmesi ise eskisini
-- kapatıp yenisini açar, bu yüzden çakışmaz.
create unique index provisions_guncel_dilim_uq
  on public.provisions (source_artifact_id, provision_ref, effective_from)
  where system_to is null;

-- "As-of now" sorguları: güncel + yürürlükteki hükümleri artifact'a göre çek.
create index provisions_artifact_idx
  on public.provisions (source_artifact_id, provision_ref)
  where system_to is null;

-- --- RLS: global referans — authenticated okur, yazma seed/service ---
-- (regulatory_sources deseni: istemci global hukuk verisi yazamaz.)
alter table public.provisions enable row level security;

create policy provisions_select on public.provisions
  for select using (auth.role() = 'authenticated');
-- Yazma politikası YOK: manuel ingest / knowledge-graph rotası service_role
-- ile yazar ve system-time kapatmasını (düzeltme) yönetir.
