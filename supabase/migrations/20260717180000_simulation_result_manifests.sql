-- Simülasyon sonuç manifesti (docs/ROADMAP.md M9, belge §11.3).
--
-- NE SAKLIYOR: bir tatbikatın "şu şablon sürümüyle, şu kararlar verilerek, şu
-- kanıtlara dayanarak, şu kurallarla, şu puan çıktı" iddiasının kanonik hali
-- ve o iddianın tek hash'i. Mantık src/lib/simulation-manifest.ts'te; burası
-- yalnızca kalıcılık ve DEĞİŞMEZLİK.
--
-- NEDEN anchor_batches'i YENİDEN KULLANMIYORUZ: o tablonun yaprakları
-- anchor_batch_leaves.evidence_id ile KANITA bağlı (not null, PK'nin parçası).
-- Manifest bir kanıt değil; oraya sıkıştırmak ya sahte bir evidence satırı
-- uydurmayı ya da yaprak_sayisi > 0 diyip yaprak tablosunu boş bırakmayı
-- gerektirirdi — ikisi de "kök yapraklardan yeniden hesaplanabilir"
-- güvencesini sessizce bozardı. Kod (merkle.ts, anchor.ts) yeniden
-- kullanılıyor; şema ayrı.
--
-- MAKBUZ NEDEN AYRI TABLODA: anchor_batches'teki gerekçenin aynısı. Manifest
-- satırı mühürlendiği anda immutable olmalı; makbuz ise sağlayıcıdan sonra
-- gelebilir. Aynı satıra sonradan yazsaydık manifest artık değişmez olmazdı.
-- Makbuzsuz manifest doğal olarak 'beklemede'dir.

create table public.simulation_result_manifests (
  id uuid primary key default gen_random_uuid(),
  seq bigint generated always as identity,
  -- Tatbikat başına TEK manifest: bir tatbikatın iki farklı "resmi sonucu"
  -- olamaz. Yeniden puanlama gerekiyorsa bu bilinçli bir engeldir, kaza değil.
  run_id uuid not null unique references public.simulation_runs (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  -- Kanonik manifest (simulation-manifest.ts'teki SimulationManifest).
  manifest jsonb not null,
  manifest_hash text not null check (manifest_hash ~ '^[0-9a-f]{64}$'),
  -- RaporVerisi'nin hash'i. PDF baytlarının DEĞİL — bkz. simulation-manifest.ts
  -- başındaki döngü açıklaması.
  rapor_hash text not null check (rapor_hash ~ '^[0-9a-f]{64}$'),
  -- Manifest hash'i üzerine kurulan Merkle kökü (tek yapraklı, RFC 6962).
  merkle_root text not null check (merkle_root ~ '^[0-9a-f]{64}$'),
  muhurlendi_at timestamptz not null default now()
);

create index simulation_result_manifests_tenant_idx
  on public.simulation_result_manifests (tenant_id, seq desc);

-- QR doğrulamasının giriş noktası: hash'ten manifeste. Tekil olmalı ki
-- doğrulama iki satır bulup hangisine güveneceğini soramasın.
create unique index simulation_result_manifests_hash_idx
  on public.simulation_result_manifests (manifest_hash);

create table public.simulation_manifest_receipts (
  id uuid primary key default gen_random_uuid(),
  seq bigint generated always as identity,
  manifest_id uuid not null references public.simulation_result_manifests (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  saglayici text not null,
  anchored_at timestamptz not null,
  payload jsonb,
  created_at timestamptz not null default now()
);

create index simulation_manifest_receipts_manifest_idx
  on public.simulation_manifest_receipts (manifest_id, seq desc);

/**
 * Manifest DEĞİŞMEZ (kural 2'nin ruhu, belge §11.3: "immutable").
 *
 * Trigger'da, RLS'te değil: RLS service_role'e uygulanmaz ve mührü yazan
 * taraf service_role. Kuralı yalnızca RLS'e koysaydık, tam da uygulanması
 * gereken yolda atlatılırdı (anchor_receipt_guard ile aynı gerekçe).
 *
 * DELETE'e neden izin var: yalnızca CASCADE ile — tatbikat silinirse manifesti
 * de gider. Doğrudan silme yolu yok çünkü authenticated/anon'dan delete
 * revoke edildi ve service_role'ün run'ı silmesi zaten bilinçli bir iştir.
 * (20260717170000'deki cascade hatası burada tekrarlanmasın diye DELETE'te
 * erken çıkıyoruz — trigger kendi cascade'ini bloke etmemeli.)
 */
create or replace function public.simulation_manifest_immutable()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    return old;
  end if;

  raise exception 'Sonuc manifesti degistirilemez (M9, belge 11.3)';
end;
$$;

create trigger simulation_manifest_immutable_before_update
  before update on public.simulation_result_manifests
  for each row execute function public.simulation_manifest_immutable();

/**
 * Makbuzun manifestle aynı kiracıya ait olduğunu zorlar.
 * anchor_receipt_guard'ın birebir muadili.
 */
create or replace function public.simulation_manifest_receipt_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
begin
  select tenant_id into v_tenant
  from public.simulation_result_manifests
  where id = new.manifest_id;

  if v_tenant is null then
    raise exception 'Manifest bulunamadi';
  end if;

  if new.tenant_id is distinct from v_tenant then
    raise exception 'Manifest baska bir kiraciya ait';
  end if;

  return new;
end;
$$;

create trigger simulation_manifest_receipt_guard_before_insert
  before insert on public.simulation_manifest_receipts
  for each row execute function public.simulation_manifest_receipt_guard();

alter table public.simulation_result_manifests enable row level security;
alter table public.simulation_manifest_receipts enable row level security;

create policy simulation_result_manifests_select_own_tenant
  on public.simulation_result_manifests
  for select using (tenant_id = public.current_tenant_id());

create policy simulation_manifest_receipts_select_own_tenant
  on public.simulation_manifest_receipts
  for select using (tenant_id = public.current_tenant_id());

-- INSERT/UPDATE/DELETE politikası YOK: mühürleme bir SİSTEM işidir
-- (puanlama rotası, service_role). Kullanıcının kendi sonuç manifestini
-- yazabilmesi, mührün ölçtüğü şeyi ortadan kaldırırdı (kural 11).
revoke insert, update, delete on public.simulation_result_manifests from authenticated, anon;
revoke insert, update, delete on public.simulation_manifest_receipts from authenticated, anon;

/**
 * Manifestin türetilmiş sabitleme durumu: makbuz varsa 'sabitlendi',
 * yoksa 'beklemede'. anchor_batch_durumu ile aynı gerekçe — 'basarisiz'
 * diye bir durum yok, sabitleme tekrar denenebilir bir iştir.
 */
create or replace function public.simulation_manifest_durumu(target_manifest_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when exists (
      select 1 from public.simulation_manifest_receipts where manifest_id = target_manifest_id
    ) then 'sabitlendi'
    else 'beklemede'
  end
$$;

/**
 * QR DOĞRULAMA — HERKESE AÇIK YÜZEY. Buraya alan eklemeden önce iki kez düşün.
 *
 * M9 kabul kriteri: "QR doğrulama hassas veri sızdırmıyor". Bu fonksiyon
 * kimlik doğrulaması ARAMAZ (rapordaki QR'ı okuyan denetçinin hesabı yoktur)
 * ve bu yüzden döndürdüğü her alan fiilen kamuya açıktır.
 *
 * DÖNDÜRÜLENLER ve neden güvenli:
 *   - muhurlendi_at / anchored_at / saglayici: zaman ve mühür iddiası.
 *   - rapor_hash: elindeki raporun verisini yeniden hash'leyip karşılaştırır.
 *   - durum: mühür sabitlendi mi.
 *
 * BİLİNÇLİ OLARAK DÖNDÜRÜLMEYENLER: tenant_id, kurum adı, senaryo kodu, puan,
 * kararlar, bulgular, manifest'in KENDİSİ. Hash'i eline geçiren biri
 * "hangi banka hangi tatbikattan kaç aldı" öğrenemez — yalnızca elindeki
 * belgenin sahici olup olmadığını öğrenir. Doğrulama bunu gerektirir,
 * fazlası sızıntıdır.
 *
 * Hash bulunamazsa BOŞ döner — "böyle bir manifest yok" ile "görme yetkin yok"
 * ayrımı yapılmaz, çünkü burada yetki diye bir şey yok.
 */
create or replace function public.manifest_dogrula(target_hash text)
returns table (
  rapor_hash text,
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
    m.rapor_hash,
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
  where m.manifest_hash = target_hash
$$;

-- anon DAHİL: QR'ı okuyan denetçinin oturumu yok (paylasim_goruntule ile
-- aynı desen, M4). Tabloya doğrudan erişimi hâlâ RLS engelliyor; yalnızca
-- bu veri-minimize edilmiş görünüm açık.
grant execute on function public.manifest_dogrula(text) to anon, authenticated;
