-- Dikey G1 (docs/adr/PR0-dikeyG-g1-pilot-provisioning-onboarding-2026-07-22.md):
-- yeni rol `platform_operator` + `profiles.tenant_id` nullable (bu rol için
-- tenant yok) + GERÇEK bir açığın kapatılması.
--
-- KEŞİFTE BULUNAN AÇIK: `tenants_insert_authenticated` ve `profiles_insert_
-- self` (20260716120003) herhangi bir authenticated Supabase Auth
-- kullanıcısının UI hiç gerekmeden yeni tenant açıp kendini admin
-- yapabilmesini sağlıyordu (M1'in terk edilmiş "self-serve bootstrap"
-- planı — kod tabanında hiç signUp/inviteUser çağrılmıyor, bu politika
-- kullanılmayan ama AÇIK bir arka kapıydı). Kurucunun G1 kararı ("açık
-- internetten Kayıt Ol ekranı yapılmayacak, self-servis provisioning G2'ye
-- bırakılacak") bu politikayla doğrudan çelişiyordu. Bu migration ikisini
-- de kapatır — hiçbir mevcut akış buna bağımlı değildi (e2e fixture'ı zaten
-- service_role kullanıyor, grep doğrulandı).

drop policy if exists tenants_insert_authenticated on public.tenants;
drop policy if exists profiles_insert_self on public.profiles;

-- Yeni yazma yolu YALNIZ service_role'e açık (RLS devam eder ama hiçbir
-- authenticated/anon policy INSERT izni vermez — service_role zaten RLS'i
-- bypass eder, ayrı bir policy gerekmez). Bundan böyle tenant/ilk-admin-
-- profili yaratmanın TEK yolu bu dilimin provisioning rotasıdır.

alter table public.profiles
  add constraint profiles_tenant_id_role_check
  check (
    (role = 'platform_operator' and tenant_id is null)
    or (role <> 'platform_operator' and tenant_id is not null)
  );

alter table public.profiles alter column tenant_id drop not null;

alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('admin', 'uyum', 'denetci_misafir', 'platform_operator'));

-- current_tenant_id()/current_role() (20260716120003) zaten `profiles`den
-- okuyor; platform_operator için current_tenant_id() null döner — mevcut
-- HER tenant-scoped SELECT politikası (`tenant_id = current_tenant_id()`)
-- bu durumda otomatik olarak SIFIR satır döndürür. Yeni bir "hariç tut"
-- kuralı icat ETMİYORUZ; izolasyon zaten buradan geliyor.

-- Platform operatörünün KENDİ profilini görebilmesi için mevcut
-- `profiles_select_same_tenant` yeterli değil (tenant_id null eşleşmez).
-- Kendi satırını görmesi gerek (ör. rol kontrolü için).
create policy profiles_select_self on public.profiles
  for select
  using (id = auth.uid());

-- Yeni yazma yolu: yalnız platform_operator tenant açabilir / ilk profili
-- (o tenant'ın TENANT_ADMIN'i) davet edebilir. Bir platform_operator'ın
-- KENDİ profiles satırı (id=auth.uid(), 1:1 PK) zaten sabit ve immutable
-- (mevcut profiles_prevent_privilege_change trigger'ı) — bu politika
-- kendi kendini yükseltmesine izin VERMEZ, yalnız BAŞKALARI için (davet
-- edilen kullanıcı) yeni profil satırı açmasına izin verir.
create policy tenants_insert_platform_operator on public.tenants
  for insert
  with check (public.current_role() = 'platform_operator');

create policy profiles_insert_platform_operator on public.profiles
  for insert
  with check (public.current_role() = 'platform_operator');
