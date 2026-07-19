-- M17 Audit Workspace — "sonraki dilim" borcu (20260719050000'de kaydedildi):
-- workpaper→bulgu/kontrol bağı. Dış çerçeve içeriği UYDURULMUYOR (kural 3
-- riski yok) — bu tamamen kurumun kendi iç denetim verisinin (audit_workpapers)
-- hangi kontrolü/bulguyu desteklediğini gösteren bir graf kenarı; Dikey 5'teki
-- critical_service_controls deseninin AYNISI.
--
-- TENANT'A ÖZGÜ: hem audit_workpapers hem controls/findings tenant'ın kendi
-- verisi (controls global katalog ama tenant_controls izlemesi tenant'a özgü;
-- burada doğrudan controls'e bağlanıyor — findings zaten tenant'a özgü).
--
-- İNVARYANT: ONAYLANDI çalışma kağıdının bağları da DONUK (mevcut icerik
-- donukluğunun aynı ruhu — sign-off sonrası kanıt izi sessizce değişemez).
--
-- ROLLBACK NOTU: ters FK sırasıyla drop (audit_workpaper_findings,
-- audit_workpaper_controls). Üretim verisi yok.

create table public.audit_workpaper_controls (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  workpaper_id uuid not null references public.audit_workpapers (id) on delete cascade,
  control_id uuid not null references public.controls (id) on delete restrict,
  gerekce text,
  created_at timestamptz not null default now(),
  unique (workpaper_id, control_id)
);

create index awc_workpaper_idx on public.audit_workpaper_controls (workpaper_id);
create index awc_control_idx on public.audit_workpaper_controls (control_id);

create table public.audit_workpaper_findings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  workpaper_id uuid not null references public.audit_workpapers (id) on delete cascade,
  finding_id uuid not null references public.findings (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (workpaper_id, finding_id)
);

create index awf_workpaper_idx on public.audit_workpaper_findings (workpaper_id);
create index awf_finding_idx on public.audit_workpaper_findings (finding_id);

/**
 * DONUKLUK GUARD'I: ONAYLANDI çalışma kağıdına yeni bağ eklenemez / mevcut bağ
 * silinemez (audit_workpaper_guard'ın "onaylanmış içerik donuk" ilkesinin
 * kenarlara genişlemesi — sign-off sonrası kanıt izi sessizce değişemez).
 */
create or replace function public.audit_workpaper_link_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_durum text;
  v_wp_id uuid;
begin
  v_wp_id := coalesce(new.workpaper_id, old.workpaper_id);
  select durum into v_durum from public.audit_workpapers where id = v_wp_id;
  if v_durum = 'ONAYLANDI' then
    raise exception 'ONAYLANDI calisma kagidinin bag listesi degistirilemez (sign-off sonrasi donuk)';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger audit_workpaper_controls_link_guard
  before insert or delete on public.audit_workpaper_controls
  for each row execute function public.audit_workpaper_link_guard();

create trigger audit_workpaper_findings_link_guard
  before insert or delete on public.audit_workpaper_findings
  for each row execute function public.audit_workpaper_link_guard();

-- --- RLS: audit_workspace deseninin aynısı — tenant'a kilitli, yazma admin/uyum ---
alter table public.audit_workpaper_controls enable row level security;
alter table public.audit_workpaper_findings enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['audit_workpaper_controls', 'audit_workpaper_findings']
  loop
    execute format(
      'create policy %1$s_select on public.%1$s for select using (tenant_id = public.current_tenant_id())', t);
    execute format(
      'create policy %1$s_write on public.%1$s for all using (tenant_id = public.current_tenant_id() and public.current_user_role() in (''admin'', ''uyum'')) with check (tenant_id = public.current_tenant_id() and public.current_user_role() in (''admin'', ''uyum''))', t);
  end loop;
end;
$$;
