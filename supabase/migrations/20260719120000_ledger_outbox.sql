-- Transactional outbox → SCITT şeffaflık defteri otomatik bağlama
-- (nihai talimat v3.2 §8.0, tek sıradaki dikey).
--
-- NE EKLER: gerçek domain artefaktı (kontrol testi koşusu, DSAR karşılanma
-- paketi, ...) oluştuğunda AYNI transaction'da bir outbox olayı doğar —
-- kullanıcıdan ayrıca "deftere ekle" beklenmez. Ayrı bir drenaj adımı
-- (imzalama Web Crypto ister, plpgsql'de yapılamaz — kural 4 ruhu: kripto
-- TEK yerde, TS'te) statementi imzalar, G3 şeffaflık defterine (M5.5 Merkle,
-- 20260719080000) yazar ve artefaktı deftere BAĞLAR. Bağlantı, artefakt
-- tablosuna sütun eklemek yerine GENEL bir link tablosuyla tutulur — her yeni
-- artefakt türü için şema değişikliği gerekmesin.
--
-- MÜKERRER ALTYAPI KURULMADI: outbox deseni sod_outbox'tan (M16 PR-3B),
-- imza+defter mantığı G3'ten (transparency.ts/manifest-signature.ts) BİREBİR
-- yeniden kullanılıyor. Burada yalnız YENİ olan: genel outbox/link şeması +
-- claim/mark RPC'leri (kural 4: BullMQ yok, saf Postgres FOR UPDATE SKIP
-- LOCKED ile race-safe claim).
--
-- DÜRÜSTLÜK (nihai §8.0 zorunlu kural): artefakt oluştuğu halde defter kaydı
-- gecikirse PENDING açıkça gösterilir; sahte ANCHORED/VERIFIED YOK.
-- `artifact_ledger_durumu()` tek doğruluk kaynağıdır (PENDING/ANCHORED/FAILED).

-- ============================================================================
-- 1. GENEL OUTBOX + LINK TABLOLARI
-- ============================================================================

create table public.ledger_outbox (
  id uuid primary key default gen_random_uuid(),
  seq bigint generated always as identity,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  artifact_table text not null,
  artifact_id uuid not null,
  -- Ledger'a yazılırken kullanılacak statement kind (transparency.ts SignedStatement.kind).
  statement_kind text not null,
  durum text not null default 'PENDING' check (durum in ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED')),
  deneme_sayisi integer not null default 0,
  son_hata text,
  islenme_at timestamptz,
  created_at timestamptz not null default now(),
  -- İDEMPOTENCY: bir artefakt için EN FAZLA bir outbox kaydı — trigger retry
  -- veya ikinci bir enqueue çağrısı ikinci kayıt YARATMAZ.
  unique (artifact_table, artifact_id)
);

create index ledger_outbox_pending_idx
  on public.ledger_outbox (tenant_id, created_at)
  where durum = 'PENDING';

alter table public.ledger_outbox enable row level security;

create policy ledger_outbox_select on public.ledger_outbox
  for select using (tenant_id = public.current_tenant_id());

-- Olay yalnız SECURITY DEFINER trigger/RPC yazar (sod_outbox ile aynı disiplin);
-- istemci ne yazar ne günceller ne siler.
revoke insert, update, delete on public.ledger_outbox from authenticated, anon;

create table public.artifact_ledger_links (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  artifact_table text not null,
  artifact_id uuid not null,
  ledger_entry_id uuid not null references public.transparency_ledger_entries (id) on delete restrict,
  created_at timestamptz not null default now(),
  -- İDEMPOTENCY BACKSTOP: bir artefakt için EN FAZLA bir mühür — eşzamanlı
  -- iki drenajın aynı artefaktı iki kez mühürlemesi (duplicate leaf) burada
  -- kesin olarak engellenir, claim'deki FOR UPDATE SKIP LOCKED'a ek savunma.
  unique (artifact_table, artifact_id)
);

create index artifact_ledger_links_tenant_idx on public.artifact_ledger_links (tenant_id);

alter table public.artifact_ledger_links enable row level security;

create policy artifact_ledger_links_select on public.artifact_ledger_links
  for select using (tenant_id = public.current_tenant_id());

-- Append-only, yalnız SECURITY DEFINER RPC (ledger_outbox_mark_processed) yazar.
revoke insert, update, delete on public.artifact_ledger_links from authenticated, anon;

-- ============================================================================
-- 2. ENQUEUE TRIGGER'I (domain işlemi ile AYNI transaction)
-- ============================================================================

/**
 * Genel enqueue trigger'ı: TG_ARGV[0] statement_kind'i taşır (audit_privacy
 * deseniyle aynı — tek fonksiyon, çoklu tablo). ON CONFLICT DO NOTHING:
 * aynı satır için ikinci bir INSERT (olması beklenmez, test_runs/dsar paketleri
 * zaten kendi tablolarında tekil doğar) sessizce yok sayılır — idempotent.
 */
create or replace function public.ledger_outbox_enqueue_trg()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.ledger_outbox (tenant_id, artifact_table, artifact_id, statement_kind)
  values (new.tenant_id, TG_TABLE_NAME, new.id, TG_ARGV[0])
  on conflict (artifact_table, artifact_id) do nothing;
  return new;
end;
$$;

-- İlk kapsam madde 1: kontrol testi koşusu (test_runs zaten append-only/immutable —
-- INSERT ANI = nihai artefakt anı, ayrı bir "tamamlandı" durumu beklenmez).
create trigger test_runs_ledger_outbox_enqueue
  after insert on public.test_runs
  for each row execute function public.ledger_outbox_enqueue_trg('CONTROL_TEST_RUN');

-- ============================================================================
-- 3. DSAR KANIT PAKETİ — SENKRON MÜHÜRDEN ASENKRON OUTBOX'A GEÇİŞ
-- ============================================================================
--
-- ÖNCEKİ TASARIM (20260719090000): route senkron imzalıyor, ledger_entry_id
-- NOT NULL zorunluydu — "domain işlemi ile outbox olayı aynı transaction'da
-- doğar" kuralına aykırıydı (iki ayrı REST çağrısı, tek transaction değil).
-- YENİ TASARIM: paket yalnız NİYETİ (manifest + hash) taşır; mühür SONRADAN
-- (outbox→drenaj) gelir. ledger_entry_id/leaf_index/signed_statement artık
-- GEREKSİZ — artifact_ledger_links tek doğruluk kaynağı (iki kaynak = sessiz
-- ayrışma riski, kural: tek kaynak).

alter table public.dsar_fulfillment_packages drop column ledger_entry_id;
alter table public.dsar_fulfillment_packages drop column leaf_index;
alter table public.dsar_fulfillment_packages drop column signed_statement;

create or replace function public.dsar_paket_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_durum text;
  v_tenant uuid;
begin
  select durum, tenant_id into v_durum, v_tenant
  from public.data_subject_requests where id = new.dsar_id;

  if v_tenant is null then
    raise exception 'DSAR bulunamadi';
  end if;
  if v_tenant is distinct from new.tenant_id then
    raise exception 'DSAR baska bir kiraciya ait';
  end if;
  if v_durum is distinct from 'TAMAMLANDI' then
    raise exception 'Kanit paketi yalniz TAMAMLANDI DSAR icin muhurlenebilir (durum: %)', v_durum;
  end if;

  return new;
end;
$$;

create trigger dsar_fulfillment_packages_ledger_outbox_enqueue
  after insert on public.dsar_fulfillment_packages
  for each row execute function public.ledger_outbox_enqueue_trg('DSAR_FULFILLMENT');

-- audit_dsar_paket (20260719090000) new.leaf_index'e referans veriyordu —
-- sütun düştü, fonksiyon yeniden yazılır (davranış aynı, yalnız o alan çıkar).
create or replace function public.audit_dsar_paket()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
  values (new.tenant_id, auth.uid(), 'dsar_kanit_paketi_muhurlendi', 'dsar_fulfillment_packages', new.id,
    jsonb_build_object('dsar_id', new.dsar_id, 'manifest_hash', new.manifest_hash));
  return new;
end;
$$;

-- ============================================================================
-- 4. CLAIM / MARK RPC'LERİ (race-safe, idempotent drenaj)
-- ============================================================================

/**
 * Bekleyen olayları RACE-SAFE claim eder: FOR UPDATE SKIP LOCKED, eşzamanlı
 * iki drenajın AYNI satırı almasını engeller (biri alır, diğeri sıradaki
 * PENDING satıra geçer — hiç bloklanmaz). Claim edilen satır PROCESSING'e
 * geçer. Çökme kurtarma: 5 dakikadan eski PROCESSING satırlar PENDING'e
 * döner (worker crash olsa olay kaybolmaz, yeniden denenir).
 *
 * Tek statement (WITH ... UPDATE ... RETURNING) — PostgREST'ten TEK round-trip
 * ile çağrılsa da atomiktir; iki ayrı adım (select sonra update) arasında
 * yarış YOKTUR.
 */
create or replace function public.ledger_outbox_claim(p_limit integer default 10)
returns setof public.ledger_outbox
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.current_tenant_id();
begin
  if v_tenant is null then
    return;
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

/**
 * Bir outbox olayını PROCESSED'e taşır ve artifact_ledger_links'e bağlar.
 * ON CONFLICT DO NOTHING: aynı artefakt için link zaten varsa (idempotency
 * backstop) sessizce atlanır — yeniden çağrı hata VERMEZ, güvenle tekrarlanır.
 */
create or replace function public.ledger_outbox_mark_processed(p_id uuid, p_ledger_entry_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.ledger_outbox;
begin
  select * into v_row from public.ledger_outbox
  where id = p_id and tenant_id = public.current_tenant_id();
  if v_row.id is null then
    raise exception 'Outbox kaydi bulunamadi veya baska kiraciya ait';
  end if;

  insert into public.artifact_ledger_links (tenant_id, artifact_table, artifact_id, ledger_entry_id)
  values (v_row.tenant_id, v_row.artifact_table, v_row.artifact_id, p_ledger_entry_id)
  on conflict (artifact_table, artifact_id) do nothing;

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

/**
 * Bir olayı başarısız işaretler. 5 denemeden az ise PENDING'e döner (yeniden
 * denenir — "ledger erişilemezliği domain kaydını kaybettirmez"); 5. denemede
 * FAILED'e düşer (dead-letter — sonsuz tekrar yerine görünür, incelenebilir).
 */
create or replace function public.ledger_outbox_mark_failed(p_id uuid, p_hata text)
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
      durum = case when deneme_sayisi + 1 >= 5 then 'FAILED' else 'PENDING' end
  where id = p_id and tenant_id = public.current_tenant_id();
end;
$$;

revoke all on function public.ledger_outbox_mark_failed(uuid, text) from public;
grant execute on function public.ledger_outbox_mark_failed(uuid, text) to authenticated;

/**
 * Bir artefaktın DIŞ-DOĞRULANABİLİRLİK durumu — tek doğruluk kaynağı.
 * ANCHORED: mühürlendi (artifact_ledger_links'te). FAILED: dead-letter.
 * PENDING: outbox'ta ama henüz mühürlenmedi. KAYITSIZ: bu artefakt türü
 * deftere hiç bağlanmamış (henüz wiring yapılmamış tür).
 */
create or replace function public.artifact_ledger_durumu(p_artifact_table text, p_artifact_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when exists (
      select 1 from public.artifact_ledger_links
      where artifact_table = p_artifact_table and artifact_id = p_artifact_id
    ) then 'ANCHORED'
    when exists (
      select 1 from public.ledger_outbox
      where artifact_table = p_artifact_table and artifact_id = p_artifact_id and durum = 'FAILED'
    ) then 'FAILED'
    when exists (
      select 1 from public.ledger_outbox
      where artifact_table = p_artifact_table and artifact_id = p_artifact_id
    ) then 'PENDING'
    else 'KAYITSIZ'
  end
$$;

-- ============================================================================
-- 5. PROOF ROOM GENİŞLEMESİ — ledger durumu + oturumsuz malzeme RPC'si
-- ============================================================================

-- proof_room_goruntule'a ledgerDurumu alanı eklenir (davranış birebir korunur,
-- yalnız yeni alan). Fonksiyon gövdesi CREATE OR REPLACE ile TAM yeniden yazılır
-- (Postgres kısmi ALTER FUNCTION body desteklemez).
create or replace function public.proof_room_goruntule(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_link record;
  v_run record;
  v_foto record;
  v_zincir jsonb;
  v_appl jsonb;
  v_kanit jsonb;
begin
  select * into v_link from public.proof_room_links where token = p_token;
  if v_link is null or v_link.son_gecerlilik < now() or v_link.iptal_edildi then
    return null;
  end if;

  select r.id, r.sonuc, r.gerekce, r.calisti_at, r.control_id, r.evidence_id,
         d.ad as tanim_ad, c.madde_ref, c.baslik as kontrol_baslik
    into v_run
  from public.test_runs r
  join public.control_test_definitions d on d.id = r.test_definition_id
  join public.controls c on c.id = r.control_id
  where r.id = v_link.test_run_id and r.tenant_id = v_link.tenant_id;
  if v_run is null then
    return null;
  end if;

  select karar, snapshot into v_foto
  from public.execution_legal_snapshots
  where test_run_id = v_run.id;

  select coalesce(jsonb_agg(z order by z."obligationKod"), '[]'::jsonb) into v_zincir
  from (
    select
      o.kod as "obligationKod",
      o.nitelik,
      o.dogrulama_durumu as "obligationDogrulama",
      m.dogrulama_durumu as "mappingDogrulama",
      m.kapsam,
      p.provision_ref as "provisionRef",
      p.effective_from as "effectiveFrom",
      p.effective_to as "effectiveTo",
      p.dogrulama_durumu as "provisionDogrulama",
      left(p.metin, 240) as snippet,
      a.baslik as "artifactBaslik",
      a.sha256 as "artifactSha256",
      s.authority,
      s.ad as "kaynakAd",
      s.jurisdiction,
      s.kaynak_seviyesi as "kaynakSeviyesi",
      s.canonical_url as "canonicalUrl"
    from public.obligation_control_mappings m
    join public.obligations o on o.id = m.obligation_id
    join public.provisions p on p.id = o.provision_id
    join public.source_artifacts a on a.id = p.source_artifact_id
    join public.regulatory_sources s on s.id = a.source_id
    where m.control_id = v_run.control_id
      and m.dogrulama_durumu <> 'REJECTED'
  ) z;

  select coalesce(jsonb_agg(k), '[]'::jsonb) into v_appl
  from (
    select o.kod as "obligationKod", ad2.durum, ad2.gerekce,
           ad2.fact_snapshot_fingerprint as "factSnapshotFingerprint",
           ad2.karar_kaynagi as "kararKaynagi"
    from public.applicability_decisions ad2
    join public.obligations o on o.id = ad2.obligation_id
    join public.obligation_control_mappings m on m.obligation_id = o.id
    where m.control_id = v_run.control_id
      and ad2.tenant_id = v_link.tenant_id
      and ad2.superseded_at is null
  ) k;

  select case when v_run.evidence_id is null then null
    else (
      select jsonb_build_object('evidenceId', e.id, 'dosyaHashSha256', e.hash_sha256)
      from public.evidences e where e.id = v_run.evidence_id
    ) end into v_kanit;

  insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
  values (
    v_link.tenant_id, null, 'proof_room_goruntulendi', 'proof_room_links', v_link.id,
    jsonb_build_object('testRunId', v_run.id)
  );

  return jsonb_build_object(
    'kurumAdi', (select name from public.tenants where id = v_link.tenant_id),
    'sonGecerlilik', v_link.son_gecerlilik,
    'kosu', jsonb_build_object(
      'id', v_run.id, 'sonuc', v_run.sonuc, 'gerekce', v_run.gerekce,
      'calistiAt', v_run.calisti_at, 'tanimAd', v_run.tanim_ad,
      'kontrolMaddeRef', v_run.madde_ref, 'kontrolBaslik', v_run.kontrol_baslik
    ),
    'legalSnapshot', case when v_foto is null then null
      else jsonb_build_object('karar', v_foto.karar, 'snapshot', v_foto.snapshot) end,
    'kaynakZinciri', v_zincir,
    'applicability', v_appl,
    'kanit', v_kanit,
    -- YENİ: bu koşunun şeffaflık defteri durumu (PENDING/ANCHORED/FAILED/KAYITSIZ).
    'ledgerDurumu', public.artifact_ledger_durumu('test_runs', v_run.id)
  );
end;
$$;

/**
 * OTURUMSUZ kapsama malzemesi: token geçerliyse ve koşu ANCHORED ise, denetçinin
 * TARAYICIDA (transparency.ts makbuzUret ile, DB'siz doğrulanabilir) bir kapsama
 * makbuzu kurabilmesi için ham malzemeyi (yaprak hash'leri + imzalı ifade +
 * imzalı STH) döner. Token doğrulama proof_room_goruntule ile AYNI kural.
 *
 * NEDEN AYRI AUDIT YOK: bu çağrı, aynı sayfa yüklemesinin proof_room_goruntule
 * tarafından ZATEN audit'e düşürülen TEK görüntülemesinin bir parçasıdır —
 * ikinci bir audit satırı gürültü olurdu (aynı ziyaret, iki "görüntüleme" değil).
 *
 * AYNI TENANT'IN BAŞKA YAPRAKLARI: kapsama ispatı matematiksel olarak çevre
 * yaprakları gerektirir (Certificate Transparency ile aynı ilke) — dönen
 * yapraklar OPAK hash'lerdir (ham içerik/PII değil), yalnız BU tenant'a aittir.
 */
create or replace function public.proof_room_ledger_malzeme(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_link record;
  v_durum text;
  v_ledger_entry_id uuid;
  v_entry record;
  v_cp record;
  v_leaves jsonb;
begin
  select * into v_link from public.proof_room_links where token = p_token;
  if v_link is null or v_link.son_gecerlilik < now() or v_link.iptal_edildi then
    return null;
  end if;

  v_durum := public.artifact_ledger_durumu('test_runs', v_link.test_run_id);
  if v_durum <> 'ANCHORED' then
    return jsonb_build_object('durum', v_durum);
  end if;

  select ledger_entry_id into v_ledger_entry_id
  from public.artifact_ledger_links
  where artifact_table = 'test_runs' and artifact_id = v_link.test_run_id;

  select id, leaf_index, signed_statement, tenant_id into v_entry
  from public.transparency_ledger_entries
  where id = v_ledger_entry_id;

  if v_entry is null then
    return jsonb_build_object('durum', 'PENDING');
  end if;

  select tree_size, root_hash, sth_jws, sth_kid, sth_public_jwk into v_cp
  from public.transparency_checkpoints
  where tenant_id = v_entry.tenant_id and tree_size > v_entry.leaf_index
  order by tree_size desc
  limit 1;

  if v_cp is null then
    return jsonb_build_object('durum', 'DEFTERDE_STH_BEKLIYOR');
  end if;

  select coalesce(jsonb_agg(leaf_hash order by leaf_index), '[]'::jsonb) into v_leaves
  from public.transparency_ledger_entries
  where tenant_id = v_entry.tenant_id and leaf_index < v_cp.tree_size;

  return jsonb_build_object(
    'durum', 'ANCHORED',
    'leafIndex', v_entry.leaf_index,
    'signedStatement', v_entry.signed_statement,
    'sth', jsonb_build_object('treeSize', v_cp.tree_size, 'rootHash', v_cp.root_hash),
    'sthImza', jsonb_build_object('jws', v_cp.sth_jws, 'kid', v_cp.sth_kid, 'publicJwk', v_cp.sth_public_jwk),
    'leaves', v_leaves
  );
end;
$$;

grant execute on function public.proof_room_ledger_malzeme(text) to anon, authenticated;
