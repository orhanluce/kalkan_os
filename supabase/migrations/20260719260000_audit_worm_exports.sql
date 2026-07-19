-- M17 Audit Workspace — "sonraki dilim" borcunun SON maddesi (20260719050000
-- notu: "WORM export"). §1.29'un tüm maddeleri bu migration'la BİTER.
--
-- NE SAKLIYOR: bir denetim işinin (audit_engagements) belirli bir andaki tam
-- görünümünün (örnekleme + çalışma kağıtları+bağları + PBC + bağımsızlık
-- beyanları) kanonik hali ve hash'i (src/lib/audit-worm-export.ts). Mühür
-- deseni simulation_result_manifests'in (20260717180000) AYNISI — yeni bir
-- mühürleme mekanizması icat edilmedi.
--
-- WORM (Write Once, Read Many): satır INSERT'ten sonra DEĞİŞMEZ — DB guard
-- (trigger), RLS DEĞİL (RLS service_role'e uygulanmaz ve mührü yazan taraf
-- service_role; simulation_manifest_immutable ile aynı gerekçe).
--
-- ROLLBACK NOTU: bağımsız tek tablo, drop edilebilir. Üretim verisi yok.

create table public.audit_worm_exports (
  id uuid primary key default gen_random_uuid(),
  seq bigint generated always as identity,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  engagement_id uuid not null references public.audit_engagements (id) on delete cascade,
  -- Kanonik paket (AuditWormPaketi) — schema/imzaDurumu/paketHash dahil tam JSON.
  paket jsonb not null,
  paket_hash text not null check (paket_hash ~ '^[0-9a-f]{64}$'),
  olusturan uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index audit_worm_exports_engagement_idx on public.audit_worm_exports (engagement_id, seq desc);

-- Aynı hash iki kez mühürlenmez (aynı içerik → aynı hash → tekilliği zaten
-- kanıtlar; kazara çift-mühürleme burada yakalanır).
create unique index audit_worm_exports_hash_idx on public.audit_worm_exports (paket_hash);

/**
 * MÜHÜR DEĞİŞMEZ (simulation_manifest_immutable'ın aynısı): INSERT sonrası
 * UPDATE tamamen reddedilir (service_role dahil). DELETE yalnız CASCADE
 * (audit_engagements silinirse) — doğrudan silme yolu zaten RLS'te kapalı.
 */
create or replace function public.audit_worm_export_immutable()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'DELETE' then
    return old;
  end if;
  raise exception 'WORM export degistirilemez (M17, sonraki dilim son maddesi)';
end;
$$;

create trigger audit_worm_export_immutable_before_update
  before update on public.audit_worm_exports
  for each row execute function public.audit_worm_export_immutable();

alter table public.audit_worm_exports enable row level security;

create policy audit_worm_exports_select_own_tenant
  on public.audit_worm_exports
  for select using (tenant_id = public.current_tenant_id());

-- Yazma yolu YOK istemci için: mühürleme rotası service_role ile yazar
-- (simulation_result_manifests deseni — RLS insert/update/delete istemciden
-- tamamen kapalı, guard'ın atlanabileceği tek yol kapatılır).
revoke insert, update, delete on public.audit_worm_exports from authenticated, anon;
