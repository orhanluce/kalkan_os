-- Dikey G1 forward-fix: canlı e2e sırasında bulunan gerçek açık.
-- `tenant_provisioning`'de yalnız `platform_operator` için bir UPDATE
-- politikası vardı (20260722010000) — tenant admin/uyum kendi provisioning
-- kaydını hiç GÜNCELLEYEMİYORDU (yalnız SELECT), oysa ADR §7'nin durum
-- makinesi tenant admin'in KENDİ ilerlemesini (ILK_GIRIS_TAMAMLANDI,
-- KURULUM_DEVAM_EDIYOR, KURULUM_INCELEMEDE) tetiklemesini bekliyordu.
--
-- Güvenlik: `tenant_provisioning_durum_guard` trigger'ı zaten HANGİ durum
-- geçişlerinin meşru olduğunu (ADR §7) rol'den bağımsız zorluyor — ama bu
-- politika AYRICA hedef durumu (kural 14 disiplini, rota'daki TENANT_ADMIN_
-- HEDEFLERI ile AYNI liste) kısıtlar: tenant admin PILOT_AKTIF/DONDURULDU/
-- SONA_ERDI'yi KENDİ isteğiyle asla ayarlayamaz — bu yalnız platform_
-- operator'ün işidir (RLS'te de, yalnız route'ta değil — "buradaki
-- yönlendirme bir kolaylıktır, koruma değildir" ilkesi, bkz. proxy.ts).
create policy tenant_provisioning_update_own_tenant on public.tenant_provisioning
  for update
  using (tenant_id = public.current_tenant_id())
  with check (
    tenant_id = public.current_tenant_id()
    and durum in ('ILK_GIRIS_TAMAMLANDI', 'KURULUM_DEVAM_EDIYOR', 'KURULUM_INCELEMEDE')
  );
