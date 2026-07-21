-- Dikey G1 forward-fix: canlı smoke sırasında bulunan gerçek açık.
-- `tenants_insert_platform_operator`'ın WITH CHECK'i doğru evalüe ediyordu
-- (bare INSERT 201 döndü) ama `.select()` zincirlenince (PostgREST'in
-- `return=representation`'ı) platform_operator'ın YENİ oluşturduğu satırı
-- geri OKUYAMAMASI (tenants_select_own yalnız `id = current_tenant_id()`
-- eşleşir, platform_operator'ın tenant'ı yok) tüm işlemi RLS ihlali gibi
-- başarısız gösteriyordu. Platform operatörün provisioning işini yapabilmesi
-- için zaten tenant okuması GEREKİYOR (yalnız iş verisini DEĞİL — ADR §3).
create policy tenants_select_platform_operator on public.tenants
  for select
  using (public.current_role() = 'platform_operator');
