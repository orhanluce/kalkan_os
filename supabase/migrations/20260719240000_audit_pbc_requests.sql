-- M17 Audit Workspace — "sonraki dilim" borcunun ikinci maddesi (20260719050000
-- notu: "PBC/request tablosu (M38 regulatory_requests deseni yeniden
-- kullanılabilir)"). PBC = "Prepared By Client": denetim ekibinin denetlenen
-- birimden istediği belge/kanıt listesi.
--
-- MEVCUT DESEN YENİDEN KULLANILDI, YENİ ALTYAPI KURULMADI: regulatory_requests/
-- regulatory_responses'ın (20260719030000) durum makinesi + "kanıtsız kapanış
-- yok" disiplini burada AYNI ruhla, PBC'nin daha sade ihtiyacına uyarlandı
-- (dış otorite yanıtı gibi sürüm/onay/gönderim makbuzu YOK — PBC bir dahili
-- takip listesidir, kanıt zaten `evidences`/workpaper bağlarıyla ayrı akıyor).
--
-- TENANT'A ÖZGÜ: audit_engagements gibi kurumun kendi denetim verisi.
--
-- ROLLBACK NOTU: bağımsız tek tablo, drop edilebilir. Üretim verisi yok.
--
-- BİLİNÇLİ SONRAKİ DİLİM (§1.29'un kalanı): formal independence_declarations
-- bağı (G7 tablosu denetim işine de bağlanabilir), WORM export.

create table public.audit_pbc_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  engagement_id uuid not null references public.audit_engagements (id) on delete cascade,
  talep_metni text not null,
  son_tarih date,
  -- ACIK -> ALINDI (kanıt+tarih zorunlu) -> KAPANDI (yalnız ALINDI'dan).
  durum text not null default 'ACIK' check (durum in ('ACIK', 'ALINDI', 'KAPANDI')),
  alinan_kanit text,
  alindi_tarihi date,
  alan uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger audit_pbc_requests_set_updated_at
  before update on public.audit_pbc_requests
  for each row execute function public.set_updated_at();

create index audit_pbc_requests_engagement_idx on public.audit_pbc_requests (engagement_id);

/**
 * PBC GUARD'I (regulatory_response_guard'ın sadeleştirilmiş aynısı, kural 14
 * ruhu): ALINDI için kanıt+tarih zorunlu (kanıtsız "geldi" iddiası yok);
 * KAPANDI yalnız ALINDI'dan (hiç gelmemiş talep kapanamaz — ticket kapatma
 * kontrol/PBC karşılanması sayılmaz, kural 14 deseni); ALINDI/KAPANDI kanıt
 * alanları DONUK (sessiz değişim yok, yalnız durum ACIK'a dönerse düzenlenebilir).
 */
create or replace function public.audit_pbc_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    if new.durum <> 'ACIK' then
      raise exception 'PBC talebi yalniz ACIK dogar';
    end if;
    return new;
  end if;

  if new.durum = 'ALINDI' and old.durum is distinct from 'ALINDI' then
    if new.alinan_kanit is null or btrim(new.alinan_kanit) = '' or new.alindi_tarihi is null then
      raise exception 'ALINDI icin kanit + tarih zorunlu (kanitsiz "geldi" iddiasi yok)';
    end if;
  end if;

  if new.durum = 'KAPANDI' and old.durum is distinct from 'KAPANDI' then
    if old.durum is distinct from 'ALINDI' then
      raise exception 'KAPANDI yalniz ALINDI talepten yapilir (kanitsiz kapanis yok, kural 14 ruhu)';
    end if;
  end if;

  if old.durum in ('ALINDI', 'KAPANDI') and new.durum in ('ALINDI', 'KAPANDI') then
    if new.alinan_kanit is distinct from old.alinan_kanit or new.alindi_tarihi is distinct from old.alindi_tarihi then
      raise exception 'Alinan kanit donuk: once durum ACIK''a dondurulmeli';
    end if;
  end if;

  return new;
end;
$$;

create trigger audit_pbc_guard_trg
  before insert or update on public.audit_pbc_requests
  for each row execute function public.audit_pbc_guard();

create or replace function public.audit_pbc_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'UPDATE' and new.durum is distinct from old.durum then
    insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
    values (new.tenant_id, auth.uid(), 'pbc_talep_durum_degisti', 'audit_pbc_requests', new.id,
      jsonb_build_object('durum_onceki', old.durum, 'durum', new.durum));
  end if;
  return new;
end;
$$;

create trigger audit_pbc_log_update after update on public.audit_pbc_requests
  for each row execute function public.audit_pbc_log();

alter table public.audit_pbc_requests enable row level security;

create policy audit_pbc_requests_select on public.audit_pbc_requests
  for select using (tenant_id = public.current_tenant_id());
create policy audit_pbc_requests_write on public.audit_pbc_requests
  for all
  using (tenant_id = public.current_tenant_id() and public.current_user_role() in ('admin', 'uyum'))
  with check (tenant_id = public.current_tenant_id() and public.current_user_role() in ('admin', 'uyum'));
