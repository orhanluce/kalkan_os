-- Sürümlü plan / entitlement (docs/ROADMAP.md V2 PR-2c, ADR-V2-3).
--
-- İLKELER (V2 §4.3):
--   - Fiyat AUTHORIZATION kuralı DEĞİLDİR; yetki server/DB'de doğrulanır
--     (UI gizleme yetki değildir).
--   - Plan SÜRÜMLÜDÜR; geçmiş sözleşme davranışı korunur (yayınlanmış sürüm
--     immutable; değişiklik yeni sürüm doğurur).
--   - Upgrade/downgrade tenant verisini SİLMEZ; downgrade sonrası yetenek dışı
--     veri READ-ONLY olur (yazma rotası reddeder, SELECT açık kalır — bu
--     migration şema silmez; read-only zorlaması rota katmanında).
--   - Trial DB zamanıyla (now()), istemci saatine güvenilmez.
--   - Billing provider seçilmedi (K3 OPEN-DECISION) → MVP'de MANUEL/MOCK
--     provisioning (service_role script/rota + subscription_events kaydı).
--
-- LİMİTLER KODA GÖMÜLMEZ (V2 §7): yetenek matrisi plan_versions.yetkiler
-- jsonb'sinde; yeni matris = yeni plan sürümü.

create table public.product_plans (
  id uuid primary key default gen_random_uuid(),
  kod text not null unique check (kod in (
    'CFO_STARTER', 'CFO_PRO', 'CFO_GOVERNANCE', 'REGULATED_GROWTH', 'REGULATED_ENTERPRISE'
  )),
  ad text not null,
  urun_hatti text not null check (urun_hatti in ('CFO', 'REGULATED')),
  aktif boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.plan_versions (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.product_plans (id) on delete cascade,
  surum integer not null check (surum > 0),
  -- Yetenek matrisi: {finans_baseline, kanit_kasasi, sod, erp_banka_review,
  -- denetci_alani, yonetim_raporu, regulasyon_paketi, connector, sso, ...}.
  -- Değerler bool VEYA seviye string (ör. sod: "gorunum"|"tam"). Yorumlama
  -- src/lib/entitlement.ts'te (tek kaynak).
  yetkiler jsonb not null,
  yayin_durumu text not null default 'yayinlandi'
    check (yayin_durumu in ('taslak', 'yayinlandi', 'arsivlendi')),
  created_at timestamptz not null default now(),
  unique (plan_id, surum)
);

-- Kiracının aboneliği: tek AKTİF sürüm. tenant_id unique — bir kiracı bir
-- aktif abonelik (geçmiş subscription_events'te).
create table public.tenant_subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null unique references public.tenants (id) on delete cascade,
  plan_version_id uuid not null references public.plan_versions (id) on delete restrict,
  durum text not null default 'aktif' check (durum in ('aktif', 'askida', 'iptal')),
  baslangic timestamptz not null default now(),
  bitis timestamptz,
  trial_bitis timestamptz,
  updated_at timestamptz not null default now()
);

create trigger tenant_subscriptions_set_updated_at
  before update on public.tenant_subscriptions
  for each row execute function public.set_updated_at();

-- Abonelik yaşam döngüsü (append-only denetim): provision/upgrade/downgrade/
-- cancel/trial. Sessiz değişim yok.
create table public.subscription_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  event_type text not null check (event_type in (
    'PROVISIONED', 'UPGRADED', 'DOWNGRADED', 'CANCELLED', 'TRIAL_STARTED', 'RESUMED'
  )),
  plan_version_id uuid references public.plan_versions (id) on delete set null,
  actor uuid references public.profiles (id) on delete set null,
  detay jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index subscription_events_tenant_idx on public.subscription_events (tenant_id, created_at desc);

-- --- RLS ---
alter table public.product_plans enable row level security;
alter table public.plan_versions enable row level security;
alter table public.tenant_subscriptions enable row level security;
alter table public.subscription_events enable row level security;

-- Plan kataloğu: authenticated okur (fiyatlandırma sayfası herkese görünür);
-- yazma seed/service.
create policy product_plans_select on public.product_plans
  for select using (auth.role() = 'authenticated');
create policy plan_versions_select on public.plan_versions
  for select using (auth.role() = 'authenticated');

-- Abonelik: kiracı KENDİ aboneliğini OKUR; YAZAMAZ. Provisioning yalnız
-- service_role (mock billing) — istemci kendi planını yükseltemez (entitlement
-- bypass'ın DB katmanı: forged plan claim reddi).
create policy tenant_subscriptions_select on public.tenant_subscriptions
  for select using (tenant_id = public.current_tenant_id());
revoke insert, update, delete on public.tenant_subscriptions from authenticated, anon;

create policy subscription_events_select on public.subscription_events
  for select using (tenant_id = public.current_tenant_id());
revoke insert, update, delete on public.subscription_events from authenticated, anon;

-- --- Seed: 5 plan × v1 matris (ADR-V2-3 taslak matrisi; ÜRÜN KONFİGÜ, hukuk
-- değil — sürümlü ve düzenlenebilir). Idempotent (on conflict do nothing). ---
insert into public.product_plans (kod, ad, urun_hatti) values
  ('CFO_STARTER', 'CFO Kalkanı Starter', 'CFO'),
  ('CFO_PRO', 'CFO Kalkanı Pro', 'CFO'),
  ('CFO_GOVERNANCE', 'CFO Kalkanı Governance', 'CFO'),
  ('REGULATED_GROWTH', 'Regulated Growth', 'REGULATED'),
  ('REGULATED_ENTERPRISE', 'Regulated Enterprise', 'REGULATED')
on conflict (kod) do nothing;

insert into public.plan_versions (plan_id, surum, yetkiler)
select p.id, 1, m.yetkiler
from (values
  ('CFO_STARTER', '{"finans_baseline":true,"kanit_kasasi":"limitli","kontrol_testi":true,"sod":"gorunum","erp_banka_review":false,"denetci_alani":false,"yonetim_raporu":"basit","regulasyon_paketi":"baseline","connector":"manuel","sso":false,"dedicated":false}'::jsonb),
  ('CFO_PRO', '{"finans_baseline":true,"kanit_kasasi":"tam","kontrol_testi":true,"sod":"tam","erp_banka_review":true,"denetci_alani":false,"yonetim_raporu":"tam","regulasyon_paketi":"baseline","connector":"1hazir","sso":"opsiyonel","dedicated":false}'::jsonb),
  ('CFO_GOVERNANCE', '{"finans_baseline":true,"kanit_kasasi":"tam","kontrol_testi":true,"sod":"tam","erp_banka_review":true,"denetci_alani":true,"yonetim_raporu":"tam","regulasyon_paketi":"secili","connector":"coklu","sso":true,"dedicated":false}'::jsonb),
  ('REGULATED_GROWTH', '{"finans_baseline":false,"kanit_kasasi":"tam","kontrol_testi":true,"sod":"tam","erp_banka_review":true,"denetci_alani":true,"yonetim_raporu":"tam","regulasyon_paketi":"tek","connector":"1-3","sso":"opsiyonel","dedicated":"opsiyonel"}'::jsonb),
  ('REGULATED_ENTERPRISE', '{"finans_baseline":true,"kanit_kasasi":"tam","kontrol_testi":true,"sod":"tam","erp_banka_review":true,"denetci_alani":true,"yonetim_raporu":"tam","regulasyon_paketi":"coklu","connector":"coklu_ozel","sso":true,"dedicated":true}'::jsonb)
) as m(kod, yetkiler)
join public.product_plans p on p.kod = m.kod
on conflict (plan_id, surum) do nothing;
