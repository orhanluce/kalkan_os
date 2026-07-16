-- Merkle parti sabitleme kalıcılığı (docs/ROADMAP.md M5.5, şartname §9.2).
--
-- ÜÇ TABLO, HEPSİ APPEND-ONLY:
--   anchor_batches       — parti ve Merkle kökü (asla değişmez)
--   anchor_batch_leaves  — partideki kanıtlar (proof yeniden üretilebilsin)
--   anchor_receipts      — sağlayıcıdan dönen makbuz (sonradan gelir)
--
-- NEDEN MAKBUZ AYRI TABLODA: şartname §9.2 "batch yeniden yazılamaz" diyor,
-- ama makbuz sabitleme işi bittiğinde ASENKRON gelir. Aynı satıra sonradan
-- yazsaydık parti artık immutable olmazdı ve "kök değişmedi" güvencesi
-- uygulama koduna kalırdı. Bunun yerine makbuz eklenir, partinin durumu ondan
-- TÜRETİLİR (anchor_batch_durumu) — evidence_reviews'teki desenin aynısı.
--
-- Bu ayrıca §9.2'nin bir başka şartını bedavaya karşılar: "anchor sağlayıcısı
-- yoksa kanıt kabul akışı durmamalı, durum PENDING_ANCHOR olmalıdır".
-- Makbuzsuz parti doğal olarak 'beklemede'dir; sağlayıcı çalışmıyorsa sistem
-- yalnızca makbuzsuz kalır, veri kaybetmez.

create table public.anchor_batches (
  id uuid primary key default gen_random_uuid(),
  seq bigint generated always as identity,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  -- SHA-256 hex: 64 karakter. Kök burada saklanır ve ASLA güncellenmez.
  merkle_root text not null check (merkle_root ~ '^[0-9a-f]{64}$'),
  yaprak_sayisi integer not null check (yaprak_sayisi > 0),
  created_at timestamptz not null default now()
);

create index anchor_batches_tenant_id_idx on public.anchor_batches (tenant_id, seq desc);

-- Partideki kanıtlar. Yaprak SIRASI saklanmaz — anchor.ts kökü hash'e göre
-- sıralayarak üretir, dolayısıyla sıra bu listeden yeniden hesaplanabilir.
-- Sırayı ayrıca saklamak, iki kaynağın (saklanan sıra ve hesaplanan sıra)
-- sessizce ayrışabileceği bir yer yaratırdı.
create table public.anchor_batch_leaves (
  batch_id uuid not null references public.anchor_batches (id) on delete cascade,
  evidence_id uuid not null references public.evidences (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  primary key (batch_id, evidence_id)
);

create index anchor_batch_leaves_evidence_idx on public.anchor_batch_leaves (evidence_id);

create table public.anchor_receipts (
  id uuid primary key default gen_random_uuid(),
  seq bigint generated always as identity,
  batch_id uuid not null references public.anchor_batches (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  saglayici text not null,
  anchored_at timestamptz not null,
  payload jsonb,
  created_at timestamptz not null default now()
);

create index anchor_receipts_batch_idx on public.anchor_receipts (batch_id, seq desc);

/**
 * Makbuz ile partinin tutarlılığını zorlar.
 *
 * Trigger'da, RLS'te değil: RLS yalnızca authenticated/anon'a uygulanır ve
 * sabitleme işini yapan taraf büyük olasılıkla service_role olacak — yani
 * kuralın RLS'te olması onu tam da uygulanması gereken yolda atlatırdı
 * (evidence_review_guard ile aynı gerekçe).
 */
create or replace function public.anchor_receipt_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
begin
  select tenant_id into v_tenant from public.anchor_batches where id = new.batch_id;

  if v_tenant is null then
    raise exception 'Parti bulunamadi';
  end if;

  if new.tenant_id is distinct from v_tenant then
    raise exception 'Parti baska bir kiraciya ait';
  end if;

  return new;
end;
$$;

create trigger anchor_receipt_guard_before_insert
  before insert on public.anchor_receipts
  for each row execute function public.anchor_receipt_guard();

alter table public.anchor_batches enable row level security;
alter table public.anchor_batch_leaves enable row level security;
alter table public.anchor_receipts enable row level security;

create policy anchor_batches_select_own_tenant on public.anchor_batches
  for select using (tenant_id = public.current_tenant_id());

create policy anchor_batch_leaves_select_own_tenant on public.anchor_batch_leaves
  for select using (tenant_id = public.current_tenant_id());

create policy anchor_receipts_select_own_tenant on public.anchor_receipts
  for select using (tenant_id = public.current_tenant_id());

-- INSERT politikası YOK: sabitleme bir SİSTEM işidir (arka plan görevi,
-- service_role). Kullanıcıların elle parti oluşturması veya makbuz yazması
-- için hiçbir meşru sebep yok — verebilecekleri tek şey sahte bir zaman
-- iddiası olurdu. Okuma açık, yazma değil.
revoke insert, update, delete on public.anchor_batches from authenticated, anon;
revoke insert, update, delete on public.anchor_batch_leaves from authenticated, anon;
revoke insert, update, delete on public.anchor_receipts from authenticated, anon;

/**
 * Partinin türetilmiş durumu: makbuz varsa 'sabitlendi', yoksa 'beklemede'
 * (şartname §9.2'deki PENDING_ANCHOR).
 *
 * 'basarisiz' diye bir durum YOK ve bu bilinçli: başarısız sabitleme kalıcı
 * bir durum değil, tekrar denenecek bir iştir (§9.2: "başarısız anchor işi
 * idempotent olarak tekrar edilir"). Partiyi 'basarisiz' diye işaretlemek,
 * yeniden denenebilir bir işi nihai bir sonuç gibi gösterirdi.
 */
create or replace function public.anchor_batch_durumu(target_batch_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when exists (select 1 from public.anchor_receipts where batch_id = target_batch_id)
      then 'sabitlendi'
    else 'beklemede'
  end
$$;

/**
 * Bir kanıtın en son sabitlenmiş partisi ve o partinin kökü. Bağımsız
 * doğrulama ekranının giriş noktası: kanıttan köke buradan ulaşılır.
 * Kanıt hiç sabitlenmemişse boş döner.
 */
create or replace function public.evidence_anchor_bilgisi(target_evidence_id uuid)
returns table (batch_id uuid, merkle_root text, durum text, anchored_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select
    b.id,
    b.merkle_root,
    public.anchor_batch_durumu(b.id),
    (
      select r.anchored_at from public.anchor_receipts r
      where r.batch_id = b.id order by r.seq desc limit 1
    )
  from public.anchor_batch_leaves l
  join public.anchor_batches b on b.id = l.batch_id
  where l.evidence_id = target_evidence_id
  order by b.seq desc
  limit 1
$$;
