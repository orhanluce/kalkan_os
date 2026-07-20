-- Dikey F, F1 (docs/adr/PR0-dikeyF-f1-test-manifesti-kritik-hizmet-retest-
-- 2026-07-20.md §3): test_runs'a opsiyonel "bu koşu hangi bulguyu kapatmak
-- için retest edildi" alanı. YALNIZCA koşu OLUŞTURULURKEN gerçekten
-- biliniyorsa dolar (route sunucu tarafında doğrular, istemciden KÖR
-- GÜVENİLMEZ) — test_runs append-only olduğu için bu alan bir daha
-- DEĞİŞTİRİLEMEZ (mevcut revoke update/delete zaten koruyor).
--
-- BU ALAN, findings.kapatma_retest_run_id'nin YERİNE GEÇMEZ: ikisi FARKLI
-- olguları taşır. `retest_of_finding_id` — "bu koşu şu bulguyu kapatma NİYETİYLE
-- çalıştırıldı" (koşu anındaki DEKLARE EDİLMİŞ niyet). `kapatma_retest_run_id`
-- — "bu bulgu GERÇEKTEN şu koşuyla kapandı" (bulgu tarafında, kapanış anında
-- guard'ın doğruladığı GERÇEK olgu). Bir retest niyet edilip başarısız olabilir
-- (ikinci alan hiç dolmaz), ya da bulgu FARKLI bir koşuyla kapanabilir.

alter table public.test_runs
  add column retest_of_finding_id uuid references public.findings (id) on delete set null;

/**
 * TENANT BÜTÜNLÜĞÜ GUARD'I: retest_of_finding_id doluysa, o bulgunun
 * tenant_id'si BU koşunun tenant_id'siyle eşleşmeli. test_runs zaten
 * append-only (yalnız INSERT) — BEFORE INSERT yeterli.
 */
create or replace function public.test_run_retest_of_finding_tenant_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_finding_tenant uuid;
begin
  if new.retest_of_finding_id is not null then
    select tenant_id into v_finding_tenant
    from public.findings
    where id = new.retest_of_finding_id;

    if v_finding_tenant is null then
      raise exception 'retest_of_finding_id gecerli bir bulguya isaret etmiyor';
    end if;
    if v_finding_tenant is distinct from new.tenant_id then
      raise exception 'retest_of_finding_id farkli bir kiraciya ait olamaz (cross-tenant guard)';
    end if;
  end if;
  return new;
end;
$$;

create trigger test_run_retest_of_finding_tenant_guard_trg
  before insert on public.test_runs
  for each row execute function public.test_run_retest_of_finding_tenant_guard();
