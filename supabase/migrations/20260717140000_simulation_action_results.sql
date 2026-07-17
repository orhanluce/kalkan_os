-- Beklenen aksiyonların tatbikattaki sonucu (docs/ROADMAP.md M8).
--
-- NEDEN GEREKLİ: puanlama motoru (src/lib/scoring.ts) "aksiyon tamamlandı mı,
-- kaçıncı senaryo dakikasında" bilgisini ister, ama şemada bunu tutan yer
-- yoktu. Karar noktaları ile beklenen aksiyonlar arasında otomatik bir bağ
-- KURMUYORUZ: "eskalasyon yapıldı" kararının verilmiş olması, eskalasyonun
-- gerçekten yapıldığı anlamına gelmez. Tatbikat yöneticisi/gözlemci neyin
-- fiilen olduğunu işaretler.
--
-- Bu, belgenin §9.3 ilkesiyle uyumlu: puanlama deterministik kurallardan
-- gelir, ama kuralların GİRDİSİ insan gözlemidir — sistem bir kararın
-- metnini okuyup "bu eskalasyon sayılır mı" diye yorumlamaz.

create table public.simulation_action_results (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.simulation_runs (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  expected_action_id uuid not null references public.scenario_expected_actions (id) on delete restrict,
  tamamlandi boolean not null,
  -- Senaryo dakikası (gerçek zaman değil). Tamamlanmadıysa null.
  senaryo_dakika integer check (senaryo_dakika >= 0),
  isaretleyen uuid not null references public.profiles (id) on delete restrict,
  aciklama text,
  created_at timestamptz not null default now(),
  -- Aksiyon başına tek sonuç: yeniden işaretleme aynı satırı günceller.
  unique (run_id, expected_action_id),
  -- Tamamlandıysa dakika ZORUNLU: zaman hedefi kuralları (ACTION_COMPLETED_WITHIN)
  -- onsuz değerlendirilemez ve sessizce "uygulanamadı" olurdu.
  constraint tamamlanan_aksiyon_dakika_ister
    check (not tamamlandi or senaryo_dakika is not null)
);

create index simulation_action_results_run_idx on public.simulation_action_results (run_id);

/**
 * Aksiyon sonucu yalnızca çalışan veya tamamlanmış tatbikatta işaretlenebilir
 * ve puanlama BAŞLADIKTAN sonra değiştirilemez.
 *
 * Puanlandıktan sonra girdi değişebilseydi, deterministiklik iddiası
 * anlamsız olurdu: aynı tatbikat, kaydedilmiş puanıyla uyuşmayan bir girdiye
 * sahip olurdu.
 */
create or replace function public.simulation_action_result_guard()
returns trigger
language plpgsql
as $$
declare
  v_durum text;
  v_version_id uuid;
begin
  select durum, version_id into v_durum, v_version_id
  from public.simulation_runs
  where id = coalesce(new.run_id, old.run_id);

  if v_durum is null then
    raise exception 'Tatbikat bulunamadi';
  end if;

  if v_durum not in ('calisiyor', 'duraklatildi', 'tamamlandi') then
    raise exception 'Aksiyon sonucu bu asamada isaretlenemez (durum: %)', v_durum;
  end if;

  if TG_OP = 'DELETE' then
    return old;
  end if;

  if not exists (
    select 1 from public.scenario_expected_actions
    where id = new.expected_action_id and version_id = v_version_id
  ) then
    raise exception 'Beklenen aksiyon bu tatbikatin senaryo surumune ait degil';
  end if;

  return new;
end;
$$;

create trigger simulation_action_result_guard_before_write
  before insert or update or delete on public.simulation_action_results
  for each row execute function public.simulation_action_result_guard();

alter table public.simulation_action_results enable row level security;

create policy simulation_action_results_read on public.simulation_action_results
  for select using (tenant_id = public.current_tenant_id());

-- İşaretleme yalnızca yönetici ve gözlemcinin işi: katılımcı kendi
-- aksiyonunu "tamamlandı" işaretleyebilseydi tatbikat kendi kendini
-- puanlardı.
create policy simulation_action_results_yonetici_yazar on public.simulation_action_results
  for insert with check (
    tenant_id = public.current_tenant_id()
    and isaretleyen = auth.uid()
    and exists (
      select 1 from public.simulation_participants p
      where p.run_id = simulation_action_results.run_id
        and p.user_id = auth.uid()
        and p.katilim_tipi in ('yonetici', 'gozlemci')
    )
  );

create policy simulation_action_results_yonetici_gunceller on public.simulation_action_results
  for update using (
    tenant_id = public.current_tenant_id()
    and exists (
      select 1 from public.simulation_participants p
      where p.run_id = simulation_action_results.run_id
        and p.user_id = auth.uid()
        and p.katilim_tipi in ('yonetici', 'gozlemci')
    )
  );

revoke delete on public.simulation_action_results from authenticated, anon;
