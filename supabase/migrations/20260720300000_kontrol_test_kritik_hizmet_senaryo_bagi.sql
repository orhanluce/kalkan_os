-- Dikey F, F1 (docs/adr/PR0-dikeyF-f1-test-manifesti-kritik-hizmet-retest-
-- 2026-07-20.md §6): control_test_definitions'a OPSİYONEL gerçek kritik
-- hizmet + senaryo referansı. Mevcut serbest metin (kritik_hizmet_adi/
-- senaryo_kimligi) KALIR — silinmez, otomatik eşleştirilmez (ad benzerliğinden
-- FK üretmek sahte bir ilişki iddiası olurdu, kural 11).
--
-- critical_business_services TENANT'A ÖZGÜDÜR — sıradan `references` cross-
-- tenant'ı ENGELLEMEZ (yalnız "satır var mı" der). BEFORE INSERT OR UPDATE
-- constraint trigger ile aynı-tenant zorlanır, service_role dahil atlanamaz
-- (Dikey E1/E2'nin cross-tenant guard'larının AYNI deseni).
--
-- scenario_templates TENANT'A AİT DEĞİLDİR (controls/frameworks ile AYNI
-- desen — global kütüphane, RLS `for select using (true)`). Bu FK için
-- tenant guard'a GEREK YOK; control_id'nin controls'a bağlanmasıyla aynı
-- durum.

alter table public.control_test_definitions
  add column critical_service_id uuid references public.critical_business_services (id) on delete set null,
  add column scenario_template_id uuid references public.scenario_templates (id) on delete set null;

create index control_test_definitions_critical_service_idx
  on public.control_test_definitions (critical_service_id)
  where critical_service_id is not null;

/**
 * TENANT BÜTÜNLÜĞÜ GUARD'I: critical_service_id doluysa, o kritik hizmetin
 * tenant_id'si BU tanımın tenant_id'siyle eşleşmeli. security definer +
 * BEFORE INSERT OR UPDATE — service_role dahil atlanamaz (RLS'e bağlı değil,
 * RLS'in kendisi service_role'ü zaten atlıyor; bu yüzden guard TRIGGER'da).
 */
create or replace function public.control_test_definition_critical_service_tenant_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_service_tenant uuid;
begin
  if new.critical_service_id is not null then
    select tenant_id into v_service_tenant
    from public.critical_business_services
    where id = new.critical_service_id;

    if v_service_tenant is null then
      raise exception 'critical_service_id gecerli bir kritik hizmete isaret etmiyor';
    end if;
    if v_service_tenant is distinct from new.tenant_id then
      raise exception 'critical_service_id farkli bir kiraciya ait olamaz (cross-tenant guard)';
    end if;
  end if;
  return new;
end;
$$;

create trigger control_test_definition_critical_service_tenant_guard_trg
  before insert or update on public.control_test_definitions
  for each row execute function public.control_test_definition_critical_service_tenant_guard();

-- --- Bulgu kapanışında bağımsız-doğrulayan ilişkisinin watertight kanıtı ---
-- Bir bulguya en fazla bir öneri finding_id atayabilir (bugüne dek yalnız
-- uygulama akışıyla doğruydu — /api/kontrol-test/oneri/[oneriId]/route.ts
-- yalnız durum='PROPOSED' iken finding_id yazıyor ve bir daha yazmıyor;
-- şimdi şemada da zorlanıyor).
create unique index control_test_finding_proposals_finding_id_uniq
  on public.control_test_finding_proposals (finding_id)
  where finding_id is not null;
