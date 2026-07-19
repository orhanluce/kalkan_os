-- SCITT tarzı şeffaflık defteri + imzalı ağaç başları (docs/ROADMAP.md M5.5,
-- ADR-M11-02/03; nihai talimat §8 Gate G3).
--
-- NE EKLER: imzalı ifadeler (bir artefakt özeti + üzerine JWS) append-only,
-- Merkle destekli bir kütüğe yazılır; imzalı ağaç başı (STH) yayınlanınca her
-- ifade için ÇEVRİMDIŞI kapsama (inclusion) makbuzu üretilebilir. Mantık saf
-- katmanda: src/lib/transparency.ts (Merkle merkle.ts'ten YENİDEN kullanılır).
--
-- İKİ TABLO, APPEND-ONLY:
--   transparency_ledger_entries — imzalı ifadeler; hash ZİNCİRİ (audit_log
--     deseni): her kaydın entry_hash'i öncekini kapsar → sessiz kurcalama
--     tespit edilebilir. leaf_index tenant başına sıralıdır (Merkle yaprağı).
--   transparency_checkpoints — imzalı ağaç başı (STH): o andaki tenant kökü,
--     ES256 imzalı; opsiyonel NİTELİKLİ TSA token'ı (RFC 3161) taşıyabilir.
--
-- NEDEN ZAMAN DAMGASI OPSİYONEL ve AYRI: STH "kütük şu boyda ve şu kökte"
-- der (sıra + değişmezlik); ama "şu kök ŞU TAKVİM ANINDA vardı"yı bağımsız
-- kanıtlayan tek şey nitelikli bir RFC 3161 TSA'dır (ADR-M11-03). TSA sağlayıcı
-- kararı bekliyor (OPEN_DECISION #7); token null olabilir. Yerel geliştirme
-- damgası ('local-dev-*') NİTELİKLİ SAYILMAZ — durum türetimi onu
-- 'dis_zaman_damgali'ya yükseltmez (manifest_dogrulama_durumu ile aynı dürüstlük).

-- --- Defter kaydı (imzalı ifade, hash zinciri) ---
create table public.transparency_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  seq bigint generated always as identity,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  -- Tenant başına 0'dan artan Merkle yaprak indeksi (seal trigger hesaplar).
  leaf_index bigint not null default -1,
  statement_kind text not null,
  statement_hash text not null check (statement_hash ~ '^[0-9a-f]{64}$'),
  -- İmzalı ifadenin tamamı (jws + kid + publicJwk) — bağımsız doğrulayıcı
  -- yaprağı bundan yeniden hesaplar.
  signed_statement jsonb not null,
  -- İfadenin kanonik SHA-256'sı (Merkle yaprağı). Rota SUNUCUDA hesaplar,
  -- istemciye güvenilmez; kurcalanırsa çevrimdışı doğrulayıcı yakalar.
  leaf_hash text not null check (leaf_hash ~ '^[0-9a-f]{64}$'),
  previous_entry_hash text,
  entry_hash text not null default '',
  kaydedildi_at timestamptz not null default now()
);

create unique index transparency_entries_tenant_leaf
  on public.transparency_ledger_entries (tenant_id, leaf_index);
create index transparency_entries_tenant_seq
  on public.transparency_ledger_entries (tenant_id, seq desc);

/**
 * SEAL: leaf_index + hash zincirini DB'de kurar (istemci değerlerini EZER —
 * audit_log_seal deseni). Tenant başına advisory lock ile eşzamanlı insert'ler
 * zinciri çatallamasın. digest() için search_path = public, extensions
 * (canlıda pgcrypto extensions şemasında — 20260717093000 dersi).
 */
create or replace function public.transparency_entry_seal()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_prev text;
  v_index bigint;
begin
  perform pg_advisory_xact_lock(hashtext(new.tenant_id::text));

  select entry_hash, leaf_index into v_prev, v_index
  from public.transparency_ledger_entries
  where tenant_id = new.tenant_id
  order by leaf_index desc
  limit 1;

  new.leaf_index := coalesce(v_index + 1, 0);
  new.previous_entry_hash := v_prev; -- ilk kayıtta null
  new.entry_hash := encode(digest(
    concat_ws(
      chr(31),
      coalesce(v_prev, ''),
      new.tenant_id::text,
      new.leaf_index::text,
      new.statement_kind,
      new.statement_hash,
      new.leaf_hash
    ), 'sha256'), 'hex');

  return new;
end;
$$;

create trigger transparency_entry_seal_before_insert
  before insert on public.transparency_ledger_entries
  for each row execute function public.transparency_entry_seal();

-- --- İmzalı ağaç başı (STH / checkpoint) ---
create table public.transparency_checkpoints (
  id uuid primary key default gen_random_uuid(),
  seq bigint generated always as identity,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  tree_size bigint not null check (tree_size > 0),
  root_hash text not null check (root_hash ~ '^[0-9a-f]{64}$'),
  -- STH imzası (ES256 detached JWS). signer_ad 'local-dev-*' ise production
  -- authenticity taşımaz (imza deseni).
  sth_jws text not null,
  sth_kid text not null,
  sth_public_jwk jsonb not null,
  signer_ad text not null,
  -- Nitelikli RFC 3161 TSA token'ı (OPEN_DECISION #7 bağlanınca dolar).
  timestamp_token jsonb,
  timestamp_saglayici text,
  olusturuldu_at timestamptz not null default now()
);

create index transparency_checkpoints_tenant_idx
  on public.transparency_checkpoints (tenant_id, tree_size desc);

/**
 * CHECKPOINT GUARD: STH gerçek bir ön eki kapsamalı — tree_size, tenant'ın o
 * andaki kayıt sayısına EŞİT olmalı (uydurma boyutlu STH yok). Kök doğruluğu
 * SQL'de RFC 6962 hesaplanamayacağı için burada değil, çevrimdışı doğrulayıcı
 * + birim testleriyle kanıtlanır; DB yalnız boyutu gerçeğe sabitler.
 */
create or replace function public.transparency_checkpoint_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count bigint;
begin
  select count(*) into v_count
  from public.transparency_ledger_entries
  where tenant_id = new.tenant_id;

  if new.tree_size is distinct from v_count then
    raise exception 'STH boyutu (%) kutuk kayit sayisiyla (%) uyusmuyor', new.tree_size, v_count;
  end if;

  return new;
end;
$$;

create trigger transparency_checkpoint_guard_before_insert
  before insert on public.transparency_checkpoints
  for each row execute function public.transparency_checkpoint_guard();

-- --- Değişmezlik: her iki tablo da UPDATE reddeder (append-only, kural 2) ---
-- DELETE'e izin verilir (yalnız tenant cascade); istemci DELETE'i RLS/revoke
-- ile zaten kapalı. UPDATE service_role dahil reddedilir (kurcalama tespiti
-- ancak zincir değiştirilemezse anlamlı).
create or replace function public.transparency_immutable()
returns trigger
language plpgsql
as $$
begin
  if TG_OP = 'UPDATE' then
    raise exception 'Seffaflik defteri append-only: UPDATE yasak (yeni kayit ekleyin)';
  end if;
  return old;
end;
$$;

create trigger transparency_entries_immutable
  before update on public.transparency_ledger_entries
  for each row execute function public.transparency_immutable();
create trigger transparency_checkpoints_immutable
  before update on public.transparency_checkpoints
  for each row execute function public.transparency_immutable();

-- --- Denetim izi: STH yayını (invariant #15, tenant-scope) ---
create or replace function public.audit_transparency_checkpoint()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
  values (new.tenant_id, auth.uid(), 'seffaflik_agac_basi_yayinlandi', 'transparency_checkpoints', new.id,
    jsonb_build_object(
      'tree_size', new.tree_size,
      'root_hash', new.root_hash,
      'nitelikli_damga', (new.timestamp_saglayici is not null and new.timestamp_saglayici not like 'local-dev%')
    ));
  return new;
end;
$$;

create trigger audit_transparency_checkpoint_after_insert
  after insert on public.transparency_checkpoints
  for each row execute function public.audit_transparency_checkpoint();

/**
 * Bir defter kaydının dış-doğrulanabilirlik durumu (ADR-M11-03 dürüstlük):
 *   'kaydedilmedi'        kayıt yok
 *   'defterde_beklemede'  kütükte var ama henüz onu kapsayan STH yok
 *   'seffaflik_defterinde' STH kapsıyor → çevrimdışı kapsama doğrulanabilir
 *   'dis_zaman_damgali'   kapsayan STH NİTELİKLİ TSA damgası taşıyor
 *
 * 'local-dev-*' damga NİTELİKLİ sayılmaz — yerel damga durumu yükseltmez.
 */
create or replace function public.transparency_dogrulama_durumu(target_entry_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  with e as (
    select tenant_id, leaf_index
    from public.transparency_ledger_entries
    where id = target_entry_id
  ),
  kapsayan as (
    -- Kaydı kapsayan TÜM STH'ler (tree_size > leaf_index). Nitelikli damga
    -- bunlardan HERHANGİ birinde varsa yeter — limit 1 nitelikliyi kaçırırdı.
    select c.timestamp_saglayici
    from public.transparency_checkpoints c, e
    where c.tenant_id = e.tenant_id
      and c.tree_size > e.leaf_index
  )
  select case
    when not exists (select 1 from e) then 'kaydedilmedi'
    when not exists (select 1 from kapsayan) then 'defterde_beklemede'
    when exists (
      select 1 from kapsayan
      where timestamp_saglayici is not null and timestamp_saglayici not like 'local-dev%'
    ) then 'dis_zaman_damgali'
    else 'seffaflik_defterinde'
  end
$$;

-- --- RLS: tenant'a kilitli; yazma admin/uyum; UPDATE/DELETE kapalı ---
alter table public.transparency_ledger_entries enable row level security;
alter table public.transparency_checkpoints enable row level security;

create policy transparency_entries_select on public.transparency_ledger_entries
  for select using (tenant_id = public.current_tenant_id());
create policy transparency_entries_insert on public.transparency_ledger_entries
  for insert with check (
    tenant_id = public.current_tenant_id() and public.current_user_role() in ('admin', 'uyum')
  );

create policy transparency_checkpoints_select on public.transparency_checkpoints
  for select using (tenant_id = public.current_tenant_id());
create policy transparency_checkpoints_insert on public.transparency_checkpoints
  for insert with check (
    tenant_id = public.current_tenant_id() and public.current_user_role() in ('admin', 'uyum')
  );

-- Append-only: UPDATE/DELETE hiçbir istemciye açık değil (INSERT + SELECT var).
revoke update, delete on public.transparency_ledger_entries from authenticated, anon;
revoke update, delete on public.transparency_checkpoints from authenticated, anon;
