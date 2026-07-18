-- SoD atama içe aktarma — şema hazırlığı + dry-run önizleme tablosu
-- (docs/ROADMAP.md M16 PR-3A).
--
-- SALT OKUR PR: bu migration ATAMA YAZMAZ. Yalnızca (a) sod_atamalari'na
-- import kaynaklı alanlar ekler (apply PR-3B'de kullanılacak), (b) dry-run
-- sonucunu saklayan önizleme tablosunu kurar. Önizleme bir atama değildir;
-- "dry-run atamayı değiştirmez" kabul kriteri korunur.

-- ============================================================================
-- 1. sod_atamalari — import alanları (apply hazırlığı, veri yazılmaz)
-- ============================================================================
alter table public.sod_atamalari
  -- Sağlayıcıdaki değişmez kayıt kimliği. (tenant, kaynak_sistem,
  -- source_record_id) idempotency anahtarıdır (apply PR-3B).
  add column source_record_id text,
  add column subject_type text check (subject_type is null or subject_type in ('USER', 'SERVICE_ACCOUNT', 'GROUP')),
  add column display_name text,
  add column email text;

-- İdempotency anahtarı: aynı kaynağın aynı kaydı iki atama üretemez. Mevcut
-- (import öncesi) satırların source_record_id'si null olduğu için partial
-- index onları KAPSAMAZ — eski elle atamalar etkilenmez.
create unique index sod_atamalari_kaynak_kayit_idx
  on public.sod_atamalari (tenant_id, kaynak_sistem, source_record_id)
  where source_record_id is not null;

-- ============================================================================
-- 2. Önizleme (dry-run) tablosu
-- ============================================================================
create table public.sod_import_onizlemeleri (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  kaynak text not null,
  mode text not null check (mode in ('DELTA', 'AUTHORITATIVE_SNAPSHOT')),
  -- Bütünlük demirleri (kurucu §7): apply anında yeniden doğrulanır; biri
  -- değişmişse eski önizleme uygulanamaz (409 IMPORT_PREVIEW_STALE, PR-3B).
  file_hash text not null check (file_hash ~ '^[0-9a-f]{64}$'),
  normalized_records_hash text not null check (normalized_records_hash ~ '^[0-9a-f]{64}$'),
  assignment_snapshot_hash text not null check (assignment_snapshot_hash ~ '^[0-9a-f]{64}$'),
  rule_set_version text not null check (rule_set_version ~ '^[0-9a-f]{64}$'),
  -- Normalize edilmiş kayıtlar (apply bunları kullanır, CSV'yi yeniden
  -- ayrıştırmaz) + hesaplanan diff + hatalar/duplicate'ler.
  normalized_records jsonb not null,
  diff jsonb not null,
  satir_hatalari jsonb not null default '[]',
  duplicateler jsonb not null default '[]',
  beklenen_catismalar jsonb not null default '[]',
  durum text not null default 'READY_FOR_REVIEW'
    check (durum in ('READY_FOR_REVIEW', 'INVALID', 'APPLIED', 'STALE')),
  yukleyen uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index sod_import_onizlemeleri_tenant_idx
  on public.sod_import_onizlemeleri (tenant_id, created_at desc);

alter table public.sod_import_onizlemeleri enable row level security;

create policy sod_import_onizlemeleri_select on public.sod_import_onizlemeleri
  for select using (tenant_id = public.current_tenant_id());
create policy sod_import_onizlemeleri_insert on public.sod_import_onizlemeleri
  for insert with check (tenant_id = public.current_tenant_id());

-- Önizleme, bir dry-run'ın DEĞİŞMEZ kaydıdır: istemci UPDATE/DELETE edemez.
-- durum geçişleri (READY_FOR_REVIEW -> APPLIED/STALE) apply/service tarafında
-- (PR-3B) service_role ile yapılır.
revoke update, delete on public.sod_import_onizlemeleri from authenticated, anon;

/**
 * Önizleme oluşturma denetim izi. gerekce/kanıt İÇERİĞİ yazılmaz (kural 7) —
 * yalnız hangi kaynak/mod, kaç kayıt, hangi hash.
 */
create or replace function public.audit_sod_import_onizleme()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
  values (
    new.tenant_id, auth.uid(), 'sod_import_onizleme_olusturuldu', 'sod_import_onizlemeleri', new.id,
    jsonb_build_object('kaynak', new.kaynak, 'mode', new.mode, 'durum', new.durum,
                       'normalized_records_hash', new.normalized_records_hash)
  );
  return new;
end;
$$;

create trigger audit_sod_import_onizleme_after_insert
  after insert on public.sod_import_onizlemeleri
  for each row execute function public.audit_sod_import_onizleme();
