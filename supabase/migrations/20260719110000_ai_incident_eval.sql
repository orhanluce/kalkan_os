-- M37 sonraki dilim — AI olay (incident) + değerlendirme (eval).
--
-- MEVCUT M37 grafına (ai_systems) EKLEMELİ: bir AI sistemi için olay kaydı
-- (EU AI Act Art. 73 ciddi-olay bildirimi) ve eval sonucu (bias/robustluk/...).
-- ai_systems tablosu/guard'ı DEĞİŞMEZ.
--
-- ANAHTAR İNVARYANT'lar:
--  (kural 14) Olay kapanışı KANIT + kapatan + zaman ister.
--  (kural 13) Eval sonucu BİRLEŞTİRİLMEZ: PASSED ≠ FAILED ≠ UNKNOWN. Ölçüm
--    yapılmadıysa UNKNOWN (varsayılan) — "başarısız" DEĞİL; connector/ölçüm
--    arızası FAILED üretmez.
--  (kimlik atfı, M16 #9) kapatan istemci bağlamında oturum sahibi.
--
-- İÇERİK UYDURULMAZ (kural 3): olay/eval tenant tarafından girilir.

-- --- AI olay (incident) ---
create table public.ai_incidents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  ai_system_id uuid not null references public.ai_systems (id) on delete cascade,
  ozet text not null,
  ciddiyet text not null default 'ORTA' check (ciddiyet in ('DUSUK', 'ORTA', 'YUKSEK', 'KRITIK')),
  durum text not null default 'ACIK' check (durum in ('ACIK', 'INCELENIYOR', 'KAPANDI')),
  tespit_at timestamptz not null default now(),
  -- EU AI Act Art. 73: ciddi olay otorite bildirimi (zaman saklanır, türetim değil).
  otorite_bildirildi_at timestamptz,
  -- Kapanış (kural 14): kanıt + kapatan + zaman.
  kapanis_kanit text,
  kapatan uuid references public.profiles (id) on delete restrict,
  kapanis_zamani timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger ai_incidents_set_updated_at
  before update on public.ai_incidents
  for each row execute function public.set_updated_at();

create index ai_incidents_system_idx on public.ai_incidents (ai_system_id, tespit_at desc);

/**
 * OLAY KAPANIŞ GUARD'I (kural 14): KAPANDI ancak kanıt + kapatan + zaman ile.
 * Kimlik atfı: kapatan istemci bağlamında oturum sahibi (service/cron muaf).
 */
create or replace function public.ai_incident_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.durum = 'KAPANDI' then
    if new.kapanis_kanit is null or btrim(new.kapanis_kanit) = ''
       or new.kapatan is null or new.kapanis_zamani is null then
      raise exception 'AI olay kapanisi kanit + kapatan + zaman ister (kural 14)';
    end if;
    if auth.uid() is not null and new.kapatan is distinct from auth.uid() then
      raise exception 'AI olay ancak oturum sahibi adina kapatilabilir (kimlik atfi)';
    end if;
  end if;
  return new;
end;
$$;

create trigger ai_incident_guard_trg
  before insert or update on public.ai_incidents
  for each row execute function public.ai_incident_guard();

-- --- AI değerlendirme (eval) ---
create table public.ai_evaluations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  ai_system_id uuid not null references public.ai_systems (id) on delete cascade,
  tur text not null check (tur in ('BIAS', 'ROBUSTLUK', 'DOGRULUK', 'GUVENLIK', 'ACIKLANABILIRLIK')),
  -- KURAL 13: ölçülmediyse UNKNOWN (varsayılan) — FAILED değil.
  sonuc text not null default 'UNKNOWN' check (sonuc in ('PASSED', 'FAILED', 'UNKNOWN')),
  olcum text,
  degerlendiren uuid references public.profiles (id) on delete set null,
  degerlendirme_at timestamptz not null default now(),
  gecerlilik_bitis date,
  created_at timestamptz not null default now()
);

create index ai_evaluations_system_idx on public.ai_evaluations (ai_system_id, degerlendirme_at desc);

-- --- Audit: olay durum + eval oluşturma ---
create or replace function public.audit_ai_olay()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    -- Detay minimal: kolon isimleri tablodan tabloya değiştiği için (durum vs
    -- sonuc) ortak fonksiyonda satır kolonuna dokunulmaz; kayıt varlığı + aktör yeter.
    insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
    values (new.tenant_id, auth.uid(), TG_ARGV[0] || '_olusturuldu', TG_TABLE_NAME, new.id, '{}'::jsonb);
    return new;
  end if;
  if TG_TABLE_NAME = 'ai_incidents' and new.durum is distinct from old.durum then
    insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
    values (new.tenant_id, auth.uid(), 'ai_olay_durum_degisti', TG_TABLE_NAME, new.id,
      jsonb_build_object('durum_onceki', old.durum, 'durum', new.durum));
  end if;
  return new;
end;
$$;

create trigger audit_ai_incident_insert after insert on public.ai_incidents
  for each row execute function public.audit_ai_olay('ai_olay');
create trigger audit_ai_incident_update after update on public.ai_incidents
  for each row execute function public.audit_ai_olay('ai_olay');
create trigger audit_ai_eval_insert after insert on public.ai_evaluations
  for each row execute function public.audit_ai_olay('ai_eval');

-- --- RLS: tenant'a kilitli; yazma admin/uyum ---
alter table public.ai_incidents enable row level security;
alter table public.ai_evaluations enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['ai_incidents', 'ai_evaluations']
  loop
    execute format(
      'create policy %1$s_select on public.%1$s for select using (tenant_id = public.current_tenant_id())', t);
    execute format(
      'create policy %1$s_write on public.%1$s for all using (tenant_id = public.current_tenant_id() and public.current_user_role() in (''admin'', ''uyum'')) with check (tenant_id = public.current_tenant_id() and public.current_user_role() in (''admin'', ''uyum''))', t);
  end loop;
end;
$$;
