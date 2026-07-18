-- Ürün aktivasyon / time-to-value olayları (V2 PR-3b, ADR-V2-5).
--
-- AMAÇ: onboarding'den ilk değere kadar geçen süreyi ÖLÇMEK (V2 §4.5, §10).
-- CFO Kalkanı hedefi "ilk kanıt <1 iş günü" gibi operasyonel eşikleri
-- doğrulamak için.
--
-- GİZLİLİK (ADR-V2-5, kural 7): analitik olay kanıt İÇERİĞİ, kişi adı, IBAN,
-- serbest metin TAŞIMAZ — yalnız event_type (enum) + sayısal/enum meta.
-- Ayrı retention: 24 ay (öneri K6) sonra toplulaştır — bu migration'da
-- zorlanmıyor, operasyon borcu.

create table public.activation_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  event_type text not null check (event_type in (
    'PROFILE_COMPLETED',
    'FIRST_SCOPE_DECISION',
    'FIRST_CONTROL',
    'FIRST_EVIDENCE',
    'FIRST_TEST_RUN',
    'FIRST_AUDIT_PACKAGE',
    'FIRST_IBAN_VERIFICATION',
    'FIRST_SOD_EVALUATION'
  )),
  -- Yalnız sayısal/enum meta — PII/serbest metin YOK.
  meta jsonb not null default '{}',
  occurred_at timestamptz not null default now()
);

-- Bir tenant için her event_type'ın İLK oluşumu TTV'yi belirler; tekrar
-- yazımları da tutulur ama TTV türetimi (src/lib/aktivasyon.ts) ilkini alır.
create index activation_events_tenant_type_idx
  on public.activation_events (tenant_id, event_type, occurred_at);

alter table public.activation_events enable row level security;

-- Kiracı KENDİ aktivasyon olaylarını okur. Yazma: uygulama olayları kullanıcı
-- oturumuyla (RLS) yazabilir — analitik hassas değil ama tenant sınırlı.
create policy activation_events_select on public.activation_events
  for select using (tenant_id = public.current_tenant_id());
create policy activation_events_insert on public.activation_events
  for insert with check (tenant_id = public.current_tenant_id());
