-- M17 — Audit Workspace (Gate G8 parça 2).
--
-- TENANT'A ÖZGÜ: denetim evreni, örnekleme, çalışma kağıdı kurumun kendi
-- denetim verisidir.
--
-- BU DİLİM: audit_engagements (risk tabanlı denetim işi) + audit_samples
-- (TEKRARLANABİLİR örnekleme: yöntem + popülasyon + SEED → aynı seçim) +
-- audit_workpapers (çalışma kağıdı; hazırlayan/reviewer BAĞIMSIZLIK sign-off) +
-- audit_review_notes. Örnek seçimi saf/deterministik (src/lib/denetim.ts) —
-- seed saklanır, denetçi yeniden üretir.
--
-- ROLLBACK NOTU: ters FK sırasıyla drop (audit_review_notes, audit_workpapers,
-- audit_samples, audit_engagements). Üretim verisi yok.
--
-- BİLİNÇLİ SONRAKİ DİLİM: PBC/request tablosu (M38 regulatory_requests deseni
-- yeniden kullanılabilir), formal independence_declarations bağı (G7 tablosu),
-- workpaper→bulgu/kontrol bağı, WORM export.

-- --- Denetim işi (risk tabanlı) ---
create table public.audit_engagements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  ad text not null,
  kapsam text,
  donem text,
  risk_seviyesi text not null default 'ORTA' check (risk_seviyesi in ('DUSUK', 'ORTA', 'YUKSEK')),
  durum text not null default 'PLANLANDI' check (durum in ('PLANLANDI', 'DEVAM', 'TAMAMLANDI')),
  sorumlu uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, ad)
);

create trigger audit_engagements_set_updated_at
  before update on public.audit_engagements
  for each row execute function public.set_updated_at();

-- --- Örnekleme (tekrarlanabilir: yöntem + popülasyon + seed) ---
create table public.audit_samples (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  engagement_id uuid not null references public.audit_engagements (id) on delete cascade,
  yontem text not null default 'RANDOM' check (yontem in ('RANDOM', 'SYSTEMATIC', 'JUDGMENTAL')),
  populasyon_boyutu integer not null check (populasyon_boyutu >= 0),
  ornek_boyutu integer not null check (ornek_boyutu >= 0),
  -- Deterministik seçim tohumu (denetçi yeniden üretir).
  seed text not null,
  -- Seçilen indeksler (0-tabanlı) — saf motorun ürettiği, saklanan sonuç.
  secilen_indeksler integer[] not null default '{}',
  created_at timestamptz not null default now(),
  constraint audit_samples_boyut check (ornek_boyutu <= populasyon_boyutu)
);

create index audit_samples_engagement_idx on public.audit_samples (engagement_id);

-- --- Çalışma kağıdı (hazırlayan/reviewer bağımsızlık sign-off) ---
create table public.audit_workpapers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  engagement_id uuid not null references public.audit_engagements (id) on delete cascade,
  baslik text not null,
  icerik text not null default '',
  hazirlayan uuid references public.profiles (id) on delete restrict,
  hazirlama_zamani timestamptz,
  reviewer uuid references public.profiles (id) on delete restrict,
  review_zamani timestamptz,
  durum text not null default 'TASLAK' check (durum in ('TASLAK', 'INCELEME', 'ONAYLANDI')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger audit_workpapers_set_updated_at
  before update on public.audit_workpapers
  for each row execute function public.set_updated_at();

create index audit_workpapers_engagement_idx on public.audit_workpapers (engagement_id);

/**
 * ÇALIŞMA KAĞIDI GUARD'I (bağımsızlık/dört göz): ONAYLANDI yalnız reviewer +
 * zaman ile ve reviewer ≠ hazırlayan (denetçi bağımsızlığı — hazırlayan kendi
 * kağıdını onaylayamaz). Onaylanmış kağıt içeriği donuk (yeniden üretilebilirlik).
 */
create or replace function public.audit_workpaper_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.durum = 'ONAYLANDI' and old.durum is distinct from 'ONAYLANDI' then
    if new.reviewer is null or new.review_zamani is null then
      raise exception 'ONAYLANDI icin reviewer + zaman zorunlu';
    end if;
    if new.reviewer = new.hazirlayan then
      raise exception 'Hazirlayan kendi calisma kagidini onaylayamaz (bagimsizlik/dort goz)';
    end if;
  end if;
  if old.durum = 'ONAYLANDI' and new.icerik is distinct from old.icerik then
    raise exception 'Onaylanmis calisma kagidinin icerigi degistirilemez';
  end if;
  return new;
end;
$$;

create trigger audit_workpaper_guard_trg
  before insert or update on public.audit_workpapers
  for each row execute function public.audit_workpaper_guard();

-- --- Review notları ---
create table public.audit_review_notes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  workpaper_id uuid not null references public.audit_workpapers (id) on delete cascade,
  not_metni text not null,
  cozuldu boolean not null default false,
  created_at timestamptz not null default now()
);

create index audit_review_notes_wp_idx on public.audit_review_notes (workpaper_id);

-- --- Audit: workpaper durum değişimi (sign-off izi) ---
create or replace function public.audit_workpaper_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'UPDATE' and new.durum is distinct from old.durum then
    insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
    values (new.tenant_id, auth.uid(), 'calisma_kagidi_durum_degisti', 'audit_workpapers', new.id,
      jsonb_build_object('durum_onceki', old.durum, 'durum', new.durum));
  end if;
  return new;
end;
$$;

create trigger audit_workpaper_log_update after update on public.audit_workpapers
  for each row execute function public.audit_workpaper_log();

-- --- RLS: hepsi tenant'a kilitli; yazma admin/uyum ---
alter table public.audit_engagements enable row level security;
alter table public.audit_samples enable row level security;
alter table public.audit_workpapers enable row level security;
alter table public.audit_review_notes enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['audit_engagements', 'audit_samples', 'audit_workpapers', 'audit_review_notes']
  loop
    execute format(
      'create policy %1$s_select on public.%1$s for select using (tenant_id = public.current_tenant_id())', t);
    execute format(
      'create policy %1$s_write on public.%1$s for all using (tenant_id = public.current_tenant_id() and public.current_user_role() in (''admin'', ''uyum'')) with check (tenant_id = public.current_tenant_id() and public.current_user_role() in (''admin'', ''uyum''))', t);
  end loop;
end;
$$;
