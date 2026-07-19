-- M37 AI veri/model güvence genişlemesi (nihai talimat v3.3 §8.0 Dikey 4).
-- Teslim edilen eval veri-soyağacını (§1.39) YENİDEN YAZMADAN zenginleştirir +
-- drift izleme ekler.
--
-- ÇEKİRDEK İNVARYANTLAR:
--  (kural 22) Ham eğitim/eval verisi KALKAN_OS'a/LLM'e GİRMEZ — yalnız kaynak
--    referansı, lisans/izin künyesi, sürüm ve içerik-adresli HASH.
--  (eşik koda gömülmez, AI olay bildirim saati/bulut pak deseni) drift eşiği
--    KOD SABİTİ DEĞİL — `esik_kaynagi` sürümlü politika/uzman kararı taşır.
--  (kural 13/7 ruhu) poisoning riski BİLİNMİYOR DOĞAR — "değerlendirilmedi"
--    "düşük" ile karışmaz; sentetik oran null = ölçülmedi (0 değil).

-- --- Soyağacı zenginleştirme (veri provenance) ---
alter table public.ai_data_lineage
  add column lisans text,
  add column izin_amaci text,
  add column surum text,
  -- Sentetik veri oranı (%0-100). null = ölçülmedi ≠ %0.
  add column sentetik_oran numeric check (sentetik_oran is null or (sentetik_oran >= 0 and sentetik_oran <= 100)),
  add column uretim_yontemi text,
  -- Data poisoning riski: BİLİNMİYOR doğar (değerlendirilmedi ≠ düşük).
  add column poisoning_riski text not null default 'BILINMIYOR'
    check (poisoning_riski in ('DUSUK', 'ORTA', 'YUKSEK', 'BILINMIYOR')),
  add column poisoning_kontrol_kanit text,
  add column label_noise_olcum text;

-- --- Drift izleme (baseline + eşik + eşik KAYNAĞI + trend) ---
create table public.ai_drift_readings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  ai_system_id uuid not null references public.ai_systems (id) on delete cascade,
  metrik text not null,
  baseline numeric,
  deger numeric not null,
  -- Eşik KOD SABİTİ DEĞİL: kaynağı (sürümlü politika/uzman kararı) zorunlu ki
  -- "şu eşik nereden geldi" sorusu yanıtlanabilsin (nihai §8.0 Dikey 4).
  esik numeric,
  esik_kaynagi text,
  olcum_tarihi date not null default current_date,
  aciklama text,
  created_at timestamptz not null default now()
);

create index ai_drift_readings_system_idx on public.ai_drift_readings (ai_system_id, olcum_tarihi desc, metrik);

/** Tutarlılık: drift okuması, işaret ettiği sistemle AYNI kiracıya ait olmalı. */
create or replace function public.ai_drift_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
begin
  select tenant_id into v_tenant from public.ai_systems where id = new.ai_system_id;
  if v_tenant is null then
    raise exception 'AI sistemi bulunamadi';
  end if;
  if v_tenant is distinct from new.tenant_id then
    raise exception 'Drift okumasi, isaret ettigi sistemle ayni kiraciya ait olmalidir';
  end if;
  -- Eşik verildiyse kaynağı da zorunlu (koda gömülü eşik yasağının izi).
  if new.esik is not null and (new.esik_kaynagi is null or btrim(new.esik_kaynagi) = '') then
    raise exception 'Drift esigi verildiyse esik_kaynagi zorunlu (esik koda gomulmez, surumlu politika/uzman karari)';
  end if;
  return new;
end;
$$;

create trigger ai_drift_guard_trg
  before insert on public.ai_drift_readings
  for each row execute function public.ai_drift_guard();

create or replace function public.audit_ai_drift()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
  values (new.tenant_id, auth.uid(), 'ai_drift_okumasi_eklendi', 'ai_drift_readings', new.id,
    jsonb_build_object('metrik', new.metrik, 'ai_system_id', new.ai_system_id));
  return new;
end;
$$;

create trigger audit_ai_drift_insert
  after insert on public.ai_drift_readings
  for each row execute function public.audit_ai_drift();

alter table public.ai_drift_readings enable row level security;

create policy ai_drift_readings_select on public.ai_drift_readings
  for select using (tenant_id = public.current_tenant_id());
create policy ai_drift_readings_write on public.ai_drift_readings
  for all using (tenant_id = public.current_tenant_id() and public.current_user_role() in ('admin', 'uyum'))
  with check (tenant_id = public.current_tenant_id() and public.current_user_role() in ('admin', 'uyum'));
