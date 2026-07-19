-- 37 Tez Dikey B, Faz 2 ilk dilim: DORA RoI Annex III "Type of ICT services"
-- kapalı kümesi (S01-S19) — GLOBAL referans katalog. roi_kaynak_kayitlari'nın
-- (20260719310000, dört-göz forward-fix 20260720000001) GÜNCEL (iki-kişili)
-- dört-göz deseninin AYNISI — bugünün hatasından ders alınarak baştan doğru
-- kopyalandı (incelemeye_alan != dogrulayan).
--
-- İÇERİK: migration ŞEMA + BOŞ tablo kurar. Satırlar data/dora_roi/
-- ict_service_types.yaml'dan scripts/seed-ict-service-types.ts ile AYRI,
-- açık bir adımda yüklenir (data/controls/*.yaml + seed-controls.ts
-- deseninin aynısı) — TODO_DOGRULA doğar, asla VERIFIED seed edilmez
-- (kural 3). Migration'ın kendisi hiçbir satır INSERT ETMEZ.

create table public.ict_service_types (
  id uuid primary key default gen_random_uuid(),
  kod text not null unique check (kod ~ '^S[0-9]{2}$'),
  ad text not null,
  aciklama text,
  kaynak_url text,
  kaynak_turu text not null default 'IKINCIL' check (kaynak_turu in ('EUR_LEX_BIREBIR', 'IKINCIL')),
  dogrulama_durumu text not null default 'DRAFT_RESEARCH'
    check (dogrulama_durumu in ('DRAFT_RESEARCH', 'TODO_DOGRULA', 'LEGAL_REVIEW', 'VERIFIED', 'SUPERSEDED', 'REJECTED')),
  incelemeye_alan uuid references public.profiles (id) on delete restrict,
  incelemeye_alinma_zamani timestamptz,
  dogrulayan uuid references public.profiles (id) on delete restrict,
  dogrulama_zamani timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.ict_service_types is
  'DORA RoI Annex III (CIR 2024/2956) "Type of ICT services" kapalı kümesi — global referans, tenant_id YOK. İçerik data/dora_roi/ict_service_types.yaml''dan seed edilir (kural 3), migration boş kurar.';

create or replace function public.ict_hizmet_turu_dogrulama_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    if new.dogrulama_durumu = 'VERIFIED' then
      raise exception 'kayit VERIFIED dogamaz: dogrulama yalniz incelemeyle kazanilir (kural 3)';
    end if;
    if new.dogrulama_durumu = 'REJECTED' then
      raise exception 'kayit REJECTED dogamaz: red karari yalniz LEGAL_REVIEW uzerinden verilebilir';
    end if;
    -- INSERT-anında doğrudan LEGAL_REVIEW'e doğmak da incelemeye_alan/zaman
    -- ister — aksi halde tek kişi LEGAL_REVIEW satırını sıfırdan yaratıp
    -- incelemeye_alan'ı NULL bırakır, sonra kendisi dogrulayan olarak
    -- VERIFIED'e taşır (NULL = kendisi eşitliği FALSE değil NULL döner,
    -- guard'ı sessizce atlatır). Bu kontrol UPDATE-yolundakiyle BİREBİR.
    if new.dogrulama_durumu = 'LEGAL_REVIEW' and (new.incelemeye_alan is null or new.incelemeye_alinma_zamani is null) then
      raise exception 'LEGAL_REVIEW gecisi incelemeye_alan ve zaman olmadan yapilamaz (dort goz)';
    end if;
    return new;
  end if;

  if new.dogrulama_durumu = 'LEGAL_REVIEW' and old.dogrulama_durumu is distinct from 'LEGAL_REVIEW' then
    if new.incelemeye_alan is null or new.incelemeye_alinma_zamani is null then
      raise exception 'LEGAL_REVIEW gecisi incelemeye_alan ve zaman olmadan yapilamaz (dort goz)';
    end if;
  end if;

  if new.dogrulama_durumu = 'VERIFIED' and old.dogrulama_durumu is distinct from 'VERIFIED' then
    if old.dogrulama_durumu is distinct from 'LEGAL_REVIEW' then
      raise exception 'VERIFIED gecisi yalniz LEGAL_REVIEW uzerinden yapilabilir (kural 3)';
    end if;
    if new.dogrulayan is null or new.dogrulama_zamani is null then
      raise exception 'VERIFIED gecisi dogrulayan ve dogrulama_zamani olmadan yapilamaz (kural 3)';
    end if;
    if new.dogrulayan = new.incelemeye_alan then
      raise exception 'Incelemeye alan kendi sunumunu dogrulayamaz (dort goz, M21)';
    end if;
  end if;

  if new.dogrulama_durumu = 'REJECTED' and old.dogrulama_durumu is distinct from 'REJECTED' then
    if old.dogrulama_durumu is distinct from 'LEGAL_REVIEW' then
      raise exception 'REJECTED karari yalniz LEGAL_REVIEW uzerinden verilebilir';
    end if;
    if new.dogrulayan is null then
      raise exception 'REJECTED karari karar sahibi (dogrulayan) olmadan yazilamaz';
    end if;
  end if;

  if old.dogrulama_durumu = 'VERIFIED' and new.dogrulama_durumu = 'VERIFIED' then
    if new.kod is distinct from old.kod or new.ad is distinct from old.ad or new.aciklama is distinct from old.aciklama then
      raise exception 'VERIFIED ICT hizmet turu kaydinin icerigi degistirilemez: once dogrulama geri alinmali';
    end if;
  end if;

  return new;
end;
$$;

create trigger ict_hizmet_turu_dogrulama_guard_trg
  before insert or update on public.ict_service_types
  for each row execute function public.ict_hizmet_turu_dogrulama_guard();

create trigger ict_hizmet_turu_updated_at
  before update on public.ict_service_types
  for each row execute function public.set_updated_at();

alter table public.ict_service_types enable row level security;

create policy ict_service_types_select on public.ict_service_types
  for select to authenticated using (true);

create policy ict_service_types_write on public.ict_service_types
  for all to authenticated using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'uyum'))
  ) with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'uyum'))
  );
