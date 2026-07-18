-- M35 — Third-Party & ICT Supply-Chain Risk (Gate G4, ilk üretim dikeyi).
--
-- TENANT'A ÖZGÜ: tedarikçi/dördüncü-taraf/sözleşme/çıkış planı kurumun kendi
-- risk verisidir — her tabloda tenant_id + RLS (kural 1).
--
-- BU DİLİM (dar-ama-çalışan): tedarikçi sicili + tiering + hizmet/veri/kritiklik
-- + dördüncü-taraf (bilinmeyen bağımlılık) + sözleşme (yenileme/süre-dolumu) +
-- çıkış planı (tatbikat kanıtı olmadan "test edildi" işaretlenemez) +
-- yoğunlaşma analizi. ANAHTAR İNVARYANT (nihai §4 #25): dış rating/AI skoru
-- OTOMATİK vendor kabul/red kararına DÖNÜŞMEZ — karar insana aittir (guard).
--
-- ROLLBACK NOTU: eklemeli, bağımsız tablolar. Geri almak için tabloları ters
-- FK sırasıyla drop et (exit_plans, third_party_contracts, fourth_parties,
-- third_party_services, third_parties) ve cron işini unschedule et. Üretim
-- verisi yok (yeni alan) — fresh drop güvenli.
--
-- BİLİNÇLİ SONRAKİ DİLİM (bu PR'da YOK): ThirdPartyAssessment/Questionnaire/
-- Finding due-diligence iş akışı, resmî DORA RoI RTS şeması, vendor-portal dış
-- erişim (G7 M41 partner modeliyle gelir). Bunlar aynı kanıtlı desenleri
-- kullanacak; şimdilik çekirdek graf + kritik invariant'lar.

-- --- Tedarikçi (üçüncü taraf) ---
create table public.third_parties (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  ad text not null,
  ulke text,
  -- Tiering (kritiklik): kritik hizmete dokunan tedarikçi KRITIK.
  tier text not null default 'DUSUK' check (tier in ('KRITIK', 'ONEMLI', 'DUSUK')),
  hizmet_ozeti text,
  -- DIŞ RATING = SALT BİLGİ (adapter'dan gelir); karar DEĞİL (invariant #25).
  dis_rating text,
  dis_rating_kaynagi text,
  -- Vendor kararı: yalnız İNSAN verir (guard: karar_veren zorunlu).
  karar text not null default 'INCELEME' check (karar in ('INCELEME', 'ONAYLANDI', 'REDDEDILDI')),
  karar_veren uuid references public.profiles (id) on delete restrict,
  karar_zamani timestamptz,
  durum text not null default 'AKTIF' check (durum in ('AKTIF', 'PASIF')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, ad)
);

create trigger third_parties_set_updated_at
  before update on public.third_parties
  for each row execute function public.set_updated_at();

/**
 * İNSAN KARAR GUARD'I (invariant #25): dış rating tek başına vendor'ı
 * ONAYLANDI/REDDEDILDI yapamaz — karar veren (insan) + zaman zorunlu. Kimlik
 * atfı: istemci bağlamında karar_veren = oturum sahibi (service/cron muaf).
 */
create or replace function public.third_party_karar_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.karar in ('ONAYLANDI', 'REDDEDILDI') then
    if new.karar_veren is null or new.karar_zamani is null then
      raise exception 'Vendor karari (ONAYLANDI/REDDEDILDI) insan karari ister: karar_veren + zaman zorunlu (dis rating otomatik karar degildir)';
    end if;
    if auth.uid() is not null and new.karar_veren is distinct from auth.uid() then
      raise exception 'Vendor karari ancak oturum sahibi adina verilebilir (kimlik atfi)';
    end if;
  end if;
  return new;
end;
$$;

create trigger third_party_karar_guard_trg
  before insert or update on public.third_parties
  for each row execute function public.third_party_karar_guard();

-- --- Hizmet (tedarikçinin sunduğu; veri/kritiklik) ---
create table public.third_party_services (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  third_party_id uuid not null references public.third_parties (id) on delete cascade,
  hizmet_adi text not null,
  -- Kritik iş hizmetine dokunuyor mu (M13 critical service tablosu ayrı dilim;
  -- şimdilik bayrak + serbest ad).
  kritik boolean not null default false,
  kritik_hizmet_adi text,
  -- Eriştiği veri sınıfları (KVKK/gizlilik kapsamı).
  veri_siniflari text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index third_party_services_tp_idx on public.third_party_services (third_party_id);

-- --- Dördüncü taraf (alt yüklenici / nth-party) ---
create table public.fourth_parties (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  third_party_id uuid not null references public.third_parties (id) on delete cascade,
  ad text,
  -- BİLİNMEYEN BAĞIMLILIK (roadmap M09): alt sağlayıcı bilinmiyorsa açıkça
  -- işaretlenir — DÜŞÜK RİSK VARSAYILMAZ. Bilinen ise ad zorunlu.
  bilinmiyor boolean not null default false,
  hizmet_ozeti text,
  ulke text,
  created_at timestamptz not null default now(),
  constraint fourth_parties_ad_ya_da_bilinmiyor check (bilinmiyor = true or ad is not null)
);

create index fourth_parties_tp_idx on public.fourth_parties (third_party_id);

-- --- Sözleşme (yenileme/süre-dolumu + maddeler) ---
create table public.third_party_contracts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  third_party_id uuid not null references public.third_parties (id) on delete cascade,
  sozlesme_ref text not null,
  baslangic date not null,
  bitis date not null,
  denetim_hakki boolean not null default false,
  cikis_maddesi boolean not null default false,
  durum text not null default 'AKTIF' check (durum in ('AKTIF', 'SURESI_DOLDU', 'FESHEDILDI')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint third_party_contracts_sure check (bitis > baslangic)
);

create trigger third_party_contracts_set_updated_at
  before update on public.third_party_contracts
  for each row execute function public.set_updated_at();

create index third_party_contracts_bitis_idx on public.third_party_contracts (durum, bitis);

-- --- Çıkış planı (tatbikat kanıtı olmadan "test edildi" YASAK) ---
create table public.exit_plans (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  third_party_id uuid not null references public.third_parties (id) on delete cascade,
  ozet text not null,
  test_edildi boolean not null default false,
  test_tarihi date,
  -- Tatbikat kanıtı referansı (evidence/exercise). Yoksa "test edildi" olamaz.
  test_kaniti text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- INVARYANT (roadmap M09): "Tested exit" yalnız kanıt+tarih ile.
  constraint exit_plans_test_kaniti check (
    test_edildi = false or (test_kaniti is not null and test_tarihi is not null)
  )
);

create trigger exit_plans_set_updated_at
  before update on public.exit_plans
  for each row execute function public.set_updated_at();

create index exit_plans_tp_idx on public.exit_plans (third_party_id);

-- --- Sözleşme süre-dolumu cron (SoD/policy süre-dolumu deseni) ---
create or replace function public.tpr_sozlesme_dolanlari_isle()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kayit record;
begin
  for v_kayit in
    select id from public.third_party_contracts
    where durum = 'AKTIF' and bitis < current_date
    for update skip locked
  loop
    begin
      update public.third_party_contracts set durum = 'SURESI_DOLDU' where id = v_kayit.id;
    exception when others then
      raise notice 'sozlesme % islenemedi: %', v_kayit.id, sqlerrm;
    end;
  end loop;
end;
$$;

revoke execute on function public.tpr_sozlesme_dolanlari_isle() from authenticated, anon;

do $$
begin
  perform cron.schedule('kalkan-tpr-sozlesme-dolumu', '30 2 * * *', 'select public.tpr_sozlesme_dolanlari_isle();');
exception when others then
  raise notice 'pg_cron kullanilamiyor (tpr sozlesme dolumu zamanlanmadi): %', sqlerrm;
end;
$$;

-- --- Audit: vendor kararı değişimi ---
create or replace function public.audit_third_party()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
    values (new.tenant_id, auth.uid(), 'tedarikci_olusturuldu', 'third_parties', new.id,
      jsonb_build_object('tier', new.tier, 'karar', new.karar));
    return new;
  end if;
  if new.karar is distinct from old.karar then
    insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
    values (new.tenant_id, auth.uid(), 'tedarikci_karar_degisti', 'third_parties', new.id,
      jsonb_build_object('karar_onceki', old.karar, 'karar', new.karar));
  end if;
  return new;
end;
$$;

create trigger audit_third_party_insert
  after insert on public.third_parties
  for each row execute function public.audit_third_party();
create trigger audit_third_party_update
  after update on public.third_parties
  for each row execute function public.audit_third_party();

-- --- RLS: hepsi tenant'a kilitli; yazma admin/uyum ---
alter table public.third_parties enable row level security;
alter table public.third_party_services enable row level security;
alter table public.fourth_parties enable row level security;
alter table public.third_party_contracts enable row level security;
alter table public.exit_plans enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['third_parties', 'third_party_services', 'fourth_parties', 'third_party_contracts', 'exit_plans']
  loop
    execute format(
      'create policy %1$s_select on public.%1$s for select using (tenant_id = public.current_tenant_id())', t);
    execute format(
      'create policy %1$s_write on public.%1$s for all using (tenant_id = public.current_tenant_id() and public.current_user_role() in (''admin'', ''uyum'')) with check (tenant_id = public.current_tenant_id() and public.current_user_role() in (''admin'', ''uyum''))', t);
  end loop;
end;
$$;
