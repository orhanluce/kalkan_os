-- M18 — Training & Competency (Gate G8 parça 3).
--
-- TENANT'A ÖZGÜ: eğitim gereksinimi, atama, tamamlama kurumun kendi verisidir.
--
-- BU DİLİM: training_requirements (rol bazlı gereken eğitim + GEÇME EŞİĞİ +
-- periyot; konu AI_LITERACY M37'ye bağ) + training_assignments (kişiye atama +
-- son tarih) + training_completions (sınav skoru + GEÇME [eşikten hesaplanır,
-- uydurulamaz] + attestation). Yetkinlik boşluğu saf türetilir.
--
-- M12/simülasyon YENİDEN KULLANIM: phishing/tabletop katılımı konu bazlı
-- gereksinimle temsil edilir; skor tamamlamada. Yeni sınav motoru YOK.
--
-- ROLLBACK NOTU: ters FK sırasıyla drop (training_completions,
-- training_assignments, training_requirements). Üretim verisi yok.

-- --- Eğitim gereksinimi (rol bazlı + geçme eşiği) ---
create table public.training_requirements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  ad text not null,
  konu text not null default 'GENEL' check (konu in ('GENEL', 'GUVENLIK', 'KVKK', 'AI_LITERACY', 'BEC_DEEPFAKE', 'SOD')),
  -- Hedef rol (null = tüm kullanıcılar).
  hedef_rol text,
  gecme_esigi integer not null default 70 check (gecme_esigi between 0 and 100),
  periyot_gun integer check (periyot_gun is null or periyot_gun > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, ad)
);

create trigger training_requirements_set_updated_at
  before update on public.training_requirements
  for each row execute function public.set_updated_at();

-- --- Atama (kişiye) ---
create table public.training_assignments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  requirement_id uuid not null references public.training_requirements (id) on delete cascade,
  kullanici uuid not null references public.profiles (id) on delete cascade,
  son_tarih date,
  durum text not null default 'ATANDI' check (durum in ('ATANDI', 'TAMAMLANDI')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (requirement_id, kullanici)
);

create trigger training_assignments_set_updated_at
  before update on public.training_assignments
  for each row execute function public.set_updated_at();

create index training_assignments_kullanici_idx on public.training_assignments (tenant_id, kullanici);

-- --- Tamamlama (sınav + geçme + attestation) ---
create table public.training_completions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  assignment_id uuid not null references public.training_assignments (id) on delete cascade,
  skor integer not null check (skor between 0 and 100),
  -- GEÇME EŞİKTEN HESAPLANIR (uydurulamaz — guard set eder).
  gecti boolean not null default false,
  -- Okudum-anladım (attestation kanıtı).
  attestation boolean not null default false,
  tamamlandi_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (assignment_id)
);

/**
 * TAMAMLAMA GUARD'I: geçme durumu SKOR ile EŞİK'ten HESAPLANIR (istemci
 * "geçtim" diyemez); attestation zorunlu. Geçtiyse atama TAMAMLANDI olur.
 */
create or replace function public.training_completion_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_esik integer;
begin
  select tr.gecme_esigi into v_esik
  from public.training_assignments ta
  join public.training_requirements tr on tr.id = ta.requirement_id
  where ta.id = new.assignment_id;

  -- Geçme = skor >= eşik (deterministik, uydurulamaz).
  new.gecti := new.skor >= coalesce(v_esik, 70);

  if new.attestation is not true then
    raise exception 'Tamamlama attestation (okudum-anladim) olmadan kaydedilemez';
  end if;
  return new;
end;
$$;

create trigger training_completion_guard_trg
  before insert on public.training_completions
  for each row execute function public.training_completion_guard();

/**
 * Geçen tamamlama atamayı TAMAMLANDI yapar (yetkinlik boşluğu kapanır).
 */
create or replace function public.training_completion_after()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.gecti then
    update public.training_assignments set durum = 'TAMAMLANDI' where id = new.assignment_id;
  end if;
  return new;
end;
$$;

create trigger training_completion_after_trg
  after insert on public.training_completions
  for each row execute function public.training_completion_after();

-- --- RLS: hepsi tenant'a kilitli; okuma kiracı, yazma admin/uyum ---
alter table public.training_requirements enable row level security;
alter table public.training_assignments enable row level security;
alter table public.training_completions enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['training_requirements', 'training_assignments', 'training_completions']
  loop
    execute format(
      'create policy %1$s_select on public.%1$s for select using (tenant_id = public.current_tenant_id())', t);
    execute format(
      'create policy %1$s_write on public.%1$s for all using (tenant_id = public.current_tenant_id() and public.current_user_role() in (''admin'', ''uyum'')) with check (tenant_id = public.current_tenant_id() and public.current_user_role() in (''admin'', ''uyum''))', t);
  end loop;
end;
$$;
