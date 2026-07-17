-- Başarısız test → bulgu önerisi → verified closure (docs/ROADMAP.md M12,
-- CLAUDE.md kural 11 + 14).
--
-- İKİ İLKE ŞEMADA:
--   Kural 11: başarısız test otomatik bulgu ÖNERİSİ üretir (PROPOSED); insan
--             kabul etmeden gerçek bulgu olmaz. (M8 simulation_finding_proposals
--             deseninin aynısı.)
--   Kural 14: bir bulgu, başarılı RETEST kanıtı + yetkili onayı olmadan
--             kapanamaz. Ticket/aksiyon kapanışı kontrol kapanışı SAYILMAZ.
--             Bu, "başarılı retest olmadan kapanan kritik bulgu sayısı sıfır"
--             KPI'ının şema-seviyesinde zorlanmasıdır.

-- findings artık kontrol testinden de doğabilir.
alter table public.findings drop constraint findings_kaynak_check;
alter table public.findings add constraint findings_kaynak_check
  check (kaynak in ('sizma_testi', 'denetim', 'ic_tespit', 'simulasyon', 'kontrol_testi'));

-- --- Bulgu kapanış alanları (kural 14) ---
alter table public.findings
  -- Bulgunun kaynağı bir kontrol testiyse, hangi test tanımı. Retest bu tanıma
  -- karşı yapılır — "başka bir testi geçtim" bu bulguyu kapatmaz.
  add column kaynak_test_definition_id uuid references public.control_test_definitions (id) on delete set null,
  -- Kapanış retest ister mi. Kontrol testinden doğan (özellikle kritik)
  -- bulgularda true; guard bunu zorlar.
  add column retest_gerekli boolean not null default false,
  -- Kapanışı haklı çıkaran BAŞARILI retest koşusu. Guard bunun gerçekten
  -- PASSED ve bulgudan SONRA olduğunu doğrular.
  add column kapatma_retest_run_id uuid references public.test_runs (id) on delete restrict,
  -- Kapatmayı ONAYLAYAN yetkili. Kapanış bir insan kararıdır.
  add column kapatan uuid references public.profiles (id) on delete set null,
  add column kapatma_onay_at timestamptz;

create table public.control_test_finding_proposals (
  id uuid primary key default gen_random_uuid(),
  -- Öneriyi doğuran BAŞARISIZ test koşusu.
  test_run_id uuid not null references public.test_runs (id) on delete cascade,
  test_definition_id uuid not null references public.control_test_definitions (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  control_id uuid not null references public.controls (id) on delete cascade,
  baslik text not null,
  gerekce text not null,
  onem text not null check (onem in ('acil', 'kritik', 'yuksek', 'orta', 'dusuk')),
  durum text not null default 'PROPOSED' check (durum in ('PROPOSED', 'KABUL', 'RET')),
  finding_id uuid references public.findings (id) on delete set null,
  karar_veren uuid references public.profiles (id) on delete set null,
  karar_at timestamptz,
  -- Aynı başarısız koşudan iki öneri doğmasın.
  created_at timestamptz not null default now(),
  unique (test_run_id)
);

create index control_test_finding_proposals_tenant_idx
  on public.control_test_finding_proposals (tenant_id, durum);

alter table public.control_test_finding_proposals enable row level security;

create policy control_test_finding_proposals_select on public.control_test_finding_proposals
  for select using (tenant_id = public.current_tenant_id());
create policy control_test_finding_proposals_insert on public.control_test_finding_proposals
  for insert with check (tenant_id = public.current_tenant_id());

-- Öneri kararı (KABUL/RET) service_role ile verilir (M8 deseni): istemci
-- UPDATE politikası yok, yetki route'ta.
revoke update, delete on public.control_test_finding_proposals from authenticated, anon;

/**
 * VERIFIED CLOSURE GUARD (kural 14) — bulgu kapanışını zorlar.
 *
 * Bir bulgu 'acik' -> 'kapali' geçerken, eğer retest_gerekli ise:
 *   1. kapatma_retest_run_id dolu olmalı,
 *   2. o koşu GERÇEKTEN 'PASSED' olmalı,
 *   3. koşu, bulgunun kaynak test tanımına ait olmalı ("başka testi geçtim" olmaz),
 *   4. koşu bulgu OLUŞTUKTAN sonra olmalı (eski bir PASSED kapatmaya yetmez),
 *   5. kapatan (onaylayan yetkili) dolu olmalı.
 *
 * NEDEN TRIGGER, NEDEN SADECE UYGULAMA DEĞİL: "başarılı retest olmadan kapanan
 * kritik bulgu sıfır" bir KPI değil, bir GARANTİ olmalı. Uygulama koduna
 * bırakılırsa tek bir yanlış UPDATE onu deler; DB'de zorlanırsa service_role
 * bile atlayamaz. Ticket kapatmak (aksiyon_plani güncellemek) durumu
 * değiştirmediği için bu guard'ı hiç tetiklemez — kapanış yalnız durum
 * geçişindedir.
 */
create or replace function public.finding_verified_closure_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run record;
begin
  -- Yalnız acik -> kapali geçişini denetle. Diğer güncellemeler (aksiyon planı,
  -- önem) serbest — ticket düzenlemek kontrol kapanışı değildir.
  if old.durum = 'acik' and new.durum = 'kapali' then
    if new.retest_gerekli then
      if new.kapatma_retest_run_id is null then
        raise exception 'Bulgu kapatilamaz: retest gerekli ama basarili retest kosusu baglanmamis (kural 14)';
      end if;
      if new.kapatan is null then
        raise exception 'Bulgu kapatilamaz: kapatmayi onaylayan yetkili yok (kural 14)';
      end if;

      select r.sonuc, r.test_definition_id, r.calisti_at into v_run
      from public.test_runs r where r.id = new.kapatma_retest_run_id;

      if v_run is null then
        raise exception 'Retest kosusu bulunamadi';
      end if;
      if v_run.sonuc is distinct from 'PASSED' then
        raise exception 'Bulgu kapatilamaz: baglanan retest PASSED degil (%). Basarisiz/bilinmeyen retest kapatmaz (kural 14)', v_run.sonuc;
      end if;
      if new.kaynak_test_definition_id is not null
         and v_run.test_definition_id is distinct from new.kaynak_test_definition_id then
        raise exception 'Bulgu kapatilamaz: retest baska bir test tanimina ait (kural 14)';
      end if;
      if v_run.calisti_at <= old.created_at then
        raise exception 'Bulgu kapatilamaz: retest bulgudan ONCE kosmus; kapanis icin bulgudan sonra basarili retest gerekir (kural 14)';
      end if;
    end if;
  end if;

  return new;
end;
$$;

create trigger finding_verified_closure_guard_before_update
  before update on public.findings
  for each row execute function public.finding_verified_closure_guard();
