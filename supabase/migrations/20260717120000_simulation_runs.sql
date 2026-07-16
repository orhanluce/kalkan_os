-- Simülasyon yürütme (docs/ROADMAP.md M8, simülasyon belgesi §7.2-§7.4).
--
-- Şablon (M7) ortak kütüphaneydi; RUN kiracıya aittir — kural 1 burada tam
-- olarak geçerli: tenant_id + RLS.

create table public.simulation_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  -- Hangi şablon SÜRÜMÜ oynandı: şablonun kendisi değil sürümü. Şablon
  -- sonradan yeni sürüm alsa bile bu run eski sürüme bakmaya devam eder
  -- (kural 10, belge §10.7).
  version_id uuid not null references public.scenario_template_versions (id) on delete restrict,
  ad text not null,
  -- belge §7.2: facilitated live / timed / accelerated demo
  mod text not null check (mod in ('canli', 'zamanli', 'hizlandirilmis')),
  -- Hızlandırılmış modda zaman ölçeği KAYDEDİLİR (belge §8.2 sonu): rapor
  -- "2 saatlik senaryo 10 dakikada oynandı" diyebilmeli, yoksa süre
  -- ölçümleri yanıltıcı olur.
  zaman_olcegi numeric not null default 1 check (zaman_olcegi > 0),
  durum text not null default 'taslak' check (durum in (
    'taslak', 'planlandi', 'hazir', 'calisiyor', 'duraklatildi',
    'tamamlandi', 'puanlaniyor', 'incelendi', 'kapandi', 'iptal'
  )),
  planlanan_baslangic timestamptz,
  basladi_at timestamptz,
  bitti_at timestamptz,
  -- Duraklatılan toplam süre: pause sırasında geçen zaman katılımcının
  -- yanıt süresine yazılmamalı (belge Faz 7 kabul kriteri).
  duraklatilan_saniye integer not null default 0 check (duraklatilan_saniye >= 0),
  duraklatildi_at timestamptz,
  created_at timestamptz not null default now()
);

create index simulation_runs_tenant_idx on public.simulation_runs (tenant_id, created_at desc);

create table public.simulation_participants (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.simulation_runs (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete restrict,
  -- Senaryo rolü (bilgi_guvenligi_yoneticisi vb.) — ürün rolünden (admin/uyum)
  -- ayrıdır: bir admin tatbikatta iletişim rolü oynayabilir.
  senaryo_rolu text not null,
  -- belge §7.4: yönetici/katılımcı/gözlemci farklı yetkilere sahip.
  katilim_tipi text not null check (katilim_tipi in ('yonetici', 'katilimci', 'gozlemci')),
  created_at timestamptz not null default now(),
  unique (run_id, user_id)
);

create index simulation_participants_run_idx on public.simulation_participants (run_id);

/**
 * Yayınlanmış inject teslimatı. Bir inject KATILIMCIYA ancak yayınlandığında
 * görünür (belge §7.4: "katılımcı kendi rolü dışındaki gizli gelişmeleri
 * göremez").
 *
 * NEDEN AYRI TABLO: şablondaki inject herkese açık kütüphane verisidir; asıl
 * gizlilik "bu tatbikatta şu ana kadar ne yayınlandı" bilgisindedir. Zaman
 * çizelgesini önceden görebilen katılımcı tatbikatı anlamsızlaştırır.
 */
create table public.simulation_inject_deliveries (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.simulation_runs (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  inject_id uuid not null references public.scenario_injects (id) on delete restrict,
  yayinlandi_at timestamptz not null default now(),
  yayinlayan uuid references public.profiles (id) on delete set null,
  -- Aynı inject iki kez yayınlanamaz (belge Faz 7 kabul kriteri:
  -- "aynı inject iki kez yayınlanmıyor"). Idempotency'yi şema garanti eder,
  -- uygulama koduna bırakılmaz.
  unique (run_id, inject_id)
);

create index simulation_inject_deliveries_run_idx on public.simulation_inject_deliveries (run_id);

create table public.simulation_decisions (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.simulation_runs (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  decision_point_id uuid not null references public.scenario_decision_points (id) on delete restrict,
  katilimci_id uuid not null references public.profiles (id) on delete restrict,
  -- Karar türü şablonda belirlenir (secim/serbest_metin/gorev/dosya/onay);
  -- burada ne verildiği durur.
  cevap text,
  evidence_id uuid references public.evidences (id) on delete set null,
  -- Senaryo zamanı (dakika): gerçek zamandan AYRI tutulur (belge §8.2).
  -- Hızlandırılmış modda gerçek 1 dakika, senaryo 12 dakikası olabilir.
  senaryo_dakika integer not null check (senaryo_dakika >= 0),
  created_at timestamptz not null default now()
);

create index simulation_decisions_run_idx on public.simulation_decisions (run_id);

create table public.simulation_observations (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.simulation_runs (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  gozlemci_id uuid not null references public.profiles (id) on delete restrict,
  not_metni text not null,
  -- Gözlemci notunu katılımcılara gösterme/gizleme seçeneği (belge §7.4).
  katilimcilara_acik boolean not null default false,
  control_id uuid references public.controls (id) on delete set null,
  senaryo_dakika integer check (senaryo_dakika >= 0),
  created_at timestamptz not null default now()
);

create index simulation_observations_run_idx on public.simulation_observations (run_id);

/**
 * Bulgu önerisi. Kural 11: PROPOSED doğar, insan kabul etmeden gerçek bulgu
 * olmaz (belge §9.4 sonu).
 *
 * finding_id: kabul edildiğinde oluşan gerçek bulguya bağ. Öneri silinmez —
 * reddedilse bile kaydı kalır, çünkü "sistem şunu önerdi, biz reddettik"
 * bilgisi denetimde anlamlıdır.
 */
create table public.simulation_finding_proposals (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.simulation_runs (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  control_id uuid references public.controls (id) on delete set null,
  baslik text not null,
  gerekce text not null,
  onem text not null check (onem in ('acil', 'kritik', 'yuksek', 'orta', 'dusuk')),
  durum text not null default 'PROPOSED' check (durum in ('PROPOSED', 'KABUL', 'RET')),
  finding_id uuid references public.findings (id) on delete set null,
  karar_veren uuid references public.profiles (id) on delete set null,
  karar_at timestamptz,
  created_at timestamptz not null default now()
);

create index simulation_finding_proposals_run_idx on public.simulation_finding_proposals (run_id);

alter table public.simulation_runs enable row level security;
alter table public.simulation_participants enable row level security;
alter table public.simulation_inject_deliveries enable row level security;
alter table public.simulation_decisions enable row level security;
alter table public.simulation_observations enable row level security;
alter table public.simulation_finding_proposals enable row level security;

create policy simulation_runs_own_tenant on public.simulation_runs
  for all using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy simulation_participants_own_tenant on public.simulation_participants
  for all using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

/**
 * ROL BAZLI GÖRÜNÜRLÜK — belgenin Faz 7 kabul kriteri:
 * "katılımcı yalnız kendi rolünün gelişmelerini görüyor".
 *
 * Bu bir UI filtresi DEĞİL, RLS kuralıdır: istemcide filtrelenseydi, ağ
 * sekmesini açan katılımcı diğer rollerin gizli gelişmelerini okur ve
 * tatbikat anlamsızlaşırdı.
 *
 * Kural: gelişme herkese açıksa (gorunur_roller boş) tüm kiracı görür;
 * değilse yalnızca o role atanmış katılımcılar, tatbikat yöneticileri ve
 * gözlemciler görür.
 */
create policy simulation_inject_deliveries_rol_bazli on public.simulation_inject_deliveries
  for select using (
    tenant_id = public.current_tenant_id()
    and exists (
      select 1
      from public.scenario_injects si
      where si.id = inject_id
        and (
          -- Herkese açık gelişme
          cardinality(si.gorunur_roller) = 0
          -- ya da katılımcının senaryo rolü listede
          or exists (
            select 1 from public.simulation_participants p
            where p.run_id = simulation_inject_deliveries.run_id
              and p.user_id = auth.uid()
              and (
                p.senaryo_rolu = any (si.gorunur_roller)
                -- Yönetici ve gözlemci her şeyi görür: yönetici zaten
                -- senaryoyu yayınlayan taraftır, gözlemci de değerlendirir.
                or p.katilim_tipi in ('yonetici', 'gozlemci')
              )
          )
        )
    )
  );

-- Yayınlama yalnızca tatbikat yöneticisinin işi.
create policy simulation_inject_deliveries_yonetici_yayinlar on public.simulation_inject_deliveries
  for insert with check (
    tenant_id = public.current_tenant_id()
    and exists (
      select 1 from public.simulation_participants p
      where p.run_id = simulation_inject_deliveries.run_id
        and p.user_id = auth.uid()
        and p.katilim_tipi = 'yonetici'
    )
  );

create policy simulation_decisions_own_tenant on public.simulation_decisions
  for select using (tenant_id = public.current_tenant_id());

-- Katılımcı yalnızca KENDİ adına karar verebilir: başkasının adına karar
-- yazılabilseydi tatbikat sonucu ve puanlaması anlamsız olurdu.
create policy simulation_decisions_kendi_adina on public.simulation_decisions
  for insert with check (
    tenant_id = public.current_tenant_id()
    and katilimci_id = auth.uid()
  );

create policy simulation_observations_own_tenant on public.simulation_observations
  for select using (
    tenant_id = public.current_tenant_id()
    and (
      katilimcilara_acik
      -- Gizli not yalnızca yazarına, yöneticiye ve diğer gözlemcilere görünür.
      or gozlemci_id = auth.uid()
      or exists (
        select 1 from public.simulation_participants p
        where p.run_id = simulation_observations.run_id
          and p.user_id = auth.uid()
          and p.katilim_tipi in ('yonetici', 'gozlemci')
      )
    )
  );

create policy simulation_observations_gozlemci_yazar on public.simulation_observations
  for insert with check (
    tenant_id = public.current_tenant_id()
    and gozlemci_id = auth.uid()
    and exists (
      select 1 from public.simulation_participants p
      where p.run_id = simulation_observations.run_id
        and p.user_id = auth.uid()
        and p.katilim_tipi in ('yonetici', 'gozlemci')
    )
  );

create policy simulation_finding_proposals_own_tenant on public.simulation_finding_proposals
  for select using (tenant_id = public.current_tenant_id());

-- Öneriyi SİSTEM üretir (puanlama), istemci değil: kullanıcı kendi önerisini
-- yazabilseydi "sistem tespit etti" iddiası anlamını yitirirdi.
revoke insert on public.simulation_finding_proposals from authenticated, anon;

-- Kararlar ve gözlem notları append-only: verilmiş bir karar sonradan
-- düzeltilemez (belge §11.2 audit gereksinimi).
revoke update, delete on public.simulation_decisions from authenticated, anon;
revoke update, delete on public.simulation_observations from authenticated, anon;
revoke update, delete on public.simulation_inject_deliveries from authenticated, anon;
