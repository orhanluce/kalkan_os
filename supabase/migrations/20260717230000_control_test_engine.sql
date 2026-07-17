-- Kontrol test motoru + durum makinesi (docs/ROADMAP.md M12, belge M02).
--
-- NE EKLER: bir kontrolün "tasarlandı" değil "gerçekten çalışıyor" durumunu
-- deterministik testlerle ölçen iki tablo. Değerlendirme mantığı saf ve
-- test edilmiş (src/lib/control-test.ts); burası kalıcılık + kural 13'ün
-- şema-seviyesinde zorlanması.
--
-- KURAL 13 ŞEMADA: test_runs.sonuc, beş AYRI durumdan biridir ve check
-- constraint bunları birleştirilemez kılar. 'FAILED' ile 'UNKNOWN' aynı
-- kolonda ama asla aynı değer değil — toplama arızası 'UNKNOWN' yazar,
-- 'FAILED' değil (motorun kalbi). Bu ilke 2026 belgesinden beri geçerliydi;
-- burada fiilen şemaya giriyor.

create table public.control_test_definitions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  control_id uuid not null references public.controls (id) on delete cascade,
  tur text not null check (tur in (
    'MANUAL_PROCEDURE', 'CONFIG_ASSERTION', 'SAMPLE_REVIEW', 'ATTACK_SIMULATION', 'RESTORE_TEST'
  )),
  ad text not null,
  aciklama text,
  -- Tazelik penceresi (gün): ölçüm bundan eskiyse sonuç STALE. null = şart yok.
  tazelik_gun integer check (tazelik_gun is null or tazelik_gun > 0),
  -- Grace: başarısızlık bulguya dönmeden önceki tolerans (gün). İlke için
  -- kolon açılıyor; kullanımı bir sonraki dilimde (bulgu üretimi) bağlanacak.
  grace_gun integer check (grace_gun is null or grace_gun >= 0),
  -- CONFIG_ASSERTION için beklenen değer (kanonik karşılaştırılır).
  beklenen jsonb,
  -- Başarısızlığın önem derecesi — bulgu üretilirse bu önemi taşır (findings ile aynı sözlük).
  basarisizlik_onem text not null default 'yuksek'
    check (basarisizlik_onem in ('acil', 'kritik', 'yuksek', 'orta', 'dusuk')),
  otomatik_bulgu boolean not null default true,
  -- Bulgu kapanışı retest ister mi (kural 14). Kritik testlerde daima true.
  retest_gerekli boolean not null default true,
  tanim_surumu integer not null default 1 check (tanim_surumu > 0),
  created_at timestamptz not null default now()
);

create index control_test_definitions_tenant_idx
  on public.control_test_definitions (tenant_id, control_id);

/**
 * Test koşuları — APPEND-ONLY (kural 2). Bir test sonucu tarihsel bir olgudur:
 * "şu an şu ölçüldü". Sonradan değiştirilirse denetimin dayanağı kalmaz.
 * Bu yüzden UPDATE/DELETE istemci rollerinden revoke edilir.
 */
create table public.test_runs (
  id uuid primary key default gen_random_uuid(),
  seq bigint generated always as identity,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  test_definition_id uuid not null references public.control_test_definitions (id) on delete cascade,
  -- Sorgu kolaylığı için denormalize: kontrolün son test durumu tek join'le çıksın.
  control_id uuid not null references public.controls (id) on delete cascade,
  -- KURAL 13: beş ayrı durum, birleştirilemez.
  sonuc text not null check (sonuc in ('PASSED', 'FAILED', 'UNKNOWN', 'STALE', 'EXCEPTION')),
  -- NEDEN bu sonuç — kural 11. Boş olamaz: gerekçesiz sonuç yazılamaz.
  gerekce text not null,
  -- Testin fiilen gözlediği şey (control-test.ts'teki Gozlem). Determinizmin
  -- girdisi: aynı gözlem + aynı tanım sürümü aynı sonucu verir.
  gozlem jsonb,
  -- Hangi tanım sürümü koştu — denetçi aynı sürümle yeniden hesaplayabilsin.
  tanim_surumu integer not null,
  -- Testin dayandığı kanıt (varsa).
  evidence_id uuid references public.evidences (id) on delete set null,
  calisti_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index test_runs_control_idx on public.test_runs (control_id, seq desc);
create index test_runs_definition_idx on public.test_runs (test_definition_id, seq desc);

alter table public.control_test_definitions enable row level security;
alter table public.test_runs enable row level security;

-- Tanımlar kiracının kendi verisidir: kendi testlerini kurar/düzenler.
create policy control_test_definitions_select on public.control_test_definitions
  for select using (tenant_id = public.current_tenant_id());
create policy control_test_definitions_insert on public.control_test_definitions
  for insert with check (tenant_id = public.current_tenant_id());
create policy control_test_definitions_update on public.control_test_definitions
  for update using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- Koşular okunur ve eklenir; DEĞİŞTİRİLEMEZ/SİLİNEMEZ (append-only).
create policy test_runs_select on public.test_runs
  for select using (tenant_id = public.current_tenant_id());
create policy test_runs_insert on public.test_runs
  for insert with check (tenant_id = public.current_tenant_id());

revoke update, delete on public.test_runs from authenticated, anon;

/**
 * Bir kontrolün her tanımı için EN SON test sonucunu döndürür.
 *
 * Durum BİRLEŞTİRME burada YAPILMAZ — bilinçli: öncelik mantığı (FAILED >
 * STALE > UNKNOWN > EXCEPTION > PASSED) tek yerde, TS'te (kontrolGuvenceDurumu)
 * durur. İki yerde tutmak, SQL ile TS'in sessizce ayrışacağı bir yer yaratırdı.
 * Bu fonksiyon ham malzemeyi verir; birleştirmeyi çağıran yapar.
 */
create or replace function public.kontrol_son_test_sonuclari(target_control_id uuid)
returns table (test_definition_id uuid, sonuc text, gerekce text, calisti_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select distinct on (r.test_definition_id)
    r.test_definition_id, r.sonuc, r.gerekce, r.calisti_at
  from public.test_runs r
  where r.control_id = target_control_id
  order by r.test_definition_id, r.seq desc
$$;
