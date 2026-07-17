-- Simülasyon durum makinesi (docs/ROADMAP.md M8, belge §7.3).
--
-- SORUN: durum sütunu bir check constraint ile geçerli DEĞERLERİ sınırlıyordu
-- ama geçişleri değil — taslak'tan doğrudan kapandi'ya atlanabiliyordu. Bir
-- tatbikat sonucu denetime sunuluyorsa, "oynanmadan puanlandı" mümkün
-- olmamalı.
--
-- NEDEN TRIGGER: belge §13.3 "state transition domain servisinde doğrulanır"
-- diyor. Bizde eşdeğeri şemadır: RLS yalnızca authenticated/anon'a uygulanır
-- ve tatbikat işleri service_role'den de geçebilir. Geçiş kuralı uygulama
-- katmanında olsaydı, ikinci bir kod yolu onu atlardı.
--
-- ZAMAN HESABI DA BURADA: duraklatılan süre katılımcının yanıt süresine
-- yazılmamalı (belge Faz 7 kabul kriteri). Bunu uygulamaya bırakmak, her
-- çağıranın doğru hesaplamasını ummak demekti.

create or replace function public.simulation_run_state_guard()
returns trigger
language plpgsql
as $$
declare
  v_gecerli boolean;
begin
  if new.durum is not distinct from old.durum then
    return new;
  end if;

  v_gecerli := case old.durum
    when 'taslak'       then new.durum in ('planlandi', 'hazir', 'iptal')
    when 'planlandi'    then new.durum in ('hazir', 'iptal')
    when 'hazir'        then new.durum in ('calisiyor', 'iptal')
    when 'calisiyor'    then new.durum in ('duraklatildi', 'tamamlandi', 'iptal')
    when 'duraklatildi' then new.durum in ('calisiyor', 'tamamlandi', 'iptal')
    -- Puanlama YALNIZCA tamamlanmış tatbikattan başlar (belge Faz 9 kabul
    -- kriteri: "simülasyon tamamlanmadan puanlama başlamıyor").
    when 'tamamlandi'   then new.durum = 'puanlaniyor'
    when 'puanlaniyor'  then new.durum = 'incelendi'
    when 'incelendi'    then new.durum = 'kapandi'
    -- Kapanmış ve iptal edilmiş tatbikat terminal: yeniden açmak, denetime
    -- sunulmuş bir sonucu değiştirmek olurdu. Yeni tatbikat açılır.
    when 'kapandi'      then false
    when 'iptal'        then false
    else false
  end;

  if not v_gecerli then
    raise exception 'Gecersiz durum gecisi: % -> %', old.durum, new.durum;
  end if;

  if new.durum = 'calisiyor' and old.durum = 'hazir' then
    new.basladi_at := now();
  end if;

  if new.durum = 'duraklatildi' then
    new.duraklatildi_at := now();
  end if;

  if new.durum = 'calisiyor' and old.durum = 'duraklatildi' then
    -- Duraklatılan süreyi biriktir: iki kez duraklatılırsa ikisi de sayılmalı.
    new.duraklatilan_saniye :=
      old.duraklatilan_saniye
      + greatest(0, extract(epoch from (now() - old.duraklatildi_at))::integer);
    new.duraklatildi_at := null;
  end if;

  if new.durum in ('tamamlandi', 'iptal') then
    new.bitti_at := now();
  end if;

  return new;
end;
$$;

create trigger simulation_run_state_guard_before_update
  before update on public.simulation_runs
  for each row execute function public.simulation_run_state_guard();

/**
 * Tatbikat başlamadan gelişme yayınlanamaz, bittikten sonra da.
 *
 * Bu olmasaydı bir yönetici, tatbikat 'tamamlandi' olduktan sonra inject
 * ekleyip zaman çizelgesini geriye dönük değiştirebilirdi — puanlama zaten
 * o çizelgeye bakıyor.
 */
create or replace function public.simulation_inject_delivery_guard()
returns trigger
language plpgsql
as $$
declare
  v_durum text;
  v_version_id uuid;
begin
  select durum, version_id into v_durum, v_version_id
  from public.simulation_runs
  where id = new.run_id;

  if v_durum is null then
    raise exception 'Tatbikat bulunamadi';
  end if;

  if v_durum not in ('calisiyor', 'duraklatildi') then
    raise exception 'Gelisme yalnizca calisan tatbikatta yayinlanabilir (durum: %)', v_durum;
  end if;

  -- Inject, tatbikatın oynadığı şablon SÜRÜMÜNE ait olmalı: başka bir
  -- senaryonun gelişmesi bu tatbikata sokulamaz.
  if not exists (
    select 1 from public.scenario_injects
    where id = new.inject_id and version_id = v_version_id
  ) then
    raise exception 'Gelisme bu tatbikatin senaryo surumune ait degil';
  end if;

  return new;
end;
$$;

create trigger simulation_inject_delivery_guard_before_insert
  before insert on public.simulation_inject_deliveries
  for each row execute function public.simulation_inject_delivery_guard();

/** Karar yalnızca çalışan tatbikatta ve yayınlanmış bir gelişmeye verilebilir. */
create or replace function public.simulation_decision_guard()
returns trigger
language plpgsql
as $$
declare
  v_durum text;
  v_version_id uuid;
  v_inject_id uuid;
begin
  select durum, version_id into v_durum, v_version_id
  from public.simulation_runs
  where id = new.run_id;

  if v_durum not in ('calisiyor', 'duraklatildi') then
    raise exception 'Karar yalnizca calisan tatbikatta verilebilir (durum: %)', v_durum;
  end if;

  select inject_id into v_inject_id
  from public.scenario_decision_points
  where id = new.decision_point_id and version_id = v_version_id;

  if not found then
    raise exception 'Karar noktasi bu tatbikatin senaryo surumune ait degil';
  end if;

  -- Karar noktası bir gelişmeye bağlıysa, o gelişme YAYINLANMIŞ olmalı:
  -- yayınlanmamış gelişmenin kararını verebilen katılımcı, senaryoyu
  -- önceden biliyor demektir.
  if v_inject_id is not null and not exists (
    select 1 from public.simulation_inject_deliveries
    where run_id = new.run_id and inject_id = v_inject_id
  ) then
    raise exception 'Bu karar noktasinin gelismesi henuz yayinlanmadi';
  end if;

  return new;
end;
$$;

create trigger simulation_decision_guard_before_insert
  before insert on public.simulation_decisions
  for each row execute function public.simulation_decision_guard();

/**
 * Puanlama sonucu. Tatbikat başına TEK satır (unique run_id): yeniden
 * puanlama aynı satırı günceller, çünkü puanlama deterministiktir — aynı
 * veriden farklı bir sonuç çıkmamalı, dolayısıyla "ikinci puanlama" diye
 * bir kavram yok.
 */
create table public.simulation_scores (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null unique references public.simulation_runs (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  puan integer not null check (puan between 0 and 100),
  durum text not null check (durum in ('BASARILI', 'KISMI', 'BASARISIZ', 'CRITICAL_FAILURE')),
  -- Her satırın gerekçesiyle birlikte tamamı: puan "sistem böyle dedi"
  -- olmamalı (kural 11).
  satirlar jsonb not null,
  kritik_basarisizliklar jsonb not null default '[]',
  hesaplandi_at timestamptz not null default now()
);

create index simulation_scores_tenant_idx on public.simulation_scores (tenant_id);

alter table public.simulation_scores enable row level security;

create policy simulation_scores_own_tenant on public.simulation_scores
  for select using (tenant_id = public.current_tenant_id());

-- Puanı SİSTEM yazar (deterministik motor), istemci değil: kullanıcı kendi
-- puanını yazabilseydi tatbikatın ölçtüğü şey ortadan kalkardı (kural 11).
revoke insert, update, delete on public.simulation_scores from authenticated, anon;
