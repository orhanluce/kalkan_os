-- K2 — Kritik Zamanlanmış Görev Güvenilirliği (repo-içi kısım, kod yok
-- Supabase canlı değişikliği YOK). Bu migration `ledger_outbox`/
-- `artifact_ledger_links`'in ÜZERİNE eklemeli çalışır — genel bir queue
-- tablosuna taşınmaz (docs/adr/PR0-K2-... §3'ün kararı: mevcut model
-- güçlendirilmesi yeterli).
--
-- EKLENENLER:
-- 1. `ledger_outbox_ayarlari` — tek satırlı, tüm sistem için tüketici
--    açma/kapama anahtarı (K1 kararı 5: restore hedefinde consumer
--    VARSAYILAN KAPALI başlamalı — bugüne kadar bunun somut bir mekanizması
--    yoktu, yalnız operasyonel bir hatırlatmaydı).
-- 2. `ledger_outbox_claim`: kill-switch kontrolü eklenir (davranış aynı,
--    yalnız anahtar kapalıyken hiçbir satır claim edilmez).
-- 3. `ledger_outbox_mark_failed_terminal` — YENİ, AYRI isimli RPC (mevcut
--    2 parametreli `ledger_outbox_mark_failed` HİÇ değişmedi/dokunulmadı):
--    yeniden denenmesi ANLAMSIZ hatalar (örn. manifest builder yok — bir
--    yapılandırma/wiring eksikliği, retry ile düzelmez) deneme bütçesini
--    beklemeden doğrudan FAILED'e düşer.
-- 4. `ledger_outbox_mark_processed`: aynı artefakt için FARKLI bir
--    ledger_entry_id ile ikinci kez çağrılırsa (crash-retry sonrası
--    duplicate leaf senaryosu) artık SESSİZCE yutulmaz — audit_log'a
--    "olası orphan leaf" izi düşer (silme YOK, immutable deftere dokunulmaz
--    — yalnız GÖRÜNÜR kılınır).
-- 5. `ledger_outbox_manual_retry` — YENİ RPC: FAILED (dead-letter) bir
--    kaydı admin/uyum kararıyla PENDING'e döndürür, audit izi bırakır,
--    eşzamanlı çağrılara karşı doğal olarak güvenlidir (WHERE durum =
--    'FAILED' guard'ı — repo'nun `dsar_paket_guard` ailesiyle aynı desen).
-- 6. `ledger_outbox_saglik_ozeti` — YENİ, salt-okur operasyon görünürlüğü:
--    pending/stale-processing/failed sayıları + en eski pending yaşı +
--    job_type (statement_kind) bazında özet. platform_operator için
--    TENANT-BAĞIMSIZ toplam sayılar (hiçbir tenant kimliği/payload
--    sızdırmaz); normal kullanıcı için yalnız KENDİ tenant'ının özeti.

-- ============================================================================
-- 1. KILL-SWITCH
-- ============================================================================

create table public.ledger_outbox_ayarlari (
  id integer primary key default 1 check (id = 1), -- tek satırlı singleton
  consumer_etkin boolean not null default true,
  degistiren uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.ledger_outbox_ayarlari (id, consumer_etkin) values (1, true);

alter table public.ledger_outbox_ayarlari enable row level security;

-- Herkes (authenticated) durumu okuyabilir — UI'da/health'te göstermek için;
-- yalnız platform_operator değiştirebilir (kural: kod DEĞİL, operasyonel
-- bir anahtar; tenant-scoped bir ayar DEĞİL, sistem-genelinde).
create policy ledger_outbox_ayarlari_select on public.ledger_outbox_ayarlari
  for select using (auth.uid() is not null);

create policy ledger_outbox_ayarlari_update on public.ledger_outbox_ayarlari
  for update
  using (public.current_role() = 'platform_operator')
  with check (public.current_role() = 'platform_operator');

revoke insert, delete on public.ledger_outbox_ayarlari from authenticated, anon;

-- Not: audit_log.tenant_id NOT NULL'dır — bu sistem-geneli (tenant-bağımsız)
-- anahtar için audit_log'a yazmak ya kısıtı ihlal eder ya da uydurma bir
-- tenant_id gerektirir (ikisi de yanlış). İz, tablonun kendi
-- degistiren/updated_at alanlarıyla tutulur (tek satır, append-only değil
-- ama her değişiklik kim/ne zaman sorusuna cevap verir).
create or replace function public.ledger_outbox_ayarlari_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.degistiren := auth.uid();
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists ledger_outbox_ayarlari_audit_trg on public.ledger_outbox_ayarlari;
create trigger ledger_outbox_ayarlari_audit_trg
  before update on public.ledger_outbox_ayarlari
  for each row execute function public.ledger_outbox_ayarlari_audit();

-- ============================================================================
-- 2. CLAIM — KILL-SWITCH KONTROLÜ
-- ============================================================================

create or replace function public.ledger_outbox_claim(p_limit integer default 10)
returns setof public.ledger_outbox
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.current_tenant_id();
  v_etkin boolean;
begin
  if v_tenant is null then
    return;
  end if;

  select consumer_etkin into v_etkin from public.ledger_outbox_ayarlari where id = 1;
  if v_etkin is false then
    return; -- kill-switch kapalı: hiçbir satır claim edilmez (K1 kararı 5)
  end if;

  update public.ledger_outbox
  set durum = 'PENDING'
  where tenant_id = v_tenant
    and durum = 'PROCESSING'
    and islenme_at < now() - interval '5 minutes';

  return query
  with claimed as (
    select id from public.ledger_outbox
    where tenant_id = v_tenant and durum = 'PENDING'
    order by created_at
    limit p_limit
    for update skip locked
  )
  update public.ledger_outbox o
  set durum = 'PROCESSING', islenme_at = now()
  from claimed
  where o.id = claimed.id
  returning o.*;
end;
$$;

revoke all on function public.ledger_outbox_claim(integer) from public;
grant execute on function public.ledger_outbox_claim(integer) to authenticated;

-- ============================================================================
-- 3. TERMİNAL HATA — AYRI, YENİ İSİMLİ FONKSİYON (mevcut 2 parametreli
--    ledger_outbox_mark_failed(uuid, text) DOKUNULMADAN kalır — imzasını
--    değiştirmek/DROP etmek, 20260719120000'deki `revoke ... on function
--    ledger_outbox_mark_failed(uuid, text)` satırını STALE bırakırdı: PGlite
--    test harness'i (helpers/pg.ts) TÜM migration dosyalarındaki revoke
--    satırlarını migration'lar bittikten SONRA yeniden uygular — o satır
--    artık var olmayan bir imzayı hedefleyip patlardı. Bu yüzden yeniden
--    deneme ANLAMSIZ hatalar (manifest builder yok gibi — wiring eksikliği,
--    retry ile düzelmez) için YENİ, AYRI bir RPC eklenir.)
-- ============================================================================

create or replace function public.ledger_outbox_mark_failed_terminal(p_id uuid, p_hata text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.ledger_outbox
  set deneme_sayisi = deneme_sayisi + 1,
      son_hata = p_hata,
      islenme_at = now(),
      durum = 'FAILED'
  where id = p_id and tenant_id = public.current_tenant_id();
end;
$$;

revoke all on function public.ledger_outbox_mark_failed_terminal(uuid, text) from public;
grant execute on function public.ledger_outbox_mark_failed_terminal(uuid, text) to authenticated;

-- ============================================================================
-- 4. MARK_PROCESSED — ORPHAN-LEAF GÖRÜNÜRLÜĞÜ
-- ============================================================================

create or replace function public.ledger_outbox_mark_processed(p_id uuid, p_ledger_entry_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.ledger_outbox;
  v_mevcut_link uuid;
begin
  select * into v_row from public.ledger_outbox
  where id = p_id and tenant_id = public.current_tenant_id();
  if v_row.id is null then
    raise exception 'Outbox kaydi bulunamadi veya baska kiraciya ait';
  end if;

  select ledger_entry_id into v_mevcut_link
  from public.artifact_ledger_links
  where artifact_table = v_row.artifact_table and artifact_id = v_row.artifact_id;

  insert into public.artifact_ledger_links (tenant_id, artifact_table, artifact_id, ledger_entry_id)
  values (v_row.tenant_id, v_row.artifact_table, v_row.artifact_id, p_ledger_entry_id)
  on conflict (artifact_table, artifact_id) do nothing;

  -- DÜRÜSTLÜK: link ZATEN varsa ve YENİ gönderilen id ondan FARKLIYSA, bu
  -- ikinci imzalama denemesinin ürettiği entry artık deftere hiç
  -- bağlanmayacak bir "orphan leaf" olarak kalır (immutable defterden
  -- SİLİNMEZ — yalnız İZ bırakılır, operatör `ledger_outbox_saglik_ozeti`
  -- veya bu audit satırından fark eder).
  if v_mevcut_link is not null and v_mevcut_link is distinct from p_ledger_entry_id then
    insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
    values (
      v_row.tenant_id, auth.uid(), 'olasi_orphan_leaf_tespit_edildi', v_row.artifact_table, v_row.artifact_id,
      jsonb_build_object('kullanilanLedgerEntryId', v_mevcut_link, 'orphanLedgerEntryId', p_ledger_entry_id)
    );
  end if;

  update public.ledger_outbox
  set durum = 'PROCESSED', islenme_at = now()
  where id = p_id;

  insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
  values (v_row.tenant_id, auth.uid(), 'artefakt_deftere_muhurlendi', v_row.artifact_table, v_row.artifact_id,
    jsonb_build_object('ledgerEntryId', p_ledger_entry_id, 'statementKind', v_row.statement_kind));
end;
$$;

revoke all on function public.ledger_outbox_mark_processed(uuid, uuid) from public;
grant execute on function public.ledger_outbox_mark_processed(uuid, uuid) to authenticated;

-- ============================================================================
-- 5. MANUEL YENİDEN DENEME (dead-letter'dan kurtarma, admin/uyum kararı)
-- ============================================================================

create or replace function public.ledger_outbox_manual_retry(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.current_tenant_id();
  v_role text := public.current_role();
  v_updated integer;
begin
  if v_role not in ('admin', 'uyum') then
    raise exception 'Manuel yeniden deneme yalniz admin/uyum rolüne acik';
  end if;

  update public.ledger_outbox
  set durum = 'PENDING', deneme_sayisi = 0, son_hata = null, islenme_at = null
  where id = p_id and tenant_id = v_tenant and durum = 'FAILED';
  get diagnostics v_updated = row_count;

  if v_updated = 0 then
    -- Kayıt yok, başka kiracıya ait, veya zaten FAILED değil (paralel ikinci
    -- çağrı burada doğal olarak no-op olur — kural: aynı iş için paralel
    -- manuel retry çift etki üretmez).
    return false;
  end if;

  insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
  values (v_tenant, auth.uid(), 'outbox_kaydi_manuel_yeniden_denendi', 'ledger_outbox', p_id, '{}'::jsonb);
  return true;
end;
$$;

revoke all on function public.ledger_outbox_manual_retry(uuid) from public;
grant execute on function public.ledger_outbox_manual_retry(uuid) to authenticated;

-- ============================================================================
-- 6. OPERASYON GÖRÜNÜRLÜĞÜ — SALT-OKUR, MİNİMİZE ÖZET
-- ============================================================================

create or replace function public.ledger_outbox_saglik_ozeti()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role text := public.current_role();
  v_tenant uuid := public.current_tenant_id();
  v_ozet jsonb;
begin
  if v_role = 'platform_operator' then
    -- Tenant-bağımsız TOPLAM sayılar — hiçbir tenant_id/payload dönmez.
    select jsonb_build_object(
      'kapsam', 'GLOBAL',
      'pendingSayisi', count(*) filter (where durum = 'PENDING'),
      'staleProcessingSayisi', count(*) filter (where durum = 'PROCESSING' and islenme_at < now() - interval '5 minutes'),
      'processingSayisi', count(*) filter (where durum = 'PROCESSING'),
      'failedSayisi', count(*) filter (where durum = 'FAILED'),
      'enEskiPendingYasSaniye', extract(epoch from (now() - min(created_at) filter (where durum = 'PENDING'))),
      'jobTuruBazinda', (
        select coalesce(jsonb_object_agg(statement_kind, adet), '{}'::jsonb)
        from (
          select statement_kind, count(*) as adet
          from public.ledger_outbox
          where durum in ('PENDING', 'PROCESSING', 'FAILED')
          group by statement_kind
        ) k
      )
    ) into v_ozet
    from public.ledger_outbox;
    return v_ozet;
  end if;

  if v_tenant is null then
    return jsonb_build_object('kapsam', 'YOK');
  end if;

  select jsonb_build_object(
    'kapsam', 'TENANT',
    'pendingSayisi', count(*) filter (where durum = 'PENDING'),
    'staleProcessingSayisi', count(*) filter (where durum = 'PROCESSING' and islenme_at < now() - interval '5 minutes'),
    'processingSayisi', count(*) filter (where durum = 'PROCESSING'),
    'failedSayisi', count(*) filter (where durum = 'FAILED'),
    'enEskiPendingYasSaniye', extract(epoch from (now() - min(created_at) filter (where durum = 'PENDING'))),
    'jobTuruBazinda', (
      select coalesce(jsonb_object_agg(statement_kind, adet), '{}'::jsonb)
      from (
        select statement_kind, count(*) as adet
        from public.ledger_outbox
        where tenant_id = v_tenant and durum in ('PENDING', 'PROCESSING', 'FAILED')
        group by statement_kind
      ) k
    )
  ) into v_ozet
  from public.ledger_outbox
  where tenant_id = v_tenant;
  return v_ozet;
end;
$$;

revoke all on function public.ledger_outbox_saglik_ozeti() from public;
grant execute on function public.ledger_outbox_saglik_ozeti() to authenticated;
