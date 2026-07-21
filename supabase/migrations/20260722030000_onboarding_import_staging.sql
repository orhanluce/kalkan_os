-- Dikey G1: kritik hizmet/kontrol/tedarikçi içe aktarma STAGING. SoD'nin
-- PR-3A/3B deseninin BİLİNÇLİ SADELEŞTİRİLMİŞ tekrarı — v1'de rollback
-- zinciri YOK (SoD PR-3C'nin kapsamı), yalnız önizle → uygula. Üç ayrı
-- şema yerine TEK jenerik tablo (entity_turu ile ayrışır) — kural: üçüncü
-- bir import motoru icat etme, ama üç paralel şema da gereksiz tekrar olur.

create table public.onboarding_import_onizlemeleri (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  entity_turu text not null check (entity_turu in ('KRITIK_HIZMET', 'KONTROL', 'TEDARIKCI')),
  kaynak text not null,
  dosya_hash text not null check (dosya_hash ~ '^[0-9a-f]{64}$'),
  -- Normalize edilmiş kayıtlar (apply bunları kullanır, CSV'yi yeniden
  -- ayrıştırmaz) + satır hataları.
  normalized_records jsonb not null,
  kayit_sayisi integer not null check (kayit_sayisi >= 0),
  satir_hatalari jsonb not null default '[]',
  durum text not null default 'READY_FOR_REVIEW'
    check (durum in ('READY_FOR_REVIEW', 'INVALID', 'APPLIED', 'STALE')),
  yukleyen uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now()
);

create index onboarding_import_onizlemeleri_tenant_idx
  on public.onboarding_import_onizlemeleri (tenant_id, entity_turu, created_at desc);

alter table public.onboarding_import_onizlemeleri enable row level security;

create policy onboarding_import_onizlemeleri_select on public.onboarding_import_onizlemeleri
  for select using (tenant_id = public.current_tenant_id());
create policy onboarding_import_onizlemeleri_insert on public.onboarding_import_onizlemeleri
  for insert with check (tenant_id = public.current_tenant_id() and yukleyen = auth.uid());

-- Önizleme değişmez bir dry-run kaydıdır; durum geçişi (APPLIED/STALE)
-- yalnız apply rotasında service_role ile (SoD PR-3A/3B deseniyle aynı).
revoke update, delete on public.onboarding_import_onizlemeleri from authenticated, anon;

-- Maker-checker (kural 14, kurucunun açık şartı): önizlemeyi yükleyen kişi
-- AYNI önizlemeyi uygulayamaz — SoD istisna/rollback guard'larıyla AYNI
-- bağımsızlık ilkesi. Apply rotası bunu SORGULAR (bu tabloda tutulan
-- `yukleyen` ile çağıranı karşılaştırır); burada yalnız veri sözleşmesi var,
-- zorlama route+RPC katmanında (aşağıdaki fonksiyon defense-in-depth).
create or replace function public.onboarding_import_uygula(
  p_onizleme_id uuid,
  p_uygulayan uuid
)
returns table (uygulanan_kayit_sayisi integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_onizleme record;
  v_kayit jsonb;
  v_sayac integer := 0;
begin
  select * into v_onizleme
  from public.onboarding_import_onizlemeleri
  where id = p_onizleme_id
  for update;

  if v_onizleme is null then
    raise exception 'onboarding_import_onizlemeleri kaydi bulunamadi' using errcode = 'P0002';
  end if;
  if v_onizleme.durum <> 'READY_FOR_REVIEW' then
    raise exception 'onizleme uygulanabilir durumda degil: %', v_onizleme.durum using errcode = 'P0001';
  end if;
  if v_onizleme.yukleyen = p_uygulayan then
    raise exception 'onizlemeyi yukleyen kisi ayni onizlemeyi uygulayamaz (bagimsizlik/dort goz)' using errcode = 'P0001';
  end if;

  if v_onizleme.entity_turu = 'KRITIK_HIZMET' then
    for v_kayit in select * from jsonb_array_elements(v_onizleme.normalized_records)
    loop
      insert into public.critical_business_services (tenant_id, ad, durum)
      values (v_onizleme.tenant_id, v_kayit ->> 'ad', coalesce(v_kayit ->> 'durum', 'AKTIF'));
      v_sayac := v_sayac + 1;
    end loop;
  elsif v_onizleme.entity_turu = 'TEDARIKCI' then
    for v_kayit in select * from jsonb_array_elements(v_onizleme.normalized_records)
    loop
      insert into public.third_parties (tenant_id, ad, hizmet_ozeti)
      values (v_onizleme.tenant_id, v_kayit ->> 'ad', v_kayit ->> 'hizmet_ozeti')
      on conflict (tenant_id, ad) do nothing;
      v_sayac := v_sayac + 1;
    end loop;
  elsif v_onizleme.entity_turu = 'KONTROL' then
    for v_kayit in select * from jsonb_array_elements(v_onizleme.normalized_records)
    loop
      insert into public.tenant_controls (tenant_id, control_id, durum)
      select v_onizleme.tenant_id, c.id, 'acik'
      from public.controls c
      where c.madde_ref = v_kayit ->> 'madde_ref'
      order by c.framework_id
      limit 1
      on conflict (tenant_id, control_id) do nothing;
      v_sayac := v_sayac + 1;
    end loop;
  end if;

  update public.onboarding_import_onizlemeleri
    set durum = 'APPLIED'
    where id = p_onizleme_id;

  insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
  values (
    v_onizleme.tenant_id, p_uygulayan, 'onboarding_import_uygulandi', 'onboarding_import_onizlemeleri', p_onizleme_id,
    jsonb_build_object('entity_turu', v_onizleme.entity_turu, 'kayit_sayisi', v_sayac)
  );

  return query select v_sayac;
end;
$$;

revoke execute on function public.onboarding_import_uygula(uuid, uuid) from public;
grant execute on function public.onboarding_import_uygula(uuid, uuid) to authenticated;

/**
 * Önizleme oluşturma denetim izi. gerekce/kanıt İÇERİĞİ yazılmaz (kural 7) —
 * yalnız hangi kaynak/tür, kaç kayıt, hangi hash.
 */
create or replace function public.audit_onboarding_import_onizleme()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
  values (
    new.tenant_id, auth.uid(), 'onboarding_import_onizleme_olusturuldu', 'onboarding_import_onizlemeleri', new.id,
    jsonb_build_object('entity_turu', new.entity_turu, 'kaynak', new.kaynak, 'kayit_sayisi', new.kayit_sayisi, 'dosya_hash', new.dosya_hash)
  );
  return new;
end;
$$;

create trigger audit_onboarding_import_onizleme_after_insert
  after insert on public.onboarding_import_onizlemeleri
  for each row execute function public.audit_onboarding_import_onizleme();
