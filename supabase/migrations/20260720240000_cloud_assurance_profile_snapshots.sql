-- Dikey E, E1 (kurucu kararı #2, KESİN ad): cloud_assurance_profile_
-- snapshots — deterministik hesaplamanın tenant-scoped, mühürlü fotoğrafı.
-- `impact_graph_snapshots`'ın (Dikey D) AYNI deseni TAM olarak tekrarlanır
-- (immutable, maker-checker YOK, cross-tenant guard, canonical hash).

create table public.cloud_assurance_profile_snapshots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  olusturan uuid references public.profiles (id) on delete set null,

  third_party_id uuid not null references public.third_parties (id) on delete cascade,
  third_party_contract_id uuid references public.third_party_contracts (id) on delete set null,

  -- Mühürlü içerik: src/lib/cloud-assurance.ts çıktısı, INSERT anında donar.
  -- Ham cevap metni/sözleşme metni/PII/kanıt dosyası İÇERMEZ (ADR §9).
  profil jsonb not null,
  profil_hash text not null check (profil_hash ~ '^[0-9a-f]{64}$'),
  -- Motor sürümü + worst-of/açık-bulgu/kaynak-türü/bağımsız-doğrulama
  -- yaklaşımları — yapılandırılmış, serialize edilebilir (ADR §6, kurucu şartı).
  hesaplama_yontemi jsonb not null,

  -- DORA export bağlantısı (impact_graph_snapshots'ın AYNI deseni): TERS
  -- yönde, roi_export_runs'a DOKUNULMADI.
  iliskili_roi_export_run_id uuid references public.roi_export_runs (id) on delete set null,

  created_at timestamptz not null default now()
);

create index cloud_assurance_profile_snapshots_tenant_idx on public.cloud_assurance_profile_snapshots (tenant_id, created_at desc);
create index cloud_assurance_profile_snapshots_third_party_idx on public.cloud_assurance_profile_snapshots (third_party_id, created_at desc);

/** Kimlik atfı: olusturan istemci bağlamında oturum sahibine sabitlenir. */
create or replace function public.cloud_assurance_profile_snapshot_olusturan_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' and auth.uid() is not null then
    new.olusturan := auth.uid();
  end if;
  return new;
end;
$$;

create trigger cloud_assurance_profile_snapshot_olusturan_guard_trg
  before insert on public.cloud_assurance_profile_snapshots
  for each row execute function public.cloud_assurance_profile_snapshot_olusturan_guard();

/**
 * Cross-tenant guard (ADR §8): third_party_id AYNI tenant'a ait olmalı;
 * third_party_contract_id (doluysa) AYNI tenant'a VE AYNI third_party_id'ye
 * ait olmalı; iliskili_roi_export_run_id (doluysa) AYNI tenant'a ait olmalı.
 */
create or replace function public.cloud_assurance_profile_snapshot_tenant_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.third_parties t where t.id = new.third_party_id and t.tenant_id = new.tenant_id
  ) then
    raise exception 'third_party_id farkli bir kiraciya ait olamaz (cross-tenant guard)';
  end if;

  if new.third_party_contract_id is not null then
    if not exists (
      select 1 from public.third_party_contracts c
      where c.id = new.third_party_contract_id
        and c.tenant_id = new.tenant_id
        and c.third_party_id = new.third_party_id
    ) then
      raise exception 'third_party_contract_id farkli bir kiraciya/tedarikciye ait olamaz (cross-tenant guard)';
    end if;
  end if;

  if new.iliskili_roi_export_run_id is not null then
    if not exists (
      select 1 from public.roi_export_runs r
      where r.id = new.iliskili_roi_export_run_id and r.tenant_id = new.tenant_id
    ) then
      raise exception 'iliskili_roi_export_run_id farkli bir kiraciya ait export olamaz (cross-tenant guard)';
    end if;
  end if;

  return new;
end;
$$;

create trigger cloud_assurance_profile_snapshot_tenant_guard_trg
  before insert on public.cloud_assurance_profile_snapshots
  for each row execute function public.cloud_assurance_profile_snapshot_tenant_guard();

/** İMMUTABLE: service_role dahil hiçbir UPDATE geçemez (test_runs/impact_graph_snapshots'ın AYNI dersi). */
create or replace function public.cloud_assurance_profile_snapshot_immutable()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'Bulut/tedarikci guvence profili anlik goruntusu degistirilemez (append-only)';
end;
$$;

create trigger cloud_assurance_profile_snapshot_immutable_before_update
  before update on public.cloud_assurance_profile_snapshots
  for each row execute function public.cloud_assurance_profile_snapshot_immutable();

-- --- Audit ---
create or replace function public.audit_cloud_assurance_profile_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
  values (new.tenant_id, auth.uid(), 'guvence_profili_anlik_goruntu_olusturuldu', 'cloud_assurance_profile_snapshots', new.id,
    jsonb_build_object('third_party_id', new.third_party_id, 'profil_hash', new.profil_hash, 'genel_durum', new.profil ->> 'genelDurum'));
  return new;
end;
$$;

create trigger audit_cloud_assurance_profile_snapshot_insert after insert on public.cloud_assurance_profile_snapshots
  for each row execute function public.audit_cloud_assurance_profile_snapshot();

-- --- RLS: tenant-scoped select+insert (admin/uyum); UPDATE/DELETE policy YOK ---
alter table public.cloud_assurance_profile_snapshots enable row level security;

create policy cloud_assurance_profile_snapshots_select on public.cloud_assurance_profile_snapshots
  for select using (tenant_id = public.current_tenant_id());
create policy cloud_assurance_profile_snapshots_insert on public.cloud_assurance_profile_snapshots
  for insert with check (
    tenant_id = public.current_tenant_id() and public.current_user_role() in ('admin', 'uyum')
  );
