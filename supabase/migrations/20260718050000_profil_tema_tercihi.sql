-- Tema tercihi (master talimat §6, ADR-T2 — docs/adr/PR0-master-talimat-kesif).
--
-- Tercih sırası: oturum YOKKEN cookie/sistem tercihi; oturum AÇILINCA buradaki
-- kullanıcı tercihi üstün gelir. Kolon profiles'ta çünkü tercih kullanıcıya
-- (kiracıya değil) aittir ve profiles_update_self politikası zaten "yalnız
-- kendi satırını güncelleyebilir" sınırını çiziyor — yeni politika gerekmez;
-- privilege trigger'ı (role/tenant_id) bu kolona dokunmaz.
alter table public.profiles
  add column tema_tercihi text not null default 'system'
    check (tema_tercihi in ('light', 'dark', 'system'));
