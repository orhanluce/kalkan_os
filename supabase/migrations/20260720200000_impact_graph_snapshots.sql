-- Dikey D, ilk dilim (20 Temmuz 2026, docs/adr/PR0-dikeyD-dayaniklilik-etki-
-- grafi-2026-07-20.md): kurumsal dayanıklılık — birleşik etki grafiği
-- mühürlü anlık görüntüsü.
--
-- YENİ VARLIK/TEDARİKÇİ/KRİTİK-HİZMET MODELİ YOK: bu tablo hiçbir ilişkiyi
-- KENDİSİ taşımaz — yalnız `src/lib/impact-graph.ts`'in mevcut 9 kenar
-- kaynağından (critical_business_services/service_dependencies/
-- third_parties/fourth_parties/ict_service_types/controls/obligations/
-- control_test_definitions/findings/evidences) hesapladığı SONUCU mühürler
-- (roi_export_runs'ın Faz 3 deseni — paket ANINDA donan).
--
-- MAKER-CHECKER YOK (roi_export_runs'tan BİLİNÇLİ FARK): bu bir UYUM İDDİASI
-- değil, deterministik bir hesaplamanın fotoğrafı — assurance_claims/roi_
-- export_runs'ın "kesin hüküm" onay ihtiyacıyla KARIŞMAZ (ADR §3).
--
-- İMMUTABLE BY DESIGN: UPDATE trigger'ı service_role dahil HER ZAMAN
-- reddeder (test_runs'ın AYNI deseni, 20260717230001 — "revoke yalnız
-- authenticated/anon'u durdurur, service_role'ü DURDURMAZ" dersi). DELETE
-- yalnız tenant cascade için serbest, RLS zaten authenticated'a delete
-- policy'si açmıyor.

create table public.impact_graph_snapshots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  olusturan uuid references public.profiles (id) on delete set null,

  -- Mühürlü içerik: src/lib/impact-graph.ts çıktısı, INSERT anında donar.
  graf jsonb not null,
  graf_hash text not null check (graf_hash ~ '^[0-9a-f]{64}$'),
  spof_raporu jsonb not null,
  yayilim_raporu jsonb not null,
  -- Motor sürümü + varsayımlar — "hesaplama yöntemi ayrı gösterilmeli" (talimat).
  hesaplama_yontemi jsonb not null,

  -- DORA export bağlantısı (ADR §5): TERS yönde, roi_export_runs'a
  -- DOKUNULMADI (guard'ı Faz 4'te iki kez düzeltildi, üçüncü risk gereksiz).
  iliskili_roi_export_run_id uuid references public.roi_export_runs (id) on delete set null,

  created_at timestamptz not null default now()
);

create index impact_graph_snapshots_tenant_idx on public.impact_graph_snapshots (tenant_id, created_at desc);

/** Kimlik atfı: olusturan istemci bağlamında oturum sahibine sabitlenir. */
create or replace function public.impact_graph_snapshot_olusturan_guard()
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

create trigger impact_graph_snapshot_olusturan_guard_trg
  before insert on public.impact_graph_snapshots
  for each row execute function public.impact_graph_snapshot_olusturan_guard();

/**
 * Cross-tenant guard: iliskili_roi_export_run_id doluysa AYNI kiracıya ait
 * olmalı (sızıntı önleme — ADR §5).
 */
create or replace function public.impact_graph_snapshot_tenant_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
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

create trigger impact_graph_snapshot_tenant_guard_trg
  before insert on public.impact_graph_snapshots
  for each row execute function public.impact_graph_snapshot_tenant_guard();

/** İMMUTABLE: service_role dahil hiçbir UPDATE geçemez (test_runs'ın AYNI dersi). */
create or replace function public.impact_graph_snapshot_immutable()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'Etki grafi anlik goruntusu degistirilemez (append-only)';
end;
$$;

create trigger impact_graph_snapshot_immutable_before_update
  before update on public.impact_graph_snapshots
  for each row execute function public.impact_graph_snapshot_immutable();

-- --- Audit ---
create or replace function public.audit_impact_graph_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
  values (new.tenant_id, auth.uid(), 'etki_grafi_anlik_goruntu_olusturuldu', 'impact_graph_snapshots', new.id,
    jsonb_build_object('graf_hash', new.graf_hash, 'sistemik_nokta_sayisi', jsonb_array_length(new.spof_raporu -> 'sistemikNoktalar')));
  return new;
end;
$$;

create trigger audit_impact_graph_snapshot_insert after insert on public.impact_graph_snapshots
  for each row execute function public.audit_impact_graph_snapshot();

-- --- RLS: tenant-scoped select+insert (admin/uyum); UPDATE/DELETE policy YOK ---
alter table public.impact_graph_snapshots enable row level security;

create policy impact_graph_snapshots_select on public.impact_graph_snapshots
  for select using (tenant_id = public.current_tenant_id());
create policy impact_graph_snapshots_insert on public.impact_graph_snapshots
  for insert with check (
    tenant_id = public.current_tenant_id() and public.current_user_role() in ('admin', 'uyum')
  );

-- =====================================================================
-- Proof Room bağlantısı — ÜÇÜNCÜ dal (GENİŞLETME, roi_export_run_id
-- deseninin AYNISI, Faz 3'ün polimorfik hedef desenini üçe genişletir)
-- =====================================================================
alter table public.proof_room_links
  drop constraint proof_room_links_tek_hedef,
  add column graph_snapshot_id uuid references public.impact_graph_snapshots (id) on delete cascade,
  add constraint proof_room_links_tek_hedef check (
    (case when test_run_id is not null then 1 else 0 end)
    + (case when roi_export_run_id is not null then 1 else 0 end)
    + (case when graph_snapshot_id is not null then 1 else 0 end)
    = 1
  );

create index proof_room_links_graph_snapshot_idx on public.proof_room_links (graph_snapshot_id) where graph_snapshot_id is not null;
