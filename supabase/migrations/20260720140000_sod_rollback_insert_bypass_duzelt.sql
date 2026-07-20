-- Forward-fix: sod_import_rollbacklari maker-checker guard'ı yalnız
-- `before update` tetikleniyordu (20260718060000). RLS insert politikası
-- (`sod_import_rollbacklari_insert`) yalnız tenant_id/talep_eden'i kontrol
-- ediyor, `durum`'a dokunmuyor — herhangi bir kiracı üyesi doğrudan
-- durum='UYGULANDI', onaylayan=kendisi, uygulandi_at=now() ile INSERT
-- yaparak iki-kişi kuralını (maker-checker) tamamen atlayabiliyordu.
--
-- Aynı bug sınıfı bugün beş VERIFIED-guard fonksiyonunda bulunup düzeltildi
-- (20260720110000): guard'ın INSERT dalı eksikti/dardı. Buradaki kök neden
-- daha da basit — INSERT dalı HİÇ YOKTU.
--
-- Şiplenmiş migration değiştirilmez — bu FORWARD-FIX guard fonksiyonuna bir
-- INSERT dalı ekler ve trigger'ı `before insert or update`'e genişletir.
create or replace function public.sod_import_rollback_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    if new.durum <> 'TALEP_EDILDI' then
      raise exception 'Rollback talebi yalnizca TALEP_EDILDI olarak acilabilir (maker-checker)';
    end if;
    if new.onaylayan is not null or new.uygulandi_at is not null then
      raise exception 'Karar alanlari (onaylayan/uygulandi_at) talep aninda dolu olamaz (maker-checker)';
    end if;
    return new;
  end if;

  if old.durum <> 'TALEP_EDILDI' then
    raise exception 'Karar verilmis rollback kaydi degistirilemez (%)', old.durum;
  end if;
  if new.manifest_id is distinct from old.manifest_id
     or new.talep_eden is distinct from old.talep_eden
     or new.tenant_id is distinct from old.tenant_id then
    raise exception 'Rollback talebinin kimlik alanlari degistirilemez';
  end if;
  if new.durum in ('REDDEDILDI', 'UYGULANDI') then
    if new.onaylayan is null then
      raise exception 'Rollback karari onaylayan olmadan verilemez';
    end if;
    if new.onaylayan = new.talep_eden then
      raise exception 'Talep eden kendi rollback''ini karara baglayamaz (maker-checker)';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists sod_import_rollback_guard_before_update on public.sod_import_rollbacklari;
create trigger sod_import_rollback_guard_before_insert_or_update
  before insert or update on public.sod_import_rollbacklari
  for each row execute function public.sod_import_rollback_guard();
