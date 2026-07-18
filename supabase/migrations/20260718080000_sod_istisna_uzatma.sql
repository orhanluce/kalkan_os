-- SoD istisna UZATMA akışı (docs/ROADMAP.md M16 #3).
--
-- KURUCU TALİMATI: "yeni gerekçe/risk/süre + bağımsız onay, geçmiş silinmez".
-- Süre-kilidi (20260718020000) onaylı/dolmuş istisnanın bitis'ini düzenleme
-- yolunu bilinçli KAPATMIŞTI; uzatma o kaydı DEĞİŞTİRMEZ — aynı çatışmaya
-- bağlı YENİ bir istisna kaydı açar ve `onceki_istisna_id` ile zincire bağlar.
-- Eski kayıt olduğu gibi durur (append ruhu, kural 2); onay yine bağımsızdır
-- (mevcut onay guard'ları + kimlik atfı guard'ları yeni kayda da aynen işler).
alter table public.sod_istisnalari
  add column onceki_istisna_id uuid references public.sod_istisnalari (id) on delete restrict;

create index sod_istisnalari_onceki_idx
  on public.sod_istisnalari (onceki_istisna_id)
  where onceki_istisna_id is not null;

/**
 * UZATMA GUARD'I (before insert): zincir uydurulamaz.
 *   - önceki kayıt VAR ve AYNI çatışma + AYNI kiracıya ait olmalı (başka
 *     çatışmanın onayı bu çatışmaya emsal gösterilemez);
 *   - önceki kayıt KARARA BAĞLANMIŞ olmalı ('onaylandi' veya 'suresi_doldu')
 *     — bekleyen/reddedilen/iptal edilen talep "uzatılmaz", yeni normal talep
 *     açılır;
 *   - yeni bitis, öncekinin bitiminden İLERİDE olmalı (uzatma geriye gitmez).
 */
create or replace function public.sod_istisna_uzatma_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_onceki record;
begin
  if new.onceki_istisna_id is null then
    return new;
  end if;

  select conflict_id, tenant_id, durum, bitis into v_onceki
  from public.sod_istisnalari
  where id = new.onceki_istisna_id;

  if not found then
    raise exception 'Uzatma: onceki istisna bulunamadi';
  end if;
  if v_onceki.conflict_id <> new.conflict_id or v_onceki.tenant_id <> new.tenant_id then
    raise exception 'Uzatma: onceki istisna ayni catismaya ait olmali (zincir uydurulamaz)';
  end if;
  if v_onceki.durum not in ('onaylandi', 'suresi_doldu') then
    raise exception 'Uzatma: yalnizca onaylanmis/suresi dolmus istisna uzatilabilir (mevcut durum: %)', v_onceki.durum;
  end if;
  if new.bitis <= v_onceki.bitis then
    raise exception 'Uzatma: yeni bitis (%) oncekinin bitiminden (%) ileride olmali', new.bitis, v_onceki.bitis;
  end if;

  return new;
end;
$$;

create trigger sod_istisna_uzatma_guard_before_insert
  before insert on public.sod_istisnalari
  for each row execute function public.sod_istisna_uzatma_guard();
